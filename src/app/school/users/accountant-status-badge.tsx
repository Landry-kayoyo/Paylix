"use client";

import { Badge } from "@/components/ui/badge";
import { AccountantStatus } from "./actions";

interface StatusBadgeProps {
  status: AccountantStatus;
}

export function AccountantStatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "invited":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          INVITÉ
        </Badge>
      );
    case "active":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          ACTIF
        </Badge>
      );
    case "inactive":
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
          DÉSACTIVÉ
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
