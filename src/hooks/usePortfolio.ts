import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

export type Portfolio = Tables<"portfolios">;
export type PortfolioInsert = TablesInsert<"portfolios">;
export type PortfolioUpdate = TablesUpdate<"portfolios">;

export function usePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const portfoliosQuery = useQuery({
    queryKey: ["portfolios", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Portfolio[];
    },
    enabled: !!user?.id,
  });

  const createPortfolio = useMutation({
    mutationFn: async (portfolio: Omit<PortfolioInsert, "user_id">) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from("portfolios")
        .insert({ ...portfolio, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast({ title: "נוצר בהצלחה", description: "הפורטפוליו נוצר" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן ליצור פורטפוליו" });
    },
  });

  const updatePortfolio = useMutation({
    mutationFn: async ({ id, ...updates }: PortfolioUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("portfolios")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast({ title: "עודכן", description: "הפורטפוליו עודכן" });
    },
  });

  const deletePortfolio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast({ title: "נמחק", description: "הפורטפוליו הוסר" });
    },
  });

  // Get or create default portfolio
  const getDefaultPortfolio = async (): Promise<Portfolio | null> => {
    if (!user?.id) return null;
    
    const portfolios = portfoliosQuery.data;
    if (portfolios && portfolios.length > 0) {
      return portfolios[0];
    }

    // Create default portfolio
    const { data, error } = await supabase
      .from("portfolios")
      .insert({ name: "פורטפוליו ראשי", user_id: user.id })
      .select()
      .single();

    if (error) return null;
    queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    return data;
  };

  return {
    portfolios: portfoliosQuery.data ?? [],
    isLoading: portfoliosQuery.isLoading,
    error: portfoliosQuery.error,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    getDefaultPortfolio,
  };
}
