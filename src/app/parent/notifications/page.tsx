"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCheck, ArrowLeft, CreditCard, XCircle, FileText, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNotifications, markAsRead } from "@/app/actions/notifications";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all"); // 'all' or 'unread'
  const router = useRouter();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, unreadCount } = await getNotifications(50);
      setNotifications(data);
      setUnreadCount(unreadCount);
    } catch (err: any) {
      setError("Impossible de charger les notifications.");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (id: string, isUnread: boolean) => {
    if (isUnread) {
      // Optmistically mark as read in UI
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await markAsRead(id); // Fire and forget
    }
    router.push(`/parent/notifications/${id}`);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "PAYMENT_CREATED":
        return <CreditCard className="h-5 w-5 text-blue-500" />;
      case "PAYMENT_CANCELLED":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "RECEIPT_CREATED":
        return <FileText className="h-5 w-5 text-green-500" />;
      case "DUE_DATE_APPROACHING":
        return <Clock className="h-5 w-5 text-orange-500" />;
      case "PAYMENT_OVERDUE":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.read_at;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-4xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/parent">
            <Button variant="outline" size="icon" className="rounded-full shadow-sm hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount > 0 ? `Vous avez ${unreadCount} notification(s) non lue(s)` : "Vous êtes à jour"}
            </p>
          </div>
        </div>

        <Tabs defaultValue="all" value={filter} onValueChange={setFilter} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2 shadow-sm">
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="unread" className="relative">
              Non lues
              {unreadCount > 0 && (
                <span className="ml-2 flex h-2 w-2 rounded-full bg-primary" />
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive font-medium shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && filteredNotifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card rounded-xl border shadow-sm px-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Bell className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <p className="text-foreground font-semibold text-lg">Rien à signaler</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {filter === "unread" 
              ? "Vous avez lu toutes vos notifications." 
              : "Vous n'avez reçu aucune notification pour le moment."}
          </p>
        </div>
      )}

      {!loading && !error && filteredNotifications.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif.id, !notif.read_at)}
              className={cn(
                "group flex gap-4 p-5 rounded-xl border transition-all duration-200 cursor-pointer items-center",
                !notif.read_at 
                  ? "bg-primary/5 border-primary/20 shadow-sm hover:bg-primary/10 hover:border-primary/30" 
                  : "bg-card hover:bg-accent/50 hover:border-border/80"
              )}
            >
              {/* Type icon with background */}
              <div className={cn(
                "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center shadow-sm",
                !notif.read_at ? "bg-background" : "bg-muted"
              )}>
                {getTypeIcon(notif.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-start justify-between gap-4">
                  <h4 className={cn(
                    "text-base leading-none mb-1.5",
                    !notif.read_at ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                  )}>
                    {notif.title}
                  </h4>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(notif.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {!notif.read_at && (
                      <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
                    )}
                  </div>
                </div>

                <p className={cn(
                  "text-sm leading-relaxed line-clamp-2",
                  !notif.read_at ? "text-foreground/80" : "text-muted-foreground"
                )}>
                  {notif.message}
                </p>

                {/* Tags below message */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {notif.context?.student_name && (
                    <span className={cn(
                      "inline-flex items-center text-xs font-medium rounded-full px-2.5 py-1",
                      !notif.read_at 
                        ? "bg-primary/15 text-primary" 
                        : "bg-secondary text-secondary-foreground"
                    )}>
                      {notif.context.student_name}
                    </span>
                  )}
                  {notif.context?.amount && (
                    <span className="inline-flex items-center text-xs font-medium rounded-full px-2.5 py-1 bg-green-500/10 text-green-600 dark:text-green-500">
                      {notif.context.amount} {notif.context.currency}
                    </span>
                  )}
                  {notif.read_at && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground ml-auto">
                      <CheckCheck className="h-3.5 w-3.5" /> Lue
                    </span>
                  )}
                </div>
              </div>
              
              {/* Chevron icon indicating clickability */}
              <div className="flex-shrink-0 pl-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
