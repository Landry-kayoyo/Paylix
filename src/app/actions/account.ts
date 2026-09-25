"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { pickPrimaryMembership } from "@/lib/user-profile";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ────────────────────────────────────────────────────────────
// Constantes de validation
// ────────────────────────────────────────────────────────────
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_PASSWORD_LENGTH = 8;

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

// ────────────────────────────────────────────────────────────
// Helper: obtenir l'utilisateur connecté ou lancer une erreur
// ────────────────────────────────────────────────────────────
async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Non authentifié.");
  }
  return { supabase, user };
}

// ────────────────────────────────────────────────────────────
// getMyProfile
// Récupère le profil complet + membership + email de l'utilisateur connecté
// ────────────────────────────────────────────────────────────
export async function getMyProfile() {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, post_name, phone, avatar_url, status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Profil introuvable.");
  }

  // Membership : rôle + établissement
  const { data: memberships, error: membershipsError } = await supabase
    .from("user_memberships")
    .select("role, tenant_id, status, tenants(id, name, city)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipsError) {
    throw new Error("Impossible de charger votre accès.");
  }

  const membership = pickPrimaryMembership((memberships ?? []) as unknown as Array<{
    role?: string | null;
    tenant_id?: string | null;
    tenants?: { id: string; name: string; city: string | null } | null;
  }>);

  return {
    id: user.id,
    email: user.email ?? "",
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    postName: profile.post_name ?? "",
    phone: profile.phone ?? "",
    avatarUrl: profile.avatar_url,
    status: profile.status,
    role: membership?.role ?? null,
    tenantId: membership?.tenant_id ?? null,
    tenant: (membership?.tenants as unknown) as { id: string; name: string; city: string | null } | null ?? null,
    lastSignIn: user.last_sign_in_at ?? null,
  };
}

// ────────────────────────────────────────────────────────────
// updateMyProfile
// Modification du profil — uniquement les champs autorisés
// Jamais : role, tenant_id, status, must_change_password
// ────────────────────────────────────────────────────────────
const updateProfileSchema = z.object({
  firstName: z.string().min(1, "Le prénom est obligatoire.").max(100).transform(s => s.trim()),
  lastName: z.string().min(1, "Le nom est obligatoire.").max(100).transform(s => s.trim()),
  postName: z.string().max(100).optional().transform(s => s?.trim() ?? ""),
  phone: z
    .string()
    .max(30)
    .optional()
    .transform(s => s?.trim() ?? ""),
});

export async function updateMyProfile(rawData: {
  firstName: string;
  lastName: string;
  postName?: string;
  phone?: string;
}) {
  const { user } = await getAuthenticatedUser();

  const parsed = updateProfileSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((e: any) => e.message).join(", "),
    };
  }

  const { firstName, lastName, postName, phone } = parsed.data;

  // Utiliser le client authentifié — RLS garantit que l'utilisateur
  // ne peut mettre à jour que son propre profil (policy "Users can update own profile")
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      post_name: postName || null,
      phone: phone || null,
    })
    .eq("id", user.id);

  if (error) {
    return { success: false, error: "Erreur lors de la mise à jour du profil." };
  }

  await logAudit({
    userId: user.id,
    actionType: "PROFILE_UPDATED",
    resourceType: "profile",
    resourceId: user.id,
    newValues: { firstName, lastName, postName, phone },
  });

  revalidatePath("/account");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// updateMyEmail
// Changement d'e-mail via Supabase Auth — déclenche confirmation
// ────────────────────────────────────────────────────────────
export async function updateMyEmail(newEmail: string) {
  const { supabase, user } = await getAuthenticatedUser();

  const emailSchema = z.string().email("Adresse e-mail invalide.");
  const parsed = emailSchema.safeParse(newEmail.trim());
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  if (parsed.data === user.email) {
    return { success: false, error: "Cette adresse e-mail est déjà celle de votre compte." };
  }

  // Utilise le mécanisme standard Supabase Auth
  // En production : envoie un e-mail de confirmation à la nouvelle adresse
  const { error } = await supabase.auth.updateUser({
    email: parsed.data,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  await logAudit({
    userId: user.id,
    actionType: "PROFILE_EMAIL_CHANGED",
    resourceType: "profile",
    resourceId: user.id,
    // Ne jamais logger l'e-mail complet en clair dans les métadonnées
    newValues: { email_domain: parsed.data.split("@")[1] },
  });

  return {
    success: true,
    message:
      "Un lien de confirmation a été envoyé à votre nouvelle adresse e-mail. " +
      "Le changement sera effectif après validation.",
  };
}

// ────────────────────────────────────────────────────────────
// changeMyPassword
// Changement de mot de passe via Supabase Auth
// ────────────────────────────────────────────────────────────
export async function changeMyPassword(currentPassword: string, newPassword: string, confirmPassword: string) {
  const { supabase, user } = await getAuthenticatedUser();

  if (newPassword !== confirmPassword) {
    return { success: false, error: "Les mots de passe ne correspondent pas." };
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    };
  }

  if (!PASSWORD_REGEX.test(newPassword)) {
    return {
      success: false,
      error:
        "Le mot de passe doit contenir au moins une majuscule et un chiffre.",
    };
  }

  // Vérifier le mot de passe actuel
  if (user.email) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return { success: false, error: "Le mot de passe actuel est incorrect." };
    }
  }

  // Jamais logguer le mot de passe
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { success: false, error: error.message };
  }

  // Audit sans le mot de passe
  await logAudit({
    userId: user.id,
    actionType: "PROFILE_PASSWORD_CHANGED",
    resourceType: "profile",
    resourceId: user.id,
    // Aucun mot de passe dans les métadonnées
    context: { method: "self_service" },
  });

  // Déconnexion après changement de mot de passe
  await supabase.auth.signOut();

  return { success: true };
}

