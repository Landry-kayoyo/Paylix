import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReenrollmentClient } from "./reenrollment-client";

export const metadata: Metadata = {
  title: "Réinscription des élèves | Paylix",
  description: "Réinscrire les élèves pour une nouvelle année scolaire",
};

export default async function ReenrollmentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["director"])
    .single();

  if (!membership || !membership.tenant_id) {
    redirect("/platform"); // Ou une page d'erreur
  }

  const tenantId = membership.tenant_id;

  // Récupérer toutes les années scolaires du tenant
  const { data: schoolYears } = await supabase
    .from("school_years")
    .select("id, name, status, start_date")
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false });

  // Récupérer les classes
  const { data: classLinks } = await supabase
    .from("class_school_years")
    .select("school_year_id, class_id, classes(id, name)")
    .eq("tenant_id", tenantId);

  // Formatter les classes par année scolaire pour le client
  const classesByYear: Record<string, Array<{ id: string; name: string }>> = {};
  
  if (classLinks) {
    classLinks.forEach((link: any) => {
      const yearId = link.school_year_id;
      if (!classesByYear[yearId]) {
        classesByYear[yearId] = [];
      }
      const cls = Array.isArray(link.classes) ? link.classes[0] : link.classes;
      if (cls) {
        classesByYear[yearId].push({ id: cls.id, name: cls.name });
      }
    });
  }

  // Trier les classes par nom
  for (const yearId in classesByYear) {
    classesByYear[yearId].sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-3 py-6 sm:px-6">
      <ReenrollmentClient
        schoolYears={schoolYears || []}
        classesByYear={classesByYear}
      />
    </div>
  );
}
