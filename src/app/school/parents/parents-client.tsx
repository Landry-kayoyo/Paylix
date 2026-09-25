"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, Plus, Search, MoreVertical, Mail, Phone,
  Eye, Edit, UserX, UserCheck, Send, Loader2, AlertCircle, X,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ParentStatusBadge } from "./parent-status-badge";
import { CreateParentDialog } from "./create-parent-dialog";
import {
  getParentsData,
  resendParentInvitation,
  deactivateParent,
  reactivateParent,
  type ParentItem,
} from "./actions";

const PAGE_SIZE = 25;

interface ParentsClientProps {
  initialParents: (ParentItem & { children_count: number })[];
  initialTotal: number;
}

export function ParentsClient({ initialParents, initialTotal }: ParentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [parents, setParents] = useState(initialParents);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
      router.replace("/school/parents", { scroll: false });
    }
  }, [router, searchParams]);
  const [deactivateTarget, setDeactivateTarget] = useState<ParentItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── Toast helper ──────────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchParents = useCallback(async (pg = 1, s = search, sf = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getParentsData(pg, PAGE_SIZE, {
        search: s || undefined,
        status: sf !== "all" ? sf : undefined,
      });
      setParents(result.parents);
      setTotal(result.total);
      setPage(pg);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  // ── Search handler ─────────────────────────────────────────────────────────────
  function handleSearchChange(val: string) {
    setSearch(val);
    startTransition(() => {
      fetchParents(1, val, statusFilter);
    });
  }

  // ── Status filter ──────────────────────────────────────────────────────────────
  function handleStatusFilter(val: string) {
    setStatusFilter(val);
    fetchParents(1, search, val);
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  async function handleResendInvitation(parent: ParentItem) {
    setActionLoading(true);
    try {
      const res = await resendParentInvitation(parent.id);
      if (res.success) {
        showToast(`Invitation renvoyée à ${parent.full_name}.`);
      } else {
        showToast(`Erreur : ${res.error}`);
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await deactivateParent(deactivateTarget.id);
      if (res.success) {
        showToast(`Le compte de ${deactivateTarget.full_name} a été désactivé.`);
        setDeactivateTarget(null);
        fetchParents(page);
      } else {
        setActionError(res.error || "Erreur de désactivation.");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate(parent: ParentItem) {
    setActionLoading(true);
    try {
      const res = await reactivateParent(parent.id);
      if (res.success) {
        showToast(`Le compte de ${parent.full_name} a été réactivé.`);
        fetchParents(page);
      } else {
        showToast(`Erreur : ${res.error}`);
      }
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg text-sm text-emerald-800 animate-in slide-in-from-bottom-4 duration-300">
          <UserCheck className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)}>
            <X className="h-4 w-4 text-emerald-600 hover:text-emerald-900" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[2.1rem] font-bold tracking-[-0.04em] text-slate-900">Parents / Tuteurs</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} parent{total !== 1 ? "s" : ""} dans l'établissement
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-11 shrink-0 gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Ajouter un parent
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="parents-search"
            placeholder="Rechercher par nom, téléphone, email…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-white pl-10 text-sm shadow-sm transition-all placeholder:text-slate-400 focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-100"
          />
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
          {(["all", "invited", "active", "inactive"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter(s)}
              className={statusFilter === s
                ? "h-9 rounded-xl border-0 bg-emerald-600 text-white hover:bg-emerald-700"
                : "h-9 rounded-xl border-0 bg-transparent text-slate-700 hover:bg-white hover:text-slate-900"}
            >
              {s === "all" ? "Tous" : s === "invited" ? "Invités" : s === "active" ? "Actifs" : "Inactifs"}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        ) : error ? (
          <CardContent>
            <ErrorState
              title="Impossible de charger les parents"
              description={error}
              onRetry={() => fetchParents(page)}
            />
          </CardContent>
        ) : parents.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={Users}
              title="Aucun parent trouvé"
              description={
                search || statusFilter !== "all"
                  ? "Aucun parent ne correspond à vos critères de recherche."
                  : "Aucun parent n'a encore été ajouté à cet établissement."
              }
              action={
                !search && statusFilter === "all" ? (
                  <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Ajouter le premier parent
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        ) : (
          <>
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
              <p className="text-sm font-medium text-slate-600">
                {total} résultat{total !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="bg-white">
              <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(150px,1fr)_minmax(180px,1.3fr)_auto_auto_auto] items-center gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <div>Nom complet</div>
                <div>Téléphone</div>
                <div>Email</div>
                <div className="text-center">Nb enfants</div>
                <div className="text-center">Statut</div>
                <div className="text-right">Action</div>
              </div>
              <div className="divide-y divide-slate-200">
                {parents.map((parent) => (
                  <ParentRow
                    key={parent.id}
                    parent={parent}
                    onResendInvitation={() => handleResendInvitation(parent)}
                    onDeactivate={() => {
                      setActionError(null);
                      setDeactivateTarget(parent);
                    }}
                    onReactivate={() => handleReactivate(parent)}
                    actionLoading={actionLoading}
                  />
                ))}
              </div>
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={(p) => fetchParents(p)}
            />
          </>
        )}
      </Card>

      {/* Create Dialog */}
      <CreateParentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(parentId) => {
          showToast("Parent créé avec succès. L'invitation a été envoyée.");
          fetchParents(1);
        }}
      />

      {/* Deactivate Confirm Dialog */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(val) => { if (!val && !actionLoading) setDeactivateTarget(null); }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <UserX className="h-5 w-5" />
              Désactiver le compte
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de désactiver le compte de{" "}
              <strong>
                {deactivateTarget?.full_name}
              </strong>
              . Le compte sera suspendu mais toutes les données seront conservées.
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
              disabled={actionLoading}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Traitement…</>
              ) : (
                "Désactiver"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Parent Row ────────────────────────────────────────────────────────────────

interface ParentRowProps {
  parent: ParentItem & { children_count: number };
  onResendInvitation: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  actionLoading: boolean;
}

function ParentRow({
  parent,
  onResendInvitation,
  onDeactivate,
  onReactivate,
  actionLoading,
}: ParentRowProps) {
  return (
    <div className="grid w-full grid-cols-[minmax(0,2.2fr)_minmax(150px,1fr)_minmax(180px,1.3fr)_auto_auto_auto] items-center gap-4 px-6 py-5 transition-colors hover:bg-slate-50/80 group odd:bg-white even:bg-slate-50/30">
      <div className="min-w-0 py-1">
        <p className="text-[1.02rem] font-semibold text-slate-900">
          {parent.full_name}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{parent.phone || "—"}</span>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{parent.email || "—"}</span>
      </div>

      <div className="flex items-center justify-center">
        {parent.children_count > 0 ? (
          <Badge variant="secondary" className="rounded-full border border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700">
            {parent.children_count} enfant{parent.children_count !== 1 ? "s" : ""}
          </Badge>
        ) : (
          <span className="text-xs text-slate-400">0 enfant</span>
        )}
      </div>

      <div className="flex items-center justify-center">
        <ParentStatusBadge status={parent.account_status} />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900">
              <MoreVertical className="h-4 w-4" />
            </Button>
          } />
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => window.location.href = `/school/parents/${parent.id}`} className="gap-2">
              <Eye className="h-4 w-4" />
              Voir la fiche
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.location.href = `/school/parents/${parent.id}?edit=true`} className="gap-2">
              <Edit className="h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            {parent.account_status === "invited" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onResendInvitation}
                  disabled={actionLoading}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Renvoyer l'invitation
                </DropdownMenuItem>
              </>
            )}
            {parent.account_status === "active" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDeactivate}
                  disabled={actionLoading}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <UserX className="h-4 w-4" />
                  Désactiver le compte
                </DropdownMenuItem>
              </>
            )}
            {parent.account_status === "inactive" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onReactivate}
                  disabled={actionLoading}
                  className="gap-2 text-emerald-600"
                >
                  <UserCheck className="h-4 w-4" />
                  Réactiver le compte
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
