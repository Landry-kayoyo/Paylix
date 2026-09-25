import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { class_id, school_year_id, new_students, changed_existing } = body;

  if (!class_id || !school_year_id) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["director", "platform_admin"])
    .single();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tenantId = membership.tenant_id;

  // Verify class belongs to tenant and school year
  const { data: classLink } = await supabase
    .from("class_school_years")
    .select("class_id")
    .eq("tenant_id", tenantId)
    .eq("class_id", class_id)
    .eq("school_year_id", school_year_id)
    .single();

  if (!classLink) {
    return NextResponse.json({ error: "Classe non autorisée pour cette année scolaire." }, { status: 403 });
  }

  const yearPrefix = new Date().getFullYear().toString().substring(2);
  let successCount = 0;
  let errorCount = 0;

  // Create new students transactionally via RPC
  for (const st of (new_students || [])) {
    const { error } = await supabase.rpc("create_student_with_enrollment", {
      p_tenant_id: tenantId,
      p_first_name: st.prenom,
      p_last_name: st.nom,
      p_post_name: st.postnom || null,
      p_date_of_birth: st.dob,
      p_gender: st.sexe,
      p_school_year_id: school_year_id,
      p_class_id: class_id,
      p_year_prefix: yearPrefix,
    });

    if (error) {
      console.error("Import error:", error);
      errorCount++;
    } else {
      successCount++;
    }
  }

  // Apply changes to existing students
  for (const s of (changed_existing || [])) {
    for (const change of s.changes) {
      if (change.field === "Sexe") {
        await supabase
          .from("students")
          .update({ gender: change.new, updated_at: new Date().toISOString() })
          .eq("id", s.student_id)
          .eq("tenant_id", tenantId);
      } else if (change.field === "Postnom") {
        await supabase
          .from("students")
          .update({ post_name: change.new, updated_at: new Date().toISOString() })
          .eq("id", s.student_id)
          .eq("tenant_id", tenantId);
      }
    }
  }

  return NextResponse.json({ success: true, successCount, errorCount });
}
