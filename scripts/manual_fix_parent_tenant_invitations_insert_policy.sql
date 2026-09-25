DROP POLICY IF EXISTS "Directors can insert tenant invitations" ON parent_tenant_invitations;

CREATE POLICY "Directors can insert tenant invitations"
ON parent_tenant_invitations
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id
    FROM public.get_user_memberships()
    WHERE role IN ('director', 'platform_admin')
  )
);
