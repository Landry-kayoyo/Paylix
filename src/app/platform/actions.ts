"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { randomBytes } from "crypto";

import { revalidatePath } from "next/cache";
import { validatePhoneNumber } from "@/app/school/parents/phone-utils";

async function buildActivationLink(email: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectTo = `${appUrl}/update-password?type=recovery`;

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw new Error(`La génération du lien d'activation a échoué: ${error.message}`);
  }

  const actionLink = (data as any)?.action_link ?? (data as any)?.properties?.action_link ?? null;
  if (!actionLink) {
    throw new Error('Le lien d’activation n’a pas été généré par Supabase.');
  }

  return actionLink;
}

async function sendCredentialsEmail({
  email,
  directorName,
  tenantName,
  activationLink,
  isRegenerate = false,
}: {
  email: string;
  directorName: string;
  tenantName: string;
  activationLink: string;
  isRegenerate?: boolean;
}) {
  const emailApiUrl = process.env.PAYLIX_EMAIL_API_URL
    || (process.env.NODE_ENV === "production" ? null : "http://127.0.0.1:54344/api/v1/send");

  if (!emailApiUrl) {
    throw new Error("Le service email n’est pas configuré. Définissez PAYLIX_EMAIL_API_URL.");
  }

  const subject = isRegenerate
    ? `Activation de votre accès Paylix — ${tenantName}`
    : `Activation de votre compte Paylix — ${tenantName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #059669; font-size: 24px; margin-bottom: 4px;">Paylix</h1>
        <p style="color: #64748b; font-size: 14px; margin: 0;">Plateforme de gestion scolaire et financière</p>
      </div>

      <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Bonjour ${directorName},</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          ${isRegenerate
            ? `Un accès a été réinitialisé pour votre compte sur l'établissement <strong>${tenantName}</strong>.`
            : `Une invitation a été créée pour votre accès à l'établissement <strong>${tenantName}</strong> sur Paylix.`
          }
        </p>

        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 20px 0;">
          Cliquez sur le bouton ci-dessous pour activer votre compte et définir votre mot de passe sécurisé.
        </p>

        <div style="text-align: center; margin: 28px 0 16px 0;">
          <a href="${activationLink}" style="background-color: #059669; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 6px; display: inline-block;">
            Cliquez ici pour activer votre compte &rarr;
          </a>
        </div>

        <p style="font-size: 12px; color: #d97706; background-color: #fef3c7; padding: 10px 12px; border-radius: 6px; border: 1px solid #fde68a; margin-top: 20px;">
          <strong>Attention :</strong> Ce lien est strictement personnel et permet de sécuriser votre compte lors de votre première connexion.
        </p>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement par Paylix. Veuillez ne pas y répondre directement.
      </p>
    </div>
  `;

  try {
    const response = await fetch(emailApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: { Email: 'noreply@paylix.local', Name: 'Paylix Plateforme' },
        To: [{ Email: email, Name: directorName }],
        Subject: subject,
        HTML: html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mail delivery failed with status ${response.status}`);
    }

    return {
      accepted: true,
      transport: emailApiUrl.includes("127.0.0.1:54344") ? "mailpit" : "email-provider",
    } as const;
  } catch (err: any) {
    console.warn('Could not send email via Mailpit:', err.message);
    return { accepted: false } as const;
  }
}

const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  code: z.string().min(2).max(10),
  address: z.string().min(2),
  city: z.string().min(2),
  country: z.string().min(2),
  tenantEmail: z.union([z.literal(""), z.string().email()]),
  fullName: z.string().min(4),
  email: z.string().email(),
  phone: z.string().refine(validatePhoneNumber, "Numéro de téléphone invalide pour le pays sélectionné"),
});

