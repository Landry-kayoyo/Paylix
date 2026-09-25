"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit,
  Calendar,
  AlertCircle,
  Info,
  Layers,
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
  ClassItem,
  SchoolYearSimple,
  ClassYearLink,
  createClass,
  createClassesBulk,
  updateClass,
  toggleClassYearAssociation
} from "./actions";
import Link from "next/link";
import { ClassDetailSheet } from "./class-detail-sheet";

interface ClassesClientProps {
  initialClasses: ClassItem[];
  years: SchoolYearSimple[];
  initialLinks: ClassYearLink[];
}

export function ClassesClient({ initialClasses, years, initialLinks }: ClassesClientProps) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [links, setLinks] = useState<ClassYearLink[]>(initialLinks);
  const [detailClass, setDetailClass] = useState<ClassItem | null>(null);
  const [page, setPage] = useState(1);
  const CLASS_PAGE_SIZE = 10;

  // Default to active school year, or first available
  const activeYear = years.find(y => y.status === "active") || years[0] || null;
  const [selectedYearId, setSelectedYearId] = useState<string>(activeYear?.id || "");

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "associated" | "unassociated">("all");
  const [togglingClassId, setTogglingClassId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    names: "",
    bulk: false,
    status: "active" as "active" | "inactive",
    associateWithYear: true,
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Edit Modal
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", status: "active" as "active" | "inactive" });
  const [editError, setEditError] = useState<string | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const selectedYear = years.find(y => y.id === selectedYearId);

  // Set of class IDs associated with the selected school year
  const associatedClassIds = new Set(
    links
      .filter(l => l.school_year_id === selectedYearId)
      .map(l => l.class_id)
  );

  const filteredClasses = classes.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase());

    const isAssociated = associatedClassIds.has(c.id);

    if (filterMode === "associated") return matchesSearch && isAssociated;
    if (filterMode === "unassociated") return matchesSearch && !isAssociated;
    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / CLASS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * CLASS_PAGE_SIZE;
  const visibleClasses = filteredClasses.slice(startIndex, startIndex + CLASS_PAGE_SIZE);

  const handleToggle = async (classItem: ClassItem, currentAssociated: boolean) => {
    if (!selectedYearId) return;
    setTogglingClassId(classItem.id);
    setActionError(null);

    try {
      const res = await toggleClassYearAssociation(classItem.id, selectedYearId, !currentAssociated);
      if (res.success) {
        if (!currentAssociated) {
          // Add link locally
          setLinks(prev => [...prev, { id: "temp-" + Date.now(), class_id: classItem.id, school_year_id: selectedYearId }]);
        } else {
          // Remove link locally
          setLinks(prev => prev.filter(l => !(l.class_id === classItem.id && l.school_year_id === selectedYearId)));
        }

      } else {
        setActionError(res.error || "Une erreur est survenue lors de l'association.");
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setTogglingClassId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCreate(true);
    setCreateError(null);

    try {
      const res = createForm.bulk
        ? await createClassesBulk({
            names: createForm.names,
            status: createForm.status,
            associateWithYearId: createForm.associateWithYear && selectedYearId ? selectedYearId : undefined,
          })
        : await createClass({
            name: createForm.name,
            status: createForm.status,
            associateWithYearId: createForm.associateWithYear && selectedYearId ? selectedYearId : undefined,
          });

      const createdClasses: ClassItem[] = res.success
        ? ("classes" in res ? (res.classes || []) : "class" in res && res.class ? [res.class] : [])
        : [];

      if (createdClasses.length > 0) {
        // Add new class directly to local state for immediate display
        setClasses(prev => [...prev, ...createdClasses.map((createdClass) => ({
          ...createdClass,
          status: (createdClass.status || 'active') as 'active' | 'inactive'
        }))]);
        // If it was associated with a year, add the link locally too
        if (createForm.associateWithYear && selectedYearId) {
          setLinks(prev => [...prev, ...createdClasses.map((createdClass, index) => ({
            id: `tmp-${Date.now()}-${index}`,
            class_id: createdClass.id,
            school_year_id: selectedYearId,
          }))]);
        }
        setCreateOpen(false);
        setCreateForm({ name: '', names: '', bulk: false, status: 'active', associateWithYear: true });
      } else {
        setCreateError(res.error || "Impossible de créer la classe.");
      }
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleOpenEdit = (classItem: ClassItem) => {
    setEditingClass(classItem);
    setEditForm({
      name: classItem.name,
      status: classItem.status,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setSubmittingEdit(true);
    setEditError(null);

    try {
      const res = await updateClass({
        id: editingClass.id,
        name: editForm.name,
        status: editForm.status,
      });

      if (res.success && res.class) {
        setClasses(prev => prev.map(c => c.id === editingClass.id ? {
          ...c,
          name: res.class.name,
          status: (res.class.status || 'active') as 'active' | 'inactive',
        } : c));
        setEditingClass(null);
      } else {
        setEditError(res.error || "Impossible de mettre à jour la classe.");
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestion des Classes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Définissez les classes permanentes de l'école et associez-les aux différentes années scolaires.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/school/years">
            <Button variant="outline" className="gap-2 text-xs">
              <Calendar className="h-4 w-4" />
              Années scolaires
            </Button>
          </Link>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle classe
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}



      {/* Control Bar: Year Selection & Filters */}
      <Card className="rounded-[18px] border-slate-200/90 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Year Selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span>Année de référence :</span>
              </div>
              {years.length === 0 ? (
                <div className="text-xs text-amber-600 flex items-center gap-1.5">
                  <span>Aucune année créée.</span>
                  <Link href="/school/years" className="underline font-medium">Créer une année</Link>
                </div>
              ) : (
                <select
                  className="h-9 text-xs font-medium rounded-lg border border-slate-200 bg-background px-3 py-1 shadow-xs focus:ring-2 focus:ring-emerald-500/20"
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                >
                  {years.map(y => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.status === "active" ? "★ (Active)" : y.status === "preparation" ? "(Préparation)" : "(Archivée)"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Search & Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une classe..."
                  className="pl-8 h-9 text-xs bg-background"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <select
                className="h-9 text-xs rounded-lg border border-slate-200 bg-background px-3 py-1 shadow-xs"
                value={filterMode}
                onChange={(e) => {
                  setFilterMode(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="all">Toutes les classes ({classes.length})</option>
                <option value="associated">Inscrites cette année ({associatedClassIds.size})</option>
                <option value="unassociated">Non inscrites ({classes.length - associatedClassIds.size})</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Classes de l'établissement
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {selectedYear ? (
                  <>
                    Affichage pour l'année <strong>{selectedYear.name}</strong> · {associatedClassIds.size} classe{associatedClassIds.size > 1 ? "s" : ""} inscrite{associatedClassIds.size > 1 ? "s" : ""}
                  </>
                ) : (
                  "Sélectionnez une année scolaire"
                )}
              </CardDescription>
            </div>
            <RefreshButton onRefresh={() => router.refresh()} className="h-8 border-slate-200 text-xs text-slate-700 hover:bg-white" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <tr className="border-b border-slate-200/80">
                <th className="px-5 py-3">Classe</th>
                <th className="px-5 py-3">Statut Permanent</th>
                <th className="px-5 py-3">
                  Rattachement ({selectedYear ? selectedYear.name : "Année"})
                </th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {visibleClasses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    {classes.length === 0 ? (
                      <div>
                        <p>Aucune classe n'a encore été créée pour cet établissement.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 gap-2 text-xs"
                          onClick={() => setCreateOpen(true)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Créer la première classe
                        </Button>
                      </div>
                    ) : (
                      "Aucune classe ne correspond aux filtres sélectionnés."
                    )}
                  </td>
                </tr>
              ) : (
                visibleClasses.map((classItem) => {
                  const isAssociated = associatedClassIds.has(classItem.id);
                  const isToggling = togglingClassId === classItem.id;

                  return (
                    <tr key={classItem.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          
                          <div>
                            <p className="font-semibold text-slate-900">{classItem.name}</p>

                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={classItem.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}
                        >
                          {classItem.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {isAssociated ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Inscrite pour cette année
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-slate-500 hover:text-rose-600 px-2"
                              disabled={isToggling || !selectedYearId}
                              onClick={() => handleToggle(classItem, true)}
                              title="Retirer cette classe de l'année scolaire sélectionnée"
                            >
                              Retirer
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                              <XCircle className="h-3.5 w-3.5" />
                              Non rattachée
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 px-2.5"
                              disabled={isToggling || !selectedYearId}
                              onClick={() => handleToggle(classItem, false)}
                              title="Associer cette classe à l'année scolaire sélectionnée"
                            >
                              + Rapprocher
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setDetailClass(classItem)}
                            title="Voir le détail"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleOpenEdit(classItem)}
                            title="Modifier la classe"
                          >
                            <Edit className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {filteredClasses.length > CLASS_PAGE_SIZE && (
            <Pagination page={safePage} pageSize={CLASS_PAGE_SIZE} total={filteredClasses.length} onPageChange={(nextPage) => setPage(nextPage)} />
          )}
        </CardContent>
      </Card>

      {/* Create Class Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader className="pr-8">
            <DialogTitle>Nouvelle Classe</DialogTitle>
            <DialogDescription>
              Ajoutez une classe ou plusieurs classes en une seule fois.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-6">
            {createError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs">
                {createError}
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-700">Création en masse</span>
              <button
                type="button"
                role="switch"
                aria-checked={createForm.bulk}
                onClick={() => setCreateForm((prev) => ({ ...prev, bulk: !prev.bulk }))}
                disabled={submittingCreate}
                className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full border p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${createForm.bulk ? "border-emerald-700 bg-emerald-600" : "border-slate-400 bg-slate-300"}`}
              >
                <span className={`block h-5 w-5 rounded-full border border-slate-200 bg-white shadow-sm transition-transform ${createForm.bulk ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Nom de la classe</label>
              {createForm.bulk ? (
                <textarea
                  className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder={"1ère Primaire A\n1ère Primaire B\n2ème Primaire A"}
                  value={createForm.names}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, names: e.target.value }))}
                  required
                  disabled={submittingCreate}
                />
              ) : (
                <Input
                  placeholder="ex: 1ère Primaire A"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  disabled={submittingCreate}
                />
              )}
              {createForm.bulk && <p className="text-xs text-muted-foreground">Un nom par ligne, ou séparez-les par une virgule.</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Statut</label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs"
                value={createForm.status}
                onChange={(e) => setCreateForm(prev => ({ ...prev, status: e.target.value as any }))}
                disabled={submittingCreate}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {selectedYear && (
              <div className="pt-2 border-t">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.associateWithYear}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, associateWithYear: e.target.checked }))}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Associer immédiatement à l'année <strong>{selectedYear.name}</strong></span>
                </label>
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submittingCreate}>
                Annuler
              </Button>
              <Button type="submit" disabled={submittingCreate}>
                {submittingCreate ? "Création..." : createForm.bulk ? "Créer les classes" : "Créer la classe"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={!!editingClass} onOpenChange={(open) => { if (!open) setEditingClass(null); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Modifier la Classe</DialogTitle>
            <DialogDescription>
              Mettez à jour le nom et le statut permanent de la classe.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            {editError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs">
                {editError}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nom de la classe</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                required
                disabled={submittingEdit}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Statut</label>
              <select
                className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-xs"
                value={editForm.status}
                onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                disabled={submittingEdit}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setEditingClass(null)} disabled={submittingEdit}>
                Annuler
              </Button>
              <Button type="submit" disabled={submittingEdit}>
                {submittingEdit ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Class Detail Drawer */}
      <ClassDetailSheet
        classItem={detailClass}
        years={years}
        links={links}
        open={!!detailClass}
        onOpenChange={(open) => { if (!open) setDetailClass(null); }}
      />
    </div>
  );
}
