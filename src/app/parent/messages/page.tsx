import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConversationsAction } from "@/app/actions/messages";
import { ParentMessagesClient } from "./messages-client";
import { unstable_noStore as noStore } from "next/cache";

export const metadata = {
  title: "Messages — Paylix",
  description: "Votre messagerie avec l'établissement scolaire.",
};

export default async function ParentMessagesPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get active parent membership + tenant info
  const { data: memberships } = await supabase
    .from("user_memberships")
    .select("tenant_id, tenants(id, name, city)")
    .eq("user_id", user.id)
    .eq("role", "parent")
    .eq("status", "active");

  if (!memberships || memberships.length === 0) redirect("/login");

  const activeMembership = memberships[0];
  const tenantRaw = activeMembership.tenants;
  const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
  const tenantId = activeMembership.tenant_id;
  const tenantName = (tenant as any)?.name ?? "L'établissement";

  const conversations = await getConversationsAction(tenantId);

  return (
    <ParentMessagesClient
      initialConversations={conversations}
      tenantId={tenantId}
      tenantName={tenantName}
      userId={user.id}
    />
  );
}
