"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Plus,
  CheckCircle2,
  Archive,
  Clock,
  Edit,
  AlertCircle,
  Building2,
  Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/shared/pagination";
import { RefreshButton } from "@/components/shared/refresh-button";
import {
  SchoolYearItem,
  createSchoolYear,
  activateSchoolYear,
  archiveSchoolYear,
  updateSchoolYear,
  closeAndPrepareNextYear
} from "./actions";
import type { ClassItem, ClassYearLink } from "../classes/actions";
import { YearDetailSheet } from "./year-detail-sheet";

interface YearsClientProps {
  initialYears: SchoolYearItem[];
  classes: ClassItem[];
  links: ClassYearLink[];
}

export function YearsClient({ initialYears, classes, links }: YearsClientProps) {
  const router = useRouter();
  const [years, setYears] = useState<SchoolYearItem[]>(initialYears);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailYear, setDetailYear] = useState<SchoolYearItem | null>(null);
  const [page, setPage] = useState(1);
  const YEAR_PAGE_SIZE = 10;

  // Modal Create
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    status: "preparation" as "preparation" | "active",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Modal Edit
  const [editingYear, setEditingYear] = useState<SchoolYearItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", start_date: "", end_date: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Modal Confirm Activate
  const [confirmActivateYear, setConfirmActivateYear] = useState<SchoolYearItem | null>(null);

  // Modal Confirm Archive
  const [confirmArchiveYear, setConfirmArchiveYear] = useState<SchoolYearItem | null>(null);

  // Modal Close & Prepare
  const [prepareNextYearOpen, setPrepareNextYearOpen] = useState(false);
  const [nextYearForm, setNextYearForm] = useState({ name: "", start_date: "", end_date: "" });

  const activeYear = years.find(y => y.status === "active");
  const totalPages = Math.max(1, Math.ceil(years.length / YEAR_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * YEAR_PAGE_SIZE;
  const visibleYears = years.slice(startIndex, startIndex + YEAR_PAGE_SIZE);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCreate(true);
    setCreateError(null);

    try {
      const res = await createSchoolYear(createForm);
      if (res.success && res.year) {
        const newYear = { ...res.year, classCount: 0, status: res.year.status as "preparation" | "active" | "archived" };
        // If created as active, archive the previous active year in local state
        if (newYear.status === "active") {
          setYears(prev => [newYear, ...prev.map(y => y.status === "active" ? { ...y, status: "archived" as const } : y)]);
        } else {
          setYears(prev => [newYear, ...prev]);
        }
        setCreateOpen(false);
        setCreateForm({ name: "", start_date: "", end_date: "", status: "preparation" });
      } else {
        setCreateError(res.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleActivate = async (year: SchoolYearItem) => {
    setLoadingAction(year.id);
    setActionError(null);
    setConfirmActivateYear(null);

    try {
      const res = await activateSchoolYear(year.id);
      if (res.success) {
        setYears(prev => prev.map(y => {
          if (y.id === year.id) return { ...y, status: "active" as const };
          if (y.status === "active") return { ...y, status: "archived" as const };
          return y;
        }));
      } else {
        setActionError(res.error || "Impossible d'activer cette année.");
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleArchive = async (year: SchoolYearItem) => {
    setLoadingAction(year.id);
    setActionError(null);
    setConfirmArchiveYear(null);

    try {
      const res = await archiveSchoolYear(year.id);
      if (res.success) {
        setYears(prev => prev.map(y => y.id === year.id ? { ...y, status: "archived" as const } : y));
      } else {
        setActionError(res.error || "Impossible d'archiver cette année.");
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCloseAndPrepare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYear) return;

    setLoadingAction("prepare");
    setActionError(null);

    try {
      const res = await closeAndPrepareNextYear(activeYear.id, nextYearForm);
      if (res.success && res.newYear) {
        // Update local state
        setYears(prev => [
          { ...res.newYear, classCount: res.copiedClassesCount, status: "preparation" },
          ...prev.map(y => y.id === activeYear.id ? { ...y, status: "archived" as const } : y)
        ]);
        setPrepareNextYearOpen(false);
        setNextYearForm({ name: "", start_date: "", end_date: "" });
      } else {
        setActionError(res.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoadingAction(null);
    }
  };


  const handleOpenEdit = (year: SchoolYearItem) => {
    setEditingYear(year);
    setEditForm({
      name: year.name,
      start_date: year.start_date,
      end_date: year.end_date,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYear) return;
    setSubmittingEdit(true);
    setEditError(null);

    try {
      const res = await updateSchoolYear({
        id: editingYear.id,
        name: editForm.name,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
      });

      if (res.success && res.year) {
        setYears(prev => prev.map(y => y.id === editingYear.id ? { ...y, name: editForm.name, start_date: editForm.start_date, end_date: editForm.end_date } : y));
        setEditingYear(null);
      } else {
        setEditError(res.error || "Impossible de mettre à jour l'année.");
      }
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSubmittingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Années Scolaires</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organisez les périodes d'enseignement, préparez les rentrées futures et archivez les années écoulées.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={() => router.refresh()} />
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle année scolaire
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Active Year Highlight Card */}
      <Card className="rounded-[18px] border-slate-200 bg-gradient-to-br from-emerald-50/80 via-white to-white shadow-sm">
        <CardContent className="p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Année scolaire en cours</span>
                  <Badge className="bg-emerald-600 text-white border-0 hover:bg-emerald-600">Active</Badge>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  {activeYear ? activeYear.name : "Aucune année active"}
                </h2>
                {activeYear ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Du {new Date(activeYear.start_date).toLocaleDateString("fr-FR")} au {new Date(activeYear.end_date).toLocaleDateString("fr-FR")} · {activeYear.classCount} classe{activeYear.classCount > 1 ? "s" : ""} inscrite{activeYear.classCount > 1 ? "s" : ""}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Veuillez activer une année scolaire pour démarrer les opérations de l'établissement.
                  </p>
                )}
              </div>
            </div>

            {activeYear && (
              <div className="flex items-center gap-2">
                <Link href="/school/classes">
                  <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <Building2 className="h-3.5 w-3.5" />
                    Gérer les classes
                  </Button>
                </Link>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // Try to guess next year name if possible, e.g. "2025-2026" -> "2026-2027"
                    let nextName = "";
                    const match = activeYear.name.match(/^(\d{4})\s*-\s*(\d{4})$/);
                    if (match) {
                      nextName = `${parseInt(match[1]) + 1}-${parseInt(match[2]) + 1}`;
                    }
                    setNextYearForm({ name: nextName, start_date: "", end_date: "" });
                    setPrepareNextYearOpen(true);
                  }}
                  className="text-xs bg-emerald-700 hover:bg-emerald-800"
                >
                  Clôturer & Préparer la suite
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List of all School Years */}
      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <CardTitle className="text-base font-semibold text-slate-900">Historique & Préparation des Années</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <tr className="border-b border-slate-200/80">
                <th className="px-5 py-3">Année Scolaire</th>
                <th className="px-5 py-3">Période</th>
                <th className="px-5 py-3">Classes associées</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {visibleYears.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Aucune année scolaire créée pour le moment.
                  </td>
                </tr>
              ) : (
                visibleYears.map((year) => (
                  <tr key={year.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${year.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : year.status === "preparation"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                          }`}>
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{year.name}</p>
                          <p className="text-xs text-muted-foreground">Créée le {new Date(year.created_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-800">
                        {new Date(year.start_date).toLocaleDateString("fr-FR")} &rarr; {new Date(year.end_date).toLocaleDateString("fr-FR")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        <Building2 className="h-3 w-3 text-slate-500" />
                        {year.classCount} classe{year.classCount > 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {year.status === "active" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          En cours (Active)
                        </Badge>
                      ) : year.status === "preparation" ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          En préparation
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">
                          Archivée
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {year.status === "preparation" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            disabled={loadingAction === year.id}
                            onClick={() => setConfirmActivateYear(year)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Activer
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setDetailYear(year)}
                          title="Voir le détail"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleOpenEdit(year)}
                          title="Modifier"
                        >
                          <Edit className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {years.length > YEAR_PAGE_SIZE && (
            <Pagination page={safePage} pageSize={YEAR_PAGE_SIZE} total={years.length} onPageChange={(nextPage) => setPage(nextPage)} />
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader className="pr-8">
            <DialogTitle>Nouvelle Année Scolaire</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-6">
            {createError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs">
                {createError}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Libellé de l'année</label>
              <Input
                placeholder="2025 - 2026"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                required
                disabled={submittingCreate}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Date de rentrée</label>
                <Input
                  type="date"
                  value={createForm.start_date}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                  disabled={submittingCreate}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Date de clôture</label>
                <Input
                  type="date"
                  value={createForm.end_date}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, end_date: e.target.value }))}
                  required
                  disabled={submittingCreate}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Statut initial</label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs"
                value={createForm.status}
                onChange={(e) => setCreateForm(prev => ({ ...prev, status: e.target.value as any }))}
                disabled={submittingCreate}
              >
                <option value="preparation">En préparation (recommandé)</option>
                <option value="active">Active immédiatement (archive l'actuelle)</option>
              </select>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submittingCreate}>
                Annuler
              </Button>
              <Button type="submit" disabled={submittingCreate}>
                {submittingCreate ? "Création..." : "Créer l'année"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingYear} onOpenChange={(open) => { if (!open) setEditingYear(null); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Modifier l'Année Scolaire</DialogTitle>
            <DialogDescription>
              Ajustez le nom ou les dates limites de l'année scolaire.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            {editError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs">
                {editError}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Libellé</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                required
                disabled={submittingEdit}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Date de début</label>
                <Input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                  disabled={submittingEdit}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Date de fin</label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, end_date: e.target.value }))}
                  required
                  disabled={submittingEdit}
                />
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setEditingYear(null)} disabled={submittingEdit}>
                Annuler
              </Button>
              <Button type="submit" disabled={submittingEdit}>
                {submittingEdit ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal: Activate School Year */}
      <Dialog open={!!confirmActivateYear} onOpenChange={(open) => { if (!open) setConfirmActivateYear(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-emerald-600" />
              Activer l'année {confirmActivateYear?.name} ?
            </DialogTitle>
            <DialogDescription>
              Cette action fera basculer l'établissement sur cette nouvelle année scolaire.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-slate-600 space-y-2">
            <p>
              En activant cette année :
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              <li>L'année actuellement en cours ({activeYear ? activeYear.name : "aucune"}) sera automatiquement basculée en <strong>Archivée</strong>.</li>
              <li>Aucune donnée historique ne sera supprimée.</li>
              <li>Vous pourrez associer et configurer les classes pour cette nouvelle année scolaire.</li>
            </ul>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setConfirmActivateYear(null)}>
              Annuler
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => confirmActivateYear && handleActivate(confirmActivateYear)}
            >
              Confirmer l'activation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal: Archive School Year */}
      <Dialog open={!!confirmArchiveYear} onOpenChange={(open) => { if (!open) setConfirmArchiveYear(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Archive className="h-5 w-5 text-rose-500" />
              Clôturer l&apos;année {confirmArchiveYear?.name} ?
            </DialogTitle>
            <DialogDescription>
              Cette action clôture l’année scolaire et la passe en statut Archivée.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-slate-600 space-y-2">
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              <li>L’année <strong>{confirmArchiveYear?.name}</strong> ne sera plus l’année active.</li>
              <li>Aucune donnée historique (paiements, obligations) ne sera supprimée.</li>
              <li>Vous devrez activer une autre année pour reprendre les opérations.</li>
            </ul>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setConfirmArchiveYear(null)}>
              Annuler
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={loadingAction === confirmArchiveYear?.id}
              onClick={() => confirmArchiveYear && handleArchive(confirmArchiveYear)}
            >
              {loadingAction === confirmArchiveYear?.id ? "Archivage..." : "Confirmer l’archivage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal Close and Prepare Next Year */}
      <Dialog open={prepareNextYearOpen} onOpenChange={setPrepareNextYearOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Archive className="h-5 w-5 text-emerald-600" />
              Clôturer {activeYear?.name} et préparer la suite
            </DialogTitle>
            <DialogDescription>
              Cette action clôture l'année en cours et prépare automatiquement la suivante avec les mêmes classes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCloseAndPrepare} className="space-y-4 py-2">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 space-y-2 mb-4">
              <p><strong>Que va-t-il se passer ?</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-1 text-slate-600">
                <li>L'année <span className="font-semibold">{activeYear?.name}</span> sera archivée.</li>
                <li>Ses <strong>{activeYear?.classCount} classes</strong> seront dupliquées pour la nouvelle année.</li>
                <li>La nouvelle année sera en statut <Badge variant="outline" className="text-[10px] uppercase">Préparation</Badge>.</li>
                <li>Aucun élève, parent ni historique financier ne sera copié ou supprimé.</li>
              </ul>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Nom de la nouvelle année</label>
              <Input
                placeholder="Ex: 2026-2027"
                value={nextYearForm.name}
                onChange={(e) => setNextYearForm(prev => ({ ...prev, name: e.target.value }))}
                required
                disabled={loadingAction === "prepare"}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Date de rentrée</label>
                <Input
                  type="date"
                  value={nextYearForm.start_date}
                  onChange={(e) => setNextYearForm(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                  disabled={loadingAction === "prepare"}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Date de clôture</label>
                <Input
                  type="date"
                  value={nextYearForm.end_date}
                  onChange={(e) => setNextYearForm(prev => ({ ...prev, end_date: e.target.value }))}
                  required
                  disabled={loadingAction === "prepare"}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setPrepareNextYearOpen(false)} disabled={loadingAction === "prepare"}>
                Annuler
              </Button>
              <Button type="submit" disabled={loadingAction === "prepare"} className="bg-emerald-600 hover:bg-emerald-700">
                {loadingAction === "prepare" ? "Opération en cours..." : "Clôturer et préparer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Year Detail Drawer */}
      <YearDetailSheet
        year={detailYear}
        classes={classes}
        links={links}
        open={!!detailYear}
        onOpenChange={(open) => { if (!open) setDetailYear(null); }}
      />
    </div>
  );
}
