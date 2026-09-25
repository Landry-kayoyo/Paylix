'use server'

import { createClient } from '@/lib/supabase/server'
import * as xlsx from 'xlsx-js-style'
import { z } from 'zod'
import { buildImportTemplateWorkbook, writeImportTemplateWorkbook } from '@/lib/excel/template'

export { buildImportTemplateWorkbook, writeImportTemplateWorkbook } from '@/lib/excel/template'

export async function generateImportTemplate(tenantId: string, classId: string, className: string, schoolYearName: string) {
  const supabase = await createClient()
  
  // Verify auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) return { error: 'Établissement introuvable.' }

  const wb = buildImportTemplateWorkbook({
    tenantName: tenant.name,
    className,
    schoolYearName,
    generatedAt: new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  })

  const buffer = await writeImportTemplateWorkbook(wb)
  const base64 = buffer.toString('base64')
  
  return { success: true, fileData: base64, fileName: `Modele_Import_Eleves_${className.replace(/\s+/g, '_')}.xlsx` }
}

const ImportSchema = z.object({
  tenant_id: z.string().uuid(),
  class_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
  file_base64: z.string(),
})

export async function previewExcelImport(data: z.infer<typeof ImportSchema>) {
  // Validate, parse and return preview
  try {
    const supabase = await createClient()

    // 1. Parse Excel
    const buffer = Buffer.from(data.file_base64, 'base64')
    const wb = xlsx.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets["Données"] || wb.Sheets[wb.SheetNames[0]]
    const rows = (xlsx.utils.sheet_to_json(ws, { raw: false }) as Record<string, unknown>[]).filter((row) =>
      ['Nom', 'Postnom', 'Prénom', 'Sexe', 'Date de naissance'].some((column) => String(row[column] ?? '').trim() !== '')
    )

    if (rows.length === 0) return { error: 'Le fichier est vide.' }

    // Validate columns
    const firstRow = rows[0]
    const requiredCols = ["Nom", "Prénom", "Sexe", "Date de naissance"]
    for (const col of requiredCols) {
      if (!(col in firstRow)) return { error: `Colonne manquante : ${col}` }
    }

    // 2. Fetch existing students in this tenant
    const { data: existingStudents } = await supabase
      .from('students')
      .select('*, student_enrollments(*)')
      .eq('tenant_id', data.tenant_id)
      .eq('status', 'active')

    const students = existingStudents || []

    const previewData = {
      new_students: [] as any[],
      unchanged_existing: [] as any[],
      changed_existing: [] as any[],
      ambiguous: [] as any[],
      class_conflicts: [] as any[],
      errors: [] as any[]
    }

    let lineNum = 1
    for (const row of rows) {
      lineNum++
      const nom = (row["Nom"] || "").toString().trim()
      const postnom = (row["Postnom"] || "").toString().trim()
      const prenom = (row["Prénom"] || "").toString().trim()
      const sexe = (row["Sexe"] || "").toString().trim().toUpperCase()
      const rawDob = (row["Date de naissance"] || "").toString().trim()
      const dob = normalizeImportDate(rawDob)

      if (!nom || !prenom || !dob) {
        previewData.errors.push({ line: lineNum, message: "Nom, Prénom ou Date de naissance manquant." })
        continue
      }

      // Format validation
      if (sexe !== 'M' && sexe !== 'F') {
        previewData.errors.push({ line: lineNum, message: "Sexe invalide (doit être M ou F)." })
        continue
      }
      
      if (!dob) {
        previewData.errors.push({ line: lineNum, message: "Format de date invalide (JJ/MM/AAAA requis)." })
         continue
      }

      // Matching logic
      const matches = students.filter(s => 
        s.first_name.toLowerCase() === prenom.toLowerCase() &&
        s.last_name.toLowerCase() === nom.toLowerCase() &&
        (!postnom || !s.post_name || s.post_name.toLowerCase() === postnom.toLowerCase()) &&
        s.date_of_birth === dob
      )

      if (matches.length > 1) {
        previewData.ambiguous.push({ line: lineNum, nom, prenom, message: "Correspondance ambiguë avec plusieurs élèves existants." })
      } else if (matches.length === 1) {
        const student = matches[0]
        const activeEnrollment = student.student_enrollments.find((e: any) => e.school_year_id === data.school_year_id)
        
        let hasChanges = false
        const changes = []

        if (student.gender !== sexe) {
          hasChanges = true
          changes.push({ field: 'Sexe', old: student.gender, new: sexe })
        }
        
        if (student.post_name !== postnom && postnom !== "") {
          hasChanges = true
          changes.push({ field: 'Postnom', old: student.post_name, new: postnom })
        }

        if (activeEnrollment && activeEnrollment.class_id !== data.class_id) {
          previewData.class_conflicts.push({
            line: lineNum,
            student_id: student.id,
            matricule: student.matricule,
            nom, prenom,
            current_class_id: activeEnrollment.class_id,
            import_class_id: data.class_id,
            message: "Appartient actuellement à une autre classe pour cette année."
          })
          continue
        }

        if (hasChanges) {
          previewData.changed_existing.push({
            line: lineNum,
            student_id: student.id,
            matricule: student.matricule,
            nom, prenom,
            changes
          })
        } else {
          previewData.unchanged_existing.push({
            line: lineNum,
            student_id: student.id,
            matricule: student.matricule,
            nom, prenom
          })
        }
      } else {
        // New student
        previewData.new_students.push({
          line: lineNum,
          nom, postnom, prenom, sexe, dob
        })
      }
    }

    return { success: true, preview: previewData }

  } catch (error: any) {
    console.error("Preview error:", error)
    return { error: "Erreur lors de la lecture du fichier Excel." }
  }
}

function normalizeImportDate(value: string) {
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    if (date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) {
      return `${year}-${month}-${day}`
    }
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return iso ? value : null
}

const ExecuteImportSchema = z.object({
  tenant_id: z.string().uuid(),
  class_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
  new_students: z.array(z.any()),
  // We can add changed existing etc. later
})

export async function executeExcelImport(data: z.infer<typeof ExecuteImportSchema>) {
  const supabase = await createClient()

  // For each new student, we create them transactionally
  const enrollmentYear = new Date().getFullYear().toString()
  const yearPrefix = enrollmentYear.substring(2)
  
  let successCount = 0
  let errorCount = 0

  for (const st of data.new_students) {
    const { error } = await supabase.rpc('create_student_with_enrollment', {
      p_tenant_id: data.tenant_id,
      p_first_name: st.prenom,
      p_last_name: st.nom,
      p_post_name: st.postnom || null,
      p_date_of_birth: st.dob,
      p_gender: st.sexe,
      p_school_year_id: data.school_year_id,
      p_class_id: data.class_id,
      p_year_prefix: yearPrefix
    })

    if (error) {
      console.error("Error importing student:", error)
      errorCount++
    } else {
      successCount++
    }
  }

  return { success: true, successCount, errorCount }
}
