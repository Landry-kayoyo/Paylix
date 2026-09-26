import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';
import { ParentAudienceService, AudienceCriteria } from './parent-audience';

type SupabaseClient = ReturnType<typeof createClient>;

export class MessagesService {
  constructor(private supabase: SupabaseClient) {}

  async createConversation(tenantId: string, subject: string, category: string, recipientIds: string[]) {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data: conv, error: convError } = await this.supabase
      .from('conversations')
      .insert({
        tenant_id: tenantId,
        subject,
        category,
        created_by: userData.user.id
      })
      .select('id')
      .single();

    if (convError) throw convError;

    const participants = [userData.user.id, ...recipientIds].map(id => ({
      conversation_id: conv.id,
      user_id: id,
    }));

    const { error: partError } = await this.supabase
      .from('conversation_participants')
      .insert(participants);

    if (partError) throw partError;

    return conv;
  }

  async sendMessage(conversationId: string, tenantId: string, body: string) {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userData.user.id,
        tenant_id: tenantId,
        body
      })
      .select('*')
      .single();

    if (error) throw error;
    
    // Update conversation updated_at
    await this.supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  }

  async sendBroadcast(
    tenantId: string,
    schoolYearId: string,
    subject: string,
    body: string,
    category: string,
    criteria: AudienceCriteria
  ) {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const audienceService = new ParentAudienceService(this.supabase);
    const { recipientIds, count } = await audienceService.calculateAudience(criteria);

    if (count === 0) {
      throw new Error('Aucun destinataire ne correspond à ces critères.');
    }

    // 1. Create the campaign record
    const { data: campaign, error: campaignError } = await this.supabase
      .from('message_campaigns')
      .insert({
        tenant_id: tenantId,
        created_by: userData.user.id,
        subject,
        body,
        category,
        targeting_criteria: JSON.parse(JSON.stringify(criteria)),
        recipient_count: count
      })
      .select('id')
      .single();

    if (campaignError) throw campaignError;

    // 2. Create individual conversations for each recipient
    // (For performance, we might want a batch RPC if there are 1000+ parents)
    for (const recipientId of recipientIds) {
      const conv = await this.createConversation(tenantId, subject, category, [recipientId]);
      await this.sendMessage(conv.id, tenantId, body);
    }

    return campaign;
  }

  async getConversations(tenantId: string) {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('conversation_participants')
      .select(`
        last_read_at,
        archived_at,
        conversations!inner(
          id, subject, category, updated_at,
          messages(
            id, body, created_at, sender_id
          )
        )
      `)
      .eq('user_id', userData.user.id)
      .eq('conversations.tenant_id', tenantId)
      .is('archived_at', null)
      .order('updated_at', { referencedTable: 'conversations', ascending: false });

    if (error) throw error;
    return data;
  }
}
