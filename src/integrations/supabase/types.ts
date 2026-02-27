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
          certificate_id: string | null
          client_id: string
          cnf_thumbprint: string | null
          consent_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          is_revoked: boolean | null
          refresh_token_id: string | null
          revoked_at: string | null
          scope: string
          token_hash: string
          user_id: string | null
        }
        Insert: {
          certificate_id?: string | null
          client_id: string
          cnf_thumbprint?: string | null
          consent_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          is_revoked?: boolean | null
          refresh_token_id?: string | null
          revoked_at?: string | null
          scope: string
          token_hash: string
          user_id?: string | null
        }
        Update: {
          certificate_id?: string | null
          client_id?: string
          cnf_thumbprint?: string | null
          consent_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          is_revoked?: boolean | null
          refresh_token_id?: string | null
          revoked_at?: string | null
          scope?: string
          token_hash?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_tokens_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "client_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_tokens_refresh_token_id_fkey"
            columns: ["refresh_token_id"]
            isOneToOne: false
            referencedRelation: "refresh_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      account_balances: {
        Row: {
          account_id: string
          amount: number
          balance_datetime: string
          balance_type: string
          created_at: string | null
          credit_debit_indicator: string
          credit_line: Json | null
          currency: string
          id: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          amount: number
          balance_datetime: string
          balance_type: string
          created_at?: string | null
          credit_debit_indicator: string
          credit_line?: Json | null
          currency?: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          balance_datetime?: string
          balance_type?: string
          created_at?: string | null
          credit_debit_indicator?: string
          credit_line?: Json | null
          currency?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_holder_name: string
          account_id: string
          account_subtype: Database["public"]["Enums"]["account_subtype"]
          account_type: Database["public"]["Enums"]["account_type"]
          authorized_signatories: Json[] | null
          business_details: Json | null
          created_at: string | null
          currency: string
          id: string
          identification_scheme: Database["public"]["Enums"]["account_scheme"]
          identification_value: string
          institution_id: string | null
          is_active: boolean | null
          nickname: string | null
          opened_date: string | null
          secondary_identification: string | null
          transaction_limits: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_holder_name: string
          account_id: string
          account_subtype?: Database["public"]["Enums"]["account_subtype"]
          account_type?: Database["public"]["Enums"]["account_type"]
          authorized_signatories?: Json[] | null
          business_details?: Json | null
          created_at?: string | null
          currency?: string
          id?: string
          identification_scheme?: Database["public"]["Enums"]["account_scheme"]
          identification_value: string
          institution_id?: string | null
          is_active?: boolean | null
          nickname?: string | null
          opened_date?: string | null
          secondary_identification?: string | null
          transaction_limits?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_holder_name?: string
          account_id?: string
          account_subtype?: Database["public"]["Enums"]["account_subtype"]
          account_type?: Database["public"]["Enums"]["account_type"]
          authorized_signatories?: Json[] | null
          business_details?: Json | null
          created_at?: string | null
          currency?: string
          id?: string
          identification_scheme?: Database["public"]["Enums"]["account_scheme"]
          identification_value?: string
          institution_id?: string | null
          is_active?: boolean | null
          nickname?: string | null
          opened_date?: string | null
          secondary_identification?: string | null
          transaction_limits?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      address_collection_items: {
        Row: {
          added_at: string | null
          address_id: string
          collection_id: string
          id: string
        }
        Insert: {
          added_at?: string | null
          address_id: string
          collection_id: string
          id?: string
        }
        Update: {
          added_at?: string | null
          address_id?: string
          collection_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "address_collection_items_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "user_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "address_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "address_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      address_collections: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      address_imports: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_details: Json | null
          failed_imports: number | null
          file_name: string
          file_type: string | null
          id: string
          started_at: string | null
          status: string | null
          successful_imports: number | null
          total_rows: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          failed_imports?: number | null
          file_name: string
          file_type?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          successful_imports?: number | null
          total_rows?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          failed_imports?: number | null
          file_name?: string
          file_type?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          successful_imports?: number | null
          total_rows?: number | null
          user_id?: string
        }
        Relationships: []
      }
      admin_exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          effective_from: string | null
          effective_rate: number | null
          effective_until: string | null
          id: string
          is_active: boolean | null
          margin_percentage: number | null
          rate: number
          set_by: string | null
          source: string | null
          target_currency: string
          updated_at: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          effective_from?: string | null
          effective_rate?: number | null
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          margin_percentage?: number | null
          rate: number
          set_by?: string | null
          source?: string | null
          target_currency: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          effective_from?: string | null
          effective_rate?: number | null
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          margin_percentage?: number | null
          rate?: number
          set_by?: string | null
          source?: string | null
          target_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_portal_permissions: {
        Row: {
          can_manage: boolean | null
          can_view: boolean | null
          created_at: string
          granted_by: string | null
          id: string
          section_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage?: boolean | null
          can_view?: boolean | null
          created_at?: string
          granted_by?: string | null
          id?: string
          section_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage?: boolean | null
          can_view?: boolean | null
          created_at?: string
          granted_by?: string | null
          id?: string
          section_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_anomaly_reports: {
        Row: {
          ai_analysis: string
          analysis_data: Json
          anomalies_detected: boolean | null
          created_at: string | null
          id: string
        }
        Insert: {
          ai_analysis: string
          analysis_data: Json
          anomalies_detected?: boolean | null
          created_at?: string | null
          id?: string
        }
        Update: {
          ai_analysis?: string
          analysis_data?: Json
          anomalies_detected?: boolean | null
          created_at?: string | null
          id?: string
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
      api_clients: {
        Row: {
          allowed_ips: Json | null
          api_environment: string | null
          client_id: string
          client_name: string
          client_secret_hash: string
          created_at: string | null
          developer_company: string | null
          developer_email: string | null
          developer_use_case: string | null
          expires_at: string | null
          grant_types: Json
          id: string
          institution_id: string | null
          is_active: boolean | null
          last_request_at: string | null
          last_rotated_at: string | null
          monthly_requests_limit: number | null
          rate_limit_tier: string | null
          redirect_uris: Json
          requests_used: number | null
          scopes: Json
          updated_at: string | null
        }
        Insert: {
          allowed_ips?: Json | null
          api_environment?: string | null
          client_id: string
          client_name: string
          client_secret_hash: string
          created_at?: string | null
          developer_company?: string | null
          developer_email?: string | null
          developer_use_case?: string | null
          expires_at?: string | null
          grant_types?: Json
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          last_request_at?: string | null
          last_rotated_at?: string | null
          monthly_requests_limit?: number | null
          rate_limit_tier?: string | null
          redirect_uris?: Json
          requests_used?: number | null
          scopes?: Json
          updated_at?: string | null
        }
        Update: {
          allowed_ips?: Json | null
          api_environment?: string | null
          client_id?: string
          client_name?: string
          client_secret_hash?: string
          created_at?: string | null
          developer_company?: string | null
          developer_email?: string | null
          developer_use_case?: string | null
          expires_at?: string | null
          grant_types?: Json
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          last_request_at?: string | null
          last_rotated_at?: string | null
          monthly_requests_limit?: number | null
          rate_limit_tier?: string | null
          redirect_uris?: Json
          requests_used?: number | null
          scopes?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_clients_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
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
      api_demo_logs: {
        Row: {
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address_hash: string | null
          method: string
          platform: string
          response_time_ms: number | null
          success: boolean
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address_hash?: string | null
          method: string
          platform: string
          response_time_ms?: number | null
          success: boolean
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address_hash?: string | null
          method?: string
          platform?: string
          response_time_ms?: number | null
          success?: boolean
        }
        Relationships: []
      }
      api_health_metrics: {
        Row: {
          checked_at: string
          created_at: string
          error_message: string | null
          id: string
          response_time: number
          status: string
          uptime: number
        }
        Insert: {
          checked_at?: string
          created_at?: string
          error_message?: string | null
          id?: string
          response_time: number
          status: string
          uptime: number
        }
        Update: {
          checked_at?: string
          created_at?: string
          error_message?: string | null
          id?: string
          response_time?: number
          status?: string
          uptime?: number
        }
        Relationships: []
      }
      api_key_notifications: {
        Row: {
          api_client_id: string | null
          email_sent_to: string
          id: string
          notification_type: string
          sent_at: string | null
        }
        Insert: {
          api_client_id?: string | null
          email_sent_to: string
          id?: string
          notification_type: string
          sent_at?: string | null
        }
        Update: {
          api_client_id?: string | null
          email_sent_to?: string
          id?: string
          notification_type?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_notifications_api_client_id_fkey"
            columns: ["api_client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      api_test_requests: {
        Row: {
          client_id: string
          created_at: string | null
          endpoint: string
          id: string
          institution_id: string
          method: string
          request_body: Json | null
          request_headers: Json | null
          response_body: Json | null
          response_headers: Json | null
          response_status: number | null
          response_time_ms: number | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          endpoint: string
          id?: string
          institution_id: string
          method: string
          request_body?: Json | null
          request_headers?: Json | null
          response_body?: Json | null
          response_headers?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          institution_id?: string
          method?: string
          request_body?: Json | null
          request_headers?: Json | null
          response_body?: Json | null
          response_headers?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_test_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_metrics: {
        Row: {
          client_id: string
          created_at: string | null
          endpoint: string
          id: string
          institution_id: string | null
          ip_address: unknown
          method: string
          response_time_ms: number | null
          status_code: number
          user_agent: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          endpoint: string
          id?: string
          institution_id?: string | null
          ip_address?: unknown
          method: string
          response_time_ms?: number | null
          status_code: number
          user_agent?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          institution_id?: string | null
          ip_address?: unknown
          method?: string
          response_time_ms?: number | null
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_metrics_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          institution_id: string | null
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          institution_id?: string | null
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          institution_id?: string | null
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          device_fingerprint: string | null
          entity_id: string
          entity_type: string
          geolocation: Json | null
          id: string
          ip_address: string | null
          performed_by: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          device_fingerprint?: string | null
          entity_id: string
          entity_type: string
          geolocation?: Json | null
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          device_fingerprint?: string | null
          entity_id?: string
          entity_type?: string
          geolocation?: Json | null
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      auth_page_config: {
        Row: {
          config_key: string
          config_type: string
          config_value: string
          description: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_type?: string
          config_value?: string
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_type?: string
          config_value?: string
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      bank_connections: {
        Row: {
          auth_endpoint: string | null
          auto_reconcile: boolean | null
          bank_code: string
          bank_name: string
          base_url: string | null
          connection_config: Json
          connection_type: string
          created_at: string | null
          file_format: string | null
          host: string | null
          id: string
          institution_id: string
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_status: string | null
          port: number | null
          reconciliation_frequency: string | null
          sync_error_message: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          auth_endpoint?: string | null
          auto_reconcile?: boolean | null
          bank_code: string
          bank_name: string
          base_url?: string | null
          connection_config?: Json
          connection_type: string
          created_at?: string | null
          file_format?: string | null
          host?: string | null
          id?: string
          institution_id: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          port?: number | null
          reconciliation_frequency?: string | null
          sync_error_message?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          auth_endpoint?: string | null
          auto_reconcile?: boolean | null
          bank_code?: string
          bank_name?: string
          base_url?: string | null
          connection_config?: Json
          connection_type?: string
          created_at?: string | null
          file_format?: string | null
          host?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          port?: number | null
          reconciliation_frequency?: string | null
          sync_error_message?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_connection_id: string
          completed_at: string | null
          created_at: string | null
          discrepancies: Json | null
          id: string
          matched_count: number | null
          processed_by: string | null
          reconciliation_date: string
          reconciliation_report: Json | null
          started_at: string | null
          status: string
          total_bank_transactions: number | null
          total_system_transactions: number | null
          unmatched_bank_count: number | null
          unmatched_system_count: number | null
        }
        Insert: {
          bank_connection_id: string
          completed_at?: string | null
          created_at?: string | null
          discrepancies?: Json | null
          id?: string
          matched_count?: number | null
          processed_by?: string | null
          reconciliation_date: string
          reconciliation_report?: Json | null
          started_at?: string | null
          status?: string
          total_bank_transactions?: number | null
          total_system_transactions?: number | null
          unmatched_bank_count?: number | null
          unmatched_system_count?: number | null
        }
        Update: {
          bank_connection_id?: string
          completed_at?: string | null
          created_at?: string | null
          discrepancies?: Json | null
          id?: string
          matched_count?: number | null
          processed_by?: string | null
          reconciliation_date?: string
          reconciliation_report?: Json | null
          started_at?: string | null
          status?: string
          total_bank_transactions?: number | null
          total_system_transactions?: number | null
          unmatched_bank_count?: number | null
          unmatched_system_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_connection_id: string
          closing_balance: number | null
          created_at: string | null
          file_format: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          id: string
          is_processed: boolean | null
          opening_balance: number | null
          processed_at: string | null
          statement_date: string
          statement_period_end: string | null
          statement_period_start: string | null
          total_credits: number | null
          total_debits: number | null
          transaction_count: number | null
        }
        Insert: {
          bank_connection_id: string
          closing_balance?: number | null
          created_at?: string | null
          file_format?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_processed?: boolean | null
          opening_balance?: number | null
          processed_at?: string | null
          statement_date: string
          statement_period_end?: string | null
          statement_period_start?: string | null
          total_credits?: number | null
          total_debits?: number | null
          transaction_count?: number | null
        }
        Update: {
          bank_connection_id?: string
          closing_balance?: number | null
          created_at?: string | null
          file_format?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_processed?: boolean | null
          opening_balance?: number | null
          processed_at?: string | null
          statement_date?: string
          statement_period_end?: string | null
          statement_period_start?: string | null
          total_credits?: number | null
          total_debits?: number | null
          transaction_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transaction_imports: {
        Row: {
          bank_connection_id: string
          completed_at: string | null
          created_at: string | null
          duplicate_records: number | null
          error_details: Json | null
          error_message: string | null
          failed_imports: number | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          id: string
          import_data: Json | null
          imported_by: string | null
          status: string
          successful_imports: number | null
          total_records: number | null
        }
        Insert: {
          bank_connection_id: string
          completed_at?: string | null
          created_at?: string | null
          duplicate_records?: number | null
          error_details?: Json | null
          error_message?: string | null
          failed_imports?: number | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          import_data?: Json | null
          imported_by?: string | null
          status?: string
          successful_imports?: number | null
          total_records?: number | null
        }
        Update: {
          bank_connection_id?: string
          completed_at?: string | null
          created_at?: string | null
          duplicate_records?: number | null
          error_details?: Json | null
          error_message?: string | null
          failed_imports?: number | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          import_data?: Json | null
          imported_by?: string | null
          status?: string
          successful_imports?: number | null
          total_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transaction_imports_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transfer_transactions: {
        Row: {
          account_name: string | null
          account_number: string
          amount: number
          bank_code: string
          bank_name: string
          completed_at: string | null
          created_at: string | null
          currency: string
          error_message: string | null
          facilitated_institution_id: string | null
          flutterwave_ref: string | null
          id: string
          is_kob_facilitated: boolean | null
          kob_fee_amount: number | null
          metadata: Json | null
          narration: string | null
          settlement_id: string | null
          status: string
          transaction_ref: string
          transaction_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          amount: number
          bank_code: string
          bank_name: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          error_message?: string | null
          facilitated_institution_id?: string | null
          flutterwave_ref?: string | null
          id?: string
          is_kob_facilitated?: boolean | null
          kob_fee_amount?: number | null
          metadata?: Json | null
          narration?: string | null
          settlement_id?: string | null
          status?: string
          transaction_ref: string
          transaction_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          amount?: number
          bank_code?: string
          bank_name?: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          error_message?: string | null
          facilitated_institution_id?: string | null
          flutterwave_ref?: string | null
          id?: string
          is_kob_facilitated?: boolean | null
          kob_fee_amount?: number | null
          metadata?: Json | null
          narration?: string | null
          settlement_id?: string | null
          status?: string
          transaction_ref?: string
          transaction_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfer_transactions_facilitated_institution_id_fkey"
            columns: ["facilitated_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfer_transactions_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlement_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          account_id: string
          beneficiary_name: string
          created_at: string | null
          id: string
          identification_scheme: Database["public"]["Enums"]["account_scheme"]
          identification_value: string
          is_active: boolean | null
          reference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          beneficiary_name: string
          created_at?: string | null
          id?: string
          identification_scheme: Database["public"]["Enums"]["account_scheme"]
          identification_value: string
          is_active?: boolean | null
          reference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          beneficiary_name?: string
          created_at?: string | null
          id?: string
          identification_scheme?: Database["public"]["Enums"]["account_scheme"]
          identification_value?: string
          is_active?: boolean | null
          reference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: Json
          branch_code: string
          branch_name: string
          branch_type: string
          created_at: string | null
          email: string | null
          id: string
          institution_id: string
          is_active: boolean | null
          manager_id: string | null
          opening_hours: Json | null
          phone: string | null
          services_offered: string[] | null
          updated_at: string | null
        }
        Insert: {
          address: Json
          branch_code: string
          branch_name: string
          branch_type: string
          created_at?: string | null
          email?: string | null
          id?: string
          institution_id: string
          is_active?: boolean | null
          manager_id?: string | null
          opening_hours?: Json | null
          phone?: string | null
          services_offered?: string[] | null
          updated_at?: string | null
        }
        Update: {
          address?: Json
          branch_code?: string
          branch_name?: string
          branch_type?: string
          created_at?: string | null
          email?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean | null
          manager_id?: string | null
          opening_hours?: Json | null
          phone?: string | null
          services_offered?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_communications: {
        Row: {
          body: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          failed_count: number | null
          id: string
          recipient_filter: Json | null
          sent_count: number | null
          started_at: string | null
          status: string
          subject: string
          template_id: string | null
          total_recipients: number | null
        }
        Insert: {
          body: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          failed_count?: number | null
          id?: string
          recipient_filter?: Json | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          total_recipients?: number | null
        }
        Update: {
          body?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          failed_count?: number | null
          id?: string
          recipient_filter?: Json | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          total_recipients?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_communications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      business_account_signatories: {
        Row: {
          account_id: string
          activated_at: string | null
          created_at: string | null
          daily_transaction_limit: number | null
          id: string
          invited_at: string | null
          invited_by: string | null
          permissions: Json
          requires_approval: boolean | null
          role: string
          single_transaction_limit: number | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          activated_at?: string | null
          created_at?: string | null
          daily_transaction_limit?: number | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          permissions?: Json
          requires_approval?: boolean | null
          role: string
          single_transaction_limit?: number | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          activated_at?: string | null
          created_at?: string | null
          daily_transaction_limit?: number | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          permissions?: Json
          requires_approval?: boolean | null
          role?: string
          single_transaction_limit?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_account_signatories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_kyc: {
        Row: {
          account_id: string | null
          annual_turnover: number | null
          articles_of_association_url: string | null
          bank_statement_url: string | null
          beneficial_owners: Json[] | null
          business_address: Json
          business_description: string | null
          business_name: string
          business_type: string
          created_at: string | null
          directors: Json[] | null
          id: string
          industry: string
          number_of_employees: number | null
          proof_of_address_url: string | null
          registration_authority: string | null
          registration_certificate_url: string | null
          registration_country: string | null
          registration_date: string | null
          registration_number: string
          rejection_reason: string | null
          risk_rating: string | null
          sanctions_screen_date: string | null
          sanctions_screened: boolean | null
          tax_certificate_url: string | null
          tax_id: string | null
          updated_at: string | null
          user_id: string
          vat_number: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_id?: string | null
          annual_turnover?: number | null
          articles_of_association_url?: string | null
          bank_statement_url?: string | null
          beneficial_owners?: Json[] | null
          business_address: Json
          business_description?: string | null
          business_name: string
          business_type: string
          created_at?: string | null
          directors?: Json[] | null
          id?: string
          industry: string
          number_of_employees?: number | null
          proof_of_address_url?: string | null
          registration_authority?: string | null
          registration_certificate_url?: string | null
          registration_country?: string | null
          registration_date?: string | null
          registration_number: string
          rejection_reason?: string | null
          risk_rating?: string | null
          sanctions_screen_date?: string | null
          sanctions_screened?: boolean | null
          tax_certificate_url?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id: string
          vat_number?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_id?: string | null
          annual_turnover?: number | null
          articles_of_association_url?: string | null
          bank_statement_url?: string | null
          beneficial_owners?: Json[] | null
          business_address?: Json
          business_description?: string | null
          business_name?: string
          business_type?: string
          created_at?: string | null
          directors?: Json[] | null
          id?: string
          industry?: string
          number_of_employees?: number | null
          proof_of_address_url?: string | null
          registration_authority?: string | null
          registration_certificate_url?: string | null
          registration_country?: string | null
          registration_date?: string | null
          registration_number?: string
          rejection_reason?: string | null
          risk_rating?: string | null
          sanctions_screen_date?: string | null
          sanctions_screened?: boolean | null
          tax_certificate_url?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id?: string
          vat_number?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_kyc_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      captcha_challenges: {
        Row: {
          attempts: number | null
          challenge_answer: number
          challenge_question: string
          created_at: string | null
          expires_at: string
          id: string
          ip_address: unknown
          max_attempts: number | null
          session_id: string
          status: string | null
          user_agent: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          challenge_answer: number
          challenge_question: string
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown
          max_attempts?: number | null
          session_id: string
          status?: string | null
          user_agent?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          challenge_answer?: number
          challenge_question?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          max_attempts?: number | null
          session_id?: string
          status?: string | null
          user_agent?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      card_funding_transactions: {
        Row: {
          amount_source_currency: number
          amount_usd: number
          conversion_fee: number | null
          created_at: string | null
          error_message: string | null
          exchange_rate: number
          exchange_rate_source: string
          id: string
          processed_at: string | null
          source_account_id: string | null
          source_currency: string
          status: Database["public"]["Enums"]["card_funding_status"] | null
          stripe_funding_id: string | null
          transaction_ref: string
          user_id: string
          virtual_card_id: string
        }
        Insert: {
          amount_source_currency: number
          amount_usd: number
          conversion_fee?: number | null
          created_at?: string | null
          error_message?: string | null
          exchange_rate: number
          exchange_rate_source: string
          id?: string
          processed_at?: string | null
          source_account_id?: string | null
          source_currency: string
          status?: Database["public"]["Enums"]["card_funding_status"] | null
          stripe_funding_id?: string | null
          transaction_ref: string
          user_id: string
          virtual_card_id: string
        }
        Update: {
          amount_source_currency?: number
          amount_usd?: number
          conversion_fee?: number | null
          created_at?: string | null
          error_message?: string | null
          exchange_rate?: number
          exchange_rate_source?: string
          id?: string
          processed_at?: string | null
          source_account_id?: string | null
          source_currency?: string
          status?: Database["public"]["Enums"]["card_funding_status"] | null
          stripe_funding_id?: string | null
          transaction_ref?: string
          user_id?: string
          virtual_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_funding_transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_funding_transactions_virtual_card_id_fkey"
            columns: ["virtual_card_id"]
            isOneToOne: false
            referencedRelation: "virtual_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_payment_transactions: {
        Row: {
          amount: number
          card_brand: string | null
          card_country: string | null
          card_last4: string | null
          completed_at: string | null
          created_at: string | null
          currency: string
          customer_email: string | null
          customer_name: string | null
          description: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          transaction_ref: string
          transaction_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          card_brand?: string | null
          card_country?: string | null
          card_last4?: string | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_ref: string
          transaction_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          card_brand?: string | null
          card_country?: string | null
          card_last4?: string | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_ref?: string
          transaction_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      card_transactions: {
        Row: {
          amount_usd: number
          created_at: string | null
          decline_reason: string | null
          id: string
          merchant_category: string | null
          merchant_country: string | null
          merchant_name: string | null
          metadata: Json | null
          status: string | null
          stripe_authorization_id: string | null
          stripe_transaction_id: string | null
          transaction_type:
            | Database["public"]["Enums"]["card_transaction_type"]
            | null
          user_id: string
          virtual_card_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string | null
          decline_reason?: string | null
          id?: string
          merchant_category?: string | null
          merchant_country?: string | null
          merchant_name?: string | null
          metadata?: Json | null
          status?: string | null
          stripe_authorization_id?: string | null
          stripe_transaction_id?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["card_transaction_type"]
            | null
          user_id: string
          virtual_card_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string | null
          decline_reason?: string | null
          id?: string
          merchant_category?: string | null
          merchant_country?: string | null
          merchant_name?: string | null
          metadata?: Json | null
          status?: string | null
          stripe_authorization_id?: string | null
          stripe_transaction_id?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["card_transaction_type"]
            | null
          user_id?: string
          virtual_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_transactions_virtual_card_id_fkey"
            columns: ["virtual_card_id"]
            isOneToOne: false
            referencedRelation: "virtual_cards"
            referencedColumns: ["id"]
          },
        ]
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
          last_used_at: string | null
          revocation_reason: string | null
          revoked_at: string | null
          serial_number: string | null
          subject_dn: string
          thumbprint: string | null
          tpp_registration_id: string | null
          updated_at: string | null
          usage_count: number | null
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
          last_used_at?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          serial_number?: string | null
          subject_dn: string
          thumbprint?: string | null
          tpp_registration_id?: string | null
          updated_at?: string | null
          usage_count?: number | null
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
          last_used_at?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          serial_number?: string | null
          subject_dn?: string
          thumbprint?: string | null
          tpp_registration_id?: string | null
          updated_at?: string | null
          usage_count?: number | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_certificates_tpp_registration_id_fkey"
            columns: ["tpp_registration_id"]
            isOneToOne: false
            referencedRelation: "tpp_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          body: string
          communication_type: Database["public"]["Enums"]["template_type"]
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          recipient_type: string
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
        }
        Insert: {
          body: string
          communication_type: Database["public"]["Enums"]["template_type"]
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          body?: string
          communication_type?: Database["public"]["Enums"]["template_type"]
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          body: string
          category: Database["public"]["Enums"]["template_category"]
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          subject: string | null
          template_key: string
          template_type: Database["public"]["Enums"]["template_type"]
          updated_at: string | null
          updated_by: string | null
          variables: Json | null
        }
        Insert: {
          body: string
          category: Database["public"]["Enums"]["template_category"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          subject?: string | null
          template_key: string
          template_type: Database["public"]["Enums"]["template_type"]
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string
          category?: Database["public"]["Enums"]["template_category"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          subject?: string | null
          template_key?: string
          template_type?: Database["public"]["Enums"]["template_type"]
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      compliance_reports: {
        Row: {
          active_consents: number | null
          created_at: string | null
          generated_by: string | null
          id: string
          report_data: Json | null
          report_period_end: string
          report_period_start: string
          report_type: string
          revoked_consents: number | null
          total_api_calls: number | null
          total_consents: number | null
          total_payments: number | null
          total_transactions: number | null
          unique_tpps: number | null
          unique_users: number | null
        }
        Insert: {
          active_consents?: number | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          report_data?: Json | null
          report_period_end: string
          report_period_start: string
          report_type: string
          revoked_consents?: number | null
          total_api_calls?: number | null
          total_consents?: number | null
          total_payments?: number | null
          total_transactions?: number | null
          unique_tpps?: number | null
          unique_users?: number | null
        }
        Update: {
          active_consents?: number | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          report_data?: Json | null
          report_period_end?: string
          report_period_start?: string
          report_type?: string
          revoked_consents?: number | null
          total_api_calls?: number | null
          total_consents?: number | null
          total_payments?: number | null
          total_transactions?: number | null
          unique_tpps?: number | null
          unique_users?: number | null
        }
        Relationships: []
      }
      compliance_training: {
        Row: {
          certificate_url: string | null
          completed_at: string | null
          completion_status: string | null
          created_at: string | null
          expiry_date: string | null
          id: string
          passing_score: number | null
          renewal_period_months: number | null
          renewal_required: boolean | null
          required_for_role: string[] | null
          score: number | null
          started_at: string | null
          training_description: string | null
          training_title: string
          training_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          certificate_url?: string | null
          completed_at?: string | null
          completion_status?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          passing_score?: number | null
          renewal_period_months?: number | null
          renewal_required?: boolean | null
          required_for_role?: string[] | null
          score?: number | null
          started_at?: string | null
          training_description?: string | null
          training_title: string
          training_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          certificate_url?: string | null
          completed_at?: string | null
          completion_status?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          passing_score?: number | null
          renewal_period_months?: number | null
          renewal_required?: boolean | null
          required_for_role?: string[] | null
          score?: number | null
          started_at?: string | null
          training_description?: string | null
          training_title?: string
          training_type?: string
          updated_at?: string | null
          user_id?: string
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
          ip_address: unknown
          ip_address_hash: string | null
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
          ip_address?: unknown
          ip_address_hash?: string | null
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
          ip_address?: unknown
          ip_address_hash?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crediq_action_plans: {
        Row: {
          action_description: string
          action_title: string
          action_type: string
          completed_at: string | null
          created_at: string | null
          due_date: string | null
          estimated_impact: number | null
          id: string
          priority: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_description: string
          action_title: string
          action_type: string
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          estimated_impact?: number | null
          id?: string
          priority?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_description?: string
          action_title?: string
          action_type?: string
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          estimated_impact?: number | null
          id?: string
          priority?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crediq_email_preferences: {
        Row: {
          goal_achievement_alerts: boolean | null
          marketing_emails: boolean | null
          monthly_report: boolean | null
          product_recommendations: boolean | null
          score_change_alerts: boolean | null
          tips_recommendations: boolean | null
          updated_at: string | null
          user_id: string
          weekly_digest: boolean | null
        }
        Insert: {
          goal_achievement_alerts?: boolean | null
          marketing_emails?: boolean | null
          monthly_report?: boolean | null
          product_recommendations?: boolean | null
          score_change_alerts?: boolean | null
          tips_recommendations?: boolean | null
          updated_at?: string | null
          user_id: string
          weekly_digest?: boolean | null
        }
        Update: {
          goal_achievement_alerts?: boolean | null
          marketing_emails?: boolean | null
          monthly_report?: boolean | null
          product_recommendations?: boolean | null
          score_change_alerts?: boolean | null
          tips_recommendations?: boolean | null
          updated_at?: string | null
          user_id?: string
          weekly_digest?: boolean | null
        }
        Relationships: []
      }
      crediq_health_metrics: {
        Row: {
          account_diversity: string
          account_diversity_score: number
          calculated_at: string | null
          created_at: string | null
          credit_score_id: string | null
          credit_utilization_percentage: number | null
          credit_utilization_score: number
          debt_management: string
          debt_management_score: number
          financial_stability: string
          financial_stability_score: number
          id: string
          overall_health_score: number
          payment_reliability: string
          payment_reliability_score: number
          priority_actions: Json | null
          suggested_actions: Json | null
          user_id: string
        }
        Insert: {
          account_diversity: string
          account_diversity_score: number
          calculated_at?: string | null
          created_at?: string | null
          credit_score_id?: string | null
          credit_utilization_percentage?: number | null
          credit_utilization_score: number
          debt_management: string
          debt_management_score: number
          financial_stability: string
          financial_stability_score: number
          id?: string
          overall_health_score: number
          payment_reliability: string
          payment_reliability_score: number
          priority_actions?: Json | null
          suggested_actions?: Json | null
          user_id: string
        }
        Update: {
          account_diversity?: string
          account_diversity_score?: number
          calculated_at?: string | null
          created_at?: string | null
          credit_score_id?: string | null
          credit_utilization_percentage?: number | null
          credit_utilization_score?: number
          debt_management?: string
          debt_management_score?: number
          financial_stability?: string
          financial_stability_score?: number
          id?: string
          overall_health_score?: number
          payment_reliability?: string
          payment_reliability_score?: number
          priority_actions?: Json | null
          suggested_actions?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crediq_health_metrics_credit_score_id_fkey"
            columns: ["credit_score_id"]
            isOneToOne: false
            referencedRelation: "credit_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      crediq_product_recommendations: {
        Row: {
          created_at: string | null
          eligibility_score: number | null
          estimated_apr: number | null
          expires_at: string | null
          id: string
          key_benefits: Json | null
          product_name: string
          product_type: string
          provider_institution_id: string | null
          recommendation_reason: string | null
          recommended_at: string | null
          requirements: Json | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          eligibility_score?: number | null
          estimated_apr?: number | null
          expires_at?: string | null
          id?: string
          key_benefits?: Json | null
          product_name: string
          product_type: string
          provider_institution_id?: string | null
          recommendation_reason?: string | null
          recommended_at?: string | null
          requirements?: Json | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          eligibility_score?: number | null
          estimated_apr?: number | null
          expires_at?: string | null
          id?: string
          key_benefits?: Json | null
          product_name?: string
          product_type?: string
          provider_institution_id?: string | null
          recommendation_reason?: string | null
          recommended_at?: string | null
          requirements?: Json | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crediq_product_recommendations_provider_institution_id_fkey"
            columns: ["provider_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      crediq_questionnaire_responses: {
        Row: {
          answer_label: string | null
          answer_value: string
          answered_at: string | null
          id: string
          profile_id: string | null
          question_id: string
          question_step: number | null
          question_text: string
          user_id: string
        }
        Insert: {
          answer_label?: string | null
          answer_value: string
          answered_at?: string | null
          id?: string
          profile_id?: string | null
          question_id: string
          question_step?: number | null
          question_text: string
          user_id: string
        }
        Update: {
          answer_label?: string | null
          answer_value?: string
          answered_at?: string | null
          id?: string
          profile_id?: string | null
          question_id?: string
          question_step?: number | null
          question_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crediq_questionnaire_responses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "crediq_user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crediq_user_profiles: {
        Row: {
          average_monthly_savings_range: string | null
          baseline_score_generated: boolean | null
          completed_at: string | null
          created_at: string | null
          digital_banking_frequency: string | null
          employment_status: string
          has_bank_account: boolean | null
          has_defaulted_loans: boolean | null
          has_dependents: boolean | null
          has_existing_loans: boolean | null
          has_previous_loans: boolean | null
          has_smartphone: boolean | null
          id: string
          income_stability: string | null
          loan_payment_history: string | null
          monthly_income_range: string
          monthly_loan_obligations_range: string | null
          number_of_dependents: number | null
          primary_financial_goal: string | null
          questionnaire_version: string | null
          target_loan_amount_range: string | null
          updated_at: string | null
          user_id: string
          uses_digital_payments: boolean | null
          uses_mobile_money: boolean | null
        }
        Insert: {
          average_monthly_savings_range?: string | null
          baseline_score_generated?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          digital_banking_frequency?: string | null
          employment_status: string
          has_bank_account?: boolean | null
          has_defaulted_loans?: boolean | null
          has_dependents?: boolean | null
          has_existing_loans?: boolean | null
          has_previous_loans?: boolean | null
          has_smartphone?: boolean | null
          id?: string
          income_stability?: string | null
          loan_payment_history?: string | null
          monthly_income_range: string
          monthly_loan_obligations_range?: string | null
          number_of_dependents?: number | null
          primary_financial_goal?: string | null
          questionnaire_version?: string | null
          target_loan_amount_range?: string | null
          updated_at?: string | null
          user_id: string
          uses_digital_payments?: boolean | null
          uses_mobile_money?: boolean | null
        }
        Update: {
          average_monthly_savings_range?: string | null
          baseline_score_generated?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          digital_banking_frequency?: string | null
          employment_status?: string
          has_bank_account?: boolean | null
          has_defaulted_loans?: boolean | null
          has_dependents?: boolean | null
          has_existing_loans?: boolean | null
          has_previous_loans?: boolean | null
          has_smartphone?: boolean | null
          id?: string
          income_stability?: string | null
          loan_payment_history?: string | null
          monthly_income_range?: string
          monthly_loan_obligations_range?: string | null
          number_of_dependents?: number | null
          primary_financial_goal?: string | null
          questionnaire_version?: string | null
          target_loan_amount_range?: string | null
          updated_at?: string | null
          user_id?: string
          uses_digital_payments?: boolean | null
          uses_mobile_money?: boolean | null
        }
        Relationships: []
      }
      credit_api_access_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          institution_id: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          institution_id: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_api_access_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_api_clients: {
        Row: {
          allowed_operations: string[] | null
          api_key: string
          api_secret_hash: string
          audit_logging_enabled: boolean | null
          client_name: string
          client_type: string
          cost_per_query: number | null
          created_at: string | null
          created_by: string | null
          data_retention_days: number | null
          id: string
          institution_id: string | null
          is_active: boolean | null
          is_sandbox: boolean | null
          last_query_at: string | null
          pricing_tier: string | null
          rate_limit_per_day: number | null
          rate_limit_per_minute: number | null
          total_queries: number | null
          updated_at: string | null
        }
        Insert: {
          allowed_operations?: string[] | null
          api_key: string
          api_secret_hash: string
          audit_logging_enabled?: boolean | null
          client_name: string
          client_type: string
          cost_per_query?: number | null
          created_at?: string | null
          created_by?: string | null
          data_retention_days?: number | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          is_sandbox?: boolean | null
          last_query_at?: string | null
          pricing_tier?: string | null
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          total_queries?: number | null
          updated_at?: string | null
        }
        Update: {
          allowed_operations?: string[] | null
          api_key?: string
          api_secret_hash?: string
          audit_logging_enabled?: boolean | null
          client_name?: string
          client_type?: string
          cost_per_query?: number | null
          created_at?: string | null
          created_by?: string | null
          data_retention_days?: number | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          is_sandbox?: boolean | null
          last_query_at?: string | null
          pricing_tier?: string | null
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          total_queries?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_api_clients_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_api_usage_logs: {
        Row: {
          billed_amount: number | null
          client_id: string
          created_at: string | null
          id: string
          ip_address: unknown
          operation_type: string
          report_id: string | null
          request_payload: Json | null
          response_status: number | null
          response_time_ms: number | null
          score_returned: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          billed_amount?: number | null
          client_id: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          operation_type: string
          report_id?: string | null
          request_payload?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          score_returned?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          billed_amount?: number | null
          client_id?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          operation_type?: string
          report_id?: string | null
          request_payload?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          score_returned?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_api_usage_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "credit_api_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_api_usage_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "credit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_goals: {
        Row: {
          achieved_at: string | null
          created_at: string
          current_score: number
          deadline: string | null
          id: string
          is_active: boolean | null
          milestone_alerts: Json | null
          target_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string
          current_score: number
          deadline?: string | null
          id?: string
          is_active?: boolean | null
          milestone_alerts?: Json | null
          target_score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          created_at?: string
          current_score?: number
          deadline?: string | null
          id?: string
          is_active?: boolean | null
          milestone_alerts?: Json | null
          target_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_inquiries: {
        Row: {
          consent_reference: string | null
          created_at: string | null
          id: string
          inquirer_id: string | null
          inquirer_name: string
          inquirer_type: string
          inquiry_date: string | null
          inquiry_type: string
          ip_address: unknown
          purpose: string
          report_id: string | null
          report_provided: boolean | null
          score_provided: number | null
          user_agent: string | null
          user_consent_given: boolean | null
          user_id: string
        }
        Insert: {
          consent_reference?: string | null
          created_at?: string | null
          id?: string
          inquirer_id?: string | null
          inquirer_name: string
          inquirer_type: string
          inquiry_date?: string | null
          inquiry_type: string
          ip_address?: unknown
          purpose: string
          report_id?: string | null
          report_provided?: boolean | null
          score_provided?: number | null
          user_agent?: string | null
          user_consent_given?: boolean | null
          user_id: string
        }
        Update: {
          consent_reference?: string | null
          created_at?: string | null
          id?: string
          inquirer_id?: string | null
          inquirer_name?: string
          inquirer_type?: string
          inquiry_date?: string | null
          inquiry_type?: string
          ip_address?: unknown
          purpose?: string
          report_id?: string | null
          report_provided?: boolean | null
          score_provided?: number | null
          user_agent?: string | null
          user_consent_given?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_inquiries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "credit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_monitoring_alerts: {
        Row: {
          alert_data: Json | null
          alert_type: string
          created_at: string | null
          description: string | null
          id: string
          read_at: string | null
          severity: string
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          alert_data?: Json | null
          alert_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          read_at?: string | null
          severity: string
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          alert_data?: Json | null
          alert_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          read_at?: string | null
          severity?: string
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_reports: {
        Row: {
          active_accounts: number | null
          active_loans: number | null
          average_monthly_savings: number | null
          bankruptcies: number | null
          closed_accounts: number | null
          collections: number | null
          completed_loans: number | null
          created_at: string | null
          credit_score_id: string | null
          credit_utilization_ratio: number | null
          defaulted_loans: number | null
          employment_verified: boolean | null
          external_report_data: Json | null
          external_report_fetched_at: string | null
          generated_at: string | null
          generated_by: string | null
          hard_inquiries_12m: number | null
          hard_inquiries_6m: number | null
          id: string
          income_verified: boolean | null
          judgments: number | null
          late_payments_30_days: number | null
          late_payments_60_days: number | null
          late_payments_90_days: number | null
          liens: number | null
          missed_payments: number | null
          on_time_payment_rate: number | null
          personal_info_verified: boolean | null
          purpose: string | null
          report_file_url: string | null
          report_type: string
          requested_by: string | null
          requester_id: string | null
          savings_consistency_score: number | null
          soft_inquiries_total: number | null
          total_accounts: number | null
          total_balance: number | null
          total_borrowed: number | null
          total_credit_limit: number | null
          total_loans: number | null
          total_payments_made: number | null
          total_repaid: number | null
          total_savings_accounts: number | null
          total_savings_balance: number | null
          user_id: string
        }
        Insert: {
          active_accounts?: number | null
          active_loans?: number | null
          average_monthly_savings?: number | null
          bankruptcies?: number | null
          closed_accounts?: number | null
          collections?: number | null
          completed_loans?: number | null
          created_at?: string | null
          credit_score_id?: string | null
          credit_utilization_ratio?: number | null
          defaulted_loans?: number | null
          employment_verified?: boolean | null
          external_report_data?: Json | null
          external_report_fetched_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          hard_inquiries_12m?: number | null
          hard_inquiries_6m?: number | null
          id?: string
          income_verified?: boolean | null
          judgments?: number | null
          late_payments_30_days?: number | null
          late_payments_60_days?: number | null
          late_payments_90_days?: number | null
          liens?: number | null
          missed_payments?: number | null
          on_time_payment_rate?: number | null
          personal_info_verified?: boolean | null
          purpose?: string | null
          report_file_url?: string | null
          report_type: string
          requested_by?: string | null
          requester_id?: string | null
          savings_consistency_score?: number | null
          soft_inquiries_total?: number | null
          total_accounts?: number | null
          total_balance?: number | null
          total_borrowed?: number | null
          total_credit_limit?: number | null
          total_loans?: number | null
          total_payments_made?: number | null
          total_repaid?: number | null
          total_savings_accounts?: number | null
          total_savings_balance?: number | null
          user_id: string
        }
        Update: {
          active_accounts?: number | null
          active_loans?: number | null
          average_monthly_savings?: number | null
          bankruptcies?: number | null
          closed_accounts?: number | null
          collections?: number | null
          completed_loans?: number | null
          created_at?: string | null
          credit_score_id?: string | null
          credit_utilization_ratio?: number | null
          defaulted_loans?: number | null
          employment_verified?: boolean | null
          external_report_data?: Json | null
          external_report_fetched_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          hard_inquiries_12m?: number | null
          hard_inquiries_6m?: number | null
          id?: string
          income_verified?: boolean | null
          judgments?: number | null
          late_payments_30_days?: number | null
          late_payments_60_days?: number | null
          late_payments_90_days?: number | null
          liens?: number | null
          missed_payments?: number | null
          on_time_payment_rate?: number | null
          personal_info_verified?: boolean | null
          purpose?: string | null
          report_file_url?: string | null
          report_type?: string
          requested_by?: string | null
          requester_id?: string | null
          savings_consistency_score?: number | null
          soft_inquiries_total?: number | null
          total_accounts?: number | null
          total_balance?: number | null
          total_borrowed?: number | null
          total_credit_limit?: number | null
          total_loans?: number | null
          total_payments_made?: number | null
          total_repaid?: number | null
          total_savings_accounts?: number | null
          total_savings_balance?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_reports_credit_score_id_fkey"
            columns: ["credit_score_id"]
            isOneToOne: false
            referencedRelation: "credit_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_score_history: {
        Row: {
          change_reason: string | null
          credit_score_id: string | null
          id: string
          recorded_at: string | null
          score: number
          score_change: number | null
          significant_events: Json | null
          user_id: string
        }
        Insert: {
          change_reason?: string | null
          credit_score_id?: string | null
          id?: string
          recorded_at?: string | null
          score: number
          score_change?: number | null
          significant_events?: Json | null
          user_id: string
        }
        Update: {
          change_reason?: string | null
          credit_score_id?: string | null
          id?: string
          recorded_at?: string | null
          score?: number
          score_change?: number | null
          significant_events?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_score_history_credit_score_id_fkey"
            columns: ["credit_score_id"]
            isOneToOne: false
            referencedRelation: "credit_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_score_simulations: {
        Row: {
          created_at: string
          current_score: number
          id: string
          input_parameters: Json
          predicted_score: number
          score_change: number
          simulation_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_score: number
          id?: string
          input_parameters: Json
          predicted_score: number
          score_change: number
          simulation_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_score?: number
          id?: string
          input_parameters?: Json
          predicted_score?: number
          score_change?: number
          simulation_type?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_score_tips: {
        Row: {
          completed_at: string | null
          created_at: string
          credit_score_id: string | null
          estimated_impact: number | null
          expires_at: string
          generated_at: string
          id: string
          is_completed: boolean | null
          priority: string
          tip_category: string
          tip_content: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credit_score_id?: string | null
          estimated_impact?: number | null
          expires_at?: string
          generated_at?: string
          id?: string
          is_completed?: boolean | null
          priority: string
          tip_category: string
          tip_content: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credit_score_id?: string | null
          estimated_impact?: number | null
          expires_at?: string
          generated_at?: string
          id?: string
          is_completed?: boolean | null
          priority?: string
          tip_category?: string
          tip_content?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_score_tips_credit_score_id_fkey"
            columns: ["credit_score_id"]
            isOneToOne: false
            referencedRelation: "credit_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_scores: {
        Row: {
          amounts_owed_score: number | null
          calculated_at: string | null
          confidence_level: number | null
          created_at: string | null
          credit_history_length_score: number | null
          credit_mix_score: number | null
          expires_at: string | null
          external_bureau_name: string | null
          external_bureau_score: number | null
          external_score_fetched_at: string | null
          id: string
          kyc_compliance_score: number | null
          new_credit_score: number | null
          next_update_date: string | null
          payment_history_score: number | null
          postiq_verification_score: number | null
          savings_behavior_score: number | null
          score: number
          score_factors: Json
          score_version: string | null
          scoring_model: string
          status: string | null
          transaction_pattern_score: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amounts_owed_score?: number | null
          calculated_at?: string | null
          confidence_level?: number | null
          created_at?: string | null
          credit_history_length_score?: number | null
          credit_mix_score?: number | null
          expires_at?: string | null
          external_bureau_name?: string | null
          external_bureau_score?: number | null
          external_score_fetched_at?: string | null
          id?: string
          kyc_compliance_score?: number | null
          new_credit_score?: number | null
          next_update_date?: string | null
          payment_history_score?: number | null
          postiq_verification_score?: number | null
          savings_behavior_score?: number | null
          score: number
          score_factors: Json
          score_version?: string | null
          scoring_model: string
          status?: string | null
          transaction_pattern_score?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amounts_owed_score?: number | null
          calculated_at?: string | null
          confidence_level?: number | null
          created_at?: string | null
          credit_history_length_score?: number | null
          credit_mix_score?: number | null
          expires_at?: string | null
          external_bureau_name?: string | null
          external_bureau_score?: number | null
          external_score_fetched_at?: string | null
          id?: string
          kyc_compliance_score?: number | null
          new_credit_score?: number | null
          next_update_date?: string | null
          payment_history_score?: number | null
          postiq_verification_score?: number | null
          savings_behavior_score?: number | null
          score?: number
          score_factors?: Json
          score_version?: string | null
          scoring_model?: string
          status?: string | null
          transaction_pattern_score?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customer_due_diligence: {
        Row: {
          beneficial_owners: Json | null
          business_nature: string | null
          country_of_residence: string | null
          created_at: string | null
          estimated_annual_income: number | null
          expected_transaction_volume: number | null
          id: string
          last_screening_date: string | null
          next_review_date: string | null
          occupation: string | null
          pep_details: Json | null
          pep_status: boolean | null
          purpose_of_account: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_category: string
          risk_factors: Json | null
          risk_score: number | null
          sanctions_screening_status: string | null
          source_of_income: string | null
          tax_residency: string[] | null
          tin: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          beneficial_owners?: Json | null
          business_nature?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          estimated_annual_income?: number | null
          expected_transaction_volume?: number | null
          id?: string
          last_screening_date?: string | null
          next_review_date?: string | null
          occupation?: string | null
          pep_details?: Json | null
          pep_status?: boolean | null
          purpose_of_account?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_category?: string
          risk_factors?: Json | null
          risk_score?: number | null
          sanctions_screening_status?: string | null
          source_of_income?: string | null
          tax_residency?: string[] | null
          tin?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          beneficial_owners?: Json | null
          business_nature?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          estimated_annual_income?: number | null
          expected_transaction_volume?: number | null
          id?: string
          last_screening_date?: string | null
          next_review_date?: string | null
          occupation?: string | null
          pep_details?: Json | null
          pep_status?: boolean | null
          purpose_of_account?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_category?: string
          risk_factors?: Json | null
          risk_score?: number | null
          sanctions_screening_status?: string | null
          source_of_income?: string | null
          tax_residency?: string[] | null
          tin?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dashboard_widgets: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_visible: boolean
          position: number
          size: string
          updated_at: string | null
          user_id: string
          widget_type: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean
          position?: number
          size?: string
          updated_at?: string | null
          user_id: string
          widget_type: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean
          position?: number
          size?: string
          updated_at?: string | null
          user_id?: string
          widget_type?: string
        }
        Relationships: []
      }
      data_privacy_requests: {
        Row: {
          completion_deadline: string | null
          created_at: string | null
          data_categories: string[] | null
          export_format: string | null
          export_url: string | null
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          request_details: Json | null
          request_type: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completion_deadline?: string | null
          created_at?: string | null
          data_categories?: string[] | null
          export_format?: string | null
          export_url?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          request_details?: Json | null
          request_type: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completion_deadline?: string | null
          created_at?: string | null
          data_categories?: string[] | null
          export_format?: string | null
          export_url?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          request_details?: Json | null
          request_type?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      developer_resources: {
        Row: {
          created_at: string | null
          description: string | null
          downloads_count: number | null
          github_url: string | null
          id: string
          is_active: boolean | null
          language: string | null
          npm_package: string | null
          resource_type: string
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          downloads_count?: number | null
          github_url?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          npm_package?: string | null
          resource_type: string
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          downloads_count?: number | null
          github_url?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          npm_package?: string | null
          resource_type?: string
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      developer_sandbox_accounts: {
        Row: {
          company_name: string
          created_at: string
          description: string | null
          id: string
          status: string
          tier: string
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      direct_debits: {
        Row: {
          account_id: string
          created_at: string | null
          currency: string
          direct_debit_id: string
          direct_debit_status: string
          id: string
          identification_scheme: string | null
          identification_value: string | null
          mandate_identification: string
          name: string
          previous_payment_amount: number | null
          previous_payment_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          currency?: string
          direct_debit_id: string
          direct_debit_status?: string
          id?: string
          identification_scheme?: string | null
          identification_value?: string | null
          mandate_identification: string
          name: string
          previous_payment_amount?: number | null
          previous_payment_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          currency?: string
          direct_debit_id?: string
          direct_debit_status?: string
          id?: string
          identification_scheme?: string | null
          identification_value?: string | null
          mandate_identification?: string
          name?: string
          previous_payment_amount?: number | null
          previous_payment_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_debits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          dispute_type: string
          evidence_urls: string[] | null
          id: string
          institution_id: string | null
          metadata: Json | null
          payment_id: string | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          transaction_ref: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          dispute_type?: string
          evidence_urls?: string[] | null
          id?: string
          institution_id?: string | null
          metadata?: Json | null
          payment_id?: string | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          dispute_type?: string
          evidence_urls?: string[] | null
          id?: string
          institution_id?: string | null
          metadata?: Json | null
          payment_id?: string | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          name: string
          send_count: number | null
          subject: string
          template_key: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          name: string
          send_count?: number | null
          subject: string
          template_key: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          name?: string
          send_count?: number | null
          subject?: string
          template_key?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      enterprise_leads: {
        Row: {
          assigned_to: string | null
          budget_range: string | null
          company_name: string
          company_size: string
          created_at: string
          current_systems: string | null
          email: string
          id: string
          inquiry_type: string
          integration_timeline: string
          ip_address_hash: string | null
          name: string
          notes: string | null
          phone: string | null
          preferred_contact: string
          priority: string
          requirements: string
          source_page: string | null
          status: string
          transaction_volume: string
          updated_at: string
          use_cases: string[]
          user_agent: string | null
        }
        Insert: {
          assigned_to?: string | null
          budget_range?: string | null
          company_name: string
          company_size: string
          created_at?: string
          current_systems?: string | null
          email: string
          id?: string
          inquiry_type: string
          integration_timeline: string
          ip_address_hash?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          preferred_contact: string
          priority?: string
          requirements: string
          source_page?: string | null
          status?: string
          transaction_volume: string
          updated_at?: string
          use_cases: string[]
          user_agent?: string | null
        }
        Update: {
          assigned_to?: string | null
          budget_range?: string | null
          company_name?: string
          company_size?: string
          created_at?: string
          current_systems?: string | null
          email?: string
          id?: string
          inquiry_type?: string
          integration_timeline?: string
          ip_address_hash?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_contact?: string
          priority?: string
          requirements?: string
          source_page?: string | null
          status?: string
          transaction_volume?: string
          updated_at?: string
          use_cases?: string[]
          user_agent?: string | null
        }
        Relationships: []
      }
      exchange_rates_cache: {
        Row: {
          base_currency: string
          created_at: string | null
          id: string
          rate: number
          rate_source: string
          target_currency: string
          valid_until: string
        }
        Insert: {
          base_currency: string
          created_at?: string | null
          id?: string
          rate: number
          rate_source: string
          target_currency: string
          valid_until: string
        }
        Update: {
          base_currency?: string
          created_at?: string | null
          id?: string
          rate?: number
          rate_source?: string
          target_currency?: string
          valid_until?: string
        }
        Relationships: []
      }
      external_credit_data_cache: {
        Row: {
          bureau_name: string
          created_at: string | null
          data_type: string
          expires_at: string | null
          fetched_at: string | null
          id: string
          is_stale: boolean | null
          parsed_data: Json | null
          raw_data: Json
          user_id: string
        }
        Insert: {
          bureau_name: string
          created_at?: string | null
          data_type: string
          expires_at?: string | null
          fetched_at?: string | null
          id?: string
          is_stale?: boolean | null
          parsed_data?: Json | null
          raw_data: Json
          user_id: string
        }
        Update: {
          bureau_name?: string
          created_at?: string | null
          data_type?: string
          expires_at?: string | null
          fetched_at?: string | null
          id?: string
          is_stale?: boolean | null
          parsed_data?: Json | null
          raw_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      failed_login_attempts: {
        Row: {
          attempt_count: number | null
          blocked_until: string | null
          created_at: string | null
          email: string
          failure_reason: string | null
          id: string
          ip_address: unknown
          last_attempt_at: string | null
          user_agent: string | null
        }
        Insert: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          email: string
          failure_reason?: string | null
          id?: string
          ip_address: unknown
          last_attempt_at?: string | null
          user_agent?: string | null
        }
        Update: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          last_attempt_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      fee_structures: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_until: string | null
          fee_model: string
          fixed_amount: number | null
          id: string
          institution_id: string
          is_active: boolean | null
          max_fee_amount: number | null
          min_fee_amount: number | null
          percentage_rate: number | null
          tiered_rates: Json | null
          transaction_type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          fee_model: string
          fixed_amount?: number | null
          id?: string
          institution_id: string
          is_active?: boolean | null
          max_fee_amount?: number | null
          min_fee_amount?: number | null
          percentage_rate?: number | null
          tiered_rates?: Json | null
          transaction_type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          fee_model?: string
          fixed_amount?: number | null
          id?: string
          institution_id?: string
          is_active?: boolean | null
          max_fee_amount?: number | null
          min_fee_amount?: number | null
          percentage_rate?: number | null
          tiered_rates?: Json | null
          transaction_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_waivers: {
        Row: {
          applies_to_transaction_types: string[] | null
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          discount_fixed_amount: number | null
          discount_percentage: number | null
          effective_from: string
          effective_until: string
          id: string
          institution_id: string
          is_active: boolean | null
          max_uses: number | null
          reason: string
          waiver_type: string
        }
        Insert: {
          applies_to_transaction_types?: string[] | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_fixed_amount?: number | null
          discount_percentage?: number | null
          effective_from?: string
          effective_until: string
          id?: string
          institution_id: string
          is_active?: boolean | null
          max_uses?: number | null
          reason: string
          waiver_type: string
        }
        Update: {
          applies_to_transaction_types?: string[] | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_fixed_amount?: number | null
          discount_percentage?: number | null
          effective_from?: string
          effective_until?: string
          id?: string
          institution_id?: string
          is_active?: boolean | null
          max_uses?: number | null
          reason?: string
          waiver_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_waivers_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_rules: {
        Row: {
          action: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          rule_name: string
          rule_type: string
          severity: string
          trigger_count: number | null
          updated_at: string
        }
        Insert: {
          action?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          rule_name: string
          rule_type?: string
          severity?: string
          trigger_count?: number | null
          updated_at?: string
        }
        Update: {
          action?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          rule_name?: string
          rule_type?: string
          severity?: string
          trigger_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      funding_events: {
        Row: {
          created_at: string | null
          event_type: string
          funding_intent_id: string
          id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          funding_intent_id: string
          id?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          funding_intent_id?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_events_funding_intent_id_fkey"
            columns: ["funding_intent_id"]
            isOneToOne: false
            referencedRelation: "funding_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_intents: {
        Row: {
          account_id: string | null
          amount: number
          api_client_id: string | null
          created_at: string | null
          currency: string
          expires_at: string | null
          failure_code: string | null
          failure_message: string | null
          fee_amount: number | null
          funding_scope: string
          id: string
          idempotency_key: string | null
          institution_id: string | null
          merchant_id: string | null
          metadata: Json | null
          method: string
          net_amount: number | null
          next_action: Json | null
          provider: string
          provider_payload: Json | null
          provider_reference: string | null
          reference: string | null
          return_url: string | null
          status: string
          target_description: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          api_client_id?: string | null
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          fee_amount?: number | null
          funding_scope?: string
          id?: string
          idempotency_key?: string | null
          institution_id?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          method: string
          net_amount?: number | null
          next_action?: Json | null
          provider: string
          provider_payload?: Json | null
          provider_reference?: string | null
          reference?: string | null
          return_url?: string | null
          status?: string
          target_description?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          api_client_id?: string | null
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          fee_amount?: number | null
          funding_scope?: string
          id?: string
          idempotency_key?: string | null
          institution_id?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          method?: string
          net_amount?: number | null
          next_action?: Json | null
          provider?: string
          provider_payload?: Json | null
          provider_reference?: string | null
          reference?: string | null
          return_url?: string | null
          status?: string
          target_description?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_intents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_intents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_intents_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_beneficiaries: {
        Row: {
          account_number: string | null
          bank_code: string | null
          bank_name: string | null
          channel: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          merchant_id: string
          metadata: Json | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          channel?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          merchant_id: string
          metadata?: Json | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          channel?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          merchant_id?: string
          metadata?: Json | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_beneficiaries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_charge_events: {
        Row: {
          charge_id: string
          created_at: string
          details: Json | null
          event_type: string
          id: string
        }
        Insert: {
          charge_id: string
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          charge_id?: string
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_charge_events_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "gateway_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_charge_splits: {
        Row: {
          charge_id: string
          created_at: string
          id: string
          split_amount: number
          split_type: string
          split_value: number
          subaccount_id: string
        }
        Insert: {
          charge_id: string
          created_at?: string
          id?: string
          split_amount: number
          split_type: string
          split_value: number
          subaccount_id: string
        }
        Update: {
          charge_id?: string
          created_at?: string
          id?: string
          split_amount?: number
          split_type?: string
          split_value?: number
          subaccount_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_charge_splits_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "gateway_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_charge_splits_subaccount_id_fkey"
            columns: ["subaccount_id"]
            isOneToOne: false
            referencedRelation: "gateway_subaccounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_charges: {
        Row: {
          amount: number
          capture_mode: string
          captured_amount: number | null
          channel: string
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          exchange_rate: number | null
          failure_reason: string | null
          fee_amount: number | null
          id: string
          idempotency_key: string | null
          merchant_id: string
          metadata: Json | null
          net_amount: number | null
          payment_link_id: string | null
          provider: string
          provider_raw: Json | null
          provider_ref: string | null
          settled_amount: number | null
          settlement_currency: string | null
          status: string
          subscription_id: string | null
          tx_ref: string
          updated_at: string
        }
        Insert: {
          amount: number
          capture_mode?: string
          captured_amount?: number | null
          channel: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          exchange_rate?: number | null
          failure_reason?: string | null
          fee_amount?: number | null
          id?: string
          idempotency_key?: string | null
          merchant_id: string
          metadata?: Json | null
          net_amount?: number | null
          payment_link_id?: string | null
          provider: string
          provider_raw?: Json | null
          provider_ref?: string | null
          settled_amount?: number | null
          settlement_currency?: string | null
          status?: string
          subscription_id?: string | null
          tx_ref: string
          updated_at?: string
        }
        Update: {
          amount?: number
          capture_mode?: string
          captured_amount?: number | null
          channel?: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          exchange_rate?: number | null
          failure_reason?: string | null
          fee_amount?: number | null
          id?: string
          idempotency_key?: string | null
          merchant_id?: string
          metadata?: Json | null
          net_amount?: number | null
          payment_link_id?: string | null
          provider?: string
          provider_raw?: Json | null
          provider_ref?: string | null
          settled_amount?: number | null
          settlement_currency?: string | null
          status?: string
          subscription_id?: string | null
          tx_ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_charges_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_charges_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "gateway_payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_charges_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "gateway_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_customer_tokens: {
        Row: {
          channel: string
          created_at: string
          customer_id: string
          expiry: string | null
          id: string
          is_active: boolean
          last4: string | null
          metadata: Json | null
          provider: string
          token_ref: string
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id: string
          expiry?: string | null
          id?: string
          is_active?: boolean
          last4?: string | null
          metadata?: Json | null
          provider: string
          token_ref: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string
          expiry?: string | null
          id?: string
          is_active?: boolean
          last4?: string | null
          metadata?: Json | null
          provider?: string
          token_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_customer_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "gateway_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_customers: {
        Row: {
          created_at: string
          email: string
          id: string
          merchant_id: string
          metadata: Json | null
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          merchant_id: string
          metadata?: Json | null
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          merchant_id?: string
          metadata?: Json | null
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_customers_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_disputes: {
        Row: {
          amount: number
          charge_id: string
          created_at: string
          currency: string
          evidence_data: Json | null
          evidence_due_by: string | null
          evidence_submitted: boolean | null
          id: string
          merchant_id: string
          provider: string
          provider_raw: Json | null
          provider_ref: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          charge_id: string
          created_at?: string
          currency?: string
          evidence_data?: Json | null
          evidence_due_by?: string | null
          evidence_submitted?: boolean | null
          id?: string
          merchant_id: string
          provider: string
          provider_raw?: Json | null
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_id?: string
          created_at?: string
          currency?: string
          evidence_data?: Json | null
          evidence_due_by?: string | null
          evidence_submitted?: boolean | null
          id?: string
          merchant_id?: string
          provider?: string
          provider_raw?: Json | null
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_disputes_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "gateway_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_disputes_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_merchant_api_keys: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string | null
          environment: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          last_used_at: string | null
          merchant_id: string
          updated_at: string | null
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_used_at?: string | null
          merchant_id: string
          updated_at?: string | null
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_used_at?: string | null
          merchant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_merchant_api_keys_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_merchant_settlement_accounts: {
        Row: {
          account_name: string | null
          account_number: string
          account_type: string
          bank_code: string | null
          bank_name: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          is_default: boolean
          merchant_id: string
          metadata: Json | null
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          account_type?: string
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          merchant_id: string
          metadata?: Json | null
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          account_type?: string
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          merchant_id?: string
          metadata?: Json | null
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_merchant_settlement_accounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_merchant_wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          id: string
          ledger_balance: number
          merchant_id: string
          pending_balance: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          ledger_balance?: number
          merchant_id: string
          pending_balance?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          ledger_balance?: number
          merchant_id?: string
          pending_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_merchant_wallets_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_merchant_webhooks: {
        Row: {
          created_at: string
          disabled_at: string | null
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          label: string | null
          merchant_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          label?: string | null
          merchant_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          label?: string | null
          merchant_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_merchant_webhooks_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_merchants: {
        Row: {
          business_email: string | null
          business_name: string
          business_phone: string | null
          created_at: string
          daily_charge_limit: number | null
          daily_payout_limit: number | null
          environment: string
          fee_bearer: string
          id: string
          institution_id: string | null
          kyb_status: string
          metadata: Json | null
          monthly_volume_limit: number | null
          single_charge_limit: number | null
          status: string
          updated_at: string
          user_id: string
          velocity_max_charges: number | null
          velocity_window_minutes: number | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          business_email?: string | null
          business_name: string
          business_phone?: string | null
          created_at?: string
          daily_charge_limit?: number | null
          daily_payout_limit?: number | null
          environment?: string
          fee_bearer?: string
          id?: string
          institution_id?: string | null
          kyb_status?: string
          metadata?: Json | null
          monthly_volume_limit?: number | null
          single_charge_limit?: number | null
          status?: string
          updated_at?: string
          user_id: string
          velocity_max_charges?: number | null
          velocity_window_minutes?: number | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          business_email?: string | null
          business_name?: string
          business_phone?: string | null
          created_at?: string
          daily_charge_limit?: number | null
          daily_payout_limit?: number | null
          environment?: string
          fee_bearer?: string
          id?: string
          institution_id?: string | null
          kyb_status?: string
          metadata?: Json | null
          monthly_volume_limit?: number | null
          single_charge_limit?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          velocity_max_charges?: number | null
          velocity_window_minutes?: number | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_merchants_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_payment_links: {
        Row: {
          amount: number
          created_at: string
          currency: string
          custom_fields: Json | null
          description: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          merchant_id: string
          metadata: Json | null
          redirect_url: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          use_count: number
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          custom_fields?: Json | null
          description?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          merchant_id: string
          metadata?: Json | null
          redirect_url?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          custom_fields?: Json | null
          description?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          merchant_id?: string
          metadata?: Json | null
          redirect_url?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "gateway_payment_links_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_payment_plans: {
        Row: {
          amount: number
          created_at: string
          currency: string
          duration: number | null
          id: string
          interval: string
          interval_count: number
          is_active: boolean
          merchant_id: string
          metadata: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          duration?: number | null
          id?: string
          interval?: string
          interval_count?: number
          is_active?: boolean
          merchant_id: string
          metadata?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          duration?: number | null
          id?: string
          interval?: string
          interval_count?: number
          is_active?: boolean
          merchant_id?: string
          metadata?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_payment_plans_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_payout_batches: {
        Row: {
          completed_count: number | null
          created_at: string
          currency: string
          failed_count: number | null
          id: string
          idempotency_key: string | null
          item_count: number
          merchant_id: string
          metadata: Json | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          completed_count?: number | null
          created_at?: string
          currency?: string
          failed_count?: number | null
          id?: string
          idempotency_key?: string | null
          item_count?: number
          merchant_id: string
          metadata?: Json | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          completed_count?: number | null
          created_at?: string
          currency?: string
          failed_count?: number | null
          id?: string
          idempotency_key?: string | null
          item_count?: number
          merchant_id?: string
          metadata?: Json | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_payout_batches_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_payouts: {
        Row: {
          amount: number
          batch_id: string | null
          beneficiary_account: string | null
          beneficiary_bank: string | null
          beneficiary_name: string | null
          beneficiary_phone: string | null
          channel: string
          created_at: string
          currency: string
          failure_reason: string | null
          fee_amount: number | null
          id: string
          idempotency_key: string | null
          merchant_id: string
          metadata: Json | null
          narration: string | null
          provider: string
          provider_raw: Json | null
          provider_ref: string | null
          status: string
          tx_ref: string
          updated_at: string
        }
        Insert: {
          amount: number
          batch_id?: string | null
          beneficiary_account?: string | null
          beneficiary_bank?: string | null
          beneficiary_name?: string | null
          beneficiary_phone?: string | null
          channel: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          fee_amount?: number | null
          id?: string
          idempotency_key?: string | null
          merchant_id: string
          metadata?: Json | null
          narration?: string | null
          provider: string
          provider_raw?: Json | null
          provider_ref?: string | null
          status?: string
          tx_ref: string
          updated_at?: string
        }
        Update: {
          amount?: number
          batch_id?: string | null
          beneficiary_account?: string | null
          beneficiary_bank?: string | null
          beneficiary_name?: string | null
          beneficiary_phone?: string | null
          channel?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          fee_amount?: number | null
          id?: string
          idempotency_key?: string | null
          merchant_id?: string
          metadata?: Json | null
          narration?: string | null
          provider?: string
          provider_raw?: Json | null
          provider_ref?: string | null
          status?: string
          tx_ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_payouts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "gateway_payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_payouts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_reconciliation_mismatches: {
        Row: {
          created_at: string
          id: string
          internal_value: string | null
          mismatch_type: string
          object_id: string
          object_type: string
          provider_value: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_value?: string | null
          mismatch_type: string
          object_id: string
          object_type: string
          provider_value?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_value?: string | null
          mismatch_type?: string
          object_id?: string
          object_type?: string
          provider_value?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_reconciliation_mismatches_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "gateway_reconciliation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_reconciliation_runs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          initiated_by: string | null
          matched: number | null
          merchant_id: string | null
          mismatched: number | null
          period_end: string
          period_start: string
          provider: string | null
          started_at: string | null
          status: string
          summary: Json | null
          total_internal: number | null
          total_provider: number | null
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          initiated_by?: string | null
          matched?: number | null
          merchant_id?: string | null
          mismatched?: number | null
          period_end: string
          period_start: string
          provider?: string | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          total_internal?: number | null
          total_provider?: number | null
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          initiated_by?: string | null
          matched?: number | null
          merchant_id?: string | null
          mismatched?: number | null
          period_end?: string
          period_start?: string
          provider?: string | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          total_internal?: number | null
          total_provider?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_reconciliation_runs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_refunds: {
        Row: {
          amount: number
          charge_id: string
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          merchant_id: string
          provider: string
          provider_raw: Json | null
          provider_ref: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          charge_id: string
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          merchant_id: string
          provider: string
          provider_raw?: Json | null
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_id?: string
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          merchant_id?: string
          provider?: string
          provider_raw?: Json | null
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_refunds_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "gateway_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_refunds_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_settlements: {
        Row: {
          amount: number
          charges_count: number | null
          created_at: string
          currency: string
          fees_total: number | null
          id: string
          merchant_id: string
          metadata: Json | null
          net_amount: number | null
          payout_ref: string | null
          period_end: string
          period_start: string
          settled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          charges_count?: number | null
          created_at?: string
          currency?: string
          fees_total?: number | null
          id?: string
          merchant_id: string
          metadata?: Json | null
          net_amount?: number | null
          payout_ref?: string | null
          period_end: string
          period_start: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          charges_count?: number | null
          created_at?: string
          currency?: string
          fees_total?: number | null
          id?: string
          merchant_id?: string
          metadata?: Json | null
          net_amount?: number | null
          payout_ref?: string | null
          period_end?: string
          period_start?: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_settlements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_subaccounts: {
        Row: {
          account_number: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          merchant_id: string
          metadata: Json | null
          settlement_bank: string | null
          split_type: string
          split_value: number
          subaccount_name: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          merchant_id: string
          metadata?: Json | null
          settlement_bank?: string | null
          split_type?: string
          split_value: number
          subaccount_name: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          merchant_id?: string
          metadata?: Json | null
          settlement_bank?: string | null
          split_type?: string
          split_value?: number
          subaccount_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_subaccounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_subscriptions: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          charges_made: number
          created_at: string
          customer_email: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          last_charge_id: string | null
          merchant_id: string
          metadata: Json | null
          next_charge_at: string
          plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          charges_made?: number
          created_at?: string
          customer_email: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_charge_id?: string | null
          merchant_id: string
          metadata?: Json | null
          next_charge_at: string
          plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          charges_made?: number
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_charge_id?: string | null
          merchant_id?: string
          metadata?: Json | null
          next_charge_at?: string
          plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "gateway_payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_virtual_accounts: {
        Row: {
          account_number: string | null
          bank_name: string | null
          bvn: string | null
          created_at: string
          currency: string
          email: string | null
          expiry: string | null
          id: string
          merchant_id: string
          metadata: Json | null
          provider_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          bvn?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          expiry?: string | null
          id?: string
          merchant_id: string
          metadata?: Json | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          bvn?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          expiry?: string | null
          id?: string
          merchant_id?: string
          metadata?: Json | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_virtual_accounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_webhook_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          merchant_id: string
          next_retry_at: string | null
          payload: Json
          response_body_snippet: string | null
          response_code: number | null
          status: string
          webhook_id: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          merchant_id: string
          next_retry_at?: string | null
          payload?: Json
          response_body_snippet?: string | null
          response_code?: number | null
          status?: string
          webhook_id?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          merchant_id?: string
          next_retry_at?: string | null
          payload?: Json
          response_body_snippet?: string | null
          response_code?: number | null
          status?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_webhook_deliveries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchant_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_webhook_events: {
        Row: {
          attempts: number | null
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          last_response_body: string | null
          last_response_code: number | null
          max_attempts: number | null
          merchant_id: string
          next_retry_at: string | null
          payload: Json
          status: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          delivered_at?: string | null
          event_type: string
          id?: string
          last_response_body?: string | null
          last_response_code?: number | null
          max_attempts?: number | null
          merchant_id: string
          next_retry_at?: string | null
          payload: Json
          status?: string
        }
        Update: {
          attempts?: number | null
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          last_response_body?: string | null
          last_response_code?: number | null
          max_attempts?: number | null
          merchant_id?: string
          next_retry_at?: string | null
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_webhook_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "gateway_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          client_id: string
          created_at: string
          endpoint: string
          expires_at: string
          id: string
          idempotency_key: string
          payload_hash: string
          response_body: Json | null
          response_status: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          endpoint: string
          expires_at?: string
          id?: string
          idempotency_key: string
          payload_hash: string
          response_body?: Json | null
          response_status?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          endpoint?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          payload_hash?: string
          response_body?: Json | null
          response_status?: number | null
        }
        Relationships: []
      }
      incident_logs: {
        Row: {
          affected_services: string[] | null
          assigned_to: string | null
          created_at: string | null
          description: string | null
          id: string
          incident_type: string
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          affected_services?: string[] | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          incident_type: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          affected_services?: string[] | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          incident_type?: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      institution_invoices: {
        Row: {
          admin_notes: string | null
          billing_cycle: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          due_date: string
          id: string
          institution_id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          pdf_url: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          status: string | null
          subtotal_amount: number
          tax_amount: number | null
          total_amount: number
          total_transactions: number
          total_waivers: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          billing_cycle: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date: string
          id?: string
          institution_id: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          status?: string | null
          subtotal_amount?: number
          tax_amount?: number | null
          total_amount: number
          total_transactions?: number
          total_waivers?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          billing_cycle?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date?: string
          id?: string
          institution_id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          status?: string | null
          subtotal_amount?: number
          tax_amount?: number | null
          total_amount?: number
          total_transactions?: number
          total_waivers?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_invoices_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_verification_steps: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          institution_id: string
          metadata: Json | null
          notes: string | null
          status: string
          step_name: string
          step_type: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          institution_id: string
          metadata?: Json | null
          notes?: string | null
          status?: string
          step_name: string
          step_type: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          institution_id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string
          step_name?: string
          step_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_verification_steps_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_walkthroughs: {
        Row: {
          bg_color: string | null
          created_at: string | null
          description: string
          icon_name: string | null
          id: string
          institution_id: string
          media_type: string
          media_url: string | null
          slide_order: number
          text_color: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          bg_color?: string | null
          created_at?: string | null
          description: string
          icon_name?: string | null
          id?: string
          institution_id: string
          media_type?: string
          media_url?: string | null
          slide_order?: number
          text_color?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          bg_color?: string | null
          created_at?: string | null
          description?: string
          icon_name?: string | null
          id?: string
          institution_id?: string
          media_type?: string
          media_url?: string | null
          slide_order?: number
          text_color?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_walkthroughs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          address: string
          app_config: Json | null
          approved_at: string | null
          approved_by: string | null
          country: string
          created_at: string
          id: string
          institution_name: string
          institution_type: Database["public"]["Enums"]["institution_type"]
          kob_payment_fee_structure_id: string | null
          kyb_submission_id: string | null
          kyb_verified_at: string | null
          kyb_verified_by: string | null
          logo_url: string | null
          main_branch_id: string | null
          minimum_settlement_amount: number | null
          phone: string
          primary_color: string | null
          registration_number: string
          rejection_reason: string | null
          sandbox_access: boolean | null
          sandbox_credentials: Json | null
          settlement_bank_account: Json | null
          settlement_frequency: string | null
          status: Database["public"]["Enums"]["institution_status"]
          tagline: string | null
          updated_at: string
          use_kob_flutterwave: boolean | null
          user_id: string
          verification_step: string | null
          website: string | null
        }
        Insert: {
          address: string
          app_config?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          country?: string
          created_at?: string
          id?: string
          institution_name: string
          institution_type: Database["public"]["Enums"]["institution_type"]
          kob_payment_fee_structure_id?: string | null
          kyb_submission_id?: string | null
          kyb_verified_at?: string | null
          kyb_verified_by?: string | null
          logo_url?: string | null
          main_branch_id?: string | null
          minimum_settlement_amount?: number | null
          phone: string
          primary_color?: string | null
          registration_number: string
          rejection_reason?: string | null
          sandbox_access?: boolean | null
          sandbox_credentials?: Json | null
          settlement_bank_account?: Json | null
          settlement_frequency?: string | null
          status?: Database["public"]["Enums"]["institution_status"]
          tagline?: string | null
          updated_at?: string
          use_kob_flutterwave?: boolean | null
          user_id: string
          verification_step?: string | null
          website?: string | null
        }
        Update: {
          address?: string
          app_config?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          country?: string
          created_at?: string
          id?: string
          institution_name?: string
          institution_type?: Database["public"]["Enums"]["institution_type"]
          kob_payment_fee_structure_id?: string | null
          kyb_submission_id?: string | null
          kyb_verified_at?: string | null
          kyb_verified_by?: string | null
          logo_url?: string | null
          main_branch_id?: string | null
          minimum_settlement_amount?: number | null
          phone?: string
          primary_color?: string | null
          registration_number?: string
          rejection_reason?: string | null
          sandbox_access?: boolean | null
          sandbox_credentials?: Json | null
          settlement_bank_account?: Json | null
          settlement_frequency?: string | null
          status?: Database["public"]["Enums"]["institution_status"]
          tagline?: string | null
          updated_at?: string
          use_kob_flutterwave?: boolean | null
          user_id?: string
          verification_step?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutions_kob_payment_fee_structure_id_fkey"
            columns: ["kob_payment_fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutions_kyb_submission_id_fkey"
            columns: ["kyb_submission_id"]
            isOneToOne: false
            referencedRelation: "business_kyc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutions_main_branch_id_fkey"
            columns: ["main_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_accruals: {
        Row: {
          accrual_date: string
          accrued_amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          interest_rate: number
          journal_entry_id: string | null
          savings_account_id: string
        }
        Insert: {
          accrual_date: string
          accrued_amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          interest_rate: number
          journal_entry_id?: string | null
          savings_account_id: string
        }
        Update: {
          accrual_date?: string
          accrued_amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          interest_rate?: number
          journal_entry_id?: string | null
          savings_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interest_accruals_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interest_accruals_savings_account_id_fkey"
            columns: ["savings_account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      iso20022_account_statements: {
        Row: {
          account_currency: string
          account_iban: string
          account_number: string
          closing_balance: number
          created_at: string | null
          id: string
          message_id: string | null
          number_of_entries: number | null
          opening_balance: number
          statement_date: string
          statement_id: string
          total_credit_entries: number | null
          total_debit_entries: number | null
          updated_at: string | null
        }
        Insert: {
          account_currency: string
          account_iban: string
          account_number: string
          closing_balance: number
          created_at?: string | null
          id?: string
          message_id?: string | null
          number_of_entries?: number | null
          opening_balance: number
          statement_date: string
          statement_id: string
          total_credit_entries?: number | null
          total_debit_entries?: number | null
          updated_at?: string | null
        }
        Update: {
          account_currency?: string
          account_iban?: string
          account_number?: string
          closing_balance?: number
          created_at?: string | null
          id?: string
          message_id?: string | null
          number_of_entries?: number | null
          opening_balance?: number
          statement_date?: string
          statement_id?: string
          total_credit_entries?: number | null
          total_debit_entries?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iso20022_account_statements_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "iso20022_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      iso20022_credit_transfers: {
        Row: {
          amount: number
          category_purpose_code: string | null
          charge_bearer: string | null
          created_at: string | null
          creditor_account: string
          creditor_agent_bic: string | null
          creditor_bic: string | null
          creditor_iban: string | null
          creditor_name: string
          currency: string
          end_to_end_id: string
          id: string
          instruction_id: string | null
          message_id: string | null
          payment_id: string
          payment_instruction_id: string | null
          purpose_code: string | null
          remittance_information: string | null
          status: string | null
          status_reason: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category_purpose_code?: string | null
          charge_bearer?: string | null
          created_at?: string | null
          creditor_account: string
          creditor_agent_bic?: string | null
          creditor_bic?: string | null
          creditor_iban?: string | null
          creditor_name: string
          currency: string
          end_to_end_id: string
          id?: string
          instruction_id?: string | null
          message_id?: string | null
          payment_id: string
          payment_instruction_id?: string | null
          purpose_code?: string | null
          remittance_information?: string | null
          status?: string | null
          status_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category_purpose_code?: string | null
          charge_bearer?: string | null
          created_at?: string | null
          creditor_account?: string
          creditor_agent_bic?: string | null
          creditor_bic?: string | null
          creditor_iban?: string | null
          creditor_name?: string
          currency?: string
          end_to_end_id?: string
          id?: string
          instruction_id?: string | null
          message_id?: string | null
          payment_id?: string
          payment_instruction_id?: string | null
          purpose_code?: string | null
          remittance_information?: string | null
          status?: string | null
          status_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iso20022_credit_transfers_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "iso20022_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iso20022_credit_transfers_payment_instruction_id_fkey"
            columns: ["payment_instruction_id"]
            isOneToOne: false
            referencedRelation: "iso20022_payment_instructions"
            referencedColumns: ["id"]
          },
        ]
      }
      iso20022_messages: {
        Row: {
          amount: number | null
          business_message_id: string | null
          created_at: string | null
          creation_date_time: string
          creditor_account: string | null
          creditor_iban: string | null
          creditor_name: string | null
          currency: string | null
          debtor_account: string | null
          debtor_iban: string | null
          debtor_name: string | null
          direction: string
          end_to_end_id: string | null
          id: string
          instruction_id: string | null
          message_id: string
          message_type: string
          message_version: string
          parsed_data: Json
          payment_reference: string | null
          processing_errors: Json | null
          raw_xml: string
          received_at: string | null
          related_message_id: string | null
          sent_at: string | null
          status: string
          transaction_id: string | null
          updated_at: string | null
          validation_errors: Json | null
        }
        Insert: {
          amount?: number | null
          business_message_id?: string | null
          created_at?: string | null
          creation_date_time: string
          creditor_account?: string | null
          creditor_iban?: string | null
          creditor_name?: string | null
          currency?: string | null
          debtor_account?: string | null
          debtor_iban?: string | null
          debtor_name?: string | null
          direction: string
          end_to_end_id?: string | null
          id?: string
          instruction_id?: string | null
          message_id: string
          message_type: string
          message_version: string
          parsed_data: Json
          payment_reference?: string | null
          processing_errors?: Json | null
          raw_xml: string
          received_at?: string | null
          related_message_id?: string | null
          sent_at?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
          validation_errors?: Json | null
        }
        Update: {
          amount?: number | null
          business_message_id?: string | null
          created_at?: string | null
          creation_date_time?: string
          creditor_account?: string | null
          creditor_iban?: string | null
          creditor_name?: string | null
          currency?: string | null
          debtor_account?: string | null
          debtor_iban?: string | null
          debtor_name?: string | null
          direction?: string
          end_to_end_id?: string | null
          id?: string
          instruction_id?: string | null
          message_id?: string
          message_type?: string
          message_version?: string
          parsed_data?: Json
          payment_reference?: string | null
          processing_errors?: Json | null
          raw_xml?: string
          received_at?: string | null
          related_message_id?: string | null
          sent_at?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
          validation_errors?: Json | null
        }
        Relationships: []
      }
      iso20022_payment_instructions: {
        Row: {
          batch_booking: boolean | null
          charge_bearer: string | null
          created_at: string | null
          debtor_account: string
          debtor_agent_bic: string | null
          debtor_bic: string | null
          debtor_iban: string | null
          debtor_name: string
          id: string
          message_id: string | null
          number_of_transactions: number
          payment_information_id: string
          payment_method: string
          requested_execution_date: string | null
          total_interbank_settlement_amount: number
          total_interbank_settlement_currency: string
          updated_at: string | null
        }
        Insert: {
          batch_booking?: boolean | null
          charge_bearer?: string | null
          created_at?: string | null
          debtor_account: string
          debtor_agent_bic?: string | null
          debtor_bic?: string | null
          debtor_iban?: string | null
          debtor_name: string
          id?: string
          message_id?: string | null
          number_of_transactions: number
          payment_information_id: string
          payment_method: string
          requested_execution_date?: string | null
          total_interbank_settlement_amount: number
          total_interbank_settlement_currency: string
          updated_at?: string | null
        }
        Update: {
          batch_booking?: boolean | null
          charge_bearer?: string | null
          created_at?: string | null
          debtor_account?: string
          debtor_agent_bic?: string | null
          debtor_bic?: string | null
          debtor_iban?: string | null
          debtor_name?: string
          id?: string
          message_id?: string | null
          number_of_transactions?: number
          payment_information_id?: string
          payment_method?: string
          requested_execution_date?: string | null
          total_interbank_settlement_amount?: number
          total_interbank_settlement_currency?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iso20022_payment_instructions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "iso20022_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      iso20022_statement_entries: {
        Row: {
          account_servicer_reference: string | null
          amount: number
          booking_date: string | null
          created_at: string | null
          credit_debit_indicator: string
          creditor_account: string | null
          creditor_name: string | null
          currency: string
          debtor_account: string | null
          debtor_name: string | null
          end_to_end_id: string | null
          entry_reference: string | null
          id: string
          mandate_id: string | null
          remittance_information: string | null
          statement_id: string | null
          status: string
          transaction_id: string | null
          updated_at: string | null
          value_date: string | null
        }
        Insert: {
          account_servicer_reference?: string | null
          amount: number
          booking_date?: string | null
          created_at?: string | null
          credit_debit_indicator: string
          creditor_account?: string | null
          creditor_name?: string | null
          currency: string
          debtor_account?: string | null
          debtor_name?: string | null
          end_to_end_id?: string | null
          entry_reference?: string | null
          id?: string
          mandate_id?: string | null
          remittance_information?: string | null
          statement_id?: string | null
          status: string
          transaction_id?: string | null
          updated_at?: string | null
          value_date?: string | null
        }
        Update: {
          account_servicer_reference?: string | null
          amount?: number
          booking_date?: string | null
          created_at?: string | null
          credit_debit_indicator?: string
          creditor_account?: string | null
          creditor_name?: string | null
          currency?: string
          debtor_account?: string | null
          debtor_name?: string | null
          end_to_end_id?: string | null
          entry_reference?: string | null
          id?: string
          mandate_id?: string | null
          remittance_information?: string | null
          statement_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iso20022_statement_entries_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "iso20022_account_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          description: string
          entry_date: string
          entry_number: string
          id: string
          institution_id: string | null
          is_reversed: boolean
          metadata: Json | null
          posted_by: string | null
          reference_id: string | null
          reference_type: string | null
          reversal_of: string | null
        }
        Insert: {
          created_at?: string
          description: string
          entry_date?: string
          entry_number: string
          id?: string
          institution_id?: string | null
          is_reversed?: boolean
          metadata?: Json | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          entry_date?: string
          entry_number?: string
          id?: string
          institution_id?: string | null
          is_reversed?: boolean
          metadata?: Json | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          ledger_account_id: string
        }
        Insert: {
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          ledger_account_id: string
        }
        Update: {
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          ledger_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      jwt_secrets: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          secret_hash: string
          secret_version: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          secret_hash: string
          secret_version: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          secret_hash?: string
          secret_version?: string
        }
        Relationships: []
      }
      kyc_verifications: {
        Row: {
          created_at: string | null
          document_back_url: string | null
          document_country: string | null
          document_expiry_date: string | null
          document_front_url: string | null
          document_number: string | null
          document_type: string | null
          expiry_date: string | null
          id: string
          metadata: Json | null
          rejection_reason: string | null
          risk_level: string | null
          selfie_url: string | null
          status: string
          updated_at: string | null
          user_id: string
          verification_method: string | null
          verification_type: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_back_url?: string | null
          document_country?: string | null
          document_expiry_date?: string | null
          document_front_url?: string | null
          document_number?: string | null
          document_type?: string | null
          expiry_date?: string | null
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          risk_level?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          verification_method?: string | null
          verification_type: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_back_url?: string | null
          document_country?: string | null
          document_expiry_date?: string | null
          document_front_url?: string | null
          document_number?: string | null
          document_type?: string | null
          expiry_date?: string | null
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          risk_level?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          verification_method?: string | null
          verification_type?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      ledger_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          balance: number
          created_at: string
          currency: string
          description: string | null
          id: string
          institution_id: string | null
          is_active: boolean
          parent_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          balance?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean
          parent_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          balance?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean
          parent_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      load_test_results: {
        Row: {
          concurrent_requests: number
          created_at: string | null
          duration_seconds: number
          endpoint: string
          id: string
          results: Json
        }
        Insert: {
          concurrent_requests: number
          created_at?: string | null
          duration_seconds: number
          endpoint: string
          id?: string
          results: Json
        }
        Update: {
          concurrent_requests?: number
          created_at?: string | null
          duration_seconds?: number
          endpoint?: string
          id?: string
          results?: Json
        }
        Relationships: []
      }
      loan_accounts: {
        Row: {
          account_id: string | null
          amount_disbursed: number
          amount_repaid: number
          application_id: string
          completed_at: string | null
          created_at: string | null
          days_overdue: number | null
          defaulted_at: string | null
          disbursed_at: string | null
          final_repayment_date: string | null
          first_repayment_date: string | null
          id: string
          interest_rate: number
          loan_account_number: string
          loan_product_id: string
          next_payment_amount: number | null
          next_payment_date: string | null
          outstanding_balance: number
          penalty_charges: number | null
          principal_amount: number
          processing_fee: number
          repayment_frequency: Database["public"]["Enums"]["repayment_frequency"]
          status: Database["public"]["Enums"]["loan_status"]
          tenure_months: number
          total_interest: number
          total_payable: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount_disbursed?: number
          amount_repaid?: number
          application_id: string
          completed_at?: string | null
          created_at?: string | null
          days_overdue?: number | null
          defaulted_at?: string | null
          disbursed_at?: string | null
          final_repayment_date?: string | null
          first_repayment_date?: string | null
          id?: string
          interest_rate: number
          loan_account_number: string
          loan_product_id: string
          next_payment_amount?: number | null
          next_payment_date?: string | null
          outstanding_balance?: number
          penalty_charges?: number | null
          principal_amount: number
          processing_fee?: number
          repayment_frequency: Database["public"]["Enums"]["repayment_frequency"]
          status?: Database["public"]["Enums"]["loan_status"]
          tenure_months: number
          total_interest?: number
          total_payable: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount_disbursed?: number
          amount_repaid?: number
          application_id?: string
          completed_at?: string | null
          created_at?: string | null
          days_overdue?: number | null
          defaulted_at?: string | null
          disbursed_at?: string | null
          final_repayment_date?: string | null
          first_repayment_date?: string | null
          id?: string
          interest_rate?: number
          loan_account_number?: string
          loan_product_id?: string
          next_payment_amount?: number | null
          next_payment_date?: string | null
          outstanding_balance?: number
          penalty_charges?: number | null
          principal_amount?: number
          processing_fee?: number
          repayment_frequency?: Database["public"]["Enums"]["repayment_frequency"]
          status?: Database["public"]["Enums"]["loan_status"]
          tenure_months?: number
          total_interest?: number
          total_payable?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_accounts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_accounts_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          application_number: string
          approved_at: string | null
          auto_decision: string | null
          collateral_details: Json | null
          created_at: string | null
          credit_report_id: string | null
          credit_score: number | null
          employment_details: Json | null
          guarantors: Json | null
          id: string
          loan_product_id: string
          purpose: string
          recommended_amount: number | null
          rejection_reason: string | null
          repayment_frequency: Database["public"]["Enums"]["repayment_frequency"]
          requested_amount: number
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          risk_assessment: Json | null
          status: Database["public"]["Enums"]["loan_status"]
          submitted_at: string | null
          supporting_documents: Json | null
          tenure_months: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          application_number: string
          approved_at?: string | null
          auto_decision?: string | null
          collateral_details?: Json | null
          created_at?: string | null
          credit_report_id?: string | null
          credit_score?: number | null
          employment_details?: Json | null
          guarantors?: Json | null
          id?: string
          loan_product_id: string
          purpose: string
          recommended_amount?: number | null
          rejection_reason?: string | null
          repayment_frequency?: Database["public"]["Enums"]["repayment_frequency"]
          requested_amount: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          risk_assessment?: Json | null
          status?: Database["public"]["Enums"]["loan_status"]
          submitted_at?: string | null
          supporting_documents?: Json | null
          tenure_months: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          application_number?: string
          approved_at?: string | null
          auto_decision?: string | null
          collateral_details?: Json | null
          created_at?: string | null
          credit_report_id?: string | null
          credit_score?: number | null
          employment_details?: Json | null
          guarantors?: Json | null
          id?: string
          loan_product_id?: string
          purpose?: string
          recommended_amount?: number | null
          rejection_reason?: string | null
          repayment_frequency?: Database["public"]["Enums"]["repayment_frequency"]
          requested_amount?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          risk_assessment?: Json | null
          status?: Database["public"]["Enums"]["loan_status"]
          submitted_at?: string | null
          supporting_documents?: Json | null
          tenure_months?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_credit_report_id_fkey"
            columns: ["credit_report_id"]
            isOneToOne: false
            referencedRelation: "credit_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          loan_id: string
          metadata: Json | null
          performed_by: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          loan_id: string
          metadata?: Json | null
          performed_by?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          loan_id?: string
          metadata?: Json | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_events_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          interest_amount: number
          loan_account_id: string
          metadata: Json | null
          notes: string | null
          payment_channel: string | null
          payment_date: string | null
          payment_method: string
          payment_reference: string
          penalty_amount: number
          principal_amount: number
          processed_at: string | null
          status: string
          transaction_ref: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          interest_amount?: number
          loan_account_id: string
          metadata?: Json | null
          notes?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method: string
          payment_reference: string
          penalty_amount?: number
          principal_amount?: number
          processed_at?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          interest_amount?: number
          loan_account_id?: string
          metadata?: Json | null
          notes?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method?: string
          payment_reference?: string
          penalty_amount?: number
          principal_amount?: number
          processed_at?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_account_id_fkey"
            columns: ["loan_account_id"]
            isOneToOne: false
            referencedRelation: "loan_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_products: {
        Row: {
          created_at: string | null
          description: string | null
          eligibility_criteria: Json | null
          id: string
          institution_id: string | null
          interest_calculation_method: string
          interest_rate: number
          is_active: boolean | null
          late_payment_penalty_percentage: number | null
          loan_type: Database["public"]["Enums"]["loan_type"]
          max_amount: number
          max_tenure_months: number
          min_amount: number
          min_guarantors: number | null
          min_tenure_months: number
          processing_fee_fixed: number | null
          processing_fee_percentage: number | null
          product_code: string
          product_name: string
          required_documents: Json | null
          requires_collateral: boolean | null
          requires_guarantor: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          eligibility_criteria?: Json | null
          id?: string
          institution_id?: string | null
          interest_calculation_method?: string
          interest_rate: number
          is_active?: boolean | null
          late_payment_penalty_percentage?: number | null
          loan_type: Database["public"]["Enums"]["loan_type"]
          max_amount: number
          max_tenure_months: number
          min_amount: number
          min_guarantors?: number | null
          min_tenure_months: number
          processing_fee_fixed?: number | null
          processing_fee_percentage?: number | null
          product_code: string
          product_name: string
          required_documents?: Json | null
          requires_collateral?: boolean | null
          requires_guarantor?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          eligibility_criteria?: Json | null
          id?: string
          institution_id?: string | null
          interest_calculation_method?: string
          interest_rate?: number
          is_active?: boolean | null
          late_payment_penalty_percentage?: number | null
          loan_type?: Database["public"]["Enums"]["loan_type"]
          max_amount?: number
          max_tenure_months?: number
          min_amount?: number
          min_guarantors?: number | null
          min_tenure_months?: number
          processing_fee_fixed?: number | null
          processing_fee_percentage?: number | null
          product_code?: string
          product_name?: string
          required_documents?: Json | null
          requires_collateral?: boolean | null
          requires_guarantor?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      loan_repayment_schedules: {
        Row: {
          created_at: string | null
          days_overdue: number | null
          due_date: string
          id: string
          installment_number: number
          interest_due: number
          interest_paid: number
          loan_account_id: string
          outstanding_balance: number
          paid_at: string | null
          penalty_amount: number | null
          penalty_paid: number
          principal_due: number
          principal_paid: number
          status: string
          total_due: number
          total_paid: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days_overdue?: number | null
          due_date: string
          id?: string
          installment_number: number
          interest_due: number
          interest_paid?: number
          loan_account_id: string
          outstanding_balance?: number
          paid_at?: string | null
          penalty_amount?: number | null
          penalty_paid?: number
          principal_due: number
          principal_paid?: number
          status?: string
          total_due: number
          total_paid?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days_overdue?: number | null
          due_date?: string
          id?: string
          installment_number?: number
          interest_due?: number
          interest_paid?: number
          loan_account_id?: string
          outstanding_balance?: number
          paid_at?: string | null
          penalty_amount?: number | null
          penalty_paid?: number
          principal_due?: number
          principal_paid?: number
          status?: string
          total_due?: number
          total_paid?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayment_schedules_loan_account_id_fkey"
            columns: ["loan_account_id"]
            isOneToOne: false
            referencedRelation: "loan_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayments: {
        Row: {
          amount: number
          created_at: string
          fees_paid: number
          id: string
          interest_paid: number
          journal_entry_id: string | null
          loan_id: string
          payment_method: string | null
          payment_reference: string | null
          penalty_paid: number
          principal_paid: number
          schedule_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          fees_paid?: number
          id?: string
          interest_paid?: number
          journal_entry_id?: string | null
          loan_id: string
          payment_method?: string | null
          payment_reference?: string | null
          penalty_paid?: number
          principal_paid?: number
          schedule_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          fees_paid?: number
          id?: string
          interest_paid?: number
          journal_entry_id?: string | null
          loan_id?: string
          payment_method?: string | null
          payment_reference?: string | null
          penalty_paid?: number
          principal_paid?: number
          schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "loan_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_schedule: {
        Row: {
          created_at: string
          due_date: string
          fee_amount: number
          id: string
          installment_number: number
          interest_amount: number
          loan_id: string
          paid_amount: number
          paid_at: string | null
          principal_amount: number
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          fee_amount?: number
          id?: string
          installment_number: number
          interest_amount?: number
          loan_id: string
          paid_amount?: number
          paid_at?: string | null
          principal_amount?: number
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          fee_amount?: number
          id?: string
          installment_number?: number
          interest_amount?: number
          loan_id?: string
          paid_amount?: number
          paid_at?: string | null
          principal_amount?: number
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_schedule_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_settings: {
        Row: {
          backup_codes: string[] | null
          created_at: string | null
          id: string
          last_used_at: string | null
          mfa_enabled: boolean | null
          mfa_method: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          mfa_enabled?: boolean | null
          mfa_method?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          mfa_enabled?: boolean | null
          mfa_method?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mobile_money_accounts: {
        Row: {
          account_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          phone_number: string
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          phone_number: string
          provider: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          phone_number?: string
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mobile_money_transactions: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          completed_at: string | null
          created_at: string | null
          currency: string
          description: string | null
          destination_account_id: string | null
          error_message: string | null
          facilitated_institution_id: string | null
          flutterwave_ref: string | null
          id: string
          is_bank_deposit: boolean | null
          is_kob_facilitated: boolean | null
          kob_fee_amount: number | null
          metadata: Json | null
          mobile_account_id: string | null
          phone_number: string
          provider: string
          settlement_id: string | null
          status: string
          transaction_ref: string
          transaction_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          bank_transaction_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          destination_account_id?: string | null
          error_message?: string | null
          facilitated_institution_id?: string | null
          flutterwave_ref?: string | null
          id?: string
          is_bank_deposit?: boolean | null
          is_kob_facilitated?: boolean | null
          kob_fee_amount?: number | null
          metadata?: Json | null
          mobile_account_id?: string | null
          phone_number: string
          provider: string
          settlement_id?: string | null
          status?: string
          transaction_ref: string
          transaction_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          destination_account_id?: string | null
          error_message?: string | null
          facilitated_institution_id?: string | null
          flutterwave_ref?: string | null
          id?: string
          is_bank_deposit?: boolean | null
          is_kob_facilitated?: boolean | null
          kob_fee_amount?: number | null
          metadata?: Json | null
          mobile_account_id?: string | null
          phone_number?: string
          provider?: string
          settlement_id?: string | null
          status?: string
          transaction_ref?: string
          transaction_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobile_money_transactions_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobile_money_transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobile_money_transactions_facilitated_institution_id_fkey"
            columns: ["facilitated_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobile_money_transactions_mobile_account_id_fkey"
            columns: ["mobile_account_id"]
            isOneToOne: false
            referencedRelation: "mobile_money_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobile_money_transactions_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlement_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          credit_score_alerts: boolean | null
          daily_digest: boolean | null
          email_enabled: boolean | null
          id: string
          in_app_enabled: boolean | null
          instant_notifications: boolean | null
          loan_alerts: boolean | null
          payment_alerts: boolean | null
          savings_alerts: boolean | null
          security_alerts: boolean | null
          sms_enabled: boolean | null
          transaction_alerts: boolean | null
          updated_at: string | null
          user_id: string
          weekly_summary: boolean | null
        }
        Insert: {
          created_at?: string | null
          credit_score_alerts?: boolean | null
          daily_digest?: boolean | null
          email_enabled?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          instant_notifications?: boolean | null
          loan_alerts?: boolean | null
          payment_alerts?: boolean | null
          savings_alerts?: boolean | null
          security_alerts?: boolean | null
          sms_enabled?: boolean | null
          transaction_alerts?: boolean | null
          updated_at?: string | null
          user_id: string
          weekly_summary?: boolean | null
        }
        Update: {
          created_at?: string | null
          credit_score_alerts?: boolean | null
          daily_digest?: boolean | null
          email_enabled?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          instant_notifications?: boolean | null
          loan_alerts?: boolean | null
          payment_alerts?: boolean | null
          savings_alerts?: boolean | null
          security_alerts?: boolean | null
          sms_enabled?: boolean | null
          transaction_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string
          weekly_summary?: boolean | null
        }
        Relationships: []
      }
      oauth_sessions: {
        Row: {
          client_id: string
          code_challenge: string | null
          code_challenge_method: string | null
          created_at: string
          expires_at: string
          id: string
          nonce: string | null
          redirect_uri: string
          scope: string | null
          state: string
          used: boolean | null
          user_id: string | null
        }
        Insert: {
          client_id: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string | null
          redirect_uri: string
          scope?: string | null
          state: string
          used?: boolean | null
          user_id?: string | null
        }
        Update: {
          client_id?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string | null
          redirect_uri?: string
          scope?: string | null
          state?: string
          used?: boolean | null
          user_id?: string | null
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
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          new_status: string | null
          payment_id: string
          performed_by: string | null
          previous_status: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          payment_id: string
          performed_by?: string | null
          previous_status?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          payment_id?: string
          performed_by?: string | null
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_routes: {
        Row: {
          attempt_number: number
          created_at: string
          error_message: string | null
          external_reference: string | null
          id: string
          metadata: Json | null
          payment_id: string
          rail: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          external_reference?: string | null
          id?: string
          metadata?: Json | null
          payment_id: string
          rail: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          external_reference?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string
          rail?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_routes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          client_id: string
          consent_id: string
          created_at: string | null
          creditor_account: Json
          debtor_account: Json | null
          expected_execution_date: string | null
          expected_settlement_date: string | null
          id: string
          instructed_amount: Json
          merchant_category_code: string | null
          merchant_customer_identification: string | null
          payment_context_code: string | null
          payment_id: string
          reference: string | null
          remittance_information: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          consent_id: string
          created_at?: string | null
          creditor_account: Json
          debtor_account?: Json | null
          expected_execution_date?: string | null
          expected_settlement_date?: string | null
          id?: string
          instructed_amount: Json
          merchant_category_code?: string | null
          merchant_customer_identification?: string | null
          payment_context_code?: string | null
          payment_id: string
          reference?: string | null
          remittance_information?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          consent_id?: string
          created_at?: string | null
          creditor_account?: Json
          debtor_account?: Json | null
          expected_execution_date?: string | null
          expected_settlement_date?: string | null
          id?: string
          instructed_amount?: Json
          merchant_category_code?: string | null
          merchant_customer_identification?: string | null
          payment_context_code?: string | null
          payment_id?: string
          reference?: string | null
          remittance_information?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          bank_account_number: string | null
          bank_code: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          failed_reason: string | null
          id: string
          institution_id: string
          metadata: Json | null
          payout_method: string
          processed_at: string | null
          reference: string | null
          retry_count: number | null
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_number?: string | null
          bank_code?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          failed_reason?: string | null
          id?: string
          institution_id: string
          metadata?: Json | null
          payout_method?: string
          processed_at?: string | null
          reference?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_number?: string | null
          bank_code?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          failed_reason?: string | null
          id?: string
          institution_id?: string
          metadata?: Json | null
          payout_method?: string
          processed_at?: string | null
          reference?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otp_codes: {
        Row: {
          attempts: number | null
          created_at: string | null
          delivery_method: string
          expires_at: string
          id: string
          ip_address: unknown
          max_attempts: number | null
          otp_code: string
          otp_type: string
          phone_number: string
          sms_sent: boolean | null
          sms_sent_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string | null
          verified_at: string | null
          whatsapp_sent: boolean | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          delivery_method: string
          expires_at: string
          id?: string
          ip_address?: unknown
          max_attempts?: number | null
          otp_code: string
          otp_type: string
          phone_number: string
          sms_sent?: boolean | null
          sms_sent_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
          verified_at?: string | null
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          delivery_method?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          max_attempts?: number | null
          otp_code?: string
          otp_type?: string
          phone_number?: string
          sms_sent?: boolean | null
          sms_sent_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
          verified_at?: string | null
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
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
      postiq_address_verifications: {
        Row: {
          area_name: string | null
          created_at: string | null
          credits_consumed: number | null
          district: string | null
          full_address: string | null
          house_number: string | null
          id: string
          is_active: boolean | null
          latitude: number
          longitude: number
          postiq_code: string
          precision: string
          region: string | null
          road_name: string | null
          sector: string | null
          updated_at: string | null
          user_id: string
          verification_method: string | null
          verified_at: string | null
        }
        Insert: {
          area_name?: string | null
          created_at?: string | null
          credits_consumed?: number | null
          district?: string | null
          full_address?: string | null
          house_number?: string | null
          id?: string
          is_active?: boolean | null
          latitude: number
          longitude: number
          postiq_code: string
          precision: string
          region?: string | null
          road_name?: string | null
          sector?: string | null
          updated_at?: string | null
          user_id: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Update: {
          area_name?: string | null
          created_at?: string | null
          credits_consumed?: number | null
          district?: string | null
          full_address?: string | null
          house_number?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number
          longitude?: number
          postiq_code?: string
          precision?: string
          region?: string | null
          road_name?: string | null
          sector?: string | null
          updated_at?: string | null
          user_id?: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      postiq_api_keys: {
        Row: {
          api_key: string
          api_secret: string
          created_at: string | null
          credits_remaining: number | null
          expires_at: string | null
          id: string
          institution_id: string | null
          is_active: boolean | null
          is_sandbox: boolean | null
          rate_limit_per_day: number | null
          rate_limit_per_hour: number | null
        }
        Insert: {
          api_key: string
          api_secret: string
          created_at?: string | null
          credits_remaining?: number | null
          expires_at?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          is_sandbox?: boolean | null
          rate_limit_per_day?: number | null
          rate_limit_per_hour?: number | null
        }
        Update: {
          api_key?: string
          api_secret?: string
          created_at?: string | null
          credits_remaining?: number | null
          expires_at?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          is_sandbox?: boolean | null
          rate_limit_per_day?: number | null
          rate_limit_per_hour?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "postiq_api_keys_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      postiq_api_usage: {
        Row: {
          created_at: string | null
          credits_consumed: number | null
          endpoint: string
          error_message: string | null
          id: string
          institution_id: string | null
          ip_address: unknown
          method: string
          request_data: Json | null
          response_data: Json | null
          status_code: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          credits_consumed?: number | null
          endpoint: string
          error_message?: string | null
          id?: string
          institution_id?: string | null
          ip_address?: unknown
          method: string
          request_data?: Json | null
          response_data?: Json | null
          status_code?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          credits_consumed?: number | null
          endpoint?: string
          error_message?: string | null
          id?: string
          institution_id?: string | null
          ip_address?: unknown
          method?: string
          request_data?: Json | null
          response_data?: Json | null
          status_code?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postiq_api_usage_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country_code: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          migration_grace_period_ends: string | null
          migration_required: boolean | null
          phone_number: string | null
          phone_verified: boolean | null
          phone_verified_at: string | null
          pin_attempts: number | null
          pin_code_hash: string | null
          pin_code_set_at: string | null
          pin_locked_until: string | null
          preferred_otp_method: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          migration_grace_period_ends?: string | null
          migration_required?: boolean | null
          phone_number?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          pin_attempts?: number | null
          pin_code_hash?: string | null
          pin_code_set_at?: string | null
          pin_locked_until?: string | null
          preferred_otp_method?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          migration_grace_period_ends?: string | null
          migration_required?: boolean | null
          phone_number?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          pin_attempts?: number | null
          pin_code_hash?: string | null
          pin_code_set_at?: string | null
          pin_locked_until?: string | null
          preferred_otp_method?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          client_id: string
          created_at: string | null
          endpoint: string
          id: string
          limit_exceeded: boolean | null
          request_count: number | null
          user_id: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          endpoint: string
          id?: string
          limit_exceeded?: boolean | null
          request_count?: number | null
          user_id?: string | null
          window_end: string
          window_start: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          limit_exceeded?: boolean | null
          request_count?: number | null
          user_id?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      refresh_tokens: {
        Row: {
          access_token_id: string | null
          certificate_id: string | null
          client_id: string
          cnf_thumbprint: string | null
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
          certificate_id?: string | null
          client_id: string
          cnf_thumbprint?: string | null
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
          certificate_id?: string | null
          client_id?: string
          cnf_thumbprint?: string | null
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
          {
            foreignKeyName: "refresh_tokens_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "client_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_reports: {
        Row: {
          acknowledgment_date: string | null
          acknowledgment_received: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          regulator: string
          report_data: Json | null
          report_file_url: string | null
          report_format: string
          report_period_end: string
          report_period_start: string
          report_type: string
          submission_reference: string | null
          submission_status: string | null
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledgment_date?: string | null
          acknowledgment_received?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          regulator: string
          report_data?: Json | null
          report_file_url?: string | null
          report_format: string
          report_period_end: string
          report_period_start: string
          report_type: string
          submission_reference?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledgment_date?: string | null
          acknowledgment_received?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          regulator?: string
          report_data?: Json | null
          report_file_url?: string | null
          report_format?: string
          report_period_end?: string
          report_period_start?: string
          report_type?: string
          submission_reference?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          actions: Database["public"]["Enums"]["permission_action"][]
          created_at: string | null
          created_by: string | null
          id: string
          institution_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["permission_scope"]
        }
        Insert: {
          actions: Database["public"]["Enums"]["permission_action"][]
          created_at?: string | null
          created_by?: string | null
          id?: string
          institution_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["permission_scope"]
        }
        Update: {
          actions?: Database["public"]["Enums"]["permission_action"][]
          created_at?: string | null
          created_by?: string | null
          id?: string
          institution_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["permission_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      sanctions_screening: {
        Row: {
          created_at: string | null
          entity_data: Json
          entity_name: string
          entity_type: string
          false_positive: boolean | null
          id: string
          match_score: number | null
          matches: Json | null
          next_screening_date: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          screened_lists: string[] | null
          screening_provider: string | null
          screening_status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_data: Json
          entity_name: string
          entity_type: string
          false_positive?: boolean | null
          id?: string
          match_score?: number | null
          matches?: Json | null
          next_screening_date?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screened_lists?: string[] | null
          screening_provider?: string | null
          screening_status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_data?: Json
          entity_name?: string
          entity_type?: string
          false_positive?: boolean | null
          id?: string
          match_score?: number | null
          matches?: Json | null
          next_screening_date?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screened_lists?: string[] | null
          screening_provider?: string | null
          screening_status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sandbox_accounts: {
        Row: {
          account_holder_name: string
          account_id: string
          account_subtype: Database["public"]["Enums"]["account_subtype"] | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          balance: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          id: string
          identification_scheme:
            | Database["public"]["Enums"]["account_scheme"]
            | null
          identification_value: string
          is_active: boolean | null
        }
        Insert: {
          account_holder_name: string
          account_id: string
          account_subtype?:
            | Database["public"]["Enums"]["account_subtype"]
            | null
          account_type?: Database["public"]["Enums"]["account_type"] | null
          balance?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          id?: string
          identification_scheme?:
            | Database["public"]["Enums"]["account_scheme"]
            | null
          identification_value: string
          is_active?: boolean | null
        }
        Update: {
          account_holder_name?: string
          account_id?: string
          account_subtype?:
            | Database["public"]["Enums"]["account_subtype"]
            | null
          account_type?: Database["public"]["Enums"]["account_type"] | null
          balance?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          id?: string
          identification_scheme?:
            | Database["public"]["Enums"]["account_scheme"]
            | null
          identification_value?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      sandbox_api_keys: {
        Row: {
          api_key: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_name: string
          last_used_at: string | null
          rate_limit_per_day: number
          rate_limit_per_minute: number
          sandbox_account_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_name: string
          last_used_at?: string | null
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          sandbox_account_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_name?: string
          last_used_at?: string | null
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          sandbox_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_api_keys_sandbox_account_id_fkey"
            columns: ["sandbox_account_id"]
            isOneToOne: false
            referencedRelation: "developer_sandbox_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_api_usage: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          id: string
          ip_address: unknown
          method: string
          request_size: number | null
          response_size: number | null
          response_time_ms: number | null
          status_code: number
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: unknown
          method: string
          request_size?: number | null
          response_size?: number | null
          response_time_ms?: number | null
          status_code: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: unknown
          method?: string
          request_size?: number | null
          response_size?: number | null
          response_time_ms?: number | null
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_api_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "sandbox_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_data: {
        Row: {
          created_at: string | null
          data: Json
          data_type: string
          id: string
          institution_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          data_type: string
          id?: string
          institution_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          data_type?: string
          id?: string
          institution_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_data_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_rate_limit_tracker: {
        Row: {
          api_key_id: string
          created_at: string
          id: string
          limit_exceeded: boolean
          request_count: number
          window_end: string
          window_start: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          id?: string
          limit_exceeded?: boolean
          request_count?: number
          window_end: string
          window_start: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          id?: string
          limit_exceeded?: boolean
          request_count?: number
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_rate_limit_tracker_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "sandbox_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          template_data: Json
          template_name: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_data: Json
          template_name: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_data?: Json
          template_name?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sandbox_webhook_logs: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          webhook_id: string
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id: string
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "sandbox_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_webhooks: {
        Row: {
          created_at: string | null
          event_types: string[]
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          sandbox_account_id: string
          secret_key: string | null
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          created_at?: string | null
          event_types?: string[]
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          sandbox_account_id: string
          secret_key?: string | null
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          created_at?: string | null
          event_types?: string[]
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          sandbox_account_id?: string
          secret_key?: string | null
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_webhooks_sandbox_account_id_fkey"
            columns: ["sandbox_account_id"]
            isOneToOne: false
            referencedRelation: "developer_sandbox_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_cards: {
        Row: {
          billing_name: string | null
          card_brand: string
          card_country: string | null
          card_exp_month: number
          card_exp_year: number
          card_last4: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          stripe_payment_method_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_name?: string | null
          card_brand: string
          card_country?: string | null
          card_exp_month: number
          card_exp_year: number
          card_last4: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          stripe_payment_method_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_name?: string | null
          card_brand?: string
          card_country?: string | null
          card_exp_month?: number
          card_exp_year?: number
          card_last4?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          stripe_payment_method_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      savings_accounts: {
        Row: {
          account_id: string
          account_name: string | null
          auto_save_amount: number | null
          auto_save_day: number | null
          auto_save_enabled: boolean | null
          auto_save_frequency: string | null
          available_balance: number
          closed_at: string | null
          created_at: string | null
          current_balance: number
          current_interest_rate: number
          id: string
          interest_accrued: number
          is_locked: boolean | null
          last_interest_date: string | null
          last_withdrawal_date: string | null
          maturity_date: string | null
          next_interest_date: string | null
          opened_at: string | null
          product_id: string
          savings_type: Database["public"]["Enums"]["savings_type"]
          status: string
          target_amount: number | null
          target_date: string | null
          total_interest_earned: number
          updated_at: string | null
          user_id: string
          withdrawals_this_month: number | null
        }
        Insert: {
          account_id: string
          account_name?: string | null
          auto_save_amount?: number | null
          auto_save_day?: number | null
          auto_save_enabled?: boolean | null
          auto_save_frequency?: string | null
          available_balance?: number
          closed_at?: string | null
          created_at?: string | null
          current_balance?: number
          current_interest_rate: number
          id?: string
          interest_accrued?: number
          is_locked?: boolean | null
          last_interest_date?: string | null
          last_withdrawal_date?: string | null
          maturity_date?: string | null
          next_interest_date?: string | null
          opened_at?: string | null
          product_id: string
          savings_type: Database["public"]["Enums"]["savings_type"]
          status?: string
          target_amount?: number | null
          target_date?: string | null
          total_interest_earned?: number
          updated_at?: string | null
          user_id: string
          withdrawals_this_month?: number | null
        }
        Update: {
          account_id?: string
          account_name?: string | null
          auto_save_amount?: number | null
          auto_save_day?: number | null
          auto_save_enabled?: boolean | null
          auto_save_frequency?: string | null
          available_balance?: number
          closed_at?: string | null
          created_at?: string | null
          current_balance?: number
          current_interest_rate?: number
          id?: string
          interest_accrued?: number
          is_locked?: boolean | null
          last_interest_date?: string | null
          last_withdrawal_date?: string | null
          maturity_date?: string | null
          next_interest_date?: string | null
          opened_at?: string | null
          product_id?: string
          savings_type?: Database["public"]["Enums"]["savings_type"]
          status?: string
          target_amount?: number | null
          target_date?: string | null
          total_interest_earned?: number
          updated_at?: string | null
          user_id?: string
          withdrawals_this_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_accounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_interest_calculations: {
        Row: {
          average_balance: number
          calculation_date: string
          created_at: string | null
          credited_at: string | null
          days_in_period: number
          id: string
          interest_amount: number
          interest_rate: number
          period_end: string
          period_start: string
          savings_account_id: string
          status: string
        }
        Insert: {
          average_balance: number
          calculation_date: string
          created_at?: string | null
          credited_at?: string | null
          days_in_period: number
          id?: string
          interest_amount: number
          interest_rate: number
          period_end: string
          period_start: string
          savings_account_id: string
          status?: string
        }
        Update: {
          average_balance?: number
          calculation_date?: string
          created_at?: string | null
          credited_at?: string | null
          days_in_period?: number
          id?: string
          interest_amount?: number
          interest_rate?: number
          period_end?: string
          period_start?: string
          savings_account_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_interest_calculations_savings_account_id_fkey"
            columns: ["savings_account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_products: {
        Row: {
          base_interest_rate: number
          created_at: string | null
          description: string | null
          early_closure_penalty: number | null
          id: string
          institution_id: string | null
          interest_payment_frequency: string
          is_active: boolean | null
          lock_in_period_months: number | null
          max_balance: number | null
          max_withdrawals_per_month: number | null
          min_balance: number | null
          min_opening_balance: number
          monthly_maintenance_fee: number | null
          product_code: string
          product_name: string
          savings_type: Database["public"]["Enums"]["savings_type"]
          tiered_rates: Json | null
          updated_at: string | null
          withdrawal_penalty_rate: number | null
        }
        Insert: {
          base_interest_rate: number
          created_at?: string | null
          description?: string | null
          early_closure_penalty?: number | null
          id?: string
          institution_id?: string | null
          interest_payment_frequency: string
          is_active?: boolean | null
          lock_in_period_months?: number | null
          max_balance?: number | null
          max_withdrawals_per_month?: number | null
          min_balance?: number | null
          min_opening_balance: number
          monthly_maintenance_fee?: number | null
          product_code: string
          product_name: string
          savings_type: Database["public"]["Enums"]["savings_type"]
          tiered_rates?: Json | null
          updated_at?: string | null
          withdrawal_penalty_rate?: number | null
        }
        Update: {
          base_interest_rate?: number
          created_at?: string | null
          description?: string | null
          early_closure_penalty?: number | null
          id?: string
          institution_id?: string | null
          interest_payment_frequency?: string
          is_active?: boolean | null
          lock_in_period_months?: number | null
          max_balance?: number | null
          max_withdrawals_per_month?: number | null
          min_balance?: number | null
          min_opening_balance?: number
          monthly_maintenance_fee?: number | null
          product_code?: string
          product_name?: string
          savings_type?: Database["public"]["Enums"]["savings_type"]
          tiered_rates?: Json | null
          updated_at?: string | null
          withdrawal_penalty_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_products_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          destination_account_id: string | null
          id: string
          interest_period_end: string | null
          interest_period_start: string | null
          interest_rate: number | null
          reference: string | null
          savings_account_id: string
          source_account_id: string | null
          transaction_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description?: string | null
          destination_account_id?: string | null
          id?: string
          interest_period_end?: string | null
          interest_period_start?: string | null
          interest_rate?: number | null
          reference?: string | null
          savings_account_id: string
          source_account_id?: string | null
          transaction_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          destination_account_id?: string | null
          id?: string
          interest_period_end?: string | null
          interest_period_start?: string | null
          interest_rate?: number | null
          reference?: string | null
          savings_account_id?: string
          source_account_id?: string | null
          transaction_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_savings_account_id_fkey"
            columns: ["savings_account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      sca_challenges: {
        Row: {
          attempts: number | null
          challenge_code: string | null
          challenge_data: Json | null
          challenge_type: string
          created_at: string | null
          device_fingerprint: string | null
          expires_at: string
          id: string
          ip_address: unknown
          max_attempts: number | null
          operation_id: string | null
          operation_type: string
          status: string
          user_agent: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          challenge_code?: string | null
          challenge_data?: Json | null
          challenge_type: string
          created_at?: string | null
          device_fingerprint?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown
          max_attempts?: number | null
          operation_id?: string | null
          operation_type: string
          status?: string
          user_agent?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          challenge_code?: string | null
          challenge_data?: Json | null
          challenge_type?: string
          created_at?: string | null
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          max_attempts?: number | null
          operation_id?: string | null
          operation_type?: string
          status?: string
          user_agent?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          blocked: boolean | null
          created_at: string | null
          device_info: Json | null
          event_category: string
          event_type: string
          id: string
          ip_address: unknown
          location: Json | null
          metadata: Json | null
          risk_score: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          blocked?: boolean | null
          created_at?: string | null
          device_info?: Json | null
          event_category: string
          event_type: string
          id?: string
          ip_address?: unknown
          location?: Json | null
          metadata?: Json | null
          risk_score?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          blocked?: boolean | null
          created_at?: string | null
          device_info?: Json | null
          event_category?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          location?: Json | null
          metadata?: Json | null
          risk_score?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      seo_metadata: {
        Row: {
          canonical_url: string | null
          created_at: string | null
          description: string
          hreflang_tags: Json | null
          id: string
          is_active: boolean | null
          keywords: string | null
          og_image: string | null
          page_path: string
          structured_data: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string | null
          description: string
          hreflang_tags?: Json | null
          id?: string
          is_active?: boolean | null
          keywords?: string | null
          og_image?: string | null
          page_path: string
          structured_data?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          canonical_url?: string | null
          created_at?: string | null
          description?: string
          hreflang_tags?: Json | null
          id?: string
          is_active?: boolean | null
          keywords?: string | null
          og_image?: string | null
          page_path?: string
          structured_data?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      settlement_transactions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          flutterwave_transfer_ref: string | null
          id: string
          institution_id: string
          kob_fees_charged: number
          metadata: Json | null
          net_settlement_amount: number
          period_end: string
          period_start: string
          settlement_destination: Json
          settlement_method: string
          settlement_ref: string
          settlement_status: string | null
          total_inflows: number
          total_outflows: number
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          flutterwave_transfer_ref?: string | null
          id?: string
          institution_id: string
          kob_fees_charged?: number
          metadata?: Json | null
          net_settlement_amount?: number
          period_end: string
          period_start: string
          settlement_destination: Json
          settlement_method: string
          settlement_ref: string
          settlement_status?: string | null
          total_inflows?: number
          total_outflows?: number
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          flutterwave_transfer_ref?: string | null
          id?: string
          institution_id?: string
          kob_fees_charged?: number
          metadata?: Json | null
          net_settlement_amount?: number
          period_end?: string
          period_start?: string
          settlement_destination?: Json
          settlement_method?: string
          settlement_ref?: string
          settlement_status?: string | null
          total_inflows?: number
          total_outflows?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_transactions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
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
      staff_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          branch_id: string | null
          department: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          institution_id: string
          is_active: boolean | null
          position: string
          start_date: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          branch_id?: string | null
          department?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          institution_id: string
          is_active?: boolean | null
          position: string
          start_date?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          branch_id?: string | null
          department?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean | null
          position?: string
          start_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_portal_permissions: {
        Row: {
          can_manage: boolean | null
          can_view: boolean | null
          granted_at: string | null
          granted_by: string | null
          id: string
          section_key: string
          staff_assignment_id: string
        }
        Insert: {
          can_manage?: boolean | null
          can_view?: boolean | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          section_key: string
          staff_assignment_id: string
        }
        Update: {
          can_manage?: boolean | null
          can_view?: boolean | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          section_key?: string
          staff_assignment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_portal_permissions_staff_assignment_id_fkey"
            columns: ["staff_assignment_id"]
            isOneToOne: false
            referencedRelation: "staff_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      standing_orders: {
        Row: {
          account_id: string
          created_at: string | null
          creditor_identification_scheme: Database["public"]["Enums"]["account_scheme"]
          creditor_identification_value: string
          creditor_name: string
          currency: string
          final_payment_amount: number | null
          final_payment_date: string | null
          first_payment_amount: number
          first_payment_date: string
          frequency: string
          id: string
          next_payment_amount: number | null
          next_payment_date: string | null
          reference: string | null
          standing_order_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          creditor_identification_scheme: Database["public"]["Enums"]["account_scheme"]
          creditor_identification_value: string
          creditor_name: string
          currency?: string
          final_payment_amount?: number | null
          final_payment_date?: string | null
          first_payment_amount: number
          first_payment_date: string
          frequency: string
          id?: string
          next_payment_amount?: number | null
          next_payment_date?: string | null
          reference?: string | null
          standing_order_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          creditor_identification_scheme?: Database["public"]["Enums"]["account_scheme"]
          creditor_identification_value?: string
          creditor_name?: string
          currency?: string
          final_payment_amount?: number | null
          final_payment_date?: string | null
          first_payment_amount?: number
          first_payment_date?: string
          frequency?: string
          id?: string
          next_payment_amount?: number | null
          next_payment_date?: string | null
          reference?: string | null
          standing_order_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_cardholders: {
        Row: {
          billing_address: Json | null
          created_at: string | null
          email: string
          id: string
          metadata: Json | null
          name: string
          phone_number: string | null
          status: string | null
          stripe_cardholder_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string | null
          email: string
          id?: string
          metadata?: Json | null
          name: string
          phone_number?: string | null
          status?: string | null
          stripe_cardholder_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_address?: Json | null
          created_at?: string | null
          email?: string
          id?: string
          metadata?: Json | null
          name?: string
          phone_number?: string | null
          status?: string | null
          stripe_cardholder_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supported_currencies: {
        Row: {
          code: string
          created_at: string | null
          is_active: boolean | null
          name: string
          provider: string
          supported_countries: string[] | null
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string | null
          is_active?: boolean | null
          name: string
          provider: string
          supported_countries?: string[] | null
          symbol: string
        }
        Update: {
          code?: string
          created_at?: string | null
          is_active?: boolean | null
          name?: string
          provider?: string
          supported_countries?: string[] | null
          symbol?: string
        }
        Relationships: []
      }
      suspicious_activities: {
        Row: {
          action_taken: string | null
          activity_type: string
          created_at: string | null
          description: string
          id: string
          ip_address: unknown
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          risk_indicators: Json | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          activity_type: string
          created_at?: string | null
          description: string
          id?: string
          ip_address?: unknown
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_indicators?: Json | null
          severity: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          activity_type?: string
          created_at?: string | null
          description?: string
          id?: string
          ip_address?: unknown
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_indicators?: Json | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      swift_messages: {
        Row: {
          amount: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          direction: string
          id: string
          institution_id: string | null
          message_content: string
          message_type: string
          parsed_data: Json | null
          processed_at: string | null
          receiver_bic: string | null
          sender_bic: string | null
          status: string
          transaction_reference: string | null
          validation_errors: Json | null
          value_date: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          direction: string
          id?: string
          institution_id?: string | null
          message_content: string
          message_type: string
          parsed_data?: Json | null
          processed_at?: string | null
          receiver_bic?: string | null
          sender_bic?: string | null
          status?: string
          transaction_reference?: string | null
          validation_errors?: Json | null
          value_date?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          direction?: string
          id?: string
          institution_id?: string | null
          message_content?: string
          message_type?: string
          parsed_data?: Json | null
          processed_at?: string | null
          receiver_bic?: string | null
          sender_bic?: string | null
          status?: string
          transaction_reference?: string | null
          validation_errors?: Json | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swift_messages_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      swift_mt103_payments: {
        Row: {
          amount: number
          bank_operation_code: string | null
          beneficiary_customer: Json
          beneficiary_institution: Json | null
          created_at: string | null
          currency: string
          details_of_charges: string | null
          id: string
          ordering_customer: Json
          ordering_institution: Json | null
          receiver_correspondent: Json | null
          regulatory_reporting: Json | null
          related_reference: string | null
          remittance_info: string | null
          sender_correspondent: Json | null
          sender_to_receiver_info: string | null
          swift_message_id: string | null
          transaction_reference: string
          value_date: string
        }
        Insert: {
          amount: number
          bank_operation_code?: string | null
          beneficiary_customer: Json
          beneficiary_institution?: Json | null
          created_at?: string | null
          currency: string
          details_of_charges?: string | null
          id?: string
          ordering_customer: Json
          ordering_institution?: Json | null
          receiver_correspondent?: Json | null
          regulatory_reporting?: Json | null
          related_reference?: string | null
          remittance_info?: string | null
          sender_correspondent?: Json | null
          sender_to_receiver_info?: string | null
          swift_message_id?: string | null
          transaction_reference: string
          value_date: string
        }
        Update: {
          amount?: number
          bank_operation_code?: string | null
          beneficiary_customer?: Json
          beneficiary_institution?: Json | null
          created_at?: string | null
          currency?: string
          details_of_charges?: string | null
          id?: string
          ordering_customer?: Json
          ordering_institution?: Json | null
          receiver_correspondent?: Json | null
          regulatory_reporting?: Json | null
          related_reference?: string | null
          remittance_info?: string | null
          sender_correspondent?: Json | null
          sender_to_receiver_info?: string | null
          swift_message_id?: string | null
          transaction_reference?: string
          value_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "swift_mt103_payments_swift_message_id_fkey"
            columns: ["swift_message_id"]
            isOneToOne: false
            referencedRelation: "swift_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      swift_mt940_entries: {
        Row: {
          account_servicing_ref: string | null
          amount: number
          created_at: string | null
          dc_indicator: string
          entry_date: string | null
          funds_code: string | null
          id: string
          mt940_statement_id: string | null
          reference: string
          supplementary_details: string | null
          transaction_description: string | null
          transaction_type: string
          value_date: string
        }
        Insert: {
          account_servicing_ref?: string | null
          amount: number
          created_at?: string | null
          dc_indicator: string
          entry_date?: string | null
          funds_code?: string | null
          id?: string
          mt940_statement_id?: string | null
          reference: string
          supplementary_details?: string | null
          transaction_description?: string | null
          transaction_type: string
          value_date: string
        }
        Update: {
          account_servicing_ref?: string | null
          amount?: number
          created_at?: string | null
          dc_indicator?: string
          entry_date?: string | null
          funds_code?: string | null
          id?: string
          mt940_statement_id?: string | null
          reference?: string
          supplementary_details?: string | null
          transaction_description?: string | null
          transaction_type?: string
          value_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "swift_mt940_entries_mt940_statement_id_fkey"
            columns: ["mt940_statement_id"]
            isOneToOne: false
            referencedRelation: "swift_mt940_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      swift_mt940_statements: {
        Row: {
          account_identification: string
          closing_available_balance: number | null
          closing_available_balance_date: string | null
          closing_balance: number
          closing_balance_currency: string
          closing_balance_date: string
          closing_balance_dc_indicator: string
          created_at: string | null
          forward_available_balance: number | null
          forward_available_balance_date: string | null
          id: string
          information_to_account_owner: string | null
          opening_balance: number
          opening_balance_currency: string
          opening_balance_date: string
          opening_balance_dc_indicator: string
          sequence_number: string | null
          statement_number: string
          swift_message_id: string | null
          transaction_reference: string
        }
        Insert: {
          account_identification: string
          closing_available_balance?: number | null
          closing_available_balance_date?: string | null
          closing_balance: number
          closing_balance_currency: string
          closing_balance_date: string
          closing_balance_dc_indicator: string
          created_at?: string | null
          forward_available_balance?: number | null
          forward_available_balance_date?: string | null
          id?: string
          information_to_account_owner?: string | null
          opening_balance: number
          opening_balance_currency: string
          opening_balance_date: string
          opening_balance_dc_indicator: string
          sequence_number?: string | null
          statement_number: string
          swift_message_id?: string | null
          transaction_reference: string
        }
        Update: {
          account_identification?: string
          closing_available_balance?: number | null
          closing_available_balance_date?: string | null
          closing_balance?: number
          closing_balance_currency?: string
          closing_balance_date?: string
          closing_balance_dc_indicator?: string
          created_at?: string | null
          forward_available_balance?: number | null
          forward_available_balance_date?: string | null
          id?: string
          information_to_account_owner?: string | null
          opening_balance?: number
          opening_balance_currency?: string
          opening_balance_date?: string
          opening_balance_dc_indicator?: string
          sequence_number?: string | null
          statement_number?: string
          swift_message_id?: string | null
          transaction_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "swift_mt940_statements_swift_message_id_fkey"
            columns: ["swift_message_id"]
            isOneToOne: false
            referencedRelation: "swift_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          details: Json | null
          id: string
          message: string
          resolved_at: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          resolved_at?: string | null
          severity: string
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_sensitive: boolean | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_sensitive?: boolean | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_sensitive?: boolean | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      system_health_checks: {
        Row: {
          checked_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          response_time_ms: number | null
          service_name: string
          status: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          service_name: string
          status: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          service_name?: string
          status?: string
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
          fapi_profile: string | null
          grant_types: string[]
          id: string
          institution_id: string | null
          is_active: boolean | null
          jwks: Json | null
          jwks_uri: string | null
          mtls_subject_dn: string | null
          redirect_uris: string[]
          require_mtls: boolean | null
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
          fapi_profile?: string | null
          grant_types?: string[]
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          jwks?: Json | null
          jwks_uri?: string | null
          mtls_subject_dn?: string | null
          redirect_uris: string[]
          require_mtls?: boolean | null
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
          fapi_profile?: string | null
          grant_types?: string[]
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          jwks?: Json | null
          jwks_uri?: string | null
          mtls_subject_dn?: string | null
          redirect_uris?: string[]
          require_mtls?: boolean | null
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
      transaction_fees: {
        Row: {
          billed_at: string | null
          billing_status: string | null
          calculated_fee: number
          created_at: string | null
          fee_breakdown: Json | null
          fee_model: string
          fee_structure_id: string | null
          final_fee: number
          id: string
          institution_id: string
          invoice_id: string | null
          metadata: Json | null
          paid_at: string | null
          transaction_amount: number
          transaction_currency: string | null
          transaction_date: string
          transaction_id: string | null
          transaction_ref: string
          transaction_type: string
          waived_amount: number | null
          waiver_id: string | null
        }
        Insert: {
          billed_at?: string | null
          billing_status?: string | null
          calculated_fee: number
          created_at?: string | null
          fee_breakdown?: Json | null
          fee_model: string
          fee_structure_id?: string | null
          final_fee: number
          id?: string
          institution_id: string
          invoice_id?: string | null
          metadata?: Json | null
          paid_at?: string | null
          transaction_amount: number
          transaction_currency?: string | null
          transaction_date?: string
          transaction_id?: string | null
          transaction_ref: string
          transaction_type: string
          waived_amount?: number | null
          waiver_id?: string | null
        }
        Update: {
          billed_at?: string | null
          billing_status?: string | null
          calculated_fee?: number
          created_at?: string | null
          fee_breakdown?: Json | null
          fee_model?: string
          fee_structure_id?: string | null
          final_fee?: number
          id?: string
          institution_id?: string
          invoice_id?: string | null
          metadata?: Json | null
          paid_at?: string | null
          transaction_amount?: number
          transaction_currency?: string | null
          transaction_date?: string
          transaction_id?: string | null
          transaction_ref?: string
          transaction_type?: string
          waived_amount?: number | null
          waiver_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_fees_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_fees_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_fees_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "institution_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_fees_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "fee_waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_monitoring_alerts: {
        Row: {
          alert_description: string | null
          alert_type: string
          assigned_to: string | null
          created_at: string | null
          escalated_to: string | null
          id: string
          investigation_notes: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          risk_indicators: Json | null
          rule_id: string | null
          rule_name: string | null
          sar_filed: boolean | null
          sar_filed_at: string | null
          sar_reference: string | null
          severity: string
          status: string
          transaction_details: Json | null
          transaction_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          alert_description?: string | null
          alert_type: string
          assigned_to?: string | null
          created_at?: string | null
          escalated_to?: string | null
          id?: string
          investigation_notes?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_indicators?: Json | null
          rule_id?: string | null
          rule_name?: string | null
          sar_filed?: boolean | null
          sar_filed_at?: string | null
          sar_reference?: string | null
          severity: string
          status?: string
          transaction_details?: Json | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          alert_description?: string | null
          alert_type?: string
          assigned_to?: string | null
          created_at?: string | null
          escalated_to?: string | null
          id?: string
          investigation_notes?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_indicators?: Json | null
          rule_id?: string | null
          rule_name?: string | null
          sar_filed?: boolean | null
          sar_filed_at?: string | null
          sar_reference?: string | null
          severity?: string
          status?: string
          transaction_details?: Json | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number | null
          balance_after: Json | null
          booking_datetime: string | null
          created_at: string
          credit_debit_indicator: string | null
          creditor_account: Json | null
          currency: string
          debtor_account: Json | null
          id: string
          institution_id: string
          merchant_details: Json | null
          metadata: Json | null
          status: string
          transaction_information: string | null
          transaction_type: string
          user_id: string | null
          value_datetime: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          balance_after?: Json | null
          booking_datetime?: string | null
          created_at?: string
          credit_debit_indicator?: string | null
          creditor_account?: Json | null
          currency?: string
          debtor_account?: Json | null
          id?: string
          institution_id: string
          merchant_details?: Json | null
          metadata?: Json | null
          status: string
          transaction_information?: string | null
          transaction_type: string
          user_id?: string | null
          value_datetime?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          balance_after?: Json | null
          booking_datetime?: string | null
          created_at?: string
          credit_debit_indicator?: string | null
          creditor_account?: Json | null
          currency?: string
          debtor_account?: Json | null
          id?: string
          institution_id?: string
          merchant_details?: Json | null
          metadata?: Json | null
          status?: string
          transaction_information?: string | null
          transaction_type?: string
          user_id?: string | null
          value_datetime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_devices: {
        Row: {
          browser: string | null
          created_at: string | null
          device_fingerprint: string
          device_name: string | null
          device_type: string | null
          id: string
          ip_address: unknown
          is_trusted: boolean | null
          last_used_at: string | null
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_fingerprint: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          is_trusted?: boolean | null
          last_used_at?: string | null
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_fingerprint?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          is_trusted?: boolean | null
          last_used_at?: string | null
          os?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_active_sessions: {
        Row: {
          created_at: string | null
          device_info: string | null
          id: string
          last_active_at: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          last_active_at?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          last_active_at?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          created_at: string | null
          full_address: string | null
          id: string
          is_primary: boolean | null
          is_verified: boolean | null
          label: string
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          notes: string | null
          postiq_code: string | null
          updated_at: string | null
          user_id: string
          verification_method: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_address?: string | null
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          label: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          notes?: string | null
          postiq_code?: string | null
          updated_at?: string | null
          user_id: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_address?: string | null
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          label?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          notes?: string | null
          postiq_code?: string | null
          updated_at?: string | null
          user_id?: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          actions: Database["public"]["Enums"]["permission_action"][]
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          reason: string | null
          scope: Database["public"]["Enums"]["permission_scope"]
          user_id: string
        }
        Insert: {
          actions: Database["public"]["Enums"]["permission_action"][]
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          scope: Database["public"]["Enums"]["permission_scope"]
          user_id: string
        }
        Update: {
          actions?: Database["public"]["Enums"]["permission_action"][]
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          scope?: Database["public"]["Enums"]["permission_scope"]
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          default_currency: string | null
          email_notifications: boolean | null
          id: string
          language: string | null
          push_notifications: boolean | null
          sms_notifications: boolean | null
          transaction_alerts: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          default_currency?: string | null
          email_notifications?: boolean | null
          id?: string
          language?: string | null
          push_notifications?: boolean | null
          sms_notifications?: boolean | null
          transaction_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          default_currency?: string | null
          email_notifications?: boolean | null
          id?: string
          language?: string | null
          push_notifications?: boolean | null
          sms_notifications?: boolean | null
          transaction_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          allowed_ips: Json | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          allowed_ips?: Json | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          allowed_ips?: Json | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_security_settings: {
        Row: {
          created_at: string | null
          id: string
          ip_whitelist: unknown[] | null
          notify_consent_changes: boolean | null
          notify_new_device: boolean | null
          notify_payment_initiated: boolean | null
          notify_suspicious_login: boolean | null
          require_mfa: boolean | null
          session_timeout_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          notify_consent_changes?: boolean | null
          notify_new_device?: boolean | null
          notify_payment_initiated?: boolean | null
          notify_suspicious_login?: boolean | null
          require_mfa?: boolean | null
          session_timeout_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          notify_consent_changes?: boolean | null
          notify_new_device?: boolean | null
          notify_payment_initiated?: boolean | null
          notify_suspicious_login?: boolean | null
          require_mfa?: boolean | null
          session_timeout_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      virtual_card_programs: {
        Row: {
          created_at: string | null
          daily_spend_limit: number | null
          id: string
          institution_id: string | null
          is_active: boolean | null
          max_balance: number | null
          monthly_fee: number | null
          monthly_spend_limit: number | null
          program_description: string | null
          program_name: string
          transaction_fee_fixed: number | null
          transaction_fee_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_spend_limit?: number | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          max_balance?: number | null
          monthly_fee?: number | null
          monthly_spend_limit?: number | null
          program_description?: string | null
          program_name: string
          transaction_fee_fixed?: number | null
          transaction_fee_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_spend_limit?: number | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          max_balance?: number | null
          monthly_fee?: number | null
          monthly_spend_limit?: number | null
          program_description?: string | null
          program_name?: string
          transaction_fee_fixed?: number | null
          transaction_fee_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "virtual_card_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_cards: {
        Row: {
          balance_usd: number | null
          brand: string
          card_name: string
          cardholder_id: string
          created_at: string | null
          exp_month: number
          exp_year: number
          id: string
          last4: string
          metadata: Json | null
          program_id: string | null
          spending_controls: Json | null
          status: Database["public"]["Enums"]["card_status"] | null
          stripe_card_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance_usd?: number | null
          brand?: string
          card_name: string
          cardholder_id: string
          created_at?: string | null
          exp_month: number
          exp_year: number
          id?: string
          last4: string
          metadata?: Json | null
          program_id?: string | null
          spending_controls?: Json | null
          status?: Database["public"]["Enums"]["card_status"] | null
          stripe_card_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance_usd?: number | null
          brand?: string
          card_name?: string
          cardholder_id?: string
          created_at?: string | null
          exp_month?: number
          exp_year?: number
          id?: string
          last4?: string
          metadata?: Json | null
          program_id?: string | null
          spending_controls?: Json | null
          status?: Database["public"]["Enums"]["card_status"] | null
          stripe_card_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_cards_cardholder_id_fkey"
            columns: ["cardholder_id"]
            isOneToOne: false
            referencedRelation: "stripe_cardholders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_cards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "virtual_card_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          delivered_at: string | null
          event_data: Json
          event_type: string
          http_status: number | null
          id: string
          response_body: string | null
          status: string
          webhook_id: string
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          event_data: Json
          event_type: string
          http_status?: number | null
          id?: string
          response_body?: string | null
          status: string
          webhook_id: string
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          event_data?: Json
          event_type?: string
          http_status?: number | null
          id?: string
          response_body?: string | null
          status?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_inbox: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          is_processed: boolean
          payload: Json
          processed_at: string | null
          processing_error: string | null
          signature: string | null
          source: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          is_processed?: boolean
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          signature?: string | null
          source: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          is_processed?: boolean
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          signature?: string | null
          source?: string
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          client_id: string
          created_at: string | null
          description: string | null
          events: string[]
          failure_count: number | null
          id: string
          institution_id: string
          is_active: boolean | null
          last_failure_at: string | null
          last_failure_reason: string | null
          last_triggered_at: string | null
          secret: string
          updated_at: string | null
          url: string | null
          webhook_url: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          events: string[]
          failure_count?: number | null
          id?: string
          institution_id: string
          is_active?: boolean | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_triggered_at?: string | null
          secret: string
          updated_at?: string | null
          url?: string | null
          webhook_url: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          events?: string[]
          failure_count?: number | null
          id?: string
          institution_id?: string
          is_active?: boolean | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_triggered_at?: string | null
          secret?: string
          updated_at?: string | null
          url?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      woocommerce_merchants: {
        Row: {
          admin_email: string
          api_key_hash: string
          client_secret_hash: string
          created_at: string | null
          id: string
          last_sync_at: string | null
          payment_methods: Json | null
          plugin_version: string | null
          status: string | null
          store_name: string
          store_url: string
          updated_at: string | null
          user_id: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          admin_email: string
          api_key_hash: string
          client_secret_hash: string
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          payment_methods?: Json | null
          plugin_version?: string | null
          status?: string | null
          store_name: string
          store_url: string
          updated_at?: string | null
          user_id: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          admin_email?: string
          api_key_hash?: string
          client_secret_hash?: string
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          payment_methods?: Json | null
          plugin_version?: string | null
          status?: string | null
          store_name?: string
          store_url?: string
          updated_at?: string | null
          user_id?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      woocommerce_transactions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          customer_email: string | null
          customer_phone: string | null
          error_message: string | null
          id: string
          kob_transaction_id: string | null
          merchant_id: string
          metadata: Json | null
          payment_method: string
          status: string
          transaction_ref: string
          updated_at: string | null
          woocommerce_order_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          customer_email?: string | null
          customer_phone?: string | null
          error_message?: string | null
          id?: string
          kob_transaction_id?: string | null
          merchant_id: string
          metadata?: Json | null
          payment_method: string
          status: string
          transaction_ref: string
          updated_at?: string | null
          woocommerce_order_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          customer_email?: string | null
          customer_phone?: string | null
          error_message?: string | null
          id?: string
          kob_transaction_id?: string | null
          merchant_id?: string
          metadata?: Json | null
          payment_method?: string
          status?: string
          transaction_ref?: string
          updated_at?: string | null
          woocommerce_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "woocommerce_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      credit_score_distribution: {
        Row: {
          avg_score: number | null
          score_range: string | null
          user_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      atomic_charge_wallet_credit: {
        Args: {
          _charge_id: string
          _credit_amount?: number
          _currency?: string
          _merchant_id?: string
          _new_status: string
          _provider_raw?: Json
        }
        Returns: Json
      }
      atomic_dispute_wallet_adjust: {
        Args: {
          _amount: number
          _currency: string
          _direction?: string
          _merchant_id: string
        }
        Returns: Json
      }
      atomic_refund_wallet_debit: {
        Args: {
          _currency?: string
          _debit_amount?: number
          _merchant_id?: string
          _new_status: string
          _provider_raw?: Json
          _refund_id: string
        }
        Returns: Json
      }
      calculate_kyc_risk_score: { Args: { _user_id: string }; Returns: number }
      calculate_settlement_balance: {
        Args: {
          _institution_id: string
          _period_end: string
          _period_start: string
        }
        Returns: Json
      }
      calculate_transaction_fee: {
        Args: {
          _institution_id: string
          _transaction_amount: number
          _transaction_date?: string
          _transaction_type: string
        }
        Returns: Json
      }
      check_aisp_permission: {
        Args: { _consent_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      check_aisp_permission_with_account: {
        Args: {
          _account_id?: string
          _consent_id: string
          _permission: string
          _user_id: string
        }
        Returns: boolean
      }
      check_api_key_expiration: { Args: never; Returns: undefined }
      check_postiq_rate_limit: { Args: { p_user_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          _client_id: string
          _endpoint: string
          _limit: number
          _window_minutes: number
        }
        Returns: boolean
      }
      check_suspicious_login: {
        Args: { _ip_address: unknown; _user_agent: string; _user_id: string }
        Returns: Json
      }
      check_webhook_rate_limit: {
        Args: {
          _max_requests?: number
          _provider: string
          _window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_auth_codes: { Args: never; Returns: undefined }
      cleanup_expired_auth_records: { Args: never; Returns: undefined }
      cleanup_expired_certificates: { Args: never; Returns: undefined }
      cleanup_expired_idempotency_keys: { Args: never; Returns: undefined }
      cleanup_expired_oauth_sessions: { Args: never; Returns: undefined }
      cleanup_expired_par_requests: { Args: never; Returns: undefined }
      encrypt_sandbox_credentials: {
        Args: {
          _client_id: string
          _client_secret: string
          _institution_id: string
        }
        Returns: undefined
      }
      expire_old_consents: { Args: never; Returns: undefined }
      generate_compliance_report: {
        Args: { _end_date: string; _report_type: string; _start_date: string }
        Returns: string
      }
      generate_institution_invoice: {
        Args: {
          _admin_id: string
          _billing_cycle: string
          _institution_id: string
          _period_end: string
          _period_start: string
        }
        Returns: string
      }
      get_admin_portal_sections: {
        Args: { _user_id: string }
        Returns: {
          can_manage: boolean
          can_view: boolean
          section_key: string
        }[]
      }
      get_daily_fee_summary: {
        Args: {
          p_end_date?: string
          p_institution_id?: string
          p_start_date?: string
        }
        Returns: {
          average_fee_per_transaction: number
          fee_date: string
          institution_id: string
          institution_name: string
          total_calculated_fees: number
          total_final_fees: number
          total_transaction_volume: number
          total_waivers: number
          transaction_count: number
          transaction_type: string
        }[]
      }
      get_staff_institution_id: { Args: { _user_id: string }; Returns: string }
      get_staff_portal_sections: {
        Args: { _user_id: string }
        Returns: {
          can_manage: boolean
          can_view: boolean
          section_key: string
        }[]
      }
      get_user_postiq_verification: {
        Args: { p_user_id: string }
        Returns: {
          full_address: string
          postiq_code: string
          verified_at: string
        }[]
      }
      has_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _scope: Database["public"]["Enums"]["permission_scope"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_ip_address: { Args: { ip_address: unknown }; Returns: string }
      is_consent_valid: {
        Args: { _consent_id: string; _consent_type: string }
        Returns: boolean
      }
      is_institution_owner: {
        Args: { _institution_id: string; _user_id: string }
        Returns: boolean
      }
      is_institution_staff_admin: {
        Args: { _institution_id: string; _user_id: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _action_type: string
          _details?: Json
          _entity_id: string
          _entity_type: string
        }
        Returns: string
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
      log_security_event: {
        Args: {
          _event_category: string
          _event_type: string
          _ip_address?: unknown
          _metadata?: Json
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      make_user_admin: { Args: { _user_id: string }; Returns: undefined }
      record_transaction_fee: {
        Args: {
          _institution_id: string
          _metadata?: Json
          _transaction_amount: number
          _transaction_id?: string
          _transaction_ref: string
          _transaction_type: string
        }
        Returns: string
      }
      trigger_webhooks: {
        Args: { _client_id?: string; _event_data: Json; _event_type: string }
        Returns: undefined
      }
      update_bank_sync_status: {
        Args: {
          _connection_id: string
          _error_message?: string
          _status: string
        }
        Returns: undefined
      }
      update_merchant_wallet: {
        Args: {
          _available_delta?: number
          _currency: string
          _ledger_delta?: number
          _merchant_id: string
          _pending_delta?: number
        }
        Returns: undefined
      }
      validate_ip_whitelist: {
        Args: { _client_ip: unknown; _user_id: string }
        Returns: boolean
      }
      validate_password_strength: {
        Args: { password: string }
        Returns: boolean
      }
      validate_pisp_consent: {
        Args: { _amount: number; _consent_id: string; _user_id: string }
        Returns: Json
      }
      verify_sandbox_credentials: {
        Args: {
          _client_id: string
          _client_secret: string
          _institution_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_scheme: "LOCAL_BANK" | "MOMO" | "IBAN"
      account_subtype: "Current" | "Savings" | "CreditCard" | "Loan"
      account_type: "Business" | "Personal"
      app_role:
        | "admin"
        | "institution"
        | "moderator"
        | "personal"
        | "staff"
        | "merchant"
        | "tpp"
      card_funding_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      card_status: "active" | "inactive" | "blocked" | "cancelled"
      card_transaction_type: "authorization" | "capture" | "refund" | "reversal"
      consent_status:
        | "AwaitingAuthorisation"
        | "Authorised"
        | "Rejected"
        | "Revoked"
        | "Expired"
        | "Consumed"
      institution_status: "pending" | "approved" | "rejected" | "suspended"
      institution_type: "bank" | "credit_union" | "fintech" | "developer"
      loan_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "disbursed"
        | "active"
        | "completed"
        | "defaulted"
        | "written_off"
      loan_type:
        | "personal"
        | "business"
        | "emergency"
        | "salary_advance"
        | "asset_finance"
      payment_type:
        | "domestic"
        | "international"
        | "scheduled"
        | "standing_order"
        | "vrp"
      permission_action:
        | "view"
        | "create"
        | "update"
        | "delete"
        | "approve"
        | "export"
      permission_scope:
        | "users"
        | "transactions"
        | "accounts"
        | "reports"
        | "settings"
        | "compliance"
        | "api"
        | "branches"
        | "fees"
        | "webhooks"
        | "audit_logs"
      repayment_frequency:
        | "daily"
        | "weekly"
        | "biweekly"
        | "monthly"
        | "quarterly"
      savings_type:
        | "regular_savings"
        | "fixed_deposit"
        | "goal_savings"
        | "high_yield"
        | "kids_savings"
        | "emergency_fund"
      spending_limit_interval:
        | "per_authorization"
        | "daily"
        | "weekly"
        | "monthly"
        | "yearly"
        | "all_time"
      template_category:
        | "user_auth"
        | "institution_management"
        | "consent_management"
        | "payment_notifications"
        | "security_alerts"
        | "system_notifications"
        | "api_notifications"
      template_type: "email" | "sms"
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
      account_scheme: ["LOCAL_BANK", "MOMO", "IBAN"],
      account_subtype: ["Current", "Savings", "CreditCard", "Loan"],
      account_type: ["Business", "Personal"],
      app_role: [
        "admin",
        "institution",
        "moderator",
        "personal",
        "staff",
        "merchant",
        "tpp",
      ],
      card_funding_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      card_status: ["active", "inactive", "blocked", "cancelled"],
      card_transaction_type: ["authorization", "capture", "refund", "reversal"],
      consent_status: [
        "AwaitingAuthorisation",
        "Authorised",
        "Rejected",
        "Revoked",
        "Expired",
        "Consumed",
      ],
      institution_status: ["pending", "approved", "rejected", "suspended"],
      institution_type: ["bank", "credit_union", "fintech", "developer"],
      loan_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "disbursed",
        "active",
        "completed",
        "defaulted",
        "written_off",
      ],
      loan_type: [
        "personal",
        "business",
        "emergency",
        "salary_advance",
        "asset_finance",
      ],
      payment_type: [
        "domestic",
        "international",
        "scheduled",
        "standing_order",
        "vrp",
      ],
      permission_action: [
        "view",
        "create",
        "update",
        "delete",
        "approve",
        "export",
      ],
      permission_scope: [
        "users",
        "transactions",
        "accounts",
        "reports",
        "settings",
        "compliance",
        "api",
        "branches",
        "fees",
        "webhooks",
        "audit_logs",
      ],
      repayment_frequency: [
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
      ],
      savings_type: [
        "regular_savings",
        "fixed_deposit",
        "goal_savings",
        "high_yield",
        "kids_savings",
        "emergency_fund",
      ],
      spending_limit_interval: [
        "per_authorization",
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "all_time",
      ],
      template_category: [
        "user_auth",
        "institution_management",
        "consent_management",
        "payment_notifications",
        "security_alerts",
        "system_notifications",
        "api_notifications",
      ],
      template_type: ["email", "sms"],
    },
  },
} as const
