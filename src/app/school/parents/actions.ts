"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatStudentResults } from "./student-search-utils";
import { validatePhoneNumber } from "./phone-utils";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParentAccountStatus = "invited" | "active" | "inactive";

export interface ParentItem {
  id: string;
  tenant_id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  account_status: ParentAccountStatus;
  invited_at: string | null;
  activated_at: string | null;
  last_invitation_sent_at: string | null;
  created_at: string;
  updated_at: string;
  children_count?: number;
}

export interface ParentStudentLink {
  id: string;
  student_id: string;
  relationship: string | null;
  created_at: string;
  student: {
    id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    post_name: string | null;
    status: string;
    current_class?: string | null;
    current_year?: string | null;
  };
}

export interface StudentSearchResult {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  post_name: string | null;
  current_class: string | null;
  current_year: string | null;
  has_active_parent: boolean;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function getDirectorTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["director", "platform_admin"])
    .single();

  if (!membership?.tenant_id) {
    throw new Error("Accès refusé. Rôle directeur requis.");
  }

  return { supabase, user, tenantId: membership.tenant_id, role: membership.role };
}

// ─── List Parents ─────────────────────────────────────────────────────────────

export async function getParentsData(
  page = 1,
  pageSize = 25,
  filters?: {
    search?: string;
    status?: string;
    hasChildren?: boolean;
  }
) {
  const { supabase, tenantId } = await getDirectorTenant();
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("parents")
    .select(
      `
      id, tenant_id, user_id, full_name,
      phone, email, address, account_status,
      invited_at, activated_at, last_invitation_sent_at,
      created_at, updated_at,
      parent_students!left(id, ended_at)
    `,
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .order("full_name", { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (filters?.status && filters.status !== "all") {
    query = query.eq("account_status", filters.status);
  }

  if (filters?.search) {
    const s = filters.search;
    query = query.or(
      `full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Erreur chargement parents: ${error.message}`);

  const parents: (ParentItem & { children_count: number })[] = (data || []).map((p: any) => {
    const activeLinks = (p.parent_students || []).filter((ps: any) => !ps.ended_at);
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      email: p.email,
      address: p.address,
      account_status: p.account_status as ParentAccountStatus,
      invited_at: p.invited_at,
      activated_at: p.activated_at,
      last_invitation_sent_at: p.last_invitation_sent_at,
      created_at: p.created_at,
      updated_at: p.updated_at,
      children_count: activeLinks.length,
    };
  });

  if (filters?.hasChildren === true) {
    return {
      parents: parents.filter((p) => p.children_count > 0),
      total: count || 0,
      page,
      pageSize,
    };
  }

  if (filters?.hasChildren === false) {
    return {
      parents: parents.filter((p) => p.children_count === 0),
      total: count || 0,
      page,
      pageSize,
    };
  }

  return {
    parents,
    total: count || 0,
    page,
    pageSize,
  };
}

// ─── Get Parent by ID ─────────────────────────────────────────────────────────

export async function getParentById(parentId: string) {
  const { supabase, tenantId } = await getDirectorTenant();

  const { data: parent, error } = await supabase
    .from("parents")
    .select(
      `
      id, tenant_id, user_id, full_name,
      phone, email, address, account_status,
      invited_at, activated_at, last_invitation_sent_at,
      created_at, updated_at
    `
    )
    .eq("id", parentId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) throw new Error(error.message);
  if (!parent) throw new Error("Parent non trouvé");

  // Fetch active children associations
  const { data: links, error: linksError } = await supabase
    .from("parent_students")
    .select(
      `
      id, student_id, relationship, created_at,
      students (
        id, matricule, first_name, last_name, post_name, status,
        student_enrollments (
          id, class_id, school_year_id, status,
          classes (name),
          school_years (name)
        )
      )
    `
    )
    .eq("parent_id", parentId)
    .eq("tenant_id", tenantId)
    .is("ended_at", null)
    .order("created_at", { ascending: true });

  if (linksError) throw new Error(linksError.message);

  const children: ParentStudentLink[] = (links || []).map((link: any) => {
    const student = link.students;
    const enrollments = student?.student_enrollments || [];
    const latestEnrollment = enrollments[enrollments.length - 1] || null;

    return {
      id: link.id,
      student_id: link.student_id,
      relationship: link.relationship,
      created_at: link.created_at,
      student: {
        id: student.id,
        matricule: student.matricule,
        first_name: student.first_name,
        last_name: student.last_name,
        post_name: student.post_name,
        status: student.status,
        current_class: latestEnrollment?.classes?.name || null,
        current_year: latestEnrollment?.school_years?.name || null,
      },
    };
  });

  return { parent: parent as ParentItem, children };
}

// ─── Search Available Students ────────────────────────────────────────────────

export async function searchAvailableStudents(
  search: string,
  parentId?: string,
  limit = 20
): Promise<StudentSearchResult[]> {
  const { supabase, tenantId } = await getDirectorTenant();

  if (!search || search.trim().length < 1) {
    // Return first N students (sorted) when no search
    const { data, error } = await supabase
      .from("students")
      .select(
        `
        id, matricule, first_name, last_name, post_name, status,
        student_enrollments (
          id, class_id, school_year_id, status,
          classes (name),
          school_years (name)
        ),
        parent_students!left(id, ended_at, parent_id)
      `
      )
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("last_name", { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);
    return formatStudentResults(data || [], parentId);
  }

  const s = search.trim();
  const { data, error } = await supabase
    .from("students")
    .select(
      `
      id, matricule, first_name, last_name, post_name, status,
      student_enrollments (
        id, class_id, school_year_id, status,
        classes (name),
        school_years (name)
      ),
      parent_students!left(id, ended_at, parent_id)
    `
    )
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .or(`last_name.ilike.%${s}%,first_name.ilike.%${s}%,post_name.ilike.%${s}%,matricule.ilike.%${s}%`)
    .order("last_name", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return formatStudentResults(data || [], parentId);
}

// ─── Create Parent ────────────────────────────────────────────────────────────

const createParentSchema = z.object({
  full_name: z.string().min(1, "Le nom complet est requis"),
  phone: z.string().min(1, "Le téléphone est requis").refine(validatePhoneNumber, "Le numéro est invalide pour le pays sélectionné."),
  email: z.string().email("Email invalide"),
  address: z.string().optional().nullable(),
  children: z
    .array(
      z.object({
        student_id: z.string().uuid(),
        relationship: z.string().min(1),
      })
    )
    .optional()
    .default([]),
});

export async function createParent(input: z.infer<typeof createParentSchema>) {
  const { supabase, tenantId, user } = await getDirectorTenant();

  // Safe parse — never expose raw Zod JSON to the client
  const parsed = createParentSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    const path = firstError?.path?.join(" → ") ?? "";
    const friendly =
      firstError?.path?.[0] === "children"
        ? "Un élève sélectionné est invalide. Veuillez le retirer et le choisir à nouveau."
        : firstError?.path?.[0] === "email"
        ? "L'adresse email est invalide."
        : `Champ invalide${path ? " (" + path + ")" : ""} : ${firstError?.message ?? "Données invalides."}`;
    return { success: false, error: friendly };
  }
  const validated = parsed.data;
  const nameParts = validated.full_name.trim().split(/\s+/);
  const profileFirstName = nameParts[0];
  const profileLastName = nameParts.slice(1).join(" ") || nameParts[0];

  // Get tenant name for notifications
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();
  const tenantName = tenantData?.name || "l'établissement";

  // Check phone uniqueness within tenant
  const { data: existingPhone } = await supabase
    .from("parents")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone", validated.phone)
    .maybeSingle();

  if (existingPhone) {
    return {
      success: false,
      error: "Ce numéro de téléphone est déjà utilisé par un autre parent dans cet établissement.",
    };
  }

  // ── Check if email already exists in auth.users ──────────────────────────────
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingAuthUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === validated.email.toLowerCase()
  );

  // ── CASE A: New email — standard invitation flow ─────────────────────────────
  if (!existingAuthUser) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(validated.email, {
        redirectTo: `${siteUrl}/auth/callback?next=/parent`,
        data: {
          invited_as: "parent",
          tenant_id: tenantId,
          tenant_name: tenantName,
        },
      });

    if (inviteError || !inviteData?.user) {
      return { success: false, error: `Erreur d'invitation : ${inviteError?.message}` };
    }

    const authUserId = inviteData.user.id;

    // Create profile
    await supabaseAdmin.from("profiles").upsert({
      id: authUserId,
      first_name: profileFirstName,
      last_name: profileLastName,
      must_change_password: false,
      status: "invited",
    });

    // Add membership
    const { error: membershipError } = await supabaseAdmin.from("user_memberships").upsert(
      { user_id: authUserId, tenant_id: tenantId, role: "parent", status: "active" },
      { onConflict: "user_id,tenant_id,role" }
    );
    if (membershipError) {
      return { success: false, error: `Erreur membership : ${membershipError.message}` };
    }

    // Create parent record
    const { data: newParent, error: parentError } = await supabase
      .from("parents")
      .insert({
        tenant_id: tenantId,
        user_id: authUserId,
        full_name: validated.full_name,
        phone: validated.phone,
        email: validated.email,
        address: validated.address || null,
        account_status: "invited",
        invited_at: new Date().toISOString(),
        last_invitation_sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (parentError || !newParent) {
      return { success: false, error: `Erreur création parent : ${parentError?.message}` };
    }

    // Associate children
    const failedAssociations: string[] = [];
    for (const child of validated.children) {
      const { error } = await supabase.rpc("associate_student_to_parent", {
        p_tenant_id: tenantId,
        p_parent_id: newParent.id,
        p_student_id: child.student_id,
        p_relationship: child.relationship,
      });
      if (error) failedAssociations.push(child.student_id);
    }

    await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: "CREATE_PARENT",
      resource_type: "parent",
      resource_id: newParent.id,
      result: "success",
      metadata: {
        parent_name: validated.full_name,
        flow: "new_user_invited",
        children_associated: validated.children.length - failedAssociations.length,
      },
    });

    revalidatePath("/school/parents");
    return {
      success: true,
      parentId: newParent.id,
      flow: "new_invitation" as const,
    };
  }

  // ── CASE B: Email already exists — cross-tenant consent flow ─────────────────
  //
  // SECURITY RULE: We NEVER grant access to a new tenant without the parent's
  // explicit consent. The parent must click a personalized link in their email
  // to authorize the association. This preserves tenant isolation.
  //
  const authUserId = existingAuthUser.id;

  // Find which tenants this user already has access to
  const { data: existingMemberships } = await supabaseAdmin
    .from("user_memberships")
    .select("tenant_id, role, tenants(name)")
    .eq("user_id", authUserId);

  // SECURITY CHECK: Ensure the existing user does not have a non-parent role
  const hasNonParentRole = (existingMemberships || []).some(
    (m: any) => m.role !== "parent"
  );
  if (hasNonParentRole) {
    return {
      success: false,
      error: "Impossible d'ajouter ce parent. Cette adresse email est déjà associée à un compte Paylix disposant d'un autre rôle. Pour des raisons de sécurité, ce compte ne peut pas être utilisé comme compte Parent.",
    };
  }

  const existingTenants = (existingMemberships || []).map((m: any) => m.tenants?.name || "Établissement");

  // Check not already a parent in THIS tenant
  const { data: existingParent } = await supabase
    .from("parents")
    .select("id, account_status")
    .eq("tenant_id", tenantId)
    .eq("user_id", authUserId)
    .maybeSingle();

  if (existingParent) {
    if (existingParent.account_status === "invited") {
      return {
        success: false,
        error: `Ce parent (${validated.email}) a déjà été invité dans cet établissement mais n'a pas encore accepté l'invitation.`,
      };
    }
    return {
      success: false,
      error: `Ce parent (${validated.email}) a déjà un compte actif dans cet établissement.`,
    };
  }

  // Create parent record with status "invited" — membership NOT yet granted
  const { data: newParent, error: parentError } = await supabase
    .from("parents")
    .insert({
      tenant_id: tenantId,
      user_id: authUserId,
      full_name: validated.full_name,
      phone: validated.phone,
      email: validated.email,
      address: validated.address || null,
      account_status: "invited",
      invited_at: new Date().toISOString(),
      last_invitation_sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (parentError || !newParent) {
    return { success: false, error: `Erreur création parent : ${parentError?.message}` };
  }

  // Create a pending cross-tenant invitation with a secure token
  const { data: invitation, error: invitError } = await supabase
    .from("parent_tenant_invitations")
    .insert({
      tenant_id: tenantId,
      parent_id: newParent.id,
      auth_user_id: authUserId,
      invited_by: user.id,
    })
    .select("id, token")
    .single();

  if (invitError || !invitation) {
    return { success: false, error: `Erreur création invitation : ${invitError?.message}` };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const consentUrl = new URL("/auth/callback", siteUrl);
  consentUrl.searchParams.set("next", `/parent/join?token=${invitation.token}`);
  const consentLink = consentUrl.toString();

  // ── Send automatic notification email to the existing user ───────────────────
  //
  // Strategy: Use GoTrue's /auth/v1/otp endpoint with create_user=false.
  // This sends a magic link email via the configured SMTP (Mailpit locally,
  // production SMTP when deployed). The magic link logs the user in and
  // redirects to the consent page.
  //
  // Why this works: the existing user already has an Auth account, so GoTrue
  // sends them a one-time-password link. When clicked, they are authenticated
  // and landed on /parent/join?token=... where they can accept or decline.
  //
  let emailSent = false;
  try {
    const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
      email: validated.email,
      options: {
        emailRedirectTo: consentLink,
        shouldCreateUser: false,
      },
    });
    emailSent = !otpError;
  } catch {
    // Email sending failed but invitation is still valid — director has the link
    emailSent = false;
  }

  // Store children intent + email status in audit_log
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "CREATE_PARENT_CROSS_TENANT",
    resource_type: "parent",
    resource_id: newParent.id,
    result: "pending_consent",
    metadata: {
      parent_name: validated.full_name,
      flow: "cross_tenant_consent_required",
      invitation_id: invitation.id,
      consent_url: consentLink,
      existing_tenants: existingTenants,
      children_pending: validated.children.length,
      email_sent: emailSent,
    },
  });

  revalidatePath("/school/parents");
  return {
    success: true,
    parentId: newParent.id,
    flow: "cross_tenant_consent" as const,
    existingTenants,
    consentUrl: consentLink,
    invitationToken: invitation.token,
  };
}

// ─── Update Parent ─────────────────────────────────────────────────────────────

const updateParentSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1, "Le nom complet est requis"),
  phone: z.string().min(1, "Le téléphone est requis").refine(validatePhoneNumber, "Le numéro est invalide pour le pays sélectionné."),
  address: z.string().optional().nullable(),
});

