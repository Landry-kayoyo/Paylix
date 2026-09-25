"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getReceiptDetails } from "@/app/actions/receipts";
import { unstable_noStore as noStore } from "next/cache";

/** Handles Supabase returning joined relations as either object or array */
function firstRelationValue<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParentTenantInfo {
  tenantId: string;
  tenantName: string;
  tenantCity: string | null;
  tenantLogo: string | null;
  parentId: string;
  accountStatus: string;
}

export interface FinancialObligation {
  id: string;
  fee_id: string;
  fee_name: string | null;
  initial_amount: number;
  paid_amount: number;
  remaining_amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  period: number | null;
}

export interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  payment_date: string;
  status: string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  receipt?: {
    id: string;
    receipt_number: string;
    verification_token: string;
    issued_at: string;
  } | null;
  currencies?: { currency: string; amount: number }[];
}

export interface ParentDashboardData {
  parent: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    account_status: string;
    activated_at: string | null;
  };
  tenant: {
    id: string;
    name: string;
    city: string | null;
    logo_url: string | null;
    description: string | null;
  };
  children: {
    id: string;
    student_id: string;
    relationship: string | null;
    student: {
      id: string;
      matricule: string;
      first_name: string;
      last_name: string;
      post_name: string | null;
      current_class: string | null;
      current_year: string | null;
      class_id: string | null;
      school_year_id: string | null;
    };
    obligations: FinancialObligation[];
    payments: PaymentData[];
  }[];
  // All establishments this parent belongs to (for switch)
  allTenants: ParentTenantInfo[];
}

// ─── Get all parent tenants (for switch menu) ─────────────────────────────────

export async function getParentAllTenants(): Promise<ParentTenantInfo[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Get all active parent memberships
  const { data: memberships } = await supabase
    .from("user_memberships")
    .select("tenant_id, role, status")
    .eq("user_id", user.id)
    .eq("role", "parent")
    .eq("status", "active");

  if (!memberships || memberships.length === 0) return [];

  const tenantIds = memberships.map((m) => m.tenant_id);

  // Fetch all parent records for these tenants
  const { data: parents } = await supabase
    .from("parents")
    .select("id, tenant_id, account_status")
    .eq("user_id", user.id)
    .in("tenant_id", tenantIds);

  // Fetch tenant info
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, city, logo_url")
    .in("id", tenantIds);

  return (parents || []).map((p) => {
    const t = (tenants || []).find((x) => x.id === p.tenant_id);
    return {
      tenantId: p.tenant_id,
      tenantName: t?.name || "Établissement",
      tenantCity: t?.city || null,
      tenantLogo: t?.logo_url || null,
      parentId: p.id,
      accountStatus: p.account_status,
    };
  });
}

// ─── Get Parent Dashboard Data ────────────────────────────────────────────────

