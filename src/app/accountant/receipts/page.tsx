'use client';

import { useState, useEffect } from 'react';
import { getReceipts, getReceiptDetails, GetReceiptsFilters } from '@/app/actions/receipts';
import { exportReceiptsToExcel } from '@/lib/excel-export';
import { ReceiptDocument } from '@/components/receipts/receipt-document';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, FileText, Download, CheckCircle2, XCircle, Filter, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AccountantReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('');

  // Modal d'aperçu de reçu
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReceiptsList = async () => {
    setLoading(true);
    setListError(null);
    const filters: GetReceiptsFilters = {
      search: search || undefined,
      status: statusFilter || undefined,
      currency: currencyFilter || undefined,
    };

    const res = await getReceipts(filters);
    if (res.data) {
      setReceipts(res.data);
    }
    if (res.error) {
      setReceipts([]);
      setListError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReceiptsList();
  }, [statusFilter, currencyFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReceiptsList();
  };

  const handleOpenReceiptDetail = async (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setIsModalOpen(true);
    setLoadingDetail(true);

    const res = await getReceiptDetails(receiptId);
    if (res.data) {
      setReceiptDetail(res.data);
    }
    setLoadingDetail(false);
  };

  const handleExportExcel = () => {
    if (receipts.length === 0) return;
    exportReceiptsToExcel(receipts);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reçus de Paiement</h1>
          <p className="text-muted-foreground">Consultez, imprimez et téléchargez les reçus officiels des paiements.</p>
        </div>
        
        <Button variant="outline" onClick={handleExportExcel} disabled={receipts.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exporter en Excel
        </Button>
      </div>

      {/* Barre de Recherche et Filtres */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par n° reçu, élève ou matricule..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <select
                className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tous les statuts</option>
                <option value="confirmed">Confirmés (Valides)</option>
                <option value="cancelled">Annulés</option>
              </select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Liste des reçus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Historique des reçus générés ({receipts.length})</CardTitle>
          <CardDescription>Les reçus officiels sont générés automatiquement après chaque paiement validé.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              <span>Chargement des reçus en cours...</span>
            </div>
          ) : receipts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <FileText className="h-8 w-8 mx-auto text-slate-400" />
              <p>{listError || 'Aucun reçu correspondant aux critères de recherche.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-md divide-y">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">N° Reçu</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Élève</th>
                    <th className="p-3">Classe</th>
                    <th className="p-3">Comptable</th>
                    <th className="p-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receipts.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-emerald-50/60 transition-colors cursor-pointer"
                      onClick={() => handleOpenReceiptDetail(r.id)}
                    >
                      <td className="p-3 font-mono font-bold text-slate-900">{r.receipt_number}</td>
                      <td className="p-3 text-slate-600">{new Date(r.payment_date).toLocaleDateString()}</td>
                      <td className="p-3">
                        <p className="font-medium text-slate-900">{r.student_name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{r.matricule}</p>
                      </td>
                      <td className="p-3 text-slate-700">{r.class_name}</td>
                      <td className="p-3 text-xs text-slate-600">{r.recorded_by}</td>
                      <td className="p-3 text-center">
                        <Badge variant={r.status === 'confirmed' ? 'default' : 'destructive'}>
                          {r.status === 'confirmed' ? 'Valide' : 'Annulé'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal d'Affichage / Impression du Reçu */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="min-w-0 max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-3 sm:max-w-4xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Aperçu du Reçu Officiel</DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span>Chargement du reçu...</span>
            </div>
          ) : receiptDetail ? (
            <ReceiptDocument receipt={receiptDetail} />
          ) : (
            <div className="p-4 text-center text-rose-600">Impossible de charger ce reçu.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
