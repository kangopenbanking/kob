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
          refresh_token_id: string | null
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
          refresh_token_id?: string | null
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
          refresh_token_id?: string | null
          revoked_at?: string | null
          scope?: string
          token_hash?: string
          user_id?: string | null
        }
        Relationships: [
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
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_holder_name: string
          account_id: string
          account_subtype?: Database["public"]["Enums"]["account_subtype"]
          account_type?: Database["public"]["Enums"]["account_type"]
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
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_holder_name?: string
          account_id?: string
          account_subtype?: Database["public"]["Enums"]["account_subtype"]
          account_type?: Database["public"]["Enums"]["account_type"]
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
          client_id: string
          client_name: string
          client_secret_hash: string
          created_at: string | null
          grant_types: Json
          id: string
          institution_id: string | null
          is_active: boolean | null
          redirect_uris: Json
          scopes: Json
          updated_at: string | null
        }
        Insert: {
          client_id: string
          client_name: string
          client_secret_hash: string
          created_at?: string | null
          grant_types?: Json
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          redirect_uris?: Json
          scopes?: Json
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          client_name?: string
          client_secret_hash?: string
          created_at?: string | null
          grant_types?: Json
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          redirect_uris?: Json
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
          flutterwave_ref: string | null
          id: string
          metadata: Json | null
          narration: string | null
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
          flutterwave_ref?: string | null
          id?: string
          metadata?: Json | null
          narration?: string | null
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
          flutterwave_ref?: string | null
          id?: string
          metadata?: Json | null
          narration?: string | null
          status?: string
          transaction_ref?: string
          transaction_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
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
          completed_at: string | null
          created_at: string | null
          currency: string
          description: string | null
          error_message: string | null
          flutterwave_ref: string | null
          id: string
          metadata: Json | null
          mobile_account_id: string | null
          phone_number: string
          provider: string
          status: string
          transaction_ref: string
          transaction_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          error_message?: string | null
          flutterwave_ref?: string | null
          id?: string
          metadata?: Json | null
          mobile_account_id?: string | null
          phone_number: string
          provider: string
          status?: string
          transaction_ref: string
          transaction_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          error_message?: string | null
          flutterwave_ref?: string | null
          id?: string
          metadata?: Json | null
          mobile_account_id?: string | null
          phone_number?: string
          provider?: string
          status?: string
          transaction_ref?: string
          transaction_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobile_money_transactions_mobile_account_id_fkey"
            columns: ["mobile_account_id"]
            isOneToOne: false
            referencedRelation: "mobile_money_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      rate_limits: {
        Row: {
          client_id: string
          created_at: string | null
          endpoint: string
          id: string
          limit_exceeded: boolean | null
          request_count: number | null
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
          window_end?: string
          window_start?: string
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
      system_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          details: Json | null
          id: string
          is_acknowledged: boolean | null
          message: string
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          is_acknowledged?: boolean | null
          message: string
          severity: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          is_acknowledged?: boolean | null
          message?: string
          severity?: string
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
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          language: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          language?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          language?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      webhooks: {
        Row: {
          client_id: string
          created_at: string | null
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
          webhook_url: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
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
          webhook_url: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
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
    }
    Views: {
      daily_fee_summary: {
        Row: {
          average_fee_per_transaction: number | null
          fee_date: string | null
          institution_id: string | null
          institution_name: string | null
          total_calculated_fees: number | null
          total_final_fees: number | null
          total_transaction_volume: number | null
          total_waivers: number | null
          transaction_count: number | null
          transaction_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_fees_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_kyc_risk_score: { Args: { _user_id: string }; Returns: number }
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
      cleanup_expired_auth_codes: { Args: never; Returns: undefined }
      cleanup_expired_oauth_sessions: { Args: never; Returns: undefined }
      cleanup_expired_par_requests: { Args: never; Returns: undefined }
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
      validate_pisp_consent: {
        Args: { _amount: number; _consent_id: string; _user_id: string }
        Returns: Json
      }
    }
    Enums: {
      account_scheme: "LOCAL_BANK" | "MOMO" | "IBAN"
      account_subtype: "Current" | "Savings" | "CreditCard" | "Loan"
      account_type: "Business" | "Personal"
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
