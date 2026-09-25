"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  PieChart,
  Loader2,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getDashboardStats, DashboardStats } from "@/app/actions/dashboard";
import { createClient } from "@/lib/supabase/client";

function fmtCDF(v: number) {
  return new Intl.NumberFormat("fr-FR").format(v) + " CDF";
}
function fmtUSD(v: number) {
  return "$" + new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(v);
}

export default function AccountantDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const loadStats = async () => {
    const res = await getDashboardStats();
    if (res.data) setStats(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Realtime: refresh data on any payment/obligation change
  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      const { data: membership } = await supabase
        .from('user_memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!membership?.tenant_id || !isMounted) return;
      const tenantId = membership.tenant_id;

      const channel = supabase
        .channel(`accountant-dashboard-${tenantId}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `tenant_id=eq.${tenantId}` }, async () => {
          if (!isMounted) return;
          setLoading(true);
          await loadStats();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_obligations', filter: `tenant_id=eq.${tenantId}` }, async () => {
          if (!isMounted) return;
          setLoading(true);
          await loadStats();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    let cleanup: (() => void) | undefined;
    setup().then(fn => { cleanup = fn; });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, []);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 pb-6 flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Encaissé ce mois (CDF)"
            value={fmtCDF(stats?.collected_month_cdf ?? 0)}
            icon={CreditCard}
            trendUp={true}
            highlight
          />
          <StatCard
            title="Encaissé ce mois (USD)"
            value={fmtUSD(stats?.collected_month_usd ?? 0)}
            icon={CreditCard}
            trendUp={true}
          />
          <StatCard
            title="Solde Restant (CDF)"
            value={fmtCDF(stats?.remaining_cdf ?? 0)}
            icon={Wallet}
            trendUp={false}
          />
          <StatCard
            title="Solde Restant (USD)"
            value={fmtUSD(stats?.remaining_cdf ?? 0)}
            icon={Wallet}
            trendUp={false}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Graphique encaissements — 7 derniers jours */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Encaissements — 7 derniers jours</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">Cette semaine</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats?.daily_chart || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={((v: number, name: string) => [
                      name === "CDF"
                        ? `${new Intl.NumberFormat("fr-FR").format(v)} CDF`
                        : `$${new Intl.NumberFormat("fr-FR").format(v)}`,
                      name === "CDF" ? "CDF" : "USD",
                    ]) as never}
                    cursor={{ fill: "#f0fdf4" }}
                  />
                  <Bar dataKey="cdf" name="CDF" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="usd" name="USD" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Legend formatter={(v) => v.toUpperCase()} iconSize={10} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Actions rapides */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Enregistrer un paiement", icon: CreditCard, href: "/accountant/payments/new" },
              { label: "Historique des Reçus", icon: FileText, href: "/accountant/receipts" },
              { label: "Rapports Financiers", icon: PieChart, href: "/accountant/reports" },
            
            ].map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="flex w-full justify-between items-center h-10 text-sm font-normal text-foreground hover:text-primary border border-border/60 rounded-xl px-4 hover:border-primary/50 group transition-colors"
              >
                <span className="flex items-center gap-2">
                  <action.icon className="h-4 w-4 text-primary" />
                  {action.label}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
