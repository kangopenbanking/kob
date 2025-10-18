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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_tokens: {
        Row: {
          client_id: string
          consent_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          is_revoked: boolean | null
          revoked_at: string | null
          scope: string
          token_hash: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          consent_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          is_revoked?: boolean | null
          revoked_at?: string | null
          scope: string
          token_hash: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          consent_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          is_revoked?: boolean | null
          revoked_at?: string | null
          scope?: string
          token_hash?: string
          user_id?: string | null
        }
        Relationships: []
      }
      aisp_consents: {
        Row: {
          account_ids: Json | null
          authorization_code: string | null
          authorization_url: string | null
          authorized_at: string | null
          client_id: string
          consent_id: string
          created_at: string | null
          expiration_date: string
          id: string
          permissions: Json
          revocation_reason: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["consent_status"]
          transaction_from_date: string | null
          transaction_to_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_ids?: Json | null
          authorization_code?: string | null
          authorization_url?: string | null
          authorized_at?: string | null
          client_id: string
          consent_id: string
          created_at?: string | null
          expiration_date: string
          id?: string
          permissions?: Json
          revocation_reason?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          transaction_from_date?: string | null
          transaction_to_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_ids?: Json | null
          authorization_code?: string | null
          authorization_url?: string | null
          authorized_at?: string | null
          client_id?: string
          consent_id?: string
          created_at?: string | null
          expiration_date?: string
          id?: string
          permissions?: Json
          revocation_reason?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          transaction_from_date?: string | null
          transaction_to_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aisp_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "tpp_registrations"
            referencedColumns: ["client_id"]
          },
        ]
      }
      api_credentials: {
        Row: {
          api_key: string
          api_secret: string
          created_at: string
          environment: string
          id: string
          institution_id: string
          is_active: boolean
          last_used_at: string | null
        }
        Insert: {
          api_key: string
          api_secret: string
          created_at?: string
          environment?: string
          id?: string
          institution_id: string
          is_active?: boolean
          last_used_at?: string | null
        }
        Update: {
          api_key?: string
          api_secret?: string
          created_at?: string
          environment?: string
          id?: string
          institution_id?: string
          is_active?: boolean
          last_used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_credentials_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_codes: {
        Row: {
          client_id: string
          code: string
          code_challenge: string | null
          code_challenge_method: string | null
          consent_id: string | null
          consent_type: string | null
          created_at: string | null
          expires_at: string
          id: string
          redirect_uri: string
          scope: string
          used: boolean | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          client_id: string
          code: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          consent_id?: string | null
          consent_type?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          redirect_uri: string
          scope: string
          used?: boolean | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string
          code?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          consent_id?: string | null
          consent_type?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          redirect_uri?: string
          scope?: string
          used?: boolean | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_certificates: {
        Row: {
          certificate_pem: string
          client_id: string
          created_at: string | null
          fingerprint: string
          id: string
          is_revoked: boolean | null
          issuer_dn: string
          revocation_reason: string | null
          revoked_at: string | null
          subject_dn: string
          updated_at: string | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          certificate_pem: string
          client_id: string
          created_at?: string | null
          fingerprint: string
          id?: string
          is_revoked?: boolean | null
          issuer_dn: string
          revocation_reason?: string | null
          revoked_at?: string | null
          subject_dn: string
          updated_at?: string | null
          valid_from: string
          valid_until: string
        }
        Update: {
          certificate_pem?: string
          client_id?: string
          created_at?: string | null
          fingerprint?: string
          id?: string
          is_revoked?: boolean | null
          issuer_dn?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          subject_dn?: string
          updated_at?: string | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      consent_events: {
        Row: {
          client_id: string | null
          consent_id: string
          consent_type: string
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          consent_id: string
          consent_type: string
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          consent_id?: string
          consent_type?: string
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      institutions: {
        Row: {
          address: string
          approved_at: string | null
          approved_by: string | null
          country: string
          created_at: string
          id: string
          institution_name: string
          institution_type: Database["public"]["Enums"]["institution_type"]
          phone: string
          registration_number: string
          status: Database["public"]["Enums"]["institution_status"]
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address: string
          approved_at?: string | null
          approved_by?: string | null
          country?: string
          created_at?: string
          id?: string
          institution_name: string
          institution_type: Database["public"]["Enums"]["institution_type"]
          phone: string
          registration_number: string
          status?: Database["public"]["Enums"]["institution_status"]
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string
          approved_at?: string | null
          approved_by?: string | null
          country?: string
          created_at?: string
          id?: string
          institution_name?: string
          institution_type?: Database["public"]["Enums"]["institution_type"]
          phone?: string
          registration_number?: string
          status?: Database["public"]["Enums"]["institution_status"]
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      par_requests: {
        Row: {
          client_id: string
          created_at: string | null
          expires_at: string
          id: string
          request_object: string
          request_uri: string
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          request_object: string
          request_uri: string
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          request_object?: string
          request_uri?: string
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: []
      }
      pisp_consents: {
        Row: {
          authorization_code: string | null
          authorization_url: string | null
          authorized_at: string | null
          client_id: string
          consent_id: string
          created_at: string | null
          creditor: Json
          debtor_account: Json | null
          expires_at: string
          id: string
          instructed_amount: Json
          payment_id: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          reference: string | null
          remittance_information: string | null
          revocation_reason: string | null
          revoked_at: string | null
          risk: Json | null
          status: Database["public"]["Enums"]["consent_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          authorization_code?: string | null
          authorization_url?: string | null
          authorized_at?: string | null
          client_id: string
          consent_id: string
          created_at?: string | null
          creditor: Json
          debtor_account?: Json | null
          expires_at: string
          id?: string
          instructed_amount: Json
          payment_id?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          reference?: string | null
          remittance_information?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          risk?: Json | null
          status?: Database["public"]["Enums"]["consent_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          authorization_code?: string | null
          authorization_url?: string | null
          authorized_at?: string | null
          client_id?: string
          consent_id?: string
          created_at?: string | null
          creditor?: Json
          debtor_account?: Json | null
          expires_at?: string
          id?: string
          instructed_amount?: Json
          payment_id?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          reference?: string | null
          remittance_information?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          risk?: Json | null
          status?: Database["public"]["Enums"]["consent_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pisp_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "tpp_registrations"
            referencedColumns: ["client_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      refresh_tokens: {
        Row: {
          access_token_id: string | null
          client_id: string
          created_at: string | null
          expires_at: string
          id: string
          is_revoked: boolean | null
          revoked_at: string | null
          token_hash: string
          user_id: string | null
        }
        Insert: {
          access_token_id?: string | null
          client_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          is_revoked?: boolean | null
          revoked_at?: string | null
          token_hash: string
          user_id?: string | null
        }
        Update: {
          access_token_id?: string | null
          client_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          is_revoked?: boolean | null
          revoked_at?: string | null
          token_hash?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_access_token_id_fkey"
            columns: ["access_token_id"]
            isOneToOne: false
            referencedRelation: "access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      signing_keys: {
        Row: {
          alg: string
          created_at: string | null
          e: string
          id: string
          is_active: boolean | null
          kid: string
          kty: string
          n: string
          private_key: string
          rotated_at: string | null
          use: string
        }
        Insert: {
          alg?: string
          created_at?: string | null
          e: string
          id?: string
          is_active?: boolean | null
          kid: string
          kty?: string
          n: string
          private_key: string
          rotated_at?: string | null
          use?: string
        }
        Update: {
          alg?: string
          created_at?: string | null
          e?: string
          id?: string
          is_active?: boolean | null
          kid?: string
          kty?: string
          n?: string
          private_key?: string
          rotated_at?: string | null
          use?: string
        }
        Relationships: []
      }
      tpp_registrations: {
        Row: {
          client_id: string
          client_name: string
          client_secret: string
          created_at: string | null
          environment: string
          grant_types: string[]
          id: string
          institution_id: string | null
          is_active: boolean | null
          jwks: Json | null
          jwks_uri: string | null
          redirect_uris: string[]
          response_types: string[]
          scope: string
          software_id: string
          software_roles: string[]
          software_statement: string
          token_endpoint_auth_method: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          client_name: string
          client_secret: string
          created_at?: string | null
          environment?: string
          grant_types?: string[]
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          jwks?: Json | null
          jwks_uri?: string | null
          redirect_uris: string[]
          response_types?: string[]
          scope?: string
          software_id: string
          software_roles: string[]
          software_statement: string
          token_endpoint_auth_method?: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          client_name?: string
          client_secret?: string
          created_at?: string | null
          environment?: string
          grant_types?: string[]
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          jwks?: Json | null
          jwks_uri?: string | null
          redirect_uris?: string[]
          response_types?: string[]
          scope?: string
          software_id?: string
          software_roles?: string[]
          software_statement?: string
          token_endpoint_auth_method?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpp_registrations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          id: string
          institution_id: string
          metadata: Json | null
          status: string
          transaction_type: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          institution_id: string
          metadata?: Json | null
          status: string
          transaction_type: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          institution_id?: string
          metadata?: Json | null
          status?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_auth_codes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_par_requests: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      expire_old_consents: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_consent_valid: {
        Args: { _consent_id: string; _consent_type: string }
        Returns: boolean
      }
      log_consent_event: {
        Args: {
          _client_id?: string
          _consent_id: string
          _consent_type: string
          _event_type: string
          _metadata?: Json
          _user_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "institution"
      consent_status:
        | "AwaitingAuthorisation"
        | "Authorised"
        | "Rejected"
        | "Revoked"
        | "Expired"
        | "Consumed"
      institution_status: "pending" | "approved" | "rejected" | "suspended"
      institution_type: "bank" | "credit_union" | "fintech"
      payment_type:
        | "domestic"
        | "international"
        | "scheduled"
        | "standing_order"
        | "vrp"
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
      app_role: ["admin", "institution"],
      consent_status: [
        "AwaitingAuthorisation",
        "Authorised",
        "Rejected",
        "Revoked",
        "Expired",
        "Consumed",
      ],
      institution_status: ["pending", "approved", "rejected", "suspended"],
      institution_type: ["bank", "credit_union", "fintech"],
      payment_type: [
        "domestic",
        "international",
        "scheduled",
        "standing_order",
        "vrp",
      ],
    },
  },
} as const
