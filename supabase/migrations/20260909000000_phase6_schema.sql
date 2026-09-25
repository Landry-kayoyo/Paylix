-- Migration Phase 6: Students, Matricules, Enrollments

-- 1. Create table for matricule counters
CREATE TABLE tenant_matricule_counters (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    last_sequence INT DEFAULT 0
);

-- 2. Create student_enrollments table
CREATE TABLE student_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, student_id, school_year_id)
);

-- 3. Create enrollment_history table
CREATE TABLE enrollment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES student_enrollments(id) ON DELETE CASCADE,
    old_class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    new_class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 4. Move existing data to enrollments (if any)
INSERT INTO student_enrollments (tenant_id, student_id, school_year_id, class_id)
SELECT tenant_id, id, school_year_id, class_id FROM students
WHERE school_year_id IS NOT NULL AND class_id IS NOT NULL;

-- 5. Alter students table
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_class_id_fkey;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_school_year_id_fkey;
ALTER TABLE students DROP COLUMN class_id CASCADE;
ALTER TABLE students DROP COLUMN school_year_id CASCADE;

-- 6. Indices
CREATE INDEX idx_student_enrollments_tenant ON student_enrollments(tenant_id);
CREATE INDEX idx_student_enrollments_student ON student_enrollments(student_id);
CREATE INDEX idx_student_enrollments_year ON student_enrollments(school_year_id);
CREATE INDEX idx_student_enrollments_class ON student_enrollments(class_id);

CREATE INDEX idx_enrollment_history_tenant ON enrollment_history(tenant_id);
CREATE INDEX idx_enrollment_history_enrollment ON enrollment_history(enrollment_id);

-- 7. Functions for transactional operations

-- 7.a Generate Matricule
CREATE OR REPLACE FUNCTION generate_matricule(
    p_tenant_id UUID,
    p_year_prefix TEXT,
    p_name_letter TEXT,
    p_postname_letter TEXT
) RETURNS TEXT AS $$
DECLARE
    v_seq INT;
    v_matricule TEXT;
BEGIN
    INSERT INTO tenant_matricule_counters (tenant_id, last_sequence)
    VALUES (p_tenant_id, 1)
    ON CONFLICT (tenant_id) 
    DO UPDATE SET last_sequence = tenant_matricule_counters.last_sequence + 1
    RETURNING last_sequence INTO v_seq;

    v_matricule := p_year_prefix || p_name_letter || p_postname_letter || v_seq::TEXT;
    
    RETURN v_matricule;
END;
$$ LANGUAGE plpgsql;

-- 7.b Create Student with Enrollment (Transactional)
CREATE OR REPLACE FUNCTION create_student_with_enrollment(
    p_tenant_id UUID,
    p_first_name TEXT,
    p_last_name TEXT,
    p_post_name TEXT,
    p_date_of_birth DATE,
    p_gender TEXT,
    p_school_year_id UUID,
    p_class_id UUID,
    p_year_prefix TEXT
) RETURNS UUID AS $$
DECLARE
    v_name_letter TEXT;
    v_postname_letter TEXT;
    v_matricule TEXT;
    v_student_id UUID;
    v_clean_post_name TEXT;
BEGIN
    -- Determine letters securely. Handle nulls safely.
    v_name_letter := upper(left(COALESCE(NULLIF(TRIM(p_last_name), ''), 'X'), 1));
    
    v_clean_post_name := TRIM(p_post_name);
    IF v_clean_post_name IS NULL OR v_clean_post_name = '' THEN
        v_postname_letter := upper(left(COALESCE(NULLIF(TRIM(p_first_name), ''), 'X'), 1));
    ELSE
        v_postname_letter := upper(left(v_clean_post_name, 1));
    END IF;
    
    -- Generate matricule
    v_matricule := generate_matricule(p_tenant_id, p_year_prefix, v_name_letter, v_postname_letter);
    
    -- Insert student
    INSERT INTO students (tenant_id, matricule, first_name, last_name, post_name, date_of_birth, gender, status)
    VALUES (p_tenant_id, v_matricule, p_first_name, p_last_name, p_post_name, p_date_of_birth, p_gender, 'active')
    RETURNING id INTO v_student_id;
    
    -- Insert enrollment
    INSERT INTO student_enrollments (tenant_id, student_id, school_year_id, class_id)
    VALUES (p_tenant_id, v_student_id, p_school_year_id, p_class_id);
    
    RETURN v_student_id;
END;
$$ LANGUAGE plpgsql;


-- 8. Apply updated_at trigger
CREATE TRIGGER set_student_enrollments_updated_at BEFORE UPDATE ON student_enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. Row Level Security
ALTER TABLE tenant_matricule_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_history ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY['tenant_matricule_counters', 'student_enrollments', 'enrollment_history'];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('CREATE POLICY "Platform Admins can do all on %I" ON %I FOR ALL USING (public.is_platform_admin())', table_name, table_name);
    
    EXECUTE format('CREATE POLICY "Directors can manage %I" ON %I FOR ALL USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = ''director''))', table_name, table_name);
    
    -- Accountants can read
    EXECUTE format('CREATE POLICY "Accountants can view %I" ON %I FOR SELECT USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = ''accountant''))', table_name, table_name);
  END LOOP;
END;
$$;

-- Note for Parents: Parents should be able to view their student_enrollments and enrollment_history.
CREATE POLICY "Parents can view own students enrollments" ON student_enrollments FOR SELECT USING (
  student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
);

CREATE POLICY "Parents can view own students enrollment history" ON enrollment_history FOR SELECT USING (
  enrollment_id IN (
    SELECT id FROM student_enrollments WHERE student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
  )
);
