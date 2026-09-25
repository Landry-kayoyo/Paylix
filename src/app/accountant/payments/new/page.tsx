'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { recordPaymentGroup } from '@/app/actions/payments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Loader2, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type StudentLike = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  post_name?: string | null;
  matricule?: string | null;
  student_enrollments?: Array<{
    id?: string | null;
    class_id?: string | null;
    classes?: { name?: string | null } | Array<{ name?: string | null }> | null;
  } | null> | null;
  classes?: { name?: string | null } | null;
};

const getStudentClassName = (student: StudentLike | null) => {
  if (!student) return null;
  const rawClass = student.student_enrollments?.[0]?.classes;
  const resolvedClass = Array.isArray(rawClass) ? rawClass[0] : rawClass;
  return resolvedClass?.name ?? student.classes?.name ?? null;
};

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const getObligationLabel = (obligation: ObligationLike) => {
  const name = obligation.fees?.name || 'Frais';
  const month = Number(obligation.fee_schedules?.month);
  return month >= 1 && month <= 12 ? `${name} - ${monthNames[month - 1]}` : name;
};

type ObligationLike = {
  id: string;
  initial_amount: number | string | null;
  paid_amount: number | string | null;
  remaining_amount: number | string | null;
  due_date?: string | null;
  status?: string | null;
  currency?: 'USD' | 'CDF' | null;
  school_year_id?: string | null;
  fees?: { name?: string | null } | null;
  fee_schedules?: { month?: string | number | null } | null;
  school_years?: { name?: string | null, status?: string | null } | null;
};

type PendingPayment = Array<{
  amount: number;
  currency: 'USD' | 'CDF';
  allocations: Array<{ obligation_id: string; amount: number }>;
}>;

