import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getBillingStatus } from "@/lib/billing.functions";

/**
 * Subscribes to realtime updates on billing_entitlements + billing_subscriptions
 * for the current user, and returns the latest billing snapshot.
 */
export function useBilling() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getBillingStatus);
  const query = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => getStatus(),
    // Refetch aggressively during the checkout return window.
    refetchInterval: (q) => (q.state.data?.hasPaidAccess ? false : 5_000),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`billing:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "billing_entitlements", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["billing-status"] }),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "billing_subscriptions", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["billing-status"] }),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "billing_purchases", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["billing-status"] }),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function planLabel(tier: string | undefined) {
  if (tier === "lifetime") return "Lifetime";
  if (tier === "growth" || tier === "pro") return "Growth";
  return "No plan";
}
