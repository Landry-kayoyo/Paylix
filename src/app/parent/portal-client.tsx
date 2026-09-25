"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  GraduationCap,
  ChevronDown,
  User,
  BookOpen,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowLeftRight,
  Wallet,
  Receipt,
  FileText,
  Ban,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import type { ParentDashboardData, FinancialObligation, PaymentData } from "./actions";
import { ParentReceiptPreview } from "./receipt-preview";
import { formatFeeDisplayName } from "@/lib/month-label";
import { useHeaderActions } from "./header-actions-context";

interface ParentPortalClientProps {
  data: ParentDashboardData;
  activeTenantId: string;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Payée</Badge>;
    case "partial":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Partielle</Badge>;
    case "overdue":
      return <Badge className="bg-rose-100 text-rose-800 border-rose-200">En retard</Badge>;
    case "unpaid":
    default:
      return <Badge className="bg-slate-100 text-slate-800 border-slate-200">À payer</Badge>;
  }
}

export function ParentPortalClient({ data, activeTenantId }: ParentPortalClientProps) {
  const { parent, tenant, children, allTenants } = data;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();
  const { setActions } = useHeaderActions();

  const selectedChild = children[selectedIdx] ?? null;
  const hasMultipleTenants = allTenants.length > 1;

  function switchTenant(tenantId: string) {
    if (tenantId === activeTenantId) return;
    router.push(`/parent?tenant=${tenantId}`);
  }

  // Push tenant-switcher into the header on mobile
  useEffect(() => {
    if (!hasMultipleTenants) {
      setActions(null);
      return;
    }
    setActions(
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="h-9 gap-1.5 px-2.5 text-sm border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700"
              id="tenant-switcher-header"
              aria-label="Changer d'établissement"
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-xs">Établissement</span>
              <ChevronDown className="h-3 w-3 text-emerald-400" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-slate-500 font-normal">
              Vos établissements ({allTenants.length})
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {allTenants.map((t) => (
            <DropdownMenuItem
              key={t.tenantId}
              onClick={() => switchTenant(t.tenantId)}
              className="gap-3 py-3 cursor-pointer"
              id={`switch-tenant-header-${t.tenantId}`}
            >
              {t.tenantLogo ? (
                <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center border border-slate-200 shrink-0">
                  <Image src={t.tenantLogo} alt="" width={24} height={24} className="object-contain" />
                </div>
              ) : (
                <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-200 shrink-0">
                  {t.tenantName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{t.tenantName}</p>
                {t.tenantCity && <p className="text-xs text-slate-400">{t.tenantCity}</p>}
              </div>
              {t.tenantId === activeTenantId ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-400 shrink-0">
                  Basculer
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMultipleTenants, activeTenantId, allTenants.length]);

  // Calculate summaries
  const cdfObligations = selectedChild?.obligations.filter((o) => o.currency === "CDF") || [];
  const usdObligations = selectedChild?.obligations.filter((o) => o.currency === "USD") || [];

  const calcSummary = (obs: FinancialObligation[]) => {
    return obs.reduce(
      (acc, curr) => {
        acc.total += curr.initial_amount;
        acc.paid += curr.paid_amount;
        acc.remaining += curr.remaining_amount;
        return acc;
      },
      { total: 0, paid: 0, remaining: 0 }
    );
  };

  const cdfSummary = calcSummary(cdfObligations);
  const usdSummary = calcSummary(usdObligations);

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-slate-50 px-5 py-4">
        <div className="flex items-center gap-3">
          {tenant.logo_url && (
            <div className="h-12 w-12 rounded-lg bg-white p-1 border border-emerald-100 flex items-center justify-center shrink-0">
              <Image
                src={tenant.logo_url}
                alt={tenant.name}
                width={40}
                height={40}
                className="rounded-md object-contain"
              />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Bonjour, {parent.full_name} 👋
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {tenant.name}
              {tenant.city && <> · {tenant.city}</>}
            </p>
            {(tenant as any).description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 max-w-sm">
                {(tenant as any).description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* No children */}
      {children.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Aucun enfant associé</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-sm">
              Votre compte est configuré mais aucun élève n&apos;est encore associé.
              Contactez l&apos;administration de {tenant.name} pour effectuer l&apos;association.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Child selector + cards */}
      {children.length > 0 && (
        <>
          {/* Child selector */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">
              Élève sélectionné
            </p>
            {children.length === 1 ? (
              // Single child — no dropdown needed
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 w-fit shadow-sm">
                <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-100 shrink-0">
                  {selectedChild!.student.last_name.charAt(0)}
                  {selectedChild!.student.first_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedChild!.student.last_name.toUpperCase()}{" "}
                    {selectedChild!.student.post_name
                      ? selectedChild!.student.post_name.toUpperCase() + " "
                      : ""}
                    {selectedChild!.student.first_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    <code className="font-mono">{selectedChild!.student.matricule}</code>
                    {selectedChild!.student.current_class && (
                      <> · {selectedChild!.student.current_class}</>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              // Multiple children — dropdown
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" className="h-12 gap-3 pr-4 pl-3 font-normal">
                      <div className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-100 shrink-0">
                        {selectedChild!.student.last_name.charAt(0)}
                        {selectedChild!.student.first_name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedChild!.student.last_name.toUpperCase()}{" "}
                          {selectedChild!.student.first_name}
                        </p>
                        {selectedChild!.student.current_class && (
                          <p className="text-xs text-slate-500">
                            {selectedChild!.student.current_class}
                          </p>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="w-72">
                  {children.map((child, idx) => (
                    <DropdownMenuItem
                      key={child.id}
                      onClick={() => setSelectedIdx(idx)}
                      className="gap-3 py-3"
                    >
                      <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-100 shrink-0">
                        {child.student.last_name.charAt(0)}
                        {child.student.first_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {child.student.last_name.toUpperCase()}{" "}
                          {child.student.first_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <code className="font-mono">{child.student.matricule}</code>
                          {child.student.current_class && (
                            <> · {child.student.current_class}</>
                          )}
                        </p>
                      </div>
                      {idx === selectedIdx && (
                        <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Situation scolaire & financière summary */}
          {selectedChild && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Identity card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-500" />
                    Situation scolaire
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-100">
                    <PortalRow
                      label="Élève"
                      value={
                        <span className="font-semibold">
                          {selectedChild.student.last_name.toUpperCase()}{" "}
                          {selectedChild.student.post_name
                            ? selectedChild.student.post_name.toUpperCase() + " "
                            : ""}
                          {selectedChild.student.first_name}
                        </span>
                      }
                    />
                    <PortalRow
                      label="Matricule"
                      value={
                        <code className="font-mono font-bold text-slate-800">
                          {selectedChild.student.matricule}
                        </code>
                      }
                    />
                    <PortalRow
                      label="Classe"
                      value={
                        selectedChild.student.current_class ? (
                          <span className="flex items-center gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
                            {selectedChild.student.current_class}
                          </span>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                          >
                            Non inscrit
                          </Badge>
                        )
                      }
                    />
                    {selectedChild.student.current_year && (
                      <PortalRow
                        label="Année scolaire"
                        value={
                          <span className="flex items-center gap-1.5 text-xs">
                            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                            {selectedChild.student.current_year}
                          </span>
                        }
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                    Synthèse financière
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cdfObligations.length === 0 && usdObligations.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-sm text-slate-500">Aucune obligation financière.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {usdObligations.length > 0 && (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                          <h4 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                            Compte USD
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Total à payer</span>
                              <span className="font-medium text-slate-900">{formatCurrency(usdSummary.total, "USD")}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Déjà payé</span>
                              <span className="font-medium text-emerald-600">{formatCurrency(usdSummary.paid, "USD")}</span>
                            </div>
                            <div className="pt-2 border-t border-emerald-100/60 flex justify-between items-center text-sm font-semibold">
                              <span className="text-slate-700">Reste à payer</span>
                              <span className="text-rose-600">{formatCurrency(usdSummary.remaining, "USD")}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {cdfObligations.length > 0 && (
                        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                          <h4 className="text-sm font-semibold text-sky-800 mb-3 flex items-center gap-2">
                            Compte CDF
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Total à payer</span>
                              <span className="font-medium text-slate-900">{formatCurrency(cdfSummary.total, "CDF")}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Déjà payé</span>
                              <span className="font-medium text-sky-600">{formatCurrency(cdfSummary.paid, "CDF")}</span>
                            </div>
                            <div className="pt-2 border-t border-sky-100/60 flex justify-between items-center text-sm font-semibold">
                              <span className="text-slate-700">Reste à payer</span>
                              <span className="text-rose-600">{formatCurrency(cdfSummary.remaining, "CDF")}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Obligations Details */}
          {selectedChild && selectedChild.obligations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Détail des frais scolaires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-slate-500 bg-slate-50/80 rounded-t-lg">
                      <tr>
                        <th className="px-4 py-3 font-medium rounded-tl-lg">Frais</th>
                        <th className="px-4 py-3 font-medium text-right">Montant</th>
                        <th className="px-4 py-3 font-medium text-right">Payé</th>
                        <th className="px-4 py-3 font-medium text-right">Reste</th>
                        <th className="px-4 py-3 font-medium text-center">Échéance</th>
                        <th className="px-4 py-3 font-medium text-center rounded-tr-lg">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedChild.obligations.map((obs) => (
                        <tr key={obs.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {formatFeeDisplayName(obs.fee_name, obs.period)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">
                            {formatCurrency(obs.initial_amount, obs.currency)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                            {formatCurrency(obs.paid_amount, obs.currency)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600 font-medium">
                            {formatCurrency(obs.remaining_amount, obs.currency)}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500">
                            {obs.due_date ? new Date(obs.due_date).toLocaleDateString("fr-CD") : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getStatusBadge(obs.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payments & Receipts */}
          {selectedChild && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historique des paiements et Reçus</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedChild.payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">Aucun paiement enregistré</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Les paiements effectués à l&apos;école apparaîtront ici dès qu&apos;ils seront enregistrés par la comptabilité.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedChild.payments.slice(0, 3).map((payment) => (
                      <div
                        key={payment.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border ${
                          payment.status === "cancelled"
                            ? "bg-rose-50/30 border-rose-100"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`mt-1 h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${
                            payment.status === "cancelled" ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                          }`}>
                            {payment.status === "cancelled" ? <Ban className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex flex-col gap-0.5">
                                {payment.currencies && payment.currencies.length > 0 ? (
                                  payment.currencies.map((c, i) => (
                                    <p key={c.currency} className="text-sm font-bold text-slate-900">
                                      {formatCurrency(c.amount, c.currency)}
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-sm font-bold text-slate-900">
                                    {formatCurrency(payment.amount, payment.currency)}
                                  </p>
                                )}
                              </div>
                              {payment.status === "cancelled" && (
                                <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-200 bg-rose-50 h-5 px-1.5 shrink-0 self-start mt-0.5">
                                  Annulé
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Date : {new Date(payment.payment_date).toLocaleDateString("fr-CD")}
                            </p>
                            {payment.status === "cancelled" && payment.cancellation_reason && (
                              <p className="text-xs text-rose-600 mt-1 italic">
                                Motif : {payment.cancellation_reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 sm:mt-0 flex items-center justify-end gap-3">
                          {payment.receipt ? (
                            payment.status === "cancelled" ? (
                              <div className="text-right">
                                <p className="text-sm font-mono font-medium text-slate-400 line-through">
                                  {payment.receipt.receipt_number}
                                </p>
                                <p className="text-[10px] text-rose-500 font-medium">REÇU ANNULÉ</p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-4">
                                <span className="text-sm font-mono font-medium text-slate-700">
                                  {payment.receipt.receipt_number}
                                </span>
                                <ParentReceiptPreview receiptId={payment.receipt.id} />
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-slate-400 italic">Aucun reçu</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedChild.payments.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Link href="/parent/receipts">
                      <Button variant="outline" size="sm" className="gap-2">
                        Voir tous les reçus
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/parent/history">
                      <Button variant="outline" size="sm" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                        Historique complet
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Help section */}
      <Card className="bg-emerald-50/50 border-emerald-100">
        <CardContent className="flex items-center justify-between py-4 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Une question concernant les montants affichés ?
              </p>
              <p className="text-xs text-slate-500">
                La comptabilité de {tenant.name} est à votre disposition pour toute clarification.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PortalRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 gap-2">
      <span className="text-xs text-slate-500 font-medium shrink-0">{label}</span>
      <span className="text-xs text-slate-900 text-right">{value}</span>
    </div>
  );
}
