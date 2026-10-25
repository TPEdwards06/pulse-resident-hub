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
      charges: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string
          id: string
          paid_at: string | null
          resident_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          due_date: string
          id?: string
          paid_at?: string | null
          resident_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          resident_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          acked_at: string | null
          delivered_at: string
          id: string
          message_id: string
          resident_id: string
          seen_at: string | null
        }
        Insert: {
          acked_at?: string | null
          delivered_at?: string
          id?: string
          message_id: string
          resident_id: string
          seen_at?: string | null
        }
        Update: {
          acked_at?: string | null
          delivered_at?: string
          id?: string
          message_id?: string
          resident_id?: string
          seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          question: string
          view_count: number
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          question: string
          view_count?: number
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          question?: string
          view_count?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          audience_label: string | null
          audience_rule: Json
          body: string
          category: Database["public"]["Enums"]["msg_category"]
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          id: string
          is_personal: boolean
          parent_message_id: string | null
          priority: Database["public"]["Enums"]["msg_priority"]
          requires_ack: boolean
          scheduled_at: string
          title: string
        }
        Insert: {
          audience_label?: string | null
          audience_rule?: Json
          body?: string
          category?: Database["public"]["Enums"]["msg_category"]
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          id?: string
          is_personal?: boolean
          parent_message_id?: string | null
          priority?: Database["public"]["Enums"]["msg_priority"]
          requires_ack?: boolean
          scheduled_at?: string
          title: string
        }
        Update: {
          audience_label?: string | null
          audience_rule?: Json
          body?: string
          category?: Database["public"]["Enums"]["msg_category"]
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          id?: string
          is_personal?: boolean
          parent_message_id?: string | null
          priority?: Database["public"]["Enums"]["msg_priority"]
          requires_ack?: boolean
          scheduled_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          arrived_at: string
          carrier: string
          id: string
          note: string | null
          picked_up_at: string | null
          resident_id: string
        }
        Insert: {
          arrived_at?: string
          carrier: string
          id?: string
          note?: string | null
          picked_up_at?: string | null
          resident_id: string
        }
        Update: {
          arrived_at?: string
          carrier?: string
          id?: string
          note?: string | null
          picked_up_at?: string | null
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          current_rent: number | null
          email: string | null
          full_name: string
          id: string
          lease_end: string | null
          phone: string | null
          renewal_status: Database["public"]["Enums"]["renewal_status"]
          unit_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_rent?: number | null
          email?: string | null
          full_name: string
          id?: string
          lease_end?: string | null
          phone?: string | null
          renewal_status?: Database["public"]["Enums"]["renewal_status"]
          unit_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_rent?: number | null
          email?: string | null
          full_name?: string
          id?: string
          lease_end?: string | null
          phone?: string | null
          renewal_status?: Database["public"]["Enums"]["renewal_status"]
          unit_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_offers: {
        Row: {
          current_rent: number
          id: string
          offer_expires: string
          offer_rent: number
          previous_offer_rent: number | null
          resident_id: string
          updated_at: string
        }
        Insert: {
          current_rent: number
          id?: string
          offer_expires: string
          offer_rent: number
          previous_offer_rent?: number | null
          resident_id: string
          updated_at?: string
        }
        Update: {
          current_rent?: number
          id?: string
          offer_expires?: string
          offer_rent?: number
          previous_offer_rent?: number | null
          resident_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_offers_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          resident_id: string
          room_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          resident_id: string
          room_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          resident_id?: string
          room_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          id: string
          location: string | null
          name: string
        }
        Insert: {
          capacity?: number
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          capacity?: number
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      staff_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          building: string
          floor: number
          id: string
          unit_number: string
        }
        Insert: {
          building: string
          floor: number
          id?: string
          unit_number: string
        }
        Update: {
          building?: string
          floor?: number
          id?: string
          unit_number?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      ack_message: { Args: { _delivery_id: string }; Returns: undefined }
      audience_count: { Args: { rule: Json }; Returns: number }
      audience_residents: { Args: { rule: Json }; Returns: string[] }
      create_notification: {
        Args: {
          _ack?: boolean
          _body: string
          _category: Database["public"]["Enums"]["msg_category"]
          _dedupe?: string
          _priority?: Database["public"]["Enums"]["msg_priority"]
          _resident: string
          _title: string
        }
        Returns: string
      }
      current_profile_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      mark_seen: { Args: { _delivery_id: string }; Returns: undefined }
      pay_charge: { Args: { _charge_id: string }; Returns: undefined }
      resend_reminder: { Args: { _message_id: string }; Returns: number }
      run_daily_reminders: { Args: never; Returns: number }
      seeding: { Args: never; Returns: boolean }
      send_message: {
        Args: {
          _body: string
          _category: Database["public"]["Enums"]["msg_category"]
          _label: string
          _parent?: string
          _priority: Database["public"]["Enums"]["msg_priority"]
          _requires_ack: boolean
          _rule: Json
          _scheduled_at?: string
          _title: string
        }
        Returns: string
      }
      set_renewal_status: {
        Args: { _status: Database["public"]["Enums"]["renewal_status"] }
        Returns: undefined
      }
      view_faq: { Args: { _id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "resident" | "staff"
      msg_category:
        | "announcement"
        | "event"
        | "safety"
        | "package"
        | "payment"
        | "renewal"
        | "maintenance"
      msg_priority: "normal" | "urgent"
      renewal_status: "undecided" | "renewing" | "not_renewing"
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
    Enums: {
      app_role: ["resident", "staff"],
      msg_category: [
        "announcement",
        "event",
        "safety",
        "package",
        "payment",
        "renewal",
        "maintenance",
      ],
      msg_priority: ["normal", "urgent"],
      renewal_status: ["undecided", "renewing", "not_renewing"],
    },
  },
} as const
