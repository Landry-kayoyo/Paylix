"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { PriorDebtItem } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";

interface DebtsClientProps {
  initialDebts: PriorDebtItem[];
  initialTotal: number;
  archivedYears: { id: string; name: string }[];
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function DebtsClient({ initialDebts, initialTotal, archivedYears }: DebtsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page")) || 1;
  const currentYear = searchParams.get("year") ?? "all";
  const currentCurrency = searchParams.get("currency") ?? "all";
  const currentStatus = searchParams.get("status") ?? "all";

  const handleFilter = (key: string, value: string | null | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get("search") as string;
    handleFilter("search", search);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dettes des années passées</CardTitle>
        <CardDescription>
          Soldes impayés provenant des années scolaires clôturées. Lecture seule — aucun paiement dans cette vue.
        </CardDescription>
      </CardHeader>
      <CardContent>
          {/* Filtres */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="search"
                type="search"
                placeholder="Rechercher un élève ou matricule..."
                className="pl-8"
                defaultValue={searchParams.get("search") || ""}
              />
            </form>

            <Select value={currentYear} onValueChange={(val) => handleFilter("year", val ?? "all")}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Toutes les années" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les années</SelectItem>
                {archivedYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={currentCurrency} onValueChange={(val) => handleFilter("currency", val ?? "all")}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Devise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes devises</SelectItem>
                <SelectItem value="CDF">CDF</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>

            <Select value={currentStatus} onValueChange={(val) => handleFilter("status", val ?? "all")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="OPEN">En attente</SelectItem>
                <SelectItem value="SETTLED">Soldé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tableau */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Année d'origine</TableHead>
                  <TableHead className="text-right">Montant initial</TableHead>
                  <TableHead className="text-right">Reste dû</TableHead>
                  <TableHead className="text-right">Devise</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialDebts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                      Aucune dette antérieure trouvée.
                    </TableCell>
                  </TableRow>
                ) : (
                  initialDebts.map((debt) => (
                    <TableRow key={`${debt.student_id}-${debt.school_year_id}-${debt.currency}`}>
                      <TableCell className="font-medium">{debt.student_name}</TableCell>
                      <TableCell className="font-mono text-sm">{debt.student_matricule}</TableCell>
                      <TableCell>{debt.school_year_name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(debt.initial_amount, debt.currency)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {formatCurrency(debt.remaining_amount, debt.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{debt.currency}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={debt.status === "OPEN" ? "destructive" : "secondary"}>
                          {debt.status === "OPEN" ? "En attente" : "Soldé"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {initialTotal > 25 && (
            <Pagination
              page={currentPage}
              pageSize={25}
              total={initialTotal}
              onPageChange={(p) => handleFilter("page", p.toString())}
              className="mt-2"
            />
          )}
        </CardContent>
      </Card>
  );
}
