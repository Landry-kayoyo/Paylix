import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as xlsx from "xlsx";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 500;
const REQUIRED_COLS = ["Nom", "Prénom", "Sexe", "Date de naissance"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { class_id, school_year_id, file_base64 } = body;

  if (!class_id || !school_year_id || !file_base64) {
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

  // Verify class is linked to year in this tenant
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

  // Parse and validate file size
  const buffer = Buffer.from(file_base64, "base64");
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Le fichier dépasse la taille maximale autorisée (5 Mo)." }, { status: 400 });
  }

  let wb: xlsx.WorkBook;
  try {
    wb = xlsx.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return NextResponse.json({ error: "Fichier Excel invalide ou corrompu." }, { status: 400 });
  }

  // Read data sheet
  const ws = wb.Sheets["Données"] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    return NextResponse.json({ error: "Feuille « Données » introuvable dans le fichier." }, { status: 400 });
  }

  const matrix: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const headerIndex = matrix.findIndex((row) => REQUIRED_COLS.every((column) => row.includes(column)));
  if (headerIndex < 0) {
    return NextResponse.json({ error: "En-têtes obligatoires introuvables dans la feuille « Données »." }, { status: 400 });
  }

  const headers = matrix[headerIndex].map((header: unknown) => String(header ?? "").trim());
  const rows: any[] = matrix
    .slice(headerIndex + 1)
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
    .filter((row: any) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));

  if (rows.length === 0) return NextResponse.json({ error: "Le fichier est vide." }, { status: 400 });
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Le fichier contient trop de lignes (max ${MAX_ROWS}).` }, { status: 400 });
  }

  // Fetch all existing students for matching
  const { data: existingStudents } = await supabase
    .from("students")
    .select("id, matricule, first_name, last_name, post_name, date_of_birth, gender, student_enrollments(id, class_id, school_year_id)")
    .eq("tenant_id", tenantId);

  const students = existingStudents || [];

  const preview = {
    new_students: [] as any[],
    unchanged_existing: [] as any[],
    changed_existing: [] as any[],
    ambiguous: [] as any[],
    class_conflicts: [] as any[],
    errors: [] as any[],
  };

  const seenInFile = new Set<string>(); // to detect in-file duplicates

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = headerIndex + i + 2;

    // Sanitize each field to prevent formula injection
    const nom = sanitize(row["Nom"]);
    const postnom = sanitize(row["Postnom"] || "");
    const prenom = sanitize(row["Prénom"]);
    const sexe = sanitize(row["Sexe"]).toUpperCase();
    const rawDob = row["Date de naissance"];
    const dob = normalizeExcelDate(rawDob);

    // Validate required fields
    if (!nom || !prenom) {
      preview.errors.push({ line: lineNum, message: "Nom ou Prénom manquant (champ obligatoire)." });
      continue;
    }

    if (rawDob === null || rawDob === undefined || String(rawDob).trim() === "") {
      preview.errors.push({ line: lineNum, message: "Date de naissance manquante (champ obligatoire)." });
      continue;
    }

    // Validate gender
    if (sexe !== "M" && sexe !== "F") {
      preview.errors.push({ line: lineNum, message: `Sexe invalide « ${sexe} » — doit être M ou F.` });
      continue;
    }

    if (!dob) {
      preview.errors.push({ line: lineNum, message: "Format de date invalide — utilisez JJ/MM/AAAA, par exemple 10/02/2015." });
      continue;
    }

    // Check in-file duplicates
    const fileKey = `${nom.toLowerCase()}|${prenom.toLowerCase()}|${dob}`;
    if (seenInFile.has(fileKey)) {
      preview.errors.push({ line: lineNum, message: `Doublon dans le fichier : ${nom} ${prenom} (${dob}).` });
      continue;
    }
    seenInFile.add(fileKey);

    // Match against existing students
    const matches = students.filter(s => {
      const nameMatch = s.last_name.toLowerCase() === nom.toLowerCase();
      const firstNameMatch = s.first_name.toLowerCase() === prenom.toLowerCase();
      const dobMatch = s.date_of_birth === dob;
      const postnomMatch = !postnom || !s.post_name || s.post_name.toLowerCase() === postnom.toLowerCase();
      return nameMatch && firstNameMatch && dobMatch && postnomMatch;
    });

    if (matches.length > 1) {
      preview.ambiguous.push({
        line: lineNum, nom, prenom,
        message: "Correspondance ambiguë avec plusieurs élèves existants — vérification manuelle requise.",
      });
      continue;
    }

    if (matches.length === 1) {
      const student = matches[0];
      const activeEnrollment = (student.student_enrollments as any[]).find(
        (e: any) => e.school_year_id === school_year_id
      );

      // Class conflict: student already enrolled in different class this year
      if (activeEnrollment && activeEnrollment.class_id !== class_id) {
        preview.class_conflicts.push({
          line: lineNum,
          student_id: student.id,
          matricule: student.matricule,
          nom, prenom,
          current_class_id: activeEnrollment.class_id,
          import_class_id: class_id,
          message: "Élève déjà inscrit dans une autre classe pour cette année.",
        });
        continue;
      }

      // Check for data changes
      const changes: any[] = [];
      if (student.gender !== sexe) changes.push({ field: "Sexe", old: student.gender, new: sexe });
      if (postnom && student.post_name && student.post_name.toLowerCase() !== postnom.toLowerCase()) {
        changes.push({ field: "Postnom", old: student.post_name, new: postnom });
      }

      if (changes.length > 0) {
        preview.changed_existing.push({ line: lineNum, student_id: student.id, matricule: student.matricule, nom, prenom, changes });
      } else {
        preview.unchanged_existing.push({ line: lineNum, student_id: student.id, matricule: student.matricule, nom, postnom: student.post_name || "", prenom });
      }
    } else {
      // Brand new student
      preview.new_students.push({ line: lineNum, nom, postnom, prenom, sexe, dob });
    }
  }

  return NextResponse.json({ success: true, preview });
}

function sanitize(val: any): string {
  const s = String(val || "").trim();
  // Prevent Excel formula injection
  if (s.startsWith("=") || s.startsWith("+") || s.startsWith("-") || s.startsWith("@")) {
    return s.substring(1);
  }
  return s;
}

function normalizeExcelDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) return formatIsoDate(parsed.y, parsed.m, parsed.d);
  }

  const text = sanitize(value);
  const european = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (european) return buildValidatedDate(european[3], european[2], european[1]);

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return buildValidatedDate(iso[1], iso[2], iso[3]);

  return null;
}

function buildValidatedDate(yearText: string, monthText: string, dayText: string): string | null {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return formatIsoDate(year, month, day);
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}
