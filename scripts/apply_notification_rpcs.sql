-- ================================================================
-- PHASE 13: Fonctions RPC adaptees au VRAI schema existant
-- audit_logs: actor_user_id, action, metadata, result
-- notifications: tenant_id, user_id, type, title, message, 
--                reference_type, reference_id, context, read_at
-- ================================================================

-- record_payment avec audit + notification
CREATE OR REPLACE FUNCTION record_payment(
    p_tenant_id UUID,
    p_school_year_id UUID,
    p_student_id UUID,
    p_amount NUMERIC,
    p_currency TEXT,
    p_recorded_by UUID,
    p_allocations JSONB
) RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_alloc JSONB;
    v_obligation_id UUID;
    v_alloc_amount NUMERIC;
    v_total_allocated NUMERIC := 0;
    v_total_remaining NUMERIC := 0;
    v_obligation RECORD;
    v_parent_user_id UUID;
    v_student_first_name TEXT;
    v_student_last_name TEXT;
    v_class_name TEXT;
    v_fee_names TEXT;
    v_notif_title TEXT;
    v_notif_msg TEXT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant du paiement doit etre strictement positif.';
    END IF;

    IF jsonb_array_length(p_allocations) = 0 THEN
        RAISE EXCEPTION 'Aucune allocation fournie pour le paiement.';
    END IF;

    INSERT INTO payments (
        tenant_id, school_year_id, student_id, amount, currency,
        payment_date, recorded_by, status
    ) VALUES (
        p_tenant_id, p_school_year_id, p_student_id, p_amount, p_currency::currency_code,
        CURRENT_DATE, p_recorded_by, 'confirmed'
    ) RETURNING id INTO v_payment_id;

    FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
        v_obligation_id := (v_alloc->>'obligation_id')::UUID;
        v_alloc_amount := (v_alloc->>'amount')::NUMERIC;

        IF v_alloc_amount <= 0 THEN
            RAISE EXCEPTION 'Le montant alloue doit etre strictement positif.';
        END IF;

        v_total_allocated := v_total_allocated + v_alloc_amount;

        SELECT * INTO v_obligation
        FROM financial_obligations
        WHERE id = v_obligation_id AND tenant_id = p_tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Obligation % introuvable.', v_obligation_id;
        END IF;

        IF v_obligation.currency::TEXT != p_currency THEN
            RAISE EXCEPTION 'Devise incorrecte: obligation=% paiement=%', v_obligation.currency, p_currency;
        END IF;

        IF v_obligation.student_id != p_student_id THEN
            RAISE EXCEPTION 'L obligation n appartient pas a cet eleve.';
        END IF;

        IF v_alloc_amount > v_obligation.remaining_amount THEN
            RAISE EXCEPTION 'Montant alloue % depasse le reste % pour obligation %.', v_alloc_amount, v_obligation.remaining_amount, v_obligation_id;
        END IF;

        INSERT INTO payment_allocations (tenant_id, payment_id, obligation_id, amount)
        VALUES (p_tenant_id, v_payment_id, v_obligation_id, v_alloc_amount);

        UPDATE financial_obligations
        SET paid_amount = paid_amount + v_alloc_amount
        WHERE id = v_obligation_id;

        v_total_remaining := v_total_remaining + (v_obligation.remaining_amount - v_alloc_amount);
    END LOOP;

    IF v_total_allocated != p_amount THEN
        RAISE EXCEPTION 'Somme allocations % != montant paiement %.', v_total_allocated, p_amount;
    END IF;

    PERFORM generate_receipt_for_payment(v_payment_id);

    -- AUDIT (using existing audit_logs schema)
    INSERT INTO audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, result, metadata)
    VALUES (p_tenant_id, p_recorded_by, 'PAYMENT_CREATED', 'payment', v_payment_id, 'success',
        jsonb_build_object('amount', p_amount, 'currency', p_currency, 'student_id', p_student_id, 'allocations', p_allocations));

    -- Get student info + class + parent
    SELECT s.first_name, s.last_name, c.name, par.user_id
    INTO v_student_first_name, v_student_last_name, v_class_name, v_parent_user_id
    FROM students s
    LEFT JOIN student_enrollments se ON se.student_id = s.id
    LEFT JOIN classes c ON c.id = se.class_id
    LEFT JOIN parent_students ps ON ps.student_id = s.id AND ps.ended_at IS NULL
    LEFT JOIN parents par ON par.id = ps.parent_id
    WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
    LIMIT 1;

    -- Get fee names
    SELECT string_agg(DISTINCT f.name, ', ')
    INTO v_fee_names
    FROM jsonb_array_elements(p_allocations) alloc
    JOIN financial_obligations fo ON fo.id = (alloc->>'obligation_id')::UUID
    JOIN fees f ON f.id = fo.fee_id;

    -- Build contextual message
    IF v_total_remaining > 0 THEN
        v_notif_title := 'Paiement partiel enregistre';
        v_notif_msg := 'Un paiement de ' || p_amount || ' ' || p_currency ||
            ' a ete enregistre pour ' || COALESCE(v_student_first_name, 'votre enfant') ||
            CASE WHEN v_class_name IS NOT NULL THEN ', en ' || v_class_name ELSE '' END ||
            ', le ' || TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY') ||
            '. Frais : ' || COALESCE(v_fee_names, 'N/A') ||
            '. Il reste ' || v_total_remaining || ' ' || p_currency || ' a payer.';
    ELSE
        v_notif_title := 'Frais entierement regles';
        v_notif_msg := 'Le paiement de ' || p_amount || ' ' || p_currency ||
            ' pour ' || COALESCE(v_student_first_name, 'votre enfant') ||
            CASE WHEN v_class_name IS NOT NULL THEN ', en ' || v_class_name ELSE '' END ||
            ', le ' || TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY') ||
            '. Les frais ' || COALESCE(v_fee_names, '') || ' sont entierement regles.';
    END IF;

    IF v_parent_user_id IS NOT NULL THEN
        INSERT INTO notifications (tenant_id, user_id, type, title, message, reference_type, reference_id, context)
        VALUES (p_tenant_id, v_parent_user_id, 'PAYMENT_CREATED', v_notif_title, v_notif_msg,
            'payment', v_payment_id,
            jsonb_build_object(
                'student_id', p_student_id,
                'student_name', COALESCE(v_student_first_name || ' ' || v_student_last_name, ''),
                'class_name', COALESCE(v_class_name, ''),
                'amount', p_amount, 'currency', p_currency, 'remaining', v_total_remaining
            ));
    END IF;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- cancel_payment avec audit + notification
