import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConversationsAction } from "@/app/actions/messages";
import { PlatformMessagesClient } from "./messages-client";
import { unstable_noStore as noStore } from "next/cache";

export const metadata = {
  title: "Messages — Paylix Admin",
  description: "Messagerie de la plateforme Paylix.",
};

export default async function PlatformMessagesPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("role", "platform_admin")
    .maybeSingle();

  if (!membership) redirect("/login");

  // Platform admin: get all conversations they participate in (no tenant filter)
  const { data: convData } = await supabase
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

  const conversations = (convData ?? []).map((row: any) => {
    const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations;
    if (!conv) return null;
    const msgs = Array.isArray(conv.messages) ? conv.messages : [];
    msgs.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const is_unread = !row.last_read_at || new Date(conv.updated_at) > new Date(row.last_read_at);
    return {
      id: conv.id,
      subject: conv.subject,
      category: conv.category,
      updated_at: conv.updated_at,
      last_read_at: row.last_read_at,
      is_unread,
      messages: msgs,
    };
  }).filter(Boolean);

  return (
    <PlatformMessagesClient
      initialConversations={conversations as any}
      userId={user.id}
    />
  );
}
