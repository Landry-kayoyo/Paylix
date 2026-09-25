"use client";

import { useState, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getNotifications, markAsRead } from "@/app/actions/notifications";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const basePath = pathname.startsWith('/school') ? '/school' : '/parent';

  useEffect(() => {
    fetchNotifications();

    const supabase = createClient();
    let channel: any;
    let isMounted = true;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      channel = supabase
        .channel(`realtime-notifications-${user.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            console.log("Realtime notification received:", payload);
            const newNotif = payload.new;
            setNotifications(prev => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
            setUnreadCount(prev => prev + 1);
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status:", status);
        });
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const fetchNotifications = async () => {
    const { data, unreadCount } = await getNotifications();
    setNotifications(data);
    setUnreadCount(unreadCount);
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read_at) {
      // Optimistically update
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await markAsRead(notif.id);
    }
    setOpen(false);
    router.push(`${basePath}/notifications/${notif.id}`);
  };

  const unreadNotifs = notifications.filter(n => !n.read_at);
  const displayNotifs = unreadNotifs.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) fetchNotifications(); }}>
      <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full text-muted-foreground hover:text-foreground relative")}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span className="sr-only">Toggle notifications</span>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 p-0 mr-4 sm:mr-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h4 className="font-semibold text-sm">Nouvelles notifications</h4>
          <Link href={`${basePath}/notifications`} className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen(false)}>
            Voir tout
          </Link>
        </div>
        <div className="max-h-[350px] overflow-y-auto">
          {unreadNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">À jour !</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Aucune nouvelle notification.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {displayNotifs.map((notif) => (
                <div 
                  key={notif.id} 
                  className="flex flex-col gap-1.5 p-3 sm:p-4 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer bg-primary/5"
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-sm leading-tight text-foreground/90">{notif.title}</span>
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1 shadow-sm" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{notif.message}</p>
                  
                  <div className="flex items-center justify-between mt-1">
                    {notif.context?.student_name ? (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                        {notif.context.student_name}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(notif.created_at).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
              {unreadNotifs.length > 5 && (
                <div className="p-3 text-center border-t bg-muted/10">
                  <Link href={`${basePath}/notifications`} className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen(false)}>
                    Voir les {unreadNotifs.length - 5} autres
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
