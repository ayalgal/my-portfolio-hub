import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function useHoldingCategories() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const holdingCategoriesQuery = useQuery({
    queryKey: ["holding_categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("holding_categories")
        .select("*, allocation_categories(name, color)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const assignCategory = useMutation({
    mutationFn: async ({ holdingId, categoryId }: { holdingId: string; categoryId: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("holding_categories")
        .insert({ holding_id: holdingId, category_id: categoryId, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holding_categories"] });
    },
  });

  const removeCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holding_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holding_categories"] });
    },
  });

  const getCategoriesForHolding = (holdingId: string) => {
    return (holdingCategoriesQuery.data ?? []).filter(hc => hc.holding_id === holdingId);
  };

  return {
    holdingCategories: holdingCategoriesQuery.data ?? [],
    isLoading: holdingCategoriesQuery.isLoading,
    assignCategory,
    removeCategory,
    getCategoriesForHolding,
  };
}
