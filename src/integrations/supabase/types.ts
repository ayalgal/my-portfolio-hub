export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      allocation_categories: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          target_percentage: number | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          target_percentage?: number | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          target_percentage?: number | null
          user_id?: string
        }
        Relationships: []
      }
      dividends: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          ex_date: string | null
          holding_id: string
          id: string
          is_israeli: boolean | null
          notes: string | null
          payment_date: string | null
          shares_at_payment: number | null
          tax_withheld: number | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          ex_date?: string | null
          holding_id: string
          id?: string
          is_israeli?: boolean | null
          notes?: string | null
          payment_date?: string | null
          shares_at_payment?: number | null
          tax_withheld?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          ex_date?: string | null
          holding_id?: string
          id?: string
          is_israeli?: boolean | null
          notes?: string | null
          payment_date?: string | null
          shares_at_payment?: number | null
          tax_withheld?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dividends_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          from_currency: string
          id: string
          rate: number
          to_currency: string
          updated_at: string
        }
        Insert: {
          from_currency: string
          id?: string
          rate: number
          to_currency?: string
          updated_at?: string
        }
        Update: {
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      holding_categories: {
        Row: {
          category_id: string
          holding_id: string
          id: string
          user_id: string
        }
        Insert: {
          category_id: string
          holding_id: string
          id?: string
          user_id: string
        }
        Update: {
          category_id?: string
          holding_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holding_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "allocation_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holding_categories_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings: {
        Row: {
          asset_type: string
          average_cost: number
          broker: string | null
          created_at: string | null
          currency: string | null
          current_price: number | null
          fund_number: string | null
          id: string
          last_price_update: string | null
          name: string
          notes: string | null
          portfolio_id: string
          quantity: number
          symbol: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset_type?: string
          average_cost?: number
          broker?: string | null
          created_at?: string | null
          currency?: string | null
          current_price?: number | null
          fund_number?: string | null
          id?: string
          last_price_update?: string | null
          name: string
          notes?: string | null
          portfolio_id: string
          quantity?: number
          symbol: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset_type?: string
          average_cost?: number
          broker?: string | null
          created_at?: string | null
          currency?: string | null
          current_price?: number | null
          fund_number?: string | null
          id?: string
          last_price_update?: string | null
          name?: string
          notes?: string | null
          portfolio_id?: string
          quantity?: number
          symbol?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_goals: {
        Row: {
          category: string | null
          created_at: string | null
          current_amount: number | null
          id: string
          name: string
          notes: string | null
          target_amount: number
          target_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          current_amount?: number | null
          id?: string
          name: string
          notes?: string | null
          target_amount: number
          target_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          current_amount?: number | null
          id?: string
          name?: string
          notes?: string | null
          target_amount?: number
          target_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          created_at: string | null
          id: string
          snapshot_date: string
          total_cost_ils: number
          total_value_ils: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          snapshot_date?: string
          total_cost_ils?: number
          total_value_ils?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          snapshot_date?: string
          total_cost_ils?: number
          total_value_ils?: number
          user_id?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          preferred_currency: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          preferred_currency?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          preferred_currency?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string | null
          event_type: string
          holding_id: string | null
          id: string
          is_read: boolean
          symbol: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_type: string
          holding_id?: string | null
          id?: string
          is_read?: boolean
          symbol: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_type?: string
          holding_id?: string | null
          id?: string
          is_read?: boolean
          symbol?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_events_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_splits: {
        Row: {
          applied_at: string | null
          created_at: string | null
          detected_at: string | null
          holding_id: string
          id: string
          ratio_from: number
          ratio_to: number
          split_date: string
          status: string
          symbol: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string | null
          detected_at?: string | null
          holding_id: string
          id?: string
          ratio_from: number
          ratio_to: number
          split_date: string
          status?: string
          symbol: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string | null
          detected_at?: string | null
          holding_id?: string
          id?: string
          ratio_from?: number
          ratio_to?: number
          split_date?: string
          status?: string
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_splits_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string | null
          currency: string | null
          holding_id: string
          id: string
          notes: string | null
          price: number
          quantity: number
          split_ratio_from: number | null
          split_ratio_to: number | null
          total_amount: number
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          holding_id: string
          id?: string
          notes?: string | null
          price?: number
          quantity?: number
          split_ratio_from?: number | null
          split_ratio_to?: number | null
          total_amount?: number
          transaction_date?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          holding_id?: string
          id?: string
          notes?: string | null
          price?: number
          quantity?: number
          split_ratio_from?: number | null
          split_ratio_to?: number | null
          total_amount?: number
          transaction_date?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
