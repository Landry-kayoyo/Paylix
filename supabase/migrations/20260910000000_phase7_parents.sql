-- Migration Phase 7: Parents / Tuteurs — comptes, invitations, associations

-- 0. Table for cross-tenant invitations (parent with existing account accepting a new establishment)
-- When a parent's email already exists in auth.users (they have an account in another tenant),
-- we do NOT automatically grant them access. Instead, we create a pending invitation that the
-- parent must explicitly accept. This preserves security and tenant isolation.
CREATE TABLE IF NOT EXISTS parent_tenant_invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id       UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    auth_user_id    UUID NOT NULL, -- references auth.users (existing user)
    token           TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    invited_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    responded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for token lookup (used in accept/decline flow)
CREATE INDEX IF NOT EXISTS idx_parent_tenant_invitations_token ON parent_tenant_invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_parent_tenant_invitations_user ON parent_tenant_invitations(auth_user_id, status);
CREATE INDEX IF NOT EXISTS idx_parent_tenant_invitations_tenant ON parent_tenant_invitations(tenant_id, status);

-- RLS for parent_tenant_invitations
ALTER TABLE parent_tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Directors can create invitations for their tenant
CREATE POLICY "Directors can insert tenant invitations" ON parent_tenant_invitations
    FOR INSERT WITH CHECK (
        tenant_id IN (
      SELECT tenant_id FROM public.get_user_memberships()
      WHERE role IN ('director', 'platform_admin')
        )
    );

-- Directors can view invitations for their tenant
CREATE POLICY "Directors can view tenant invitations" ON parent_tenant_invitations
    FOR SELECT USING (
        tenant_id IN (
      SELECT tenant_id FROM public.get_user_memberships()
      WHERE role IN ('director', 'platform_admin')
        )
    );

-- The invited user can see their own invitation (to accept/decline)
CREATE POLICY "Users can view their own invitations" ON parent_tenant_invitations
    FOR SELECT USING (auth_user_id = auth.uid());

-- The invited user can update their own invitation (accept/decline)
CREATE POLICY "Users can respond to their own invitations" ON parent_tenant_invitations
    FOR UPDATE USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());


-- 1. Enhance parents table
ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'invited'
    CHECK (account_status IN ('invited', 'active', 'inactive')),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Note: phone uniqueness is per-tenant (not global). Enforce via application logic + partial index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_parents_phone_per_tenant
  ON parents(tenant_id, phone)
  WHERE phone IS NOT NULL AND phone != '';

-- 2. Enhance parent_students for soft-delete + 1-parent-per-student constraint
ALTER TABLE parent_students
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- THE CRITICAL CONSTRAINT: 1 active parent per student (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_students_one_active_per_student
  ON parent_students(student_id)
  WHERE ended_at IS NULL;

-- 3. Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_parents_tenant_status ON parents(tenant_id, account_status);
CREATE INDEX IF NOT EXISTS idx_parents_tenant_email ON parents(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_parent_students_active ON parent_students(tenant_id, student_id)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_parent_students_parent_active ON parent_students(parent_id)
  WHERE ended_at IS NULL;

-- 4. Apply updated_at trigger to parents (already exists from initial migration, just ensuring)
-- The trigger set_parents_updated_at is already defined in the initial schema.

-- 5. RLS — Update existing parent policies to respect ended_at

-- Parents see only ACTIVE associations (not soft-deleted)
DROP POLICY IF EXISTS "Parents can view own student mappings" ON parent_students;
CREATE POLICY "Parents can view own student mappings" ON parent_students
  FOR SELECT USING (
    parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
    AND ended_at IS NULL
  );

-- Parents see only students from ACTIVE associations
DROP POLICY IF EXISTS "Parents can view own students" ON students;
CREATE POLICY "Parents can view own students" ON students
  FOR SELECT USING (
    id IN (
      SELECT student_id FROM parent_students
      WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
      AND ended_at IS NULL
    )
  );

-- Directors can also view ended associations (for audit/history)
-- (already covered by the "Directors can manage parent_students" policy from Phase 2)

-- 6. DB function: associate_student_to_parent (transactional, safe)
-- Called from server actions via supabase.rpc()
CREATE OR REPLACE FUNCTION associate_student_to_parent(
  p_tenant_id UUID,
  p_parent_id UUID,
  p_student_id UUID,
  p_relationship TEXT
) RETURNS VOID AS $$
BEGIN
  -- Verify student belongs to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'STUDENT_NOT_FOUND';
  END IF;

  -- Verify parent belongs to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM parents
    WHERE id = p_parent_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'PARENT_NOT_FOUND';
  END IF;

  -- Check if another (different) parent has an active association with this student
  IF EXISTS (
    SELECT 1 FROM parent_students
    WHERE student_id = p_student_id
      AND ended_at IS NULL
      AND parent_id != p_parent_id
  ) THEN
    RAISE EXCEPTION 'STUDENT_ALREADY_HAS_PARENT';
  END IF;

  -- Upsert: if association was soft-deleted (ended_at IS NOT NULL), reactivate it
  INSERT INTO parent_students (tenant_id, parent_id, student_id, relationship, ended_at, ended_by)
  VALUES (p_tenant_id, p_parent_id, p_student_id, p_relationship, NULL, NULL)
  ON CONFLICT (parent_id, student_id)
  DO UPDATE SET
    ended_at = NULL,
    ended_by = NULL,
    relationship = EXCLUDED.relationship;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. DB function: remove_student_association (soft-delete)
CREATE OR REPLACE FUNCTION remove_student_association(
  p_tenant_id UUID,
  p_parent_student_id UUID,
  p_actor_user_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE parent_students
  SET ended_at = NOW(), ended_by = p_actor_user_id
  WHERE id = p_parent_student_id
    AND tenant_id = p_tenant_id
    AND ended_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSOCIATION_NOT_FOUND';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Seed: update existing parent test record to have proper account_status
UPDATE parents
SET account_status = 'active', activated_at = NOW()
WHERE id = 'bbbbbbbb-1111-1111-1111-111111111111';
