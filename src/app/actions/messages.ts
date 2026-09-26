"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ConversationItem {
  id: string;
  subject: string | null;
  category: string;
  updated_at: string;
  last_read_at: string | null;
  is_unread: boolean;
  messages: {
    id: string;
    body: string;
    created_at: string;
    sender_id: string;
  }[];
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function firstOf<T>(val: T | T[] | null | undefined): T | null {
  if (Array.isArray(val)) return val[0] ?? null;
  return val ?? null;
}

// ─── Fetch conversations ────────────────────────────────────────────────────────

export async function getConversationsAction(tenantId: string): Promise<ConversationItem[]> {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("conversation_participants")
    .select(`
      last_read_at,
      archived_at,
      conversations!inner(
        id, subject, category, updated_at, tenant_id,
        messages(id, body, created_at, sender_id)
      )
    `)
    .eq("user_id", user.id)
    .is("archived_at", null);

  console.log("getConversationsAction for", user.id, "tenant:", tenantId);
  console.log("DATA:", data?.length, "ERROR:", error);

  if (error || !data) return [];

  return data
    .map((row) => {
      const conv = firstOf((row as any).conversations);
      if (!conv) return null;
      if (tenantId && conv.tenant_id !== tenantId) return null;

      const msgs: any[] = Array.isArray(conv.messages) ? conv.messages : [];
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const is_unread = !row.last_read_at || new Date(conv.updated_at) > new Date(row.last_read_at);

      return {
        id: conv.id,
        subject: conv.subject,
        category: conv.category,
        updated_at: conv.updated_at,
        last_read_at: row.last_read_at,
        is_unread,
        messages: msgs,
      } as ConversationItem;
    })
    .filter(Boolean) as ConversationItem[];
}

// ─── Mark as read ───────────────────────────────────────────────────────────────

export async function markReadAction(conversationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
}

// ─── Send message ───────────────────────────────────────────────────────────────

export async function sendMessageAction(conversationId: string, tenantId: string, body: string, revalidate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // If tenantId is not provided (e.g. platform admin), fetch it from the conversation
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("tenant_id")
      .eq("id", conversationId)
      .single();
    resolvedTenantId = conv?.tenant_id ?? "";
  }

  if (!resolvedTenantId) throw new Error("tenant_id introuvable pour cette conversation");

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    tenant_id: resolvedTenantId,
    body,
  });
  if (error) throw error;

  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  if (revalidate) revalidatePath(revalidate);
}

// ─── Parent: start conversation with director ───────────────────────────────────

export async function startConversationWithDirectorAction(
  tenantId: string,
  subject: string,
  body: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Use supabaseAdmin to bypass RLS, as a parent may not be able to read directors' memberships
  const { data: directors } = await supabaseAdmin
    .from("user_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "director")
    .eq("status", "active");

  if (!directors || directors.length === 0) throw new Error("Aucun directeur trouvé");

  const { data: conv, error: convErr } = await supabaseAdmin
    .from("conversations")
    .insert({ tenant_id: tenantId, subject, category: "general", created_by: user.id })
    .select("id")
    .single();
  if (convErr) throw convErr;

  const participants = [user.id, ...directors.map((d) => d.user_id)].map((uid) => ({
    conversation_id: conv.id,
    user_id: uid,
  }));
  const { error: partErr } = await supabaseAdmin.from("conversation_participants").insert(participants);
  if (partErr) throw partErr;

  const { error: msgErr } = await supabaseAdmin.from("messages").insert({
    conversation_id: conv.id,
    sender_id: user.id,
    tenant_id: tenantId,
    body,
  });
  if (msgErr) throw msgErr;

  await supabaseAdmin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);

  revalidatePath("/parent/messages");
  return { conversationId: conv.id };
}

// ─── Director: start conversation with parent ───────────────────────────────────

export async function startConversationWithParentAction(
  tenantId: string,
  parentId: string,
  subject: string,
  body: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: conv, error: convErr } = await supabaseAdmin
    .from("conversations")
    .insert({ tenant_id: tenantId, subject, category: "general", created_by: user.id })
    .select("id")
    .single();
  if (convErr) throw convErr;

  const participants = [
    { conversation_id: conv.id, user_id: user.id },
    { conversation_id: conv.id, user_id: parentId },
  ];
  const { error: partErr } = await supabaseAdmin.from("conversation_participants").insert(participants);
  if (partErr) throw partErr;

  const { error: msgErr } = await supabaseAdmin.from("messages").insert({
    conversation_id: conv.id,
    sender_id: user.id,
    tenant_id: tenantId,
    body,
  });
  if (msgErr) throw msgErr;

  await supabaseAdmin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);

  revalidatePath("/school/messages");
  return { conversationId: conv.id };
}