export async function createTenantWithDirector(data: z.infer<typeof createTenantSchema>) {
  const supabase = await createClient();
  
  // Verify platform admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: membership } = await supabase
    .from("user_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .limit(1)
    .maybeSingle();
    
  if (!membership) throw new Error("Unauthorized: Platform Admin only");

  const validated = createTenantSchema.parse(data);
  const nameParts = validated.fullName.trim().split(/\s+/);
  const firstName = nameParts.shift() || "";
  const lastName = nameParts.join(" ") || firstName;
  const tempPassword = randomBytes(12).toString("base64url") + "A1!"; // Ensure strong password

  // We use supabaseAdmin for these operations to bypass RLS and create users
  
  try {
    // 1. Create Tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: validated.name,
        slug: validated.slug,
        code: validated.code,
        email: validated.tenantEmail || null,
        address: validated.address,
        city: validated.city,
        country: validated.country,
      })
      .select()
      .single();

    if (tenantError) throw new Error(`Failed to create tenant: ${tenantError.message}`);

    // 2. Create Auth User
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validated.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      }
    });

    if (authError) {
      // Rollback tenant
      await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    // 3. Insert Profile
    const { error: profileUpsertError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUser.user.id,
        first_name: firstName,
        last_name: lastName,
        phone: validated.phone,
        status: "invited",
        must_change_password: true
      });

    if (profileUpsertError) {
       console.error("Profile Error", profileUpsertError);
    }

    // 4. Create Membership
    const { error: membershipError } = await supabaseAdmin
      .from("user_memberships")
      .insert({
        user_id: authUser.user.id,
        tenant_id: tenant.id,
        role: "director",
      });

    if (membershipError) {
      console.error("Membership error", membershipError);
    }

    const activationLink = await buildActivationLink(validated.email);
    const emailDelivery = await sendCredentialsEmail({
      email: validated.email,
      directorName: validated.fullName,
      tenantName: validated.name,
      activationLink,
      isRegenerate: false,
    });

    if (!emailDelivery.accepted) {
      throw new Error('L’invitation n’a pas pu être envoyée par email. Vérifiez la configuration SMTP/Mailpit.');
    }

    revalidatePath("/platform/schools");
    revalidatePath("/platform");

    return { 
      success: true, 
      tenant: {
        ...tenant,
        director: {
          id: authUser.user.id,
          firstName,
          lastName,
          phone: validated.phone,
          status: "invited",
          mustChangePassword: true,
          email: validated.email,
        }
      }, 
      director: {
        email: validated.email,
        firstName,
        lastName
      },
      emailDelivery,
    };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function regenerateAccess(directorId: string) {
  const supabase = await createClient();
  
  // Verify platform admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: membership } = await supabase
    .from("user_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .limit(1)
    .maybeSingle();
    
  if (!membership) throw new Error("Unauthorized: Platform Admin only");

  // Check if user is in 'invited' state
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, status, first_name, last_name")
    .eq("id", directorId)
    .single();

  if (!profile || profile.status !== 'invited') {
    return { success: false, error: "Cannot regenerate access for a user who is not in 'invited' state." };
  }

  const newTempPassword = randomBytes(12).toString("base64url") + "A1!";

  // Update password in Auth
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(directorId, {
    password: newTempPassword
  });

  if (authError) {
    return { success: false, error: authError.message };
  }

  // Ensure must_change_password is true
  await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", directorId);

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(directorId);

  // Find tenant name for email
  const { data: directorMem } = await supabaseAdmin
    .from("user_memberships")
    .select("tenants(name)")
    .eq("user_id", directorId)
    .single();

  const tenantName = (directorMem?.tenants as any)?.name || "Votre établissement";
  const email = authUser.user?.email || "";

  // Send new activation email
  if (email) {
    const activationLink = await buildActivationLink(email);
    const emailDelivery = await sendCredentialsEmail({
      email,
      directorName: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Responsable",
      tenantName,
      activationLink,
      isRegenerate: true,
    });

    if (!emailDelivery.accepted) {
      return { success: false, error: "Les nouveaux accès ont été générés, mais l’email n’a pas pu être envoyé." };
    }

    revalidatePath("/platform/schools");
    return {
      success: true,
      email,
      emailDelivery,
    };
  }

  return { success: false, error: "Aucune adresse email n’est associée à ce responsable." };
}

export async function getTenantsWithDirectors() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: membership } = await supabase
    .from("user_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .limit(1)
    .maybeSingle();
    
  if (!membership) throw new Error("Unauthorized: Platform Admin only");

  const { data: tenants, error: tenantsError } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (tenantsError) throw new Error(tenantsError.message);

  const { data: memberships } = await supabaseAdmin
    .from("user_memberships")
    .select("tenant_id, user_id, role, profiles(id, first_name, last_name, phone, status, must_change_password)")
    .eq("role", "director");

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  authUsers?.users.forEach(u => {
    emailMap.set(u.id, u.email || "");
  });

  return (tenants || []).map(tenant => {
    const directorMembership = (memberships || []).find(m => m.tenant_id === tenant.id);
    const profile = directorMembership?.profiles as any;
    const director = profile ? {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone: profile.phone,
      status: profile.status,
      mustChangePassword: profile.must_change_password,
      email: emailMap.get(profile.id) || "",
    } : null;

    return {
      ...tenant,
      director,
    };
  });
}

const updateTenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().min(2),
  code: z.string().min(2).max(10),
  status: z.enum(["active", "trial", "suspended", "archived"]).default("active"),
});

