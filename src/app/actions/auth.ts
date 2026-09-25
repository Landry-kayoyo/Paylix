"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { logAudit } from "@/lib/audit";

/**
 * Called by the update-password page after the user successfully defines
 * their first password (invitation flow) or resets their password.
 *
 * Uses the admin client to bypass RLS — the regular user session does NOT
 * have UPDATE permission on user_memberships (only Directors/Platform Admins
 * can do that via RLS policies).
 */
export async function confirmPasswordChange() {
  // Validate: the user must be authenticated via the regular client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Use the admin client to bypass RLS for profile + membership updates
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      must_change_password: false,
      status: "active",
    })
    .eq("id", user.id);

  if (profileError) {
    throw new Error(`Failed to update profile: ${profileError.message}`);
  }

  // Activate all memberships for this user (covers both accountant and any
  // future multi-tenant scenarios)
  const { error: membershipError } = await supabaseAdmin
    .from("user_memberships")
    .update({ status: "active" })
    .eq("user_id", user.id)
    .eq("status", "invited"); // only update invited ones

  if (membershipError) {
    throw new Error(`Failed to update memberships: ${membershipError.message}`);
  }

  // Parent account activation sync: best-effort — accountants/directors have
  // no parent row so this will simply update 0 rows without error.
  await supabaseAdmin
    .from("parents")
    .update({
      account_status: "active",
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  // LOG AUDIT
  await logAudit({
    userId: user.id,
    actionType: 'USER_UPDATED',
    resourceType: 'user',
    resourceId: user.id,
    reason: 'Account activated / password changed'
  });

  return { success: true };
}
