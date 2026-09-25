"use client";

import { Badge } from "@/components/ui/badge";
import type { ParentAccountStatus } from "./actions";

const STATUS_CONFIG: Record<
  ParentAccountStatus,
  { label: string; className: string }
> = {
  invited: {
    label: "Invité",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  active: {
    label: "Actif",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  inactive: {
    label: "Inactif",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

interface ParentStatusBadgeProps {
  status: ParentAccountStatus;
}

export function ParentStatusBadge({ status }: ParentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
