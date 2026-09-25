'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cancelPayment } from '@/app/actions/payments';
import { getReceiptDetails } from '@/app/actions/receipts';
import { ReceiptDocument } from '@/components/receipts/receipt-document';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, Loader2, FileText, Printer } from 'lucide-react';
import Link from 'next/link';

interface PaymentDetailPageProps {
  readOnly?: boolean;
  basePath?: string;
}

export default function PaymentDetailPage({ readOnly = false, basePath = '/accountant' }: PaymentDetailPageProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const paymentId = params.paymentId as string;
  const supabase = createClient();

  const [payment, setPayment] = useState<any>(null);
  const [groupedAmounts, setGroupedAmounts] = useState<{ amount: number, currency: string, status: string }[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [receiptInfo, setReceiptInfo] = useState<any>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Modal de reçu
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptDetail, setReceiptDetail] = useState<any>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    async function fetchPayment() {
      setLoading(true);
      
      const { data: payDataRaw } = await supabase
        .from('payments')
        .select(`
          id, tenant_id, amount, currency, payment_date, reference, notes, status, created_at,
          cancellation_reason, cancelled_at, payment_group_id,
          students (
            first_name,
            last_name,
            post_name,
            matricule,
            student_enrollments (
              classes (name)
            )
          ),
          recorded_by,
          profiles:recorded_by (first_name, last_name),
          cancelled_by_user:cancelled_by (first_name, last_name)
        `)
        .eq('id', paymentId)
        .single();
      
      const payData = payDataRaw as any;
      if (payData) {
        setPayment(payData);
        
        // Récupérer les informations du reçu
        const { data: recData } = await supabase
          .from('receipts')
          .select('id, receipt_number')
          .eq('payment_id', paymentId)
          .maybeSingle();

        if (recData) {
          setReceiptInfo(recData);
        }

        // Fetch grouped payments if multi-currency
        if (payData.payment_group_id) {
          const { data: groupData } = await supabase
            .from('payments')
            .select('amount, currency, status')
            .eq('payment_group_id', payData.payment_group_id);
          
          if (groupData) {
            setGroupedAmounts(groupData);
          }
        } else {
          setGroupedAmounts([{ amount: payData.amount, currency: payData.currency, status: payData.status }]);
        }

        // Fetch allocations to get the fee names (nom du frais)
        const { data: allocData } = await supabase
          .from('payment_allocations')
          .select(`
            amount,
            currency,
            financial_obligations (
              fee_types (name)
            )
          `)
          .eq('payment_id', paymentId);
        
        if (allocData) {
          setAllocations(allocData);
        }

        // If profile is missing, we try to fetch it directly as fallback
        if (!payData.profiles && payData.recorded_by) {
           const { data: profData } = await supabase.from('profiles').select('first_name, last_name').eq('id', payData.recorded_by).maybeSingle();
           if (profData) payData.profiles = profData;
        }
      }
      
      setLoading(false);
    }
    
    if (paymentId) fetchPayment();
  }, [paymentId, supabase]);

  const handleCancelPayment = async () => {
    setCancelError(null);
    if (!cancelReason || cancelReason.length < 3) {
      setCancelError("Le motif d'annulation doit comporter au moins 3 caractères.");
      return;
    }

    setIsCancelling(true);
    const result = await cancelPayment({
      payment_id: paymentId,
      tenant_id: payment.tenant_id,
      cancellation_reason: cancelReason
    });

    if (result.error) {
      setCancelError(result.error);
      setIsCancelling(false);
    } else {
      setIsCancelModalOpen(false);
      window.location.reload();
    }
  };

  const handleOpenReceiptModal = async () => {
    if (!receiptInfo?.id) return;
    setIsReceiptModalOpen(true);
    setLoadingReceipt(true);
    setReceiptError(null);
    setReceiptDetail(null);
    const res = await getReceiptDetails(receiptInfo.id);
    if (res.data) {
      setReceiptDetail(res.data);
    } else {
      setReceiptError(res.error || 'Impossible de charger le reçu.');
    }
    setLoadingReceipt(false);
  };

  useEffect(() => {
    if (searchParams.get('receipt') === '1' && receiptInfo?.id && !receiptDetail) {
      handleOpenReceiptModal();
    }
  }, [receiptInfo?.id, receiptDetail, searchParams]);

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  if (!payment) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Paiement introuvable</h2>
        <p className="text-muted-foreground mt-2">Le paiement demandé n'existe pas ou vous n'y avez pas accès.</p>
        <Link href={`${basePath}/payments`}>
          <Button className="mt-4">Retour aux paiements</Button>
        </Link>
      </div>
    );
  }

  const isConfirmed = payment.status === 'confirmed';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`${basePath}/payments`}>
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Détail du paiement</h1>
            <p className="text-muted-foreground font-mono text-xs">ID: {payment.id}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {receiptInfo && (
            <Button variant="outline" onClick={handleOpenReceiptModal}>
              <FileText className="mr-2 h-4 w-4 text-emerald-600" />
              Voir le Reçu ({receiptInfo.receipt_number})
            </Button>
          )}

          {isConfirmed && !readOnly && (
            <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
              <DialogTrigger render={<Button variant="destructive" />}>
                Annuler ce paiement
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Annuler le paiement</DialogTitle>
                  <DialogDescription>
                    Cette action annulera ce paiement et toutes ses affectations. Le statut des obligations sera recalculé. 
                    L'historique et le reçu seront conservés avec le statut **ANNULÉ**. Un motif est obligatoire.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  {cancelError && (
                    <div className="p-3 bg-rose-50 text-rose-700 rounded-md text-sm">{cancelError}</div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="reason" className="text-sm font-medium leading-none">Motif de l'annulation *</label>
                    <Input 
                      id="reason" 
                      placeholder="Ex: Erreur de saisie du montant" 
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Fermer</Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleCancelPayment}
                    disabled={isCancelling || cancelReason.length < 3}
                  >
                    {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirmer l'annulation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {!isConfirmed && (
        <div className="bg-rose-50 border border-rose-200 rounded-md p-4 flex gap-3 text-rose-800">
          <XCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <h3 className="font-semibold">Ce paiement a été annulé</h3>
            <p className="text-sm mt-1">Le {new Date(payment.cancelled_at).toLocaleString()} par {payment.cancelled_by_user?.first_name} {payment.cancelled_by_user?.last_name}.</p>
            <p className="text-sm mt-1 font-medium">Motif : {payment.cancellation_reason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-muted-foreground text-xs font-medium">Statut</label>
              <div>
                <Badge variant={isConfirmed ? "default" : "destructive"} className="mt-1">
                  {isConfirmed ? "Confirmé" : "Annulé"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-muted-foreground text-xs font-medium">Détail des frais payés</label>
              {allocations.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {allocations.map((alloc, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b pb-1 last:border-0">
                      <span className="font-medium text-foreground">
                        {alloc.financial_obligations?.fee_types?.name || 'Frais'}
                      </span>
                      <span className="font-bold font-mono">
                        {Number(alloc.amount).toLocaleString()} {alloc.currency}
                      </span>
                    </div>
                  ))}
                </div>
              ) : groupedAmounts.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {groupedAmounts.map((a, idx) => (
                    <p key={idx} className={`text-xl font-bold font-mono ${a.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                      {Number(a.amount).toLocaleString()} {a.currency}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xl font-bold font-mono mt-1">{Number(payment.amount).toLocaleString()} {payment.currency}</p>
              )}
            </div>
            <div>
              <label className="text-muted-foreground text-xs font-medium">Date de paiement</label>
              <p className="font-medium">{new Date(payment.payment_date).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="text-muted-foreground text-xs font-medium">Enregistré par</label>
              <p className="font-medium">{payment.profiles?.first_name ? `${payment.profiles.first_name} ${payment.profiles.last_name || ''}` : 'Système'} le {new Date(payment.created_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations de l'élève</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-muted-foreground text-xs font-medium">Nom complet</label>
              <p className="font-medium text-lg uppercase">
                {[payment.students?.last_name, payment.students?.post_name, payment.students?.first_name].filter(Boolean).join(' ')}
              </p>
            </div>
            <div>
              <label className="text-muted-foreground text-xs font-medium">Matricule</label>
              <p className="font-medium font-mono">{payment.students?.matricule}</p>
            </div>
            <div>
              <label className="text-muted-foreground text-xs font-medium">Classe</label>
              <p className="font-medium">{payment.students?.student_enrollments?.[0]?.classes?.name || 'Non assigné'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal d'aperçu du Reçu */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="min-w-0 max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-3 sm:max-w-4xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Reçu de Paiement Officiel</DialogTitle>
          </DialogHeader>

          {loadingReceipt ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span>Chargement du reçu...</span>
            </div>
          ) : receiptDetail ? (
            <ReceiptDocument receipt={receiptDetail} />
          ) : (
            <div className="p-4 text-center text-rose-600">{receiptError || 'Impossible de charger le reçu.'}</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