// ─── Platform admin: start conversation with a tenant director ──────────────────

export async function startPlatformConversationWithDirectorAction(
  tenantId: string,
  body: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: platformMemberships } = await supabase
    .from("user_memberships")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .eq("status", "active")
    .limit(1);

  if (!platformMemberships?.length) throw new Error("Accès réservé au super-administrateur.");
  if (!tenantId || !body.trim()) {
    throw new Error("L'établissement et le message sont obligatoires.");
  }
  if (body.trim().length > 10000) {
    throw new Error("Le message dépasse la longueur autorisée.");
  }

  const { data: directorMemberships, error: directorsError } = await supabaseAdmin
    .from("user_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "director")
    .eq("status", "active");

  if (directorsError) throw directorsError;
  if (!directorMemberships?.length) throw new Error("Aucun directeur actif n'est associé à cet établissement.");

  const { data: existingConversation, error: conversationLookupError } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("category", "platform_support")
    .maybeSingle();
  if (conversationLookupError) throw conversationLookupError;

  let conversationId = existingConversation?.id ?? null;
  if (!conversationId) {
    const { data: createdConversation, error: createError } = await supabaseAdmin
      .from("conversations")
      .insert({ tenant_id: tenantId, subject: null, category: "platform_support", created_by: user.id })
      .select("id")
      .single();

    if (createError?.code === "23505") {
      const { data: concurrentConversation, error: retryError } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("category", "platform_support")
        .maybeSingle();
      if (retryError) throw retryError;
      conversationId = concurrentConversation?.id ?? null;
    } else if (createError) {
      throw createError;
    } else {
      conversationId = createdConversation.id;
    }
  }

  if (!conversationId) throw new Error("Impossible d'ouvrir la discussion de cet établissement.");

  const { data: platformAdmins, error: adminsError } = await supabaseAdmin
    .from("user_memberships")
    .select("user_id")
    .eq("role", "platform_admin")
    .eq("status", "active");
  if (adminsError) throw adminsError;

  const participantIds = [...new Set([
    user.id,
    ...(platformAdmins ?? []).map((membership) => membership.user_id),
    ...directorMemberships.map((membership) => membership.user_id),
  ])];
  const { error: participantError } = await supabaseAdmin
    .from("conversation_participants")
    .upsert(
      participantIds.map((participantId) => ({ conversation_id: conversationId, user_id: participantId })),
      { onConflict: "conversation_id,user_id", ignoreDuplicates: true }
    );
  if (participantError) throw participantError;

  const { error: messageError } = await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    tenant_id: tenantId,
    body: body.trim(),
  });
  if (messageError) throw messageError;

  await supabaseAdmin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  revalidatePath("/platform/messages");
  revalidatePath("/school/messages");
  return { conversationId };
}

// ─── Director: send broadcast ───────────────────────────────────────────────────

export async function sendBroadcastAction(
  tenantId: string,
  subject: string,
  body: string,
  targetAll: boolean
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch all parent user_ids for this tenant
  const { data: memberships } = await supabase
    .from("user_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "parent")
    .eq("status", "active");

  if (!memberships || memberships.length === 0) throw new Error("Aucun parent trouvé");

  const recipientIds = memberships.map((m) => m.user_id);

  // Create one conversation per parent for privacy
  for (const recipientId of recipientIds) {
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .insert({ tenant_id: tenantId, subject, category: "broadcast", created_by: user.id })
      .select("id")
      .single();
    if (convErr || !conv) continue;

    const { error: partErr } = await supabaseAdmin.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: recipientId },
    ]);
    if (partErr) throw partErr;

    const { error: msgErr } = await supabaseAdmin.from("messages").insert({
      conversation_id: conv.id,
      sender_id: user.id,
      tenant_id: tenantId,
      body,
    });
    if (msgErr) throw msgErr;

    await supabaseAdmin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);
  }

  revalidatePath("/school/messages");
  return { success: true, count: recipientIds.length };
}
