"use client";
/* eslint-disable react/no-unescaped-entities */

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FeesError({ reset }: { reset: () => void }) {
  return <div className="flex min-h-[50vh] items-center justify-center p-6"><div className="max-w-md text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle className="h-8 w-8" /></div><h2 className="mt-5 text-xl font-semibold text-slate-950">Impossible de charger les frais</h2><p className="mt-2 text-sm text-slate-500">Les données n'ont pas pu être récupérées. Réessayez dans un instant.</p><Button className="mt-5 gap-2" onClick={reset}><RefreshCw className="h-4 w-4" />Réessayer</Button></div></div>;
}
