"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function MessageBell({ role }: { role: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

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
           return new Date(cp.conversations.updated_at) > new Date(cp.last_read_at);
        }).length;
        setUnreadCount(unread);
      }
    }

    fetchUnreadCount();

    const channel = supabase.channel('message-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);
  
  const getMessageRoute = () => {
    if (role === 'director') return '/school/messages';
    if (role === 'parent') return '/parent/messages';
    if (role === 'platform_admin') return '/platform/messages';
    return '#';
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="relative text-slate-600 hover:text-slate-900"
      onClick={() => router.push(getMessageRoute())}
    >
      <MessageCircle className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
