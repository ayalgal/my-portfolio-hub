import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

export type Dividend = Tables<"dividends">;
export type DividendInsert = TablesInsert<"dividends">;
export type DividendUpdate = TablesUpdate<"dividends">;

export function useDividends(holdingId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dividendsQuery = useQuery({
    queryKey: ["dividends", user?.id, holdingId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("dividends")
        .select(`
          *,
          holdings (
            name,
            symbol,
            quantity,
            average_cost
          )
        `)
        .eq("user_id", user.id)
        .order("payment_date", { ascending: false });

      if (holdingId) {
        query = query.eq("holding_id", holdingId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const createDividend = useMutation({
    mutationFn: async (dividend: Omit<DividendInsert, "user_id">) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from("dividends")
        .insert({ ...dividend, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dividends"] });
      toast({ title: "נוסף בהצלחה", description: "הדיבידנד נרשם" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן לרשום דיבידנד" });
    },
  });

  const updateDividend = useMutation({
    mutationFn: async ({ id, ...updates }: DividendUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("dividends")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dividends"] });
      toast({ title: "עודכן", description: "הדיבידנד עודכן" });
    },
  });

  const deleteDividend = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dividends").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dividends"] });
      toast({ title: "נמחק", description: "הדיבידנד הוסר" });
    },
  });

  // Calculate totals
  const totalDividends = dividendsQuery.data?.reduce((sum, d) => sum + d.amount, 0) ?? 0;
  const totalTaxWithheld = dividendsQuery.data?.reduce((sum, d) => sum + (d.tax_withheld ?? 0), 0) ?? 0;

  return {
    dividends: dividendsQuery.data ?? [],
    isLoading: dividendsQuery.isLoading,
    error: dividendsQuery.error,
    createDividend,
    updateDividend,
    deleteDividend,
    totalDividends,
    totalTaxWithheld,
    refetch: dividendsQuery.refetch,
  };
}
