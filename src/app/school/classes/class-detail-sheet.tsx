"use client";

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { DetailSheetHeader } from "@/components/shared/detail-sheet-header";
import { Separator } from "@/components/ui/separator";
import {
  Layers,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Tag
} from "lucide-react";
import type { ClassItem, SchoolYearSimple, ClassYearLink } from "../classes/actions";

interface ClassDetailSheetProps {
  classItem: ClassItem | null;
  years: SchoolYearSimple[];
  links: ClassYearLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function YearStatusBadge({ status }: { status: string }) {
  if (status === "active")
    return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">★ Active</Badge>;
  if (status === "preparation")
    return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Préparation</Badge>;
  return <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-xs">Archivée</Badge>;
}

export function ClassDetailSheet({ classItem, years, links, open, onOpenChange }: ClassDetailSheetProps) {
  if (!classItem) return null;

  // Find which years this class is associated with
  const associatedYearIds = new Set(
    links.filter(l => l.class_id === classItem.id).map(l => l.school_year_id)
  );
  const associatedYears = years.filter(y => associatedYearIds.has(y.id));
  const activeAssociation = associatedYears.find(y => y.status === "active");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        {/* Header */}
        <DetailSheetHeader
          title={classItem.name}
          subtitle="Détails et associations de la classe"
          titleClassName="text-2xl font-black tracking-tight text-slate-900 leading-tight"
          subtitleClassName="mt-1 text-sm text-slate-600"
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Status Banner */}
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${classItem.status === "active"
              ? "bg-emerald-50 border-emerald-200"
              : "bg-slate-100 border-slate-200"
            }`}>
            {classItem.status === "active" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-slate-500 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-semibold ${classItem.status === "active" ? "text-emerald-800" : "text-slate-700"}`}>
                Classe {classItem.status === "active" ? "active" : "inactive"}
              </p>
              <p className={`text-xs ${classItem.status === "active" ? "text-emerald-600" : "text-slate-500"}`}>
                {classItem.status === "active"
                  ? "Cette classe est disponible pour les inscriptions."
                  : "Cette classe est désactivée et non visible aux parents."}
              </p>
            </div>
          </div>

          {/* Infos */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Informations</p>
            <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-24 shrink-0">Nom</span>
                <span className="text-sm font-medium text-slate-900">{classItem.name}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-24 shrink-0">Créée le</span>
                <span className="text-sm text-slate-700">
                  {new Date(classItem.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Année active */}
          {activeAssociation && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
              <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">Rattachée à l'année active</p>
                <p className="text-sm font-bold text-emerald-900">{activeAssociation.name}</p>
                <p className="text-xs text-emerald-600">
                  {new Date(activeAssociation.start_date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                  {" → "}
                  {new Date(activeAssociation.end_date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
          )}

          {/* Associations années */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Années associées</p>
              <Badge variant="outline" className="text-xs">{associatedYears.length}</Badge>
            </div>
            <div className="rounded-xl border border-slate-200/80 overflow-hidden">
              {associatedYears.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Layers className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground">Non rattachée à aucune année scolaire.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {associatedYears.map(year => (
                    <div key={year.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/70 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{year.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(year.start_date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                          {" → "}
                          {new Date(year.end_date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <YearStatusBadge status={year.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Non-associated years */}
          {years.length > 0 && years.length - associatedYears.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Années non rattachées</p>
              <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {years.filter(y => !associatedYearIds.has(y.id)).map(year => (
                    <div key={year.id} className="flex items-center justify-between px-4 py-3 opacity-50">
                      <div>
                        <p className="text-sm text-slate-600">{year.name}</p>
                      </div>
                      <YearStatusBadge status={year.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
