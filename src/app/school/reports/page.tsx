'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  getGlobalFinancialReport, 
  getClassFinancialReport,
  getSchoolYears,
  getDirectorAccountantsActivity,
  getDirectorFeesReport
} from '@/app/actions/reports';
import { exportClassReportToExcel, exportPaymentsToExcel } from '@/lib/excel-export';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PieChart, Wallet, CreditCard, Calendar, Printer, Download, Users, Briefcase, FileText, Loader2 } from 'lucide-react';

export default function DirectorReportPage() {
  const supabase = createClient();

  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  
  // Data States
  const [globalData, setGlobalData] = useState<any>(null);
  const [classData, setClassData] = useState<any[]>([]);
  const [feesData, setFeesData] = useState<any[]>([]);
  const [accountantsData, setAccountantsData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  const formatReportTooltip = (
    value: number | string | Array<number | string> | readonly (number | string)[] | undefined,
    prefix: string
  ): [string, string] => {
    const numericValue = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0);
    return [`${prefix}${new Intl.NumberFormat('fr-FR').format(numericValue)}`, 'Montant'];
  };

  const handleYearChange = (value: string | null) => {
    if (value) setSelectedYearId(value);
  };

  // Initial Load (School Years)
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

  // Fetch Reports
  useEffect(() => {
    if (!selectedYearId) return;
    
    async function fetchAll() {
      setLoading(true);
      
      const [globalRes, classRes, feesRes, accRes] = await Promise.all([
        getGlobalFinancialReport(selectedYearId),
        getClassFinancialReport(selectedYearId),
        getDirectorFeesReport(selectedYearId),
        getDirectorAccountantsActivity(selectedYearId)
      ]);

      if (globalRes.data) setGlobalData(globalRes.data);
      if (classRes.data) setClassData(classRes.data);
      if (feesRes.data) setFeesData(feesRes.data);
      if (accRes.data) setAccountantsData(accRes.data);
      
      setLoading(false);
    }
    
    fetchAll();
  }, [selectedYearId]);

  if (!schoolYears.length && !loading) {
    return <div className="p-8 text-center text-muted-foreground">Aucune configuration trouvée.</div>;
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card p-6 rounded-2xl border border-border/60 shadow-[var(--shadow-premium)] print:border-none print:shadow-none print:p-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Rapports Financiers</h1>
          <p className="text-muted-foreground mt-1 text-sm">Vue globale de la situation financière de votre établissement</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex items-center gap-2 bg-muted/30 border border-border/60 rounded-xl p-1 px-3">
            <Calendar className="h-4 w-4 text-primary" />
            <Select value={selectedYearId} onValueChange={handleYearChange}>
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
          <Button size="sm" onClick={() => exportClassReportToExcel(classData)} className="h-10 rounded-xl">
            <Download className="mr-2 h-4 w-4" /> Exporter Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p>Analyse des données financières de l'établissement...</p>
        </div>
      ) : !globalData ? (
        <div className="py-12 text-center text-muted-foreground">Données indisponibles.</div>
      ) : (
        <Tabs defaultValue="global" className="space-y-6 flex-col">
          <TabsList className="bg-card p-1 border border-border/60 shadow-[var(--shadow-premium)] flex flex-wrap gap-1 rounded-2xl w-fit h-auto print:hidden">
            <TabsTrigger value="global" className="rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <PieChart className="w-4 h-4 mr-2" /> Vue Globale
            </TabsTrigger>
            <TabsTrigger value="classes" className="rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Users className="w-4 h-4 mr-2" /> Par Classe
            </TabsTrigger>
            <TabsTrigger value="fees" className="rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Briefcase className="w-4 h-4 mr-2" /> Par Frais
            </TabsTrigger>
            <TabsTrigger value="accountants" className="rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <FileText className="w-4 h-4 mr-2" /> Comptables
            </TabsTrigger>
          </TabsList>

          {/* VUE GLOBALE */}
          <TabsContent value="global" className="space-y-6 print:block">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Encaissé (CDF)"
                value={`${new Intl.NumberFormat('fr-FR').format(globalData.cdf.total_collected)} CDF`}
                icon={CreditCard}
                trend={`${globalData.cdf.payments_count} paiements`}
                trendUp={true}
                highlight
              />
               <StatCard
                title="Restant à Payer (CDF)"
                value={`${new Intl.NumberFormat('fr-FR').format(globalData.cdf.total_remaining)} CDF`}
                icon={Wallet}
                trend="Déficit"
                trendUp={false}
              />

              <StatCard
                title="Total Encaissé (USD)"
                value={`$${new Intl.NumberFormat('fr-FR').format(globalData.usd.total_collected)}`}
                icon={CreditCard}
                trend={`${globalData.usd.payments_count} paiements`}
                trendUp={true}
                highlight
              />
             
              <StatCard
                title="Restant à Payer (USD)"
                value={`${new Intl.NumberFormat('fr-FR').format(globalData.usd.total_remaining)} USD`}
                icon={Wallet}
                trend="Déficit"
                trendUp={false}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Répartition CDF</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Attendu', montant: globalData.cdf.total_expected },
                      { name: 'Encaissé', montant: globalData.cdf.total_collected },
                      { name: 'Restant', montant: globalData.cdf.total_remaining }
                    ]} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v/1000}k`} />
                      <Tooltip 
                        formatter={(value) => formatReportTooltip(value, '')} 
                        cursor={{ fill: 'var(--color-muted)' }} 
                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-premium)' }} 
                      />
                      <Bar dataKey="montant" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Répartition USD</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Attendu', montant: globalData.usd.total_expected },
                      { name: 'Encaissé', montant: globalData.usd.total_collected },
                      { name: 'Restant', montant: globalData.usd.total_remaining }
                    ]} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(value) => formatReportTooltip(value, '$')} 
                        cursor={{ fill: 'var(--color-muted)' }} 
                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-premium)' }} 
                      />
                      <Bar dataKey="montant" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PAR CLASSE */}
          <TabsContent value="classes" className="space-y-6 print:block">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Situation par Classe</CardTitle>
                <CardDescription>Vue détaillée des encaissements et déficits classe par classe.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/30 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-medium">Classe</th>
                        <th className="px-6 py-3 text-center font-medium">Élèves</th>
                        <th className="px-6 py-3 text-right font-medium">Attendu CDF</th>
                        <th className="px-6 py-3 text-right font-medium">Encaissé CDF</th>
                        <th className="px-6 py-3 text-right font-medium">Restant CDF</th>
                        <th className="px-6 py-3 text-right font-medium">Encaissé USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {classData.map((c: any) => (
                        <tr key={c.class_id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4 font-semibold text-foreground whitespace-nowrap">{c.class_name}</td>
                          <td className="px-6 py-4 text-center font-medium">{c.student_count}</td>
                          <td className="px-6 py-4 text-right font-mono text-muted-foreground">{new Intl.NumberFormat('fr-FR').format(c.cdf.expected)}</td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-primary">{new Intl.NumberFormat('fr-FR').format(c.cdf.paid)}</td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-destructive">{new Intl.NumberFormat('fr-FR').format(c.cdf.remaining)}</td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-chart-2">${new Intl.NumberFormat('fr-FR').format(c.usd.paid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAR FRAIS */}
          <TabsContent value="fees" className="space-y-6 print:block">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Situation par Types de Frais</CardTitle>
                <CardDescription>Analyse des encaissements répartis par rubrique.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/30 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-medium">Frais</th>
                        <th className="px-6 py-3 text-right font-medium">Attendu CDF</th>
                        <th className="px-6 py-3 text-right font-medium">Encaissé CDF</th>
                        <th className="px-6 py-3 text-right font-medium text-destructive">Restant CDF</th>
                        <th className="px-6 py-3 text-right font-medium">Attendu USD</th>
                        <th className="px-6 py-3 text-right font-medium">Encaissé USD</th>
                        <th className="px-6 py-3 text-right font-medium text-destructive">Restant USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {feesData.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Aucune donnée disponible.</td></tr>
                      ) : feesData.map((f: any) => (
                        <tr key={f.fee_id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4 font-semibold text-foreground whitespace-nowrap">{f.fee_name}</td>
                          <td className="px-6 py-4 text-right font-mono text-muted-foreground">{new Intl.NumberFormat('fr-FR').format(f.cdf.expected)}</td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-primary">{new Intl.NumberFormat('fr-FR').format(f.cdf.paid)}</td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-destructive">{new Intl.NumberFormat('fr-FR').format(f.cdf.remaining)}</td>
                          <td className="px-6 py-4 text-right font-mono text-muted-foreground">{f.usd.expected === 0 && f.usd.paid === 0 && f.usd.remaining === 0 ? '-' : `$${new Intl.NumberFormat('fr-FR').format(f.usd.expected)}`}</td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-chart-2">{f.usd.expected === 0 && f.usd.paid === 0 && f.usd.remaining === 0 ? '-' : `$${new Intl.NumberFormat('fr-FR').format(f.usd.paid)}`}</td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-destructive">{f.usd.expected === 0 && f.usd.paid === 0 && f.usd.remaining === 0 ? '-' : `$${new Intl.NumberFormat('fr-FR').format(f.usd.remaining)}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPTABLES */}
          <TabsContent value="accountants" className="space-y-6 print:block">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance des Comptables</CardTitle>
                <CardDescription>Synthèse de l'activité de vos comptables (strictement réservé à la direction).</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/30 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-medium">Comptable</th>
                        <th className="px-6 py-3 text-center font-medium">Opérations Enregistrées</th>
                        <th className="px-6 py-3 text-right font-medium">Total CDF</th>
                        <th className="px-6 py-3 text-right font-medium">Total USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {accountantsData.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Aucun comptable ou aucune opération enregistrée.</td></tr>
                      ) : accountantsData.map((a: any) => (
                        <tr key={a.accountant_id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4 font-semibold text-foreground whitespace-nowrap flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                              {a.name.substring(0, 2).toUpperCase()}
                            </div>
                            {a.name}
                          </td>
                          <td className="px-6 py-4 text-center font-mono font-semibold">{a.payments_count}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                            {new Intl.NumberFormat('fr-FR').format(a.total_cdf)} CDF
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-chart-2">
                            ${new Intl.NumberFormat('fr-FR').format(a.total_usd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
