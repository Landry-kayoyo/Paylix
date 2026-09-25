-- Phase 17: Parent payment history RLS
-- Harden payments and payment_allocations RLS so parents can only see
-- their own children's data (not just any membership in the tenant).

-- ── payments ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Parents can view own students payments" ON payments;
CREATE POLICY "Parents can view own students payments" ON payments
  FOR SELECT USING (
    public.parent_has_active_tenant_membership(tenant_id)
    AND student_id IN (
      SELECT ps.student_id
      FROM parent_students ps
      JOIN parents p ON p.id = ps.parent_id AND p.tenant_id = ps.tenant_id
      WHERE ps.tenant_id = payments.tenant_id
        AND ps.ended_at IS NULL
        AND p.user_id = auth.uid()
    )
  );

-- ── payment_allocations ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Parents can view own students payment allocations" ON payment_allocations;
CREATE POLICY "Parents can view own students payment allocations" ON payment_allocations
  FOR SELECT USING (
    public.parent_has_active_tenant_membership(tenant_id)
    AND payment_id IN (
      SELECT pay.id
      FROM payments pay
      JOIN parent_students ps ON ps.student_id = pay.student_id AND ps.tenant_id = pay.tenant_id
      JOIN parents p ON p.id = ps.parent_id AND p.tenant_id = ps.tenant_id
      WHERE pay.tenant_id = payment_allocations.tenant_id
        AND ps.ended_at IS NULL
        AND p.user_id = auth.uid()
    )
  );

-- ── receipts ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Parents can view own students receipts" ON receipts;
CREATE POLICY "Parents can view own students receipts" ON receipts
  FOR SELECT USING (
    public.parent_has_active_tenant_membership(tenant_id)
    AND payment_id IN (
      SELECT pay.id
      FROM payments pay
      JOIN parent_students ps ON ps.student_id = pay.student_id AND ps.tenant_id = pay.tenant_id
      JOIN parents p ON p.id = ps.parent_id AND p.tenant_id = ps.tenant_id
      WHERE pay.tenant_id = receipts.tenant_id
        AND ps.ended_at IS NULL
        AND p.user_id = auth.uid()
    )
  );

-- ── Ensure parents cannot write payments / allocations / obligations ──────────

-- (No INSERT/UPDATE/DELETE policies for parents on these tables by design.)
-- Confirm no write policies exist for parents on these tables.

-- school_years: parents can read their tenant's school years
-- (already covered by user_memberships policy if it exists; add if missing)
DROP POLICY IF EXISTS "Parents can view school years of their tenant" ON school_years;
CREATE POLICY "Parents can view school years of their tenant" ON school_years
  FOR SELECT USING (
    public.parent_has_active_tenant_membership(tenant_id)
  );

-- ── Performance indexes (add if not already present) ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_payments_tenant_student ON payments(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON payments(tenant_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_tenant_payment ON payment_allocations(tenant_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_financial_obligations_school_year ON financial_obligations(school_year_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_parent_tenant ON parent_students(parent_id, tenant_id) WHERE ended_at IS NULL;
