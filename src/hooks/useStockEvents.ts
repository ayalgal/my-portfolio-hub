import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface StockEvent {
  id: string;
  user_id: string;
  holding_id: string | null;
  symbol: string;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string | null;
  is_read: boolean;
  created_at: string;
}

export function useStockEvents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ["stock_events", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("stock_events")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as StockEvent[];
    },
    enabled: !!user?.id,
  });

  const unreadCount = eventsQuery.data?.filter(e => !e.is_read).length ?? 0;

  const markAsRead = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("stock_events")
        .update({ is_read: true })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_events"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("stock_events")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_events"] });
    },
  });

  const dismissEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("stock_events")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_events"] });
    },
  });

  return {
    events: eventsQuery.data ?? [],
    unreadCount,
    isLoading: eventsQuery.isLoading,
    markAsRead,
    markAllAsRead,
    dismissEvent,
    refetch: eventsQuery.refetch,
  };
}
