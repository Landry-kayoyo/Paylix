"use server";

import { createClient } from "@/lib/supabase/server";

async function getFinanceTenant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  const { data: membership } = await supabase.from("user_memberships").select("tenant_id, role").eq("user_id", user.id).eq("status", "active").in("role", ["director", "accountant"]).single();
  if (!membership?.tenant_id) throw new Error("Accès refusé.");
  return { supabase, tenantId: membership.tenant_id };
}

export interface ObligationItem {
  id: string;
  student_id: string;
  student_name: string;
  matricule: string;
  class_name: string;
  fee_name: string;
  fee_type: "unique" | "monthly";
  month: number | null;
  initial_amount: number;
  paid_amount: number;
  remaining_amount: number;
  currency: "CDF" | "USD";
  due_date: string | null;
  status: "unpaid" | "partial" | "paid" | "overdue" | "cancelled";
}

function firstRelationValue<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function mapObligationRow(item: any): ObligationItem {
  const student = firstRelationValue(item.students);
  const fee = firstRelationValue(item.fees);
  const enrollment = firstRelationValue(item.student_enrollments);
  const classItem = firstRelationValue(enrollment?.classes);
  const feeSchedule = firstRelationValue(item.fee_schedules);

  const result: ObligationItem = {
    id: item.id,
    student_id: item.student_id,
    student_name: student ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "Élève inconnu" : "Élève inconnu",
    matricule: student?.matricule || "-",
    class_name: classItem?.name || "-",
    fee_name: fee?.name || "Frais inconnu",
    fee_type: fee?.fee_type || "unique",
    month: feeSchedule?.month ?? null,
    initial_amount: Number(item.initial_amount),
    paid_amount: Number(item.paid_amount),
    remaining_amount: Number(item.remaining_amount),
    currency: item.currency,
    due_date: item.due_date,
    status: item.status,
  };

  return { ...result, status: displayStatus(result) };
}

function displayStatus(item: ObligationItem): ObligationItem["status"] {
  if (item.status === "paid" || item.status === "cancelled") return item.status;
  if (item.due_date && item.remaining_amount > 0 && new Date(item.due_date) < new Date(new Date().toDateString())) return "overdue";
  return item.status;
}

export async function getObligations(): Promise<ObligationItem[]> {
  const { supabase, tenantId } = await getFinanceTenant();
  const { data: activeYear, error: yearError } = await supabase.from("school_years").select("id").eq("tenant_id", tenantId).eq("status", "active").maybeSingle();
  if (yearError) throw new Error(yearError.message);
  if (!activeYear) return [];
  const { data, error } = await supabase.from("financial_obligations").select("id, student_id, initial_amount, paid_amount, remaining_amount, currency, due_date, status, students(first_name, last_name, matricule), fees(name, fee_type), fee_schedules(month), student_enrollments(classes(name))").eq("tenant_id", tenantId).order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((item) => mapObligationRow(item));
}
