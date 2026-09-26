import { createClient } from "@/lib/supabase/server";
import { MessagesClient } from "./messages-client";
import { MessagesService } from "@/lib/messages";

export default async function DirectorMessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non authentifié</div>;

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["director"])
    .single();

  if (!membership?.tenant_id) return <div>Accès refusé.</div>;
  const tenantId = membership.tenant_id;

  const messagesService = new MessagesService(supabase);
  const initialConversations = await messagesService.getConversations(tenantId);

  return (
    <MessagesClient 
      initialConversations={initialConversations} 
      tenantId={tenantId}
      userId={user.id}
    />
  );
}
