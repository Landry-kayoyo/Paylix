"use client";

import { useState, useEffect, useMemo } from "react";
import { Bell, CheckCheck, ArrowLeft, CreditCard, XCircle, FileText, Clock, AlertCircle, ChevronRight, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getNotifications, markAsRead } from "@/app/actions/notifications";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default function SchoolNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [readFilter, setReadFilter] = useState("all"); // 'all' or 'unread'
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // 'all', 'today', 'this_week', 'this_month'
  const [accountantFilter, setAccountantFilter] = useState("all");

  const router = useRouter();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch more for the director to allow meaningful filtering
      const { data, unreadCount } = await getNotifications(200);
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
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await markAsRead(id);
    }
    router.push(`/school/notifications/${id}`);
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

  // Extract unique accountants from notifications context
  const accountants = useMemo(() => {
    const names = new Set<string>();
    notifications.forEach(n => {
      if (n.context?.cancelled_by) names.add(n.context.cancelled_by);
      if (n.context?.recorded_by) names.add(n.context.recorded_by);
    });
    return Array.from(names).filter(Boolean);
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const now = new Date();
    
    return notifications.filter(n => {
      // 1. Read status filter
      if (readFilter === "unread" && n.read_at) return false;

      // 2. Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title?.toLowerCase().includes(q);
        const matchesMessage = n.message?.toLowerCase().includes(q);
        const matchesStudent = n.context?.student_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMessage && !matchesStudent) return false;
      }

      // 3. Date filter
      if (dateFilter !== "all") {
        const notifDate = new Date(n.created_at);
        if (dateFilter === "today") {
          if (notifDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === "this_week") {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (notifDate < oneWeekAgo) return false;
        } else if (dateFilter === "this_month") {
          if (notifDate.getMonth() !== now.getMonth() || notifDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      // 4. Accountant filter
      if (accountantFilter !== "all") {
        const cancelledBy = n.context?.cancelled_by;
        const recordedBy = n.context?.recorded_by;
        if (cancelledBy !== accountantFilter && recordedBy !== accountantFilter) {
          return false;
        }
      }

      return true;
    });
  }, [notifications, readFilter, searchQuery, dateFilter, accountantFilter]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/school">
            <Button variant="outline" size="icon" className="rounded-full shadow-sm hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Traçabilité & Notifications</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount > 0 ? `Vous avez ${unreadCount} alerte(s) non lue(s)` : "Vous êtes à jour"}
            </p>
          </div>
        </div>

        <Tabs defaultValue="all" value={readFilter} onValueChange={setReadFilter} className="w-full md:w-auto">
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

      {/* Advanced Filters */}
      <Card className="shadow-sm border-muted">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par message, élève, motif..."
              className="pl-9 w-full bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <select
              className="h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[140px]"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd'hui</option>
              <option value="this_week">Les 7 derniers jours</option>
              <option value="this_month">Ce mois-ci</option>
            </select>

            {accountants.length > 0 && (
              <select
                className="h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[150px]"
                value={accountantFilter}
                onChange={(e) => setAccountantFilter(e.target.value)}
              >
                <option value="all">Tous les comptables</option>
                {accountants.map((acc, idx) => (
                  <option key={idx} value={acc}>{acc}</option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

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
            <Filter className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <p className="text-foreground font-semibold text-lg">Aucun résultat</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Aucune notification ne correspond à vos filtres actuels. Essayez de modifier votre recherche.
          </p>
          {(searchQuery || dateFilter !== 'all' || accountantFilter !== 'all') && (
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setDateFilter("all");
                setAccountantFilter("all");
              }}
            >
              Réinitialiser les filtres
            </Button>
          )}
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
                  {notif.context?.cancelled_by && (
                    <span className="inline-flex items-center text-xs font-medium rounded-full px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-500">
                      Par: {notif.context.cancelled_by}
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
