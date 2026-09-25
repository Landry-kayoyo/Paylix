-- Fix Phase 7 invitation policies to resolve memberships through the
-- SECURITY DEFINER helper instead of querying the RLS-protected table directly.

DROP POLICY IF EXISTS "Directors can insert tenant invitations" ON parent_tenant_invitations;
CREATE POLICY "Directors can insert tenant invitations" ON parent_tenant_invitations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id
      FROM public.get_user_memberships()
      WHERE role IN ('director', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS "Directors can view tenant invitations" ON parent_tenant_invitations;
CREATE POLICY "Directors can view tenant invitations" ON parent_tenant_invitations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.get_user_memberships()
      WHERE role IN ('director', 'platform_admin')
    )
  );