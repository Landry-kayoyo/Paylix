-- Migration Phase 8: Financial Fees and Obligations (Alter Existing Schema)

-- 1. Alter Fees Table
ALTER TABLE fees 
ADD COLUMN currency currency_code NOT NULL DEFAULT 'USD',
ADD COLUMN default_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE fees ALTER COLUMN default_amount DROP DEFAULT;
ALTER TABLE fees ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE fees ADD CONSTRAINT positive_default_amount CHECK (default_amount > 0);

-- 2. Alter Fee Schedules Table
-- We drop currency as it is now on the fee itself
ALTER TABLE fee_schedules DROP COLUMN currency;
-- Add constraint if not exists
ALTER TABLE fee_schedules ADD CONSTRAINT positive_amount CHECK (amount > 0);

-- 3. Alter Financial Obligations Table
ALTER TABLE financial_obligations 
RENAME COLUMN amount_due TO initial_amount;

ALTER TABLE financial_obligations
ADD COLUMN paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN remaining_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN enrollment_id UUID REFERENCES student_enrollments(id) ON DELETE CASCADE;

-- Populate remaining_amount for existing records if any
UPDATE financial_obligations SET remaining_amount = initial_amount;

ALTER TABLE financial_obligations ADD CONSTRAINT positive_amounts CHECK (initial_amount > 0 AND paid_amount >= 0 AND remaining_amount >= 0);
ALTER TABLE financial_obligations ADD CONSTRAINT amount_consistency CHECK (paid_amount + remaining_amount = initial_amount);

-- Add anti-doublon constraint (unique on enrollment + fee + fee_schedule)
-- Wait, some existing might violate if enrollment_id is null. We'll leave it as a unique constraint that allows null enrollment for backwards compatibility if needed, 
-- but we should enforce it for new records.
-- Actually, we can make enrollment_id NOT NULL if we assume we are starting fresh or all have enrollments. But let's just add the constraint.
ALTER TABLE financial_obligations ADD CONSTRAINT unique_obligation_unique_fee UNIQUE NULLS NOT DISTINCT (enrollment_id, fee_id, fee_schedule_id);

-- 4. Trigger for status update on obligations
CREATE OR REPLACE FUNCTION update_obligation_status() RETURNS TRIGGER AS $$
BEGIN
    NEW.remaining_amount = NEW.initial_amount - NEW.paid_amount;
    
    IF NEW.remaining_amount = 0 THEN
        NEW.status = 'paid';
    ELSIF NEW.paid_amount > 0 AND NEW.remaining_amount > 0 THEN
        NEW.status = 'partial';
    ELSIF NEW.remaining_amount = NEW.initial_amount THEN
        NEW.status = 'unpaid';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_obligation_status ON financial_obligations;
CREATE TRIGGER trg_update_obligation_status
BEFORE INSERT OR UPDATE OF initial_amount, paid_amount ON financial_obligations
FOR EACH ROW EXECUTE FUNCTION update_obligation_status();

-- 5. RLS for Parents (ensure it exists or create)
-- We add policies for parents to view obligations. We use the existing table name.
DROP POLICY IF EXISTS "Parents can view own students obligations" ON financial_obligations;
CREATE POLICY "Parents can view own students obligations" ON financial_obligations FOR SELECT USING (
  student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_obligations_enrollment ON financial_obligations(enrollment_id);
