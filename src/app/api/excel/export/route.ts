import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as xlsx from "xlsx";

function sanitizeCell(val: any): string {
  const s = String(val || "").trim();
  // Prevent formula injection
  if (s.startsWith("=") || s.startsWith("+") || s.startsWith("-") || s.startsWith("@")) {
    return "'" + s;
  }
  return s;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { class_id, school_year_id } = body;

  if (!school_year_id) {
    return NextResponse.json({ error: "school_year_id est requis." }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["director", "accountant", "platform_admin"])
    .single();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tenantId = membership.tenant_id;

  // Fetch tenant info
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  // Fetch school year
  const { data: schoolYear } = await supabase
    .from("school_years")
    .select("name")
    .eq("id", school_year_id)
    .eq("tenant_id", tenantId)
    .single();

  if (!schoolYear) {
    return NextResponse.json({ error: "Année scolaire non trouvée." }, { status: 404 });
  }

  // Build query for enrollments
  let query = supabase
    .from("student_enrollments")
    .select(`
      student_id,
      classes(name),
      students(matricule, last_name, post_name, first_name, gender, date_of_birth, status)
    `)
    .eq("tenant_id", tenantId)
    .eq("school_year_id", school_year_id);

  if (class_id) {
    // Also verify class belongs to this tenant
    const { data: classCheck } = await supabase
      .from("classes")
      .select("id")
      .eq("id", class_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!classCheck) {
      return NextResponse.json({ error: "Classe non autorisée." }, { status: 403 });
    }

    query = query.eq("class_id", class_id);
  }

  const { data: enrollments, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const className = class_id
    ? (enrollments?.[0]?.classes as any)?.name || "Toutes classes"
    : "Toutes classes";

  // Build workbook
  const wb = xlsx.utils.book_new();

  // Header rows
  const headerRows: any[][] = [
    [`PAYLIX — LISTE DES ÉLÈVES`],
    [`Établissement : ${tenant?.name || ""}`],
    [`Année scolaire : ${schoolYear.name}`],
    [`Classe : ${className}`],
    [`Exporté le : ${new Date().toLocaleDateString("fr-FR")}`],
    [],
    ["Matricule", "Nom", "Postnom", "Prénom", "Sexe", "Date de naissance", "Classe", "Statut"],
  ];

  const dataRows = (enrollments || []).map((e: any) => {
    const s = e.students as any;
    const cl = e.classes as any;
    return [
      sanitizeCell(s?.matricule),
      sanitizeCell(s?.last_name),
      sanitizeCell(s?.post_name || ""),
      sanitizeCell(s?.first_name),
      sanitizeCell(s?.gender),
      s?.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString("fr-FR") : "",
      sanitizeCell(cl?.name || ""),
      s?.status === "active" ? "Actif" : "Archivé",
    ];
  });

  const ws = xlsx.utils.aoa_to_sheet([...headerRows, ...dataRows]);
  ws["!cols"] = [
    { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 10 }
  ];
  xlsx.utils.book_append_sheet(wb, ws, "Élèves");

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  const safeClass = className.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Eleves_${schoolYear.name}_${safeClass}.xlsx"`,
    },
  });
}
