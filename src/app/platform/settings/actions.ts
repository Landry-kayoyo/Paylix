"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ────────────────────────────────────────────────────────────
// Helper : vérification Platform Admin
// ────────────────────────────────────────────────────────────
async function assertPlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Non authentifié.");

  const { data: memberships } = await supabase
    .from("user_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .eq("status", "active")
    .limit(1);

  const membership = (memberships ?? [])[0] ?? null;

  if (!membership) throw new Error("Accès refusé : Platform Admin uniquement.");

  return { supabase, user };
}

// ────────────────────────────────────────────────────────────
// getPlatformSettings
// ────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  platform_info: {
    name: "Paylix",
    description: "Plateforme de gestion financière scolaire",
    contact_email: "",
    support_url: "",
  },
  global_preferences: {
    default_language: "fr",
    date_format: "DD/MM/YYYY",
    currency_display: "both",
  },
};

export async function getPlatformSettings() {
  const { supabase } = await assertPlatformAdmin();

  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value");

  // Si la table n'existe pas ou erreur, retourner les valeurs par défaut
  if (error || !data || data.length === 0) {
    return DEFAULT_SETTINGS;
  }

  // Transformer en objet clé/valeur
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of data) {
    settings[row.key] = row.value;
  }

  return settings;
}

// ────────────────────────────────────────────────────────────
// savePlatformSettings
// ────────────────────────────────────────────────────────────
const platformInfoSchema = z.object({
  name: z.string().min(2, "Le nom est obligatoire.").max(100).transform(s => s.trim()),
  description: z.string().max(500).optional().transform(s => s?.trim() ?? ""),
  contact_email: z
    .union([z.literal(""), z.string().email("E-mail invalide.")])
    .optional()
    .transform(s => s?.trim() ?? ""),
  support_url: z.string().max(200).optional().transform(s => s?.trim() ?? ""),
});

const globalPreferencesSchema = z.object({
  default_language: z.enum(["fr", "en"]).default("fr"),
  date_format: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).default("DD/MM/YYYY"),
  currency_display: z.enum(["cdf_only", "usd_only", "both"]).default("both"),
});

export async function savePlatformSettings(data: {
  platform_info: {
    name: string;
    description?: string;
    contact_email?: string;
    support_url?: string;
  };
  global_preferences: {
    default_language: "fr" | "en";
    date_format: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
    currency_display: "cdf_only" | "usd_only" | "both";
  };
}) {
  const { supabase, user } = await assertPlatformAdmin();

  const infoResult = platformInfoSchema.safeParse(data.platform_info);
  if (!infoResult.success) {
    return {
      success: false,
      error: infoResult.error.issues.map((e: any) => e.message).join(", "),
    };
  }

  const prefsResult = globalPreferencesSchema.safeParse(data.global_preferences);
  if (!prefsResult.success) {
    return {
      success: false,
      error: prefsResult.error.issues.map((e: any) => e.message).join(", "),
    };
  }

  // Upsert des deux clés (bypassing RLS via supabaseAdmin as we already asserted role)
  const { error } = await supabaseAdmin.from("platform_settings").upsert([
    {
      key: "platform_info",
      value: infoResult.data,
      updated_by: user.id,
    },
    {
      key: "global_preferences",
      value: prefsResult.data,
      updated_by: user.id,
    },
  ], { onConflict: "key" });

  if (error) {
    console.error("Erreur savePlatformSettings:", error);
    return { success: false, error: `Erreur DB: ${error.message}` };
  }

  await logAudit({
    userId: user.id,
    actionType: "PLATFORM_SETTINGS_UPDATED",
    resourceType: "platform_settings",
    resourceId: user.id,
    newValues: {
      platform_info: infoResult.data,
      global_preferences: prefsResult.data,
    },
  });

  revalidatePath("/platform/settings");
  return { success: true };
}
