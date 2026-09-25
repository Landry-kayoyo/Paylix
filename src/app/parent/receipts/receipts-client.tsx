"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ParentDashboardData } from "../actions";
import { ParentReceiptPreview } from "../receipt-preview";

export default function ParentReceiptsClient({ data }: { data: ParentDashboardData }) {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const receipts = useMemo(() => data.children.flatMap((child) =>
    child.payments
      .filter((payment) => payment.receipt)
      .map((payment) => ({
        ...payment,
        receipt: payment.receipt!,
        studentName: `${child.student.first_name} ${child.student.last_name}`,
        matricule: child.student.matricule,
      }))
  ).filter((payment) => {
    const query = search.trim().toLowerCase();
    const paymentDate = payment.payment_date.slice(0, 10);
    return (!query || payment.receipt.receipt_number.toLowerCase().includes(query) || payment.studentName.toLowerCase().includes(query) || payment.matricule.toLowerCase().includes(query))
      && (!startDate || paymentDate >= startDate)
      && (!endDate || paymentDate <= endDate);
  }).sort((a, b) => b.payment_date.localeCompare(a.payment_date)), [data.children, search, startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/parent">
          <Button variant="outline" size="icon" aria-label="Retour au portail parent"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes reçus</h1>
          <p className="text-muted-foreground">Consultez vos reçus complets et téléchargez-les.</p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Numéro du reçu, élève ou matricule" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" type="date" aria-label="Date de début" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" type="date" aria-label="Date de fin" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historique des reçus ({receipts.length})</CardTitle>
          <CardDescription>Les reçus de vos enfants sont accessibles uniquement depuis votre espace parent.</CardDescription>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-8 w-8 text-slate-400" />
              Aucun reçu ne correspond à ces critères.
            </div>
          ) : (
            <div className="space-y-3">
              {receipts.map((receipt) => (
                <div key={receipt.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-emerald-100 p-2 text-emerald-700"><FileText className="h-4 w-4" /></div>
                    <div>
                      <p className="font-semibold">{receipt.receipt.receipt_number}</p>
                      <p className="text-sm text-slate-600">{receipt.studentName} · {receipt.matricule}</p>
                      <p className="text-xs text-muted-foreground">{new Date(receipt.payment_date).toLocaleDateString("fr-CD")}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-right">
                      <p className="font-mono font-semibold">{receipt.amount.toLocaleString()} {receipt.currency}</p>
                      <Badge variant={receipt.status === "confirmed" ? "default" : "destructive"}>{receipt.status === "confirmed" ? "Valide" : "Annulé"}</Badge>
                    </div>
                    <ParentReceiptPreview receiptId={receipt.receipt.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
