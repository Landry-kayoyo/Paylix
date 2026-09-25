-- Migration Phase 9: Comptabilité - Paiements & Allocations

-- 1. Alter Payments Table
-- On retire les moyens de paiement et on ajoute les informations d'annulation.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_id_fkey;
ALTER TABLE payments DROP COLUMN IF EXISTS payment_method_id;

-- Ensure amount is strictly positive
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount > 0);

ALTER TABLE payments
ADD COLUMN cancellation_reason TEXT,
ADD COLUMN cancelled_at TIMESTAMPTZ,
ADD COLUMN cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL;


-- 2. Update the financial_obligations trigger to handle 'overdue' (EN_RETARD)
CREATE OR REPLACE FUNCTION update_obligation_status() RETURNS TRIGGER AS $$
BEGIN
    NEW.remaining_amount = NEW.initial_amount - NEW.paid_amount;
    
    IF NEW.remaining_amount <= 0 THEN
        NEW.status = 'paid';
        NEW.remaining_amount = 0;
    ELSIF NEW.paid_amount > 0 AND NEW.remaining_amount > 0 THEN
        IF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
            NEW.status = 'overdue';
        ELSE
            NEW.status = 'partial';
        END IF;
    ELSIF NEW.remaining_amount = NEW.initial_amount THEN
        IF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
            NEW.status = 'overdue';
        ELSE
            NEW.status = 'unpaid';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 3. RPC: Record Payment with Allocations
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
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant du paiement doit être strictement positif.';
    END IF;

    IF jsonb_array_length(p_allocations) = 0 THEN
        RAISE EXCEPTION 'Aucune allocation fournie pour le paiement.';
    END IF;

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
            RAISE EXCEPTION 'Obligation % introuvable ou n''appartient pas à l''établissement.', v_obligation_id;
        END IF;

        IF v_obligation.currency != p_currency THEN
            RAISE EXCEPTION 'La devise de l''obligation (%) ne correspond pas à celle du paiement (%).', v_obligation.currency, p_currency;
        END IF;

        IF v_obligation.student_id != p_student_id THEN
            RAISE EXCEPTION 'L''obligation n''appartient pas à cet élève.';
        END IF;

        IF v_alloc_amount > v_obligation.remaining_amount THEN
            RAISE EXCEPTION 'Le montant alloué (%) dépasse le reste à payer (%) pour l''obligation %.', v_alloc_amount, v_obligation.remaining_amount, v_obligation_id;
        END IF;

        INSERT INTO payment_allocations (
            tenant_id,
            payment_id,
            obligation_id,
            amount
        ) VALUES (
            p_tenant_id,
            v_payment_id,
            v_obligation_id,
            v_alloc_amount
        );

        UPDATE financial_obligations 
        SET paid_amount = paid_amount + v_alloc_amount
        WHERE id = v_obligation_id;
    END LOOP;

    IF v_total_allocated != p_amount THEN
        RAISE EXCEPTION 'La somme des allocations (%) ne correspond pas au montant du paiement (%).', v_total_allocated, p_amount;
    END IF;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: Cancel Payment
CREATE OR REPLACE FUNCTION cancel_payment(
    p_payment_id UUID,
    p_tenant_id UUID,
    p_cancellation_reason TEXT,
    p_cancelled_by UUID
) RETURNS VOID AS $$
DECLARE
    v_payment RECORD;
    v_alloc RECORD;
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RLS Policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view payments for their tenant" ON payments;
CREATE POLICY "Users can view payments for their tenant" ON payments FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view payment allocations for their tenant" ON payment_allocations;
CREATE POLICY "Users can view payment allocations for their tenant" ON payment_allocations FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid())
);
