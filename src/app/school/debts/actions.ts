"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

async function getDirectorTenant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("role", "director")
    .eq("status", "active")
    .single();

  if (!membership || !membership.tenant_id) {
    throw new Error("Accès refusé : espace réservé aux directeurs d'établissement.");
  }

  return { supabase, user, tenantId: membership.tenant_id };
}

export interface PriorDebtItem {
  student_id: string;
  student_name: string;
  student_matricule: string;
  school_year_id: string;
  school_year_name: string;
  currency: string;
  initial_amount: number;
  remaining_amount: number;
  status: 'OPEN' | 'SETTLED';
}

export async function getPriorDebts(
  page = 1,
  limit = 25,
  filters: { yearId?: string, currency?: string, status?: string, search?: string } = {}
) {
  const { supabase, tenantId } = await getDirectorTenant();

  // The view prior_debts returns the debts. We need to join with students and school_years
  let query = supabase
    .from("prior_debts")
    .select(`
      currency,
      initial_amount,
      remaining_amount,
      status,
      student_id,
      school_year_id,
      students!inner (
        matricule,
        first_name,
        last_name
      ),
      school_years!inner (
        name
      )
    `, { count: "exact" })
    .eq("tenant_id", tenantId);

  if (filters.yearId) {
    query = query.eq("school_year_id", filters.yearId);
  }
  if (filters.currency) {
    query = query.eq("currency", filters.currency);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  // Handle pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des dettes: ${error.message}`);
  }

  // Map the results
  let results: PriorDebtItem[] = (data || []).map((row: any) => ({
    student_id: row.student_id,
    student_name: `${row.students.first_name} ${row.students.last_name}`,
    student_matricule: row.students.matricule,
    school_year_id: row.school_year_id,
    school_year_name: row.school_years.name,
    currency: row.currency,
    initial_amount: row.initial_amount,
    remaining_amount: row.remaining_amount,
    status: row.status,
  }));

  if (filters.search) {
    const s = filters.search.toLowerCase();
    results = results.filter(r => 
      r.student_name.toLowerCase().includes(s) || 
      r.student_matricule.toLowerCase().includes(s)
    );
  }

  // Fetch all archived years for filter
  const { data: archivedYears } = await supabase
    .from("school_years")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("status", "archived")
    .order("start_date", { ascending: false });

  return {
    debts: results,
    total: filters.search ? results.length : (count || 0),
    archivedYears: archivedYears || []
  };
}
