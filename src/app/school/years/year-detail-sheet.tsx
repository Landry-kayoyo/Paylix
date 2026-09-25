"use client";

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { DetailSheetHeader } from "@/components/shared/detail-sheet-header";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  CheckCircle2,
  Archive,
  Clock,
  Layers,
  AlertCircle,
} from "lucide-react";
import type { SchoolYearItem } from "../years/actions";
import type { ClassItem, ClassYearLink } from "../classes/actions";

interface YearDetailSheetProps {
  year: SchoolYearItem | null;
  classes: ClassItem[];
  links: ClassYearLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatusBanner({ status }: { status: string }) {
  if (status === "active")
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-emerald-50 border border-emerald-200">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Année scolaire active</p>

        </div>
      </div>
    );
  if (status === "preparation")
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-emerald-50 border border-emerald-200">
        <Clock className="h-5 w-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">En préparation</p>
          <p className="text-xs text-emerald-600">Cette année n'est pas encore activée. Activez-la pour ouvrir les inscriptions.</p>
        </div>
      </div>
    );
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-slate-100 border border-slate-200">
      <Archive className="h-5 w-5 text-slate-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-slate-700">Archivée</p>
        <p className="text-xs text-slate-500">Cette année est terminée. Les données historiques sont préservées.</p>
      </div>
    </div>
  );
}

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  return `${new Date(start).toLocaleDateString("fr-FR", opts)} → ${new Date(end).toLocaleDateString("fr-FR", opts)}`;
}

function durationDays(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function YearDetailSheet({ year, classes, links, open, onOpenChange }: YearDetailSheetProps) {
  if (!year) return null;

  const associatedClassIds = new Set(
    links.filter(l => l.school_year_id === year.id).map(l => l.class_id)
  );
  const associatedClasses = classes.filter(c => associatedClassIds.has(c.id));
  const activeClasses = associatedClasses.filter(c => c.status === "active");
  const days = durationDays(year.start_date, year.end_date);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        {/* Header */}
        <DetailSheetHeader
          title={year.name}
          subtitle="Détails de l'année scolaire"
          titleClassName="text-2xl font-black tracking-tight text-slate-900 leading-tight"
          subtitleClassName="mt-1 text-sm text-slate-600"
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Status */}
          <StatusBanner status={year.status} />

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{associatedClasses.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Classe{associatedClasses.length > 1 ? "s" : ""} rattachée{associatedClasses.length > 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{days}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Jours de scolarité</p>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Période</p>
            <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground">Début</span>
                <span className="text-sm font-medium text-slate-800">
                  {new Date(year.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground">Fin</span>
                <span className="text-sm font-medium text-slate-800">
                  {new Date(year.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground">Durée</span>
                <span className="text-sm font-medium text-slate-800">{days} jours</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Associated classes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Classes rattachées
              </p>
              <Badge variant="outline" className="text-xs">{associatedClasses.length}</Badge>
            </div>

            {associatedClasses.length === 0 ? (
              <div className="rounded-xl border border-slate-200/80 px-4 py-6 text-center">
                <Layers className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground">Aucune classe rattachée à cette année.</p>
                <p className="text-xs text-muted-foreground mt-1">Allez dans l&apos;onglet <strong>Classes</strong> pour associer des classes.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {associatedClasses.map(cls => (
                    <div key={cls.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                          {cls.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{cls.name}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cls.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                          : "bg-slate-100 text-slate-500 border-slate-200 text-xs"}
                      >
                        {cls.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
                {activeClasses.length < associatedClasses.length && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-t border-amber-100">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">
                      {associatedClasses.length - activeClasses.length} classe{associatedClasses.length - activeClasses.length > 1 ? "s" : ""} inactive{associatedClasses.length - activeClasses.length > 1 ? "s" : ""} rattachée{associatedClasses.length - activeClasses.length > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
