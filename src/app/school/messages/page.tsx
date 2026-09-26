import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConversationsAction } from "@/app/actions/messages";
import { DirectorMessagesClient } from "./messages-client";
import { unstable_noStore as noStore } from "next/cache";

export const metadata = {
  title: "Messages — Paylix",
  description: "Messagerie interne de l'établissement.",
};

export interface ParentOption {
  userId: string;
  fullName: string;
  email: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
}

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

  // Active school year
  const { data: schoolYear } = await supabase
    .from("school_years")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  const conversations = await getConversationsAction(tenantId);

  // Fetch all parents for targeting (user_id + name)
  const { data: parentsData } = await supabase
    .from("parents")
    .select("user_id, full_name, email")
    .eq("tenant_id", tenantId)
    .eq("account_status", "active");

  const parentOptions: ParentOption[] = (parentsData ?? []).map((p: any) => ({
    userId: p.user_id,
    fullName: p.full_name,
    email: p.email,
  }));

  // Fetch all active classes
  const { data: classesData } = await supabase
    .from("classes")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");

  const classOptions: ClassOption[] = (classesData ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <DirectorMessagesClient
      initialConversations={conversations}
      tenantId={tenantId}
      userId={user.id}
      schoolYearId={schoolYear?.id ?? null}
      parentOptions={parentOptions}
      classOptions={classOptions}
    />
  );
}