export async function updateParent(input: z.infer<typeof updateParentSchema>) {
  const { supabase, tenantId, user } = await getDirectorTenant();
  const validated = updateParentSchema.parse(input);

  // Check phone uniqueness (excluding this parent)
  const { data: existingPhone } = await supabase
    .from("parents")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone", validated.phone)
    .neq("id", validated.id)
    .maybeSingle();

  if (existingPhone) {
    return { success: false, error: "Ce numéro de téléphone est déjà utilisé par un autre parent." };
  }

  const { error } = await supabase
    .from("parents")
    .update({
      full_name: validated.full_name,
      phone: validated.phone,
      address: validated.address || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.id)
    .eq("tenant_id", tenantId);

  if (error) return { success: false, error: error.message };

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "UPDATE_PARENT",
    resource_type: "parent",
    resource_id: validated.id,
    result: "success",
  });

  revalidatePath("/school/parents");
  revalidatePath(`/school/parents/${validated.id}`);
  return { success: true };
}

// ─── Associate Students (post-creation) ──────────────────────────────────────

const associateStudentsSchema = z.object({
  parent_id: z.string().uuid(),
  children: z.array(
    z.object({
      student_id: z.string().uuid(),
      relationship: z.string().min(1),
    })
  ),
});

export async function associateStudents(input: z.infer<typeof associateStudentsSchema>) {
  const { supabase, tenantId, user } = await getDirectorTenant();
  const parsed = associateStudentsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Un ou plusieurs élèves sélectionnés sont invalides. Veuillez réessayer.",
    };
  }
  const validated = parsed.data;

  // Verify parent belongs to this tenant
  const { data: parent } = await supabase
    .from("parents")
    .select("id")
    .eq("id", validated.parent_id)
    .eq("tenant_id", tenantId)
    .single();

  if (!parent) return { success: false, error: "Parent non trouvé." };

  const errors: { student_id: string; message: string }[] = [];
  const createdLinks: ParentStudentLink[] = [];

  for (const child of validated.children) {
    const { error } = await supabase.rpc("associate_student_to_parent", {
      p_tenant_id: tenantId,
      p_parent_id: validated.parent_id,
      p_student_id: child.student_id,
      p_relationship: child.relationship,
    });

    if (error) {
      const msg =
        error.message === "STUDENT_ALREADY_HAS_PARENT"
          ? "Cet élève a déjà un parent/tuteur actif."
          : error.message === "STUDENT_NOT_FOUND"
          ? "Élève non trouvé."
          : error.message;
      errors.push({ student_id: child.student_id, message: msg });
      continue;
    }

    const { data: link, error: linkError } = await supabase
      .from("parent_students")
      .select("id, relationship, created_at, student_id")
      .eq("tenant_id", tenantId)
      .eq("parent_id", validated.parent_id)
      .eq("student_id", child.student_id)
      .is("ended_at", null)
      .maybeSingle();

    if (!linkError && link) {
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select(
          `
          id, matricule, first_name, last_name, post_name, status,
          student_enrollments (
            id, class_id, school_year_id, status,
            classes (name),
            school_years (name)
          )
        `
        )
        .eq("id", child.student_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!studentError && student) {
        const enrollments = student.student_enrollments || [];
        const latestEnrollment = enrollments[enrollments.length - 1] || null;

        createdLinks.push({
          id: link.id,
          student_id: student.id,
          relationship: link.relationship,
          created_at: link.created_at,
          student: {
            id: student.id,
            matricule: student.matricule,
            first_name: student.first_name,
            last_name: student.last_name,
            post_name: student.post_name,
            status: student.status,
            current_class: latestEnrollment?.classes?.[0]?.name || null,
            current_year: latestEnrollment?.school_years?.[0]?.name || null,
          },
        });
      }
    }
  }

  if (errors.length === validated.children.length) {
    return { success: false, error: "Aucune association n'a pu être créée.", errors };
  }

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "ASSOCIATE_STUDENTS",
    resource_type: "parent",
    resource_id: validated.parent_id,
    result: errors.length > 0 ? "partial" : "success",
    metadata: { total: validated.children.length, failed: errors.length, errors },
  });

  revalidatePath("/school/parents");
  revalidatePath(`/school/parents/${validated.parent_id}`);
  return { success: true, errors, createdLinks };
}

