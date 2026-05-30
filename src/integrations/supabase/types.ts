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
      ad_variants_cache: {
        Row: {
          advertiser_id: string
          created_at: string
          day_madrid: string
          payload: Json
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          day_madrid: string
          payload: Json
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          day_madrid?: string
          payload?: Json
        }
        Relationships: []
      }
      admin_allowed_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      aena_flights: {
        Row: {
          aeronave: string | null
          airport: string
          ciudad: string | null
          compania: string | null
          estado: string | null
          fecha: string
          flight_type: string
          hora_estimada: string | null
          hora_programada: string
          iata_compania: string | null
          iata_otro: string | null
          id: string
          mostrador: string | null
          num_vuelo: string
          puerta: string | null
          scheduled_at: string
          terminal: string | null
          updated_at: string
        }
        Insert: {
          aeronave?: string | null
          airport: string
          ciudad?: string | null
          compania?: string | null
          estado?: string | null
          fecha: string
          flight_type: string
          hora_estimada?: string | null
          hora_programada: string
          iata_compania?: string | null
          iata_otro?: string | null
          id?: string
          mostrador?: string | null
          num_vuelo: string
          puerta?: string | null
          scheduled_at: string
          terminal?: string | null
          updated_at?: string
        }
        Update: {
          aeronave?: string | null
          airport?: string
          ciudad?: string | null
          compania?: string | null
          estado?: string | null
          fecha?: string
          flight_type?: string
          hora_estimada?: string | null
          hora_programada?: string
          iata_compania?: string | null
          iata_otro?: string | null
          id?: string
          mostrador?: string | null
          num_vuelo?: string
          puerta?: string | null
          scheduled_at?: string
          terminal?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agente_admin_supervisions: {
        Row: {
          admin_notes: string | null
          confidence: number | null
          created_at: string
          final_intent: string | null
          final_keywords: string[]
          id: string
          learning_log_id: string | null
          model: string | null
          normalized: string
          priority: number
          raw_query: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          suggested_intent: string | null
          suggested_keywords: string[]
          unknown_query_id: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          confidence?: number | null
          created_at?: string
          final_intent?: string | null
          final_keywords?: string[]
          id?: string
          learning_log_id?: string | null
          model?: string | null
          normalized: string
          priority?: number
          raw_query: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          suggested_intent?: string | null
          suggested_keywords?: string[]
          unknown_query_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          confidence?: number | null
          created_at?: string
          final_intent?: string | null
          final_keywords?: string[]
          id?: string
          learning_log_id?: string | null
          model?: string | null
          normalized?: string
          priority?: number
          raw_query?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          suggested_intent?: string | null
          suggested_keywords?: string[]
          unknown_query_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_admin_supervisions_learning_log_id_fkey"
            columns: ["learning_log_id"]
            isOneToOne: false
            referencedRelation: "agente_learning_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_admin_supervisions_unknown_query_id_fkey"
            columns: ["unknown_query_id"]
            isOneToOne: false
            referencedRelation: "agente_unknown_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_faqs: {
        Row: {
          active: boolean
          any_of: string[]
          created_at: string
          hits: number
          id: string
          keywords: string[]
          notes: string | null
          priority: number
          response: string
          route: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          any_of?: string[]
          created_at?: string
          hits?: number
          id?: string
          keywords?: string[]
          notes?: string | null
          priority?: number
          response: string
          route?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          any_of?: string[]
          created_at?: string
          hits?: number
          id?: string
          keywords?: string[]
          notes?: string | null
          priority?: number
          response?: string
          route?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agente_intents: {
        Row: {
          action: string | null
          active: boolean
          created_at: string
          id: string
          key: string
          keywords: string[]
          label: string
          notes: string | null
          priority: number
          route: string | null
          spoken_reply: string
          updated_at: string
        }
        Insert: {
          action?: string | null
          active?: boolean
          created_at?: string
          id?: string
          key: string
          keywords?: string[]
          label: string
          notes?: string | null
          priority?: number
          route?: string | null
          spoken_reply: string
          updated_at?: string
        }
        Update: {
          action?: string | null
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          keywords?: string[]
          label?: string
          notes?: string | null
          priority?: number
          route?: string | null
          spoken_reply?: string
          updated_at?: string
        }
        Relationships: []
      }
      agente_learning_log: {
        Row: {
          added_keywords: string[]
          audit_criteria: Json | null
          audit_note: string | null
          audit_phase: number | null
          audit_verdict: string | null
          audited_at: string | null
          audited_by: string | null
          clicked_result: string | null
          confidence: number | null
          conversion_event: string | null
          created_at: string
          decision: string
          detected_intent: string | null
          estimated_cost: number | null
          failure_reason: string | null
          fallback_used: boolean | null
          geo_context: Json | null
          id: string
          intent_confidence: number | null
          intent_key: string | null
          latency_ms: number | null
          model: string | null
          model_used: string | null
          normalized: string
          normalized_query: string | null
          notes: string | null
          raw_query: string
          resolved: boolean | null
          resolver_type: string | null
          review_note: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          route_origin: string | null
          session_id: string | null
          tokens_input: number | null
          tokens_output: number | null
          unknown_query_id: string | null
        }
        Insert: {
          added_keywords?: string[]
          audit_criteria?: Json | null
          audit_note?: string | null
          audit_phase?: number | null
          audit_verdict?: string | null
          audited_at?: string | null
          audited_by?: string | null
          clicked_result?: string | null
          confidence?: number | null
          conversion_event?: string | null
          created_at?: string
          decision: string
          detected_intent?: string | null
          estimated_cost?: number | null
          failure_reason?: string | null
          fallback_used?: boolean | null
          geo_context?: Json | null
          id?: string
          intent_confidence?: number | null
          intent_key?: string | null
          latency_ms?: number | null
          model?: string | null
          model_used?: string | null
          normalized: string
          normalized_query?: string | null
          notes?: string | null
          raw_query: string
          resolved?: boolean | null
          resolver_type?: string | null
          review_note?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_origin?: string | null
          session_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          unknown_query_id?: string | null
        }
        Update: {
          added_keywords?: string[]
          audit_criteria?: Json | null
          audit_note?: string | null
          audit_phase?: number | null
          audit_verdict?: string | null
          audited_at?: string | null
          audited_by?: string | null
          clicked_result?: string | null
          confidence?: number | null
          conversion_event?: string | null
          created_at?: string
          decision?: string
          detected_intent?: string | null
          estimated_cost?: number | null
          failure_reason?: string | null
          fallback_used?: boolean | null
          geo_context?: Json | null
          id?: string
          intent_confidence?: number | null
          intent_key?: string | null
          latency_ms?: number | null
          model?: string | null
          model_used?: string | null
          normalized?: string
          normalized_query?: string | null
          notes?: string | null
          raw_query?: string
          resolved?: boolean | null
          resolver_type?: string | null
          review_note?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_origin?: string | null
          session_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          unknown_query_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_learning_log_unknown_query_id_fkey"
            columns: ["unknown_query_id"]
            isOneToOne: false
            referencedRelation: "agente_unknown_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_llm_cache: {
        Row: {
          active: boolean
          created_at: string
          forward_prompt: string | null
          hits: number
          id: string
          last_used_at: string
          model: string | null
          navigate: string | null
          normalized: string
          path: string
          raw_query: string
          reply: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          forward_prompt?: string | null
          hits?: number
          id?: string
          last_used_at?: string
          model?: string | null
          navigate?: string | null
          normalized: string
          path?: string
          raw_query: string
          reply: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          forward_prompt?: string | null
          hits?: number
          id?: string
          last_used_at?: string
          model?: string | null
          navigate?: string | null
          normalized?: string
          path?: string
          raw_query?: string
          reply?: string
          updated_at?: string
        }
        Relationships: []
      }
      agente_proper_nouns: {
        Row: {
          active: boolean
          aliases: string[]
          category: string
          created_at: string
          id: string
          name: string
          normalized: string
          priority: number
          route: string
          source: string | null
          source_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          category: string
          created_at?: string
          id?: string
          name: string
          normalized: string
          priority?: number
          route: string
          source?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          aliases?: string[]
          category?: string
          created_at?: string
          id?: string
          name?: string
          normalized?: string
          priority?: number
          route?: string
          source?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agente_respuestas: {
        Row: {
          intent_id: string
          question: string
          updated_at: string
        }
        Insert: {
          intent_id: string
          question: string
          updated_at?: string
        }
        Update: {
          intent_id?: string
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      agente_unknown_queries: {
        Row: {
          auto_added_keywords: string[]
          auto_assigned_intent: string | null
          confidence: number | null
          count: number
          created_at: string
          id: string
          last_seen_at: string
          normalized: string
          path: string | null
          processed_at: string | null
          query: string
        }
        Insert: {
          auto_added_keywords?: string[]
          auto_assigned_intent?: string | null
          confidence?: number | null
          count?: number
          created_at?: string
          id?: string
          last_seen_at?: string
          normalized: string
          path?: string | null
          processed_at?: string | null
          query: string
        }
        Update: {
          auto_added_keywords?: string[]
          auto_assigned_intent?: string | null
          confidence?: number | null
          count?: number
          created_at?: string
          id?: string
          last_seen_at?: string
          normalized?: string
          path?: string | null
          processed_at?: string | null
          query?: string
        }
        Relationships: []
      }
      agente_unknown_query_actions: {
        Row: {
          action: string
          id: string
          notes: string | null
          payload: Json
          performed_at: string
          performed_by: string | null
          unknown_query_id: string | null
        }
        Insert: {
          action: string
          id?: string
          notes?: string | null
          payload?: Json
          performed_at?: string
          performed_by?: string | null
          unknown_query_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          notes?: string | null
          payload?: Json
          performed_at?: string
          performed_by?: string | null
          unknown_query_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_unknown_query_actions_unknown_query_id_fkey"
            columns: ["unknown_query_id"]
            isOneToOne: false
            referencedRelation: "agente_unknown_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      beach_covers: {
        Row: {
          attribution: string | null
          created_at: string
          photos: string[]
          public_url: string
          slug: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          attribution?: string | null
          created_at?: string
          photos?: string[]
          public_url: string
          slug: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          attribution?: string | null
          created_at?: string
          photos?: string[]
          public_url?: string
          slug?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      bus_line_departures: {
        Row: {
          created_at: string
          day_type: string
          departure_time: string
          direction: number
          estimated: boolean
          id: string
          line_code: string
          source: string | null
        }
        Insert: {
          created_at?: string
          day_type: string
          departure_time: string
          direction: number
          estimated?: boolean
          id?: string
          line_code: string
          source?: string | null
        }
        Update: {
          created_at?: string
          day_type?: string
          departure_time?: string
          direction?: number
          estimated?: boolean
          id?: string
          line_code?: string
          source?: string | null
        }
        Relationships: []
      }
      bus_line_service_windows: {
        Row: {
          created_at: string
          day_type: string
          direction: number
          first_departure: string
          id: string
          last_departure: string
          line_code: string
          source: string | null
          terminal_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_type: string
          direction: number
          first_departure: string
          id?: string
          last_departure: string
          line_code: string
          source?: string | null
          terminal_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_type?: string
          direction?: number
          first_departure?: string
          id?: string
          last_departure?: string
          line_code?: string
          source?: string | null
          terminal_name?: string
          updated_at?: string
        }
        Relationships: []
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
          owner_id: string | null
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
          owner_id?: string | null
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
          owner_id?: string | null
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
      cinemas: {
        Row: {
          active: boolean
          address: string | null
          brand: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          opening_hours: Json | null
          phone: string | null
          photos: string[]
          slug: string
          ticket_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          opening_hours?: Json | null
          phone?: string | null
          photos?: string[]
          slug: string
          ticket_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          opening_hours?: Json | null
          phone?: string | null
          photos?: string[]
          slug?: string
          ticket_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      conversation_threads: {
        Row: {
          booking_id: string
          business_id: string
          closed_at: string | null
          context_snapshot: Json
          created_at: string
          id: string
          last_message_at: string
          status: Database["public"]["Enums"]["thread_status"]
          user_id: string | null
        }
        Insert: {
          booking_id: string
          business_id: string
          closed_at?: string | null
          context_snapshot?: Json
          created_at?: string
          id?: string
          last_message_at?: string
          status?: Database["public"]["Enums"]["thread_status"]
          user_id?: string | null
        }
        Update: {
          booking_id?: string
          business_id?: string
          closed_at?: string | null
          context_snapshot?: Json
          created_at?: string
          id?: string
          last_message_at?: string
          status?: Database["public"]["Enums"]["thread_status"]
          user_id?: string | null
        }
        Relationships: []
      }
      event_showtimes: {
        Row: {
          availability: string | null
          created_at: string
          currency: string | null
          ends_at: string | null
          event_id: string
          id: string
          price_max: number | null
          price_min: number | null
          source: string | null
          starts_at: string
          ticket_url: string | null
          venue_id: string
        }
        Insert: {
          availability?: string | null
          created_at?: string
          currency?: string | null
          ends_at?: string | null
          event_id: string
          id?: string
          price_max?: number | null
          price_min?: number | null
          source?: string | null
          starts_at: string
          ticket_url?: string | null
          venue_id: string
        }
        Update: {
          availability?: string | null
          created_at?: string
          currency?: string | null
          ends_at?: string | null
          event_id?: string
          id?: string
          price_max?: number | null
          price_min?: number | null
          source?: string | null
          starts_at?: string
          ticket_url?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_showtimes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_showtimes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sources: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_error: string | null
          last_scraped_at: string | null
          parser: string | null
          url: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_scraped_at?: string | null
          parser?: string | null
          url: string
          venue_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_scraped_at?: string | null
          parser?: string | null
          url?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sources_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          active: boolean
          age_rating: string | null
          artist: string | null
          category: string
          created_at: string
          description: string | null
          duration_min: number | null
          external_ids: Json | null
          genre: string | null
          id: string
          poster_url: string | null
          slug: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_rating?: string | null
          artist?: string | null
          category?: string
          created_at?: string
          description?: string | null
          duration_min?: number | null
          external_ids?: Json | null
          genre?: string | null
          id?: string
          poster_url?: string | null
          slug: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_rating?: string | null
          artist?: string | null
          category?: string
          created_at?: string
          description?: string | null
          duration_min?: number | null
          external_ids?: Json | null
          genre?: string | null
          id?: string
          poster_url?: string | null
          slug?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_api_calls: {
        Row: {
          caller: string
          created_at: string
          endpoint: string
          estimated_cost: number | null
          id: string
          latency_ms: number | null
          meta: Json
          model: string | null
          provider: string
          status_code: number | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          caller: string
          created_at?: string
          endpoint: string
          estimated_cost?: number | null
          id?: string
          latency_ms?: number | null
          meta?: Json
          model?: string | null
          provider: string
          status_code?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          caller?: string
          created_at?: string
          endpoint?: string
          estimated_cost?: number | null
          id?: string
          latency_ms?: number | null
          meta?: Json
          model?: string | null
          provider?: string
          status_code?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: []
      }
      films: {
        Row: {
          active: boolean
          age_rating: string | null
          cast_list: string[]
          created_at: string
          director: string | null
          duration_min: number | null
          external_ids: Json
          genre: string | null
          id: string
          language: string | null
          original_title: string | null
          poster_url: string | null
          release_date: string | null
          slug: string
          synopsis: string | null
          title: string
          trailer_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_rating?: string | null
          cast_list?: string[]
          created_at?: string
          director?: string | null
          duration_min?: number | null
          external_ids?: Json
          genre?: string | null
          id?: string
          language?: string | null
          original_title?: string | null
          poster_url?: string | null
          release_date?: string | null
          slug: string
          synopsis?: string | null
          title: string
          trailer_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_rating?: string | null
          cast_list?: string[]
          created_at?: string
          director?: string | null
          duration_min?: number | null
          external_ids?: Json
          genre?: string | null
          id?: string
          language?: string | null
          original_title?: string | null
          poster_url?: string | null
          release_date?: string | null
          slug?: string
          synopsis?: string | null
          title?: string
          trailer_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      google_place_details_cache: {
        Row: {
          cache_key: string | null
          details: Json
          fetched_at: string
          place_id: string
        }
        Insert: {
          cache_key?: string | null
          details: Json
          fetched_at?: string
          place_id: string
        }
        Update: {
          cache_key?: string | null
          details?: Json
          fetched_at?: string
          place_id?: string
        }
        Relationships: []
      }
      health_centers: {
        Row: {
          address: string | null
          associated_services: string[]
          created_at: string
          google_photo_refs: string[]
          google_place_id: string | null
          health_department: string | null
          id: string
          lat: number | null
          lng: number | null
          municipality: string
          name: string
          notes: string | null
          phone: string | null
          schedule: string | null
          service_type: string
          source_url: string | null
          specialties: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          associated_services?: string[]
          created_at?: string
          google_photo_refs?: string[]
          google_place_id?: string | null
          health_department?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          municipality: string
          name: string
          notes?: string | null
          phone?: string | null
          schedule?: string | null
          service_type: string
          source_url?: string | null
          specialties?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          associated_services?: string[]
          created_at?: string
          google_photo_refs?: string[]
          google_place_id?: string | null
          health_department?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          municipality?: string
          name?: string
          notes?: string | null
          phone?: string | null
          schedule?: string | null
          service_type?: string
          source_url?: string | null
          specialties?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      health_providers: {
        Row: {
          address: string | null
          category: string
          created_at: string
          google_place_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          opening_hours: Json | null
          phone: string | null
          photos: string[]
          price_level: string | null
          rating: number | null
          source: string
          updated_at: string
          user_ratings_total: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          category: string
          created_at?: string
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          opening_hours?: Json | null
          phone?: string | null
          photos?: string[]
          price_level?: string | null
          rating?: number | null
          source?: string
          updated_at?: string
          user_ratings_total?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          created_at?: string
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          opening_hours?: Json | null
          phone?: string | null
          photos?: string[]
          price_level?: string | null
          rating?: number | null
          source?: string
          updated_at?: string
          user_ratings_total?: number | null
          website?: string | null
        }
        Relationships: []
      }
      hotels_calendar: {
        Row: {
          available: boolean
          currency: string | null
          date: string
          hotel_id: string
          price_double: number | null
          price_min: number | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          currency?: string | null
          date: string
          hotel_id: string
          price_double?: number | null
          price_min?: number | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          currency?: string | null
          date?: string
          hotel_id?: string
          price_double?: number | null
          price_min?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      hotels_dynamic: {
        Row: {
          available: boolean
          breakfast_included: boolean | null
          currency: string | null
          current_price: number | null
          free_cancellation: boolean | null
          hotel_id: string
          raw: Json | null
          room_types: Json
          rooms_available: number | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          breakfast_included?: boolean | null
          currency?: string | null
          current_price?: number | null
          free_cancellation?: boolean | null
          hotel_id: string
          raw?: Json | null
          room_types?: Json
          rooms_available?: number | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          breakfast_included?: boolean | null
          currency?: string | null
          current_price?: number | null
          free_cancellation?: boolean | null
          hotel_id?: string
          raw?: Json | null
          room_types?: Json
          rooms_available?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_dynamic_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: true
            referencedRelation: "hotels_static"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels_static: {
        Row: {
          address: string | null
          amenities: Json
          booking_url: string | null
          created_at: string
          distance_km: number | null
          hotel_type: string | null
          id: string
          lat: number | null
          liteapi_hotel_id: string
          liteapi_id: string | null
          lng: number | null
          main_image: string | null
          name: string
          neighborhood: string | null
          photo_scrape_at: string | null
          photo_scrape_status: string | null
          raw: Json | null
          scraped_photos: string[] | null
          stars: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          amenities?: Json
          booking_url?: string | null
          created_at?: string
          distance_km?: number | null
          hotel_type?: string | null
          id?: string
          lat?: number | null
          liteapi_hotel_id: string
          liteapi_id?: string | null
          lng?: number | null
          main_image?: string | null
          name: string
          neighborhood?: string | null
          photo_scrape_at?: string | null
          photo_scrape_status?: string | null
          raw?: Json | null
          scraped_photos?: string[] | null
          stars?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          amenities?: Json
          booking_url?: string | null
          created_at?: string
          distance_km?: number | null
          hotel_type?: string | null
          id?: string
          lat?: number | null
          liteapi_hotel_id?: string
          liteapi_id?: string | null
          lng?: number | null
          main_image?: string | null
          name?: string
          neighborhood?: string | null
          photo_scrape_at?: string | null
          photo_scrape_status?: string | null
          raw?: Json | null
          scraped_photos?: string[] | null
          stars?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      interaction_events: {
        Row: {
          browser: string | null
          business_id: string | null
          campaign_id: string | null
          city: string | null
          conversion_status: string | null
          country: string | null
          device: string | null
          id: string
          ip_trunc: string | null
          lat: number | null
          lng: number | null
          metadata: Json
          occurred_at: string
          os: string | null
          path: string | null
          referrer: string | null
          region: string | null
          source: string | null
          type: string
          user_agent: string | null
          user_id: string | null
          utm: Json | null
          visitor_id: string | null
        }
        Insert: {
          browser?: string | null
          business_id?: string | null
          campaign_id?: string | null
          city?: string | null
          conversion_status?: string | null
          country?: string | null
          device?: string | null
          id?: string
          ip_trunc?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json
          occurred_at?: string
          os?: string | null
          path?: string | null
          referrer?: string | null
          region?: string | null
          source?: string | null
          type: string
          user_agent?: string | null
          user_id?: string | null
          utm?: Json | null
          visitor_id?: string | null
        }
        Update: {
          browser?: string | null
          business_id?: string | null
          campaign_id?: string | null
          city?: string | null
          conversion_status?: string | null
          country?: string | null
          device?: string | null
          id?: string
          ip_trunc?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json
          occurred_at?: string
          os?: string | null
          path?: string | null
          referrer?: string | null
          region?: string | null
          source?: string | null
          type?: string
          user_agent?: string | null
          user_id?: string | null
          utm?: Json | null
          visitor_id?: string | null
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
      messages: {
        Row: {
          created_at: string
          id: string
          message_type: Database["public"]["Enums"]["message_kind"]
          payload: Json
          read_at: string | null
          requires_action: boolean
          sender_type: Database["public"]["Enums"]["message_sender"]
          sender_user_id: string | null
          template_key: string | null
          text: string | null
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["message_kind"]
          payload?: Json
          read_at?: string | null
          requires_action?: boolean
          sender_type: Database["public"]["Enums"]["message_sender"]
          sender_user_id?: string | null
          template_key?: string | null
          text?: string | null
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["message_kind"]
          payload?: Json
          read_at?: string | null
          requires_action?: boolean
          sender_type?: Database["public"]["Enums"]["message_sender"]
          sender_user_id?: string | null
          template_key?: string | null
          text?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "conversation_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_event_reviews: {
        Row: {
          corrected_category: string | null
          corrected_source: string | null
          corrected_type: string | null
          created_at: string
          event_id: string
          flag: string
          id: string
          note: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          corrected_category?: string | null
          corrected_source?: string | null
          corrected_type?: string | null
          created_at?: string
          event_id: string
          flag?: string
          id?: string
          note?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          corrected_category?: string | null
          corrected_source?: string | null
          corrected_type?: string | null
          created_at?: string
          event_id?: string
          flag?: string
          id?: string
          note?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pharmacies: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          created_at: string
          geocoded_at: string | null
          hours: string | null
          id: string
          is_24h: boolean
          lat: number | null
          lng: number | null
          name: string
          on_duty: boolean
          phone: string | null
          postal_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          geocoded_at?: string | null
          hours?: string | null
          id?: string
          is_24h?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          on_duty?: boolean
          phone?: string | null
          postal_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          geocoded_at?: string | null
          hours?: string | null
          id?: string
          is_24h?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          on_duty?: boolean
          phone?: string | null
          postal_code?: string | null
        }
        Relationships: []
      }
      places: {
        Row: {
          address: string | null
          ai_tags: string[] | null
          category: string
          cover_photo: string | null
          created_at: string
          cuisine: string | null
          fetched_at: string
          google_place_id: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          open_now: boolean | null
          opening_hours_json: Json | null
          opening_hours_text: string | null
          phone: string | null
          photo_scrape_at: string | null
          photo_scrape_status: string | null
          price_currency: string | null
          price_level: string | null
          price_range_max: number | null
          price_range_min: number | null
          primary_type: string | null
          rating: number | null
          raw: Json | null
          scraped_photos: string[] | null
          types: string[] | null
          updated_at: string
          user_rating_count: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          ai_tags?: string[] | null
          category: string
          cover_photo?: string | null
          created_at?: string
          cuisine?: string | null
          fetched_at?: string
          google_place_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          open_now?: boolean | null
          opening_hours_json?: Json | null
          opening_hours_text?: string | null
          phone?: string | null
          photo_scrape_at?: string | null
          photo_scrape_status?: string | null
          price_currency?: string | null
          price_level?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          primary_type?: string | null
          rating?: number | null
          raw?: Json | null
          scraped_photos?: string[] | null
          types?: string[] | null
          updated_at?: string
          user_rating_count?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          ai_tags?: string[] | null
          category?: string
          cover_photo?: string | null
          created_at?: string
          cuisine?: string | null
          fetched_at?: string
          google_place_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          open_now?: boolean | null
          opening_hours_json?: Json | null
          opening_hours_text?: string | null
          phone?: string | null
          photo_scrape_at?: string | null
          photo_scrape_status?: string | null
          price_currency?: string | null
          price_level?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          primary_type?: string | null
          rating?: number | null
          raw?: Json | null
          scraped_photos?: string[] | null
          types?: string[] | null
          updated_at?: string
          user_rating_count?: number | null
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked: boolean
          city: string | null
          consents: Json
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          language: string | null
          last_name: string | null
          last_seen_at: string | null
          login_method: string | null
          marketing_opt_in: boolean
          preferences: Json
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blocked?: boolean
          city?: string | null
          consents?: Json
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          login_method?: string | null
          marketing_opt_in?: boolean
          preferences?: Json
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blocked?: boolean
          city?: string | null
          consents?: Json
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          login_method?: string | null
          marketing_opt_in?: boolean
          preferences?: Json
          terms_accepted_at?: string | null
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
      shop_businesses: {
        Row: {
          address: string | null
          brand: string | null
          city: string | null
          created_at: string
          google_place_id: string | null
          google_types: string[] | null
          id: string
          intent_id: string | null
          last_enriched_at: string | null
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          notes: string | null
          opening_hours: Json | null
          phone: string | null
          photo_scrape_at: string | null
          photo_scrape_status: string | null
          photos: Json | null
          postal_code: string | null
          price_level: number | null
          rating: number | null
          status: string
          subsubsector_id: string | null
          updated_at: string
          user_ratings_total: number | null
          website: string | null
          zone_id: string | null
        }
        Insert: {
          address?: string | null
          brand?: string | null
          city?: string | null
          created_at?: string
          google_place_id?: string | null
          google_types?: string[] | null
          id?: string
          intent_id?: string | null
          last_enriched_at?: string | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          notes?: string | null
          opening_hours?: Json | null
          phone?: string | null
          photo_scrape_at?: string | null
          photo_scrape_status?: string | null
          photos?: Json | null
          postal_code?: string | null
          price_level?: number | null
          rating?: number | null
          status?: string
          subsubsector_id?: string | null
          updated_at?: string
          user_ratings_total?: number | null
          website?: string | null
          zone_id?: string | null
        }
        Update: {
          address?: string | null
          brand?: string | null
          city?: string | null
          created_at?: string
          google_place_id?: string | null
          google_types?: string[] | null
          id?: string
          intent_id?: string | null
          last_enriched_at?: string | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          opening_hours?: Json | null
          phone?: string | null
          photo_scrape_at?: string | null
          photo_scrape_status?: string | null
          photos?: Json | null
          postal_code?: string | null
          price_level?: number | null
          rating?: number | null
          status?: string
          subsubsector_id?: string | null
          updated_at?: string
          user_ratings_total?: number | null
          website?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_businesses_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "shop_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_businesses_subsubsector_id_fkey"
            columns: ["subsubsector_id"]
            isOneToOne: false
            referencedRelation: "shop_subsubsectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_businesses_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shop_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_intent_learning: {
        Row: {
          ai_response: string | null
          ai_suggested_keywords: string[]
          confidence: number | null
          created_at: string
          hits: number
          id: string
          last_seen_at: string
          matched_intent_id: string | null
          matched_sector_id: string | null
          matched_subsector_id: string | null
          matched_subsubsector_id: string | null
          needs_review: boolean
          normalized_query: string
          resolved: boolean
          user_id: string | null
          user_query: string
        }
        Insert: {
          ai_response?: string | null
          ai_suggested_keywords?: string[]
          confidence?: number | null
          created_at?: string
          hits?: number
          id?: string
          last_seen_at?: string
          matched_intent_id?: string | null
          matched_sector_id?: string | null
          matched_subsector_id?: string | null
          matched_subsubsector_id?: string | null
          needs_review?: boolean
          normalized_query: string
          resolved?: boolean
          user_id?: string | null
          user_query: string
        }
        Update: {
          ai_response?: string | null
          ai_suggested_keywords?: string[]
          confidence?: number | null
          created_at?: string
          hits?: number
          id?: string
          last_seen_at?: string
          matched_intent_id?: string | null
          matched_sector_id?: string | null
          matched_subsector_id?: string | null
          matched_subsubsector_id?: string | null
          needs_review?: boolean
          normalized_query?: string
          resolved?: boolean
          user_id?: string | null
          user_query?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_intent_learning_matched_intent_id_fkey"
            columns: ["matched_intent_id"]
            isOneToOne: false
            referencedRelation: "shop_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_intent_learning_matched_sector_id_fkey"
            columns: ["matched_sector_id"]
            isOneToOne: false
            referencedRelation: "shop_sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_intent_learning_matched_subsector_id_fkey"
            columns: ["matched_subsector_id"]
            isOneToOne: false
            referencedRelation: "shop_subsectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_intent_learning_matched_subsubsector_id_fkey"
            columns: ["matched_subsubsector_id"]
            isOneToOne: false
            referencedRelation: "shop_subsubsectors"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_intents: {
        Row: {
          active: boolean
          created_at: string
          hits: number
          id: string
          keywords: string[]
          label: string
          priority: number
          subsubsector_id: string
          updated_at: string
          verbal_recommendation: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          hits?: number
          id?: string
          keywords?: string[]
          label: string
          priority?: number
          subsubsector_id: string
          updated_at?: string
          verbal_recommendation?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          hits?: number
          id?: string
          keywords?: string[]
          label?: string
          priority?: number
          subsubsector_id?: string
          updated_at?: string
          verbal_recommendation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_intents_subsubsector_id_fkey"
            columns: ["subsubsector_id"]
            isOneToOne: false
            referencedRelation: "shop_subsubsectors"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_sectors: {
        Row: {
          active: boolean
          created_at: string
          emoji: string | null
          id: string
          name: string
          short_label: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          short_label?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          short_label?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      shop_subsectors: {
        Row: {
          active: boolean
          created_at: string
          emoji: string | null
          id: string
          name: string
          sector_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          sector_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          sector_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_subsectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "shop_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_subsubsectors: {
        Row: {
          active: boolean
          created_at: string
          emoji: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          subsector_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          subsector_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          subsector_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_subsubsectors_subsector_id_fkey"
            columns: ["subsector_id"]
            isOneToOne: false
            referencedRelation: "shop_subsectors"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_zones: {
        Row: {
          active: boolean
          city: string
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      showtimes: {
        Row: {
          cinema_id: string
          created_at: string
          film_id: string
          format: string | null
          id: string
          price_eur: number | null
          room: string | null
          source: string | null
          starts_at: string
          ticket_url: string | null
          version: string | null
        }
        Insert: {
          cinema_id: string
          created_at?: string
          film_id: string
          format?: string | null
          id?: string
          price_eur?: number | null
          room?: string | null
          source?: string | null
          starts_at: string
          ticket_url?: string | null
          version?: string | null
        }
        Update: {
          cinema_id?: string
          created_at?: string
          film_id?: string
          format?: string | null
          id?: string
          price_eur?: number | null
          room?: string | null
          source?: string | null
          starts_at?: string
          ticket_url?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showtimes_cinema_id_fkey"
            columns: ["cinema_id"]
            isOneToOne: false
            referencedRelation: "cinemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showtimes_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      system_flags: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      test_users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          surname: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          surname?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          surname?: string | null
        }
        Relationships: []
      }
      tram_agencies: {
        Row: {
          agency_email: string | null
          agency_id: string
          agency_lang: string | null
          agency_name: string
          agency_phone: string | null
          agency_timezone: string | null
          agency_url: string | null
        }
        Insert: {
          agency_email?: string | null
          agency_id: string
          agency_lang?: string | null
          agency_name: string
          agency_phone?: string | null
          agency_timezone?: string | null
          agency_url?: string | null
        }
        Update: {
          agency_email?: string | null
          agency_id?: string
          agency_lang?: string | null
          agency_name?: string
          agency_phone?: string | null
          agency_timezone?: string | null
          agency_url?: string | null
        }
        Relationships: []
      }
      tram_calendar: {
        Row: {
          end_date: string
          friday: boolean
          monday: boolean
          saturday: boolean
          service_id: string
          start_date: string
          sunday: boolean
          thursday: boolean
          tuesday: boolean
          wednesday: boolean
        }
        Insert: {
          end_date: string
          friday?: boolean
          monday?: boolean
          saturday?: boolean
          service_id: string
          start_date: string
          sunday?: boolean
          thursday?: boolean
          tuesday?: boolean
          wednesday?: boolean
        }
        Update: {
          end_date?: string
          friday?: boolean
          monday?: boolean
          saturday?: boolean
          service_id?: string
          start_date?: string
          sunday?: boolean
          thursday?: boolean
          tuesday?: boolean
          wednesday?: boolean
        }
        Relationships: []
      }
      tram_calendar_dates: {
        Row: {
          date: string
          exception_type: number
          service_id: string
        }
        Insert: {
          date: string
          exception_type: number
          service_id: string
        }
        Update: {
          date?: string
          exception_type?: number
          service_id?: string
        }
        Relationships: []
      }
      tram_feed_versions: {
        Row: {
          applied_at: string | null
          feed_end_date: string | null
          feed_start_date: string | null
          fetched_at: string
          id: string
          notes: string | null
          sha1: string | null
          size_bytes: number | null
          source_url: string
        }
        Insert: {
          applied_at?: string | null
          feed_end_date?: string | null
          feed_start_date?: string | null
          fetched_at?: string
          id?: string
          notes?: string | null
          sha1?: string | null
          size_bytes?: number | null
          source_url: string
        }
        Update: {
          applied_at?: string | null
          feed_end_date?: string | null
          feed_start_date?: string | null
          fetched_at?: string
          id?: string
          notes?: string | null
          sha1?: string | null
          size_bytes?: number | null
          source_url?: string
        }
        Relationships: []
      }
      tram_live_departures: {
        Row: {
          arrival_at: string | null
          created_at: string
          departure_at: string
          direction: number | null
          headsign: string | null
          line_color: string | null
          line_long_name: string | null
          line_short_name: string | null
          route_id: string
          service_date: string
          service_id: string
          stop_id: string
          trip_id: string
        }
        Insert: {
          arrival_at?: string | null
          created_at?: string
          departure_at: string
          direction?: number | null
          headsign?: string | null
          line_color?: string | null
          line_long_name?: string | null
          line_short_name?: string | null
          route_id: string
          service_date: string
          service_id: string
          stop_id: string
          trip_id: string
        }
        Update: {
          arrival_at?: string | null
          created_at?: string
          departure_at?: string
          direction?: number | null
          headsign?: string | null
          line_color?: string | null
          line_long_name?: string | null
          line_short_name?: string | null
          route_id?: string
          service_date?: string
          service_id?: string
          stop_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tram_live_departures_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "tram_routes"
            referencedColumns: ["route_id"]
          },
          {
            foreignKeyName: "tram_live_departures_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "tram_stops"
            referencedColumns: ["stop_id"]
          },
          {
            foreignKeyName: "tram_live_departures_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "tram_trips"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      tram_routes: {
        Row: {
          agency_id: string | null
          route_color: string | null
          route_desc: string | null
          route_id: string
          route_long_name: string | null
          route_short_name: string | null
          route_text_color: string | null
          route_type: number | null
          route_url: string | null
          sort_order: number | null
        }
        Insert: {
          agency_id?: string | null
          route_color?: string | null
          route_desc?: string | null
          route_id: string
          route_long_name?: string | null
          route_short_name?: string | null
          route_text_color?: string | null
          route_type?: number | null
          route_url?: string | null
          sort_order?: number | null
        }
        Update: {
          agency_id?: string | null
          route_color?: string | null
          route_desc?: string | null
          route_id?: string
          route_long_name?: string | null
          route_short_name?: string | null
          route_text_color?: string | null
          route_type?: number | null
          route_url?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tram_routes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "tram_agencies"
            referencedColumns: ["agency_id"]
          },
        ]
      }
      tram_shapes: {
        Row: {
          shape_dist_traveled: number | null
          shape_id: string
          shape_pt_lat: number
          shape_pt_lng: number
          shape_pt_sequence: number
        }
        Insert: {
          shape_dist_traveled?: number | null
          shape_id: string
          shape_pt_lat: number
          shape_pt_lng: number
          shape_pt_sequence: number
        }
        Update: {
          shape_dist_traveled?: number | null
          shape_id?: string
          shape_pt_lat?: number
          shape_pt_lng?: number
          shape_pt_sequence?: number
        }
        Relationships: []
      }
      tram_stop_times: {
        Row: {
          arrival_seconds: number | null
          departure_seconds: number | null
          drop_off_type: number | null
          pickup_type: number | null
          shape_dist_traveled: number | null
          stop_headsign: string | null
          stop_id: string
          stop_sequence: number
          timepoint: number | null
          trip_id: string
        }
        Insert: {
          arrival_seconds?: number | null
          departure_seconds?: number | null
          drop_off_type?: number | null
          pickup_type?: number | null
          shape_dist_traveled?: number | null
          stop_headsign?: string | null
          stop_id: string
          stop_sequence: number
          timepoint?: number | null
          trip_id: string
        }
        Update: {
          arrival_seconds?: number | null
          departure_seconds?: number | null
          drop_off_type?: number | null
          pickup_type?: number | null
          shape_dist_traveled?: number | null
          stop_headsign?: string | null
          stop_id?: string
          stop_sequence?: number
          timepoint?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tram_stop_times_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "tram_stops"
            referencedColumns: ["stop_id"]
          },
          {
            foreignKeyName: "tram_stop_times_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "tram_trips"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      tram_stops: {
        Row: {
          lat: number | null
          lng: number | null
          location_type: number | null
          parent_station: string | null
          platform_code: string | null
          stop_code: string | null
          stop_desc: string | null
          stop_id: string
          stop_name: string
          stop_url: string | null
          wheelchair_boarding: number | null
          zone_id: string | null
        }
        Insert: {
          lat?: number | null
          lng?: number | null
          location_type?: number | null
          parent_station?: string | null
          platform_code?: string | null
          stop_code?: string | null
          stop_desc?: string | null
          stop_id: string
          stop_name: string
          stop_url?: string | null
          wheelchair_boarding?: number | null
          zone_id?: string | null
        }
        Update: {
          lat?: number | null
          lng?: number | null
          location_type?: number | null
          parent_station?: string | null
          platform_code?: string | null
          stop_code?: string | null
          stop_desc?: string | null
          stop_id?: string
          stop_name?: string
          stop_url?: string | null
          wheelchair_boarding?: number | null
          zone_id?: string | null
        }
        Relationships: []
      }
      tram_trips: {
        Row: {
          bikes_allowed: number | null
          block_id: string | null
          direction_id: number | null
          route_id: string
          service_id: string
          shape_id: string | null
          trip_headsign: string | null
          trip_id: string
          trip_short_name: string | null
          wheelchair_accessible: number | null
        }
        Insert: {
          bikes_allowed?: number | null
          block_id?: string | null
          direction_id?: number | null
          route_id: string
          service_id: string
          shape_id?: string | null
          trip_headsign?: string | null
          trip_id: string
          trip_short_name?: string | null
          wheelchair_accessible?: number | null
        }
        Update: {
          bikes_allowed?: number | null
          block_id?: string | null
          direction_id?: number | null
          route_id?: string
          service_id?: string
          shape_id?: string | null
          trip_headsign?: string | null
          trip_id?: string
          trip_short_name?: string | null
          wheelchair_accessible?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tram_trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "tram_routes"
            referencedColumns: ["route_id"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted_at: string
          consent_type: string
          id: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          id?: string
          user_id: string
          version?: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          id?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted: boolean
          id: string
          permission: string
          updated_at: string
          user_id: string
        }
        Insert: {
          granted: boolean
          id?: string
          permission: string
          updated_at?: string
          user_id: string
        }
        Update: {
          granted?: boolean
          id?: string
          permission?: string
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
      venues: {
        Row: {
          active: boolean
          address: string | null
          cover_url: string | null
          created_at: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
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
      agente_normalize: { Args: { input: string }; Returns: string }
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
      purge_ad_variants_cache: {
        Args: { p_retention?: string }
        Returns: number
      }
      purge_aena_flights: { Args: { p_retention?: string }; Returns: number }
      purge_agente_learning_log: {
        Args: { p_retention?: string }
        Returns: number
      }
      purge_agente_unknown_queries: {
        Args: { p_retention?: string }
        Returns: number
      }
      purge_agente_unknown_query_actions: {
        Args: { p_retention?: string }
        Returns: number
      }
      purge_daily_cleanup: { Args: never; Returns: Json }
      purge_event_showtimes_past: {
        Args: { p_retention?: string }
        Returns: number
      }
      purge_events_orphan: { Args: never; Returns: number }
      purge_external_api_calls: {
        Args: { p_retention?: string }
        Returns: number
      }
      purge_films_orphan: { Args: never; Returns: number }
      purge_hotels_calendar_past: { Args: never; Returns: number }
      purge_interaction_events: {
        Args: { p_retention?: string }
        Returns: number
      }
      purge_operational_event_reviews: {
        Args: { p_retention?: string }
        Returns: number
      }
      purge_showtimes_past: { Args: { p_retention?: string }; Returns: number }
      purge_tram_expired_services: { Args: never; Returns: number }
      purge_tram_keep_window: { Args: { p_days?: number }; Returns: number }
      refresh_tram_live_departures: {
        Args: { p_from?: string; p_to?: string }
        Returns: number
      }
      touch_last_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "public_user" | "business_user" | "admin"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      message_kind:
        | "quick_reply"
        | "free_text"
        | "system_event"
        | "eta_update"
        | "location"
        | "qr"
        | "slot_proposal"
      message_sender: "user" | "business" | "system" | "ai"
      qr_purpose: "visit" | "referral" | "promo" | "booking" | "campaign"
      qr_status: "active" | "used" | "expired"
      referral_status: "pending" | "converted" | "expired"
      thread_status:
        | "open"
        | "awaiting_user"
        | "awaiting_business"
        | "closed"
        | "expired"
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
      message_kind: [
        "quick_reply",
        "free_text",
        "system_event",
        "eta_update",
        "location",
        "qr",
        "slot_proposal",
      ],
      message_sender: ["user", "business", "system", "ai"],
      qr_purpose: ["visit", "referral", "promo", "booking", "campaign"],
      qr_status: ["active", "used", "expired"],
      referral_status: ["pending", "converted", "expired"],
      thread_status: [
        "open",
        "awaiting_user",
        "awaiting_business",
        "closed",
        "expired",
      ],
    },
  },
} as const
