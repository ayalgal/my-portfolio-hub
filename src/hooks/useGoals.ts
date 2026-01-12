import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

export type Goal = Tables<"investment_goals">;
export type GoalInsert = TablesInsert<"investment_goals">;
export type GoalUpdate = TablesUpdate<"investment_goals">;

export function useGoals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("investment_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!user?.id,
  });

  const createGoal = useMutation({
    mutationFn: async (goal: Omit<GoalInsert, "user_id">) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from("investment_goals")
        .insert({ ...goal, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast({ title: "נוסף בהצלחה", description: "היעד נוסף" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן להוסיף יעד" });
    },
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...updates }: GoalUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("investment_goals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast({ title: "עודכן", description: "היעד עודכן" });
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investment_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast({ title: "נמחק", description: "היעד הוסר" });
    },
  });

  // Calculate totals
  const totalTarget = goalsQuery.data?.reduce((sum, g) => sum + g.target_amount, 0) ?? 0;
  const totalCurrent = goalsQuery.data?.reduce((sum, g) => sum + (g.current_amount ?? 0), 0) ?? 0;

  return {
    goals: goalsQuery.data ?? [],
    isLoading: goalsQuery.isLoading,
    error: goalsQuery.error,
    createGoal,
    updateGoal,
    deleteGoal,
    totalTarget,
    totalCurrent,
    refetch: goalsQuery.refetch,
  };
}