CREATE OR REPLACE FUNCTION cancel_payment(
    p_payment_id UUID,
    p_tenant_id UUID,
    p_cancellation_reason TEXT,
    p_cancelled_by UUID
) RETURNS VOID AS $$
DECLARE
    v_payment RECORD;
    v_alloc RECORD;
    v_parent_user_id UUID;
    v_student_first_name TEXT;
    v_notif_msg TEXT;
    v_director RECORD;
    v_accountant_name TEXT;
BEGIN
    IF TRIM(COALESCE(p_cancellation_reason, '')) = '' THEN
        RAISE EXCEPTION 'Le motif d annulation est obligatoire.';
    END IF;

    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement introuvable.';
    END IF;

    IF v_payment.status != 'confirmed' THEN
        RAISE EXCEPTION 'Seuls les paiements confirmes peuvent etre annules.';
    END IF;

    UPDATE payments
    SET status = 'cancelled', cancellation_reason = p_cancellation_reason,
        cancelled_at = NOW(), cancelled_by = p_cancelled_by
    WHERE id = p_payment_id;

    FOR v_alloc IN SELECT * FROM payment_allocations WHERE payment_id = p_payment_id
    LOOP
        PERFORM id FROM financial_obligations WHERE id = v_alloc.obligation_id FOR UPDATE;
        UPDATE financial_obligations SET paid_amount = paid_amount - v_alloc.amount WHERE id = v_alloc.obligation_id;
    END LOOP;

    -- AUDIT (existing schema)
    INSERT INTO audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, result, metadata)
    VALUES (p_tenant_id, p_cancelled_by, 'PAYMENT_CANCELLED', 'payment', p_payment_id, 'success',
        jsonb_build_object('amount', v_payment.amount, 'currency', v_payment.currency, 'reason', p_cancellation_reason));

    SELECT s.first_name, par.user_id
    INTO v_student_first_name, v_parent_user_id
    FROM students s
    LEFT JOIN parent_students ps ON ps.student_id = s.id AND ps.ended_at IS NULL
    LEFT JOIN parents par ON par.id = ps.parent_id
    WHERE s.id = v_payment.student_id AND s.tenant_id = p_tenant_id
    LIMIT 1;

    -- Fetch accountant name
    SELECT COALESCE(first_name || ' ' || last_name, 'Inconnu') INTO v_accountant_name
    FROM profiles WHERE id = p_cancelled_by;

    IF v_parent_user_id IS NOT NULL THEN
        v_notif_msg := 'Le paiement de ' || v_payment.amount || ' ' || v_payment.currency::TEXT ||
            ' pour ' || COALESCE(v_student_first_name, 'votre enfant') ||
            ' du ' || TO_CHAR(v_payment.payment_date, 'DD/MM/YYYY') ||
            ' a ete annule. Motif : ' || p_cancellation_reason ||
            '. La situation financiere a ete recalculee.';

        INSERT INTO notifications (tenant_id, user_id, type, title, message, reference_type, reference_id, context)
        VALUES (p_tenant_id, v_parent_user_id, 'PAYMENT_CANCELLED', 'Paiement annule', v_notif_msg,
            'payment', p_payment_id,
            jsonb_build_object('amount', v_payment.amount, 'reason', p_cancellation_reason));
    END IF;

    FOR v_director IN
        SELECT user_id FROM user_memberships
        WHERE tenant_id = p_tenant_id AND role = 'director' AND status = 'active'
    LOOP
        INSERT INTO notifications (tenant_id, user_id, type, title, message, reference_type, reference_id, context)
        VALUES (p_tenant_id, v_director.user_id, 'PAYMENT_CANCELLED',
            'Alerte : Paiement annule',
            'Un paiement de ' || v_payment.amount || ' ' || v_payment.currency::TEXT ||
            ' a ete annule par le comptable ' || v_accountant_name || '. Motif : ' || p_cancellation_reason,
            'payment', p_payment_id,
            jsonb_build_object('reason', p_cancellation_reason, 'cancelled_by', v_accountant_name));
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