// ─── Remove Student Association ────────────────────────────────────────────────

export async function removeStudentAssociation(parentStudentId: string) {
  const { supabase, tenantId, user } = await getDirectorTenant();

  const { error } = await supabase.rpc("remove_student_association", {
    p_tenant_id: tenantId,
    p_parent_student_id: parentStudentId,
    p_actor_user_id: user.id,
  });

  if (error) {
    const msg =
      error.message === "ASSOCIATION_NOT_FOUND"
        ? "Association introuvable ou déjà retirée."
        : error.message;
    return { success: false, error: msg };
  }

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "REMOVE_STUDENT_ASSOCIATION",
    resource_type: "parent_student",
    resource_id: parentStudentId,
    result: "success",
  });

  revalidatePath("/school/parents");
  return { success: true };
}

// ─── Resend Invitation ─────────────────────────────────────────────────────────

export async function resendParentInvitation(parentId: string) {
  const { supabase, tenantId, user } = await getDirectorTenant();

  const { data: parent, error: parentError } = await supabase
    .from("parents")
    .select("id, email, account_status, last_invitation_sent_at, full_name")
    .eq("id", parentId)
    .eq("tenant_id", tenantId)
    .single();

  if (parentError || !parent) return { success: false, error: "Parent non trouvé." };

  if (parent.account_status === "active") {
    return {
      success: false,
      error: "Ce compte est déjà actif. L'invitation ne peut pas être renvoyée.",
    };
  }

  if (parent.account_status === "inactive") {
    return {
      success: false,
      error: "Ce compte est désactivé. Réactivez-le avant de renvoyer l'invitation.",
    };
  }

  // Cooldown: 5 minutes between invitations
  if (parent.last_invitation_sent_at) {
    const lastSent = new Date(parent.last_invitation_sent_at).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastSent) / 1000 / 60;

    if (diffMinutes < 5) {
      const remainingSeconds = Math.ceil((5 - diffMinutes) * 60);
      return {
        success: false,
        error: `Veuillez attendre encore ${remainingSeconds} secondes avant de renvoyer l'invitation.`,
      };
    }
  }

  // Resend via Supabase Admin
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    parent.email!,
    {
      redirectTo: `${siteUrl}/auth/callback?next=/parent`,
      data: { invited_as: "parent", tenant_id: tenantId },
    }
  );

  if (inviteError) {
    return { success: false, error: `Erreur renvoi invitation: ${inviteError.message}` };
  }

  await supabase
    .from("parents")
    .update({ last_invitation_sent_at: new Date().toISOString() })
    .eq("id", parentId)
    .eq("tenant_id", tenantId);

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "RESEND_INVITATION",
    resource_type: "parent",
    resource_id: parentId,
    result: "success",
    metadata: { email: parent.email },
  });

  revalidatePath("/school/parents");
  revalidatePath(`/school/parents/${parentId}`);
  return { success: true };
}

