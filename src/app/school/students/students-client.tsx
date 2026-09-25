"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, Plus, Search, Upload, Download, MoreVertical,
  Archive, Edit, Eye, GraduationCap, Calendar, Loader2,
  AlertCircle, BookOpen, X, ArrowUpToLine
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/shared/pagination";
import { RefreshButton } from "@/components/shared/refresh-button";
import { StudentIconBadge } from "@/components/shared/student-icon-badge";
import {
  StudentItem, ClassSimple, SchoolYearSimple,
  createStudent, updateStudent, enrollStudent,
  changeStudentClass, archiveStudent, getStudentsData,
} from "./actions";
import { ImportExcelDialog } from "./import-excel-dialog";
import { StudentDetailSheet } from "./student-detail-sheet";

interface StudentsClientProps {
  initialStudents: StudentItem[];
  initialTotal: number;
  years: SchoolYearSimple[];
  activeYear: SchoolYearSimple | null;
  classes: ClassSimple[];
}

export function StudentsClient({
  initialStudents,
  initialTotal,
  years,
  activeYear,
  classes,
}: StudentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<StudentItem[]>(initialStudents);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [yearFilter, setYearFilter] = useState(activeYear?.id || "");
  const [classFilter, setClassFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Detail sheet
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: "", last_name: "", post_name: "",
    date_of_birth: "", gender: "M" as "M" | "F",
    class_id: classes[0]?.id || "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
      router.replace("/school/students", { scroll: false });
    }
  }, [router, searchParams]);

  // Edit dialog
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", post_name: "",
    date_of_birth: "", gender: "M" as "M" | "F",
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Archive confirm
  const [archivingStudent, setArchivingStudent] = useState<StudentItem | null>(null);
  const [submittingArchive, setSubmittingArchive] = useState(false);

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchStudents = useCallback(async (pg = 1, s = search, sf = statusFilter, cf = classFilter, gf = genderFilter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStudentsData(pg, PAGE_SIZE, {
        search: s || undefined,
        status: sf,
        classId: cf || undefined,
        gender: gf === "all" ? undefined : gf,
      });
      setStudents(result.students);
      setTotal(result.total);
      setPage(pg);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, classFilter, genderFilter]);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchStudents(1, val, statusFilter, classFilter, genderFilter);
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    fetchStudents(1, search, val, classFilter, genderFilter);
  };

  const handleClassFilter = (val: string) => {
    setClassFilter(val);
    fetchStudents(1, search, statusFilter, val, genderFilter);
  };

  const handleGenderFilter = (val: string) => {
    setGenderFilter(val);
    fetchStudents(1, search, statusFilter, classFilter, val);
  };

  // ─── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYear) return;
    setSubmittingCreate(true);
    setCreateError(null);

    const res = await createStudent({
      first_name: createForm.first_name,
      last_name: createForm.last_name,
      post_name: createForm.post_name || null,
      date_of_birth: createForm.date_of_birth,
      gender: createForm.gender,
      class_id: createForm.class_id,
      school_year_id: activeYear.id,
    });

    setSubmittingCreate(false);

    if (res.success) {
      setCreateOpen(false);
      setCreateForm({ first_name: "", last_name: "", post_name: "", date_of_birth: "", gender: "M", class_id: classes[0]?.id || "" });
      fetchStudents(page);
    } else {
      setCreateError(res.error || "Impossible de créer l'élève.");
    }
  };

  // ─── Edit ───────────────────────────────────────────────────────────────────

  const handleOpenEdit = (student: StudentItem) => {
    setEditingStudent(student);
    setEditForm({
      first_name: student.first_name,
      last_name: student.last_name,
      post_name: student.post_name || "",
      date_of_birth: student.date_of_birth || "",
      gender: (student.gender as "M" | "F") || "M",
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSubmittingEdit(true);
    setEditError(null);

    const res = await updateStudent({
      id: editingStudent.id,
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      post_name: editForm.post_name || null,
      date_of_birth: editForm.date_of_birth,
      gender: editForm.gender,
    });

    setSubmittingEdit(false);

    if (res.success) {
      setEditingStudent(null);
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? {
        ...s,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        post_name: editForm.post_name || null,
        date_of_birth: editForm.date_of_birth,
        gender: editForm.gender,
      } : s));
    } else {
      setEditError(res.error || "Impossible de mettre à jour l'élève.");
    }
  };

  // ─── Archive ────────────────────────────────────────────────────────────────

  const handleArchive = async () => {
    if (!archivingStudent) return;
    setSubmittingArchive(true);

    const res = await archiveStudent(archivingStudent.id);
    setSubmittingArchive(false);

    if (res.success) {
      setArchivingStudent(null);
      setStudents(prev => prev.filter(s => s.id !== archivingStudent.id));
      setTotal(prev => prev - 1);
    } else {
      setError(res.error || "Impossible d'archiver l'élève.");
      setArchivingStudent(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestion des Élèves</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeYear ? (
              <>Année active : <strong>{activeYear.name}</strong> · {total} élève{total > 1 ? "s" : ""}</>
            ) : (
              "Aucune année scolaire active"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setImportOpen(true)} disabled={!activeYear}>
            <ArrowUpToLine className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={() => setCreateOpen(true)} disabled={!activeYear} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvel élève
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {!activeYear && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Aucune année scolaire active. Veuillez activer une année pour pouvoir créer des élèves.</span>
        </div>
      )}

      {/* Control bar */}
      <Card className="rounded-[18px] border-slate-200/90 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Rechercher (nom, prénom, matricule…)"
                className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-xs placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-11 min-w-[150px] rounded-xl border-slate-200 bg-white px-3.5 py-1 text-sm shadow-xs focus:border-emerald-500 focus:ring-emerald-500/20"
                value={genderFilter}
                onChange={(e) => handleGenderFilter(e.target.value)}
              >
                <option value="all">Tous les genres</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-11 min-w-[168px] rounded-xl border-slate-200 bg-white px-3.5 py-1 text-sm shadow-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                value={classFilter}
                onChange={(e) => handleClassFilter(e.target.value)}
              >
                <option value="">Toutes les classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-9 text-xs rounded-lg border border-slate-200 bg-background px-3 py-1 shadow-xs"
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
              >
                <option value="active">Actifs</option>
                <option value="archived">Archivés</option>
                <option value="all">Tous</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">Liste des élèves</CardTitle>
              <CardDescription className="text-xs text-slate-500">{total} élève{total > 1 ? "s" : ""} correspondant aux filtres</CardDescription>
            </div>
            <RefreshButton onRefresh={() => fetchStudents(page)} className="h-8 border-slate-200 text-xs text-slate-700 hover:bg-white" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <span className="text-sm">Chargement des élèves…</span>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <GraduationCap className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium">Aucun élève trouvé</p>
              <p className="text-xs">Commencez par créer le premier élève ou importez un fichier Excel.</p>
              {activeYear && (
                <Button size="sm" className="mt-2 gap-2 text-xs" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Créer le premier élève
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full min-w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <tr className="border-b border-slate-200/80">
                  <th className="px-5 py-3">Matricule</th>
                  <th className="px-5 py-3">Nom complet</th>
                  <th className="px-5 py-3">Sexe</th>
                  <th className="px-5 py-3">Date de naissance</th>
                  <th className="px-5 py-3">Classe</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-0.5 rounded  text-slate-800">
                        {student.matricule}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        className="text-left text-slate-900 transition-colors hover:text-emerald-700 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                        onClick={() => setSelectedStudent(student)}
                        title="Ouvrir la fiche de l'élève"
                      >
                        <span>
                          {student.last_name.toUpperCase()} {student.post_name ? student.post_name + " " : ""}{student.first_name}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={
                        student.gender === "M"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-pink-50 text-pink-700 border-pink-200"
                      }>
                        {student.gender === "M" ? "Masculin" : "Féminin"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {student.date_of_birth
                        ? new Date(student.date_of_birth).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {student.current_enrollment ? (
                        <div>
                          <span className="text-xs text-slate-800">{student.current_enrollment.class_name}</span>
                          
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">Non inscrit</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={
                        student.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }>
                        {student.status === "active" ? "Actif" : "Archivé"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm" className="h-8 w-8 p-0"
                          onClick={() => setSelectedStudent(student)}
                          title="Voir la fiche"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-8 w-8 p-0"
                          onClick={() => handleOpenEdit(student)}
                          title="Modifier"
                        >
                          <Edit className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        {student.status === "active" && (
                          <Button
                            variant="ghost" size="sm" className="h-8 w-8 p-0"
                            onClick={() => setArchivingStudent(student)}
                            title="Archiver"
                          >
                            <Archive className="h-3.5 w-3.5 text-rose-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={fetchStudents} />
          )}
        </CardContent>
      </Card>

      {/* ── Create Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nouvel Élève</DialogTitle>
            <DialogDescription>
              L'élève sera inscrit dans <strong>{activeYear?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            {createError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs">{createError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Nom *</label>
                <Input value={createForm.last_name} onChange={e => setCreateForm(p => ({ ...p, last_name: e.target.value }))} required disabled={submittingCreate} placeholder="ex: NGOMA" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Postnom</label>
                <Input value={createForm.post_name} onChange={e => setCreateForm(p => ({ ...p, post_name: e.target.value }))} disabled={submittingCreate} placeholder="ex: BAKAJIKA" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Prénom *</label>
              <Input value={createForm.first_name} onChange={e => setCreateForm(p => ({ ...p, first_name: e.target.value }))} required disabled={submittingCreate} placeholder="ex: Jean" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Sexe *</label>
                <select
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-xs"
                  value={createForm.gender}
                  onChange={e => setCreateForm(p => ({ ...p, gender: e.target.value as "M" | "F" }))}
                  disabled={submittingCreate}
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Date de naissance *</label>
                <Input type="date" value={createForm.date_of_birth} onChange={e => setCreateForm(p => ({ ...p, date_of_birth: e.target.value }))} required disabled={submittingCreate} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Classe *</label>
              {classes.length === 0 ? (
                <p className="text-xs text-amber-600">Aucune classe disponible pour l'année active.</p>
              ) : (
                <select
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-xs"
                  value={createForm.class_id}
                  onChange={e => setCreateForm(p => ({ ...p, class_id: e.target.value }))}
                  disabled={submittingCreate}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submittingCreate}>Annuler</Button>
              <Button type="submit" disabled={submittingCreate || classes.length === 0}>
                {submittingCreate ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Création…</> : "Créer l'élève"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!editingStudent} onOpenChange={open => { if (!open) setEditingStudent(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier l'élève</DialogTitle>
            <DialogDescription>
              Matricule : <code className="font-mono font-bold">{editingStudent?.matricule}</code>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            {editError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs">{editError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Nom *</label>
                <Input value={editForm.last_name} onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))} required disabled={submittingEdit} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Postnom</label>
                <Input value={editForm.post_name} onChange={e => setEditForm(p => ({ ...p, post_name: e.target.value }))} disabled={submittingEdit} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Prénom *</label>
              <Input value={editForm.first_name} onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))} required disabled={submittingEdit} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Sexe *</label>
                <select
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-xs"
                  value={editForm.gender}
                  onChange={e => setEditForm(p => ({ ...p, gender: e.target.value as "M" | "F" }))}
                  disabled={submittingEdit}
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Date de naissance *</label>
                <Input type="date" value={editForm.date_of_birth} onChange={e => setEditForm(p => ({ ...p, date_of_birth: e.target.value }))} required disabled={submittingEdit} />
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setEditingStudent(null)} disabled={submittingEdit}>Annuler</Button>
              <Button type="submit" disabled={submittingEdit}>
                {submittingEdit ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Enregistrement…</> : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Archive Confirm ────────────────────────────────────────────────── */}
      <Dialog open={!!archivingStudent} onOpenChange={open => { if (!open) setArchivingStudent(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Archiver l'élève</DialogTitle>
            <DialogDescription>
              L'élève <strong>{archivingStudent?.last_name} {archivingStudent?.first_name}</strong> sera archivé.
              Son historique sera conservé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setArchivingStudent(null)} disabled={submittingArchive}>Annuler</Button>
            <Button variant="destructive" onClick={handleArchive} disabled={submittingArchive}>
              {submittingArchive ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Archivage…</> : "Archiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Student Detail Sheet ─────────────────────────────────────────────── */}
      <StudentDetailSheet
        student={selectedStudent}
        classes={classes}
        activeYear={activeYear}
        open={!!selectedStudent}
        onOpenChange={open => { if (!open) setSelectedStudent(null); }}
        onClassChanged={() => fetchStudents(page)}
        onStudentEnrolled={() => fetchStudents(page)}
      />

      {/* ── Import Excel Dialog ──────────────────────────────────────────────── */}
      <ImportExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        activeYear={activeYear}
        classes={classes}
        onImportComplete={() => fetchStudents(1)}
      />
    </div>
  );
}
