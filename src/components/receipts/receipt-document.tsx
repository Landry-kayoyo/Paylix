'use client';

import { useEffect, useState } from 'react';
import { generateQRCodeDataUrl } from '@/lib/qr-code';
import { Printer, Download, CheckCircle2, XCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ReceiptDocumentProps {
  receipt: {
    receipt_id: string;
    receipt_number: string;
    verification_token: string;
    issued_at: string;
    payment_id: string;
    payment_date: string;
    amount: number;
    currency: string;
    currency_totals?: Record<string, number>;
    status: 'confirmed' | 'cancelled';
    cancellation_reason?: string | null;
    cancelled_at?: string | null;
    cancelled_by?: string | null;
    school_year_name: string;
    recorded_by: string;
    student: {
      id: string;
      first_name: string;
      last_name: string;
      post_name?: string | null;
      full_name?: string;
      matricule: string;
      class_name: string;
    };
    tenant: {
      name: string;
      logo_url?: string;
      address?: string;
      phone?: string;
      email?: string;
      city?: string;
      country?: string;
    };
    allocations: Array<{
      id: string;
      fee_name: string;
      period_month: string;
      initial_amount: number;
      paid_before: number;
      allocated_amount: number;
      remaining_after: number;
      currency: string;
    }>;
  };
  showActions?: boolean;
}

export function ReceiptDocument({ receipt, showActions = true }: ReceiptDocumentProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const isCancelled = receipt.status === 'cancelled';

  useEffect(() => {
    // Générer l'URL publique de vérification
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://paylix.app';
    const verifyUrl = `${origin}/verify-receipt/${receipt.verification_token}`;
    
    generateQRCodeDataUrl(verifyUrl).then(url => {
      setQrCodeUrl(url);
    });
  }, [receipt.verification_token]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-w-0 w-full max-w-full space-y-3 overflow-x-hidden sm:space-y-6">
      {/* Boutons d'action pour impression / téléchargement (Masqués lors de l'impression) */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" className="h-8 px-2 text-[10px] sm:h-9 sm:px-3 sm:text-sm" onClick={handlePrint}>
              <Printer className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Imprimer</span>
              <span className="hidden sm:inline">Imprimer</span>
            </Button>
          </div>
        </div>
      )}

      {/* Conteneur du reçu avec style papier moderne et impression optimisée */}
      <div 
        id="receipt-print-area"
        className="relative min-w-0 w-full max-w-full overflow-hidden bg-white border border-slate-200 rounded-xl p-2 sm:p-8 shadow-sm text-slate-800 print:border-none print:shadow-none print:p-0 print:m-0"
      >
        {/* Filigrane grand format si annulé */}
        {isCancelled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10">
            <span className="text-rose-500/15 font-black text-6xl sm:text-8xl tracking-widest -rotate-45 select-none uppercase">
              REÇU ANNULÉ
            </span>
          </div>
        )}

        {/* 1. ENTÊTE ÉTABLISSEMENT */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 pb-3 sm:pb-6 border-b border-slate-200">
          <div className="flex min-w-0 w-full items-center justify-center gap-2 text-center sm:gap-4">
            <div className="min-w-0 w-full">
              <h1 className="break-words text-base sm:text-xl font-bold text-slate-900 leading-tight">{receipt.tenant.name}</h1>
              {receipt.tenant.address && (
                <p className="text-[10px] sm:text-xs text-slate-600">{receipt.tenant.address}{receipt.tenant.city ? `, ${receipt.tenant.city}` : ''}</p>
              )}
              <div className="text-[10px] sm:text-xs text-slate-600 flex flex-wrap justify-center gap-x-2 sm:gap-x-3 gap-y-0.5 mt-0.5">
                {receipt.tenant.phone && <span>Tél: {receipt.tenant.phone}</span>}
                {receipt.tenant.email && <span>Email: {receipt.tenant.email}</span>}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-auto text-left sm:text-right bg-emerald-50/70 border border-emerald-100 p-2 sm:p-3 rounded-lg print:bg-slate-50 print:border-slate-200">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">Reçu de Paiement</span>
            <span className="text-lg font-extrabold text-slate-900 block font-mono">{receipt.receipt_number}</span>
            <span className="text-xs text-slate-600 block mt-0.5">
              Date: {new Date(receipt.payment_date).toLocaleDateString()}
            </span>
            <span className="text-xs text-slate-600 block">
              Année: {receipt.school_year_name}
            </span>
          </div>
        </div>

        {/* Alerte Annulation explicite */}
        {isCancelled && (
          <div className="my-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">ATTENTION : Ce reçu a été annulé et n'a plus de valeur financière.</p>
              <p className="text-xs mt-1">
                Annulé le {receipt.cancelled_at ? new Date(receipt.cancelled_at).toLocaleString() : '-'} 
                {receipt.cancelled_by ? ` par ${receipt.cancelled_by}` : ''}.
              </p>
              {receipt.cancellation_reason && (
                <p className="text-xs mt-0.5 italic font-medium">Motif: {receipt.cancellation_reason}</p>
              )}
            </div>
          </div>
        )}

        {/* 2. IDENTIFICATION ÉLÈVE */}
        <div className="my-3 sm:my-6 p-2 sm:p-4 bg-slate-50/80 rounded-lg border border-slate-200 grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
          <div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block">Élève</span>
            <span className="font-bold text-slate-900 text-xs sm:text-base">{receipt.student.full_name || [receipt.student.last_name, receipt.student.post_name, receipt.student.first_name].filter(Boolean).join(' ')}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block">Matricule</span>
            <span className="font-semibold text-slate-800 font-mono">{receipt.student.matricule}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block">Classe</span>
            <span className="font-semibold text-slate-800">{receipt.student.class_name}</span>
          </div>
        </div>

        {/* 3. DÉTAIL FINANCIER & ALLOCATIONS */}
        <div className="my-3 sm:my-6">
          <h3 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 sm:mb-3">Détail du paiement et affectations</h3>
          
          <div className="w-full min-w-0 max-w-full overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-0 sm:min-w-[620px] w-full text-[10px] sm:text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-1.5 px-2 sm:py-2.5 sm:px-4">Intitulé du Frais</th>
                  <th className="py-1.5 px-2 sm:py-2.5 sm:px-4">Période</th>
              
                  <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-right text-emerald-700 font-bold">Affecté</th>
                  <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-right">Reste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {receipt.allocations.map((alloc) => (
                  <tr key={alloc.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-2 sm:py-3 sm:px-4 font-medium text-slate-900">{alloc.fee_name}</td>
                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-slate-600 text-xs">{alloc.period_month}</td>

                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/50">{alloc.allocated_amount.toLocaleString()} {alloc.currency}</td>
                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-right font-mono text-slate-700 font-semibold">{alloc.remaining_after.toLocaleString()} {alloc.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. TOTAL ET RÉSUMÉ */}
        <div className="my-3 sm:my-6 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white p-2 sm:p-4 rounded-xl shadow-sm print:bg-slate-900 print:text-white">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Montant Total Versé</span>
           
          </div>
          <div className="mt-2 sm:mt-0 text-left sm:text-right">
            {Object.entries(receipt.currency_totals || { [receipt.currency]: receipt.amount }).map(([currency, amount]) => (
              <span key={currency} className="block text-xl sm:text-3xl font-extrabold font-mono tracking-tight text-emerald-400">
                {Number(amount).toLocaleString()} {currency}
              </span>
            ))}
          </div>
        </div>

        {/* 5. PIED DE PAGE & QR CODE SÉCURISÉ */}
        <div className="pt-3 sm:pt-6 border-t border-slate-200 grid grid-cols-3 gap-2 sm:gap-6 items-center text-[10px] sm:text-xs">
          {/* Information Comptable */}
          <div>
            <span className="text-slate-500 font-medium block">Perçu par</span>
            <span className="font-bold text-slate-800 block text-xs sm:text-sm">{receipt.recorded_by}</span>
            <span className="text-slate-500 block mt-1">Date d'émission: {new Date(receipt.issued_at).toLocaleString()}</span>
          </div>

          {/* Sceau de vérification */}
          <div className="text-center flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
              <ShieldCheck className="h-4 w-4" />
              <span>Paylix Verified Document</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Ce document est sécurisé et traçable dans le système comptable Paylix.
            </p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center sm:items-end justify-center">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code de vérification" className="h-14 w-14 sm:h-20 sm:w-20 border border-slate-200 rounded p-1 bg-white" />
            ) : (
              <div className="h-14 w-14 sm:h-20 sm:w-20 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400">
                QR Code
              </div>
            )}
            <span className="text-[10px] text-slate-400 mt-1 text-center sm:text-right font-mono">Scan pour vérifier</span>
          </div>
        </div>
      </div>
    </div>
  );
}