// ─── Deactivate Parent ─────────────────────────────────────────────────────────

export async function deactivateParent(parentId: string) {
  const { supabase, tenantId, user } = await getDirectorTenant();

  const { data: parent } = await supabase
    .from("parents")
    .select("id, user_id, account_status")
    .eq("id", parentId)
    .eq("tenant_id", tenantId)
    .single();

  if (!parent) return { success: false, error: "Parent non trouvé." };

  // Update parent status
  const { error } = await supabase
    .from("parents")
    .update({ account_status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", parentId)
    .eq("tenant_id", tenantId);

  if (error) return { success: false, error: error.message };

  // Deactivate membership (doesn't delete data)
  await supabaseAdmin
    .from("user_memberships")
    .update({ status: "inactive" })
    .eq("user_id", parent.user_id)
    .eq("tenant_id", tenantId)
    .eq("role", "parent");

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "DEACTIVATE_PARENT",
    resource_type: "parent",
    resource_id: parentId,
    result: "success",
  });

  revalidatePath("/school/parents");
  revalidatePath(`/school/parents/${parentId}`);
  return { success: true };
}

// ─── Reactivate Parent ─────────────────────────────────────────────────────────

export async function reactivateParent(parentId: string) {
  const { supabase, tenantId, user } = await getDirectorTenant();

  const { data: parent } = await supabase
    .from("parents")
    .select("id, user_id, account_status")
    .eq("id", parentId)
    .eq("tenant_id", tenantId)
    .single();

  if (!parent) return { success: false, error: "Parent non trouvé." };
  if (parent.account_status !== "inactive") {
    return { success: false, error: "Ce compte n'est pas désactivé." };
  }

  const { error } = await supabase
    .from("parents")
    .update({ account_status: "active", updated_at: new Date().toISOString() })
    .eq("id", parentId)
    .eq("tenant_id", tenantId);

  if (error) return { success: false, error: error.message };

  await supabaseAdmin
    .from("user_memberships")
    .update({ status: "active" })
    .eq("user_id", parent.user_id)
    .eq("tenant_id", tenantId)
    .eq("role", "parent");

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "REACTIVATE_PARENT",
    resource_type: "parent",
    resource_id: parentId,
    result: "success",
  });

  revalidatePath("/school/parents");
  revalidatePath(`/school/parents/${parentId}`);
  return { success: true };
}
