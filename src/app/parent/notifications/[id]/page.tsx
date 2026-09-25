"use client";

import { useEffect, useState, use } from "react";
import { ArrowLeft, Bell, CreditCard, XCircle, FileText, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNotificationById } from "@/app/actions/notifications";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function NotificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [notification, setNotification] = useState<any>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadNotification() {
      setLoading(true);
      try {
        const { data } = await getNotificationById(resolvedParams.id);
        if (!data) {
          setError("Notification introuvable.");
        } else {
          setNotification(data);
          
          if (data.reference_type === 'payment' && data.reference_id) {
            import('@/app/actions/notifications').then(async (m) => {
              const res = await m.getReceiptByPaymentId(data.reference_id);
              if (res.data) setReceiptId(res.data.id);
            });
          }
        }
      } catch (err) {
        setError("Erreur lors du chargement de la notification.");
      } finally {
        setLoading(false);
      }
    }
    loadNotification();
  }, [resolvedParams.id]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "PAYMENT_CREATED":
        return <CreditCard className="h-10 w-10 text-blue-500" />;
      case "PAYMENT_CANCELLED":
        return <XCircle className="h-10 w-10 text-red-500" />;
      case "RECEIPT_CREATED":
        return <FileText className="h-10 w-10 text-green-500" />;
      case "DUE_DATE_APPROACHING":
        return <Clock className="h-10 w-10 text-orange-500" />;
      case "PAYMENT_OVERDUE":
        return <AlertCircle className="h-10 w-10 text-red-600" />;
      default:
        return <Bell className="h-10 w-10 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 max-w-3xl mx-auto w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/parent/notifications">
            <Button variant="outline" size="icon" className="rounded-full shadow-sm hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-xl font-bold">Retour</h2>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive font-medium shadow-sm">
          {error || "Notification introuvable."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Link href="/parent/notifications">
          <Button variant="outline" size="icon" className="rounded-full shadow-sm hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Détail de la notification</h2>
          <p className="text-sm text-muted-foreground">
            Consulté le {new Date().toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      {/* Detail Card */}
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {/* Banner area */}
        <div className="bg-muted/30 p-8 flex flex-col items-center justify-center text-center border-b border-border/50">
          <div className="h-20 w-20 rounded-full bg-background shadow-sm flex items-center justify-center mb-4">
            {getTypeIcon(notification.type)}
          </div>
          <h3 className="text-xl font-semibold text-foreground max-w-md">
            {notification.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            Reçu le {new Date(notification.created_at).toLocaleDateString("fr-FR", {
              weekday: 'long',
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Content area */}
        <div className="p-8">
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
            <p className="text-foreground/90 leading-relaxed text-base whitespace-pre-line">
              {notification.message}
            </p>
          </div>

          {/* Context Details (if any) */}
          {notification.context && Object.keys(notification.context).length > 0 && (
            <div className="mt-8 pt-8 border-t border-border/50">
              <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Informations complémentaires</h4>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {notification.context.student_name && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <dt className="text-xs text-muted-foreground mb-1">Élève concerné</dt>
                    <dd className="text-sm font-medium text-foreground">{notification.context.student_name}</dd>
                  </div>
                )}
                {notification.context.amount && (
                  <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3">
                    <dt className="text-xs text-green-600/70 dark:text-green-500/70 mb-1">Montant</dt>
                    <dd className="text-sm font-semibold text-green-700 dark:text-green-400">
                      {notification.context.amount} {notification.context.currency || "USD"}
                    </dd>
                  </div>
                )}
                {notification.context.remaining !== undefined && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <dt className="text-xs text-muted-foreground mb-1">Reste à payer</dt>
                    <dd className="text-sm font-medium text-foreground">
                      {notification.context.remaining} {notification.context.currency || "USD"}
                    </dd>
                  </div>
                )}
                {notification.context.reason && (
                  <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 col-span-1 sm:col-span-2">
                    <dt className="text-xs text-red-600/70 dark:text-red-500/70 mb-1">Motif</dt>
                    <dd className="text-sm font-medium text-red-700 dark:text-red-400">
                      {notification.context.reason}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Action button if receipt exists */}
          {receiptId && (
            <div className="mt-8 flex justify-center">
              <Link href={`/parent/receipts/${receiptId}`}>
                <Button className="w-full sm:w-auto" size="lg">
                  Voir le reçu
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Action */}
      <div className="flex justify-center mt-2">
        <Link href="/parent/notifications">
          <Button variant="ghost" className="text-muted-foreground">
            Retour à la liste des notifications
          </Button>
        </Link>
      </div>
    </div>
  );
}
