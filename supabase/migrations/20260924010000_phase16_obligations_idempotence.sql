-- Phase 16: Obligations Idempotence and Automatic Generation

-- 1. Create unique indexes to ensure idempotency (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_obligations_unique_fee 
ON financial_obligations (student_id, school_year_id, fee_id) 
WHERE fee_schedule_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_obligations_monthly_fee 
ON financial_obligations (student_id, school_year_id, fee_id, fee_schedule_id) 
WHERE fee_schedule_id IS NOT NULL;

-- 2. Function to automatically generate obligations for a student
CREATE OR REPLACE FUNCTION generate_student_obligations(
    p_tenant_id UUID,
    p_student_id UUID,
    p_school_year_id UUID
) RETURNS VOID AS $$
DECLARE
    v_class_id UUID;
    v_enrollment_id UUID;
BEGIN
    -- Get the student's class and enrollment for the target school year
    SELECT class_id, id INTO v_class_id, v_enrollment_id
    FROM student_enrollments
    WHERE student_id = p_student_id 
      AND school_year_id = p_school_year_id 
      AND tenant_id = p_tenant_id
    LIMIT 1;

    IF v_class_id IS NULL THEN
        RETURN; -- No enrollment found
    END IF;

    -- A. Generate UNIQUE fees
    INSERT INTO financial_obligations (
        tenant_id, student_id, school_year_id, fee_id, fee_schedule_id, enrollment_id,
        initial_amount, remaining_amount, currency, status, due_date
    )
    SELECT 
        p_tenant_id, p_student_id, p_school_year_id, f.id, NULL, v_enrollment_id,
        f.default_amount, f.default_amount, f.currency, 'unpaid'::obligation_status, NULL
    FROM fees f
    JOIN fee_classes fc ON fc.fee_id = f.id
    WHERE f.tenant_id = p_tenant_id 
      AND f.school_year_id = p_school_year_id
      AND f.status = 'active'
      AND f.fee_type = 'unique'
      AND fc.class_id = v_class_id
      AND NOT EXISTS (
          SELECT 1 FROM financial_obligations fo
          WHERE fo.student_id = p_student_id
            AND fo.school_year_id = p_school_year_id
            AND fo.fee_id = f.id
            AND fo.fee_schedule_id IS NULL
      );

    -- B. Generate MONTHLY fees
    INSERT INTO financial_obligations (
        tenant_id, student_id, school_year_id, fee_id, fee_schedule_id, enrollment_id,
        initial_amount, remaining_amount, currency, status, due_date
    )
    SELECT 
        p_tenant_id, p_student_id, p_school_year_id, f.id, fs.id, v_enrollment_id,
        fs.amount, fs.amount, f.currency, 
        CASE 
            WHEN fs.due_date < CURRENT_DATE THEN 'overdue'::obligation_status
            ELSE 'unpaid'::obligation_status
        END,
        fs.due_date
    FROM fees f
    JOIN fee_classes fc ON fc.fee_id = f.id
    JOIN fee_schedules fs ON fs.fee_id = f.id
    WHERE f.tenant_id = p_tenant_id 
      AND f.school_year_id = p_school_year_id
      AND f.status = 'active'
      AND f.fee_type = 'monthly'
      AND fc.class_id = v_class_id
      AND NOT EXISTS (
          SELECT 1 FROM financial_obligations fo
          WHERE fo.student_id = p_student_id
            AND fo.school_year_id = p_school_year_id
            AND fo.fee_id = f.id
            AND fo.fee_schedule_id = fs.id
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Function to update overdue obligations
CREATE OR REPLACE FUNCTION update_overdue_obligations() RETURNS VOID AS $$
BEGIN
    UPDATE financial_obligations
    SET status = 'overdue'::obligation_status,
        updated_at = NOW()
    WHERE status = 'unpaid'
      AND due_date IS NOT NULL
      AND due_date < CURRENT_DATE
      AND remaining_amount > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Trigger to call generation automatically upon new enrollment
CREATE OR REPLACE FUNCTION trigger_generate_obligations_on_enrollment() RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if the school year is active (or maybe we generate anyway, but rule 5 says: "Si une année scolaire est en PREPARATION ne génère pas automatiquement")
    IF EXISTS (
        SELECT 1 FROM school_years 
        WHERE id = NEW.school_year_id AND status = 'active'
    ) THEN
        PERFORM generate_student_obligations(NEW.tenant_id, NEW.student_id, NEW.school_year_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_student_enrollment_created ON student_enrollments;
CREATE TRIGGER on_student_enrollment_created
AFTER INSERT ON student_enrollments
FOR EACH ROW
EXECUTE FUNCTION trigger_generate_obligations_on_enrollment();
