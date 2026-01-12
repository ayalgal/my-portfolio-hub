import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

export type Holding = Tables<"holdings">;
export type HoldingInsert = TablesInsert<"holdings">;
export type HoldingUpdate = TablesUpdate<"holdings">;

export function useHoldings(portfolioId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const holdingsQuery = useQuery({
    queryKey: ["holdings", user?.id, portfolioId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("holdings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (portfolioId) {
        query = query.eq("portfolio_id", portfolioId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Holding[];
    },
    enabled: !!user?.id,
  });

  const createHolding = useMutation({
    mutationFn: async (holding: Omit<HoldingInsert, "user_id">) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from("holdings")
        .insert({ ...holding, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      toast({ title: "נוסף בהצלחה", description: "נייר הערך נוסף לפורטפוליו" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן להוסיף נייר ערך" });
    },
  });

  const updateHolding = useMutation({
    mutationFn: async ({ id, ...updates }: HoldingUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("holdings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      toast({ title: "עודכן", description: "נייר הערך עודכן" });
    },
  });

  const deleteHolding = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holdings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      toast({ title: "נמחק", description: "נייר הערך הוסר" });
    },
  });

  // Calculate portfolio stats
  const portfolioStats = {
    totalValue: holdingsQuery.data?.reduce((sum, h) => sum + (h.quantity * h.average_cost), 0) ?? 0,
    totalCost: holdingsQuery.data?.reduce((sum, h) => sum + (h.quantity * h.average_cost), 0) ?? 0,
    holdingsCount: holdingsQuery.data?.length ?? 0,
  };

  return {
    holdings: holdingsQuery.data ?? [],
    isLoading: holdingsQuery.isLoading,
    error: holdingsQuery.error,
    createHolding,
    updateHolding,
    deleteHolding,
    portfolioStats,
    refetch: holdingsQuery.refetch,
  };
}
