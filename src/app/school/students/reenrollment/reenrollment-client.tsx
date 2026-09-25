"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import {
  Loader2, ArrowRight, CheckCircle2, GraduationCap,
  Calendar, ChevronDown, AlertCircle, Users, Sparkles
} from "lucide-react";
import { getReenrollmentCandidates, executeReenrollment, ReenrollmentCandidate } from "./actions";

interface SchoolYear { id: string; name: string; status: string; }
interface Classe { id: string; name: string; }

interface ReenrollmentClientProps {
  schoolYears: SchoolYear[];
  classesByYear: Record<string, Classe[]>;
}

// ─── CustomSelect ─────────────────────────────────────────────────────────────
// Replaces Base UI Select (which renders UUID in trigger) with a native <select>
// styled to match the design system.

function NativeSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; badge?: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[#dfe7e3] bg-white/80 px-2 py-1.5 shadow-sm">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 rounded-full transition-all ${
            i + 1 === current ? "w-8 bg-[#1aa57a]" : i + 1 < current ? "w-3 bg-[#7fcfb3]" : "w-3 bg-[#dfe7e3]"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReenrollmentClient({ schoolYears, classesByYear }: ReenrollmentClientProps) {
  const router = useRouter();

  const [sourceYearId, setSourceYearId] = useState("");
  const [sourceClassId, setSourceClassId] = useState("");
  const [targetYearId, setTargetYearId] = useState("");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [candidates, setCandidates] = useState<ReenrollmentCandidate[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [confirmedCount, setConfirmedCount] = useState(0);

  const sourceClasses = sourceYearId ? classesByYear[sourceYearId] || [] : [];
  const targetClasses = targetYearId ? classesByYear[targetYearId] || [] : [];

  const yearOptions = schoolYears.map((y) => ({
    value: y.id,
    label: `${y.name}${y.status === "active" ? " — Active" : y.status === "preparation" ? " — En préparation" : ""}`,
  }));

  const sourceClassOptions = sourceClasses.map((c) => ({ value: c.id, label: c.name }));
  const targetClassOptions = targetClasses.map((c) => ({ value: c.id, label: c.name }));

  const eligibleCount = candidates.filter((c) => !c.already_enrolled && c.status === "active").length;

  const handleFetchCandidates = async () => {
    if (!sourceYearId || !sourceClassId || !targetYearId) return;

    if (sourceYearId === targetYearId) {
      toast.add({ title: "Sélection invalide", description: "L'année cible doit être différente de l'année source.", type: "error" });
      return;
    }

    setIsLoading(true);
    try {
      const data = await getReenrollmentCandidates(sourceYearId, sourceClassId, targetYearId);
      setCandidates(data);

      const newMappings: Record<string, string> = {};
      const newSelected = new Set<string>();

      data.forEach((student) => {
        if (!student.already_enrolled && student.status === "active") {
          const srcClass = sourceClasses.find((c) => c.id === student.current_class_id);
          const matchingTarget = targetClasses.find((c) => c.name === srcClass?.name);
          if (matchingTarget) {
            newMappings[student.student_id] = matchingTarget.id;
            newSelected.add(student.student_id);
          }
        }
      });

      setMappings(newMappings);
      setSelectedStudents(newSelected);
      setStep(2);
    } catch (err: any) {
      toast.add({ title: "Erreur", description: err.message || "Impossible de charger les élèves.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const next = new Set<string>();
      candidates.forEach((c) => {
        if (!c.already_enrolled && c.status === "active" && mappings[c.student_id]) next.add(c.student_id);
      });
      setSelectedStudents(next);
    } else {
      setSelectedStudents(new Set());
    }
  };

  const toggleStudent = (studentId: string) => {
    const next = new Set(selectedStudents);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      if (mappings[studentId]) {
        next.add(studentId);
      } else {
        toast.add({ title: "Classe manquante", description: "Choisissez d'abord une classe cible pour cet élève.", type: "error" });
      }
    }
    setSelectedStudents(next);
  };

  const updateMapping = (studentId: string, classId: string) => {
    setMappings((prev) => ({ ...prev, [studentId]: classId }));
    if (!selectedStudents.has(studentId) && classId) {
      setSelectedStudents((prev) => new Set([...prev, studentId]));
    }
  };

  const handleConfirm = async () => {
    if (selectedStudents.size === 0) return;
    setIsLoading(true);
    try {
      const enrollments = Array.from(selectedStudents).map((studentId) => ({
        studentId,
        targetClassId: mappings[studentId],
      }));
      await executeReenrollment({ sourceYearId, targetYearId, enrollments });
      setConfirmedCount(selectedStudents.size);
      setStep(3);
    } catch (err: any) {
      toast.add({ title: "Erreur", description: err.message || "La réinscription a échoué.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSourceClassId("");
    setCandidates([]);
    setMappings({});
    setSelectedStudents(new Set());
    setConfirmedCount(0);
  };

  const sourceYearName = schoolYears.find((y) => y.id === sourceYearId)?.name || "";
  const sourceClassName = sourceClasses.find((c) => c.id === sourceClassId)?.name || "";
  const targetYearName = schoolYears.find((y) => y.id === targetYearId)?.name || "";

  const allEligibleSelected = eligibleCount > 0 && selectedStudents.size === eligibleCount;

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dff4ee] shadow-inner ring-1 ring-[#cfe8df]">
              <GraduationCap className="h-5 w-5 text-[#0d8a6c]" />
            </div>
            <h1 className="text-[2rem] font-bold tracking-[-0.03em] text-slate-900">Réinscription des élèves</h1>
          </div>
          <p className="text-sm text-slate-500">
            Transférez les élèves d&apos;une année scolaire vers une autre en quelques clics.
          </p>
        </div>
        <StepIndicator current={step} total={3} />
      </div>

      {/* ── Step 1 : Sélection ── */}
      {step === 1 && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6 pb-2 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Étape 1 — Source &amp; destination
              </p>

              {/* Source */}
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-4 mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Calendar className="h-4 w-4 text-primary" />
                  Année source (d&apos;où viennent les élèves)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="src-year" className="text-xs font-medium text-muted-foreground">Année scolaire</label>
                    <NativeSelect
                      id="src-year"
                      value={sourceYearId}
                      onChange={(val) => { setSourceYearId(val); setSourceClassId(""); }}
                      options={yearOptions}
                      placeholder="Choisir une année..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="src-class" className="text-xs font-medium text-muted-foreground">Classe à transférer</label>
                    <NativeSelect
                      id="src-class"
                      value={sourceClassId}
                      onChange={setSourceClassId}
                      options={sourceClassOptions}
                      placeholder={sourceYearId ? "Choisir une classe..." : "Sélectionnez d'abord une année"}
                      disabled={!sourceYearId}
                    />
                  </div>
                </div>
              </div>

              {/* Target */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Année cible (vers laquelle réinscrire)
                </div>
                <div className="max-w-sm space-y-1.5">
                  <label htmlFor="tgt-year" className="text-xs font-medium text-muted-foreground">Nouvelle année scolaire</label>
                  <NativeSelect
                    id="tgt-year"
                    value={targetYearId}
                    onChange={setTargetYearId}
                    options={yearOptions.filter((y) => y.value !== sourceYearId)}
                    placeholder="Choisir l'année cible..."
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-4 pb-5 justify-end">
            <Button
              onClick={handleFetchCandidates}
              disabled={!sourceYearId || !sourceClassId || !targetYearId || isLoading}
              className="gap-2 min-w-[140px]"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</>
              ) : (
                <>Voir les élèves <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── Step 2 : Grille d'affectation ── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-wrap text-sm text-slate-500">
            <button onClick={() => setStep(1)} className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900">
              ← Modifier la sélection
            </button>
            <span>·</span>
            <span className="font-medium text-slate-700">{sourceYearName}</span>
            <span>/</span>
            <span className="font-medium text-slate-700">{sourceClassName}</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#0d8a6c]" />
            <span className="font-medium text-slate-700">{targetYearName}</span>
          </div>

          <Card className="overflow-hidden border-[#dfe8e2] bg-white shadow-[0_1px_0_rgba(15,23,42,0.02)]">
            {/* Stats bar */}
            <div className="flex items-center justify-between border-b border-[#e7ece8] bg-[#f7f9f7] px-5 py-3.5">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span><span className="font-semibold text-slate-800">{candidates.length}</span> élèves trouvés</span>
                </div>
                <div className="h-4 w-px bg-[#dfe7e3]" />
                <span>
                  <span className="font-semibold text-[#0d8a6c]">{selectedStudents.size}</span> sélectionnés
                </span>
                {candidates.some((c) => c.already_enrolled) && (
                  <>
                    <div className="h-4 w-px bg-[#dfe7e3]" />
                    <span>
                      <span className="font-medium text-slate-700">{candidates.filter((c) => c.already_enrolled).length}</span> déjà inscrits
                    </span>
                  </>
                )}
              </div>
            </div>

            {candidates.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 opacity-40" />
                <p className="text-sm">Aucun élève trouvé dans cette classe pour l&apos;année source.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f7f9f7] hover:bg-[#f7f9f7]">
                      <TableHead className="w-10 pl-5">
                        <Checkbox
                          checked={allEligibleSelected}
                          onCheckedChange={(v) => handleSelectAll(Boolean(v))}
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-[0.14em] text-slate-600">Matricule</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-[0.14em] text-slate-600">Élève</TableHead>
                      <TableHead className="font-semibold text-[11px] uppercase tracking-[0.14em] text-slate-600">Statut</TableHead>
                      <TableHead className="min-w-[220px] font-semibold text-[11px] uppercase tracking-[0.14em] text-slate-600">
                        Classe dans <span className="text-[#0d8a6c]">{targetYearName}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((student) => {
                      const isDisabled = student.already_enrolled || student.status !== "active";
                      const isSelected = selectedStudents.has(student.student_id);

                      return (
                        <TableRow
                          key={student.student_id}
                          className={`border-b border-[#edf1ee] transition-colors ${isDisabled ? "bg-[#fbfbfb] opacity-60" : isSelected ? "bg-[#f1faf6]" : "bg-white"}`}
                        >
                          <TableCell className="pl-5">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleStudent(student.student_id)}
                              disabled={isDisabled}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-medium">
                              {student.matricule}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {student.last_name} {student.first_name}
                                {student.post_name && <span className="text-muted-foreground font-normal"> {student.post_name}</span>}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {student.already_enrolled ? (
                              <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Déjà inscrit</Badge>
                            ) : student.status !== "active" ? (
                              <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">{student.status}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Prêt</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={mappings[student.student_id] || ""}
                              onChange={(val) => updateMapping(student.student_id, val)}
                              options={targetClassOptions}
                              placeholder="Choisir..."
                              disabled={isDisabled}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-border/50 bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Les obligations financières seront générées automatiquement pour chaque élève réinscrit.
              </p>
              <Button
                onClick={handleConfirm}
                disabled={selectedStudents.size === 0 || isLoading}
                className="gap-2 min-w-[180px]"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Réinscription...</>
                ) : (
                  <>Réinscrire {selectedStudents.size > 0 && `(${selectedStudents.size})`} élève{selectedStudents.size > 1 ? "s" : ""}</>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Step 3 : Succès ── */}
      {step === 3 && (
        <Card className="border-emerald-200/60 bg-emerald-50/30 shadow-sm">
          <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Réinscription réussie !</h2>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
                <span className="font-semibold text-slate-700">{confirmedCount} élève{confirmedCount > 1 ? "s" : ""}</span> {confirmedCount > 1 ? "ont été réinscrits" : "a été réinscrit"} dans{" "}
                <span className="font-semibold text-primary">{targetYearName}</span>.{" "}
                Leurs obligations financières ont été générées automatiquement.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={reset}>
                Nouvelle réinscription
              </Button>
              <Button onClick={() => router.push("/school/students")}>
                Voir les élèves
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
