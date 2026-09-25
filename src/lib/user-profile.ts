export type UserMembershipLike = {
  role?: string | null;
  tenant_id?: string | null;
};

export function pickPrimaryMembership<T extends UserMembershipLike>(memberships: T[] | null | undefined): T | null {
  if (!memberships || memberships.length === 0) {
    return null;
  }

  const platformAdmin = memberships.find(m => m.role === "platform_admin");
  if (platformAdmin) {
    return platformAdmin;
  }

  return memberships[0] ?? null;
}

export function getUserInitials(profile: { firstName?: string | null; lastName?: string | null } | null) {
  const firstName = profile?.firstName?.trim() || "";
  const lastName = profile?.lastName?.trim() || "";

  const initials = `${firstName.charAt(0) || ""}${lastName.charAt(0) || ""}`.toUpperCase();
  return initials || "U";
}
