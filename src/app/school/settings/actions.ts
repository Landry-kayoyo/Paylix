"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ────────────────────────────────────────────────────────────
// Helper: vérification Director
// ────────────────────────────────────────────────────────────
async function assertDirector() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Non authentifié.");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("role, tenant_id")
    .eq("user_id", user.id)
    .eq("role", "director")
    .eq("status", "active")
    .maybeSingle();

  if (!membership || !membership.tenant_id) {
    throw new Error("Accès refusé : Directeur uniquement.");
  }

  return { supabase, user, tenantId: membership.tenant_id };
}

// ────────────────────────────────────────────────────────────
// getSchoolSettings
// ────────────────────────────────────────────────────────────
export async function getSchoolSettings() {
  const { supabase, tenantId } = await assertDirector();

  // Try to select extended columns first (Phase 14A migration)
  const { data, error } = await supabase
    .from("tenants")
    .select(`
      id,
      name,
      short_name,
      description,
      city,
      address,
      contact_email,
      contact_phone,
      logo_url,
      receipt_footer_text,
      receipt_signature_url,
      receipt_stamp_url
    `)
    .eq("id", tenantId)
    .single();

  if (error) {
    // Fallback: try without Phase 14A columns in case migration isn't applied yet
    const { data: fallback, error: fallbackError } = await supabase
      .from("tenants")
      .select("id, name, city, address, contact_email, contact_phone, logo_url")
      .eq("id", tenantId)
      .single();

    if (fallbackError || !fallback) {
      console.error("Phase 13 select error (fallback):", fallbackError);
      throw new Error("Impossible de charger les paramètres de l'établissement: " + (fallbackError?.message || "Données introuvables."));
    }

    return {
      ...fallback,
      short_name: null,
      description: null,
      receipt_footer_text: null,
      receipt_signature_url: null,
      receipt_stamp_url: null,
    };
  }

  return data;
}

// ────────────────────────────────────────────────────────────
// saveSchoolSettings
// ────────────────────────────────────────────────────────────
const schoolSettingsSchema = z.object({
  name: z.string().min(2, "Le nom est obligatoire.").max(150).transform(s => s.trim()),
  short_name: z.string().max(50).optional().transform(s => s?.trim() ?? ""),
  description: z.string().max(600).optional().transform(s => s?.trim() ?? ""),
  city: z.string().max(100).optional().transform(s => s?.trim() ?? ""),
  address: z.string().max(300).optional().transform(s => s?.trim() ?? ""),
  contact_email: z.union([z.literal(""), z.string().email("E-mail invalide")]).optional().transform(s => s?.trim() ?? ""),
  contact_phone: z.string().max(50).optional().transform(s => s?.trim() ?? ""),
  receipt_footer_text: z.string().max(500).optional().transform(s => s?.trim() ?? ""),
});

export async function saveSchoolSettings(rawData: {
  name: string;
  short_name?: string;
  description?: string;
  city?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  receipt_footer_text?: string;
}) {
  const { supabase, user, tenantId } = await assertDirector();

  const parsed = schoolSettingsSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((e: any) => e.message).join(", "),
    };
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      name: parsed.data.name,
      short_name: parsed.data.short_name || null,
      description: parsed.data.description || null,
      city: parsed.data.city || null,
      address: parsed.data.address || null,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      receipt_footer_text: parsed.data.receipt_footer_text || null,
    })
    .eq("id", tenantId);

  if (error) {
    return { success: false, error: "Erreur lors de la sauvegarde." };
  }

  await logAudit({
    userId: user.id,
    tenantId: tenantId,
    actionType: "TENANT_SETTINGS_UPDATED",
    resourceType: "tenant",
    resourceId: tenantId,
    newValues: parsed.data,
  });

  revalidatePath("/school/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// uploadTenantAsset (logo, signature, cachet)
// ────────────────────────────────────────────────────────────
const ALLOWED_ASSET_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_ASSET_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadTenantAsset(formData: FormData) {
  const { supabase, user, tenantId } = await assertDirector();

  const file = formData.get("file") as File | null;
  const assetType = formData.get("type") as "logo" | "signature" | "stamp" | null;

  if (!file || !assetType) {
    return { success: false, error: "Données manquantes." };
  }

  if (!ALLOWED_ASSET_MIME_TYPES.includes(file.type)) {
    return { success: false, error: "Format non accepté (JPEG, PNG, WebP, SVG)." };
  }

  if (file.size > MAX_ASSET_SIZE_BYTES) {
    return { success: false, error: "Le fichier est trop volumineux (max 5 MB)." };
  }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  const ext = extMap[file.type] ?? "jpg";

  // tenant-assets/{tenant_id}/{type}_{timestamp}.{ext}
  const timestamp = Date.now();
  const filePath = `${tenantId}/${assetType}_${timestamp}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = new Uint8Array(arrayBuffer);

  // Upload
  const { error: uploadError } = await supabaseAdmin.storage
    .from("tenant-assets")
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return { success: false, error: "Échec de l'upload." };
  }

  // Get public URL
  const { data: publicUrlData } = supabaseAdmin.storage
    .from("tenant-assets")
    .getPublicUrl(filePath);

  const assetUrl = publicUrlData.publicUrl;

  // Mettre à jour la table tenants
  const updateData: Record<string, string> = {};
  if (assetType === "logo") updateData.logo_url = assetUrl;
  if (assetType === "signature") updateData.receipt_signature_url = assetUrl;
  if (assetType === "stamp") updateData.receipt_stamp_url = assetUrl;

  const { error: updateError } = await supabase
    .from("tenants")
    .update(updateData)
    .eq("id", tenantId);

  if (updateError) {
    return { success: false, error: "Erreur lors de la mise à jour de l'établissement." };
  }

  await logAudit({
    userId: user.id,
    tenantId: tenantId,
    actionType: "TENANT_ASSET_UPLOADED",
    resourceType: "tenant",
    resourceId: tenantId,
    context: { asset_type: assetType, file_path: filePath },
  });

  revalidatePath("/school/settings");
  return { success: true, url: assetUrl };
}
