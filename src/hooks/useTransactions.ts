import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

export type Transaction = Tables<"transactions">;
export type TransactionInsert = TablesInsert<"transactions">;
export type TransactionUpdate = TablesUpdate<"transactions">;

export type TransactionType = "buy" | "sell" | "dividend" | "split" | "reverse_split";

export function useTransactions(holdingId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const transactionsQuery = useQuery({
    queryKey: ["transactions", user?.id, holdingId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("transactions")
        .select(`
          *,
          holdings (
            name,
            symbol
          )
        `)
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false });

      if (holdingId) {
        query = query.eq("holding_id", holdingId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const createTransaction = useMutation({
    mutationFn: async (transaction: Omit<TransactionInsert, "user_id">) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from("transactions")
        .insert({ ...transaction, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      // Update holding quantity and average cost based on transaction type
      if (transaction.transaction_type === "buy" || transaction.transaction_type === "sell") {
        const { data: holding } = await supabase
          .from("holdings")
          .select("*")
          .eq("id", transaction.holding_id)
          .single();

        if (holding) {
          let newQuantity = holding.quantity;
          let newAverageCost = holding.average_cost;

          if (transaction.transaction_type === "buy") {
            const totalCost = holding.quantity * holding.average_cost + transaction.total_amount;
            newQuantity = holding.quantity + transaction.quantity;
            newAverageCost = newQuantity > 0 ? totalCost / newQuantity : 0;
          } else if (transaction.transaction_type === "sell") {
            newQuantity = holding.quantity - transaction.quantity;
          }

          await supabase
            .from("holdings")
            .update({ quantity: newQuantity, average_cost: newAverageCost })
            .eq("id", transaction.holding_id);
        }
      }

      // Handle split/reverse split
      if (transaction.transaction_type === "split" || transaction.transaction_type === "reverse_split") {
        const { data: holding } = await supabase
          .from("holdings")
          .select("*")
          .eq("id", transaction.holding_id)
          .single();

        if (holding && transaction.split_ratio_from && transaction.split_ratio_to) {
          const ratio = transaction.split_ratio_to / transaction.split_ratio_from;
          const newQuantity = holding.quantity * ratio;
          const newAverageCost = holding.average_cost / ratio;

          await supabase
            .from("holdings")
            .update({ quantity: newQuantity, average_cost: newAverageCost })
            .eq("id", transaction.holding_id);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      toast({ title: "נוסף בהצלחה", description: "העסקה נרשמה" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן לרשום עסקה" });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "נמחק", description: "העסקה הוסרה" });
    },
  });

  return {
    transactions: transactionsQuery.data ?? [],
    isLoading: transactionsQuery.isLoading,
    error: transactionsQuery.error,
    createTransaction,
    deleteTransaction,
    refetch: transactionsQuery.refetch,
  };
}
