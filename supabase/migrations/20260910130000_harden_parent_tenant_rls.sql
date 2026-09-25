-- Keep parent data scoped to an active parent membership in the same tenant.
-- This prevents a pending cross-tenant invitation from exposing records early.

CREATE OR REPLACE FUNCTION public.parent_has_active_tenant_membership(p_tenant_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_memberships
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND role = 'parent'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql;

DROP POLICY IF EXISTS "Parents can view own record" ON parents;
CREATE POLICY "Parents can view own record" ON parents FOR SELECT USING (
  user_id = auth.uid() AND public.parent_has_active_tenant_membership(tenant_id)
);

DROP POLICY IF EXISTS "Parents can update own record" ON parents;
CREATE POLICY "Parents can update own record" ON parents FOR UPDATE
USING (user_id = auth.uid() AND public.parent_has_active_tenant_membership(tenant_id))
WITH CHECK (user_id = auth.uid() AND public.parent_has_active_tenant_membership(tenant_id));

DROP POLICY IF EXISTS "Parents can view own student mappings" ON parent_students;
CREATE POLICY "Parents can view own student mappings" ON parent_students FOR SELECT USING (
  ended_at IS NULL
  AND public.parent_has_active_tenant_membership(tenant_id)
  AND EXISTS (
    SELECT 1 FROM parents p
    WHERE p.id = parent_students.parent_id
      AND p.user_id = auth.uid()
      AND p.tenant_id = parent_students.tenant_id
  )
);

DROP POLICY IF EXISTS "Parents can view own students" ON students;
CREATE POLICY "Parents can view own students" ON students FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM parent_students ps
    JOIN parents p ON p.id = ps.parent_id AND p.tenant_id = ps.tenant_id
    WHERE ps.student_id = students.id
      AND ps.tenant_id = students.tenant_id
      AND ps.ended_at IS NULL
      AND p.user_id = auth.uid()
      AND public.parent_has_active_tenant_membership(ps.tenant_id)
  )
);

DROP POLICY IF EXISTS "Parents can view own students enrollments" ON student_enrollments;
CREATE POLICY "Parents can view own students enrollments" ON student_enrollments FOR SELECT USING (
  public.parent_has_active_tenant_membership(tenant_id)
  AND EXISTS (
    SELECT 1
    FROM parent_students ps
    JOIN parents p ON p.id = ps.parent_id AND p.tenant_id = ps.tenant_id
    WHERE ps.student_id = student_enrollments.student_id
      AND ps.tenant_id = student_enrollments.tenant_id
      AND ps.ended_at IS NULL
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Parents can view own students enrollment history" ON enrollment_history;
CREATE POLICY "Parents can view own students enrollment history" ON enrollment_history FOR SELECT USING (
  public.parent_has_active_tenant_membership(tenant_id)
  AND EXISTS (
    SELECT 1
    FROM student_enrollments se
    JOIN parent_students ps
      ON ps.student_id = se.student_id AND ps.tenant_id = se.tenant_id
    JOIN parents p
      ON p.id = ps.parent_id AND p.tenant_id = ps.tenant_id
    WHERE se.id = enrollment_history.enrollment_id
      AND ps.ended_at IS NULL
      AND p.user_id = auth.uid()
  )
);