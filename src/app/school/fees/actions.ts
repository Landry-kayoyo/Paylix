"use server";

import { createClient } from "@/lib/supabase/server";
import { buildFeeObligationRows } from "@/lib/fee-obligation-builder";
import { z } from "zod";
import { revalidatePath } from "next/cache";

async function getActorTenant(roles: Array<"director" | "accountant"> = ["director"]) {
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

  return { supabase, user, tenantId: membership.tenant_id };
}

const databaseUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Identifiant invalide");

const feeInputSchema = z.object({
  id: databaseUuid.optional(),
  name: z.string().trim().min(2, "Le nom du frais est requis"),
  type: z.enum(["unique", "monthly"]),
  currency: z.enum(["CDF", "USD"]),
  default_amount: z.number().positive("Le montant doit être supérieur à 0"),
  classIds: z.array(databaseUuid).min(1, "Sélectionnez au moins une classe"),
  schedules: z.array(z.object({
    month: z.number().int().min(1).max(12),
    amount: z.number().positive(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })),
});

export interface FeeScheduleItem {
  id: string;
  month: number;
  amount: number;
  due_date: string | null;
}

export interface FeeItem {
  id: string;
  name: string;
  fee_type: "unique" | "monthly";
  currency: "CDF" | "USD";
  default_amount: number;
  status: string;
  school_year_id: string;
  fee_schedules: FeeScheduleItem[];
  classes: { id: string; name: string }[];
  has_obligations?: boolean;
}

export interface FeePageData {
  fees: FeeItem[];
  classes: { id: string; name: string }[];
  activeYear: { id: string; name: string; start_date: string; end_date: string } | null;
}

export async function getFeesData(): Promise<FeePageData> {
  const { supabase, tenantId } = await getActorTenant(["director", "accountant"]);
  const { data: activeYear, error: yearError } = await supabase
    .from("school_years")
    .select("id, name, start_date, end_date")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  if (yearError) throw new Error(yearError.message);

  if (!activeYear) return { fees: [], classes: [], activeYear: null };

  const { data: classLinks, error: classError } = await supabase
    .from("class_school_years")
    .select("class_id, classes(id, name)")
    .eq("tenant_id", tenantId)
    .eq("school_year_id", activeYear.id);
  if (classError) throw new Error(classError.message);

  const classes = (classLinks || []).map((link) => {
    const relatedClass = Array.isArray(link.classes) ? link.classes[0] : link.classes;
    return { id: link.class_id, name: relatedClass?.name || "Classe" };
  });

  const { data: fees, error: feeError } = await supabase
    .from("fees")
    .select("id, name, fee_type, currency, default_amount, status, school_year_id, fee_schedules(id, month, amount, due_date), fee_classes(class_id, classes(id, name))")
    .eq("tenant_id", tenantId)
    .eq("school_year_id", activeYear.id)
    .order("created_at", { ascending: false });
  if (feeError) throw new Error(feeError.message);

  const feeIds = (fees || []).map((fee) => fee.id);
  const { data: usedFees } = feeIds.length
    ? await supabase.from("financial_obligations").select("fee_id").eq("tenant_id", tenantId).in("fee_id", feeIds)
    : { data: [] as { fee_id: string }[] };
  const usedFeeIds = new Set((usedFees || []).map((item) => item.fee_id));

  return {
    activeYear,
    classes,
    fees: (fees || []).map((fee) => ({
      ...fee,
      fee_schedules: fee.fee_schedules || [],
      classes: (fee.fee_classes || []).map((link) => {
        const relatedClass = Array.isArray(link.classes) ? link.classes[0] : link.classes;
        return { id: link.class_id, name: relatedClass?.name || "Classe" };
      }),
      has_obligations: usedFeeIds.has(fee.id),
    })) as FeeItem[],
  };
}

export async function createFee(data: z.input<typeof feeInputSchema>) {
  const { supabase, tenantId, user } = await getActorTenant(["director"]);
  const validated = feeInputSchema.parse(data);
  const { data: activeYear } = await supabase.from("school_years").select("id").eq("tenant_id", tenantId).eq("status", "active").maybeSingle();
  if (!activeYear) throw new Error("Aucune année scolaire active n'est configurée.");

  const { data: fee, error } = await supabase
    .from("fees")
    .insert({
      tenant_id: tenantId,
      school_year_id: activeYear.id,
      name: validated.name,
      fee_type: validated.type,
      currency: validated.currency,
      default_amount: validated.default_amount,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { error: classError } = await supabase.from("fee_classes").insert(validated.classIds.map((class_id) => ({ tenant_id: tenantId, fee_id: fee.id, class_id })));
  if (classError) throw new Error(classError.message);
  let savedSchedules: { id: string; month: number; amount: number; due_date: string | null }[] = [];

  if (validated.type === "monthly") {
    const { data: schedules, error: scheduleError } = await supabase
      .from("fee_schedules")
      .insert(validated.schedules.map((schedule) => ({ tenant_id: tenantId, fee_id: fee.id, ...schedule })))
      .select("id, month, amount, due_date");

    if (scheduleError) throw new Error(scheduleError.message);
    savedSchedules = schedules || [];
  }

  const { data: activeEnrollments } = await supabase
    .from("student_enrollments")
    .select("id, student_id, class_id")
    .eq("tenant_id", tenantId)
    .eq("school_year_id", activeYear.id)
    .eq("status", "active")
    .in("class_id", validated.classIds);

  if ((activeEnrollments || []).length > 0) {
    const rows = buildFeeObligationRows({
      tenantId,
      schoolYearId: activeYear.id,
      feeId: fee.id,
      feeType: validated.type,
      currency: validated.currency,
      classIds: validated.classIds,
      defaultAmount: validated.default_amount,
      schedules: savedSchedules.length > 0 ? savedSchedules : validated.schedules.map((schedule) => ({ id: "", month: schedule.month, amount: schedule.amount, due_date: schedule.due_date })),
      enrollments: activeEnrollments || [],
    });

    if (rows.length > 0) {
      const { error: obligationError } = await supabase.from("financial_obligations").insert(rows);
      if (obligationError) {
        throw new Error(obligationError.message);
      }
    }
  }

  revalidatePath("/school/fees");
  return { success: true, fee };
}

export async function updateFee(data: z.input<typeof feeInputSchema>) {
  const { supabase, tenantId } = await getActorTenant(["director"]);
  const validated = feeInputSchema.required({ id: true }).parse(data);
  const { data: used } = await supabase.from("financial_obligations").select("id").eq("tenant_id", tenantId).eq("fee_id", validated.id).limit(1);
  const { data: activeYear } = await supabase.from("school_years").select("id").eq("tenant_id", tenantId).eq("status", "active").maybeSingle();
  const { error } = await supabase.from("fees").update({ name: validated.name, fee_type: used?.length ? undefined : validated.type, default_amount: validated.default_amount, currency: validated.currency, updated_at: new Date().toISOString() }).eq("id", validated.id).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  if (!used?.length) {
    await supabase.from("fee_classes").delete().eq("tenant_id", tenantId).eq("fee_id", validated.id);
    await supabase.from("fee_classes").insert(validated.classIds.map((class_id) => ({ tenant_id: tenantId, fee_id: validated.id, class_id })));
    if (validated.type === "monthly") {
      await supabase.from("fee_schedules").delete().eq("tenant_id", tenantId).eq("fee_id", validated.id);
      const { data: schedules } = await supabase.from("fee_schedules").insert(validated.schedules.map((schedule) => ({ tenant_id: tenantId, fee_id: validated.id, ...schedule }))).select("id, month, amount, due_date");
      if (activeYear) {
        const { data: activeEnrollments } = await supabase.from("student_enrollments").select("id, student_id, class_id").eq("tenant_id", tenantId).eq("school_year_id", activeYear.id).eq("status", "active").in("class_id", validated.classIds);
        const rows = buildFeeObligationRows({ tenantId, schoolYearId: activeYear.id, feeId: validated.id, feeType: "monthly", currency: validated.currency, classIds: validated.classIds, defaultAmount: validated.default_amount, schedules: schedules || validated.schedules.map((schedule) => ({ id: "", month: schedule.month, amount: schedule.amount, due_date: schedule.due_date })), enrollments: activeEnrollments || [] });
        if (rows.length > 0) {
          await supabase.from("financial_obligations").insert(rows);
        }
      }
    } else {
      await supabase.from("fee_schedules").delete().eq("tenant_id", tenantId).eq("fee_id", validated.id);
      if (activeYear) {
        const { data: activeEnrollments } = await supabase.from("student_enrollments").select("id, student_id, class_id").eq("tenant_id", tenantId).eq("school_year_id", activeYear.id).eq("status", "active").in("class_id", validated.classIds);
        const rows = buildFeeObligationRows({ tenantId, schoolYearId: activeYear.id, feeId: validated.id, feeType: "unique", currency: validated.currency, classIds: validated.classIds, defaultAmount: validated.default_amount, schedules: [], enrollments: activeEnrollments || [] });
        if (rows.length > 0) {
          await supabase.from("financial_obligations").insert(rows);
        }
      }
    }
  }
  revalidatePath("/school/fees");
  return { success: true, hasHistoricalObligations: Boolean(used?.length) };
}

export async function toggleFeeStatus(feeId: string, status: "active" | "inactive") {
  const { supabase, tenantId } = await getActorTenant(["director"]);
  const { error } = await supabase.from("fees").update({ status, updated_at: new Date().toISOString() }).eq("id", feeId).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/school/fees");
  return { success: true };
}

