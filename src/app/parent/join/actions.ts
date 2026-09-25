"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CrossTenantInvitation {
  id: string;
  token: string;
  tenant_id: string;
  parent_id: string;
  auth_user_id: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at: string;
  created_at: string;
  tenant: {
    id: string;
    name: string;
    city: string | null;
    logo_url: string | null;
  };
  parent: {
    full_name: string;
    email: string | null;
  };
  invited_by_name: string | null;
}

// ─── Get invitation by token (public — no auth required to view) ──────────────

export async function getInvitationByToken(
  token: string
): Promise<{ invitation: CrossTenantInvitation | null; error?: string }> {
  // The token is the capability used to view a pending invitation. Use the
  // server-only client here because the visitor is intentionally unauthenticated.
  const { data, error } = await supabaseAdmin
    .from("parent_tenant_invitations")
    .select(
      `
      id, token, tenant_id, parent_id, auth_user_id, status, expires_at, created_at,
      tenants (id, name, city, logo_url),
      parents (full_name, email),
      profiles!parent_tenant_invitations_invited_by_fkey (first_name, last_name)
    `
    )
    .eq("token", token)
    .single();

  if (error || !data) {
    return { invitation: null, error: "Invitation introuvable ou expirée." };
  }

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    // Mark as expired
    await supabaseAdmin
      .from("parent_tenant_invitations")
      .update({ status: "expired" })
      .eq("id", data.id);
    return { invitation: null, error: "Cette invitation a expiré. Demandez au directeur de vous en envoyer une nouvelle." };
  }

  if (data.status !== "pending") {
    const statusMsg =
      data.status === "accepted"
        ? "Vous avez déjà accepté cette invitation."
        : data.status === "declined"
        ? "Vous avez décliné cette invitation."
        : "Cette invitation est expirée.";
    return { invitation: null, error: statusMsg };
  }

  const invitedByProfile = (data as any).profiles;
  const invitedByName = invitedByProfile
    ? `${invitedByProfile.first_name} ${invitedByProfile.last_name}`
    : null;

  return {
    invitation: {
      id: data.id,
      token: data.token,
      tenant_id: data.tenant_id,
      parent_id: data.parent_id,
      auth_user_id: data.auth_user_id,
      status: data.status as CrossTenantInvitation["status"],
      expires_at: data.expires_at,
      created_at: data.created_at,
      tenant: (data as any).tenants,
      parent: (data as any).parents,
      invited_by_name: invitedByName,
    },
  };
}

// ─── Accept invitation ────────────────────────────────────────────────────────

export async function acceptCrossTenantInvitation(
  invitationId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Verify the current user is the correct one
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Vous devez être connecté pour accepter cette invitation." };

  const { data: invitation, error: fetchError } = await supabase
    .from("parent_tenant_invitations")
    .select("id, auth_user_id, tenant_id, parent_id, status, expires_at")
    .eq("id", invitationId)
    .eq("token", token)
    .single();

  if (fetchError || !invitation) return { success: false, error: "Invitation introuvable." };
  if (invitation.auth_user_id !== user.id) {
    return { success: false, error: "Cette invitation ne vous est pas destinée." };
  }
  if (invitation.status !== "pending") {
    return { success: false, error: "Cette invitation a déjà été traitée." };
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return { success: false, error: "Cette invitation a expiré." };
  }

  // Activate the membership
  const { error: membershipError } = await supabaseAdmin.from("user_memberships").upsert(
    {
      user_id: user.id,
      tenant_id: invitation.tenant_id,
      role: "parent",
      status: "active",
    },
    { onConflict: "user_id,tenant_id,role" }
  );

  if (membershipError) {
    return { success: false, error: `Erreur activation : ${membershipError.message}` };
  }

  // Update parent account_status to active
  await supabaseAdmin
    .from("parents")
    .update({
      account_status: "active",
      activated_at: new Date().toISOString(),
    })
    .eq("id", invitation.parent_id)
    .eq("tenant_id", invitation.tenant_id);

  // Mark invitation as accepted
  await supabase
    .from("parent_tenant_invitations")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", invitationId);

  // Audit log
  await supabase.from("audit_logs").insert({
    tenant_id: invitation.tenant_id,
    actor_user_id: user.id,
    action: "ACCEPT_CROSS_TENANT_INVITATION",
    resource_type: "parent_tenant_invitation",
    resource_id: invitationId,
    result: "success",
    metadata: { flow: "cross_tenant_consent" },
  });

  return { success: true };
}

// ─── Decline invitation ───────────────────────────────────────────────────────

export async function declineCrossTenantInvitation(
  invitationId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Vous devez être connecté." };

  const { data: invitation } = await supabase
    .from("parent_tenant_invitations")
    .select("id, auth_user_id, tenant_id, parent_id, status")
    .eq("id", invitationId)
    .eq("token", token)
    .single();

  if (!invitation) return { success: false, error: "Invitation introuvable." };
  if (invitation.auth_user_id !== user.id) {
    return { success: false, error: "Cette invitation ne vous est pas destinée." };
  }
  if (invitation.status !== "pending") {
    return { success: false, error: "Cette invitation a déjà été traitée." };
  }

  await supabase
    .from("parent_tenant_invitations")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", invitationId);

  // Keep parent record but set back to inactive
  await supabaseAdmin
    .from("parents")
    .update({ account_status: "inactive" })
    .eq("id", invitation.parent_id)
    .eq("tenant_id", invitation.tenant_id);

  await supabase.from("audit_logs").insert({
    tenant_id: invitation.tenant_id,
    actor_user_id: user.id,
    action: "DECLINE_CROSS_TENANT_INVITATION",
    resource_type: "parent_tenant_invitation",
    resource_id: invitationId,
    result: "success",
  });

  return { success: true };
}
