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
          bank_name: string
          chart_account_id: string | null
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
          bank_name: string
          chart_account_id?: string | null
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
          bank_name?: string
          chart_account_id?: string | null
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
            foreignKeyName: "bank_accounts_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
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
      company_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          payment_terms_options: string[]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          payment_terms_options?: string[]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          payment_terms_options?: string[]
          updated_at?: string
        }
        Relationships: []
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
          job_id: string | null
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
          job_id?: string | null
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
          job_id?: string | null
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
          current_balance: number | null
          description: string | null
          due_date: string | null
          id: string
          interest_rate: number | null
          is_active: boolean
          issuer: string
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
          current_balance?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          is_active?: boolean
          issuer: string
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
          current_balance?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          is_active?: boolean
          issuer?: string
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
      invoice_audit_trail: {
        Row: {
          change_type: string
          changed_by: string
          created_at: string
          field_name: string | null
          id: string
          invoice_id: string
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
          invoice_id: string
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
          invoice_id?: string
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
      invoices: {
        Row: {
          amount: number
          bill_category: string | null
          cost_code_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          file_url: string | null
          id: string
          invoice_number: string | null
          is_reimbursement: boolean
          is_subcontract_invoice: boolean
          issue_date: string
          job_id: string
          payment_terms: string | null
          status: string
          subcontract_id: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          bill_category?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string | null
          is_reimbursement?: boolean
          is_subcontract_invoice?: boolean
          issue_date: string
          job_id: string
          payment_terms?: string | null
          status?: string
          subcontract_id?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          bill_category?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string | null
          is_reimbursement?: boolean
          is_subcontract_invoice?: boolean
          issue_date?: string
          job_id?: string
          payment_terms?: string | null
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
      job_budgets: {
        Row: {
          actual_amount: number
          budgeted_amount: number
          committed_amount: number
          cost_code_id: string
          created_at: string
          created_by: string
          id: string
          job_id: string
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
          job_id: string
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
          job_id?: string
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
        ]
      }
      job_punch_clock_settings: {
        Row: {
          allow_manual_entry: boolean | null
          auto_break_duration: number | null
          auto_break_wait_hours: number | null
          calculate_overtime: boolean | null
          company_id: string
          created_at: string
          created_by: string
          earliest_punch_start_time: string | null
          enable_punch_rounding: boolean | null
          grace_period_minutes: number | null
          id: string
          job_id: string
          latest_punch_in_time: string | null
          location_accuracy_meters: number | null
          manager_approval_required: boolean | null
          notification_enabled: boolean | null
          overtime_threshold: number | null
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
          calculate_overtime?: boolean | null
          company_id: string
          created_at?: string
          created_by: string
          earliest_punch_start_time?: string | null
          enable_punch_rounding?: boolean | null
          grace_period_minutes?: number | null
          id?: string
          job_id: string
          latest_punch_in_time?: string | null
          location_accuracy_meters?: number | null
          manager_approval_required?: boolean | null
          notification_enabled?: boolean | null
          overtime_threshold?: number | null
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
          calculate_overtime?: boolean | null
          company_id?: string
          created_at?: string
          created_by?: string
          earliest_punch_start_time?: string | null
          enable_punch_rounding?: boolean | null
          grace_period_minutes?: number | null
          id?: string
          job_id?: string
          latest_punch_in_time?: string | null
          location_accuracy_meters?: number | null
          manager_approval_required?: boolean | null
          notification_enabled?: boolean | null
          overtime_threshold?: number | null
          punch_rounding_direction?: string | null
          punch_rounding_minutes?: number | null
          punch_time_window_end?: string | null
          punch_time_window_start?: string | null
          require_location?: boolean | null
          require_photo?: boolean | null
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
          require_budget: boolean
          require_completion_approval: boolean
          require_cost_codes: boolean
          require_job_description: boolean
          require_project_manager: boolean
          require_start_date: boolean
          require_timecard_approval: boolean
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
          require_budget?: boolean
          require_completion_approval?: boolean
          require_cost_codes?: boolean
          require_job_description?: boolean
          require_project_manager?: boolean
          require_start_date?: boolean
          require_timecard_approval?: boolean
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
          require_budget?: boolean
          require_completion_approval?: boolean
          require_cost_codes?: boolean
          require_job_description?: boolean
          require_project_manager?: boolean
          require_start_date?: boolean
          require_timecard_approval?: boolean
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
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          job_type: Database["public"]["Enums"]["job_type"] | null
          latitude: number | null
          longitude: number | null
          name: string
          project_manager_user_id: string | null
          revenue_account_id: string | null
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
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          job_type?: Database["public"]["Enums"]["job_type"] | null
          latitude?: number | null
          longitude?: number | null
          name: string
          project_manager_user_id?: string | null
          revenue_account_id?: string | null
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
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          job_type?: Database["public"]["Enums"]["job_type"] | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          project_manager_user_id?: string | null
          revenue_account_id?: string | null
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
          created_at: string
          created_by: string
          description: string
          entry_date: string
          id: string
          job_id: string | null
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          status: string
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          entry_date?: string
          id?: string
          job_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          entry_date?: string
          id?: string
          job_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
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
          job_id: string | null
          journal_entry_id: string
          line_order: number
          markup_percentage: number | null
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
          job_id?: string | null
          journal_entry_id: string
          line_order?: number
          markup_percentage?: number | null
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
          job_id?: string | null
          journal_entry_id?: string
          line_order?: number
          markup_percentage?: number | null
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
      notification_settings: {
        Row: {
          company_id: string
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          invoices_paid: boolean
          job_assignments: boolean
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
          id?: string
          in_app_enabled?: boolean
          invoices_paid?: boolean
          job_assignments?: boolean
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
          id?: string
          in_app_enabled?: boolean
          invoices_paid?: boolean
          job_assignments?: boolean
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
          require_receipt_attachment: boolean
          send_payment_confirmations: boolean
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
          require_receipt_attachment?: boolean
          send_payment_confirmations?: boolean
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
          require_receipt_attachment?: boolean
          send_payment_confirmations?: boolean
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
          check_number: string | null
          created_at: string
          created_by: string
          id: string
          journal_entry_id: string | null
          memo: string | null
          payment_date: string
          payment_method: string
          payment_number: string
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          check_number?: string | null
          created_at?: string
          created_by: string
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          payment_date?: string
          payment_method: string
          payment_number: string
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          check_number?: string | null
          created_at?: string
          created_by?: string
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          payment_date?: string
          payment_method?: string
          payment_number?: string
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
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
      pin_employees: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          department: string | null
          display_name: string
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
          created_at?: string
          created_by: string
          department?: string | null
          display_name: string
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
          created_at?: string
          created_by?: string
          department?: string | null
          display_name?: string
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
            foreignKeyName: "pin_employees_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "employee_groups"
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
          job_id: string | null
          notes: string | null
          receipt_date: string | null
          status: string
          updated_at: string
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
          job_id?: string | null
          notes?: string | null
          receipt_date?: string | null
          status?: string
          updated_at?: string
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
          job_id?: string | null
          notes?: string | null
          receipt_date?: string | null
          status?: string
          updated_at?: string
          vendor_name?: string | null
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
          pickup_location: string | null
          routing_number: string | null
          type: string
          updated_at: string
          vendor_id: string
          voided_check_url: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          check_delivery?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          pickup_location?: string | null
          routing_number?: string | null
          type: string
          updated_at?: string
          vendor_id: string
          voided_check_url?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          check_delivery?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          pickup_location?: string | null
          routing_number?: string | null
          type?: string
          updated_at?: string
          vendor_id?: string
          voided_check_url?: string | null
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
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          vendor_type?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      visitor_login_settings: {
        Row: {
          background_image_url: string | null
          button_color: string | null
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
          require_purpose_visit: boolean | null
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          button_color?: string | null
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
          require_purpose_visit?: boolean | null
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          button_color?: string | null
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
          require_purpose_visit?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      visitor_logs: {
        Row: {
          check_in_time: string
          check_out_time: string | null
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
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
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
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
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
    }
    Functions: {
      activate_company_access: {
        Args: { _company_id: string }
        Returns: undefined
      }
      generate_qr_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_visitor_qr_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_mapbox_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_next_cash_account_number: {
        Args: Record<PropertyKey, never>
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
          first_name: string
          is_pin_employee: boolean
          last_name: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
    }
    Enums: {
      cost_code_type: "material" | "labor" | "sub" | "equipment" | "other"
      job_status: "planning" | "active" | "on-hold" | "completed"
      job_type:
        | "residential"
        | "commercial"
        | "industrial"
        | "renovation"
        | "maintenance"
      punch_status: "punched_in" | "punched_out"
      template_editor: "richtext" | "html"
      user_role:
        | "admin"
        | "controller"
        | "project_manager"
        | "employee"
        | "view_only"
        | "company_admin"
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
      cost_code_type: ["material", "labor", "sub", "equipment", "other"],
      job_status: ["planning", "active", "on-hold", "completed"],
      job_type: [
        "residential",
        "commercial",
        "industrial",
        "renovation",
        "maintenance",
      ],
      punch_status: ["punched_in", "punched_out"],
      template_editor: ["richtext", "html"],
      user_role: [
        "admin",
        "controller",
        "project_manager",
        "employee",
        "view_only",
        "company_admin",
      ],
    },
  },
} as const
