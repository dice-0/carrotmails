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
      billing_customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          provider: string
          provider_customer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          provider?: string
          provider_customer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          provider?: string
          provider_customer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_entitlements: {
        Row: {
          active: boolean
          created_at: string
          entitlement: string
          expires_at: string | null
          id: string
          source_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          entitlement: string
          expires_at?: string | null
          id?: string
          source_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          entitlement?: string
          expires_at?: string | null
          id?: string
          source_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_offers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          currency: string
          max_redemptions: number
          name: string
          price_cents: number
          redemption_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          currency?: string
          max_redemptions: number
          name: string
          price_cents: number
          redemption_count?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          currency?: string
          max_redemptions?: number
          name?: string
          price_cents?: number
          redemption_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_purchases: {
        Row: {
          amount_cents: number
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          product: string
          provider_payment_id: string
          provider_product_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          product: string
          provider_payment_id: string
          provider_product_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          product?: string
          provider_payment_id?: string
          provider_product_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          provider_product_id: string
          provider_subscription_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          provider_product_id: string
          provider_subscription_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          provider_product_id?: string
          provider_subscription_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_webhook_events: {
        Row: {
          event_type: string
          id: string
          processed_at: string
          provider_event_id: string
        }
        Insert: {
          event_type: string
          id?: string
          processed_at?: string
          provider_event_id: string
        }
        Update: {
          event_type?: string
          id?: string
          processed_at?: string
          provider_event_id?: string
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          error: string | null
          id: string
          message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["recipient_status"]
          thread_id: string | null
          unsubscribe_token: string | null
          user_id: string
          vars: Json
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          error?: string | null
          id?: string
          message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          thread_id?: string | null
          unsubscribe_token?: string | null
          user_id: string
          vars?: Json
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          thread_id?: string | null
          unsubscribe_token?: string | null
          user_id?: string
          vars?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body_html: string
          consent_confirmed: boolean
          consent_confirmed_at: string | null
          consent_source: string | null
          created_at: string
          daily_cap: number
          failed_count: number
          from_name: string | null
          id: string
          list_id: string | null
          mailbox_id: string | null
          name: string
          next_dispatch_at: string | null
          replied_count: number
          scheduled_for: string | null
          sent_count: number
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string
          throttle_seconds: number
          total_count: number
          unsubscribed_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html?: string
          consent_confirmed?: boolean
          consent_confirmed_at?: string | null
          consent_source?: string | null
          created_at?: string
          daily_cap?: number
          failed_count?: number
          from_name?: string | null
          id?: string
          list_id?: string | null
          mailbox_id?: string | null
          name?: string
          next_dispatch_at?: string | null
          replied_count?: number
          scheduled_for?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string
          throttle_seconds?: number
          total_count?: number
          unsubscribed_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string
          consent_confirmed?: boolean
          consent_confirmed_at?: string | null
          consent_source?: string | null
          created_at?: string
          daily_cap?: number
          failed_count?: number
          from_name?: string | null
          id?: string
          list_id?: string | null
          mailbox_id?: string | null
          name?: string
          next_dispatch_at?: string | null
          replied_count?: number
          scheduled_for?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string
          throttle_seconds?: number
          total_count?: number
          unsubscribed_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailbox_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          consent_confirmed: boolean
          consent_confirmed_at: string | null
          consent_source: string | null
          contact_count: number
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_confirmed?: boolean
          consent_confirmed_at?: string | null
          consent_source?: string | null
          contact_count?: number
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_confirmed?: boolean
          consent_confirmed_at?: string | null
          consent_source?: string | null
          contact_count?: number
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          consent_confirmed_at: string | null
          consent_source: string | null
          created_at: string
          email: string
          id: string
          list_id: string
          user_id: string
          vars: Json
        }
        Insert: {
          consent_confirmed_at?: string | null
          consent_source?: string | null
          created_at?: string
          email: string
          id?: string
          list_id: string
          user_id: string
          vars?: Json
        }
        Update: {
          consent_confirmed_at?: string | null
          consent_source?: string | null
          created_at?: string
          email?: string
          id?: string
          list_id?: string
          user_id?: string
          vars?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_events: {
        Row: {
          id: string
          mailbox_id: string | null
          recipient_email: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          mailbox_id?: string | null
          recipient_email: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          mailbox_id?: string | null
          recipient_email?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_events_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailbox_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          created_at: string
          data: Json
          email: string
          form_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          email: string
          form_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          email?: string
          form_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          fields: Json
          id: string
          list_id: string | null
          name: string
          redirect_url: string | null
          slug: string
          submission_count: number
          success_message: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: string
          list_id?: string | null
          name: string
          redirect_url?: string | null
          slug: string
          submission_count?: number
          success_message?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: string
          list_id?: string | null
          name?: string
          redirect_url?: string | null
          slug?: string
          submission_count?: number
          success_message?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_connections: {
        Row: {
          access_token: string | null
          created_at: string
          daily_cap: number
          daily_sent_count: number
          daily_sent_date: string
          display_name: string | null
          email: string
          expires_at: string | null
          id: string
          last_history_id: string | null
          provider: Database["public"]["Enums"]["mail_provider"]
          refresh_token: string | null
          scopes: string | null
          status: string
          updated_at: string
          user_id: string
          warmup_started_on: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          daily_cap?: number
          daily_sent_count?: number
          daily_sent_date?: string
          display_name?: string | null
          email: string
          expires_at?: string | null
          id?: string
          last_history_id?: string | null
          provider: Database["public"]["Enums"]["mail_provider"]
          refresh_token?: string | null
          scopes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          warmup_started_on?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          daily_cap?: number
          daily_sent_count?: number
          daily_sent_date?: string
          display_name?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          last_history_id?: string | null
          provider?: Database["public"]["Enums"]["mail_provider"]
          refresh_token?: string | null
          scopes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          warmup_started_on?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: Database["public"]["Enums"]["suppression_reason"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason: Database["public"]["Enums"]["suppression_reason"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: Database["public"]["Enums"]["suppression_reason"]
          user_id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          id?: string
          name: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "paused"
        | "done"
        | "failed"
      mail_provider: "gmail" | "outlook"
      recipient_status:
        | "pending"
        | "sent"
        | "failed"
        | "replied"
        | "unsubscribed"
        | "skipped"
      suppression_reason:
        | "unsubscribe"
        | "bounce"
        | "complaint"
        | "manual"
        | "invalid"
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
      campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "paused",
        "done",
        "failed",
      ],
      mail_provider: ["gmail", "outlook"],
      recipient_status: [
        "pending",
        "sent",
        "failed",
        "replied",
        "unsubscribed",
        "skipped",
      ],
      suppression_reason: [
        "unsubscribe",
        "bounce",
        "complaint",
        "manual",
        "invalid",
      ],
    },
  },
} as const
