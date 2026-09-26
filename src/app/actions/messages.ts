"use server";

import { createClient } from "@/lib/supabase/server";
import { MessagesService } from "@/lib/messages";
import { AudienceCriteria } from "@/lib/parent-audience";
import { revalidatePath } from "next/cache";

export async function getAudiencePreviewAction(criteria: AudienceCriteria) {
  const supabase = await createClient();
  const messagesService = new MessagesService(supabase);
  const { count } = await (new (require('@/lib/parent-audience').ParentAudienceService)(supabase)).calculateAudience(criteria);
  return { count };
}

export async function sendBroadcastAction(
  tenantId: string,
  schoolYearId: string,
  subject: string,
  body: string,
  category: string,
  criteria: AudienceCriteria
) {
  const supabase = await createClient();
  const messagesService = new MessagesService(supabase);
  
  await messagesService.sendBroadcast(tenantId, schoolYearId, subject, body, category, criteria);
  
  revalidatePath(`/school/messages`);
  return { success: true };
}

export async function sendMessageAction(conversationId: string, tenantId: string, body: string, contextPath: string) {
  const supabase = await createClient();
  const messagesService = new MessagesService(supabase);
  
  await messagesService.sendMessage(conversationId, tenantId, body);
  
  revalidatePath(contextPath);
  return { success: true };
}

export async function markConversationAsReadAction(conversationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
  }
}

export async function startParentToDirectorConversationAction(tenantId: string, subject: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Find the director(s) for this tenant
  const { data: directors } = await supabase
    .from('user_memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'director')
    .eq('status', 'active');
    
  if (!directors || directors.length === 0) {
    throw new Error("No director found for this institution");
  }
  
  const recipientIds = directors.map(d => d.user_id);
  const messagesService = new MessagesService(supabase);
  
  const conv = await messagesService.createConversation(tenantId, subject, 'general', recipientIds);
  await messagesService.sendMessage(conv.id, tenantId, body);
  
  revalidatePath(`/parent/messages`);
  return { success: true, conversationId: conv.id };
}