export async function getParentDashboardData(
  tenantId?: string
): Promise<ParentDashboardData | null> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // All memberships as parent
  const { data: memberships } = await supabase
    .from("user_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("role", "parent")
    .eq("status", "active");

  if (!memberships || memberships.length === 0) return null;

  // Select the requested tenant or default to first
  const targetTenantId =
    tenantId && memberships.find((m) => m.tenant_id === tenantId)
      ? tenantId
      : memberships[0].tenant_id;

  // Get parent profile for the target tenant
  const { data: parent, error: parentError } = await supabase
    .from("parents")
    .select(
      `
      id, full_name, email, phone, address,
      account_status, activated_at
    `
    )
    .eq("user_id", user.id)
    .eq("tenant_id", targetTenantId)
    .single();

  if (parentError || !parent) return null;

  // Auto-activate if first login after invitation
  if (parent.account_status === "invited") {
    const { error: updateError } = await supabase
      .from("parents")
      .update({ account_status: "active", activated_at: new Date().toISOString() })
      .eq("id", parent.id);

    if (!updateError) {
      parent.account_status = "active";
      parent.activated_at = new Date().toISOString();
    }
  }

  // Get tenant info
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, city, logo_url, description")
    .eq("id", targetTenantId)
    .single();

  // Get children (active associations only)
  const { data: links } = await supabase
    .from("parent_students")
    .select(
      `
      id, student_id, relationship,
      students (
        id, matricule, first_name, last_name, post_name, status,
        student_enrollments (
          id, class_id, school_year_id, status,
          classes (name),
          school_years (name)
        )
      )
    `
    )
    .eq("parent_id", parent.id)
    .eq("tenant_id", targetTenantId)
    .is("ended_at", null)
    .order("created_at", { ascending: true });

  const studentIds = (links || []).map((l: any) => l.student_id);

  // Fetch all financial obligations for these students
  const { data: obligationsData } = await supabaseAdmin
    .from("financial_obligations")
    .select(
      `
      id, student_id, fee_id, initial_amount, paid_amount, remaining_amount, currency, status, due_date,
      fees (name),
      fee_schedules (month)
    `
    )
    .in("student_id", studentIds)
    .eq("tenant_id", targetTenantId);

  // Fetch all payments for these students
  const { data: paymentsData } = await supabaseAdmin
    .from("payments")
    .select(
      `
      id, student_id, amount, currency, payment_date, status, cancellation_reason, cancelled_at, payment_group_id,
      receipts (id, receipt_number, verification_token, issued_at),
      payment_allocations (
        amount,
        financial_obligations (currency)
      )
    `
    )
    .in("student_id", studentIds)
    .eq("tenant_id", targetTenantId)
    .order("payment_date", { ascending: false });

  const children = (links || []).map((link: any) => {
    const student = link.students;
    const enrollments = (student?.student_enrollments || []).filter(
      (e: any) => e.status === "active" || !e.status
    );
    const latest = enrollments[enrollments.length - 1] || null;

    const studentObligations = (obligationsData || [])
      .filter((o: any) => o.student_id === student.id)
      .map((o: any) => {
        const feeObj = firstRelationValue(o.fees);
        const scheduleObj = firstRelationValue(o.fee_schedules);
        return {
          id: o.id,
          fee_id: o.fee_id,
          fee_name: feeObj?.name?.trim() || null,
          initial_amount: Number(o.initial_amount),
          paid_amount: Number(o.paid_amount),
          remaining_amount: Number(o.remaining_amount),
          currency: o.currency,
          status: o.status,
          due_date: o.due_date,
          period: scheduleObj?.month ?? null,
        };
      });

    const rawStudentPayments = (paymentsData || []).filter((p: any) => p.student_id === student.id);
    const groupMap = new Map<string, any[]>();
    for (const p of rawStudentPayments) {
      const key = p.payment_group_id || p.id;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(p);
    }

    const studentPayments = Array.from(groupMap.values()).map((group) => {
      const sorted = [...group].sort(
        (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      );
      const primary = sorted[0];
      const receipt = Array.isArray(primary.receipts) ? primary.receipts[0] : primary.receipts;
      
      const currencyTotals = new Map<string, number>();
      for (const p of group) {
        currencyTotals.set(p.currency, (currencyTotals.get(p.currency) || 0) + Number(p.amount));
      }
      for (const p of group) {
        const allocs = Array.isArray(p.payment_allocations) ? p.payment_allocations : [];
        for (const a of allocs) {
          const fo = firstRelationValue(a.financial_obligations);
          const allocCurrency = fo?.currency || p.currency;
          if (!group.some(gp => gp.currency === allocCurrency)) {
            currencyTotals.set(allocCurrency, (currencyTotals.get(allocCurrency) || 0) + Number(a.amount));
          }
        }
      }

      const currencies = Array.from(currencyTotals.entries()).map(([currency, amount]) => ({
        currency,
        amount
      }));

      return {
        id: primary.payment_group_id || primary.id,
        amount: Number(primary.amount),
        currency: primary.currency,
        payment_date: primary.payment_date,
        status: group.every(p => p.status === "cancelled") ? "cancelled" : primary.status,
        cancellation_reason: primary.cancellation_reason,
        cancelled_at: primary.cancelled_at,
        receipt: receipt || null,
        currencies: currencies,
      };
    });

    return {
      id: link.id,
      student_id: link.student_id,
      relationship: link.relationship,
      student: {
        id: student.id,
        matricule: student.matricule,
        first_name: student.first_name,
        last_name: student.last_name,
        post_name: student.post_name,
        current_class: latest?.classes?.name || null,
        current_year: latest?.school_years?.name || null,
        class_id: latest?.class_id || null,
        school_year_id: latest?.school_year_id || null,
      },
      obligations: studentObligations,
      payments: studentPayments,
    };
  });

  // All tenants for the switch UI
  const tenantIds = memberships.map((m) => m.tenant_id);
  const { data: allParents } = await supabase
    .from("parents")
    .select("id, tenant_id, account_status")
    .eq("user_id", user.id)
    .in("tenant_id", tenantIds);
  const { data: allTenantInfos } = await supabase
    .from("tenants")
    .select("id, name, city, logo_url")
    .in("id", tenantIds);

  const allTenants: ParentTenantInfo[] = (allParents || []).map((p) => {
    const t = (allTenantInfos || []).find((x) => x.id === p.tenant_id);
    return {
      tenantId: p.tenant_id,
      tenantName: t?.name || "Établissement",
      tenantCity: t?.city || null,
      tenantLogo: t?.logo_url || null,
      parentId: p.id,
      accountStatus: p.account_status,
    };
  });

  return {
    parent,
    tenant: tenant || { id: targetTenantId, name: "Établissement", city: null, logo_url: null, description: null },
    children,
    allTenants,
  };
}

export async function getParentReceiptDetails(receiptId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: memberships } = await supabase
    .from("user_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("role", "parent")
    .eq("status", "active");

  const tenantIds = (memberships || []).map((membership) => membership.tenant_id);
  if (tenantIds.length === 0) return { error: "Forbidden" };

  const { data: receipt } = await supabase
    .from("receipts")
    .select("tenant_id, payments (student_id)")
    .eq("id", receiptId)
    .in("tenant_id", tenantIds)
    .maybeSingle();

  const payment = Array.isArray(receipt?.payments) ? receipt.payments[0] : receipt?.payments;
  if (!receipt || !payment?.student_id) return { error: "Reçu introuvable" };

  const { data: parent } = await supabase
    .from("parents")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_id", receipt.tenant_id)
    .maybeSingle();

  if (!parent) return { error: "Forbidden" };

  const { data: relationship } = await supabase
    .from("parent_students")
    .select("id")
    .eq("parent_id", parent.id)
    .eq("student_id", payment.student_id)
    .is("ended_at", null)
    .maybeSingle();

  if (!relationship) return { error: "Forbidden" };
  return getReceiptDetails(receiptId);
}
