import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface StockSplit {
  id: string;
  holding_id: string;
  user_id: string;
  symbol: string;
  split_date: string;
  ratio_from: number;
  ratio_to: number;
  status: string;
  detected_at: string;
  applied_at: string | null;
}

export function useSplits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const pendingSplitsQuery = useQuery({
    queryKey: ["stock_splits", "pending", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("stock_splits")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("split_date", { ascending: false });
      if (error) throw error;
      return data as StockSplit[];
    },
    enabled: !!user?.id,
  });

  const applySplit = useMutation({
    mutationFn: async (splitId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Get the split details
      const { data: split, error: splitError } = await supabase
        .from("stock_splits")
        .select("*")
        .eq("id", splitId)
        .single();
      if (splitError || !split) throw new Error("Split not found");

      // Get the holding
      const { data: holding, error: holdingError } = await supabase
        .from("holdings")
        .select("*")
        .eq("id", split.holding_id)
        .single();
      if (holdingError || !holding) throw new Error("Holding not found");

      const ratio = split.ratio_to / split.ratio_from;
      const newQuantity = holding.quantity * ratio;
      const newAverageCost = holding.average_cost / ratio;

      // Update holding
      const { error: updateError } = await supabase
        .from("holdings")
        .update({ quantity: newQuantity, average_cost: newAverageCost })
        .eq("id", holding.id);
      if (updateError) throw updateError;

      // Record the split transaction
      await supabase.from("transactions").insert({
        holding_id: holding.id,
        user_id: user.id,
        transaction_type: ratio > 1 ? "split" : "reverse_split",
        quantity: newQuantity - holding.quantity,
        price: 0,
        total_amount: 0,
        transaction_date: split.split_date,
        split_ratio_from: split.ratio_from,
        split_ratio_to: split.ratio_to,
        notes: `ספליט ${split.ratio_from}:${split.ratio_to} - ${split.symbol}`,
      });

      // Mark split as applied
      const { error: markError } = await supabase
        .from("stock_splits")
        .update({ status: "applied", applied_at: new Date().toISOString() })
        .eq("id", splitId);
      if (markError) throw markError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_splits"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "ספליט הוחל", description: "הכמות והעלות עודכנו בהצלחה" });
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן להחיל את הספליט" });
    },
  });

  const dismissSplit = useMutation({
    mutationFn: async (splitId: string) => {
      const { error } = await supabase
        .from("stock_splits")
        .update({ status: "dismissed" })
        .eq("id", splitId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_splits"] });
      toast({ title: "ספליט נדחה", description: "הספליט סומן כנדחה" });
    },
  });

  return {
    pendingSplits: pendingSplitsQuery.data ?? [],
    isLoading: pendingSplitsQuery.isLoading,
    applySplit,
    dismissSplit,
    refetch: pendingSplitsQuery.refetch,
  };
}
