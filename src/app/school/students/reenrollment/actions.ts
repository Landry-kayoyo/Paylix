"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { buildFeeObligationRows } from "@/lib/fee-obligation-builder";

async function getActorTenant(roles: Array<"director" | "platform_admin"> = ["director"]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", roles)
    .single();

  if (!membership || !membership.tenant_id) {
    throw new Error("Accès refusé pour ce rôle.");
  }

  return { supabase, user, tenantId: membership.tenant_id, role: membership.role };
}

export interface ReenrollmentCandidate {
  student_id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  post_name: string | null;
  status: string;
  already_enrolled: boolean;
  current_class_id: string;
}

export async function getReenrollmentCandidates(sourceYearId: string, sourceClassId: string, targetYearId: string): Promise<ReenrollmentCandidate[]> {
  const { supabase, tenantId } = await getActorTenant();

  // Validate source year belongs to tenant
  const { data: srcYear } = await supabase
    .from("school_years")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", sourceYearId)
    .single();

  if (!srcYear) throw new Error("Année source invalide pour cet établissement.");

  // Validate target year belongs to tenant
  const { data: tgtYear } = await supabase
    .from("school_years")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", targetYearId)
    .single();

  if (!tgtYear) throw new Error("Année cible invalide pour cet établissement.");

  // Get students enrolled in the source class and source year
  const { data: sourceEnrollments, error: sourceError } = await supabase
    .from("student_enrollments")
    .select(`
      student_id,
      class_id,
      students!inner (
        matricule,
        first_name,
        last_name,
        post_name,
        status
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("school_year_id", sourceYearId)
    .eq("class_id", sourceClassId)
    .eq("status", "active");

  if (sourceError) throw new Error(sourceError.message);

  if (!sourceEnrollments || sourceEnrollments.length === 0) return [];

  const studentIds = sourceEnrollments.map(e => e.student_id);

  // Check if they are already enrolled in the target year
  const { data: targetEnrollments, error: targetError } = await supabase
    .from("student_enrollments")
    .select("student_id")
    .eq("tenant_id", tenantId)
    .eq("school_year_id", targetYearId)
    .in("student_id", studentIds);

  if (targetError) throw new Error(targetError.message);

  const enrolledStudentIds = new Set((targetEnrollments || []).map(e => e.student_id));

  return sourceEnrollments.map(e => {
    const student = Array.isArray(e.students) ? e.students[0] : e.students;
    return {
      student_id: e.student_id,
      current_class_id: e.class_id,
      matricule: student.matricule,
      first_name: student.first_name,
      last_name: student.last_name,
      post_name: student.post_name,
      status: student.status,
      already_enrolled: enrolledStudentIds.has(e.student_id),
    };
  }).sort((a, b) => a.last_name.localeCompare(b.last_name));
}

const reenrollmentSchema = z.object({
  targetYearId: z.string().uuid(),
  sourceYearId: z.string().uuid(),
  enrollments: z.array(z.object({
    studentId: z.string().uuid(),
    targetClassId: z.string().uuid(),
  })).min(1, "Veuillez sélectionner au moins un élève à réinscrire."),
});

export async function executeReenrollment(data: z.infer<typeof reenrollmentSchema>) {
  const { supabase, tenantId, user } = await getActorTenant();
  const validated = reenrollmentSchema.parse(data);

  // 1. Verify target year
  const { data: targetYear, error: targetYearError } = await supabase
    .from("school_years")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", validated.targetYearId)
    .single();

  if (targetYearError || !targetYear) throw new Error("L'année cible est invalide.");

  // 2. Verify classes belong to tenant and target year
  const targetClassIds = [...new Set(validated.enrollments.map(e => e.targetClassId))];
  const { data: validClassLinks, error: validClassError } = await supabase
    .from("class_school_years")
    .select("class_id")
    .eq("tenant_id", tenantId)
    .eq("school_year_id", validated.targetYearId)
    .in("class_id", targetClassIds);

  if (validClassError) throw new Error(validClassError.message);

  const validClassIdsSet = new Set((validClassLinks || []).map(c => c.class_id));
  for (const classId of targetClassIds) {
    if (!validClassIdsSet.has(classId)) {
      throw new Error(`La classe cible ${classId} n'est pas disponible pour l'année cible.`);
    }
  }

  // 3. Verify students belong to tenant
  const studentIds = validated.enrollments.map(e => e.studentId);
  const { data: validStudents, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", studentIds);
  
  if (studentError) throw new Error(studentError.message);
  if (validStudents?.length !== studentIds.length) {
    throw new Error("Un ou plusieurs élèves n'appartiennent pas à cet établissement.");
  }

  // 4. Verify they are not already enrolled in target year
  const { data: existingEnrollments, error: existingError } = await supabase
    .from("student_enrollments")
    .select("student_id")
    .eq("tenant_id", tenantId)
    .eq("school_year_id", validated.targetYearId)
    .in("student_id", studentIds);

  if (existingError) throw new Error(existingError.message);
  if (existingEnrollments && existingEnrollments.length > 0) {
    throw new Error("Un ou plusieurs élèves sélectionnés sont déjà inscrits pour l'année cible. Veuillez rafraîchir la liste.");
  }

  // 5. Insert Enrollments
  const enrollmentsToInsert = validated.enrollments.map(e => ({
    tenant_id: tenantId,
    student_id: e.studentId,
    school_year_id: validated.targetYearId,
    class_id: e.targetClassId,
  }));

  const { data: insertedEnrollments, error: insertError } = await supabase
    .from("student_enrollments")
    .insert(enrollmentsToInsert)
    .select("id, student_id, class_id");

  if (insertError) {
    if (insertError.code === '23505') throw new Error("Duplication détectée lors de l'inscription.");
    throw new Error(insertError.message);
  }

  // 6. Generate Obligations is now handled automatically by the database trigger `on_student_enrollment_created`

  // 7. Audit log
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "create",
    resource_type: "batch_reenrollment",
    resource_id: validated.targetYearId,
    metadata: {
      source_year_id: validated.sourceYearId,
      target_year_id: validated.targetYearId,
      count: validated.enrollments.length
    }
  });

  revalidatePath("/school/students");
  return { success: true, count: validated.enrollments.length };
}
