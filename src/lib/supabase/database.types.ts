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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      mis_academic_years: {
        Row: {
          ends_on: string
          id: string
          locked: boolean
          name: string
          school_id: string
          starts_on: string
        }
        Insert: {
          ends_on: string
          id: string
          locked?: boolean
          name: string
          school_id: string
          starts_on: string
        }
        Update: {
          ends_on?: string
          id?: string
          locked?: boolean
          name?: string
          school_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "mis_academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mis_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      mis_class_sections: {
        Row: {
          academic_year_id: string
          grade: string
          id: string
          school_id: string
          section: string
        }
        Insert: {
          academic_year_id: string
          grade: string
          id: string
          school_id: string
          section: string
        }
        Update: {
          academic_year_id?: string
          grade?: string
          id?: string
          school_id?: string
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "mis_class_sections_school_id_academic_year_id_fkey"
            columns: ["school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "mis_academic_years"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      mis_guardian_links: {
        Row: {
          academic_year_id: string
          can_receive_notices: boolean
          can_view_records: boolean
          guardian_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          academic_year_id: string
          can_receive_notices?: boolean
          can_view_records?: boolean
          guardian_id: string
          school_id: string
          student_id: string
        }
        Update: {
          academic_year_id?: string
          can_receive_notices?: boolean
          can_view_records?: boolean
          guardian_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mis_guardian_links_school_id_academic_year_id_student_id_fkey"
            columns: ["school_id", "academic_year_id", "student_id"]
            isOneToOne: false
            referencedRelation: "mis_student_enrolments"
            referencedColumns: ["school_id", "academic_year_id", "student_id"]
          },
          {
            foreignKeyName: "mis_guardian_links_school_id_guardian_id_fkey"
            columns: ["school_id", "guardian_id"]
            isOneToOne: false
            referencedRelation: "mis_people"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      mis_memberships: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          invitation_pending: boolean
          person_id: string | null
          role: string
          school_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          invitation_pending?: boolean
          person_id?: string | null
          role: string
          school_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          invitation_pending?: boolean
          person_id?: string | null
          role?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mis_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mis_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mis_memberships_school_id_person_id_fkey"
            columns: ["school_id", "person_id"]
            isOneToOne: false
            referencedRelation: "mis_people"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      mis_people: {
        Row: {
          display_name: string
          id: string
          kind: string
          school_id: string
        }
        Insert: {
          display_name: string
          id: string
          kind: string
          school_id: string
        }
        Update: {
          display_name?: string
          id?: string
          kind?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mis_people_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mis_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      mis_schools: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      mis_student_enrolments: {
        Row: {
          academic_year_id: string
          admission_number: string
          class_section_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          academic_year_id: string
          admission_number: string
          class_section_id: string
          school_id: string
          student_id: string
        }
        Update: {
          academic_year_id?: string
          admission_number?: string
          class_section_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mis_student_enrolments_school_id_academic_year_id_class_se_fkey"
            columns: ["school_id", "academic_year_id", "class_section_id"]
            isOneToOne: false
            referencedRelation: "mis_class_sections"
            referencedColumns: ["school_id", "academic_year_id", "id"]
          },
          {
            foreignKeyName: "mis_student_enrolments_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "mis_people"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      mis_teaching_assignments: {
        Row: {
          academic_year_id: string
          class_section_id: string
          id: string
          school_id: string
          staff_id: string
          subject: string
        }
        Insert: {
          academic_year_id: string
          class_section_id: string
          id: string
          school_id: string
          staff_id: string
          subject: string
        }
        Update: {
          academic_year_id?: string
          class_section_id?: string
          id?: string
          school_id?: string
          staff_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "mis_teaching_assignments_school_id_academic_year_id_class__fkey"
            columns: ["school_id", "academic_year_id", "class_section_id"]
            isOneToOne: false
            referencedRelation: "mis_class_sections"
            referencedColumns: ["school_id", "academic_year_id", "id"]
          },
          {
            foreignKeyName: "mis_teaching_assignments_school_id_staff_id_fkey"
            columns: ["school_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "mis_people"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      mis_commit_workspace: {
        Args: {
          p_action: string
          p_actor_id: string
          p_document: Json
          p_expected_revision: number
          p_school_id: string
        }
        Returns: number
      }
      mis_public_intake: {
        Args: {
          p_expected_revision: number
          p_kind: string
          p_record: Json
          p_school_id: string
          p_year_id: string
        }
        Returns: number
      }
      mis_read_workspace: { Args: { p_school_id: string }; Returns: Json }
      mis_session_active: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
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
  public: {
    Enums: {},
  },
} as const
