import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as xlsx from "xlsx";

/**
 * POST /api/excel/detect
 *
 * Reads the header rows of a Paylix-exported Excel file and resolves
 * the embedded class name + school year name to their database IDs.
 * This enables "smart import" without the user having to manually
 * select the class/year again.
 *
 * Body: { file_base64: string }
 *
 * Returns:
 *   { detected: true, class_id, school_year_id, class_name, year_name }
 *   | { detected: false, reason: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const body = await req.json();
  const { file_base64 } = body;

  if (!file_base64) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }

  const buffer = Buffer.from(file_base64, "base64");
  if (buffer.byteLength > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 5 Mo)." }, { status: 400 });
  }

  let wb: xlsx.WorkBook;
  try {
    wb = xlsx.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "Fichier Excel invalide ou corrompu." }, { status: 400 });
  }

  // Try to read from the "Élèves" sheet (Paylix export format)
  // or fall back to the first sheet (import template "Données" sheet)
  const exportSheet = wb.Sheets["Élèves"];
  const importSheet = wb.Sheets["Données"];
  const ws = exportSheet || importSheet || wb.Sheets[wb.SheetNames[0]];

  if (!ws) {
    return NextResponse.json({ detected: false, reason: "Fichier vide ou sans feuille reconnue." });
  }

  // ── Read raw cell values from the Paylix export header format ──────────────
  // Row 1: "PAYLIX — LISTE DES ÉLÈVES"
  // Row 2: "Établissement : ..."
  // Row 3: "Année scolaire : ..."
  // Row 4: "Classe : ..."
  // Row 5: "Exporté le : ..."

  const getCellText = (row: number, col: string = "A"): string => {
    const cell = ws[`${col}${row}`];
    return cell ? String(cell.v || "").trim() : "";
  };

  const row3 = getCellText(3);
  const row4 = getCellText(4);

  const yearMatch = row3.match(/^Année scolaire\s*:\s*(.+)$/i);
  const classMatch = row4.match(/^Classe\s*:\s*(.+)$/i);

  const templateClassName = getCellText(3, "B").replace(/^Classe\s*:\s*/i, "");
  const templateYearName = getCellText(4, "B").replace(/^Année scolaire\s*:\s*/i, "");
  const detectedYearName = yearMatch?.[1]?.trim() || templateYearName;
  const detectedClassName = classMatch?.[1]?.trim() || templateClassName;

  if (!detectedYearName || !detectedClassName) {
    // Not a Paylix export — no metadata to detect
    return NextResponse.json({
      detected: false,
      reason: "Aucune métadonnée Paylix détectée dans le fichier (format libre).",
    });
  }

  const yearName = detectedYearName;
  const className = detectedClassName;

  // Skip "Toutes classes" — ambiguous, user must select manually
  if (className.toLowerCase() === "toutes classes") {
    return NextResponse.json({
      detected: false,
      reason: "Le fichier contient plusieurs classes — veuillez sélectionner la classe cible manuellement.",
    });
  }

  // Resolve year by name
  const { data: yearRow } = await supabase
    .from("school_years")
    .select("id, name, status")
    .eq("tenant_id", tenantId)
    .ilike("name", yearName)
    .single();

  if (!yearRow) {
    return NextResponse.json({
      detected: false,
      reason: `L'année scolaire « ${yearName} » n'a pas été trouvée dans votre établissement.`,
    });
  }

  // Resolve class by name
  const { data: classRow } = await supabase
    .from("classes")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .ilike("name", className)
    .single();

  if (!classRow) {
    return NextResponse.json({
      detected: false,
      reason: `La classe « ${className} » n'a pas été trouvée dans votre établissement.`,
    });
  }

  // Verify the class is linked to the year (class_school_years)
  const { data: link } = await supabase
    .from("class_school_years")
    .select("class_id")
    .eq("tenant_id", tenantId)
    .eq("class_id", classRow.id)
    .eq("school_year_id", yearRow.id)
    .maybeSingle();

  if (!link) {
    return NextResponse.json({
      detected: false,
      reason: `La classe « ${className} » n'est pas associée à l'année « ${yearName} » dans votre établissement.`,
    });
  }

  return NextResponse.json({
    detected: true,
    class_id: classRow.id,
    school_year_id: yearRow.id,
    class_name: classRow.name,
    year_name: yearRow.name,
    year_status: yearRow.status,
  });
}