export async function updateTenant(data: z.infer<typeof updateTenantSchema>) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: membership } = await supabase
    .from("user_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .limit(1)
    .maybeSingle();
    
  if (!membership) throw new Error("Unauthorized: Platform Admin only");

  const validated = updateTenantSchema.parse(data);

  const { data: updated, error } = await supabaseAdmin
    .from("tenants")
    .update({
      name: validated.name,
      slug: validated.slug,
      code: validated.code,
      status: validated.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, tenant: updated };
}

export async function getTenantDetail(tenantId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .limit(1)
    .maybeSingle();

  if (!membership) throw new Error("Unauthorized: Platform Admin only");

  // Fetch tenant
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) throw new Error("Établissement introuvable");

  // Fetch director membership + profile
  const { data: directorMem } = await supabaseAdmin
    .from("user_memberships")
    .select("user_id, profiles(id, first_name, last_name, phone, status, must_change_password)")
    .eq("tenant_id", tenantId)
    .eq("role", "director")
    .maybeSingle();

  let director = null;
  if (directorMem) {
    const profile = directorMem.profiles as any;
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(directorMem.user_id);
    director = {
      id: directorMem.user_id,
      firstName: profile?.first_name || "",
      lastName: profile?.last_name || "",
      phone: profile?.phone || null,
      status: profile?.status || "invited",
      mustChangePassword: profile?.must_change_password || false,
      email: authUser?.user?.email || "",
    };
  }

  return {
    tenant,
    director,
  };
}

// ────────────────────────────────────────────────────────────
// getPlatformStats (Dashboard)
// ────────────────────────────────────────────────────────────
export async function getPlatformStats(period: string = '30d') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .limit(1)
    .maybeSingle();

  if (!membership) throw new Error("Unauthorized: Platform Admin only");

  const now = new Date();
  let startDate = new Date();
  
  switch (period) {
    case '7d': startDate.setDate(now.getDate() - 7); break;
    case '30d': startDate.setDate(now.getDate() - 30); break;
    case '3m': startDate.setMonth(now.getMonth() - 3); break;
    case '6m': startDate.setMonth(now.getMonth() - 6); break;
    case '12m': startDate.setFullYear(now.getFullYear() - 1); break;
    case 'all': startDate = new Date(2020, 0, 1); break;
    default: startDate.setDate(now.getDate() - 30); break;
  }

  const { data: tenantsData } = await supabaseAdmin.from("tenants").select("id, status, created_at");
  const { data: membershipsData } = await supabaseAdmin.from("user_memberships").select("role, created_at");
  const { data: studentsData } = await supabaseAdmin.from("students").select("id, created_at");

  const tenants = tenantsData || [];
  const members = membershipsData || [];
  const students = studentsData || [];

  const kpi = {
    totalTenants: tenants.length,
    activeTenants: tenants.filter(t => t.status === 'active').length,
    suspendedTenants: tenants.filter(t => t.status === 'suspended').length,
    trialTenants: tenants.filter(t => t.status === 'trial').length,
    
    totalUsers: members.length,
    directors: members.filter(m => m.role === 'director').length,
    accountants: members.filter(m => m.role === 'accountant').length,
    parents: members.filter(m => m.role === 'parent').length,
    
    totalStudents: students.length,
  };

  // Build chart data
  const isDaily = ['7d', '30d'].includes(period);
  const chartDataMap = new Map<string, any>();

  // Initialize slots
  const curr = new Date(startDate);
  curr.setHours(0,0,0,0);
  const end = new Date(now);
  
  if (isDaily) {
    while (curr <= end) {
      const key = curr.toISOString().split('T')[0];
      const label = curr.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      chartDataMap.set(key, { name: label, dateKey: key, tenants: 0, users: 0, students: 0 });
      curr.setDate(curr.getDate() + 1);
    }
  } else {
    curr.setDate(1); // start of month
    while (curr <= end) {
      const key = `${curr.getFullYear()}-${(curr.getMonth() + 1).toString().padStart(2, '0')}`;
      const label = curr.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      chartDataMap.set(key, { name: label, dateKey: key, tenants: 0, users: 0, students: 0 });
      curr.setMonth(curr.getMonth() + 1);
    }
  }

  const getSlotKey = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isDaily) return d.toISOString().split('T')[0];
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  // Add cumulative or distinct logic? For evolution, it's usually new additions per period.
  tenants.forEach(t => {
    if (new Date(t.created_at) >= startDate) {
      const k = getSlotKey(t.created_at);
      if (chartDataMap.has(k)) chartDataMap.get(k).tenants++;
    }
  });
  
  members.forEach(m => {
    if (new Date(m.created_at) >= startDate) {
      const k = getSlotKey(m.created_at);
      if (chartDataMap.has(k)) chartDataMap.get(k).users++;
    }
  });

  students.forEach(s => {
    if (new Date(s.created_at) >= startDate) {
      const k = getSlotKey(s.created_at);
      if (chartDataMap.has(k)) chartDataMap.get(k).students++;
    }
  });

  const chartData = Array.from(chartDataMap.values());

  return { kpi, chartData };
}
