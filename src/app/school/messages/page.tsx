import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConversationsAction } from "@/app/actions/messages";
import { DirectorMessagesClient } from "./messages-client";
import { unstable_noStore as noStore } from "next/cache";

export const metadata = {
  title: "Messages — Paylix",
  description: "Messagerie interne de l'établissement.",
};

export default async function DirectorMessagesPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["director", "accountant"])
    .single();

  if (!membership?.tenant_id) redirect("/login");

  const tenantId = membership.tenant_id;

  // Get school year for broadcast targeting
  const { data: schoolYear } = await supabase
    .from("school_years")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  const conversations = await getConversationsAction(tenantId);

  return (
    <DirectorMessagesClient
      initialConversations={conversations}
      tenantId={tenantId}
      userId={user.id}
      schoolYearId={schoolYear?.id ?? null}
    />
  );
}
