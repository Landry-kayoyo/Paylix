'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getPeriodFinancialReport, getSchoolYears } from '@/app/actions/reports';
import { exportPaymentsToExcel } from '@/lib/excel-export';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CreditCard, Printer, Loader2, Calendar, FileText, Download, CheckCircle2, XCircle } from 'lucide-react';

export default function AccountantReportPage() {
  const supabase = createClient();

  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load School Years
  useEffect(() => {
    async function init() {
      const { data } = await getSchoolYears();
      if (data && data.length > 0) {
        setSchoolYears(data);
        const active = data.find(y => y.status === 'active') || data[0];
        setSelectedYearId(active.id);
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Fetch Report Data
  useEffect(() => {
    if (!selectedYearId) return;
    
    async function fetchData() {
      setLoading(true);
      setError(null);
      const res = await getPeriodFinancialReport({
        school_year_id: selectedYearId,
        period,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      
      if (res.data) setReportData(res.data);
      else if (res.error) setError(res.error);
      
      setLoading(false);
    }
    
    fetchData();
  }, [selectedYearId, period, startDate, endDate]);

  const { chartData, totals, cancelledCount } = useMemo(() => {
    if (!reportData?.payments) return { chartData: [], totals: { cdf: 0, usd: 0 }, cancelledCount: 0 };
    
    let cancelled = 0;
    let t_cdf = 0;
    let t_usd = 0;
    
    // Aggregate by day
    const dayMap = new Map<string, { cdf: number, usd: number }>();
    
    reportData.payments.forEach((p: any) => {
      if (p.status === 'cancelled') {
        cancelled++;
        return; // Exclude cancelled from totals and charts
      }
      
      const amt = Number(p.amount);
      if (p.currency === 'CDF') t_cdf += amt;
      else t_usd += amt;
      
      const day = new Date(p.payment_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
      const current = dayMap.get(day) || { cdf: 0, usd: 0 };
      
      if (p.currency === 'CDF') current.cdf += amt;
      else current.usd += amt;
      
      dayMap.set(day, current);
    });

    const chartArr = Array.from(dayMap.entries()).map(([day, vals]) => ({
      day,
      CDF: vals.cdf,
      USD: vals.usd,
    })).reverse(); // Assuming payments are sorted desc, reverse to chronological

    return {
      chartData: chartArr,
      totals: { cdf: t_cdf, usd: t_usd },
      cancelledCount: cancelled,
    };
  }, [reportData]);

  if (!schoolYears.length && !loading) {
    return <div className="p-8 text-center text-muted-foreground">Aucune configuration trouvée.</div>;
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* HEADER PROFESSIONNEL */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card p-6 rounded-2xl border border-border/60 shadow-[var(--shadow-premium)] print:border-none print:shadow-none print:p-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Rapport d'activité</h1>
          <p className="text-muted-foreground mt-1 text-sm">Synthèse de vos opérations d'encaissement</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex items-center gap-2 bg-muted/30 border border-border/60 rounded-xl p-1 px-3">
            <Calendar className="h-4 w-4 text-primary" />
            <Select value={selectedYearId} onValueChange={(val) => { if (val) setSelectedYearId(val); }}>
              <SelectTrigger className="w-[180px] border-0 bg-transparent h-8 shadow-none focus:ring-0 font-medium text-sm">
                <SelectValue placeholder="Année Scolaire" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map(y => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name} {y.status === 'active' && '(En cours)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-10 rounded-xl">
            <Printer className="mr-2 h-4 w-4" /> Imprimer
          </Button>
          <Button size="sm" onClick={() => reportData && exportPaymentsToExcel(reportData.payments)} className="h-10 rounded-xl">
            <Download className="mr-2 h-4 w-4" /> Exporter Excel
          </Button>
        </div>
      </div>

      {/* FILTRES COMPACTS */}
      <div className="flex flex-wrap items-center gap-2 bg-card p-2 rounded-2xl border border-border/60 shadow-[var(--shadow-premium)] print:hidden w-fit">
        <Button 
          size="sm" 
          variant={period === 'today' ? 'default' : 'ghost'}
          onClick={() => setPeriod('today')}
          className="rounded-xl px-4"
        >
          Aujourd'hui
        </Button>
        <Button 
          size="sm" 
          variant={period === 'week' ? 'default' : 'ghost'}
          onClick={() => setPeriod('week')}
          className="rounded-xl px-4"
        >
          Cette semaine
        </Button>
        <Button 
          size="sm" 
          variant={period === 'month' ? 'default' : 'ghost'}
          onClick={() => setPeriod('month')}
          className="rounded-xl px-4"
        >
          Ce mois
        </Button>
      </div>

      {/* ETATS */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p>Chargement de votre rapport d'activité...</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-destructive bg-destructive/5 rounded-2xl border border-destructive/20">
          <p className="font-semibold">Erreur de chargement</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : (
        <>
          {/* KPIs COMPACTS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Paiements Validés"
              value={String(reportData?.payments.filter((p: any) => p.status !== 'cancelled').length || 0)}
              icon={CheckCircle2}
              trendUp={true}
              highlight
            />
            <StatCard
              title="Total Encaissé (CDF)"
              value={`${new Intl.NumberFormat('fr-FR').format(totals.cdf)} CDF`}
              icon={CreditCard}
              trendUp={true}
            />
            <StatCard
              title="Total Encaissé (USD)"
              value={`$${new Intl.NumberFormat('fr-FR').format(totals.usd)}`}
              icon={CreditCard}
              trendUp={true}
            />
            <StatCard
              title="Opérations Annulées"
              value={String(cancelledCount)}
              icon={XCircle}
              trendUp={false}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GRAPHIQUE D'ACTIVITE CDF */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Évolution des encaissements (CDF)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v/1000}k`} />
                        <Tooltip 
                          cursor={{ fill: 'var(--color-muted)' }}
                          contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-premium)' }}
                          formatter={(value: any, name: any) => [`${new Intl.NumberFormat('fr-FR').format(value)} CDF`, 'CDF']}
                        />
                        <Bar dataKey="CDF" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      Données insuffisantes pour générer le graphique.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* GRAPHIQUE D'ACTIVITE USD */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Évolution des encaissements (USD)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: 'var(--color-muted)' }}
                          contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-premium)' }}
                          formatter={(value: any, name: any) => [`$${new Intl.NumberFormat('fr-FR').format(value)}`, 'USD']}
                        />
                        <Bar dataKey="USD" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      Données insuffisantes pour générer le graphique.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* TABLEAU DES OPERATIONS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique de vos opérations</CardTitle>
              <CardDescription>Détail de toutes les transactions que vous avez enregistrées durant cette période.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">N° Reçu</th>
                      <th className="px-6 py-3 font-medium">Élève</th>
                      <th className="px-6 py-3 font-medium text-right">Montant</th>
                      <th className="px-6 py-3 font-medium text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {reportData?.payments?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                          Aucune opération enregistrée pour cette période.
                        </td>
                      </tr>
                    ) : (
                      reportData?.payments?.map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">
                            {new Date(p.payment_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap font-mono text-foreground">
                            {p.receipts?.[0]?.receipt_number || '-'}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap font-medium text-foreground">
                            {p.students?.first_name} {p.students?.last_name}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-right font-mono font-semibold text-foreground">
                            {p.currency === 'CDF' 
                              ? `${new Intl.NumberFormat('fr-FR').format(p.amount)} CDF`
                              : `$${new Intl.NumberFormat('fr-FR').format(p.amount)}`}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-center">
                            <Badge 
                              variant="outline" 
                              className={p.status === 'confirmed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}
                            >
                              {p.status === 'confirmed' ? 'Validé' : 'Annulé'}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
