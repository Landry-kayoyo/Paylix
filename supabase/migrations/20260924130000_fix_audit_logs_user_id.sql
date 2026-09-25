-- Fix: audit_logs utilise actor_user_id dans le schéma initial,
-- mais les fonctions Phase 13 insèrent avec user_id.
-- On ajoute user_id comme colonne réelle pour compatibilité.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Recréer record_payment_group avec la bonne colonne audit_logs.user_id
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
    v_total_remaining NUMERIC := 0;
    v_obligation RECORD;
    v_parent RECORD;
    v_receipt_id UUID;
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
                RAISE EXCEPTION 'Obligation introuvable ou non autorisée.';
            END IF;

            IF v_obligation.student_id != p_student_id
               OR v_obligation.currency != v_currency THEN
                RAISE EXCEPTION 'L''obligation ne correspond pas à l''élève ou à la devise du paiement.';
            END IF;

            IF (v_alloc->>'amount')::NUMERIC <= 0
               OR (v_alloc->>'amount')::NUMERIC > v_obligation.remaining_amount THEN
                RAISE EXCEPTION 'Le montant alloué dépasse le solde de l''obligation.';
            END IF;

            v_total_allocated := v_total_allocated + (v_alloc->>'amount')::NUMERIC;
            v_total_remaining := v_total_remaining + (v_obligation.remaining_amount - (v_alloc->>'amount')::NUMERIC);

            INSERT INTO payment_allocations (tenant_id, payment_id, obligation_id, amount)
            VALUES (
                p_tenant_id,
                v_payment_id,
                (v_alloc->>'obligation_id')::UUID,
                (v_alloc->>'amount')::NUMERIC
            );

            UPDATE financial_obligations
            SET paid_amount = paid_amount + (v_alloc->>'amount')::NUMERIC
            WHERE id = (v_alloc->>'obligation_id')::UUID;
        END LOOP;

        IF v_total_allocated != v_amount THEN
            RAISE EXCEPTION 'Les allocations de % ne correspondent pas au montant du paiement.', v_currency;
        END IF;
    END LOOP;

    -- Générer le reçu
    PERFORM generate_receipt_for_payment(v_first_payment_id);

    -- AUDIT LOG (utilise user_id qui est maintenant dans la table)
    INSERT INTO audit_logs (tenant_id, user_id, action, action_type, resource_type, resource_id, new_values)
    VALUES (p_tenant_id, p_recorded_by, 'PAYMENT_GROUP_CREATED', 'PAYMENT_GROUP_CREATED', 'payment_group', v_group_id,
            jsonb_build_object('groups', p_groups));

    -- NOTIFICATION Parent
    SELECT p.user_id, s.first_name, s.last_name INTO v_parent
    FROM parent_students ps
    JOIN parents p ON ps.parent_id = p.id
    JOIN students s ON ps.student_id = s.id
    WHERE ps.student_id = p_student_id AND ps.ended_at IS NULL
    LIMIT 1;

    IF FOUND AND v_parent.user_id IS NOT NULL THEN
        INSERT INTO notifications (tenant_id, user_id, type, title, message, reference_type, reference_id, context)
        VALUES (
            p_tenant_id, v_parent.user_id, 'PAYMENT_CREATED',
            'Paiement enregistré',
            'Un paiement a été enregistré pour ' || v_parent.first_name || ' ' || v_parent.last_name || '.',
            'payment_group', v_group_id,
            jsonb_build_object('student_id', p_student_id, 'student_name', v_parent.first_name || ' ' || v_parent.last_name)
        );
    END IF;

    RETURN v_first_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
