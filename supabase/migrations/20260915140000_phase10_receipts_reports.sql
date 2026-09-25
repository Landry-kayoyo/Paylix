-- Migration Phase 10: Reçus & Rapports Financiers

-- 1. Table de numérotation séquentielle des reçus par établissement et année scolaire
CREATE TABLE IF NOT EXISTS tenant_receipt_counters (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    last_sequence INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, school_year_id)
);

-- Active RLS sur tenant_receipt_counters
ALTER TABLE tenant_receipt_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view receipt counters for their tenant" ON tenant_receipt_counters;
CREATE POLICY "Users can view receipt counters for their tenant" ON tenant_receipt_counters FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid())
);

-- 2. Mise à jour de la table receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS verification_token UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_payment_id_key;
ALTER TABLE receipts ADD CONSTRAINT receipts_payment_id_key UNIQUE (payment_id);

-- 3. Fonction RPC: Génération idempotente du reçu de paiement
CREATE OR REPLACE FUNCTION generate_receipt_for_payment(p_payment_id UUID)
RETURNS UUID AS $$
DECLARE
    v_payment RECORD;
    v_school_year RECORD;
    v_receipt_id UUID;
    v_seq INT;
    v_year_str TEXT;
    v_receipt_num TEXT;
BEGIN
    -- Si le reçu existe déjà, retourner son ID
    SELECT id INTO v_receipt_id FROM receipts WHERE payment_id = p_payment_id;
    IF v_receipt_id IS NOT NULL THEN
        RETURN v_receipt_id;
    END IF;

    -- Verrouiller et récupérer le paiement
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement introuvable pour la génération du reçu.';
    END IF;

    IF v_payment.status != 'confirmed' THEN
        RAISE EXCEPTION 'Un reçu officiel ne peut être généré que pour un paiement confirmé.';
    END IF;

    -- Récupérer l'année scolaire pour construire le format REC-[ANNÉE]-[SEQ]
    SELECT * INTO v_school_year FROM school_years WHERE id = v_payment.school_year_id;
    IF FOUND AND v_school_year.start_date IS NOT NULL THEN
        v_year_str := TO_CHAR(v_school_year.start_date, 'YYYY');
    ELSE
        v_year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    END IF;

    -- Décrémenter/Incrémenter le compteur de reçus spécifique (tenant_id + school_year_id)
    INSERT INTO tenant_receipt_counters (tenant_id, school_year_id, last_sequence)
    VALUES (v_payment.tenant_id, v_payment.school_year_id, 1)
    ON CONFLICT (tenant_id, school_year_id) DO UPDATE
    SET last_sequence = tenant_receipt_counters.last_sequence + 1
    RETURNING last_sequence INTO v_seq;

    -- Formatage du numéro de reçu REC-2026-000001
    v_receipt_num := 'REC-' || v_year_str || '-' || LPAD(v_seq::TEXT, 6, '0');

    -- Insérer le reçu dans la base de données
    INSERT INTO receipts (
        tenant_id,
        payment_id,
        receipt_number,
        verification_token,
        issued_at
    ) VALUES (
        v_payment.tenant_id,
        p_payment_id,
        v_receipt_num,
        gen_random_uuid(),
        NOW()
    ) RETURNING id INTO v_receipt_id;

    RETURN v_receipt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Mise à jour de record_payment pour générer le reçu automatiquement
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

    -- Génération automatique et atomique du reçu officiel
    PERFORM generate_receipt_for_payment(v_payment_id);

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RPC Publique de vérification du reçu sans exposer d'informations privées
CREATE OR REPLACE FUNCTION verify_receipt_public(p_token UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'valid', true,
        'receipt_number', r.receipt_number,
        'issued_at', r.issued_at,
        'payment_date', p.payment_date,
        'status', p.status,
        'amount', p.amount,
        'currency', p.currency,
        'cancellation_reason', p.cancellation_reason,
        'cancelled_at', p.cancelled_at,
        'school_name', t.name,
        'school_logo', t.logo_url,
        'student_first_name', s.first_name,
        'student_last_name', s.last_name,
        'student_matricule', s.matricule
    ) INTO v_result
    FROM receipts r
    JOIN payments p ON p.id = r.payment_id
    JOIN tenants t ON t.id = r.tenant_id
    JOIN students s ON s.id = p.student_id
    WHERE r.verification_token = p_token;

    IF v_result IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Reçu introuvable ou invalide');
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Mise à jour des politiques RLS pour receipts
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view receipts for their tenant" ON receipts;
CREATE POLICY "Users can view receipts for their tenant" ON receipts FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid())
);
