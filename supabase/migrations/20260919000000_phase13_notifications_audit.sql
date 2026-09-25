-- Phase 13: Notifications & Audit Log (Correction: Interne uniquement)

-- 1. Table audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role TEXT,
    action_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add action_type column if it doesn't exist (resilient to partial existing table)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type TEXT;
UPDATE audit_logs SET action_type = 'UNKNOWN' WHERE action_type IS NULL;
ALTER TABLE audit_logs ALTER COLUMN action_type SET NOT NULL;

-- Add other columns if missing
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_type TEXT;
UPDATE audit_logs SET resource_type = 'unknown' WHERE resource_type IS NULL;
ALTER TABLE audit_logs ALTER COLUMN resource_type SET NOT NULL;

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS context JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Directors can view tenant audit logs" ON audit_logs
      FOR SELECT USING (
          tenant_id IN (
              SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND role = 'director'
          )
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Platform admins can view all audit logs" ON audit_logs
      FOR SELECT USING (
          EXISTS (
              SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND role = 'platform_admin'
          )
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Table notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    reference_type TEXT,
    reference_id UUID,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own notifications" ON notifications
      FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own notifications" ON notifications
      FOR UPDATE USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



-- 3. Modify record_payment to include rich notifications
CREATE OR REPLACE FUNCTION record_payment(
    p_tenant_id UUID,
    p_school_year_id UUID,
    p_student_id UUID,
    p_amount NUMERIC,
    p_currency currency_code,
    p_recorded_by UUID,
    p_allocations JSONB
) RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_alloc JSONB;
    v_obligation_id UUID;
    v_alloc_amount NUMERIC;
    v_total_allocated NUMERIC := 0;
    v_obligation RECORD;
    v_parent RECORD;
    v_receipt_id UUID;
    v_student_fname TEXT;
    v_student_lname TEXT;
    v_class_name TEXT;
    v_fee_names TEXT;
    v_total_remaining NUMERIC := 0;
    v_notif_title TEXT;
    v_notif_msg TEXT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant du paiement doit être strictement positif.';
    END IF;

    IF jsonb_array_length(p_allocations) = 0 THEN
        RAISE EXCEPTION 'Aucune allocation fournie pour le paiement.';
    END IF;

    -- Create payment record
    INSERT INTO payments (
        tenant_id,
        school_year_id,
        student_id,
        amount,
        currency,
        payment_date,
        recorded_by,
        status
    ) VALUES (
        p_tenant_id,
        p_school_year_id,
        p_student_id,
        p_amount,
        p_currency,
        CURRENT_DATE,
        p_recorded_by,
        'confirmed'
    ) RETURNING id INTO v_payment_id;

    -- Process allocations
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
        v_obligation_id := (v_alloc->>'obligation_id')::UUID;
        v_alloc_amount := (v_alloc->>'amount')::NUMERIC;

        IF v_alloc_amount <= 0 THEN
            RAISE EXCEPTION 'Le montant alloué doit être strictement positif.';
        END IF;

        v_total_allocated := v_total_allocated + v_alloc_amount;

        SELECT * INTO v_obligation 
        FROM financial_obligations 
        WHERE id = v_obligation_id AND tenant_id = p_tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Obligation % introuvable.', v_obligation_id;
        END IF;

        IF v_alloc_amount > v_obligation.remaining_amount THEN
            RAISE EXCEPTION 'Le montant alloué dépasse le reste à payer.';
        END IF;

        INSERT INTO payment_allocations (
            tenant_id, payment_id, obligation_id, amount
        ) VALUES (
            p_tenant_id, v_payment_id, v_obligation_id, v_alloc_amount
        );

        UPDATE financial_obligations 
        SET paid_amount = paid_amount + v_alloc_amount
        WHERE id = v_obligation_id;
        
        -- Accumulate remaining amount for the involved obligations
        v_total_remaining := v_total_remaining + (v_obligation.remaining_amount - v_alloc_amount);
    END LOOP;

    IF v_total_allocated != p_amount THEN
        RAISE EXCEPTION 'La somme des allocations ne correspond pas au montant du paiement.';
    END IF;

    -- Generate receipt
    v_receipt_id := generate_receipt_for_payment(v_payment_id);

    -- AUDIT LOG
    INSERT INTO audit_logs (tenant_id, user_id, role, action_type, resource_type, resource_id, new_values)
    VALUES (p_tenant_id, p_recorded_by, 'accountant', 'PAYMENT_CREATED', 'payment', v_payment_id, jsonb_build_object('amount', p_amount, 'currency', p_currency, 'allocations', p_allocations));

    -- NOTIFICATION
    -- Find active parent
    SELECT p.user_id, s.first_name, s.last_name, c.name INTO v_parent
    FROM parent_students ps
    JOIN parents p ON ps.parent_id = p.id
    JOIN students s ON ps.student_id = s.id
    LEFT JOIN class_students cs ON cs.student_id = s.id AND cs.ended_at IS NULL
    LEFT JOIN classes c ON c.id = cs.class_id
    WHERE ps.student_id = p_student_id AND ps.ended_at IS NULL
    LIMIT 1;

    IF FOUND AND v_parent.user_id IS NOT NULL THEN
        -- Get fee names
        SELECT string_agg(f.name, ', ') INTO v_fee_names
        FROM (
            SELECT DISTINCT fo.fee_id
            FROM jsonb_array_elements(p_allocations) alloc
            JOIN financial_obligations fo ON fo.id = (alloc->>'obligation_id')::UUID
        ) unique_fees
        JOIN fees f ON f.id = unique_fees.fee_id;

        IF v_total_remaining > 0 THEN
            v_notif_title := 'Paiement partiel enregistré';
            v_notif_msg := 'Un paiement de ' || p_amount || ' ' || p_currency || ' a été enregistré pour ' || v_parent.first_name || COALESCE(', en ' || v_parent.name, '') || '. Après ce paiement, il reste ' || v_total_remaining || ' ' || p_currency || ' à payer sur les frais concernés (' || v_fee_names || ').';
        ELSE
            v_notif_title := 'Frais entièrement réglés';
            v_notif_msg := 'Le paiement de ' || p_amount || ' ' || p_currency || ' pour ' || v_parent.first_name || ' a été enregistré. Les frais concernés (' || v_fee_names || ') sont maintenant entièrement réglés.';
        END IF;

        INSERT INTO notifications (tenant_id, user_id, type, title, message, reference_type, reference_id, context)
        VALUES (p_tenant_id, v_parent.user_id, 'PAYMENT_CREATED', v_notif_title, v_notif_msg, 'payment', v_payment_id, jsonb_build_object('student_id', p_student_id, 'student_name', v_parent.first_name || ' ' || v_parent.last_name));
    END IF;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Modify cancel_payment to include rich notifications
CREATE OR REPLACE FUNCTION cancel_payment(
    p_payment_id UUID,
    p_tenant_id UUID,
    p_cancellation_reason TEXT,
    p_cancelled_by UUID
) RETURNS VOID AS $$
DECLARE
    v_payment RECORD;
    v_alloc RECORD;
    v_parent RECORD;
    v_director RECORD;
    v_notif_msg TEXT;
BEGIN
    IF TRIM(p_cancellation_reason) = '' OR p_cancellation_reason IS NULL THEN
        RAISE EXCEPTION 'Le motif d''annulation est obligatoire.';
    END IF;

    SELECT * INTO v_payment 
    FROM payments 
    WHERE id = p_payment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement introuvable.';
    END IF;

    IF v_payment.status != 'confirmed' THEN
        RAISE EXCEPTION 'Seuls les paiements confirmés peuvent être annulés.';
    END IF;

    UPDATE payments 
    SET 
        status = 'cancelled',
        cancellation_reason = p_cancellation_reason,
        cancelled_at = NOW(),
        cancelled_by = p_cancelled_by
    WHERE id = p_payment_id;

    FOR v_alloc IN 
        SELECT * FROM payment_allocations WHERE payment_id = p_payment_id
    LOOP
        PERFORM id FROM financial_obligations WHERE id = v_alloc.obligation_id FOR UPDATE;

        UPDATE financial_obligations 
        SET paid_amount = paid_amount - v_alloc.amount
        WHERE id = v_alloc.obligation_id;
    END LOOP;

    -- AUDIT LOG
    INSERT INTO audit_logs (tenant_id, user_id, role, action_type, resource_type, resource_id, reason, context)
    VALUES (p_tenant_id, p_cancelled_by, 'accountant', 'PAYMENT_CANCELLED', 'payment', p_payment_id, p_cancellation_reason, jsonb_build_object('amount', v_payment.amount, 'currency', v_payment.currency));

    -- NOTIFICATION Parent
    SELECT p.user_id, s.first_name, s.last_name INTO v_parent 
    FROM parent_students ps
    JOIN parents p ON ps.parent_id = p.id
    JOIN students s ON ps.student_id = s.id
    WHERE ps.student_id = v_payment.student_id AND ps.ended_at IS NULL
    LIMIT 1;

    IF FOUND AND v_parent.user_id IS NOT NULL THEN
        v_notif_msg := 'Le paiement de ' || v_payment.amount || ' ' || v_payment.currency || ' enregistré pour ' || v_parent.first_name || ' le ' || TO_CHAR(v_payment.payment_date, 'DD/MM/YYYY') || ' a été annulé. Motif : ' || p_cancellation_reason || '. La situation financière de l''élève a été recalculée.';
        
        INSERT INTO notifications (tenant_id, user_id, type, title, message, reference_type, reference_id, context)
        VALUES (p_tenant_id, v_parent.user_id, 'PAYMENT_CANCELLED', 'Paiement annulé', v_notif_msg, 'payment', p_payment_id, jsonb_build_object('student_id', v_payment.student_id, 'student_name', v_parent.first_name || ' ' || v_parent.last_name));
    END IF;

    -- Notify Director(s)
    FOR v_director IN SELECT user_id FROM user_memberships WHERE tenant_id = p_tenant_id AND role = 'director' AND status = 'active'
    LOOP
        INSERT INTO notifications (tenant_id, user_id, type, title, message, reference_type, reference_id, context)
        VALUES (p_tenant_id, v_director.user_id, 'PAYMENT_CANCELLED_ALERT', 'Alerte: Paiement annulé', 'Le comptable a annulé un paiement de ' || v_payment.amount || ' ' || v_payment.currency || ' pour l''élève ' || COALESCE(v_parent.first_name, 'Inconnu') || '.', 'payment', p_payment_id, jsonb_build_object('reason', p_cancellation_reason));
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Modify record_payment_group to include audit and notifications
CREATE OR REPLACE FUNCTION record_payment_group(
    p_tenant_id UUID,
    p_school_year_id UUID,
    p_student_id UUID,
    p_recorded_by UUID,
    p_groups JSONB
) RETURNS UUID AS $$
DECLARE
    v_group JSONB;
    v_alloc JSONB;
    v_group_id UUID := gen_random_uuid();
    v_payment_id UUID;
    v_first_payment_id UUID;
    v_currency currency_code;
    v_amount NUMERIC;
    v_total_allocated NUMERIC;
    v_obligation RECORD;
    v_parent RECORD;
    v_receipt_id UUID;
    v_total_remaining NUMERIC := 0;
BEGIN
    IF jsonb_array_length(p_groups) = 0 THEN
        RAISE EXCEPTION 'Aucun paiement fourni.';
    END IF;

    FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups)
    LOOP
        v_currency := (v_group->>'currency')::currency_code;
        v_amount := (v_group->>'amount')::NUMERIC;
        v_total_allocated := 0;

        IF v_amount <= 0 OR jsonb_array_length(v_group->'allocations') = 0 THEN
            RAISE EXCEPTION 'Chaque devise doit avoir un montant et une allocation valides.';
        END IF;

        INSERT INTO payments (
            tenant_id, school_year_id, student_id, amount, currency,
            payment_group_id, payment_date, recorded_by, status
        ) VALUES (
            p_tenant_id, p_school_year_id, p_student_id, v_amount, v_currency,
            v_group_id, CURRENT_DATE, p_recorded_by, 'confirmed'
        ) RETURNING id INTO v_payment_id;

        IF v_first_payment_id IS NULL THEN
            v_first_payment_id := v_payment_id;
        END IF;

        FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_group->'allocations')
        LOOP
            SELECT * INTO v_obligation
            FROM financial_obligations
            WHERE id = (v_alloc->>'obligation_id')::UUID
              AND tenant_id = p_tenant_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Obligation introuvable.';
            END IF;

            IF (v_alloc->>'amount')::NUMERIC > v_obligation.remaining_amount THEN
                RAISE EXCEPTION 'Le montant alloué dépasse le solde de l''obligation.';
            END IF;

            v_total_allocated := v_total_allocated + (v_alloc->>'amount')::NUMERIC;

            INSERT INTO payment_allocations (tenant_id, payment_id, obligation_id, amount)
            VALUES (
                p_tenant_id, v_payment_id, (v_alloc->>'obligation_id')::UUID, (v_alloc->>'amount')::NUMERIC
            );

            UPDATE financial_obligations
            SET paid_amount = paid_amount + (v_alloc->>'amount')::NUMERIC
            WHERE id = (v_alloc->>'obligation_id')::UUID;
            
            v_total_remaining := v_total_remaining + (v_obligation.remaining_amount - (v_alloc->>'amount')::NUMERIC);
        END LOOP;

        IF v_total_allocated != v_amount THEN
            RAISE EXCEPTION 'Les allocations ne correspondent pas au montant du paiement.';
        END IF;
    END LOOP;

    v_receipt_id := generate_receipt_for_payment(v_first_payment_id);

    -- AUDIT LOG
    INSERT INTO audit_logs (tenant_id, user_id, role, action_type, resource_type, resource_id, new_values)
    VALUES (p_tenant_id, p_recorded_by, 'accountant', 'PAYMENT_GROUP_CREATED', 'payment_group', v_group_id, jsonb_build_object('groups', p_groups));

    -- NOTIFICATION Parent
    SELECT p.user_id, s.first_name, s.last_name INTO v_parent 
    FROM parent_students ps
    JOIN parents p ON ps.parent_id = p.id
    JOIN students s ON ps.student_id = s.id
    WHERE ps.student_id = p_student_id AND ps.ended_at IS NULL
    LIMIT 1;

    IF FOUND AND v_parent.user_id IS NOT NULL THEN
        INSERT INTO notifications (tenant_id, user_id, type, title, message, reference_type, reference_id, context)
        VALUES (p_tenant_id, v_parent.user_id, 'PAYMENT_CREATED', 'Groupe de paiements enregistré', 'Plusieurs paiements ont été enregistrés pour ' || v_parent.first_name || '. Leurs allocations ont été effectuées avec succès.', 'payment_group', v_group_id, jsonb_build_object('student_id', p_student_id, 'student_name', v_parent.first_name || ' ' || v_parent.last_name));
    END IF;

    RETURN v_first_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
