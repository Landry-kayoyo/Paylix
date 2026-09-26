import { createClient } from "@/lib/supabase/server";
import { ParentMessagesClient } from "./messages-client";
import { MessagesService } from "@/lib/messages";

export default async function ParentMessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non authentifié</div>;

  // En mode multi-tenant, le parent a un espace actif (tenantId). 
  // Dans cet exemple on prend le premier tenant actif.
  const { data: memberships } = await supabase
    .from("user_memberships")
    .select("tenant_id, tenants(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["parent"]);

  if (!memberships || memberships.length === 0) return <div>Accès refusé.</div>;
  const activeTenantId = memberships[0].tenant_id;
  const tenantsField = memberships[0].tenants;
  const tenantName = (Array.isArray(tenantsField) ? tenantsField[0]?.name : (tenantsField as any)?.name) || "L'établissement";

  const messagesService = new MessagesService(supabase);
  const initialConversations = await messagesService.getConversations(activeTenantId);

  return (
    <ParentMessagesClient 
      initialConversations={initialConversations} 
      tenantId={activeTenantId}
      tenantName={tenantName}
      userId={user.id}
    />
  );
}
