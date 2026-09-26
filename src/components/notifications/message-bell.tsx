"use client";

import { useEffect, useState, useRef } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function MessageBell({ role }: { role: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const getMessageRoute = () => {
    if (role === 'director') return '/school/messages';
    if (role === 'parent') return '/parent/messages';
    if (role === 'platform_admin') return '/platform/messages';
    return '#';
  };

  useEffect(() => {
    let isMounted = true;
    
    async function fetchUnreadCount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at, conversations!inner(updated_at)')
        .eq('user_id', user.id)
        .is('archived_at', null);

      if (!isMounted) return;
      
      if (data) {
        const unread = data.filter(cp => {
           if (!cp.last_read_at) return true;
           const convs = cp.conversations;
           const updatedAt = Array.isArray(convs) ? convs[0]?.updated_at : (convs as any)?.updated_at;
           if (!updatedAt) return false;
           return new Date(updatedAt) > new Date(cp.last_read_at);
        }).length;
        setUnreadCount(unread);
      }
    }

    fetchUnreadCount();

    const channel = supabase.channel('message-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        fetchUnreadCount();
        setLatestMessage(payload.new);
        setShowToast(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setShowToast(false), 5000);
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [supabase]);
  
  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative text-slate-600 hover:text-slate-900 transition-colors"
        onClick={() => router.push(getMessageRoute())}
      >
        <MessageCircle className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white animate-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {showToast && latestMessage && (
        <div className="absolute right-0 top-12 w-72 rounded-xl border border-emerald-100 bg-white p-4 shadow-xl animate-in slide-in-from-top-4 fade-in duration-300 z-50">
          <div className="flex items-start justify-between gap-2">
            <div 
              className="flex-1 cursor-pointer"
              onClick={() => {
                setShowToast(false);
                router.push(getMessageRoute());
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Nouveau Message
                </p>
              </div>
              <p className="text-sm text-slate-700 line-clamp-2 mt-1">
                {latestMessage.body}
              </p>
              <p className="text-[10px] text-slate-400 mt-2">
                Cliquez pour ouvrir la messagerie
              </p>
            </div>
            <button 
              onClick={() => setShowToast(false)}
              className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
