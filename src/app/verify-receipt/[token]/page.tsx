'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { verifyReceiptPublic } from '@/app/actions/receipts';
import { CheckCircle2, XCircle, ShieldCheck, AlertCircle, Building2, UserCheck, Calendar, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

export default function PublicVerifyReceiptPage() {
  const params = useParams();
  const token = params.token as string;

  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkReceipt() {
      if (!token) return;
      setLoading(true);
      const res = await verifyReceiptPublic(token);
      setVerification(res);
      setLoading(false);
    }
    checkReceipt();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 font-medium text-sm">Vérification de l'authenticité du reçu Paylix...</p>
        </div>
      </div>
    );
  }

  if (!verification || !verification.valid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-rose-200 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="h-14 w-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <XCircle className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl text-rose-700">Reçu Invalide ou Introuvable</CardTitle>
            <CardDescription>
              Ce code de vérification ne correspond à aucun reçu enregistré dans la plateforme Paylix.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-6">
              Veuillez vérifier le QR Code ou vous adresser au service de comptabilité de l'établissement.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">Retour à l'accueil Paylix</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCancelled = verification.status === 'cancelled';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-4">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 text-emerald-700 font-bold text-lg">
            <ShieldCheck className="h-6 w-6" />
            <span>Paylix Public Verification</span>
          </div>
          <p className="text-xs text-slate-500">Service officiel de vérification d'authenticité de reçu</p>
        </div>

        {/* Verification Card */}
        <Card className={`border shadow-lg ${isCancelled ? 'border-rose-300' : 'border-emerald-300'}`}>
          <CardHeader className={`text-center pb-4 ${isCancelled ? 'bg-rose-50/70' : 'bg-emerald-50/70'} rounded-t-xl`}>
            <div className={`h-14 w-14 ${isCancelled ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'} rounded-full flex items-center justify-center mx-auto mb-2`}>
              {isCancelled ? <AlertCircle className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
            </div>
            
            <Badge variant={isCancelled ? "destructive" : "default"} className="mx-auto text-xs px-3 py-1 font-semibold uppercase tracking-wider">
              {isCancelled ? "REÇU ANNULÉ" : "REÇU AUTHENTIQUE & VALIDE"}
            </Badge>

            <CardTitle className="text-2xl font-bold font-mono text-slate-900 mt-2">
              {verification.receipt_number}
            </CardTitle>
            <CardDescription className="text-xs font-medium text-slate-600">
              {verification.school_name}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-6 text-sm">
            {isCancelled && (
              <div className="p-3 bg-rose-100/60 border border-rose-200 rounded-lg text-rose-800 text-xs">
                <p className="font-bold">Ce reçu a été annulé par l'établissement.</p>
                {verification.cancelled_at && (
                  <p className="mt-0.5">Date d'annulation : {new Date(verification.cancelled_at).toLocaleString()}</p>
                )}
                {verification.cancellation_reason && (
                  <p className="mt-0.5 font-medium">Motif : {verification.cancellation_reason}</p>
                )}
              </div>
            )}

            {/* Content Details */}
            <div className="divide-y border border-slate-200 rounded-lg">
              <div className="p-3 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-slate-400" /> Élève
                </span>
                <span className="font-bold text-slate-800">{verification.student_first_name} {verification.student_last_name}</span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Matricule</span>
                <span className="font-mono font-semibold text-slate-700">{verification.student_matricule}</span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-400" /> Date du Règlement
                </span>
                <span className="font-semibold text-slate-800">{new Date(verification.payment_date).toLocaleDateString()}</span>
              </div>

              <div className="p-3 flex items-center justify-between bg-slate-900 text-white rounded-b-lg">
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-emerald-400" /> Montant Versé
                </span>
                <span className="text-xl font-extrabold font-mono text-emerald-400">
                  {Number(verification.amount).toLocaleString()} {verification.currency}
                </span>
              </div>
            </div>

            <div className="pt-2 text-center">
              <p className="text-[11px] text-slate-400">
                Informations certifiées conformes par le système d'authentification Paylix.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
