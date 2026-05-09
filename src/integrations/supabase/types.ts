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
  public: {
    Tables: {
      community_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          content: string
          created_at: string
          file_name: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          file_name?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      duel_answers: {
        Row: {
          answer: string
          created_at: string
          duel_id: string
          id: string
          is_correct: boolean
          question_index: number
          time_taken_ms: number
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          duel_id: string
          id?: string
          is_correct?: boolean
          question_index: number
          time_taken_ms?: number
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          duel_id?: string
          id?: string
          is_correct?: boolean
          question_index?: number
          time_taken_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_answers_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          completed_at: string | null
          created_at: string
          creator_id: string
          creator_score: number | null
          current_question_index: number | null
          id: string
          invite_code: string
          opponent_id: string | null
          opponent_score: number | null
          qcm_session_id: string | null
          question_count: number
          questions: Json
          source_type: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          creator_id: string
          creator_score?: number | null
          current_question_index?: number | null
          id?: string
          invite_code: string
          opponent_id?: string | null
          opponent_score?: number | null
          qcm_session_id?: string | null
          question_count?: number
          questions?: Json
          source_type?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          creator_score?: number | null
          current_question_index?: number | null
          id?: string
          invite_code?: string
          opponent_id?: string | null
          opponent_score?: number | null
          qcm_session_id?: string | null
          question_count?: number
          questions?: Json
          source_type?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      edge_diagnostics: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          function_name: string
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          function_name: string
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          function_name?: string
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          answer: string
          course_id: string
          created_at: string
          ease_factor: number
          id: string
          interval: number
          next_review: string
          question: string
          repetitions: number
          user_id: string
        }
        Insert: {
          answer: string
          course_id: string
          created_at?: string
          ease_factor?: number
          id?: string
          interval?: number
          next_review?: string
          question: string
          repetitions?: number
          user_id: string
        }
        Update: {
          answer?: string
          course_id?: string
          created_at?: string
          ease_factor?: number
          id?: string
          interval?: number
          next_review?: string
          question?: string
          repetitions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          credits: number | null
          first_name: string | null
          id: string
          name: string | null
          plan: string | null
          student_number: string | null
          university: string | null
          year_of_study: string | null
        }
        Insert: {
          avatar_url?: string | null
          credits?: number | null
          first_name?: string | null
          id: string
          name?: string | null
          plan?: string | null
          student_number?: string | null
          university?: string | null
          year_of_study?: string | null
        }
        Update: {
          avatar_url?: string | null
          credits?: number | null
          first_name?: string | null
          id?: string
          name?: string | null
          plan?: string | null
          student_number?: string | null
          university?: string | null
          year_of_study?: string | null
        }
        Relationships: []
      }
      qcm_sessions: {
        Row: {
          ai_model: string | null
          answers: Json | null
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          metadata: Json | null
          question_count: number
          question_type: string | null
          questions: Json
          score: number | null
          status: string
          time_elapsed: number | null
          title: string
          total_questions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          answers?: Json | null
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          question_count?: number
          question_type?: string | null
          questions?: Json
          score?: number | null
          status?: string
          time_elapsed?: number | null
          title: string
          total_questions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          answers?: Json | null
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          question_count?: number
          question_type?: string | null
          questions?: Json
          score?: number | null
          status?: string
          time_elapsed?: number | null
          title?: string
          total_questions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qcm_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_likes: {
        Row: {
          created_at: string
          id: string
          shared_quiz_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shared_quiz_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shared_quiz_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_likes_shared_quiz_id_fkey"
            columns: ["shared_quiz_id"]
            isOneToOne: false
            referencedRelation: "shared_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          answers: Json
          course_id: string
          created_at: string
          id: string
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          answers: Json
          course_id: string
          created_at?: string
          id?: string
          score: number
          total_questions: number
          user_id: string
        }
        Update: {
          answers?: Json
          course_id?: string
          created_at?: string
          id?: string
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_quizzes: {
        Row: {
          category: string | null
          created_at: string
          id: string
          likes_count: number
          qcm_session_id: string
          question_count: number
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          likes_count?: number
          qcm_session_id: string
          question_count?: number
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          likes_count?: number
          qcm_session_id?: string
          question_count?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_quizzes_qcm_session_id_fkey"
            columns: ["qcm_session_id"]
            isOneToOne: false
            referencedRelation: "qcm_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          content: string
          course_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          summary_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          course_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          summary_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          course_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          summary_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "summaries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_gamification: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          level: number
          longest_streak: number
          total_flashcards_reviewed: number
          total_quizzes_completed: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          total_flashcards_reviewed?: number
          total_quizzes_completed?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          total_flashcards_reviewed?: number
          total_quizzes_completed?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          font_family: string | null
          id: string
          language: string | null
          notify_flashcard_alerts: boolean | null
          notify_new_qcm: boolean | null
          notify_revision_reminders: boolean | null
          notify_subscription_alerts: boolean | null
          notify_weekly_results: boolean | null
          summary_display: string | null
          text_size: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          font_family?: string | null
          id?: string
          language?: string | null
          notify_flashcard_alerts?: boolean | null
          notify_new_qcm?: boolean | null
          notify_revision_reminders?: boolean | null
          notify_subscription_alerts?: boolean | null
          notify_weekly_results?: boolean | null
          summary_display?: string | null
          text_size?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          font_family?: string | null
          id?: string
          language?: string | null
          notify_flashcard_alerts?: boolean | null
          notify_new_qcm?: boolean | null
          notify_revision_reminders?: boolean | null
          notify_subscription_alerts?: boolean | null
          notify_weekly_results?: boolean | null
          summary_display?: string | null
          text_size?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_profile: {
        Args: {
          p_credits?: number
          p_first_name?: string
          p_name?: string
          p_plan?: string
          p_student_number?: string
          p_university?: string
          p_user_id: string
          p_year_of_study?: string
        }
        Returns: {
          avatar_url: string | null
          credits: number | null
          first_name: string | null
          id: string
          name: string | null
          plan: string | null
          student_number: string | null
          university: string | null
          year_of_study: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_duel_question: { Args: { p_duel_id: string }; Returns: undefined }
      award_badge: { Args: { p_badge_id: string }; Returns: boolean }
      get_duel_by_invite_code: {
        Args: { p_code: string }
        Returns: {
          completed_at: string | null
          created_at: string
          creator_id: string
          creator_score: number | null
          current_question_index: number | null
          id: string
          invite_code: string
          opponent_id: string | null
          opponent_score: number | null
          qcm_session_id: string | null
          question_count: number
          questions: Json
          source_type: string
          started_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "duels"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          current_streak: number
          display_name: string
          level: number
          total_quizzes_completed: number
          user_id: string
          xp: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_user_xp: {
        Args: { p_action_type: string; p_xp_amount: number }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      join_duel_by_invite_code: {
        Args: { p_code: string }
        Returns: {
          completed_at: string | null
          created_at: string
          creator_id: string
          creator_score: number | null
          current_question_index: number | null
          id: string
          invite_code: string
          opponent_id: string | null
          opponent_score: number | null
          qcm_session_id: string | null
          question_count: number
          questions: Json
          source_type: string
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "duels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_duel_question_integrity_error: {
        Args: { p_duel_id: string; p_error: string; p_payload?: Json }
        Returns: undefined
      }
      record_gamification_activity: {
        Args: { p_action_type: string }
        Returns: undefined
      }
      submit_duel_answer: {
        Args: {
          p_answer: string
          p_duel_id: string
          p_question_index: number
          p_time_taken_ms: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
