import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

export type AllocationCategory = Tables<"allocation_categories">;
export type AllocationCategoryInsert = TablesInsert<"allocation_categories">;
export type AllocationCategoryUpdate = TablesUpdate<"allocation_categories">;

export function useAllocations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ["allocation_categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("allocation_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AllocationCategory[];
    },
    enabled: !!user?.id,
  });

  const createCategory = useMutation({
    mutationFn: async (category: Omit<AllocationCategoryInsert, "user_id">) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from("allocation_categories")
        .insert({ ...category, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation_categories"] });
      toast({ title: "נוסף בהצלחה", description: "הקטגוריה נוספה" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן להוסיף קטגוריה" });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...updates }: AllocationCategoryUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("allocation_categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation_categories"] });
      toast({ title: "עודכן", description: "הקטגוריה עודכנה" });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("allocation_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation_categories"] });
      toast({ title: "נמחק", description: "הקטגוריה הוסרה" });
    },
  });

  // Calculate totals
  const totalTarget = categoriesQuery.data?.reduce((sum, c) => sum + (c.target_percentage ?? 0), 0) ?? 0;

  return {
    categories: categoriesQuery.data ?? [],
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
    createCategory,
    updateCategory,
    deleteCategory,
    totalTarget,
    refetch: categoriesQuery.refetch,
  };
}
