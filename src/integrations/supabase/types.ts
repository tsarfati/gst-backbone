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
      account_associations: {
        Row: {
          account_id: string
          association_type: string
          company_id: string
          cost_code_id: string | null
          created_at: string | null
          created_by: string
          id: string
          job_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          association_type: string
          company_id: string
          cost_code_id?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          job_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          association_type?: string
          company_id?: string
          cost_code_id?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          job_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_associations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_associations_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_associations_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "account_associations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "account_associations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string
          balance_date: string | null
          bank_fee_account_id: string | null
          bank_name: string
          chart_account_id: string | null
          company_id: string
          created_at: string | null
          created_by: string
          current_balance: number | null
          description: string | null
          id: string
          initial_balance: number | null
          is_active: boolean | null
          routing_number: string | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type: string
          balance_date?: string | null
          bank_fee_account_id?: string | null
          bank_name: string
          chart_account_id?: string | null
          company_id: string
          created_at?: string | null
          created_by: string
          current_balance?: number | null
          description?: string | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          routing_number?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string
          balance_date?: string | null
          bank_fee_account_id?: string | null
          bank_name?: string
          chart_account_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string
          current_balance?: number | null
          description?: string | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          routing_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_bank_fee_account_id_fkey"
            columns: ["bank_fee_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliation_items: {
        Row: {
          amount: number
          cleared_at: string | null
          created_at: string
          id: string
          is_cleared: boolean
          reconciliation_id: string
          transaction_id: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          cleared_at?: string | null
          created_at?: string
          id?: string
          is_cleared?: boolean
          reconciliation_id: string
          transaction_id: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cleared_at?: string | null
          created_at?: string
          id?: string
          is_cleared?: boolean
          reconciliation_id?: string
          transaction_id?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliation_items_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "bank_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          adjusted_balance: number | null
          bank_account_id: string
          bank_statement_id: string | null
          beginning_balance: number
          beginning_date: string
          cleared_balance: number | null
          company_id: string
          created_at: string
          created_by: string
          ending_balance: number
          ending_date: string
          id: string
          notes: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          adjusted_balance?: number | null
          bank_account_id: string
          bank_statement_id?: string | null
          beginning_balance: number
          beginning_date: string
          cleared_balance?: number | null
          company_id: string
          created_at?: string
          created_by: string
          ending_balance: number
          ending_date: string
          id?: string
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          adjusted_balance?: number | null
          bank_account_id?: string
          bank_statement_id?: string | null
          beginning_balance?: number
          beginning_date?: string
          cleared_balance?: number | null
          company_id?: string
          created_at?: string
          created_by?: string
          ending_balance?: number
          ending_date?: string
          id?: string
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_bank_statement_id_fkey"
            columns: ["bank_statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          company_id: string
          created_at: string
          display_name: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          notes: string | null
          statement_date: string
          statement_month: number
          statement_year: number
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          bank_account_id: string
          company_id: string
          created_at?: string
          display_name?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          notes?: string | null
          statement_date: string
          statement_month: number
          statement_year: number
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          bank_account_id?: string
          company_id?: string
          created_at?: string
          display_name?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          notes?: string | null
          statement_date?: string
          statement_month?: number
          statement_year?: number
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_communications: {
        Row: {
          bill_id: string
          company_id: string
          created_at: string
          id: string
          message: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_id: string
          company_id: string
          created_at?: string
          id?: string
          message: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_id?: string
          company_id?: string
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_communications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          call_status: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          property_id: string
          started_at: string
          visitor_message: string | null
          visitor_name: string | null
          visitor_phone: string | null
        }
        Insert: {
          answered_at?: string | null
          call_status?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          property_id: string
          started_at?: string
          visitor_message?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Update: {
          answered_at?: string | null
          call_status?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          property_id?: string
          started_at?: string
          visitor_message?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_category: string | null
          account_name: string
          account_number: string
          account_type: string
          company_id: string
          created_at: string
          created_by: string
          current_balance: number | null
          id: string
          is_active: boolean
          is_system_account: boolean | null
          normal_balance: string | null
          parent_account_id: string | null
          require_attachment: boolean
          updated_at: string
        }
        Insert: {
          account_category?: string | null
          account_name: string
          account_number: string
          account_type: string
          company_id: string
          created_at?: string
          created_by: string
          current_balance?: number | null
          id?: string
          is_active?: boolean
          is_system_account?: boolean | null
          normal_balance?: string | null
          parent_account_id?: string | null
          require_attachment?: boolean
          updated_at?: string
        }
        Update: {
          account_category?: string | null
          account_name?: string
          account_number?: string
          account_type?: string
          company_id?: string
          created_at?: string
          created_by?: string
          current_balance?: number | null
          id?: string
          is_active?: boolean
          is_system_account?: boolean | null
          normal_balance?: string | null
          parent_account_id?: string | null
          require_attachment?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          allow_journal_entry_deletion: boolean
          city: string | null
          created_at: string
          created_by: string
          display_name: string | null
          email: string | null
          enable_shared_vendor_database: boolean
          id: string
          is_active: boolean
          license_number: string | null
          logo_url: string | null
          name: string
          phone: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          allow_journal_entry_deletion?: boolean
          city?: string | null
          created_at?: string
          created_by: string
          display_name?: string | null
          email?: string | null
          enable_shared_vendor_database?: boolean
          id?: string
          is_active?: boolean
          license_number?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          allow_journal_entry_deletion?: boolean
          city?: string | null
          created_at?: string
          created_by?: string
          display_name?: string | null
          email?: string | null
          enable_shared_vendor_database?: boolean
          id?: string
          is_active?: boolean
          license_number?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      company_access_requests: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_audit_log: {
        Row: {
          action: string
          changed_by: string
          company_id: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_by: string
          company_id: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string
          company_id?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          payment_terms_options: string[]
          require_bill_approval: boolean
          updated_at: string
          use_accrual_accounting: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          payment_terms_options?: string[]
          require_bill_approval?: boolean
          updated_at?: string
          use_accrual_accounting?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          payment_terms_options?: string[]
          require_bill_approval?: boolean
          updated_at?: string
          use_accrual_accounting?: boolean
        }
        Relationships: []
      }
      company_sms_settings: {
        Row: {
          account_sid: string | null
          auth_token: string | null
          company_id: string
          created_at: string
          created_by: string
          id: string
          phone_number: string | null
          provider: string
          sms_enabled: boolean
          updated_at: string
        }
        Insert: {
          account_sid?: string | null
          auth_token?: string | null
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          phone_number?: string | null
          provider?: string
          sms_enabled?: boolean
          updated_at?: string
        }
        Update: {
          account_sid?: string | null
          auth_token?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          phone_number?: string | null
          provider?: string
          sms_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sms_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_ui_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cost_codes: {
        Row: {
          chart_account_id: string | null
          chart_account_number: string | null
          code: string
          company_id: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_dynamic_group: boolean | null
          job_id: string | null
          parent_cost_code_id: string | null
          require_attachment: boolean
          type: Database["public"]["Enums"]["cost_code_type"] | null
          updated_at: string
        }
        Insert: {
          chart_account_id?: string | null
          chart_account_number?: string | null
          code: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          is_dynamic_group?: boolean | null
          job_id?: string | null
          parent_cost_code_id?: string | null
          require_attachment?: boolean
          type?: Database["public"]["Enums"]["cost_code_type"] | null
          updated_at?: string
        }
        Update: {
          chart_account_id?: string | null
          chart_account_number?: string | null
          code?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_dynamic_group?: boolean | null
          job_id?: string | null
          parent_cost_code_id?: string | null
          require_attachment?: boolean
          type?: Database["public"]["Enums"]["cost_code_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_codes_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_codes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "cost_codes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_codes_parent_cost_code_id_fkey"
            columns: ["parent_cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_codes_parent_cost_code_id_fkey"
            columns: ["parent_cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
        ]
      }
      credit_card_coding_requests: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          message: string | null
          requested_by: string
          requested_coder_id: string
          status: string
          transaction_id: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requested_by: string
          requested_coder_id: string
          status?: string
          transaction_id: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requested_by?: string
          requested_coder_id?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_coding_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_coding_requests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_card_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_csv_formats: {
        Row: {
          amount_format: string
          columns: Json
          company_id: string
          created_at: string
          created_by: string | null
          date_format: string
          delimiter: string
          format_name: string
          has_header: boolean
          id: string
          updated_at: string
        }
        Insert: {
          amount_format?: string
          columns: Json
          company_id: string
          created_at?: string
          created_by?: string | null
          date_format?: string
          delimiter?: string
          format_name: string
          has_header?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          amount_format?: string
          columns?: Json
          company_id?: string
          created_at?: string
          created_by?: string | null
          date_format?: string
          delimiter?: string
          format_name?: string
          has_header?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_csv_formats_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_statements: {
        Row: {
          company_id: string
          created_at: string
          credit_card_id: string
          display_name: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          notes: string | null
          statement_date: string
          statement_month: number
          statement_year: number
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          credit_card_id: string
          display_name?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          notes?: string | null
          statement_date: string
          statement_month: number
          statement_year: number
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          company_id?: string
          created_at?: string
          credit_card_id?: string
          display_name?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          notes?: string | null
          statement_date?: string
          statement_month?: number
          statement_year?: number
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_statements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_statements_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_transaction_communications: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_transaction_communications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transaction_communications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_card_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_transaction_distributions: {
        Row: {
          amount: number
          company_id: string
          cost_code_id: string | null
          created_at: string
          created_by: string | null
          id: string
          job_id: string | null
          percentage: number
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          company_id: string
          cost_code_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          percentage?: number
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          cost_code_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          percentage?: number
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_transaction_distributions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transaction_distributions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transaction_distributions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "credit_card_transaction_distributions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "credit_card_transaction_distributions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transaction_distributions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_card_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_transactions: {
        Row: {
          amount: number
          attachment_url: string | null
          bypass_attachment_requirement: boolean | null
          category: string | null
          chart_account_id: string | null
          coding_status: string | null
          company_id: string
          cost_code_id: string | null
          created_at: string | null
          created_by: string
          credit_card_id: string
          description: string
          id: string
          imported_from_csv: boolean | null
          invoice_id: string | null
          is_reconciled: boolean | null
          job_id: string | null
          journal_entry_id: string | null
          match_confirmed: boolean | null
          matched_bill_id: string | null
          matched_payment_id: string | null
          matched_receipt_id: string | null
          merchant_name: string | null
          notes: string | null
          post_date: string | null
          receipt_id: string | null
          reference_number: string | null
          requested_coder_id: string | null
          transaction_date: string
          transaction_type: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          bypass_attachment_requirement?: boolean | null
          category?: string | null
          chart_account_id?: string | null
          coding_status?: string | null
          company_id: string
          cost_code_id?: string | null
          created_at?: string | null
          created_by: string
          credit_card_id: string
          description: string
          id?: string
          imported_from_csv?: boolean | null
          invoice_id?: string | null
          is_reconciled?: boolean | null
          job_id?: string | null
          journal_entry_id?: string | null
          match_confirmed?: boolean | null
          matched_bill_id?: string | null
          matched_payment_id?: string | null
          matched_receipt_id?: string | null
          merchant_name?: string | null
          notes?: string | null
          post_date?: string | null
          receipt_id?: string | null
          reference_number?: string | null
          requested_coder_id?: string | null
          transaction_date: string
          transaction_type?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          bypass_attachment_requirement?: boolean | null
          category?: string | null
          chart_account_id?: string | null
          coding_status?: string | null
          company_id?: string
          cost_code_id?: string | null
          created_at?: string | null
          created_by?: string
          credit_card_id?: string
          description?: string
          id?: string
          imported_from_csv?: boolean | null
          invoice_id?: string | null
          is_reconciled?: boolean | null
          job_id?: string | null
          journal_entry_id?: string | null
          match_confirmed?: boolean | null
          matched_bill_id?: string | null
          matched_payment_id?: string | null
          matched_receipt_id?: string | null
          merchant_name?: string | null
          notes?: string | null
          post_date?: string | null
          receipt_id?: string | null
          reference_number?: string | null
          requested_coder_id?: string | null
          transaction_date?: string
          transaction_type?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_transactions_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "credit_card_transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "credit_card_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_requested_coder_id_fkey"
            columns: ["requested_coder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "credit_card_transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          card_name: string
          card_number_last_four: string
          card_type: string | null
          cardholder_name: string
          company_id: string
          created_at: string
          created_by: string
          credit_limit: number | null
          csv_format_id: string | null
          csv_import_count: number | null
          current_balance: number | null
          description: string | null
          due_date: string | null
          id: string
          interest_rate: number | null
          is_active: boolean
          issuer: string
          last_csv_import_by: string | null
          last_csv_import_date: string | null
          liability_account_id: string | null
          updated_at: string
        }
        Insert: {
          card_name: string
          card_number_last_four: string
          card_type?: string | null
          cardholder_name: string
          company_id: string
          created_at?: string
          created_by: string
          credit_limit?: number | null
          csv_format_id?: string | null
          csv_import_count?: number | null
          current_balance?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          is_active?: boolean
          issuer: string
          last_csv_import_by?: string | null
          last_csv_import_date?: string | null
          liability_account_id?: string | null
          updated_at?: string
        }
        Update: {
          card_name?: string
          card_number_last_four?: string
          card_type?: string | null
          cardholder_name?: string
          company_id?: string
          created_at?: string
          created_by?: string
          credit_limit?: number | null
          csv_format_id?: string | null
          csv_import_count?: number | null
          current_balance?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          is_active?: boolean
          issuer?: string
          last_csv_import_by?: string | null
          last_csv_import_date?: string | null
          liability_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_liability_account_id_fkey"
            columns: ["liability_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      current_punch_status: {
        Row: {
          cost_code_id: string | null
          created_at: string
          id: string
          is_active: boolean
          job_id: string | null
          punch_in_location_lat: number | null
          punch_in_location_lng: number | null
          punch_in_photo_url: string | null
          punch_in_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_code_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          job_id?: string | null
          punch_in_location_lat?: number | null
          punch_in_location_lng?: number | null
          punch_in_photo_url?: string | null
          punch_in_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_code_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          job_id?: string | null
          punch_in_location_lat?: number | null
          punch_in_location_lng?: number | null
          punch_in_photo_url?: string | null
          punch_in_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "current_punch_status_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "current_punch_status_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "current_punch_status_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "current_punch_status_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_role_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          custom_role_id: string
          id: string
          menu_item: string
          updated_at: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          custom_role_id: string
          id?: string
          menu_item: string
          updated_at?: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          custom_role_id?: string
          id?: string
          menu_item?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_permissions_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          role_key: string
          role_name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          role_key: string
          role_name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          role_key?: string
          role_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          show_active_jobs: boolean
          show_bills_overview: boolean | null
          show_budget_tracking: boolean | null
          show_employee_attendance: boolean | null
          show_invoice_summary: boolean | null
          show_invoices: boolean
          show_messages: boolean
          show_notifications: boolean
          show_overtime_alerts: boolean | null
          show_payment_status: boolean | null
          show_project_progress: boolean | null
          show_punch_clock_status: boolean | null
          show_recent_activity: boolean
          show_resource_allocation: boolean | null
          show_stats: boolean
          show_task_deadlines: boolean | null
          show_timesheet_approval: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          show_active_jobs?: boolean
          show_bills_overview?: boolean | null
          show_budget_tracking?: boolean | null
          show_employee_attendance?: boolean | null
          show_invoice_summary?: boolean | null
          show_invoices?: boolean
          show_messages?: boolean
          show_notifications?: boolean
          show_overtime_alerts?: boolean | null
          show_payment_status?: boolean | null
          show_project_progress?: boolean | null
          show_punch_clock_status?: boolean | null
          show_recent_activity?: boolean
          show_resource_allocation?: boolean | null
          show_stats?: boolean
          show_task_deadlines?: boolean | null
          show_timesheet_approval?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          show_active_jobs?: boolean
          show_bills_overview?: boolean | null
          show_budget_tracking?: boolean | null
          show_employee_attendance?: boolean | null
          show_invoice_summary?: boolean | null
          show_invoices?: boolean
          show_messages?: boolean
          show_notifications?: boolean
          show_overtime_alerts?: boolean | null
          show_payment_status?: boolean | null
          show_project_progress?: boolean | null
          show_punch_clock_status?: boolean | null
          show_recent_activity?: boolean
          show_resource_allocation?: boolean | null
          show_stats?: boolean
          show_task_deadlines?: boolean | null
          show_timesheet_approval?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_ticket_audit: {
        Row: {
          change_type: string
          changed_by: string
          created_at: string
          delivery_ticket_id: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          change_type: string
          changed_by: string
          created_at?: string
          delivery_ticket_id: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          change_type?: string
          changed_by?: string
          created_at?: string
          delivery_ticket_id?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_ticket_audit_delivery_ticket_id_fkey"
            columns: ["delivery_ticket_id"]
            isOneToOne: false
            referencedRelation: "delivery_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_tickets: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string
          delivery_date: string
          delivery_slip_photo_url: string | null
          description: string | null
          id: string
          job_id: string
          material_photo_url: string | null
          notes: string | null
          photo_url: string | null
          received_by: string | null
          ticket_number: string | null
          updated_at: string | null
          vendor_name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by: string
          delivery_date?: string
          delivery_slip_photo_url?: string | null
          description?: string | null
          id?: string
          job_id: string
          material_photo_url?: string | null
          notes?: string | null
          photo_url?: string | null
          received_by?: string | null
          ticket_number?: string | null
          updated_at?: string | null
          vendor_name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string
          delivery_date?: string
          delivery_slip_photo_url?: string | null
          description?: string | null
          id?: string
          job_id?: string
          material_photo_url?: string | null
          notes?: string | null
          photo_url?: string | null
          received_by?: string | null
          ticket_number?: string | null
          updated_at?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tickets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "delivery_tickets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_history: {
        Row: {
          company_id: string
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          sent_at: string
          status: string
          subject: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          sent_at?: string
          status?: string
          subject: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          sent_at?: string
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          editor_type: Database["public"]["Enums"]["template_editor"]
          html_content: string
          id: string
          key: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          editor_type?: Database["public"]["Enums"]["template_editor"]
          html_content: string
          id?: string
          key: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          editor_type?: Database["public"]["Enums"]["template_editor"]
          html_content?: string
          id?: string
          key?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_group_members: {
        Row: {
          created_at: string
          created_by: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "employee_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_groups: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_timecard_settings: {
        Row: {
          allow_early_punch_in_minutes: number | null
          allow_late_punch_out_minutes: number | null
          assigned_cost_codes: string[] | null
          assigned_jobs: string[] | null
          auto_lunch_deduction: boolean | null
          company_id: string
          created_at: string | null
          created_by: string
          default_cost_code_id: string | null
          default_job_id: string | null
          id: string
          lunch_duration_minutes: number | null
          max_daily_hours: number | null
          notes: string | null
          notification_preferences: Json | null
          overtime_threshold: number | null
          require_location: boolean | null
          require_photo: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allow_early_punch_in_minutes?: number | null
          allow_late_punch_out_minutes?: number | null
          assigned_cost_codes?: string[] | null
          assigned_jobs?: string[] | null
          auto_lunch_deduction?: boolean | null
          company_id: string
          created_at?: string | null
          created_by: string
          default_cost_code_id?: string | null
          default_job_id?: string | null
          id?: string
          lunch_duration_minutes?: number | null
          max_daily_hours?: number | null
          notes?: string | null
          notification_preferences?: Json | null
          overtime_threshold?: number | null
          require_location?: boolean | null
          require_photo?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allow_early_punch_in_minutes?: number | null
          allow_late_punch_out_minutes?: number | null
          assigned_cost_codes?: string[] | null
          assigned_jobs?: string[] | null
          auto_lunch_deduction?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string
          default_cost_code_id?: string | null
          default_job_id?: string | null
          id?: string
          lunch_duration_minutes?: number | null
          max_daily_hours?: number | null
          notes?: string | null
          notification_preferences?: Json | null
          overtime_threshold?: number | null
          require_location?: boolean | null
          require_photo?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      file_upload_settings: {
        Row: {
          bank_statement_naming_pattern: string | null
          bill_naming_pattern: string | null
          company_id: string
          created_at: string | null
          created_by: string
          enable_ftp: boolean | null
          enable_google_drive: boolean | null
          enable_onedrive: boolean | null
          ftp_folder_path: string | null
          ftp_host: string | null
          ftp_password: string | null
          ftp_port: number | null
          ftp_username: string | null
          google_drive_folder_id: string | null
          id: string
          naming_variables: Json | null
          onedrive_folder_id: string | null
          receipt_naming_pattern: string | null
          subcontract_naming_pattern: string | null
          updated_at: string | null
        }
        Insert: {
          bank_statement_naming_pattern?: string | null
          bill_naming_pattern?: string | null
          company_id: string
          created_at?: string | null
          created_by: string
          enable_ftp?: boolean | null
          enable_google_drive?: boolean | null
          enable_onedrive?: boolean | null
          ftp_folder_path?: string | null
          ftp_host?: string | null
          ftp_password?: string | null
          ftp_port?: number | null
          ftp_username?: string | null
          google_drive_folder_id?: string | null
          id?: string
          naming_variables?: Json | null
          onedrive_folder_id?: string | null
          receipt_naming_pattern?: string | null
          subcontract_naming_pattern?: string | null
          updated_at?: string | null
        }
        Update: {
          bank_statement_naming_pattern?: string | null
          bill_naming_pattern?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string
          enable_ftp?: boolean | null
          enable_google_drive?: boolean | null
          enable_onedrive?: boolean | null
          ftp_folder_path?: string | null
          ftp_host?: string | null
          ftp_password?: string | null
          ftp_port?: number | null
          ftp_username?: string | null
          google_drive_folder_id?: string | null
          id?: string
          naming_variables?: Json | null
          onedrive_folder_id?: string | null
          receipt_naming_pattern?: string | null
          subcontract_naming_pattern?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_upload_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_audit_trail: {
        Row: {
          change_type: string
          changed_by: string
          created_at: string
          field_name: string | null
          id: string
          invoice_id: string | null
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          change_type: string
          changed_by: string
          created_at?: string
          field_name?: string | null
          id?: string
          invoice_id?: string | null
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          change_type?: string
          changed_by?: string
          created_at?: string
          field_name?: string | null
          id?: string
          invoice_id?: string | null
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_audit_trail_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_cost_distributions: {
        Row: {
          amount: number
          cost_code_id: string
          created_at: string
          id: string
          invoice_id: string
          percentage: number
          updated_at: string
        }
        Insert: {
          amount: number
          cost_code_id: string
          created_at?: string
          id?: string
          invoice_id: string
          percentage: number
          updated_at?: string
        }
        Update: {
          amount?: number
          cost_code_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_cost_distributions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_cost_distributions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "invoice_cost_distributions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          invoice_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          invoice_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          invoice_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          assigned_to_pm: string | null
          bill_category: string | null
          cost_code_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          file_url: string | null
          id: string
          internal_notes: Json | null
          invoice_number: string | null
          is_reimbursement: boolean
          is_subcontract_invoice: boolean
          issue_date: string | null
          job_id: string | null
          payment_terms: string | null
          pending_coding: boolean | null
          purchase_order_id: string | null
          retainage_amount: number | null
          retainage_percentage: number | null
          status: string
          subcontract_id: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          assigned_to_pm?: string | null
          bill_category?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          internal_notes?: Json | null
          invoice_number?: string | null
          is_reimbursement?: boolean
          is_subcontract_invoice?: boolean
          issue_date?: string | null
          job_id?: string | null
          payment_terms?: string | null
          pending_coding?: boolean | null
          purchase_order_id?: string | null
          retainage_amount?: number | null
          retainage_percentage?: number | null
          status?: string
          subcontract_id?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          assigned_to_pm?: string | null
          bill_category?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          internal_notes?: Json | null
          invoice_number?: string | null
          is_reimbursement?: boolean
          is_subcontract_invoice?: boolean
          issue_date?: string | null
          job_id?: string | null
          payment_terms?: string | null
          pending_coding?: boolean | null
          purchase_order_id?: string | null
          retainage_amount?: number | null
          retainage_percentage?: number | null
          status?: string
          subcontract_id?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subcontract_id_fkey"
            columns: ["subcontract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assistant_managers: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: []
      }
      job_bill_approval_settings: {
        Row: {
          approval_roles: string[] | null
          approver_user_ids: string[] | null
          company_id: string
          created_at: string
          created_by: string
          id: string
          job_id: string
          require_approval: boolean
          updated_at: string
        }
        Insert: {
          approval_roles?: string[] | null
          approver_user_ids?: string[] | null
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          job_id: string
          require_approval?: boolean
          updated_at?: string
        }
        Update: {
          approval_roles?: string[] | null
          approver_user_ids?: string[] | null
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          job_id?: string
          require_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      job_budget_forecasts: {
        Row: {
          cost_code_id: string
          created_at: string
          estimated_percent_complete: number | null
          id: string
          job_id: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cost_code_id: string
          created_at?: string
          estimated_percent_complete?: number | null
          id?: string
          job_id: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cost_code_id?: string
          created_at?: string
          estimated_percent_complete?: number | null
          id?: string
          job_id?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_budget_forecasts_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_budget_forecasts_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "job_budget_forecasts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_budget_forecasts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_budgets: {
        Row: {
          actual_amount: number
          budgeted_amount: number
          committed_amount: number
          cost_code_id: string
          created_at: string
          created_by: string
          id: string
          is_dynamic: boolean | null
          job_id: string
          parent_budget_id: string | null
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          budgeted_amount?: number
          committed_amount?: number
          cost_code_id: string
          created_at?: string
          created_by: string
          id?: string
          is_dynamic?: boolean | null
          job_id: string
          parent_budget_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          budgeted_amount?: number
          committed_amount?: number
          cost_code_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_dynamic?: boolean | null
          job_id?: string
          parent_budget_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_budgets_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_budgets_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "job_budgets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_budgets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_budgets_parent_budget_id_fkey"
            columns: ["parent_budget_id"]
            isOneToOne: false
            referencedRelation: "dynamic_budget_summary"
            referencedColumns: ["parent_budget_id"]
          },
          {
            foreignKeyName: "job_budgets_parent_budget_id_fkey"
            columns: ["parent_budget_id"]
            isOneToOne: false
            referencedRelation: "job_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      job_permits: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          file_name: string
          file_url: string
          id: string
          job_id: string
          permit_name: string
          permit_number: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_url: string
          id?: string
          job_id: string
          permit_name: string
          permit_number?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_url?: string
          id?: string
          job_id?: string
          permit_name?: string
          permit_number?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_permits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_permits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_permits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          album_id: string | null
          created_at: string
          id: string
          job_id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          note: string | null
          photo_url: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          album_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          note?: string | null
          photo_url: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          album_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          note?: string | null
          photo_url?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "photo_albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_plans: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          job_id: string
          plan_name: string
          plan_number: string | null
          revision: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          job_id: string
          plan_name: string
          plan_number?: string | null
          revision?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          job_id?: string
          plan_name?: string
          plan_number?: string | null
          revision?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      job_punch_clock_settings: {
        Row: {
          allow_early_punch_in: boolean | null
          allow_manual_entry: boolean | null
          auto_break_duration: number | null
          auto_break_wait_hours: number | null
          calculate_overtime: boolean | null
          company_id: string
          company_policies: string | null
          cost_code_selection_timing: string | null
          count_early_punch_time: boolean | null
          count_late_punch_in: boolean | null
          created_at: string
          created_by: string
          earliest_punch_start_time: string | null
          early_punch_in_buffer_minutes: number | null
          enable_distance_warning: boolean | null
          enable_install_prompt: boolean | null
          enable_punch_rounding: boolean | null
          flag_timecards_over_12hrs: boolean | null
          flag_timecards_over_24hrs: boolean | null
          grace_period_minutes: number | null
          id: string
          job_id: string | null
          late_grace_period_minutes: number | null
          latest_punch_in_time: string | null
          location_accuracy_meters: number | null
          manager_approval_required: boolean | null
          manual_photo_capture: boolean | null
          max_distance_from_job_meters: number | null
          notification_enabled: boolean | null
          overtime_grace_period_minutes: number | null
          overtime_past_window_threshold_minutes: number | null
          overtime_threshold: number | null
          punch_rounding_direction: string | null
          punch_rounding_minutes: number | null
          punch_time_window_end: string | null
          punch_time_window_start: string | null
          pwa_icon_192_url: string | null
          pwa_icon_512_url: string | null
          require_location: boolean | null
          require_photo: boolean | null
          require_timecard_change_approval: boolean | null
          scheduled_start_time: string | null
          shift_end_time: string | null
          shift_hours: number | null
          shift_start_time: string | null
          show_install_button: boolean | null
          sms_punchout_reminder_enabled: boolean | null
          sms_punchout_reminder_minutes: number | null
          time_display_format: string | null
          updated_at: string
        }
        Insert: {
          allow_early_punch_in?: boolean | null
          allow_manual_entry?: boolean | null
          auto_break_duration?: number | null
          auto_break_wait_hours?: number | null
          calculate_overtime?: boolean | null
          company_id: string
          company_policies?: string | null
          cost_code_selection_timing?: string | null
          count_early_punch_time?: boolean | null
          count_late_punch_in?: boolean | null
          created_at?: string
          created_by: string
          earliest_punch_start_time?: string | null
          early_punch_in_buffer_minutes?: number | null
          enable_distance_warning?: boolean | null
          enable_install_prompt?: boolean | null
          enable_punch_rounding?: boolean | null
          flag_timecards_over_12hrs?: boolean | null
          flag_timecards_over_24hrs?: boolean | null
          grace_period_minutes?: number | null
          id?: string
          job_id?: string | null
          late_grace_period_minutes?: number | null
          latest_punch_in_time?: string | null
          location_accuracy_meters?: number | null
          manager_approval_required?: boolean | null
          manual_photo_capture?: boolean | null
          max_distance_from_job_meters?: number | null
          notification_enabled?: boolean | null
          overtime_grace_period_minutes?: number | null
          overtime_past_window_threshold_minutes?: number | null
          overtime_threshold?: number | null
          punch_rounding_direction?: string | null
          punch_rounding_minutes?: number | null
          punch_time_window_end?: string | null
          punch_time_window_start?: string | null
          pwa_icon_192_url?: string | null
          pwa_icon_512_url?: string | null
          require_location?: boolean | null
          require_photo?: boolean | null
          require_timecard_change_approval?: boolean | null
          scheduled_start_time?: string | null
          shift_end_time?: string | null
          shift_hours?: number | null
          shift_start_time?: string | null
          show_install_button?: boolean | null
          sms_punchout_reminder_enabled?: boolean | null
          sms_punchout_reminder_minutes?: number | null
          time_display_format?: string | null
          updated_at?: string
        }
        Update: {
          allow_early_punch_in?: boolean | null
          allow_manual_entry?: boolean | null
          auto_break_duration?: number | null
          auto_break_wait_hours?: number | null
          calculate_overtime?: boolean | null
          company_id?: string
          company_policies?: string | null
          cost_code_selection_timing?: string | null
          count_early_punch_time?: boolean | null
          count_late_punch_in?: boolean | null
          created_at?: string
          created_by?: string
          earliest_punch_start_time?: string | null
          early_punch_in_buffer_minutes?: number | null
          enable_distance_warning?: boolean | null
          enable_install_prompt?: boolean | null
          enable_punch_rounding?: boolean | null
          flag_timecards_over_12hrs?: boolean | null
          flag_timecards_over_24hrs?: boolean | null
          grace_period_minutes?: number | null
          id?: string
          job_id?: string | null
          late_grace_period_minutes?: number | null
          latest_punch_in_time?: string | null
          location_accuracy_meters?: number | null
          manager_approval_required?: boolean | null
          manual_photo_capture?: boolean | null
          max_distance_from_job_meters?: number | null
          notification_enabled?: boolean | null
          overtime_grace_period_minutes?: number | null
          overtime_past_window_threshold_minutes?: number | null
          overtime_threshold?: number | null
          punch_rounding_direction?: string | null
          punch_rounding_minutes?: number | null
          punch_time_window_end?: string | null
          punch_time_window_start?: string | null
          pwa_icon_192_url?: string | null
          pwa_icon_512_url?: string | null
          require_location?: boolean | null
          require_photo?: boolean | null
          require_timecard_change_approval?: boolean | null
          scheduled_start_time?: string | null
          shift_end_time?: string | null
          shift_hours?: number | null
          shift_start_time?: string | null
          show_install_button?: boolean | null
          sms_punchout_reminder_enabled?: boolean | null
          sms_punchout_reminder_minutes?: number | null
          time_display_format?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_punch_clock_settings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_punch_clock_settings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_settings: {
        Row: {
          allow_status_change_roles: string[]
          auto_assign_pm_role: string | null
          auto_create_default_cost_codes: boolean
          budget_approval_roles: string[]
          budget_approval_threshold: number
          budget_change_approval_percentage: number | null
          budget_require_approval: boolean
          company_id: string
          created_at: string
          created_by: string
          default_cost_codes: string[] | null
          default_job_status: string | null
          id: string
          overtime_approval_required: boolean
          overtime_approval_threshold: number | null
          po_required_fields: Json | null
          require_budget: boolean
          require_completion_approval: boolean
          require_cost_codes: boolean
          require_job_description: boolean
          require_project_manager: boolean
          require_start_date: boolean
          require_timecard_approval: boolean
          subcontract_required_fields: Json | null
          timecard_approval_roles: string[]
          updated_at: string
        }
        Insert: {
          allow_status_change_roles?: string[]
          auto_assign_pm_role?: string | null
          auto_create_default_cost_codes?: boolean
          budget_approval_roles?: string[]
          budget_approval_threshold?: number
          budget_change_approval_percentage?: number | null
          budget_require_approval?: boolean
          company_id: string
          created_at?: string
          created_by: string
          default_cost_codes?: string[] | null
          default_job_status?: string | null
          id?: string
          overtime_approval_required?: boolean
          overtime_approval_threshold?: number | null
          po_required_fields?: Json | null
          require_budget?: boolean
          require_completion_approval?: boolean
          require_cost_codes?: boolean
          require_job_description?: boolean
          require_project_manager?: boolean
          require_start_date?: boolean
          require_timecard_approval?: boolean
          subcontract_required_fields?: Json | null
          timecard_approval_roles?: string[]
          updated_at?: string
        }
        Update: {
          allow_status_change_roles?: string[]
          auto_assign_pm_role?: string | null
          auto_create_default_cost_codes?: boolean
          budget_approval_roles?: string[]
          budget_approval_threshold?: number
          budget_change_approval_percentage?: number | null
          budget_require_approval?: boolean
          company_id?: string
          created_at?: string
          created_by?: string
          default_cost_codes?: string[] | null
          default_job_status?: string | null
          id?: string
          overtime_approval_required?: boolean
          overtime_approval_threshold?: number | null
          po_required_fields?: Json | null
          require_budget?: boolean
          require_completion_approval?: boolean
          require_cost_codes?: boolean
          require_job_description?: boolean
          require_project_manager?: boolean
          require_start_date?: boolean
          require_timecard_approval?: boolean
          subcontract_required_fields?: Json | null
          timecard_approval_roles?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      job_subcontractors: {
        Row: {
          company_name: string
          contact_person: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          is_active: boolean
          job_id: string
          phone: string | null
        }
        Insert: {
          company_name: string
          contact_person?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          is_active?: boolean
          job_id: string
          phone?: string | null
        }
        Update: {
          company_name?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          is_active?: boolean
          job_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          address: string | null
          banner_url: string | null
          budget: number | null
          budget_total: number | null
          client: string | null
          company_id: string
          count_early_punch_in: boolean | null
          count_late_punch_out: boolean | null
          created_at: string
          created_by: string
          description: string | null
          early_punch_in_grace_minutes: number | null
          end_date: string | null
          id: string
          is_active: boolean
          job_type: Database["public"]["Enums"]["job_type"] | null
          late_punch_out_grace_minutes: number | null
          latitude: number | null
          longitude: number | null
          name: string
          project_manager_user_id: string | null
          require_pm_bill_approval: boolean | null
          revenue_account_id: string | null
          shift_end_time: string | null
          shift_start_time: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          updated_at: string
          visitor_qr_code: string | null
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          budget?: number | null
          budget_total?: number | null
          client?: string | null
          company_id: string
          count_early_punch_in?: boolean | null
          count_late_punch_out?: boolean | null
          created_at?: string
          created_by: string
          description?: string | null
          early_punch_in_grace_minutes?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          job_type?: Database["public"]["Enums"]["job_type"] | null
          late_punch_out_grace_minutes?: number | null
          latitude?: number | null
          longitude?: number | null
          name: string
          project_manager_user_id?: string | null
          require_pm_bill_approval?: boolean | null
          revenue_account_id?: string | null
          shift_end_time?: string | null
          shift_start_time?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          updated_at?: string
          visitor_qr_code?: string | null
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          budget?: number | null
          budget_total?: number | null
          client?: string | null
          company_id?: string
          count_early_punch_in?: boolean | null
          count_late_punch_out?: boolean | null
          created_at?: string
          created_by?: string
          description?: string | null
          early_punch_in_grace_minutes?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          job_type?: Database["public"]["Enums"]["job_type"] | null
          late_punch_out_grace_minutes?: number | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          project_manager_user_id?: string | null
          require_pm_bill_approval?: boolean | null
          revenue_account_id?: string | null
          shift_end_time?: string | null
          shift_start_time?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          updated_at?: string
          visitor_qr_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "jobs_project_manager_user_id_fkey"
            columns: ["project_manager_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "jobs_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string
          entry_date: string
          id: string
          is_reversed: boolean | null
          job_id: string | null
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          reversal_date: string | null
          reversed_by_entry_id: string | null
          status: string
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description: string
          entry_date?: string
          id?: string
          is_reversed?: boolean | null
          job_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          reversal_date?: string | null
          reversed_by_entry_id?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string
          entry_date?: string
          id?: string
          is_reversed?: boolean | null
          job_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          reversal_date?: string | null
          reversed_by_entry_id?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "journal_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_by_entry_id_fkey"
            columns: ["reversed_by_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          billable: boolean | null
          billable_amount: number | null
          cost_code_id: string | null
          created_at: string
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          id: string
          is_reconciled: boolean | null
          job_id: string | null
          journal_entry_id: string
          line_order: number
          markup_percentage: number | null
          reconciled_at: string | null
          reconciled_by: string | null
        }
        Insert: {
          account_id: string
          billable?: boolean | null
          billable_amount?: number | null
          cost_code_id?: string | null
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          is_reconciled?: boolean | null
          job_id?: string | null
          journal_entry_id: string
          line_order?: number
          markup_percentage?: number | null
          reconciled_at?: string | null
          reconciled_by?: string | null
        }
        Update: {
          account_id?: string
          billable?: boolean | null
          billable_amount?: number | null
          cost_code_id?: string | null
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          is_reconciled?: boolean | null
          job_id?: string | null
          journal_entry_id?: string
          line_order?: number
          markup_percentage?: number | null
          reconciled_at?: string | null
          reconciled_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "journal_entry_lines_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "journal_entry_lines_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          company_id: string | null
          content: string
          created_at: string
          from_user_id: string
          id: string
          is_reply: boolean | null
          read: boolean
          subject: string | null
          thread_id: string | null
          to_user_id: string
        }
        Insert: {
          company_id?: string | null
          content: string
          created_at?: string
          from_user_id: string
          id?: string
          is_reply?: boolean | null
          read?: boolean
          subject?: string | null
          thread_id?: string | null
          to_user_id: string
        }
        Update: {
          company_id?: string | null
          content?: string
          created_at?: string
          from_user_id?: string
          id?: string
          is_reply?: boolean | null
          read?: boolean
          subject?: string | null
          thread_id?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          bill_approval_request: boolean | null
          bill_coding_request: boolean | null
          company_id: string
          created_at: string | null
          credit_card_coding_request: boolean | null
          financial_overview_enabled: boolean | null
          financial_overview_frequency: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bill_approval_request?: boolean | null
          bill_coding_request?: boolean | null
          company_id: string
          created_at?: string | null
          credit_card_coding_request?: boolean | null
          financial_overview_enabled?: boolean | null
          financial_overview_frequency?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bill_approval_request?: boolean | null
          bill_coding_request?: boolean | null
          company_id?: string
          created_at?: string | null
          credit_card_coding_request?: boolean | null
          financial_overview_enabled?: boolean | null
          financial_overview_frequency?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          company_id: string
          created_at: string
          email_enabled: boolean
          financial_overview_interval: string | null
          id: string
          in_app_enabled: boolean
          invoices_paid: boolean
          job_assignments: boolean
          overdue_bills_interval: string | null
          overdue_invoices: boolean
          receipt_uploaded: boolean
          updated_at: string
          user_id: string
          vendor_invitations: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          email_enabled?: boolean
          financial_overview_interval?: string | null
          id?: string
          in_app_enabled?: boolean
          invoices_paid?: boolean
          job_assignments?: boolean
          overdue_bills_interval?: string | null
          overdue_invoices?: boolean
          receipt_uploaded?: boolean
          updated_at?: string
          user_id: string
          vendor_invitations?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          email_enabled?: boolean
          financial_overview_interval?: string | null
          id?: string
          in_app_enabled?: boolean
          invoices_paid?: boolean
          job_assignments?: boolean
          overdue_bills_interval?: string | null
          overdue_invoices?: boolean
          receipt_uploaded?: boolean
          updated_at?: string
          user_id?: string
          vendor_invitations?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payables_settings: {
        Row: {
          allowed_po_vendor_types: string[] | null
          allowed_subcontract_vendor_types: string[] | null
          bills_approval_roles: string[]
          bills_auto_approve_roles: string[]
          bills_max_auto_approve_amount: number | null
          bills_require_approval: boolean
          company_id: string
          created_at: string
          created_by: string
          default_payment_method: string | null
          default_payment_terms: string | null
          id: string
          notify_on_bill_submission: boolean
          notify_on_payment_approval: boolean
          payment_approval_roles: string[]
          payment_approval_threshold: number
          payment_auto_approve_roles: string[]
          payment_dual_approval_roles: string[]
          payment_dual_approval_threshold: number | null
          payments_require_approval: boolean
          require_bill_documents: boolean
          require_cc_attachment: boolean | null
          require_receipt_attachment: boolean
          send_payment_confirmations: boolean
          show_vendor_compliance_warnings: boolean
          updated_at: string
        }
        Insert: {
          allowed_po_vendor_types?: string[] | null
          allowed_subcontract_vendor_types?: string[] | null
          bills_approval_roles?: string[]
          bills_auto_approve_roles?: string[]
          bills_max_auto_approve_amount?: number | null
          bills_require_approval?: boolean
          company_id: string
          created_at?: string
          created_by: string
          default_payment_method?: string | null
          default_payment_terms?: string | null
          id?: string
          notify_on_bill_submission?: boolean
          notify_on_payment_approval?: boolean
          payment_approval_roles?: string[]
          payment_approval_threshold?: number
          payment_auto_approve_roles?: string[]
          payment_dual_approval_roles?: string[]
          payment_dual_approval_threshold?: number | null
          payments_require_approval?: boolean
          require_bill_documents?: boolean
          require_cc_attachment?: boolean | null
          require_receipt_attachment?: boolean
          send_payment_confirmations?: boolean
          show_vendor_compliance_warnings?: boolean
          updated_at?: string
        }
        Update: {
          allowed_po_vendor_types?: string[] | null
          allowed_subcontract_vendor_types?: string[] | null
          bills_approval_roles?: string[]
          bills_auto_approve_roles?: string[]
          bills_max_auto_approve_amount?: number | null
          bills_require_approval?: boolean
          company_id?: string
          created_at?: string
          created_by?: string
          default_payment_method?: string | null
          default_payment_terms?: string | null
          id?: string
          notify_on_bill_submission?: boolean
          notify_on_payment_approval?: boolean
          payment_approval_roles?: string[]
          payment_approval_threshold?: number
          payment_auto_approve_roles?: string[]
          payment_dual_approval_roles?: string[]
          payment_dual_approval_threshold?: number | null
          payments_require_approval?: boolean
          require_bill_documents?: boolean
          require_cc_attachment?: boolean | null
          require_receipt_attachment?: boolean
          send_payment_confirmations?: boolean
          show_vendor_compliance_warnings?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      payment_invoice_lines: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_invoice_lines_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          bank_fee: number | null
          check_number: string | null
          company_id: string | null
          created_at: string
          created_by: string
          id: string
          is_partial_payment: boolean | null
          journal_entry_id: string | null
          memo: string | null
          payment_date: string
          payment_document_url: string | null
          payment_method: string
          payment_number: string
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          bank_fee?: number | null
          check_number?: string | null
          company_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_partial_payment?: boolean | null
          journal_entry_id?: string | null
          memo?: string | null
          payment_date?: string
          payment_document_url?: string | null
          payment_method: string
          payment_number: string
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          bank_fee?: number | null
          check_number?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_partial_payment?: boolean | null
          journal_entry_id?: string | null
          memo?: string | null
          payment_date?: string
          payment_document_url?: string | null
          payment_method?: string
          payment_number?: string
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_templates: {
        Row: {
          auto_size_columns: boolean | null
          available_variables: Json | null
          body_html: string | null
          company_id: string
          created_at: string
          created_by: string
          font_family: string
          footer_html: string | null
          header_html: string | null
          header_images: Json | null
          id: string
          notes: string | null
          pages: Json | null
          primary_color: string | null
          secondary_color: string | null
          table_border_color: string | null
          table_header_bg: string | null
          table_stripe_color: string | null
          template_file_name: string | null
          template_file_type: string | null
          template_file_url: string | null
          template_format: string | null
          template_name: string | null
          template_type: string
          updated_at: string
        }
        Insert: {
          auto_size_columns?: boolean | null
          available_variables?: Json | null
          body_html?: string | null
          company_id: string
          created_at?: string
          created_by: string
          font_family?: string
          footer_html?: string | null
          header_html?: string | null
          header_images?: Json | null
          id?: string
          notes?: string | null
          pages?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          table_border_color?: string | null
          table_header_bg?: string | null
          table_stripe_color?: string | null
          template_file_name?: string | null
          template_file_type?: string | null
          template_file_url?: string | null
          template_format?: string | null
          template_name?: string | null
          template_type: string
          updated_at?: string
        }
        Update: {
          auto_size_columns?: boolean | null
          available_variables?: Json | null
          body_html?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          font_family?: string
          footer_html?: string | null
          header_html?: string | null
          header_images?: Json | null
          id?: string
          notes?: string | null
          pages?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          table_border_color?: string | null
          table_header_bg?: string | null
          table_stripe_color?: string | null
          template_file_name?: string | null
          template_file_type?: string | null
          template_file_url?: string | null
          template_format?: string | null
          template_name?: string | null
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_albums: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_auto_employee_album: boolean
          job_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_auto_employee_album?: boolean
          job_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_auto_employee_album?: boolean
          job_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_albums_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "photo_albums_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          photo_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          photo_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          photo_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_comments_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "job_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pin_employee_timecard_settings: {
        Row: {
          assigned_cost_codes: string[]
          assigned_jobs: string[]
          company_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          notification_preferences: Json
          pin_employee_id: string
          require_location: boolean
          require_photo: boolean
          updated_at: string
        }
        Insert: {
          assigned_cost_codes?: string[]
          assigned_jobs?: string[]
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          notification_preferences?: Json
          pin_employee_id: string
          require_location?: boolean
          require_photo?: boolean
          updated_at?: string
        }
        Update: {
          assigned_cost_codes?: string[]
          assigned_jobs?: string[]
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          notification_preferences?: Json
          pin_employee_id?: string
          require_location?: boolean
          require_photo?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_employee_timecard_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_employee_timecard_settings_pin_employee_id_fkey"
            columns: ["pin_employee_id"]
            isOneToOne: false
            referencedRelation: "pin_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_employees: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          created_by: string
          department: string | null
          display_name: string
          email: string | null
          first_name: string
          group_id: string | null
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string | null
          pin_code: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by: string
          department?: string | null
          display_name: string
          email?: string | null
          first_name: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          pin_code: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          department?: string | null
          display_name?: string
          email?: string | null
          first_name?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          pin_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_employees_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "employee_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_comments: {
        Row: {
          comment_text: string
          created_at: string
          id: string
          page_number: number | null
          plan_id: string
          updated_at: string
          user_id: string
          x_position: number | null
          y_position: number | null
        }
        Insert: {
          comment_text: string
          created_at?: string
          id?: string
          page_number?: number | null
          plan_id: string
          updated_at?: string
          user_id: string
          x_position?: number | null
          y_position?: number | null
        }
        Update: {
          comment_text?: string
          created_at?: string
          id?: string
          page_number?: number | null
          plan_id?: string
          updated_at?: string
          user_id?: string
          x_position?: number | null
          y_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_comments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "job_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_markups: {
        Row: {
          created_at: string
          id: string
          markup_data: Json
          page_number: number
          plan_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          markup_data: Json
          page_number: number
          plan_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          markup_data?: Json
          page_number?: number
          plan_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_markups_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "job_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_pages: {
        Row: {
          created_at: string
          discipline: string | null
          id: string
          page_description: string | null
          page_number: number
          page_title: string | null
          plan_id: string
          sheet_number: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          discipline?: string | null
          id?: string
          page_description?: string | null
          page_number: number
          page_title?: string | null
          plan_id: string
          sheet_number?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          discipline?: string | null
          id?: string
          page_description?: string | null
          page_number?: number
          page_title?: string | null
          plan_id?: string
          sheet_number?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_pages_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "job_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          birthday: string | null
          created_at: string
          current_company_id: string | null
          custom_role_id: string | null
          display_name: string | null
          first_name: string | null
          group_id: string | null
          has_global_job_access: boolean | null
          id: string
          last_name: string | null
          nickname: string | null
          pin_code: string | null
          profile_completed: boolean | null
          profile_completed_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          current_company_id?: string | null
          custom_role_id?: string | null
          display_name?: string | null
          first_name?: string | null
          group_id?: string | null
          has_global_job_access?: boolean | null
          id?: string
          last_name?: string | null
          nickname?: string | null
          pin_code?: string | null
          profile_completed?: boolean | null
          profile_completed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          current_company_id?: string | null
          custom_role_id?: string | null
          display_name?: string | null
          first_name?: string | null
          group_id?: string | null
          has_global_job_access?: boolean | null
          id?: string
          last_name?: string | null
          nickname?: string | null
          pin_code?: string | null
          profile_completed?: boolean | null
          profile_completed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_company_id_fkey"
            columns: ["current_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "employee_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location_lat: number | null
          location_lng: number | null
          name: string
          owner_id: string
          qr_code: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_lat?: number | null
          location_lng?: number | null
          name: string
          owner_id: string
          qr_code: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          owner_id?: string
          qr_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      punch_clock_login_settings: {
        Row: {
          background_color: string | null
          background_image_url: string | null
          bottom_text: string | null
          company_id: string
          created_at: string
          created_by: string
          header_image_url: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          background_color?: string | null
          background_image_url?: string | null
          bottom_text?: string | null
          company_id: string
          created_at?: string
          created_by: string
          header_image_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          background_color?: string | null
          background_image_url?: string | null
          bottom_text?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          header_image_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      punch_clock_settings: {
        Row: {
          allow_manual_entry: boolean | null
          auto_break_duration: number | null
          auto_break_wait_hours: number | null
          break_reminder_minutes: number | null
          calculate_overtime: boolean | null
          company_id: string
          created_at: string
          enable_distance_warnings: boolean | null
          enable_punch_rounding: boolean | null
          grace_period_minutes: number | null
          id: string
          location_accuracy_meters: number | null
          manager_approval_required: boolean | null
          max_distance_from_job_meters: number | null
          notification_enabled: boolean | null
          overtime_threshold: number | null
          photo_required_for_corrections: boolean | null
          punch_rounding_direction: string | null
          punch_rounding_minutes: number | null
          punch_time_window_end: string | null
          punch_time_window_start: string | null
          require_location: boolean | null
          require_photo: boolean | null
          updated_at: string
        }
        Insert: {
          allow_manual_entry?: boolean | null
          auto_break_duration?: number | null
          auto_break_wait_hours?: number | null
          break_reminder_minutes?: number | null
          calculate_overtime?: boolean | null
          company_id: string
          created_at?: string
          enable_distance_warnings?: boolean | null
          enable_punch_rounding?: boolean | null
          grace_period_minutes?: number | null
          id?: string
          location_accuracy_meters?: number | null
          manager_approval_required?: boolean | null
          max_distance_from_job_meters?: number | null
          notification_enabled?: boolean | null
          overtime_threshold?: number | null
          photo_required_for_corrections?: boolean | null
          punch_rounding_direction?: string | null
          punch_rounding_minutes?: number | null
          punch_time_window_end?: string | null
          punch_time_window_start?: string | null
          require_location?: boolean | null
          require_photo?: boolean | null
          updated_at?: string
        }
        Update: {
          allow_manual_entry?: boolean | null
          auto_break_duration?: number | null
          auto_break_wait_hours?: number | null
          break_reminder_minutes?: number | null
          calculate_overtime?: boolean | null
          company_id?: string
          created_at?: string
          enable_distance_warnings?: boolean | null
          enable_punch_rounding?: boolean | null
          grace_period_minutes?: number | null
          id?: string
          location_accuracy_meters?: number | null
          manager_approval_required?: boolean | null
          max_distance_from_job_meters?: number | null
          notification_enabled?: boolean | null
          overtime_threshold?: number | null
          photo_required_for_corrections?: boolean | null
          punch_rounding_direction?: string | null
          punch_rounding_minutes?: number | null
          punch_time_window_end?: string | null
          punch_time_window_start?: string | null
          require_location?: boolean | null
          require_photo?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      punch_records: {
        Row: {
          company_id: string
          cost_code_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          job_id: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          photo_url: string | null
          pin_employee_id: string | null
          punch_time: string
          punch_type: Database["public"]["Enums"]["punch_status"]
          user_agent: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          cost_code_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          job_id?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          photo_url?: string | null
          pin_employee_id?: string | null
          punch_time?: string
          punch_type: Database["public"]["Enums"]["punch_status"]
          user_agent?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          cost_code_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          job_id?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          photo_url?: string | null
          pin_employee_id?: string | null
          punch_time?: string
          punch_type?: Database["public"]["Enums"]["punch_status"]
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "punch_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_records_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_records_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "punch_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "punch_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_records_pin_employee_id_fkey"
            columns: ["pin_employee_id"]
            isOneToOne: false
            referencedRelation: "pin_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          expected_delivery: string | null
          id: string
          job_id: string
          order_date: string
          po_file_url: string | null
          po_number: string
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description?: string | null
          expected_delivery?: string | null
          id?: string
          job_id: string
          order_date: string
          po_file_url?: string | null
          po_number: string
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          expected_delivery?: string | null
          id?: string
          job_id?: string
          order_date?: string
          po_file_url?: string | null
          po_number?: string
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "purchase_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_card_customization: {
        Row: {
          base_url: string
          company_id: string
          created_at: string
          font: string
          footer_text: string
          header_text: string
          id: string
          instructions: string | null
          instructions_line1: string
          instructions_line2: string
          logo_scale: number | null
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          base_url: string
          company_id: string
          created_at?: string
          font?: string
          footer_text?: string
          header_text?: string
          id?: string
          instructions?: string | null
          instructions_line1?: string
          instructions_line2?: string
          logo_scale?: number | null
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          base_url?: string
          company_id?: string
          created_at?: string
          font?: string
          footer_text?: string
          header_text?: string
          id?: string
          instructions?: string | null
          instructions_line1?: string
          instructions_line2?: string
          logo_scale?: number | null
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receipt_cost_distributions: {
        Row: {
          amount: number
          cost_code_id: string
          created_at: string | null
          created_by: string
          id: string
          job_id: string
          percentage: number
          receipt_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          cost_code_id: string
          created_at?: string | null
          created_by: string
          id?: string
          job_id: string
          percentage?: number
          receipt_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cost_code_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          job_id?: string
          percentage?: number
          receipt_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_cost_distributions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_cost_distributions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "receipt_cost_distributions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "receipt_cost_distributions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_cost_distributions_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_messages: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          message: string
          receipt_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          message: string
          receipt_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_messages_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number | null
          assigned_to: string | null
          company_id: string
          cost_code_id: string | null
          created_at: string
          created_by: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_credit_card_charge: boolean
          job_id: string | null
          notes: string | null
          receipt_date: string | null
          status: string
          updated_at: string
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount?: number | null
          assigned_to?: string | null
          company_id: string
          cost_code_id?: string | null
          created_at?: string
          created_by: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_credit_card_charge?: boolean
          job_id?: string | null
          notes?: string | null
          receipt_date?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number | null
          assigned_to?: string | null
          company_id?: string
          cost_code_id?: string | null
          created_at?: string
          created_by?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_credit_card_charge?: boolean
          job_id?: string | null
          notes?: string | null
          receipt_date?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      reconcile_reports: {
        Row: {
          bank_account_id: string
          book_balance: number
          company_id: string
          created_at: string
          difference: number
          display_name: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_balanced: boolean
          notes: string | null
          reconcile_date: string
          reconcile_month: number
          reconcile_year: number
          reconciled_at: string
          reconciled_by: string
          statement_balance: number
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          book_balance?: number
          company_id: string
          created_at?: string
          difference?: number
          display_name?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_balanced?: boolean
          notes?: string | null
          reconcile_date: string
          reconcile_month: number
          reconcile_year: number
          reconciled_at?: string
          reconciled_by: string
          statement_balance?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          book_balance?: number
          company_id?: string
          created_at?: string
          difference?: number
          display_name?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_balanced?: boolean
          notes?: string | null
          reconcile_date?: string
          reconcile_month?: number
          reconcile_year?: number
          reconciled_at?: string
          reconciled_by?: string
          statement_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconcile_reports_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconcile_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rfi_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          rfi_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          rfi_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          rfi_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      rfi_messages: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_internal: boolean
          message: string
          rfi_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          rfi_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          rfi_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rfis: {
        Row: {
          assigned_to: string | null
          ball_in_court: Database["public"]["Enums"]["rfi_ball_status"]
          closed_at: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          job_id: string
          responded_at: string | null
          response: string | null
          rfi_number: string
          status: Database["public"]["Enums"]["rfi_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          ball_in_court?: Database["public"]["Enums"]["rfi_ball_status"]
          closed_at?: string | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          job_id: string
          responded_at?: string | null
          response?: string | null
          rfi_number: string
          status?: Database["public"]["Enums"]["rfi_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          ball_in_court?: Database["public"]["Enums"]["rfi_ball_status"]
          closed_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          job_id?: string
          responded_at?: string | null
          response?: string | null
          rfi_number?: string
          status?: Database["public"]["Enums"]["rfi_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_default_pages: {
        Row: {
          created_at: string | null
          created_by: string
          default_page: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          default_page: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          default_page?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          id: string
          menu_item: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          id?: string
          menu_item: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          id?: string
          menu_item?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      subcontracts: {
        Row: {
          apply_retainage: boolean | null
          contract_amount: number
          contract_file_url: string | null
          cost_distribution: Json | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          job_id: string
          name: string
          retainage_percentage: number | null
          scope_of_work: string | null
          start_date: string | null
          status: string
          total_distributed_amount: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          apply_retainage?: boolean | null
          contract_amount: number
          contract_file_url?: string | null
          cost_distribution?: Json | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          job_id: string
          name: string
          retainage_percentage?: number | null
          scope_of_work?: string | null
          start_date?: string | null
          status?: string
          total_distributed_amount?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          apply_retainage?: boolean | null
          contract_amount?: number
          contract_file_url?: string | null
          cost_distribution?: Json | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          job_id?: string
          name?: string
          retainage_percentage?: number | null
          scope_of_work?: string | null
          start_date?: string | null
          status?: string
          total_distributed_amount?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontracts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "subcontracts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      time_card_audit_trail: {
        Row: {
          change_type: string
          changed_by: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          time_card_id: string
        }
        Insert: {
          change_type: string
          changed_by: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          time_card_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          time_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_card_audit_trail_time_card_id_fkey"
            columns: ["time_card_id"]
            isOneToOne: false
            referencedRelation: "time_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      time_card_change_requests: {
        Row: {
          company_id: string
          created_at: string
          id: string
          proposed_cost_code_id: string | null
          proposed_job_id: string | null
          proposed_punch_in_time: string | null
          proposed_punch_out_time: string | null
          reason: string
          requested_at: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          time_card_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          proposed_cost_code_id?: string | null
          proposed_job_id?: string | null
          proposed_punch_in_time?: string | null
          proposed_punch_out_time?: string | null
          reason: string
          requested_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_card_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          proposed_cost_code_id?: string | null
          proposed_job_id?: string | null
          proposed_punch_in_time?: string | null
          proposed_punch_out_time?: string | null
          reason?: string
          requested_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_card_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_card_change_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_card_change_requests_time_card_id_fkey"
            columns: ["time_card_id"]
            isOneToOne: false
            referencedRelation: "time_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      time_card_corrections: {
        Row: {
          correction_type: string
          created_at: string
          id: string
          original_cost_code_id: string | null
          original_job_id: string | null
          original_punch_in: string | null
          original_punch_out: string | null
          reason: string
          requested_by: string
          requested_cost_code_id: string | null
          requested_job_id: string | null
          requested_punch_in: string | null
          requested_punch_out: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          time_card_id: string
          updated_at: string
        }
        Insert: {
          correction_type: string
          created_at?: string
          id?: string
          original_cost_code_id?: string | null
          original_job_id?: string | null
          original_punch_in?: string | null
          original_punch_out?: string | null
          reason: string
          requested_by: string
          requested_cost_code_id?: string | null
          requested_job_id?: string | null
          requested_punch_in?: string | null
          requested_punch_out?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_card_id: string
          updated_at?: string
        }
        Update: {
          correction_type?: string
          created_at?: string
          id?: string
          original_cost_code_id?: string | null
          original_job_id?: string | null
          original_punch_in?: string | null
          original_punch_out?: string | null
          reason?: string
          requested_by?: string
          requested_cost_code_id?: string | null
          requested_job_id?: string | null
          requested_punch_in?: string | null
          requested_punch_out?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_card_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      time_cards: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_minutes: number | null
          company_id: string
          correction_approved_at: string | null
          correction_approved_by: string | null
          correction_reason: string | null
          correction_requested_at: string | null
          cost_code_id: string | null
          created_at: string
          created_via_punch_clock: boolean | null
          deleted_at: string | null
          distance_from_job_meters: number | null
          distance_warning: boolean | null
          id: string
          is_correction: boolean | null
          job_id: string | null
          notes: string | null
          original_time_card_id: string | null
          overtime_hours: number | null
          punch_in_location_lat: number | null
          punch_in_location_lng: number | null
          punch_in_photo_url: string | null
          punch_in_time: string
          punch_out_location_lat: number | null
          punch_out_location_lng: number | null
          punch_out_photo_url: string | null
          punch_out_time: string
          requires_approval: boolean | null
          status: string
          total_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          company_id: string
          correction_approved_at?: string | null
          correction_approved_by?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_via_punch_clock?: boolean | null
          deleted_at?: string | null
          distance_from_job_meters?: number | null
          distance_warning?: boolean | null
          id?: string
          is_correction?: boolean | null
          job_id?: string | null
          notes?: string | null
          original_time_card_id?: string | null
          overtime_hours?: number | null
          punch_in_location_lat?: number | null
          punch_in_location_lng?: number | null
          punch_in_photo_url?: string | null
          punch_in_time: string
          punch_out_location_lat?: number | null
          punch_out_location_lng?: number | null
          punch_out_photo_url?: string | null
          punch_out_time: string
          requires_approval?: boolean | null
          status?: string
          total_hours: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          company_id?: string
          correction_approved_at?: string | null
          correction_approved_by?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_via_punch_clock?: boolean | null
          deleted_at?: string | null
          distance_from_job_meters?: number | null
          distance_warning?: boolean | null
          id?: string
          is_correction?: boolean | null
          job_id?: string | null
          notes?: string | null
          original_time_card_id?: string | null
          overtime_hours?: number | null
          punch_in_location_lat?: number | null
          punch_in_location_lng?: number | null
          punch_in_photo_url?: string | null
          punch_in_time?: string
          punch_out_location_lat?: number | null
          punch_out_location_lng?: number | null
          punch_out_photo_url?: string | null
          punch_out_time?: string
          requires_approval?: boolean | null
          status?: string
          total_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_access: {
        Row: {
          company_id: string
          granted_at: string
          granted_by: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          granted_at?: string
          granted_by: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          granted_at?: string
          granted_by?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_job_access: {
        Row: {
          granted_at: string
          granted_by: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_job_access_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "user_job_access_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_login_audit: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          login_method: string | null
          login_time: string
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          login_method?: string | null
          login_time?: string
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          login_method?: string | null
          login_time?: string
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vault_entries: {
        Row: {
          algo: string
          company_id: string
          created_at: string
          created_by: string
          data_ciphertext: string
          id: string
          iv: string
          notes_ciphertext: string | null
          salt: string
          title: string
          updated_at: string
          updated_by: string | null
          url: string | null
          username: string | null
          version: number
        }
        Insert: {
          algo?: string
          company_id: string
          created_at?: string
          created_by: string
          data_ciphertext: string
          id?: string
          iv: string
          notes_ciphertext?: string | null
          salt: string
          title: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
          username?: string | null
          version?: number
        }
        Update: {
          algo?: string
          company_id?: string
          created_at?: string
          created_by?: string
          data_ciphertext?: string
          id?: string
          iv?: string
          notes_ciphertext?: string | null
          salt?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
          username?: string | null
          version?: number
        }
        Relationships: []
      }
      vendor_compliance_documents: {
        Row: {
          created_at: string
          expiration_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_required: boolean
          is_uploaded: boolean
          type: string
          updated_at: string
          uploaded_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          expiration_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_required?: boolean
          is_uploaded?: boolean
          type: string
          updated_at?: string
          uploaded_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          expiration_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_required?: boolean
          is_uploaded?: boolean
          type?: string
          updated_at?: string
          uploaded_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_compliance_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payment_methods: {
        Row: {
          account_number: string | null
          account_type: string | null
          bank_name: string | null
          check_delivery: string | null
          created_at: string
          id: string
          is_primary: boolean
          login_information: string | null
          pickup_location: string | null
          routing_number: string | null
          type: string
          updated_at: string
          vendor_id: string
          voided_check_url: string | null
          website_address: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          check_delivery?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          login_information?: string | null
          pickup_location?: string | null
          routing_number?: string | null
          type: string
          updated_at?: string
          vendor_id: string
          voided_check_url?: string | null
          website_address?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          check_delivery?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          login_information?: string | null
          pickup_location?: string | null
          routing_number?: string | null
          type?: string
          updated_at?: string
          vendor_id?: string
          voided_check_url?: string | null
          website_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payment_methods_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          contact_person: string | null
          created_at: string
          customer_number: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          require_invoice_number: boolean
          state: string | null
          tax_id: string | null
          updated_at: string
          vendor_type: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          customer_number?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          require_invoice_number?: boolean
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          vendor_type?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          customer_number?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          require_invoice_number?: boolean
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          vendor_type?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_auto_logout_settings: {
        Row: {
          auto_logout_enabled: boolean
          auto_logout_hours: number
          company_id: string
          created_at: string
          geolocation_distance_meters: number
          geolocation_logout_enabled: boolean
          id: string
          job_id: string
          send_sms_on_checkin: boolean | null
          sms_check_enabled: boolean
          sms_check_interval_hours: number
          sms_message_template: string | null
          sms_reminder_enabled: boolean | null
          sms_reminder_hours: number | null
          sms_reminder_message: string | null
          updated_at: string
        }
        Insert: {
          auto_logout_enabled?: boolean
          auto_logout_hours?: number
          company_id: string
          created_at?: string
          geolocation_distance_meters?: number
          geolocation_logout_enabled?: boolean
          id?: string
          job_id: string
          send_sms_on_checkin?: boolean | null
          sms_check_enabled?: boolean
          sms_check_interval_hours?: number
          sms_message_template?: string | null
          sms_reminder_enabled?: boolean | null
          sms_reminder_hours?: number | null
          sms_reminder_message?: string | null
          updated_at?: string
        }
        Update: {
          auto_logout_enabled?: boolean
          auto_logout_hours?: number
          company_id?: string
          created_at?: string
          geolocation_distance_meters?: number
          geolocation_logout_enabled?: boolean
          id?: string
          job_id?: string
          send_sms_on_checkin?: boolean | null
          sms_check_enabled?: boolean
          sms_check_interval_hours?: number
          sms_message_template?: string | null
          sms_reminder_enabled?: boolean | null
          sms_reminder_hours?: number | null
          sms_reminder_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_auto_logout_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_auto_logout_settings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "visitor_auto_logout_settings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_login_settings: {
        Row: {
          background_color: string | null
          background_image_url: string | null
          button_color: string | null
          checkout_message: string | null
          checkout_show_duration: boolean | null
          checkout_title: string | null
          company_id: string
          confirmation_message: string | null
          confirmation_title: string | null
          created_at: string
          created_by: string
          enable_checkout: boolean | null
          header_logo_url: string | null
          id: string
          primary_color: string | null
          require_company_name: boolean | null
          require_photo: boolean | null
          require_purpose_visit: boolean | null
          text_color: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          background_image_url?: string | null
          button_color?: string | null
          checkout_message?: string | null
          checkout_show_duration?: boolean | null
          checkout_title?: string | null
          company_id: string
          confirmation_message?: string | null
          confirmation_title?: string | null
          created_at?: string
          created_by: string
          enable_checkout?: boolean | null
          header_logo_url?: string | null
          id?: string
          primary_color?: string | null
          require_company_name?: boolean | null
          require_photo?: boolean | null
          require_purpose_visit?: boolean | null
          text_color?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          background_image_url?: string | null
          button_color?: string | null
          checkout_message?: string | null
          checkout_show_duration?: boolean | null
          checkout_title?: string | null
          company_id?: string
          confirmation_message?: string | null
          confirmation_title?: string | null
          created_at?: string
          created_by?: string
          enable_checkout?: boolean | null
          header_logo_url?: string | null
          id?: string
          primary_color?: string | null
          require_company_name?: boolean | null
          require_photo?: boolean | null
          require_purpose_visit?: boolean | null
          text_color?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      visitor_logs: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          checked_out_at: string | null
          checkout_token: string | null
          company_id: string
          company_name: string | null
          created_at: string
          id: string
          job_id: string
          notes: string | null
          purpose_of_visit: string | null
          subcontractor_id: string | null
          updated_at: string
          visitor_name: string
          visitor_phone: string
          visitor_photo_url: string | null
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          checked_out_at?: string | null
          checkout_token?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          purpose_of_visit?: string | null
          subcontractor_id?: string | null
          updated_at?: string
          visitor_name: string
          visitor_phone: string
          visitor_photo_url?: string | null
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          checked_out_at?: string | null
          checkout_token?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          purpose_of_visit?: string | null
          subcontractor_id?: string | null
          updated_at?: string
          visitor_name?: string
          visitor_phone?: string
          visitor_photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitor_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dynamic_budget_summary: {
        Row: {
          child_count: number | null
          cost_code: string | null
          cost_code_description: string | null
          dynamic_budget: number | null
          is_dynamic_group: boolean | null
          is_over_budget: boolean | null
          job_id: string | null
          parent_budget_id: string | null
          parent_cost_code_id: string | null
          remaining_budget: number | null
          total_actual_from_children: number | null
          total_committed_from_children: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_budgets_cost_code_id_fkey"
            columns: ["parent_cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_budgets_cost_code_id_fkey"
            columns: ["parent_cost_code_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["cost_code_id"]
          },
          {
            foreignKeyName: "job_budgets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_budgets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cost_summary: {
        Row: {
          cost_code: string | null
          cost_code_description: string | null
          cost_code_id: string | null
          job_id: string | null
          job_name: string | null
          total_billable: number | null
          total_cost: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
      vendor_compliance_warnings: {
        Row: {
          company_id: string | null
          created_at: string | null
          days_until_expiration: number | null
          expiration_date: string | null
          file_name: string | null
          file_url: string | null
          id: string | null
          is_expired: boolean | null
          is_required: boolean | null
          is_uploaded: boolean | null
          type: string | null
          updated_at: string | null
          uploaded_at: string | null
          vendor_id: string | null
          vendor_name: string | null
          warning_level: string | null
          warning_message: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_compliance_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_company_access: {
        Args: { _company_id: string }
        Returns: undefined
      }
      admin_grant_company_access: {
        Args: {
          p_company_id: string
          p_granted_by?: string
          p_is_active?: boolean
          p_role?: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      auto_logout_visitors: {
        Args: never
        Returns: {
          job_id: string
          logged_out_count: number
        }[]
      }
      generate_qr_code: { Args: never; Returns: string }
      generate_visitor_qr_code: { Args: never; Returns: string }
      get_job_subcontractors: {
        Args: { p_job_id: string }
        Returns: {
          id: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      get_mapbox_token: { Args: never; Returns: string }
      get_next_cash_account_number: { Args: never; Returns: string }
      get_or_create_employee_album: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: string
      }
      get_user_companies: {
        Args: { _user_id: string }
        Returns: {
          company_id: string
          company_name: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin_or_controller: {
        Args: { _company: string; _user: string }
        Returns: boolean
      }
      pin_insert_job_photo: {
        Args: {
          p_job_id: string
          p_location_lat: number
          p_location_lng: number
          p_note: string
          p_photo_url: string
          p_uploader_hint: string
        }
        Returns: string
      }
      recalculate_account_balance: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      set_role_permission: {
        Args: {
          p_can_access: boolean
          p_menu_item: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: undefined
      }
      validate_pin: {
        Args: { p_pin: string }
        Returns: {
          first_name: string
          last_name: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
      validate_pin_employee: {
        Args: { p_pin: string }
        Returns: {
          display_name: string
          employee_id: string
          first_name: string
          last_name: string
        }[]
      }
      validate_pin_for_login: {
        Args: { p_pin: string }
        Returns: {
          current_company_id: string
          first_name: string
          is_pin_employee: boolean
          last_name: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
    }
    Enums: {
      cost_code_type:
        | "material"
        | "labor"
        | "sub"
        | "equipment"
        | "other"
        | "dynamic_group"
        | "dynamic_parent"
      job_status: "planning" | "active" | "on-hold" | "completed"
      job_type:
        | "residential"
        | "commercial"
        | "industrial"
        | "renovation"
        | "maintenance"
      punch_status: "punched_in" | "punched_out"
      rfi_ball_status: "manager" | "design_professional"
      rfi_status: "draft" | "submitted" | "in_review" | "responded" | "closed"
      template_editor: "richtext" | "html"
      user_role:
        | "admin"
        | "controller"
        | "project_manager"
        | "employee"
        | "view_only"
        | "company_admin"
        | "vendor"
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
      cost_code_type: [
        "material",
        "labor",
        "sub",
        "equipment",
        "other",
        "dynamic_group",
        "dynamic_parent",
      ],
      job_status: ["planning", "active", "on-hold", "completed"],
      job_type: [
        "residential",
        "commercial",
        "industrial",
        "renovation",
        "maintenance",
      ],
      punch_status: ["punched_in", "punched_out"],
      rfi_ball_status: ["manager", "design_professional"],
      rfi_status: ["draft", "submitted", "in_review", "responded", "closed"],
      template_editor: ["richtext", "html"],
      user_role: [
        "admin",
        "controller",
        "project_manager",
        "employee",
        "view_only",
        "company_admin",
        "vendor",
      ],
    },
  },
} as const
