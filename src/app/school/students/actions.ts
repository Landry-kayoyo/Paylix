"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ─── Helper ──────────────────────────────────────────────────────────────────

async function getActorTenant(allowedRoles: string[] = ["director", "platform_admin"]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", allowedRoles)
    .single();

  if (!membership?.tenant_id) {
    throw new Error("Accès refusé.");
  }

  return { supabase, user, tenantId: membership.tenant_id, role: membership.role };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentItem {
  id: string;
  tenant_id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  post_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  status: "active" | "archived";
  created_at: string;
  current_enrollment?: {
    id: string;
    school_year_id: string;
    school_year_name: string;
    class_id: string;
    class_name: string;
  } | null;
}

export interface ClassSimple {
  id: string;
  name: string;
}

export interface SchoolYearSimple {
  id: string;
  name: string;
  status: string;
}

export interface EnrollmentHistoryItem {
  id: string;
  enrollment_id: string;
  old_class_name: string;
  new_class_name: string;
  changed_at: string;
}

// ─── Fetch Data ───────────────────────────────────────────────────────────────

export async function getStudentsData(page = 1, pageSize = 25, filters?: {
  search?: string;
  schoolYearId?: string;
  classId?: string;
  gender?: string;
  status?: string;
}) {
  const { supabase, tenantId } = await getActorTenant(["director", "accountant", "platform_admin"]);

  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("students")
    .select(`
      id, tenant_id, matricule, first_name, last_name, post_name,
      date_of_birth, gender, status, created_at,
      student_enrollments (
        id, school_year_id, class_id,
        school_years (name),
        classes (name)
      )
    `, { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("last_name", { ascending: true });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  } else if (!filters?.status) {
    query = query.eq("status", "active");
  }

  if (filters?.search) {
    const s = filters.search;
    query = query.or(`last_name.ilike.%${s}%,first_name.ilike.%${s}%,post_name.ilike.%${s}%,matricule.ilike.%${s}%`);
  }

  if (filters?.gender && filters.gender !== "all") {
    query = query.eq("gender", filters.gender);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Erreur lors de la récupération des élèves: ${error.message}`);

  // Flatten enrollments
  let students: StudentItem[] = (data || []).map((s: any) => {
    const enrollments = s.student_enrollments || [];
    const currentEnrollment = enrollments[enrollments.length - 1] || null;

    return {
      id: s.id,
      tenant_id: s.tenant_id,
      matricule: s.matricule,
      first_name: s.first_name,
      last_name: s.last_name,
      post_name: s.post_name,
      date_of_birth: s.date_of_birth,
      gender: s.gender,
      status: s.status as "active" | "archived",
      created_at: s.created_at,
      current_enrollment: currentEnrollment ? {
        id: currentEnrollment.id,
        school_year_id: currentEnrollment.school_year_id,
        school_year_name: (currentEnrollment.school_years as any)?.name || "",
        class_id: currentEnrollment.class_id,
        class_name: (currentEnrollment.classes as any)?.name || "",
      } : null,
    };
  });

  if (filters?.classId) {
    students = students.filter((student) => student.current_enrollment?.class_id === filters.classId);
  }

  const total = students.length;
  const from = offset;
  const to = offset + pageSize;
  const paginatedStudents = students.slice(from, to);

  // Fetch active school year and classes for filters/forms
  const { data: years } = await supabase
    .from("school_years")
    .select("id, name, status")
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false });

  const activeYear = (years || []).find(y => y.status === "active") || null;

  // Get classes linked to active year
  let classes: ClassSimple[] = [];
  if (activeYear) {
    const { data: classLinks, error: classLinksError } = await supabase
      .from("class_school_years")
      .select("class_id")
      .eq("tenant_id", tenantId)
      .eq("school_year_id", activeYear.id);

    if (classLinksError) {
      throw new Error(`Erreur lors de la récupération des associations classe/année: ${classLinksError.message}`);
    }

    const classIds = [...new Set((classLinks || []).map((link) => link.class_id))];
    if (classIds.length > 0) {
      const { data: linkedClasses, error: linkedClassesError } = await supabase
        .from("classes")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .in("id", classIds)
        .order("name", { ascending: true });

      if (linkedClassesError) {
        throw new Error(`Erreur lors de la récupération des classes: ${linkedClassesError.message}`);
      }

      classes = (linkedClasses || []) as ClassSimple[];
    }
  }

  return {
    students: paginatedStudents,
    total,
    page,
    pageSize,
    years: (years || []) as SchoolYearSimple[],
    activeYear,
    classes,
  };
}

export async function getStudentById(studentId: string) {
  const { supabase, tenantId } = await getActorTenant(["director", "accountant", "platform_admin"]);

  const { data, error } = await supabase
    .from("students")
    .select(`
      id, tenant_id, matricule, first_name, last_name, post_name,
      date_of_birth, gender, status, created_at,
      student_enrollments (
        id, school_year_id, class_id, status, created_at,
        school_years (name),
        classes (name)
      )
    `)
    .eq("id", studentId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getEnrollmentHistory(enrollmentId: string) {
  const { supabase, tenantId } = await getActorTenant(["director", "accountant", "platform_admin"]);

  const { data, error } = await supabase
    .from("enrollment_history")
    .select(`
      id, enrollment_id, changed_at,
      old_class:old_class_id (name),
      new_class:new_class_id (name)
    `)
    .eq("enrollment_id", enrollmentId)
    .eq("tenant_id", tenantId)
    .order("changed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getStudentFinancialObligations(studentId: string) {
  const { supabase, tenantId } = await getActorTenant(["director", "accountant", "platform_admin"]);

  const { data, error } = await supabase
    .from("financial_obligations")
    .select(`
      id,
      initial_amount,
      paid_amount,
      remaining_amount,
      currency,
      status,
      due_date,
      fees (name),
      fee_schedules (month)
    `)
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((obligation: any) => ({
    id: obligation.id,
    feeName: obligation.fees?.name || "Frais",
    feeSchedule: obligation.fee_schedules?.month || null,
    initialAmount: Number(obligation.initial_amount || 0),
    paidAmount: Number(obligation.paid_amount || 0),
    remainingAmount: Number(obligation.remaining_amount || 0),
    currency: obligation.currency || "CDF",
    status: obligation.status || "unpaid",
    dueDate: obligation.due_date,
  }));
}

export async function getClassesForActiveYear() {
  const { supabase, tenantId } = await getActorTenant(["director", "accountant", "platform_admin"]);

  const { data: years } = await supabase
    .from("school_years")
    .select("id, name, status")
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false });

  const activeYear = (years || []).find((year) => year.status === "active") || null;

  let classes: ClassSimple[] = [];
  if (activeYear) {
    const { data: links } = await supabase
      .from("class_school_years")
      .select("class_id, classes(id, name)")
      .eq("tenant_id", tenantId)
      .eq("school_year_id", activeYear.id);

    classes = (links || [])
      .map((link: any) => link.classes)
      .filter(Boolean)
      .map((item: any) => ({ id: item.id, name: item.name }));
  }

  return { activeYear, classes };
}

// ─── Create Student ───────────────────────────────────────────────────────────

const createStudentSchema = z.object({
  first_name: z.string().min(1, "Le prénom est requis"),
  last_name: z.string().min(1, "Le nom est requis"),
  post_name: z.string().optional().nullable(),
  date_of_birth: z.string().min(1, "La date de naissance est requise"),
  gender: z.enum(["M", "F"], { message: "Le sexe doit être M ou F" }),
  class_id: z.string().uuid("Une classe doit être sélectionnée"),
  school_year_id: z.string().uuid("L'année scolaire est requise"),
});

export async function createStudent(data: z.infer<typeof createStudentSchema>) {
  const { supabase, tenantId } = await getActorTenant(["director", "platform_admin"]);
  const validated = createStudentSchema.parse(data);

  // Verify class belongs to this tenant and is linked to the given year
  const { data: classLink } = await supabase
    .from("class_school_years")
    .select("class_id")
    .eq("tenant_id", tenantId)
    .eq("class_id", validated.class_id)
    .eq("school_year_id", validated.school_year_id)
    .single();

  if (!classLink) {
    return { success: false, error: "Classe non valide pour cette année scolaire." };
  }

  // Year prefix from current calendar year
  const yearPrefix = new Date().getFullYear().toString().substring(2);

  try {
    const { data: studentId, error } = await supabase.rpc("create_student_with_enrollment", {
      p_tenant_id: tenantId,
      p_first_name: validated.first_name,
      p_last_name: validated.last_name,
      p_post_name: validated.post_name || null,
      p_date_of_birth: validated.date_of_birth,
      p_gender: validated.gender,
      p_school_year_id: validated.school_year_id,
      p_class_id: validated.class_id,
      p_year_prefix: yearPrefix,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/school/students");
    return { success: true, studentId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Update Student ───────────────────────────────────────────────────────────

const updateStudentSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().min(1, "Le prénom est requis"),
  last_name: z.string().min(1, "Le nom est requis"),
  post_name: z.string().optional().nullable(),
  date_of_birth: z.string().min(1, "La date de naissance est requise"),
  gender: z.enum(["M", "F"]),
});

export async function updateStudent(data: z.infer<typeof updateStudentSchema>) {
  const { supabase, tenantId } = await getActorTenant(["director", "platform_admin"]);
  const validated = updateStudentSchema.parse(data);

  try {
    const { error } = await supabase
      .from("students")
      .update({
        first_name: validated.first_name,
        last_name: validated.last_name,
        post_name: validated.post_name || null,
        date_of_birth: validated.date_of_birth,
        gender: validated.gender,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.id)
      .eq("tenant_id", tenantId);

    if (error) throw new Error(error.message);

    revalidatePath("/school/students");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Enroll Student ───────────────────────────────────────────────────────────

const enrollSchema = z.object({
  student_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
  class_id: z.string().uuid(),
});

export async function enrollStudent(data: z.infer<typeof enrollSchema>) {
  const { supabase, tenantId } = await getActorTenant(["director", "platform_admin"]);
  const validated = enrollSchema.parse(data);

  // Verify student belongs to tenant
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", validated.student_id)
    .eq("tenant_id", tenantId)
    .single();

  if (!student) return { success: false, error: "Élève non trouvé." };

  try {
    const { error } = await supabase
      .from("student_enrollments")
      .insert({
        tenant_id: tenantId,
        student_id: validated.student_id,
        school_year_id: validated.school_year_id,
        class_id: validated.class_id,
      });

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "Cet élève est déjà inscrit pour cette année scolaire." };
      }
      throw new Error(error.message);
    }

    revalidatePath("/school/students");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Change Class ─────────────────────────────────────────────────────────────

const changeClassSchema = z.object({
  enrollment_id: z.string().uuid(),
  old_class_id: z.string().uuid(),
  new_class_id: z.string().uuid(),
});

export async function changeStudentClass(data: z.infer<typeof changeClassSchema>) {
  const { supabase, tenantId, user } = await getActorTenant(["director", "platform_admin"]);
  const validated = changeClassSchema.parse(data);

  const { data: enrollment } = await supabase
    .from("student_enrollments")
    .select("id, student_id, class_id, school_year_id, tenant_id")
    .eq("id", validated.enrollment_id)
    .eq("tenant_id", tenantId)
    .single();

  if (!enrollment) return { success: false, error: "Inscription non trouvée." };

  if (enrollment.class_id === validated.new_class_id) {
    return { success: false, error: "La classe choisie est déjà affectée à cette inscription." };
  }

  try {
    const { error: updateError } = await supabase
      .from("student_enrollments")
      .update({ class_id: validated.new_class_id, updated_at: new Date().toISOString() })
      .eq("id", validated.enrollment_id)
      .eq("tenant_id", tenantId);

    if (updateError) throw new Error(updateError.message);

    const { error: historyError } = await supabase.from("enrollment_history").insert({
      tenant_id: tenantId,
      enrollment_id: validated.enrollment_id,
      old_class_id: validated.old_class_id,
      new_class_id: validated.new_class_id,
      changed_by: user.id,
    });

    if (historyError) throw new Error(historyError.message);

    revalidatePath("/school/students");
    revalidatePath(`/school/students/${enrollment.student_id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Archive Student ──────────────────────────────────────────────────────────

export async function archiveStudent(studentId: string) {
  const { supabase, tenantId } = await getActorTenant(["director", "platform_admin"]);

  try {
    const { error } = await supabase
      .from("students")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", studentId)
      .eq("tenant_id", tenantId);

    if (error) throw new Error(error.message);

    revalidatePath("/school/students");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
