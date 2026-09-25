import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export default async function DirectorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non authentifié</div>;

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["director"])
    .single();

  if (!membership?.tenant_id) return <div>Accès refusé.</div>;
  const tenantId = membership.tenant_id;

  // Fetch Total Students
  const { count: totalStudents } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  // Fetch Financial Totals using RPC
  const { data: totalsData } = await supabase
    .rpc("get_dashboard_totals", { p_tenant_id: tenantId });

  let expectedFees = { CDF: 0, USD: 0 };
  let receivedPayments = { CDF: 0, USD: 0 };
  let remainingBalance = { CDF: 0, USD: 0 };

  if (totalsData) {
    for (const row of totalsData) {
      const cur = row.currency === "USD" ? "USD" : "CDF";
      expectedFees[cur] += Number(row.total_expected) || 0;
      receivedPayments[cur] += Number(row.total_received) || 0;
      remainingBalance[cur] += Number(row.total_remaining) || 0;
    }
  }

  // Fetch Recent Payments — fetch more to allow grouping, then take top 5 groups
  const { data: recentPaymentsDb } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      currency,
      status,
      created_at,
      payment_date,
      student_id,
      payment_group_id,
      student:students ( first_name, last_name, post_name ),
      profiles:recorded_by ( first_name, last_name )
    `)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Group payments by payment_group_id or ID if null
  const groupMap = new Map<string, any>();
  for (const p of recentPaymentsDb || []) {
    const groupKey = p.payment_group_id || p.id;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        id: p.id, // Using first payment's ID to link to details
        student: p.student,
        student_id: p.student_id,
        status: p.status,
        created_at: p.created_at,
        payment_date: p.payment_date,
        profiles: p.profiles,
        amounts: [],
      });
    }
    groupMap.get(groupKey).amounts.push({ amount: p.amount, currency: p.currency, id: p.id });
    // If any entry in group is confirmed, mark group confirmed
    if (p.status === 'confirmed') groupMap.get(groupKey).status = 'confirmed';
  }
  const recentPayments = Array.from(groupMap.values()).slice(0, 5);

  // Fetch data for the chart (Payments vs Obligations) using RPC
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const { data: monthlyStats } = await supabase
    .rpc("get_dashboard_monthly_stats", { p_tenant_id: tenantId, p_year: currentYear });

  const months = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
  const chartData: Array<{
    month: string;
    attenduUSD: number;
    encaissementsUSD: number;
    attenduCDF: number;
    encaissementsCDF: number;
  }> = [];
  
  for (let i = 0; i < 12; i++) {
    chartData.push({ 
      month: months[i], 
      attenduUSD: 0, 
      encaissementsUSD: 0,
      attenduCDF: 0, 
      encaissementsCDF: 0 
    });
  }
  
  if (monthlyStats) {
    monthlyStats.forEach((stat: any) => {
      const mIdx = stat.stat_month - 1;
      if (mIdx >= 0 && mIdx < 12) {
        if (stat.currency === 'USD') {
          chartData[mIdx].attenduUSD += Number(stat.total_expected) || 0;
          chartData[mIdx].encaissementsUSD += Number(stat.total_received) || 0;
        } else if (stat.currency === 'CDF') {
          chartData[mIdx].attenduCDF += Number(stat.total_expected) || 0;
          chartData[mIdx].encaissementsCDF += Number(stat.total_received) || 0;
        }
      }
    });
  }

  // Show from January up to the next month for better visibility
  const finalChartData = chartData.slice(0, Math.min(12, currentMonth + 2));

  const initialData = {
    tenantId,
    totalStudents: totalStudents || 0,
    expectedFees,
    receivedPayments,
    remainingBalance,
    recentPayments,
    chartData: finalChartData,
  };

  return <DashboardClient initialData={initialData} />;
}
