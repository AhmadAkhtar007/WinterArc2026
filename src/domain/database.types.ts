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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      challenge_commitments: {
        Row: {
          challenge_id: string
          committed_at: string
          custom_target: number | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          committed_at?: string
          custom_target?: number | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          committed_at?: string
          custom_target?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_commitments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_progress_entries: {
        Row: {
          amount: number
          challenge_id: string
          id: string
          period_key: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          amount: number
          challenge_id: string
          id?: string
          period_key: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          challenge_id?: string
          id?: string
          period_key?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          archived_at: string | null
          attempt_duration_minutes: number | null
          burst_limit: number
          created_at: string
          created_by: string
          description: string
          ends_on: string
          entry_options: number[]
          entry_step: number | null
          frequency: Database["public"]["Enums"]["challenge_frequency"]
          id: string
          minimum_interval_minutes: number
          points: number
          requires_approval: boolean
          reward_tiers: Json
          starts_on: string
          title: string
          tracking_mode: string
          tracking_target: number | null
          tracking_unit: string | null
        }
        Insert: {
          archived_at?: string | null
          attempt_duration_minutes?: number | null
          burst_limit?: number
          created_at?: string
          created_by: string
          description: string
          ends_on: string
          entry_options?: number[]
          entry_step?: number | null
          frequency: Database["public"]["Enums"]["challenge_frequency"]
          id?: string
          minimum_interval_minutes?: number
          points: number
          requires_approval?: boolean
          reward_tiers?: Json
          starts_on: string
          title: string
          tracking_mode?: string
          tracking_target?: number | null
          tracking_unit?: string | null
        }
        Update: {
          archived_at?: string | null
          attempt_duration_minutes?: number | null
          burst_limit?: number
          created_at?: string
          created_by?: string
          description?: string
          ends_on?: string
          entry_options?: number[]
          entry_step?: number | null
          frequency?: Database["public"]["Enums"]["challenge_frequency"]
          id?: string
          minimum_interval_minutes?: number
          points?: number
          requires_approval?: boolean
          reward_tiers?: Json
          starts_on?: string
          title?: string
          tracking_mode?: string
          tracking_target?: number | null
          tracking_unit?: string | null
        }
        Relationships: []
      }
      completions: {
        Row: {
          challenge_id: string
          completed_at: string
          id: string
          period_key: string
          points_awarded: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["completion_status"]
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          id?: string
          period_key: string
          points_awarded: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: Database["public"]["Enums"]["completion_status"]
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          id?: string
          period_key?: string
          points_awarded?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["completion_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_seed: string
          created_at: string
          display_name: string
          id: string
          player_code: string
          player_number: number
        }
        Insert: {
          avatar_seed?: string
          created_at?: string
          display_name: string
          id: string
          player_code: string
          player_number: number
        }
        Update: {
          avatar_seed?: string
          created_at?: string
          display_name?: string
          id?: string
          player_code?: string
          player_number?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_challenge: {
        Args: { target_challenge_id: string; target_period_key: string }
        Returns: {
          challenge_id: string
          completed_at: string
          id: string
          period_key: string
          points_awarded: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["completion_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "completions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enroll_challenge: {
        Args: { target_challenge_id: string; target_goal?: number }
        Returns: undefined
      }
      player_challenges: {
        Args: { target_period_key: string }
        Returns: {
          archived_at: string
          attempt_duration_minutes: number
          attempt_ends_at: string
          attempt_failed: boolean
          burst_limit: number
          completion_completed_at: string
          completion_id: string
          completion_period_key: string
          completion_points_awarded: number
          completion_status: Database["public"]["Enums"]["completion_status"]
          cooldown_ends_at: string
          description: string
          ends_on: string
          entry_options: number[]
          entry_step: number
          frequency: Database["public"]["Enums"]["challenge_frequency"]
          id: string
          minimum_interval_minutes: number
          points: number
          progress: number
          progress_entries: Json
          requires_approval: boolean
          reward_tiers: Json
          secured_points: number
          starts_on: string
          title: string
          tracking_mode: string
          tracking_target: number
          tracking_unit: string
        }[]
      }
      player_leaderboard: {
        Args: never
        Returns: {
          completed_count: number
          display_name: string
          id: string
          points: number
        }[]
      }
      record_challenge_progress: {
        Args: {
          entry_amount: number
          target_challenge_id: string
          target_period_key: string
        }
        Returns: {
          amount: number
          challenge_id: string
          id: string
          period_key: string
          recorded_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "challenge_progress_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_challenge_progress_entry: {
        Args: {
          target_challenge_id: string
          target_entry_id: string
          target_period_key: string
        }
        Returns: undefined
      }
      resolve_player_login: {
        Args: { target_player_code: string }
        Returns: string
      }
      review_completion: {
        Args: {
          decision: Database["public"]["Enums"]["completion_status"]
          target_completion_id: string
        }
        Returns: undefined
      }
      uncomplete_challenge: {
        Args: { target_challenge_id: string; target_period_key: string }
        Returns: undefined
      }
      upgrade_challenge_target: {
        Args: { new_target: number; target_challenge_id: string }
        Returns: undefined
      }
    }
    Enums: {
      challenge_frequency: "daily" | "weekly" | "once"
      completion_status: "pending" | "confirmed" | "reversed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      challenge_frequency: ["daily", "weekly", "once"],
      completion_status: ["pending", "confirmed", "reversed"],
    },
  },
} as const
