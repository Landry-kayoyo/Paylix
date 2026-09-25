"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Invisible component that subscribes to Supabase realtime changes
 * and calls router.refresh() to re-fetch server data (payments, obligations)
 * without requiring the user to manually refresh the page.
 */
export function ParentRealtimeRefresher({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      const channel = supabase
        .channel(`parent-realtime-${tenantId}-${user.id}-${Date.now()}`)
        // New payment → update obligations & payment history
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "payments",
            filter: `tenant_id=eq.${tenantId}`,
          },
          () => {
            if (isMounted) router.refresh();
          }
        )
        // Obligation updated (e.g. paid_amount changed)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "financial_obligations",
            filter: `tenant_id=eq.${tenantId}`,
          },
          () => {
            if (isMounted) router.refresh();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => {
      cleanup = fn;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [tenantId, router, supabase]);

  // Renders nothing — purely reactive
  return null;
}
