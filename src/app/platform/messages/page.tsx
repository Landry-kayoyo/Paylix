import { createClient } from "@/lib/supabase/server";
import { PlatformMessagesClient } from "./messages-client";
import { MessagesService } from "@/lib/messages";

export default async function PlatformMessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non authentifié</div>;

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["platform_admin"]);

  if (!membership || membership.length === 0) return <div>Accès refusé.</div>;

  const messagesService = new MessagesService(supabase);
  // Platform admin gets all conversations they are part of
  // For platform admin, tenantId might be null in conversations they created, or specific if they contacted a director.
  // We'll pass a dummy tenantId or allow the service to fetch all for the user.
  
  const { data: convData, error } = await supabase
      .from('conversation_participants')
      .select(`
        last_read_at,
        archived_at,
        conversations!inner(
          id, subject, category, updated_at, tenant_id,
          messages(
            id, body, created_at, sender_id
          )
        )
      `)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('updated_at', { referencedTable: 'conversations', ascending: false });

  return (
    <PlatformMessagesClient 
      initialConversations={convData || []} 
      userId={user.id}
    />
  );
}
