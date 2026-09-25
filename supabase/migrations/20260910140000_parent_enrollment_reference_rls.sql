-- Allow parents to resolve the class and school year labels for their own
-- active student associations without exposing unrelated tenant data.

CREATE POLICY "Parents can view own classes" ON classes FOR SELECT USING (
  public.parent_has_active_tenant_membership(tenant_id)
  AND EXISTS (
    SELECT 1
    FROM student_enrollments se
    JOIN parent_students ps
      ON ps.student_id = se.student_id AND ps.tenant_id = se.tenant_id
    JOIN parents p
      ON p.id = ps.parent_id AND p.tenant_id = ps.tenant_id
    WHERE se.class_id = classes.id
      AND se.tenant_id = classes.tenant_id
      AND ps.ended_at IS NULL
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can view own school years" ON school_years FOR SELECT USING (
  public.parent_has_active_tenant_membership(tenant_id)
  AND EXISTS (
    SELECT 1
    FROM student_enrollments se
    JOIN parent_students ps
      ON ps.student_id = se.student_id AND ps.tenant_id = se.tenant_id
    JOIN parents p
      ON p.id = ps.parent_id AND p.tenant_id = ps.tenant_id
    WHERE se.school_year_id = school_years.id
      AND se.tenant_id = school_years.tenant_id
      AND ps.ended_at IS NULL
      AND p.user_id = auth.uid()
  )
);