"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RefreshButtonProps {
  onRefresh: () => void;
  label?: string;
  loading?: boolean;
  className?: string;
}

export function RefreshButton({ onRefresh, label = "Actualiser", loading = false, className = "" }: RefreshButtonProps) {
  return (
    <Button variant="ghost" size="sm" className={`gap-1.5 text-xs ${className}`} onClick={onRefresh} disabled={loading}>
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {label}
    </Button>
  );
}