// ────────────────────────────────────────────────────────────
// uploadProfileImage
// Upload avatar utilisateur vers Storage bucket "profile-images"
// ────────────────────────────────────────────────────────────
export async function uploadProfileImage(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUser();

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "Aucun fichier fourni." };
  }

  // Validation serveur : type MIME
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Format non accepté. Utilisez JPEG, PNG ou WebP.",
    };
  }

  // Validation serveur : taille
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      success: false,
      error: "Le fichier est trop volumineux. Taille maximale : 5 MB.",
    };
  }

  // Déterminer l'extension depuis le type MIME (ne pas faire confiance à l'extension originale)
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extMap[file.type] ?? "jpg";

  // Chemin sécurisé : profile-images/{user_id}/{timestamp}.{ext}
  const timestamp = Date.now();
  const filePath = `${user.id}/${timestamp}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = new Uint8Array(arrayBuffer);

  // Supprimer l'ancienne image si elle existe
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  if (profile?.avatar_url) {
    // Extraire le chemin du fichier depuis l'URL publique
    const url = new URL(profile.avatar_url);
    const pathParts = url.pathname.split("/profile-images/");
    if (pathParts.length > 1) {
      await supabaseAdmin.storage.from("profile-images").remove([pathParts[1]]);
    }
  }

  // Upload du nouveau fichier
  const { error: uploadError } = await supabaseAdmin.storage
    .from("profile-images")
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return { success: false, error: "Échec de l'upload. Veuillez réessayer." };
  }

  // Obtenir l'URL signée (bucket privé) — valide 1 an
  const { data: signedUrl, error: signedUrlError } = await supabaseAdmin.storage
    .from("profile-images")
    .createSignedUrl(filePath, 60 * 60 * 24 * 365);

  const avatarUrl = signedUrl?.signedUrl ?? null;

  if (!avatarUrl) {
    return { success: false, error: "Impossible d'obtenir l'URL de l'image." };
  }

  // Stocker le chemin relatif dans le profil (la signed URL est utilisée pour affichage)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (profileError) {
    return { success: false, error: "Erreur lors de la mise à jour du profil." };
  }

  await logAudit({
    userId: user.id,
    actionType: "PROFILE_AVATAR_UPLOADED",
    resourceType: "profile",
    resourceId: user.id,
    context: { file_path: filePath, mime_type: file.type, size_bytes: file.size },
  });

  revalidatePath("/account");
  return { success: true, avatarUrl };
}

// ────────────────────────────────────────────────────────────
// deleteProfileImage
// Supprime l'avatar de l'utilisateur connecté
// ────────────────────────────────────────────────────────────
export async function deleteProfileImage() {
  const { supabase, user } = await getAuthenticatedUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile?.avatar_url) {
    return { success: false, error: "Aucune photo de profil à supprimer." };
  }

  // Extraire le chemin du fichier depuis l'URL
  try {
    const url = new URL(profile.avatar_url);
    const pathParts = url.pathname.split("/profile-images/");
    if (pathParts.length > 1) {
      await supabaseAdmin.storage.from("profile-images").remove([pathParts[1]]);
    }
  } catch {
    // Si l'URL est invalide, on continue quand même pour nettoyer la BDD
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) {
    return { success: false, error: "Erreur lors de la suppression de la photo." };
  }

  await logAudit({
    userId: user.id,
    actionType: "PROFILE_AVATAR_DELETED",
    resourceType: "profile",
    resourceId: user.id,
  });

  revalidatePath("/account");
  return { success: true };
}
