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
      admin_notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string
          error: string | null
          failure_count: number
          id: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          success_count: number
          target: string
          target_user_ids: string[]
          title: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          error?: string | null
          failure_count?: number
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          success_count?: number
          target?: string
          target_user_ids?: string[]
          title: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          error?: string | null
          failure_count?: number
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          success_count?: number
          target?: string
          target_user_ids?: string[]
          title?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          academic_year: string | null
          created_at: string
          id: string
          name: string
          section: string | null
          semester: string | null
          students_count: number | null
          subject: string | null
          user_id: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          id?: string
          name: string
          section?: string | null
          semester?: string | null
          students_count?: number | null
          subject?: string | null
          user_id: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          id?: string
          name?: string
          section?: string | null
          semester?: string | null
          students_count?: number | null
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          browser: string | null
          created_at: string
          device_id: string
          email: string | null
          id: string
          last_active_at: string
          platform: string | null
          staff_name: string | null
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_id: string
          email?: string | null
          id?: string
          last_active_at?: string
          platform?: string | null
          staff_name?: string | null
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_id?: string
          email?: string | null
          id?: string
          last_active_at?: string
          platform?: string | null
          staff_name?: string | null
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          body_html: string | null
          content: Json
          created_at: string
          department: string | null
          id: string
          is_favorite: boolean
          language: string
          sources: Json
          style: string
          subject: string
          title: string | null
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html?: string | null
          content?: Json
          created_at?: string
          department?: string | null
          id?: string
          is_favorite?: boolean
          language?: string
          sources?: Json
          style?: string
          subject: string
          title?: string | null
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string | null
          content?: Json
          created_at?: string
          department?: string | null
          id?: string
          is_favorite?: boolean
          language?: string
          sources?: Json
          style?: string
          subject?: string
          title?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          admin_notification_id: string | null
          body: string | null
          channel: string
          clicked_at: string | null
          created_at: string
          error: string | null
          id: string
          opened_at: string | null
          reminder_id: string | null
          retries: number
          status: string
          target: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          admin_notification_id?: string | null
          body?: string | null
          channel: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          opened_at?: string | null
          reminder_id?: string | null
          retries?: number
          status: string
          target?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          admin_notification_id?: string | null
          body?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          opened_at?: string | null
          reminder_id?: string | null
          retries?: number
          status?: string
          target?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_admin_notification_id_fkey"
            columns: ["admin_notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          email_enabled: boolean
          enabled: boolean
          last_sent_date: string | null
          notify_time: string
          push_enabled: boolean
          sms_enabled: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          enabled?: boolean
          last_sent_date?: string | null
          notify_time?: string
          push_enabled?: boolean
          sms_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          enabled?: boolean
          last_sent_date?: string | null
          notify_time?: string
          push_enabled?: boolean
          sms_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ppts: {
        Row: {
          created_at: string
          id: string
          settings: Json
          slides: Json
          sources: Json
          subject: string
          template: string
          theme: string | null
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          settings?: Json
          slides?: Json
          sources?: Json
          subject: string
          template?: string
          theme?: string | null
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json
          slides?: Json
          sources?: Json
          subject?: string
          template?: string
          theme?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          college_name: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          mobile: string | null
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          college_name?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          mobile?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          college_name?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          mobile?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          content: Json
          created_at: string
          id: string
          subject: string
          topic: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          subject: string
          topic: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          subject?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      question_papers: {
        Row: {
          content: Json
          created_at: string
          department: string | null
          difficulty: string | null
          id: string
          pattern: string | null
          subject: string
          title: string
          total_marks: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          department?: string | null
          difficulty?: string | null
          id?: string
          pattern?: string | null
          subject: string
          title: string
          total_marks?: number | null
          unit?: string | null
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          department?: string | null
          difficulty?: string | null
          id?: string
          pattern?: string | null
          subject?: string
          title?: string
          total_marks?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_archived: boolean
          is_completed: boolean
          is_paused: boolean
          last_sent_at: string | null
          last_sent_date: string | null
          methods: string[]
          priority: string | null
          reminder_type: string
          repeat_days: number[]
          repeat_rule: string
          sent_count: number
          subject: string | null
          timezone: string
          title: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          is_completed?: boolean
          is_paused?: boolean
          last_sent_at?: string | null
          last_sent_date?: string | null
          methods?: string[]
          priority?: string | null
          reminder_type?: string
          repeat_days?: number[]
          repeat_rule?: string
          sent_count?: number
          subject?: string | null
          timezone?: string
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          is_completed?: boolean
          is_paused?: boolean
          last_sent_at?: string | null
          last_sent_date?: string | null
          methods?: string[]
          priority?: string | null
          reminder_type?: string
          repeat_days?: number[]
          repeat_rule?: string
          sent_count?: number
          subject?: string | null
          timezone?: string
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      timetable_entries: {
        Row: {
          class_name: string | null
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          notes: string | null
          period: number
          room: string | null
          start_time: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          class_name?: string | null
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          notes?: string | null
          period: number
          room?: string | null
          start_time?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          class_name?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          notes?: string | null
          period?: number
          room?: string | null
          start_time?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      uploaded_notes: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          subject: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          subject?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          subject?: string | null
          title?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
