"use client";

import { useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { changeStudentClass, ClassSimple } from "./actions";

interface StudentClassChangeDialogProps {
  enrollmentId: string;
  oldClassId: string;
  studentName: string;
  classes: ClassSimple[];
}

export function StudentClassChangeDialog({
  enrollmentId,
  oldClassId,
  studentName,
  classes,
}: StudentClassChangeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(classes.find((c) => c.id !== oldClassId)?.id || classes[0]?.id || "");
  const [actionError, setActionError] = useState<string | null>(null);

  const validClasses = classes.filter((c) => c.id !== oldClassId);

  async function handleConfirm() {
    if (!selectedClassId || !enrollmentId || !oldClassId) return;

    setSubmitting(true);
    setActionError(null);

    const res = await changeStudentClass({
      enrollment_id: enrollmentId,
      old_class_id: oldClassId,
      new_class_id: selectedClassId,
    });

    setSubmitting(false);
    if (res.success) {
      setOpen(false);
      router.refresh();
      return;
    }

    setActionError(res.error || "Impossible de changer la classe.");
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => {
        setActionError(null);
        setSelectedClassId(validClasses[0]?.id || classes[0]?.id || "");
        setOpen(true);
      }}>
        <ArrowRightLeft className="h-3.5 w-3.5" />
        Changer de classe
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Changer de classe</DialogTitle>
            <DialogDescription>
              Sélectionnez la nouvelle classe pour {studentName}. L’ancienne affectation sera conservée dans l’historique.
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {actionError}
            </div>
          )}

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-slate-700">Nouvelle classe</label>
            <select
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-xs"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={submitting || validClasses.length === 0}
            >
              {validClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={handleConfirm} disabled={submitting || validClasses.length === 0}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Traitement…
                </>
              ) : (
                "Confirmer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
