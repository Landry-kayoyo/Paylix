"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountantStatus = "invited" | "active" | "inactive";

export interface AccountantItem {
  id: string;
  tenant_id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  employee_code: string;
  status: AccountantStatus;
  created_at: string;
}

const CreateAccountantSchema = z.object({
  full_name: z.string().min(2, "Le nom complet doit comporter au moins 2 caractères"),
  phone: z.string().min(6, "Le numéro de téléphone doit être valide"),
  email: z.string().email("Adresse email invalide"),
});

// ─── Helper: Auth Check Director ──────────────────────────────────────────────

async function getDirectorTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Non authentifié");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id, role, tenants(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["director", "platform_admin"])
    .single();

  if (!membership?.tenant_id) {
    throw new Error("Accès refusé. Rôle Directeur requis.");
  }

  const tenantName = (membership.tenants as any)?.name || "Votre établissement";

  return {
    supabase,
    user,
    tenantId: membership.tenant_id,
    tenantName,
    role: membership.role,
  };
}

// ─── List Accountants ─────────────────────────────────────────────────────────

export async function getAccountantsData(
  page = 1,
  pageSize = 25,
  filters?: {
    search?: string;
    status?: string;
  }
) {
  const { supabase, tenantId } = await getDirectorTenant();
  const offset = (page - 1) * pageSize;

  // Récupérer les memberships de rôle 'accountant' pour ce tenant
  let query = supabase
    .from("user_memberships")
    .select(
      `
      user_id,
      status,
      created_at,
      profiles:user_id (
        id,
        first_name,
        last_name,
        phone,
        status
      )
    `,
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .eq("role", "accountant")
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data: memberships, count, error } = await query;

  if (error) {
    console.error("Erreur lors de la récupération des comptables:", error);
    return { data: [], total: 0, page, pageSize };
  }

  // Récupérer les détails Auth (email) et de la table accountants
  const userIds = (memberships || []).map((m) => m.user_id);
  
  let accountantsMap = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: accData } = await supabase
      .from("accountants")
      .select("id, user_id, employee_code, phone")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds);

    (accData || []).forEach((acc) => {
      accountantsMap.set(acc.user_id, acc);
    });
  }

  // Récupérer les emails depuis auth.users via admin client
  let authUsersMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    (authUsers?.users || []).forEach((u) => {
      if (userIds.includes(u.id) && u.email) {
        authUsersMap.set(u.id, u.email);
      }
    });
  }

  const items: AccountantItem[] = (memberships || []).map((m: any) => {
    const profile = m.profiles;
    const acc = accountantsMap.get(m.user_id);
    const email = authUsersMap.get(m.user_id) || "";
    const fullName = profile
      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Comptable"
      : "Comptable";
    const phone = profile?.phone || acc?.phone || null;
    const code = acc?.employee_code || "CPT-000";

    return {
      id: acc?.id || m.user_id,
      tenant_id: tenantId,
      user_id: m.user_id,
      full_name: fullName,
      phone,
      email,
      employee_code: code,
      status: (m.status as AccountantStatus) || "invited",
      created_at: m.created_at,
    };
  });

  // Filtrage par recherche
  let filteredItems = items;
  if (filters?.search && filters.search.trim() !== "") {
    const q = filters.search.toLowerCase().trim();
    filteredItems = items.filter(
      (item) =>
        item.full_name.toLowerCase().includes(q) ||
        (item.email && item.email.toLowerCase().includes(q)) ||
        (item.phone && item.phone.toLowerCase().includes(q)) ||
        item.employee_code.toLowerCase().includes(q)
    );
  }

  return {
    data: filteredItems,
    total: count || filteredItems.length,
    page,
    pageSize,
  };
}

// ─── Create Accountant ────────────────────────────────────────────────────────

