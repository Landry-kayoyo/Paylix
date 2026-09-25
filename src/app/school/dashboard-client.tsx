"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  CreditCard,
  Wallet,
  AlertTriangle,
  Clock,
  UserPlus,
  UserCheck,
  FileText,
  ArrowRight
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { createClient } from "@/lib/supabase/client";

function formatAmount(v: number, currency: string = "CDF") {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
  }
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "CDF", maximumFractionDigits: 0 }).format(v).replace("CDF", "FC");
}

function CurrencyDisplay({ values }: { values: { CDF: number; USD: number } }) {
  if (values.USD > 0 && values.CDF > 0) {
    return (
      <div className="flex flex-col">
        <span className="text-2xl leading-none">{formatAmount(values.USD, "USD")}</span>
        <span className="text-base text-muted-foreground mt-1">{formatAmount(values.CDF, "CDF")}</span>
      </div>
    );
  } else if (values.USD > 0) {
    return <span className="text-2xl leading-none">{formatAmount(values.USD, "USD")}</span>;
  } else {
    return <span className="text-2xl leading-none">{formatAmount(values.CDF, "CDF")}</span>;
  }
}

const DEMO_QUICK_ACTIONS = [
  { label: "Ajouter un élève", icon: UserPlus, href: "/school/students?create=1" },
  { label: "Ajouter un tuteur", icon: UserCheck, href: "/school/parents?create=1" },
  { label: "Voir les obligations", icon: Wallet, href: "/school/obligations" },
  { label: "Rapports financiers", icon: FileText, href: "/school/reports" },
];
export function DashboardClient({ initialData }: { initialData: any }) {
  const supabase = createClient();
  const [data, setData] = useState(initialData);
  const [chartCurrency, setChartCurrency] = useState<"USD" | "CDF">("USD");

  const router = useRouter();

  // Keep local state in sync with server changes triggered by router.refresh()
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    let isMounted = true;
    
    // Global realtime subscription for the dashboard
    const channel = supabase
      .channel(`dashboard-school-${initialData.tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `tenant_id=eq.${initialData.tenantId}` }, () => {
        if (isMounted) router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `tenant_id=eq.${initialData.tenantId}` }, () => {
        if (isMounted) router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_obligations', filter: `tenant_id=eq.${initialData.tenantId}` }, () => {
        if (isMounted) router.refresh();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, initialData.tenantId, router]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Élèves"
          value={data.totalStudents.toString()}
          icon={Users}
          trendUp={true}
          highlight
        />
        <StatCard
          title="Frais attendus"
          value={<CurrencyDisplay values={data.expectedFees} />}
          icon={Wallet}
          trendUp={true}
        />
        <StatCard
          title="Paiements reçus"
          value={<CurrencyDisplay values={data.receivedPayments} />}
          icon={CreditCard}
          trendUp={true}
        />
        <StatCard
          title="Solde à recouvrer"
          value={<CurrencyDisplay values={data.remainingBalance} />}
          icon={AlertTriangle}
          trendUp={false}
        />
      </div>

      {/* Graphique + Actions rapides */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Évolution des encaissements</CardTitle>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex bg-muted p-0.5 rounded-md text-xs font-medium">
                  <button 
                    onClick={() => setChartCurrency("USD")}
                    className={cn("px-2 py-1 rounded-sm transition-colors", chartCurrency === "USD" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    USD
                  </button>
                  <button 
                    onClick={() => setChartCurrency("CDF")}
                    className={cn("px-2 py-1 rounded-sm transition-colors", chartCurrency === "CDF" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    FC
                  </button>
                </div>
                <Badge variant="outline" className="text-xs hidden sm:inline-flex">Cette année</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.chartData && data.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="encGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="attenduGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis 
                    tick={{ fontSize: 11, fill: "#94a3b8" }} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} 
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(value: any, name: any) => [
                      chartCurrency === "USD" ? `$${value}` : `${value} FC`,
                      name
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Area 
                    type="monotone" 
                    dataKey={`attendu${chartCurrency}`} 
                    name="Attendu" 
                    stroke="#94a3b8" 
                    strokeWidth={2} 
                    fill="url(#attenduGradient)" 
                    strokeDasharray="5 5" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey={`encaissements${chartCurrency}`} 
                    name="Encaissé" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    fill="url(#encGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                Données insuffisantes pour le graphique
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions rapides */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_QUICK_ACTIONS.map((action, i) => (
              <a
                key={i}
                href={action.href}
                className="flex w-full justify-between items-center h-10 text-sm font-normal text-foreground hover:text-primary border rounded-md px-4 hover:border-primary/50 group"
              >
                  <span className="flex items-center gap-2">
                    <action.icon className="h-4 w-4 text-primary" />
                    {action.label}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
      

    </div>
  );
}
