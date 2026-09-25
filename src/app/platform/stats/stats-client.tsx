"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Building2, TrendingUp, CreditCard, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// Données fictives provisoires pour les paiements d'abonnement
function getSubscriptionData(chartData: any[], period: string) {
  // On utilise les créneaux temporels réels mais avec des montants fictifs provisoires
  // Prix fictif : $49/établissement
  const PRICE_PER_TENANT_USD = 49;
  const PRICE_PER_TENANT_CDF = 125000;

  // On simule à partir du nombre d'établissements créés sur la période
  return chartData.map((d, i) => {
    // Nombre d'établissements actifs fictif (cumulatif progressif pour le rendu)
    const tenantsActive = 2 + Math.floor(i / Math.max(chartData.length / 3, 1));
    return {
      name: d.name,
      usd: tenantsActive * PRICE_PER_TENANT_USD,
      cdf: tenantsActive * PRICE_PER_TENANT_CDF,
      tenants: d.tenants,
      users: d.users,
    };
  });
}

const PERIOD_LABELS: Record<string, string> = {
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "3m": "3 derniers mois",
  "6m": "6 derniers mois",
  "12m": "12 derniers mois",
  "all": "Depuis le début",
};

export function PlatformStatsClient({
  initialStats,
  period,
}: {
  initialStats: { kpi: any; chartData: any[] };
  period: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handlePeriodChange = (value: string | null) => {
    if (!value) return;
    startTransition(() => {
      router.push(`/platform/stats?period=${value}`);
    });
  };

  const { kpi, chartData } = initialStats;
  const subscriptionData = getSubscriptionData(chartData, period);

  // Revenus fictifs cumulés provisoires
  const totalRevenueUSD = kpi.totalTenants * 49;
  const totalRevenueCDF = kpi.totalTenants * 125000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Statistiques Globales
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyses et métriques de la plateforme SaaS — {PERIOD_LABELS[period] || period}
          </p>
        </div>
        <Select value={period} onValueChange={handlePeriodChange} disabled={isPending}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 derniers jours</SelectItem>
            <SelectItem value="30d">30 derniers jours</SelectItem>
            <SelectItem value="3m">3 derniers mois</SelectItem>
            <SelectItem value="6m">6 derniers mois</SelectItem>
            <SelectItem value="12m">12 derniers mois</SelectItem>
            <SelectItem value="all">Depuis le début</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI résumé */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Établissements</p>
            </div>
            <p className="text-3xl font-bold">{kpi.totalTenants}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.activeTenants} actifs · {kpi.suspendedTenants} suspendus</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Revenue mensuel (USD)</p>
            </div>
            <p className="text-3xl font-bold">${totalRevenueUSD}</p>
            <p className="text-xs text-amber-600 mt-1 font-medium">⚠ Données provisoires</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-violet-600" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Revenue mensuel (CDF)</p>
            </div>
            <p className="text-2xl font-bold">{totalRevenueCDF.toLocaleString("fr-FR")} CDF</p>
            <p className="text-xs text-amber-600 mt-1 font-medium">⚠ Données provisoires</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Directeurs actifs</p>
            </div>
            <p className="text-3xl font-bold">{kpi.directors}</p>
            <p className="text-xs text-muted-foreground mt-1">Gestionnaires plateforme</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Évolution paiements abonnement */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Évolution des paiements d'abonnement
            </CardTitle>
            <CardDescription className="text-xs">
              Revenue mensuel estimé (USD) — données provisoires
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="w-full h-[280px]" />
            ) : subscriptionData.length > 0 ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={subscriptionData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorUSD" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value: any) => [`$${value}`, "Abonnements USD"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="usd" name="Abonnements USD" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorUSD)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm bg-slate-50/50 rounded-lg border border-dashed">
                Données insuffisantes pour cette période.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Répartition établissements */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Nouveaux établissements
            </CardTitle>
            <CardDescription className="text-xs">
              Inscriptions sur la période sélectionnée
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="w-full h-[280px]" />
            ) : subscriptionData.length > 0 ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subscriptionData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="tenants" name="Nouveaux établissements" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm bg-slate-50/50 rounded-lg border border-dashed">
                Données insuffisantes pour cette période.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      
      
    </div>
  );
}
