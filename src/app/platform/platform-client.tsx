"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  ShieldCheck,
  UsersRound,
  DollarSign,
  Banknote
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateTenantDialog } from "./components/create-tenant-dialog";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export function PlatformClient({ 
  initialStats,
  period 
}: { 
  initialStats: {
    kpi: any;
    chartData: any[];
  },
  period: string
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handlePeriodChange = (value: string | null) => {
    if (!value) return;
    startTransition(() => {
      router.push(`/platform?period=${value}`);
    });
  };

  const { kpi, chartData } = initialStats;

  // Données paiements d'abonnement : fictives/provisoires ($49 par établissement actif)
  const PRICE_USD = 49;
  const PRICE_CDF = 125000;
  const subscriptionChartData = chartData.map((d, i) => {
    const active = Math.max(kpi.activeTenants, 1);
    return {
      ...d,
      revenueUSD: active * PRICE_USD,
      revenueCDF: active * PRICE_CDF,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
         
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={handlePeriodChange} disabled={isPending}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="Sélectionner une période" />
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
          <CreateTenantDialog />
        </div>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Établissements"
            value={kpi.totalTenants.toString()}
            icon={Building2}
            trend={`${kpi.activeTenants} actifs`}
            trendUp={true}
            highlight
          />
          <StatCard
            title="Admins / Directeurs"
            value={kpi.directors.toString()}
            icon={ShieldCheck}
            trend="Gestionnaires actifs"
            trendUp={true}
          />
          <StatCard
            title="Abonnement mensuel (USD)"
            value="$570"
            icon={DollarSign}
            trendUp={true}
          />
          <StatCard
            title="Abonnement mensuel (CDF)"
            value="825 000 CDF"
            icon={Banknote}
            trendUp={true}
          />
        </div>
      )}

      {/* Graphiques */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Paiements d'abonnement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="w-full h-[300px]" />
            ) : subscriptionChartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={subscriptionChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value: any) => [`$${value}`, "Abonnements (USD)"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 13 }}
                    />
                    <Area type="monotone" dataKey="revenueUSD" name="Abonnements USD" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm bg-slate-50/50 rounded-lg border border-dashed">
                Données insuffisantes pour cette période.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UsersRound className="w-5 h-5 text-blue-600" />
              Évolution des Utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="w-full h-[300px]" />
            ) : chartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 13 }}
                    />
                    <Bar dataKey="users" name="Utilisateurs" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm bg-slate-50/50 rounded-lg border border-dashed">
                Données insuffisantes pour cette période.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
