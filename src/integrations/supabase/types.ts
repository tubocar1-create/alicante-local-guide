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
      bookings: {
        Row: {
          business_id: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          metadata: Json
          notes: string | null
          party_size: number
          scheduled_at: string
          service_id: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          party_size?: number
          scheduled_at: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          party_size?: number
          scheduled_at?: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_line_stops: {
        Row: {
          created_at: string
          direction: number
          id: string
          line_code: string
          seq: number
          stop_code: string | null
          stop_name: string
          transfer_lines: string[] | null
        }
        Insert: {
          created_at?: string
          direction: number
          id?: string
          line_code: string
          seq: number
          stop_code?: string | null
          stop_name: string
          transfer_lines?: string[] | null
        }
        Update: {
          created_at?: string
          direction?: number
          id?: string
          line_code?: string
          seq?: number
          stop_code?: string | null
          stop_name?: string
          transfer_lines?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_line_stops_line_code_fkey"
            columns: ["line_code"]
            isOneToOne: false
            referencedRelation: "bus_lines"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bus_line_stops_stop_code_fkey"
            columns: ["stop_code"]
            isOneToOne: false
            referencedRelation: "bus_stops"
            referencedColumns: ["code"]
          },
        ]
      }
      bus_lines: {
        Row: {
          code: string
          color: string | null
          created_at: string
          name: string
          operator: string | null
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          name: string
          operator?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          name?: string
          operator?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bus_stops: {
        Row: {
          code: string
          created_at: string
          lat: number | null
          lines: string[] | null
          lng: number | null
          name: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          lat?: number | null
          lines?: string[] | null
          lng?: number | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          lat?: number | null
          lines?: string[] | null
          lng?: number | null
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_users: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          metadata: Json
          name: string
          opening_hours: Json | null
          owner_id: string
          phone: string | null
          sector: string
          slug: string
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json
          name: string
          opening_hours?: Json | null
          owner_id: string
          phone?: string | null
          sector: string
          slug: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json
          name?: string
          opening_hours?: Json | null
          owner_id?: string
          phone?: string | null
          sector?: string
          slug?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          metadata: Json
          name: string
          starts_at: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          name: string
          starts_at?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          starts_at?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_events: {
        Row: {
          business_id: string | null
          campaign_id: string | null
          conversion_status: string | null
          id: string
          lat: number | null
          lng: number | null
          metadata: Json
          occurred_at: string
          source: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          campaign_id?: string | null
          conversion_status?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json
          occurred_at?: string
          source?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          campaign_id?: string | null
          conversion_status?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json
          occurred_at?: string
          source?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interaction_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          active: boolean
          business_id: string
          campaign_id: string | null
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          payload: Json
          purpose: Database["public"]["Enums"]["qr_purpose"]
          uses: number
        }
        Insert: {
          active?: boolean
          business_id: string
          campaign_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          payload?: Json
          purpose?: Database["public"]["Enums"]["qr_purpose"]
          uses?: number
        }
        Update: {
          active?: boolean
          business_id?: string
          campaign_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          payload?: Json
          purpose?: Database["public"]["Enums"]["qr_purpose"]
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_qrs: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          place_id: string
          place_name: string
          status: Database["public"]["Enums"]["qr_status"]
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          place_id: string
          place_name: string
          status?: Database["public"]["Enums"]["qr_status"]
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          place_id?: string
          place_name?: string
          status?: Database["public"]["Enums"]["qr_status"]
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          business_id: string
          campaign_id: string | null
          code: string
          converted_at: string | null
          created_at: string
          id: string
          metadata: Json
          referred_user_id: string | null
          referrer_user_id: string | null
          status: Database["public"]["Enums"]["referral_status"]
        }
        Insert: {
          business_id: string
          campaign_id?: string | null
          code: string
          converted_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          referred_user_id?: string | null
          referrer_user_id?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Update: {
          business_id?: string
          campaign_id?: string | null
          code?: string
          converted_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          referred_user_id?: string | null
          referrer_user_id?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referrals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          currency: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          metadata: Json
          name: string
          price_cents: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          metadata?: Json
          name: string
          price_cents?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          metadata?: Json
          name?: string
          price_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
      visits: {
        Row: {
          business_id: string
          id: string
          metadata: Json
          qr_id: string | null
          scanned_at: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          business_id: string
          id?: string
          metadata?: Json
          qr_id?: string | null
          scanned_at?: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          business_id?: string
          id?: string
          metadata?: Json
          qr_id?: string | null
          scanned_at?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
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
      is_business_member: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "public_user" | "business_user" | "admin"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      qr_purpose: "visit" | "referral" | "promo" | "booking" | "campaign"
      qr_status: "active" | "used" | "expired"
      referral_status: "pending" | "converted" | "expired"
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
      app_role: ["public_user", "business_user", "admin"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      qr_purpose: ["visit", "referral", "promo", "booking", "campaign"],
      qr_status: ["active", "used", "expired"],
      referral_status: ["pending", "converted", "expired"],
    },
  },
} as const
