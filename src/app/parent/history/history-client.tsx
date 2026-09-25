"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Receipt,
  Ban,
  FileText,
  ChevronDown,
  ArrowRight,
  AlertCircle,
  History,
  User,
  Banknote,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ParentHistoryResult,
  ParentHistoryFilters,
  PaymentHistoryItem,
  PaymentAllocationData,
} from "./actions";
import { ParentReceiptPreview } from "../receipt-preview";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-CD", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("fr-CD")} ${currency}`;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-CD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-CD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getMonthLabel(month: number | null): string {
  if (!month) return "";
  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];
  return months[(month - 1) % 12] || `Mois ${month}`;
}

function getPaymentStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shrink-0">
          Validé
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-200 shrink-0">
          Annulé
        </Badge>
      );
    default:
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200 shrink-0">
          {status}
        </Badge>
      );
  }
}

// ─── Payment Detail Dialog ────────────────────────────────────────────────────

function PaymentDetailDialog({
  payment,
  open,
  onClose,
}: {
  payment: PaymentHistoryItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!payment) return null;

  const isCancelled = payment.status === "cancelled";

  // Group allocations by school year
  const allocationsByYear = payment.allocations.reduce<
    Record<string, { yearName: string; isPriorDebt: boolean; items: PaymentAllocationData[] }>
  >((acc, alloc) => {
    const key = alloc.obligation_school_year_id;
    if (!acc[key]) {
      acc[key] = {
        yearName: alloc.obligation_school_year_name,
        isPriorDebt: alloc.is_prior_debt,
        items: [],
      };
    }
    acc[key].items.push(alloc);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div
          className={`p-6 pb-4 ${
            isCancelled
              ? "bg-gradient-to-br from-rose-50 to-rose-100/50"
              : "bg-gradient-to-br from-emerald-50 to-emerald-100/50"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`h-11 w-11 rounded-full flex items-center justify-center ${
                isCancelled
                  ? "bg-rose-100 text-rose-600"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isCancelled ? (
                <Ban className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Paiement</p>
              <div className="flex flex-col gap-0.5">
                {payment.currencies && payment.currencies.length > 0 ? (
                  payment.currencies.map(c => (
                    <p key={c.currency} className="text-xl font-bold text-slate-900 leading-tight">
                      {formatCurrency(c.amount, c.currency)}
                    </p>
                  ))
                ) : (
                  <p className="text-xl font-bold text-slate-900 leading-tight">
                    {formatCurrency(payment.amount, payment.currency)}
                  </p>
                )}
              </div>
            </div>
            <div className="ml-auto">{getPaymentStatusBadge(payment.status)}</div>
          </div>

          {/* Key info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/60 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-1">
                Élève
              </p>
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {payment.student_name}
              </p>
            </div>
            <div className="bg-white/60 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-1">
                Date
              </p>
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {formatDateShort(payment.payment_date)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Cancellation info */}
          {isCancelled && (
            <div className="rounded-lg bg-rose-50 border border-rose-100 p-4">
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">
                Informations d'annulation
              </p>
              {payment.cancellation_reason && (
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">Motif</span>
                  <span className="text-slate-800 font-medium text-right max-w-[60%]">
                    {payment.cancellation_reason}
                  </span>
                </div>
              )}
              {payment.cancelled_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Date d'annulation</span>
                  <span className="text-slate-800 font-medium">
                    {formatDateShort(payment.cancelled_at)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Receipt */}
          {payment.receipt_id && !isCancelled && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Reçu</p>
                <p className="text-sm font-mono font-medium text-slate-800">
                  {payment.receipt_number}
                </p>
              </div>
              <ParentReceiptPreview receiptId={payment.receipt_id} />
            </div>
          )}
          {payment.receipt_id && isCancelled && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Reçu</p>
                <p className="text-sm font-mono font-medium text-slate-400 line-through">
                  {payment.receipt_number}
                </p>
                <p className="text-[10px] text-rose-500 font-medium mt-0.5">REÇU ANNULÉ</p>
              </div>
            </div>
          )}

          {/* Allocations */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-800">Affectations</p>
            </div>

            {payment.allocations.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Aucune affectation enregistrée.</p>
            ) : (
              <div className="space-y-3">
                {Object.values(allocationsByYear).map((group) => (
                  <div
                    key={group.yearName}
                    className={`rounded-lg border p-4 ${
                      group.isPriorDebt
                        ? "bg-amber-50/60 border-amber-100"
                        : "bg-sky-50/40 border-sky-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">
                        {group.yearName}
                      </span>
                      {group.isPriorDebt && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 h-4 px-1.5">
                          Dette antérieure
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((alloc) => (
                        <div
                          key={alloc.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-slate-600">
                            {alloc.fee_name}
                            {alloc.fee_period ? ` — ${getMonthLabel(alloc.fee_period)}` : ""}
                          </span>
                          <span className="font-semibold text-slate-900 ml-2 shrink-0">
                            {formatCurrency(alloc.amount, alloc.currency || payment.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Total check */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Total affecté</span>
                  <div className="text-right flex flex-col gap-0.5">
                    {payment.currencies && payment.currencies.length > 0 ? (
                      payment.currencies.map(c => {
                        const totalForCurrency = payment.allocations
                          .filter(a => (a as any).currency === c.currency)
                          .reduce((s, a) => s + a.amount, 0);
                        return (
                          <span key={c.currency} className="text-sm font-bold text-slate-900">
                            {formatCurrency(totalForCurrency > 0 ? totalForCurrency : c.amount, c.currency)}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-sm font-bold text-slate-900">
                        {formatCurrency(
                          payment.allocations.reduce((s, a) => s + a.amount, 0),
                          payment.currency
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Card ─────────────────────────────────────────────────────────────

function PaymentCard({
  payment,
  onClick,
}: {
  payment: PaymentHistoryItem;
  onClick: () => void;
}) {
  const isCancelled = payment.status === "cancelled";

  return (
    <button
      id={`payment-card-${payment.id}`}
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all duration-200 hover:shadow-md active:scale-[0.99] group ${
        isCancelled
          ? "bg-rose-50/30 border-rose-100 hover:border-rose-200"
          : "bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20"
      }`}
    >
      <div className="p-4 flex items-start justify-between gap-4">
        {/* Left: icon + info */}
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${
              isCancelled
                ? "bg-rose-100 text-rose-500"
                : "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200"
            }`}
          >
            {isCancelled ? (
              <Ban className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {payment.currencies && payment.currencies.length > 0 ? (
                  payment.currencies.map((c, i) => (
                    <span key={c.currency} className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      {i > 0 && <span className="text-slate-300 font-normal">+</span>}
                      {formatCurrency(c.amount, c.currency)}
                    </span>
                  ))
                ) : (
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(payment.amount, payment.currency)}
                  </span>
                )}
              </div>
              {getPaymentStatusBadge(payment.status)}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <User className="h-3 w-3" />
              {payment.student_name}
            </p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              {formatDate(payment.payment_date)}
            </p>
            {isCancelled && payment.cancellation_reason && (
              <p className="text-xs text-rose-500 italic mt-1 line-clamp-1">
                {payment.cancellation_reason}
              </p>
            )}
            {payment.receipt_number && !isCancelled && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {payment.receipt_number}
              </p>
            )}
          </div>
        </div>

        {/* Right: arrow */}
        <div className="shrink-0 flex items-center">
          <ChevronDown className="h-4 w-4 text-slate-300 group-hover:text-slate-500 -rotate-90 transition-colors" />
        </div>
      </div>
    </button>
  );
}

// ─── Filters Bar ─────────────────────────────────────────────────────────────

interface FiltersBarProps {
  children: { id: string; name: string }[];
  schoolYears: { id: string; name: string }[];
  currencies: string[];
  filters: ParentHistoryFilters;
  onFilter: (key: string, value: string) => void;
}

function FiltersBar({
  children,
  schoolYears,
  currencies,
  filters,
  onFilter,
}: FiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
        <Filter className="h-3.5 w-3.5" />
        Filtres
      </div>

      {/* Student filter */}
      {children.length > 1 && (
        <Select
          value={filters.studentId || "all"}
          onValueChange={(v) => v !== null && onFilter("student", v)}
        >
          <SelectTrigger
            className="h-9 w-auto min-w-[160px] text-sm border-slate-200 bg-white"
            id="filter-student"
            aria-label="Filtrer par enfant"
          >
            <User className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
            <SelectValue placeholder="Tous les enfants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les enfants</SelectItem>
            {children.map((child) => (
              <SelectItem key={child.id} value={child.id}>
                {child.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* School year filter */}
      {schoolYears.length > 0 && (
        <Select
          value={filters.schoolYearId || "all"}
          onValueChange={(v) => v !== null && onFilter("year", v)}
        >
          <SelectTrigger
            className="h-9 w-auto min-w-[150px] text-sm border-slate-200 bg-white"
            id="filter-year"
            aria-label="Filtrer par année scolaire"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
            <SelectValue placeholder="Toutes les années" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les années</SelectItem>
            {schoolYears.map((sy) => (
              <SelectItem key={sy.id} value={sy.id}>
                {sy.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Currency filter */}
      {currencies.length > 1 && (
        <Select
          value={filters.currency || "all"}
          onValueChange={(v) => v !== null && onFilter("currency", v)}
        >
          <SelectTrigger
            className="h-9 w-auto min-w-[130px] text-sm border-slate-200 bg-white"
            id="filter-currency"
            aria-label="Filtrer par devise"
          >
            <Banknote className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
            <SelectValue placeholder="Toutes les devises" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les devises</SelectItem>
            {currencies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Reset */}
      {(filters.studentId !== "all" ||
        filters.schoolYearId !== "all" ||
        filters.currency !== "all") && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-slate-500 hover:text-slate-700 px-2"
          id="reset-filters"
          onClick={() => {
            onFilter("_reset", "");
          }}
        >
          Réinitialiser
        </Button>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  filters,
  childrenList,
}: {
  filters: ParentHistoryFilters;
  childrenList: { id: string; name: string }[];
}) {
  let message = "Aucun paiement enregistré pour le moment.";
  let sub =
    "Les paiements effectués à l'école apparaîtront ici dès qu'ils auront été enregistrés par la comptabilité.";

  const selectedChild = childrenList.find((c) => c.id === filters.studentId);
  if (selectedChild) {
    message = `Aucun paiement enregistré pour ${selectedChild.name}.`;
    sub = "Vérifiez les filtres ou contactez la comptabilité.";
  } else if (filters.schoolYearId && filters.schoolYearId !== "all") {
    message = "Aucun paiement enregistré pour cette année scolaire.";
    sub = "Essayez de changer l'année ou les filtres.";
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Receipt className="h-7 w-7 text-slate-300" />
      </div>
      <p className="text-sm font-semibold text-slate-600 mb-1">{message}</p>
      <p className="text-xs text-slate-400 max-w-xs">{sub}</p>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-xs text-slate-500">
        {from}–{to} sur {total} paiements
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          id="pagination-prev"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="h-9 w-9 p-0"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-slate-700 font-medium px-2">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          id="pagination-next"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="h-9 w-9 p-0"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

interface ParentHistoryClientProps {
  result: ParentHistoryResult;
  filters: ParentHistoryFilters;
}

export function ParentHistoryClient({ result, filters }: ParentHistoryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedPayment, setSelectedPayment] = useState<PaymentHistoryItem | null>(null);

  const { payments, total, children, schoolYears, currencies } = result;

  const buildUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams();
      if (filters.tenantId) params.set("tenant", filters.tenantId);
      if (filters.studentId && filters.studentId !== "all")
        params.set("student", filters.studentId);
      if (filters.schoolYearId && filters.schoolYearId !== "all")
        params.set("year", filters.schoolYearId);
      if (filters.currency && filters.currency !== "all")
        params.set("currency", filters.currency);
      if (filters.page && filters.page > 1) params.set("page", String(filters.page));

      // Apply updates
      for (const [key, val] of Object.entries(updates)) {
        if (val === "" || val === "all") {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      }
      // Reset to page 1 when filters change (not when changing page)
      if (!("page" in updates)) params.delete("page");

      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [filters, pathname]
  );

  const handleFilter = useCallback(
    (key: string, value: string) => {
      if (key === "_reset") {
        const params = new URLSearchParams();
        if (filters.tenantId) params.set("tenant", filters.tenantId);
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
        return;
      }
      router.push(buildUrl({ [key]: value }));
    },
    [buildUrl, filters.tenantId, pathname, router]
  );

  const handlePage = useCallback(
    (p: number) => {
      router.push(buildUrl({ page: String(p) }));
    },
    [buildUrl, router]
  );

  const noChildrenAtAll = children.length === 0;

  return (
    <>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
          <History className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Historique des paiements</h1>
          <p className="text-xs text-slate-500">
            Consultez tous les paiements enregistrés pour vos enfants.
          </p>
        </div>
      </div>

      {/* No children state */}
      {noChildrenAtAll ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <User className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">
              Aucun enfant associé à votre compte.
            </p>
            <p className="text-xs text-slate-400 max-w-xs">
              Contactez l'administration de l'établissement pour associer vos enfants à votre compte.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <Card>
            <CardHeader className="pb-4">
              <FiltersBar
                children={children}
                schoolYears={schoolYears}
                currencies={currencies}
                filters={filters}
                onFilter={handleFilter}
              />
            </CardHeader>
          </Card>

          {/* Payments list */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Paiements</CardTitle>
                {total > 0 && (
                  <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5 font-medium">
                    {total} au total
                  </span>
                )}
              </div>
              {currencies.length > 1 && filters.currency !== "all" && (
                <CardDescription className="text-xs">
                  Affichage filtré : {filters.currency} uniquement. Les montants ne sont pas convertis.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <EmptyState filters={filters} childrenList={children} />
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <PaymentCard
                      key={payment.id}
                      payment={payment}
                      onClick={() => setSelectedPayment(payment)}
                    />
                  ))}
                </div>
              )}

              <Pagination
                page={filters.page || 1}
                total={total}
                limit={20}
                onPage={handlePage}
              />
            </CardContent>
          </Card>

          {/* Currency disclaimer (when multiple currencies, show totals separated) */}
          {payments.length > 0 && currencies.length > 1 && (filters.currency === "all" || !filters.currency) && (
            <Card className="bg-amber-50/40 border-amber-100">
              <CardContent className="flex items-start gap-3 py-4">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Devises multiples</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Les paiements sont affichés dans leur devise d'origine. Utilisez le filtre devise pour afficher une seule monnaie.
                    Les montants ne sont jamais convertis automatiquement.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Payment detail dialog */}
      <PaymentDetailDialog
        payment={selectedPayment}
        open={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </>
  );
}
