"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unstable_noStore as noStore } from "next/cache";

export interface PaymentAllocationData {
  id: string;
  amount: number;
  currency: string;
  obligation_id: string;
  obligation_school_year_id: string;
  obligation_school_year_name: string;
  obligation_school_year_status: string;
  fee_name: string | null;
  fee_period: number | null;
  is_prior_debt: boolean;
}

export interface PaymentCurrencyEntry {
  currency: string;
  amount: number;
  receipt_id: string | null;
  receipt_number: string | null;
  payment_id: string;
}

export interface PaymentHistoryItem {
  id: string;
  payment_group_id: string | null;
  student_id: string;
  student_name: string;
  amount: number;
  currency: string;
  payment_date: string;
  status: string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  receipt_id: string | null;
  receipt_number: string | null;
  currencies: PaymentCurrencyEntry[];
  allocations: PaymentAllocationData[];
}

export interface ParentHistoryFilters {
  tenantId?: string;
  studentId?: string;
  schoolYearId?: string;
  currency?: string;
  page?: number;
  limit?: number;
}

export interface ParentHistoryResult {
  payments: PaymentHistoryItem[];
  total: number;
  children: { id: string; name: string }[];
  schoolYears: { id: string; name: string }[];
  currencies: string[];
}

function firstRelationValue<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getParentPaymentHistory(
  filters: ParentHistoryFilters
): Promise<ParentHistoryResult | null> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Verify parent membership
  const { data: memberships } = await supabase
    .from("user_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("role", "parent")
    .eq("status", "active");

  if (!memberships || memberships.length === 0) return null;

  const targetTenantId = filters.tenantId || memberships[0].tenant_id;
  if (!memberships.find((m) => m.tenant_id === targetTenantId)) return null;

  // Get parent profile for this tenant
  const { data: parent } = await supabase
    .from("parents")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_id", targetTenantId)
    .single();

  if (!parent) return null;

  // Get authorized children
  const { data: links } = await supabase
    .from("parent_students")
    .select(
      `
      student_id,
      students (
        id, first_name, last_name, post_name
      )
    `
    )
    .eq("parent_id", parent.id)
    .eq("tenant_id", targetTenantId)
    .is("ended_at", null);

  if (!links || links.length === 0) {
    return {
      payments: [],
      total: 0,
      children: [],
      schoolYears: [],
      currencies: [],
    };
  }

  const authorizedStudentIds = links.map((l: any) => l.student_id);

  const childrenFilterIds =
    filters.studentId && filters.studentId !== "all"
      ? [filters.studentId]
      : authorizedStudentIds;

  // Ensure filtered student is actually authorized
  const validStudentIds = childrenFilterIds.filter((id) =>
    authorizedStudentIds.includes(id)
  );
  if (validStudentIds.length === 0) return null;

  const childrenList = links.map((l: any) => {
    const s = l.students;
    const name = [s.first_name, s.post_name, s.last_name]
      .filter(Boolean)
      .join(" ");
    return { id: s.id, name };
  });

  // Base query with payment_group_id
  let query = supabaseAdmin
    .from("payments")
    .select(
      `
      id, student_id, amount, currency, payment_date, status,
      cancellation_reason, cancelled_at, payment_group_id,
      students (first_name, post_name, last_name),
      receipts (id, receipt_number),
      payment_allocations (
        id, amount, obligation_id,
        financial_obligations (
          school_year_id,
          currency,
          fees (name),
          fee_schedules (month),
          school_years (name, status)
        )
      )
    `
    )
    .eq("tenant_id", targetTenantId)
    .in("student_id", validStudentIds);

  // Filter by school year
  if (filters.schoolYearId && filters.schoolYearId !== "all") {
    const { data: allocs } = await supabaseAdmin
      .from("payment_allocations")
      .select("payment_id, financial_obligations!inner(school_year_id)")
      .eq("tenant_id", targetTenantId)
      .eq("financial_obligations.school_year_id", filters.schoolYearId);

    if (allocs) {
      const ids = allocs.map((a) => a.payment_id);
      query = query.in(
        "id",
        ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]
      );
    }
  }

  const { data: rawPayments } = await query.order("payment_date", {
    ascending: false,
  });

  if (!rawPayments) {
    return {
      payments: [],
      total: 0,
      children: childrenList,
      schoolYears: [],
      currencies: [],
    };
  }

  // Group by payment_group_id
  const groupMap = new Map<string, any[]>();
  for (const p of rawPayments) {
    const key = p.payment_group_id || p.id;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(p);
  }

  // Filter by currency
  const filteredGroups = Array.from(groupMap.values()).filter((group) => {
    if (!filters.currency || filters.currency === "all") return true;
    return group.some((p) => p.currency === filters.currency);
  });

  // Pagination
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const total = filteredGroups.length;
  const paginatedGroups = filteredGroups.slice(
    (page - 1) * limit,
    page * limit
  );

  const payments: PaymentHistoryItem[] = paginatedGroups.map((group) => {
    const sorted = [...group].sort(
      (a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );
    const primary = sorted[0];

    const student = firstRelationValue(primary.students);
    const studentName = student
      ? [student.first_name, student.post_name, student.last_name]
          .filter(Boolean)
          .join(" ")
      : "Élève inconnu";

    const allAllocations: PaymentAllocationData[] = [];
    for (const p of group) {
      const allocationsList = Array.isArray(p.payment_allocations)
        ? p.payment_allocations
        : [];
      for (const a of allocationsList) {
        const fo = firstRelationValue(a.financial_obligations);
        const sy = fo ? firstRelationValue(fo.school_years) : null;
        const fee = fo ? firstRelationValue(fo.fees) : null;
        const schedule = fo ? firstRelationValue(fo.fee_schedules) : null;
        const isPriorDebt = sy?.status === "archived";

        allAllocations.push({
          id: a.id,
          amount: Number(a.amount),
          currency: fo?.currency || p.currency,
          obligation_id: a.obligation_id,
          obligation_school_year_id: fo?.school_year_id || "",
          obligation_school_year_name: sy?.name || "Année inconnue",
          obligation_school_year_status: sy?.status || "unknown",
          fee_name: fee?.name || "Frais inconnu",
          fee_period: schedule?.month ?? null,
          is_prior_debt: isPriorDebt,
        });
      }
    }

    const currencyTotals = new Map<string, number>();
    for (const p of group) {
      currencyTotals.set(p.currency, (currencyTotals.get(p.currency) || 0) + Number(p.amount));
    }
    for (const a of allAllocations) {
      if (!group.some((p) => p.currency === a.currency)) {
        currencyTotals.set(a.currency, (currencyTotals.get(a.currency) || 0) + a.amount);
      }
    }

    const currencyEntries: PaymentCurrencyEntry[] = Array.from(currencyTotals.entries()).map(([currency, amount]) => {
      const matchingPayment = group.find((p) => p.currency === currency) || primary;
      const receipt = firstRelationValue(matchingPayment.receipts) || firstRelationValue(primary.receipts);
      return {
        currency,
        amount,
        receipt_id: receipt?.id || null,
        receipt_number: receipt?.receipt_number || null,
        payment_id: matchingPayment.id,
      };
    });

    const primaryReceipt = currencyEntries.find((e) => e.receipt_id) || currencyEntries[0];


    const globalStatus =
      group.every((p) => p.status === "cancelled") ? "cancelled" : primary.status;

    return {
      id: primary.payment_group_id || primary.id,
      payment_group_id: primary.payment_group_id || null,
      student_id: primary.student_id,
      student_name: studentName,
      amount: Number(primary.amount),
      currency: primary.currency,
      payment_date: primary.payment_date,
      status: globalStatus,
      cancellation_reason: primary.cancellation_reason,
      cancelled_at: primary.cancelled_at,
      receipt_id: primaryReceipt?.receipt_id || null,
      receipt_number: primaryReceipt?.receipt_number || null,
      currencies: currencyEntries,
      allocations: allAllocations,
    };
  });

  const { data: filterContext } = await supabaseAdmin
    .from("financial_obligations")
    .select("currency, school_years!inner(id, name, start_date)")
    .eq("tenant_id", targetTenantId)
    .in("student_id", authorizedStudentIds);

  const yearsMap = new Map<string, { id: string; name: string; start_date: string }>();
  const currenciesSet = new Set<string>();

  if (filterContext) {
    filterContext.forEach((fc) => {
      currenciesSet.add(fc.currency);
      const sy = firstRelationValue(fc.school_years);
      if (sy && !yearsMap.has(sy.id)) {
        yearsMap.set(sy.id, { id: sy.id, name: sy.name, start_date: sy.start_date });
      }
    });
  }

  const schoolYearsList = Array.from(yearsMap.values())
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    )
    .map((sy) => ({ id: sy.id, name: sy.name }));

  const currenciesList = Array.from(currenciesSet);

  return {
    payments,
    total,
    children: childrenList,
    schoolYears: schoolYearsList,
    currencies: currenciesList,
  };
}