export default function NewPaymentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [schoolYearId, setSchoolYearId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<StudentLike[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [selectedStudent, setSelectedStudent] = useState<StudentLike | null>(null);
  const [activeCurrency, setActiveCurrency] = useState<'USD' | 'CDF' | null>(null);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});

  const [obligationsByCurrency, setObligationsByCurrency] = useState<Record<'USD' | 'CDF', ObligationLike[]>>({
    USD: [],
    CDF: [],
  });
  const [loadingObligations, setLoadingObligations] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        console.error('Erreur auth:', authErr);
        return;
      }

      const { data: memberships, error: memErr } = await supabase
        .from('user_memberships')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (memErr) {
        console.error('Erreur memberships:', memErr);
      }

      if (memberships && memberships.length > 0) {
        const accountantMembership = memberships.find((m) => m.role === 'accountant');
        const membership = accountantMembership || memberships[0];
        setTenantId(membership.tenant_id);

        const { data: year, error: yearErr } = await supabase
          .from('school_years')
          .select('id')
          .eq('tenant_id', membership.tenant_id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (yearErr) console.error('Erreur année scolaire:', yearErr);
        if (year) setSchoolYearId(year.id);
      }
    }
    init();
  }, [supabase]);

  useEffect(() => {
    async function searchStudents() {
      const trimmedQuery = searchQuery.trim();
      if (trimmedQuery.length < 2) {
        setStudents([]);
        return;
      }

      setSearching(true);

      const words = trimmedQuery.split(/\s+/).filter(Boolean);
      const orConditions = words
        .flatMap((w) => [
          `first_name.ilike.%${w}%`,
          `last_name.ilike.%${w}%`,
          `post_name.ilike.%${w}%`,
          `matricule.ilike.%${w}%`,
        ])
        .join(',');

      let query = supabase
        .from('students')
        .select('id, first_name, last_name, post_name, matricule, student_enrollments(id, class_id, classes(name))')
        .or(orConditions)
        .limit(10);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erreur recherche élèves:', error);
      }

      setStudents((data as StudentLike[] | null) || []);
      setSearching(false);
    }

    const timer = setTimeout(searchStudents, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, supabase, tenantId]);

  useEffect(() => {
    async function loadObligations() {
      if (!selectedStudent) {
        setObligationsByCurrency({ USD: [], CDF: [] });
        setActiveCurrency(null);
        setPaymentInputs({});
        return;
      }

      setLoadingObligations(true);

      const studentEnrollment = Array.isArray(selectedStudent.student_enrollments) ? selectedStudent.student_enrollments[0] : null;
      const studentClassId = (studentEnrollment as any)?.class_id || null;

      const { data: existingObligations } = await supabase
        .from('financial_obligations')
        .select(`
          id, initial_amount, paid_amount, remaining_amount, due_date, status, currency, school_year_id,
          fees (name), fee_schedules (month), school_years(name, status)
        `)
        .eq('student_id', selectedStudent.id)
        .order('due_date', { ascending: true });

      const obligations = (existingObligations || []) as ObligationLike[];

      if ((!obligations || obligations.length === 0) && tenantId && schoolYearId && studentClassId) {
        const { data: feeLinks } = await supabase
          .from('fee_classes')
          .select(`
            fee_id,
            fees (
              id, name, fee_type, default_amount, currency,
              fee_schedules (id, month, amount, due_date)
            )
          `)
          .eq('tenant_id', tenantId)
          .eq('class_id', studentClassId);

        const feeConfigs = (feeLinks || [])
          .map((link: any) => link.fees)
          .filter(Boolean)
          .filter((fee: any) => fee && fee.id);

        if (feeConfigs.length > 0) {
          const selectedFeeIds = feeConfigs.map((fee: any) => fee.id);
          const { data: existingByFee } = await supabase
            .from('financial_obligations')
            .select('id, fee_id, fee_schedule_id')
            .eq('tenant_id', tenantId)
            .eq('student_id', selectedStudent.id)
            .eq('school_year_id', schoolYearId)
            .in('fee_id', selectedFeeIds.length > 0 ? selectedFeeIds : ['00000000-0000-0000-0000-000000000000']);

          const obligationsMap = new Map<string, Set<string>>();
          (existingByFee || []).forEach((row: any) => {
            if (!obligationsMap.has(row.fee_id)) obligationsMap.set(row.fee_id, new Set());
            if (row.fee_schedule_id) obligationsMap.get(row.fee_id)?.add(row.fee_schedule_id);
          });

          const toInsert: Array<any> = [];

          feeConfigs.forEach((fee: any) => {
            const feeId = fee.id;
            const existingScheduleIds = obligationsMap.get(feeId) || new Set();

            if (fee.fee_type === 'monthly' && Array.isArray(fee.fee_schedules) && fee.fee_schedules.length > 0) {
              fee.fee_schedules.forEach((schedule: any) => {
                if (existingScheduleIds.has(schedule.id)) return;

                toInsert.push({
                  tenant_id: tenantId,
                  school_year_id: schoolYearId,
                  student_id: selectedStudent.id,
                  fee_id: feeId,
                  fee_schedule_id: schedule.id,
                  initial_amount: Number(schedule.amount || 0),
                  paid_amount: 0,
                  remaining_amount: Number(schedule.amount || 0),
                  currency: fee.currency,
                  due_date: schedule.due_date,
                  status: 'unpaid',
                  enrollment_id: studentEnrollment?.id ?? null,
                });
              });
              return;
            }

            if (!existingScheduleIds.size && !obligationsMap.has(feeId)) {
              toInsert.push({
                tenant_id: tenantId,
                school_year_id: schoolYearId,
                student_id: selectedStudent.id,
                fee_id: feeId,
                initial_amount: Number(fee.default_amount || 0),
                paid_amount: 0,
                remaining_amount: Number(fee.default_amount || 0),
                currency: fee.currency,
                due_date: null,
                status: 'unpaid',
                enrollment_id: studentEnrollment?.id ?? null,
              });
            }
          });

          if (toInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('financial_obligations')
              .insert(toInsert);

            if (insertError) {
              console.error('Erreur génération obligations:', insertError);
            }
          }
        }
      }

      const { data: refreshedData } = await supabase
        .from('financial_obligations')
        .select(`
          id, initial_amount, paid_amount, remaining_amount, due_date, status, currency, school_year_id,
          fees (name), fee_schedules (month), school_years(name, status)
        `)
        .eq('student_id', selectedStudent.id)
        .order('due_date', { ascending: true });

      const nextGroup: Record<'USD' | 'CDF', ObligationLike[]> = { USD: [], CDF: [] };
      const refreshedObligations = (refreshedData || []) as ObligationLike[];
      refreshedObligations.forEach((obligation) => {
        const currency = obligation.currency as 'USD' | 'CDF' | undefined;
        if (currency === 'USD' || currency === 'CDF') {
          nextGroup[currency].push(obligation);
        }
      });

      setObligationsByCurrency(nextGroup);

      const preferredCurrency = nextGroup.USD.length > 0 ? 'USD' : nextGroup.CDF.length > 0 ? 'CDF' : null;
      setActiveCurrency((current) => {
        if (current && nextGroup[current]?.length) return current;
        return preferredCurrency;
      });

      setPaymentInputs((prev) => {
        const nextPaymentInputs: Record<string, string> = {};
        refreshedObligations.forEach((obligation) => {
          if (prev[obligation.id]) {
            nextPaymentInputs[obligation.id] = prev[obligation.id];
          }
        });
        return nextPaymentInputs;
      });
      setLoadingObligations(false);
    }

    loadObligations();
  }, [selectedStudent, supabase, tenantId, schoolYearId]);

  const visibleObligations = [...(obligationsByCurrency.USD || []), ...(obligationsByCurrency.CDF || [])]
    .sort((a, b) => new Date(a.due_date || '2100-01-01').getTime() - new Date(b.due_date || '2100-01-01').getTime());

  const totalsByCurrency = (['USD', 'CDF'] as const).reduce((totals, currency) => {
    totals[currency] = visibleObligations
      .filter((obligation) => (obligation.currency || 'CDF') === currency)
      .reduce((sum, obligation) => {
        const value = Number.parseFloat(paymentInputs[obligation.id] || '0');
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
    return totals;
  }, { USD: 0, CDF: 0 } as Record<'USD' | 'CDF', number>);

  const hasInvalidLine = visibleObligations.some((obligation) => {
    const value = Number.parseFloat(paymentInputs[obligation.id] || '0');
    const remaining = Number(obligation.remaining_amount ?? 0);
    if (!Number.isFinite(value) || value < 0) return true;
    if (remaining <= 0) return false;
    return value > remaining;
  });

  const remainingByCurrency = (['USD', 'CDF'] as const).reduce((totals, currency) => {
    totals[currency] = visibleObligations
      .filter((obligation) => (obligation.currency || 'CDF') === currency)
      .reduce((sum, obligation) => sum + Number(obligation.remaining_amount || 0), 0);
    return totals;
  }, { USD: 0, CDF: 0 } as Record<'USD' | 'CDF', number>);

  const handlePaymentInputChange = (obligationId: string, value: string) => {
    setPaymentInputs((prev) => ({
      ...prev,
      [obligationId]: value,
    }));
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!tenantId || !schoolYearId || !selectedStudent) {
      setError('Informations incomplètes.');
      return;
    }

    const groupedByCurrency = new Map<'USD' | 'CDF', Array<{ obligation_id: string; amount: number }>>();

    visibleObligations.forEach((obligation) => {
      const rawValue = Number.parseFloat(paymentInputs[obligation.id] || '0');
      if (!Number.isFinite(rawValue) || rawValue <= 0) return;

      const currency = (obligation.currency || activeCurrency || 'CDF') as 'USD' | 'CDF';
      if (rawValue > Number(obligation.remaining_amount || 0)) {
        throw new Error(`Le montant de ${obligation.id} dépasse le solde restant.`);
      }

      const group = groupedByCurrency.get(currency) || [];
      group.push({ obligation_id: obligation.id, amount: rawValue });
      groupedByCurrency.set(currency, group);
    });

    if (groupedByCurrency.size === 0) {
      setError('Aucun montant saisi sur les obligations.');
      return;
    }

    for (const [currency, allocations] of groupedByCurrency.entries()) {
      const totalAmount = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      if (totalAmount <= 0) {
        setError('Le montant total doit être strictement positif.');
        return;
      }

      const totalRemaining = visibleObligations
        .filter((obligation) => (obligation.currency || activeCurrency || 'CDF') === currency)
        .reduce((sum, obligation) => sum + Number(obligation.remaining_amount || 0), 0);

      if (totalAmount > totalRemaining) {
        setError(`Le total saisi pour ${currency} (${totalAmount}) dépasse le solde restant (${totalRemaining}).`);
        return;
      }
    }

    const groups = Array.from(groupedByCurrency.entries()).map(([currency, allocations]) => ({
      currency,
      amount: allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      allocations,
    }));

    setPendingPayment(groups);
    setIsConfirmationOpen(true);
  };

  const confirmPayment = async () => {
    if (!pendingPayment || !tenantId || !schoolYearId || !selectedStudent) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await recordPaymentGroup({
        tenant_id: tenantId,
        school_year_id: schoolYearId,
        student_id: selectedStudent.id,
        groups: pendingPayment,
      });

      if (result.error || !result.paymentId) {
        setError(result.error || 'Le paiement n’a pas pu être enregistré.');
        return;
      }

      setIsConfirmationOpen(false);
      router.push(`/accountant/payments/${result.paymentId}?receipt=1`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Le paiement n’a pas pu être enregistré.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accountant/payments">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau paiement</h1>
          
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {!isOnline && (
        <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>Vous êtes hors ligne. L'enregistrement des paiements est désactivé jusqu'au rétablissement de la connexion.</p>
        </div>
      )}

      <Card className="overflow-visible">
        <CardHeader>
          <div className="flex items-center gap-3">
            
            <div>
              <CardTitle>Sélection de l&apos;élève</CardTitle>
              <CardDescription>Rechercher par nom, postnom, prénom ou matricule.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-visible">
          {!selectedStudent ? (
            <div className="space-y-2">
              <div className="relative z-20">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Ex : Jean Kabongo, MAT001, 7e Scientifique..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  className="pl-12 h-12 text-base shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all"
                  autoComplete="off"
                />

                {showDropdown && searchQuery.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-2 border rounded-xl shadow-lg bg-background overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {searching ? (
                      <div className="p-5 text-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Recherche en cours...
                      </div>
                    ) : students.length > 0 ? (
                      <ul className="max-h-72 overflow-y-auto py-1">
                        {students.map((student) => {
                          const initials = `${student.first_name?.[0] ?? ''}${student.last_name?.[0] ?? ''}`.toUpperCase();
                          const className = getStudentClassName(student);

                          return (
                            <li
                              key={student.id}
                              className="group flex items-center gap-4 px-4 py-3 mx-1 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSelectedStudent(student);
                                setSearchQuery('');
                                setShowDropdown(false);
                              }}
                            >
                              
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-foreground truncate">
                                  {student.first_name} {student.post_name ? `${student.post_name} ` : ''}{student.last_name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded border">{student.matricule}</span>
                                  {className && <span className="text-xs text-muted-foreground">• {className}</span>}
                                </div>
                              </div>
                              <div className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                Sélectionner →
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="p-5 text-center text-sm text-muted-foreground">
                        Aucun élève trouvé pour <strong className="text-foreground">&laquo; {searchQuery} &raquo;</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  {`${selectedStudent.first_name?.[0] ?? ''}${selectedStudent.last_name?.[0] ?? ''}`.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-emerald-900">
                    {selectedStudent.first_name} {selectedStudent.post_name ? `${selectedStudent.post_name} ` : ''}{selectedStudent.last_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{selectedStudent.matricule}</span>
                    {getStudentClassName(selectedStudent) && (
                      <span className="text-xs text-emerald-700">• {getStudentClassName(selectedStudent)}</span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  setSelectedStudent(null);
                  setPaymentInputs({});
                  setSearchQuery('');
                  setActiveCurrency(null);
                }}
              >
                Changer d&apos;élève
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
             
              <div>
                <CardTitle>Situation financière</CardTitle>
                <CardDescription>Les montants sont affichés par devise. Pour un paiement, une seule devise est traitée à la fois.</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-800">Résumé financier</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {(['USD', 'CDF'] as const).map((currencyKey) => {
                  const obligations = obligationsByCurrency[currencyKey] || [];
                  const totalObligations = obligations.reduce((sum, obligation) => sum + Number(obligation.initial_amount || 0), 0);
                  const totalPaid = obligations.reduce((sum, obligation) => sum + Number(obligation.paid_amount || 0), 0);
                  const totalRemaining = obligations.reduce((sum, obligation) => sum + Number(obligation.remaining_amount || 0), 0);

                  return (
                    <div
                      key={currencyKey}
                      className="rounded-xl border border-slate-200 bg-white/80 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-sm">{currencyKey}</h4>
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span>Total des obligations</span><strong>{totalObligations.toLocaleString()} {currencyKey}</strong></div>
                        <div className="flex justify-between"><span>Total déjà payé</span><strong>{totalPaid.toLocaleString()} {currencyKey}</strong></div>
                        <div className="flex justify-between"><span>Total restant</span><strong>{totalRemaining.toLocaleString()} {currencyKey}</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Détail des obligations</h3>
                <div className="text-sm font-medium text-muted-foreground">
                  {(['USD', 'CDF'] as const).map((currency) => (
                    <span key={currency}>
                      {currency}: <span className="font-bold text-foreground">{totalsByCurrency[currency].toLocaleString()} {currency}</span>
                    </span>
                  ))}
                </div>
              </div>

              {loadingObligations ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                  Chargement des obligations...
                </div>
              ) : visibleObligations.length === 0 ? (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-sm font-medium text-amber-800">Aucune obligation restante à régler en {activeCurrency || 'USD/CDF'}.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Dettes Antérieures */}
                  {visibleObligations.filter(o => o.school_year_id !== schoolYearId).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-rose-700 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> Dettes antérieures
                      </h4>
                      {visibleObligations.filter(o => o.school_year_id !== schoolYearId).map((obligation) => {
                        const currentValue = Number.parseFloat(paymentInputs[obligation.id] || '0');
                        const safeValue = Number.isFinite(currentValue) ? currentValue : 0;
                        const obligationCurrency = obligation.currency || activeCurrency || 'CDF';
                        const remainingAfter = Number(obligation.remaining_amount || 0) - safeValue;
                        const isBlocked = Number(obligation.remaining_amount || 0) <= 0;
                        const isInvalid = !isBlocked && safeValue > Number(obligation.remaining_amount || 0);

                        return (
                          <div key={obligation.id} className={`p-4 border rounded-xl ${isInvalid ? 'border-rose-300 bg-rose-50' : 'border-rose-100 bg-rose-50/30'}`}>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-sm">{getObligationLabel(obligation)}</p>
                                  <Badge variant="destructive" className="bg-rose-500">{obligation.school_years?.name || 'Année passée'}</Badge>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                  <span>Initial : {Number(obligation.initial_amount || 0).toLocaleString()} {obligationCurrency}</span>
                                  <span>Restant : {Number(obligation.remaining_amount || 0).toLocaleString()} {obligationCurrency}</span>
                                </div>
                              </div>
                              <div className="w-full max-w-[220px]">
                                <label className="mb-1 block text-xs font-medium">Paiement ({obligationCurrency})</label>
                                <div className="relative">
                                  <Input type="number" min="0" step="0.01" value={isBlocked ? '0' : paymentInputs[obligation.id] ?? ''} disabled={isBlocked} onChange={(e) => handlePaymentInputChange(obligation.id, e.target.value)} className={isInvalid ? 'border-rose-300 bg-rose-50' : ''} />
                                </div>
                                {!isBlocked && <div className="mt-1 text-xs text-muted-foreground">{isInvalid ? <span className="text-rose-600">Dépasse le solde.</span> : safeValue > 0 ? <span>Reste: {remainingAfter.toLocaleString()}</span> : <span>Reste à payer : {Number(obligation.remaining_amount || 0).toLocaleString()}</span>}</div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Année Courante */}
                  {visibleObligations.filter(o => o.school_year_id === schoolYearId).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-slate-800">Année courante</h4>
                      {visibleObligations.filter(o => o.school_year_id === schoolYearId).map((obligation) => {
                        const currentValue = Number.parseFloat(paymentInputs[obligation.id] || '0');
                        const safeValue = Number.isFinite(currentValue) ? currentValue : 0;
                        const obligationCurrency = obligation.currency || activeCurrency || 'CDF';
                        const remainingAfter = Number(obligation.remaining_amount || 0) - safeValue;
                        const isBlocked = Number(obligation.remaining_amount || 0) <= 0;
                        const isInvalid = !isBlocked && safeValue > Number(obligation.remaining_amount || 0);

                        return (
                          <div key={obligation.id} className={`p-4 border rounded-xl ${isInvalid ? 'border-rose-300 bg-rose-50' : 'border-border bg-background'}`}>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-sm">{getObligationLabel(obligation)}</p>
                                  {isBlocked ? <Badge className="bg-emerald-100 text-emerald-800">✓ Payé</Badge> : obligation.status === 'overdue' ? <Badge className="bg-rose-100 text-rose-800">En retard</Badge> : <Badge className="bg-slate-100 text-slate-700">À régler</Badge>}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                  <span>Initial : {Number(obligation.initial_amount || 0).toLocaleString()} {obligationCurrency}</span>
                                  <span>Déjà payé : {Number(obligation.paid_amount || 0).toLocaleString()} {obligationCurrency}</span>
                                  <span>Restant : {Number(obligation.remaining_amount || 0).toLocaleString()} {obligationCurrency}</span>
                                </div>
                              </div>
                              <div className="w-full max-w-[220px]">
                                <label className="mb-1 block text-xs text-muted-foreground font-medium">Paiement ({obligationCurrency})</label>
                                <div className="relative">
                                  <Input type="number" min="0" step="0.01" value={isBlocked ? '0' : paymentInputs[obligation.id] ?? ''} disabled={isBlocked} onChange={(e) => handlePaymentInputChange(obligation.id, e.target.value)} className={isInvalid ? 'border-rose-300 bg-rose-50' : ''} />
                                </div>
                                {!isBlocked && <div className="mt-1 text-xs text-muted-foreground">{isInvalid ? <span className="text-rose-600">Dépasse le solde.</span> : safeValue > 0 ? <span>Reste: {remainingAfter.toLocaleString()}</span> : <span>Reste à payer : {Number(obligation.remaining_amount || 0).toLocaleString()}</span>}</div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="border-t pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Total du paiement :
              {(['USD', 'CDF'] as const).map((currency) => (
                <strong key={currency} className="ml-2 text-foreground">
                  {totalsByCurrency[currency].toLocaleString()} {currency}
                </strong>
              ))}
              {(['USD', 'CDF'] as const).some((currency) => totalsByCurrency[currency] > 0) && (
                <span className="ml-2">
                  • Restant : {(['USD', 'CDF'] as const).map((currency) => `${remainingByCurrency[currency].toLocaleString()} ${currency}`).join(' · ')}
                </span>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={
                !isOnline ||
                isSubmitting ||
                Object.values(totalsByCurrency).every((total) => total <= 0) ||
                hasInvalidLine ||
                visibleObligations.length === 0 ||
                (['USD', 'CDF'] as const).some((currency) => totalsByCurrency[currency] > remainingByCurrency[currency])
              }
              size="lg"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Valider le paiement
            </Button>
          </CardFooter>
        </Card>
      )}

      <Dialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le paiement</DialogTitle>
            <DialogDescription>
              Vérifiez le montant avant d&apos;enregistrer définitivement ce paiement.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2 text-sm mt-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {pendingPayment && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm mt-4">
              <div className="flex items-center justify-between gap-4">
                <span>Élève</span>
                <strong>{selectedStudent?.first_name} {selectedStudent?.last_name}</strong>
              </div>

              <div className="mt-4 space-y-4">
                {pendingPayment.map((group) => (
                  <div key={group.currency} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-4">
                      <span>Total à payer ({group.currency})</span>
                      <strong>{group.amount.toLocaleString()} {group.currency}</strong>
                    </div>

                    <div className="mt-3 space-y-2">
                      {group.allocations.map((allocation) => {
                        const obligation = visibleObligations.find((item) => item.id === allocation.obligation_id);
                        return (
                          <div key={`${group.currency}-${allocation.obligation_id}`} className="flex items-center justify-between gap-4">
                            <span>{obligation ? getObligationLabel(obligation) : 'Frais scolaire'}</span>
                            <strong>{allocation.amount.toLocaleString()} {group.currency}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsConfirmationOpen(false)} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="button" onClick={confirmPayment} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
