"use client";

import { useState } from "react";
import { GraduationCap, BookOpen, Loader2, Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  Sheet, SheetContent
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DetailSheetHeader } from "@/components/shared/detail-sheet-header";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  StudentItem, ClassSimple, SchoolYearSimple,
  enrollStudent
} from "./actions";

interface StudentDetailSheetProps {
  student: StudentItem | null;
  classes: ClassSimple[];
  activeYear: SchoolYearSimple | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClassChanged: () => void;
  onStudentEnrolled: () => void;
}

export function StudentDetailSheet({
  student,
  classes,
  activeYear,
  open,
  onOpenChange,
  onClassChanged,
  onStudentEnrolled,
}: StudentDetailSheetProps) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasCurrentEnrollment = !!student?.current_enrollment;

  const handleEnroll = async () => {
    if (!student || !activeYear) return;
    setSubmitting(true);
    setActionError(null);

    const res = await enrollStudent({
      student_id: student.id,
      school_year_id: activeYear.id,
      class_id: selectedClassId,
    });

    setSubmitting(false);

    if (res.success) {
      setEnrollOpen(false);
      onStudentEnrolled();
    } else {
      setActionError(res.error || "Impossible d'inscrire l'élève.");
    }
  };

  if (!student) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
          <DetailSheetHeader
            title={
              <>
                {student.last_name.toUpperCase()} {student.post_name ? student.post_name.toUpperCase() + " " : ""}{student.first_name}
              </>
            }
            subtitle={<code className="font-mono font-bold text-slate-700">{student.matricule}</code>}
            titleClassName="text-2xl font-black tracking-tight text-slate-900 leading-tight"
            subtitleClassName="mt-1 text-sm font-medium text-slate-600"
          />

          <div className="py-6 space-y-6">
            {/* Identity */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Identité</h3>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-100">
                <Row label="Nom" value={student.last_name.toUpperCase()} />
                <Row label="Postnom" value={student.post_name || "—"} />
                <Row label="Prénom" value={student.first_name} />
                <Row label="Sexe" value={student.gender === "M" ? "Masculin" : "Féminin"} />
                <Row
                  label="Date de naissance"
                  value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("fr-FR") : "—"}
                />
                <Row
                  label="Statut"
                  value={
                    <Badge variant="outline" className={student.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600"}>
                      {student.status === "active" ? "Actif" : "Archivé"}
                    </Badge>
                  }
                />
              </div>
            </section>

            {/* Enrollment */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inscription en cours</h3>
              {hasCurrentEnrollment ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-100">
                  <Row label="Année scolaire" value={student.current_enrollment!.school_year_name} />
                  <Row label="Classe" value={student.current_enrollment!.class_name} />
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  Cet élève n'est pas encore inscrit pour l'année active.
                </div>
              )}

              <div className="flex gap-2 justify-center">
                {!hasCurrentEnrollment && activeYear ? (
                  <Button size="sm" className="gap-1.5 text-xs" onClick={() => {
                    setSelectedClassId(classes[0]?.id || "");
                    setActionError(null);
                    setEnrollOpen(true);
                  }}>
                    <BookOpen className="h-3.5 w-3.5" />
                    Inscrire dans l'année active
                  </Button>
                ) : null}
              </div>
              <div className="flex justify-center pt-4">
                <Link href={`/school/students/${student.id}`} onClick={() => onOpenChange(false)}>
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Fiche complète
                  </Button>
                </Link>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {/* Enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={open => { if (!open) setEnrollOpen(false); }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Inscrire l'élève</DialogTitle>
            <DialogDescription>Inscription de {student.first_name} dans l'année <strong>{activeYear?.name}</strong>.</DialogDescription>
          </DialogHeader>
          {actionError && <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs">{actionError}</div>}
          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-slate-700">Classe</label>
            <select
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-xs"
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              disabled={submitting}
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={handleEnroll} disabled={submitting}>
              {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Traitement…</> : "Inscrire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className="text-xs text-slate-900 font-semibold text-right">{value}</span>
    </div>
  );
}
