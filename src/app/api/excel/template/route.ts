import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as xlsx from "xlsx-js-style";
import { buildImportTemplateWorkbook, writeImportTemplateWorkbook } from "@/lib/excel/template";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { class_id, class_name, school_year_name } = body;

    if (!class_id || !class_name) {
      return NextResponse.json({ error: "class_id and class_name are required" }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("user_memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["director", "accountant", "platform_admin"])
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: classLink } = await supabase
      .from("classes")
      .select("id")
      .eq("id", class_id)
      .eq("tenant_id", membership.tenant_id)
      .single();

    if (!classLink) {
      return NextResponse.json({ error: "Classe non autorisée" }, { status: 403 });
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", membership.tenant_id)
      .single();

    const wb = buildImportTemplateWorkbook({
      tenantName: tenant?.name || '',
      className: class_name,
      schoolYearName: school_year_name,
      generatedAt: new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    });

    const buffer = await writeImportTemplateWorkbook(wb);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Modele_Import_${class_name.replace(/\s+/g, "_")}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("excel/template route error", err);
    return NextResponse.json({ error: "Impossible de générer le modèle." }, { status: 500 });
  }
}