export async function createAccountant(rawData: z.infer<typeof CreateAccountantSchema>) {
  const validated = CreateAccountantSchema.parse(rawData);
  const { tenantId, tenantName, user } = await getDirectorTenant();

  const emailClean = validated.email.toLowerCase().trim();

  // 1. Vérifier si un utilisateur existe déjà avec cet email dans auth.users
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingAuthUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === emailClean
  );

  if (existingAuthUser) {
    // Vérifier s'il est déjà membre de ce tenant
    const { data: existingMembership } = await supabaseAdmin
      .from("user_memberships")
      .select("role")
      .eq("user_id", existingAuthUser.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existingMembership) {
      return {
        success: false,
        error: "Un utilisateur avec cet email appartient déjà à cet établissement.",
      };
    }
  }

  // 2. Extraire Prénom / Nom
  const nameParts = validated.full_name.trim().split(" ");
  const firstName = nameParts[0] || "Comptable";
  const lastName = nameParts.slice(1).join(" ") || " ";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // 3. Inviter l'utilisateur via Supabase Auth Admin
  let authUserId: string;

  if (!existingAuthUser) {
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(emailClean, {
        redirectTo: `${siteUrl}/auth/callback?next=/accountant`,
        data: {
          invited_as: "accountant",
          tenant_id: tenantId,
          tenant_name: tenantName,
        },
      });

    if (inviteError || !inviteData?.user) {
      console.error("Erreur invitation auth comptable:", inviteError);
      return {
        success: false,
        error: `Impossible d'envoyer l'invitation : ${inviteError?.message || "Erreur inconnue"}`,
      };
    }

    authUserId = inviteData.user.id;
  } else {
    authUserId = existingAuthUser.id;
  }

  // 4. Créer / Mettre à jour le Profil
  await supabaseAdmin.from("profiles").upsert({
    id: authUserId,
    first_name: firstName,
    last_name: lastName,
    phone: validated.phone,
    status: "invited",
    must_change_password: true,
  });

  // 5. Créer le Membership avec rôle 'accountant'
  const { error: memberError } = await supabaseAdmin.from("user_memberships").upsert(
    {
      user_id: authUserId,
      tenant_id: tenantId,
      role: "accountant",
      status: "invited",
    },
    { onConflict: "user_id,tenant_id,role" }
  );

  if (memberError) {
    return {
      success: false,
      error: `Erreur lors de l'attribution des droits : ${memberError.message}`,
    };
  }

  // 6. Générer le code employé et insérer dans la table accountants
  const { data: existingAccs } = await supabaseAdmin
    .from("accountants")
    .select("id")
    .eq("tenant_id", tenantId);

  const seq = (existingAccs?.length || 0) + 1;
  const employeeCode = `CPT-${String(seq).padStart(3, "0")}`;

  await supabaseAdmin.from("accountants").upsert(
    {
      tenant_id: tenantId,
      user_id: authUserId,
      employee_code: employeeCode,
      phone: validated.phone,
    },
    { onConflict: "tenant_id,user_id" }
  );

  // 7. Log d'audit
  await supabaseAdmin.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "CREATE_ACCOUNTANT",
    resource_type: "accountant",
    resource_id: authUserId,
    result: "success",
    metadata: {
      accountant_name: validated.full_name,
      email: emailClean,
    },
  });

  revalidatePath("/school/users");

  return {
    success: true,
    accountant: {
      full_name: validated.full_name,
      email: emailClean,
      phone: validated.phone,
      role: "Comptable",
      school_name: tenantName,
      status: "Invitation envoyée",
    },
  };
}

// ─── Resend Invitation ────────────────────────────────────────────────────────

export async function resendAccountantInvitation(userId: string) {
  const { tenantId, tenantName } = await getDirectorTenant();

  // Vérifier la membership
  const { data: membership } = await supabaseAdmin
    .from("user_memberships")
    .select("status, role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("role", "accountant")
    .single();

  if (!membership) {
    return { success: false, error: "Comptable introuvable dans cet établissement." };
  }

  if (membership.status === "active") {
    return {
      success: false,
      error: "Ce compte est déjà actif. Le renvoi d'invitation n'est possible que pour un compte INVITÉ.",
    };
  }

  // Récupérer l'email de l'utilisateur
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!authUser?.user?.email) {
    return { success: false, error: "Adresse email introuvable pour cet utilisateur." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    authUser.user.email,
    {
      redirectTo: `${siteUrl}/auth/callback?next=/accountant`,
      data: {
        invited_as: "accountant",
        tenant_id: tenantId,
        tenant_name: tenantName,
      },
    }
  );

  if (inviteError) {
    return { success: false, error: `Erreur renvoi invitation: ${inviteError.message}` };
  }

  revalidatePath("/school/users");
  return { success: true };
}

// ─── Toggle Accountant Status (Activate / Deactivate) ─────────────────────────

export async function toggleAccountantStatus(userId: string, newStatus: "active" | "inactive") {
  const { tenantId, user } = await getDirectorTenant();

  if (userId === user.id) {
    return { success: false, error: "Vous ne pouvez pas modifier votre propre statut." };
  }

  // Mettre à jour user_memberships
  const { error: memberError } = await supabaseAdmin
    .from("user_memberships")
    .update({ status: newStatus })
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("role", "accountant");

  if (memberError) {
    return { success: false, error: `Erreur lors du changement de statut : ${memberError.message}` };
  }

  // Mettre à jour le profil
  await supabaseAdmin
    .from("profiles")
    .update({ status: newStatus })
    .eq("id", userId);

  // Audit log
  await supabaseAdmin.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: newStatus === "inactive" ? "DEACTIVATE_ACCOUNTANT" : "REACTIVATE_ACCOUNTANT",
    resource_type: "accountant",
    resource_id: userId,
    result: "success",
  });

  revalidatePath("/school/users");
  return { success: true };
}
