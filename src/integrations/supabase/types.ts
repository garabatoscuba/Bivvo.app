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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      affiliates: {
        Row: {
          branch_id: string
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          points: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          points?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliations: {
        Row: {
          branch_id: string
          business_id: string
          id: string
          joined_at: string
          points: number
          user_id: string
        }
        Insert: {
          branch_id: string
          business_id: string
          id?: string
          joined_at?: string
          points?: number
          user_id: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          id?: string
          joined_at?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          badge_text: string | null
          branch_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          badge_text?: string | null
          branch_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          badge_text?: string | null
          branch_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_stock: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          warehouse_quantity: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          warehouse_quantity?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          warehouse_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "branch_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          id: string
          is_main: boolean
          name: string
          phone: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          id?: string
          is_main?: boolean
          name: string
          phone?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          id?: string
          is_main?: boolean
          name?: string
          phone?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_requests: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          branch_business_id: string | null
          branch_name: string | null
          business_name: string | null
          business_type: string | null
          created_at: string
          id: string
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_business_id?: string | null
          branch_name?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string
          id?: string
          request_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_business_id?: string | null
          branch_name?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string
          id?: string
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_requests_branch_business_id_fkey"
            columns: ["branch_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_type_configs: {
        Row: {
          config: Json
          country: string | null
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          key: string
          module_ids: string[]
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          config?: Json
          country?: string | null
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          key: string
          module_ids?: string[]
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          country?: string | null
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          key?: string
          module_ids?: string[]
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          base_currency: string
          business_type: string
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_id: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          base_currency?: string
          business_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          base_currency?: string
          business_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_business_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_config: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          fixed_opening_amount: number
          id: string
          mode: string
          opening_type: string
          petty_cash_min_alert: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          fixed_opening_amount?: number
          id?: string
          mode?: string
          opening_type?: string
          petty_cash_min_alert?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          fixed_opening_amount?: number
          id?: string
          mode?: string
          opening_type?: string
          petty_cash_min_alert?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_config_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          branch_id: string
          business_id: string
          closed_at: string | null
          counted_cash: number | null
          created_at: string
          difference: number | null
          expected_cash: number
          id: string
          notes: string | null
          opened_at: string
          opening_amount: number
          status: string
          total_sales_cash: number
          total_sales_transfer: number
          total_services_cash: number
          total_services_transfer: number
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          business_id: string
          closed_at?: string | null
          counted_cash?: number | null
          created_at?: string
          difference?: number | null
          expected_cash?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          status?: string
          total_sales_cash?: number
          total_sales_transfer?: number
          total_services_cash?: number
          total_services_transfer?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          closed_at?: string | null
          counted_cash?: number | null
          created_at?: string
          difference?: number | null
          expected_cash?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          status?: string
          total_sales_cash?: number
          total_sales_transfer?: number
          total_services_cash?: number
          total_services_transfer?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          business_id: string
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_shop_config: {
        Row: {
          business_id: string
          created_at: string
          id: string
          mode: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          mode?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          mode?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_shop_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_copies: {
        Row: {
          branch_id: string
          business_id: string
          cash_amount: number
          created_at: string
          date: string
          id: string
          transfer_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          business_id: string
          cash_amount?: number
          created_at?: string
          date?: string
          id?: string
          transfer_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          cash_amount?: number
          created_at?: string
          date?: string
          id?: string
          transfer_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_copies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_copies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          active_workers: number
          branch_id: string
          business_id: string
          cash_counted: number
          closed_at: string
          commission_earning: number
          copies_cash: number
          copies_earning: number
          copies_transfer: number
          created_at: string
          date: string
          employee_id: string
          id: string
          jornada_id: string | null
          money_to_deliver: number
          sales_cash: number
          sales_transfer: number
          service_cash: number
          service_earning: number
          service_percent: number
          service_transfer: number
          tips: number
          total_commissions: number
          total_copies: number
          total_expected_cash: number
          total_salary: number
          total_sales_day: number
          total_services: number
          total_transfers: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_workers?: number
          branch_id: string
          business_id: string
          cash_counted?: number
          closed_at?: string
          commission_earning?: number
          copies_cash?: number
          copies_earning?: number
          copies_transfer?: number
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          jornada_id?: string | null
          money_to_deliver?: number
          sales_cash?: number
          sales_transfer?: number
          service_cash?: number
          service_earning?: number
          service_percent?: number
          service_transfer?: number
          tips?: number
          total_commissions?: number
          total_copies?: number
          total_expected_cash?: number
          total_salary?: number
          total_sales_day?: number
          total_services?: number
          total_transfers?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_workers?: number
          branch_id?: string
          business_id?: string
          cash_counted?: number
          closed_at?: string
          commission_earning?: number
          copies_cash?: number
          copies_earning?: number
          copies_transfer?: number
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          jornada_id?: string | null
          money_to_deliver?: number
          sales_cash?: number
          sales_transfer?: number
          service_cash?: number
          service_earning?: number
          service_percent?: number
          service_transfer?: number
          tips?: number
          total_commissions?: number
          total_copies?: number
          total_expected_cash?: number
          total_salary?: number
          total_sales_day?: number
          total_services?: number
          total_transfers?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_branch_assignments: {
        Row: {
          branch_id: string
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_branch_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_evaluations: {
        Row: {
          business_id: string
          created_at: string
          employee_id: string
          evaluated_by: string
          evaluation_month: string
          id: string
          notes: string | null
          skills: Json
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          employee_id: string
          evaluated_by: string
          evaluation_month: string
          id?: string
          notes?: string | null
          skills?: Json
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          employee_id?: string
          evaluated_by?: string
          evaluation_month?: string
          id?: string
          notes?: string | null
          skills?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_evaluations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_onboarding_tokens: {
        Row: {
          branch_id: string | null
          business_id: string
          created_at: string
          created_by: string
          employee_id: string
          expires_at: string
          id: string
          position: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          created_at?: string
          created_by: string
          employee_id: string
          expires_at?: string
          id?: string
          position?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          expires_at?: string
          id?: string
          position?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_onboarding_tokens_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_tokens_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_assignments: {
        Row: {
          base_salary: number
          business_id: string
          config_override: Json
          created_at: string
          employee_id: string
          id: string
          is_active: boolean
          modality_id: string
          pay_frequency: Database["public"]["Enums"]["pay_frequency"]
          updated_at: string
        }
        Insert: {
          base_salary?: number
          business_id: string
          config_override?: Json
          created_at?: string
          employee_id: string
          id?: string
          is_active?: boolean
          modality_id: string
          pay_frequency?: Database["public"]["Enums"]["pay_frequency"]
          updated_at?: string
        }
        Update: {
          base_salary?: number
          business_id?: string
          config_override?: Json
          created_at?: string
          employee_id?: string
          id?: string
          is_active?: boolean
          modality_id?: string
          pay_frequency?: Database["public"]["Enums"]["pay_frequency"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_assignments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_assignments_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "salary_modalities"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          age: number | null
          branch_id: string | null
          business_id: string
          ci: string
          contract_number: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          license_number: string | null
          position: string
          start_date: string
          station: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          branch_id?: string | null
          business_id: string
          ci: string
          contract_number: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          license_number?: string | null
          position?: string
          start_date?: string
          station?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          branch_id?: string | null
          business_id?: string
          ci?: string
          contract_number?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          license_number?: string | null
          position?: string
          start_date?: string
          station?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      jornadas: {
        Row: {
          apertura_at: string
          cierre_at: string | null
          created_at: string
          duracion_min: number | null
          empleado_id: string
          id: string
          incidencia: boolean
          metodo_apertura: string
          metodo_cierre: string | null
          notas: string | null
          salario_ganado: number | null
          sucursal_id: string
        }
        Insert: {
          apertura_at?: string
          cierre_at?: string | null
          created_at?: string
          duracion_min?: number | null
          empleado_id: string
          id?: string
          incidencia?: boolean
          metodo_apertura: string
          metodo_cierre?: string | null
          notas?: string | null
          salario_ganado?: number | null
          sucursal_id: string
        }
        Update: {
          apertura_at?: string
          cierre_at?: string | null
          created_at?: string
          duracion_min?: number | null
          empleado_id?: string
          id?: string
          incidencia?: boolean
          metodo_apertura?: string
          metodo_cierre?: string | null
          notas?: string | null
          salario_ganado?: number | null
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornadas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      module_plugin_pricing: {
        Row: {
          availability: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          monthly_price: number
          plan_type: string
          updated_at: string
        }
        Insert: {
          availability?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          monthly_price?: number
          plan_type: string
          updated_at?: string
        }
        Update: {
          availability?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          monthly_price?: number
          plan_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          branch_id: string | null
          business_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash: {
        Row: {
          balance: number
          branch_id: string
          business_id: string
          created_at: string
          id: string
          min_alert: number
          updated_at: string
        }
        Insert: {
          balance?: number
          branch_id: string
          business_id: string
          created_at?: string
          id?: string
          min_alert?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          branch_id?: string
          business_id?: string
          created_at?: string
          id?: string
          min_alert?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash_movements: {
        Row: {
          amount: number
          branch_id: string
          business_id: string
          created_at: string
          id: string
          movement_type: string
          petty_cash_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          business_id: string
          created_at?: string
          id?: string
          movement_type: string
          petty_cash_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          business_id?: string
          created_at?: string
          id?: string
          movement_type?: string
          petty_cash_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_movements_petty_cash_id_fkey"
            columns: ["petty_cash_id"]
            isOneToOne: false
            referencedRelation: "petty_cash"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_requests: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          custom_end_date: string | null
          discount_percent: number
          id: string
          months: number
          plan_type: string
          price_per_branch: number
          status: string
          total_amount: number
          total_branches: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          custom_end_date?: string | null
          discount_percent?: number
          id?: string
          months: number
          plan_type: string
          price_per_branch: number
          status?: string
          total_amount: number
          total_branches?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          custom_end_date?: string | null
          discount_percent?: number
          id?: string
          months?: number
          plan_type?: string
          price_per_branch?: number
          status?: string
          total_amount?: number
          total_branches?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_modules: {
        Row: {
          business_types: string[]
          countries: string[]
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          sidebar_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_types?: string[]
          countries?: string[]
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          sidebar_label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_types?: string[]
          countries?: string[]
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          sidebar_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_plugins: {
        Row: {
          countries: string[]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          module_ids: string[]
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          countries?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          module_ids?: string[]
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          countries?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          module_ids?: string[]
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_offers: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          entity_id: string
          entity_type: string
          expires_at: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          entity_id: string
          entity_type: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      print_categories: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_commissions: {
        Row: {
          business_id: string
          commission_type: string
          commission_value: number
          created_at: string
          id: string
          product_id: string
          split_type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          product_id: string
          split_type?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          product_id?: string
          split_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_commissions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          business_id: string
          category_id: string | null
          code: string
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          min_stock: number
          name: string
          sale_price: number
          status: Database["public"]["Enums"]["product_status"]
          supplier: string | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          business_id: string
          category_id?: string | null
          code: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          sale_price?: number
          status?: Database["public"]["Enums"]["product_status"]
          supplier?: string | null
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          business_id?: string
          category_id?: string | null
          code?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          sale_price?: number
          status?: Database["public"]["Enums"]["product_status"]
          supplier?: string | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          business_id: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          deletion_scheduled_at: string | null
          email: string
          full_name: string
          id: string
          onboarding_completed: boolean
          phone: string | null
          plan_type: string
          subscription_ends_at: string | null
          subscription_status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          business_id?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_scheduled_at?: string | null
          email: string
          full_name: string
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          plan_type?: string
          subscription_ends_at?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          user_type?: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          business_id?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_scheduled_at?: string | null
          email?: string
          full_name?: string
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          plan_type?: string
          subscription_ends_at?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          affiliate_id: string
          branch_id: string
          comment: string | null
          created_at: string
          id: string
          is_visible: boolean
          rating: number
        }
        Insert: {
          affiliate_id: string
          branch_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          rating: number
        }
        Update: {
          affiliate_id?: string
          branch_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_config: {
        Row: {
          business_id: string
          conditions: Json
          created_at: string
          id: string
          total_positions: number
          updated_at: string
        }
        Insert: {
          business_id: string
          conditions?: Json
          created_at?: string
          id?: string
          total_positions?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          conditions?: Json
          created_at?: string
          id?: string
          total_positions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_modalities: {
        Row: {
          applies_to: string
          business_id: string
          config: Json
          context: string
          created_at: string
          id: string
          is_active: boolean
          modality_type: Database["public"]["Enums"]["salary_modality_type"]
          name: string
          presets: Json
          saved_configs: Json
          updated_at: string
        }
        Insert: {
          applies_to?: string
          business_id: string
          config?: Json
          context?: string
          created_at?: string
          id?: string
          is_active?: boolean
          modality_type: Database["public"]["Enums"]["salary_modality_type"]
          name: string
          presets?: Json
          saved_configs?: Json
          updated_at?: string
        }
        Update: {
          applies_to?: string
          business_id?: string
          config?: Json
          context?: string
          created_at?: string
          id?: string
          is_active?: boolean
          modality_type?: Database["public"]["Enums"]["salary_modality_type"]
          name?: string
          presets?: Json
          saved_configs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_modalities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_price: number
          created_at: string
          discount: number
          id: string
          product_id: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          cost_price: number
          created_at?: string
          discount?: number
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Update: {
          cost_price?: number
          created_at?: string
          discount?: number
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          branch_id: string
          cancellation_reason: string | null
          cash_amount: number
          created_at: string
          customer_id: string | null
          discount: number
          id: string
          notes: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          sale_number: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          total: number
          transfer_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          branch_id: string
          cancellation_reason?: string | null
          cash_amount?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          sale_number: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          total?: number
          transfer_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          branch_id?: string
          cancellation_reason?: string | null
          cash_amount?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          sale_number?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          total?: number
          transfer_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          business_id: string
          created_at: string
          fixed_price: number | null
          icon: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          fixed_price?: number | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          fixed_price?: number | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_entries: {
        Row: {
          amount: number
          branch_id: string
          business_id: string
          category_id: string
          created_at: string
          description: string | null
          id: string
          payment_type: string
          user_id: string
        }
        Insert: {
          amount?: number
          branch_id: string
          business_id: string
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          payment_type?: string
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          business_id?: string
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          payment_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          about_text: string | null
          accent_color: string
          branch_id: string
          contact_email: string | null
          created_at: string
          font_body: string | null
          font_heading: string | null
          has_delivery: boolean
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          is_active: boolean
          schedule: Json
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_twitter: string | null
          updated_at: string
        }
        Insert: {
          about_text?: string | null
          accent_color?: string
          branch_id: string
          contact_email?: string | null
          created_at?: string
          font_body?: string | null
          font_heading?: string | null
          has_delivery?: boolean
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean
          schedule?: Json
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          updated_at?: string
        }
        Update: {
          about_text?: string | null
          accent_color?: string
          branch_id?: string
          contact_email?: string | null
          created_at?: string
          font_body?: string | null
          font_heading?: string | null
          has_delivery?: boolean
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean
          schedule?: Json
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_config: {
        Row: {
          business_id: string
          conditions: Json
          created_at: string
          id: string
          owner_percent: number
          total_positions: number
          updated_at: string
        }
        Insert: {
          business_id: string
          conditions?: Json
          created_at?: string
          id?: string
          owner_percent?: number
          total_positions?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          conditions?: Json
          created_at?: string
          id?: string
          owner_percent?: number
          total_positions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_entries: {
        Row: {
          amount: number
          branch_id: string
          business_id: string
          created_at: string
          date: string
          id: string
          jornada_id: string | null
          notes: string | null
          tip_type: string
          user_id: string
        }
        Insert: {
          amount?: number
          branch_id: string
          business_id: string
          created_at?: string
          date?: string
          id?: string
          jornada_id?: string | null
          notes?: string | null
          tip_type?: string
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          business_id?: string
          created_at?: string
          date?: string
          id?: string
          jornada_id?: string | null
          notes?: string | null
          tip_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_entries_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
        ]
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
      generate_product_code: { Args: { _business_id: string }; Returns: string }
      generate_sale_number: { Args: { _branch_id: string }; Returns: string }
      generate_slug: { Args: { input: string }; Returns: string }
      get_branch_business_id: { Args: { _branch_id: string }; Returns: string }
      get_profiles_by_emails: {
        Args: { emails: string[] }
        Returns: {
          branch_id: string
          business_id: string
          email: string
          id: string
          user_id: string
        }[]
      }
      get_server_now: { Args: never; Returns: string }
      get_user_business_id: { Args: { _user_id: string }; Returns: string }
      get_user_profile_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_employee_of_business: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "owner"
        | "manager"
        | "seller"
        | "accountant"
        | "affiliated"
      inventory_movement_type:
        | "purchase"
        | "sale"
        | "transfer_in"
        | "transfer_out"
        | "loss"
        | "adjustment"
        | "return"
      pay_frequency: "daily" | "weekly" | "biweekly" | "monthly"
      payment_type: "cash" | "credit" | "card" | "transfer" | "mixed"
      product_status: "for_sale" | "warehouse" | "discontinued"
      salary_modality_type:
        | "fixed"
        | "fixed_ladder"
        | "fixed_plus_sales_percent"
        | "sales_percent_only"
        | "profit_percent"
        | "fixed_plus_goal_bonus"
        | "hourly"
        | "custom_mixed"
      sale_status: "completed" | "pending" | "cancelled"
      subscription_status: "pending" | "active" | "suspended" | "cancelled"
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
      app_role: [
        "super_admin",
        "owner",
        "manager",
        "seller",
        "accountant",
        "affiliated",
      ],
      inventory_movement_type: [
        "purchase",
        "sale",
        "transfer_in",
        "transfer_out",
        "loss",
        "adjustment",
        "return",
      ],
      pay_frequency: ["daily", "weekly", "biweekly", "monthly"],
      payment_type: ["cash", "credit", "card", "transfer", "mixed"],
      product_status: ["for_sale", "warehouse", "discontinued"],
      salary_modality_type: [
        "fixed",
        "fixed_ladder",
        "fixed_plus_sales_percent",
        "sales_percent_only",
        "profit_percent",
        "fixed_plus_goal_bonus",
        "hourly",
        "custom_mixed",
      ],
      sale_status: ["completed", "pending", "cancelled"],
      subscription_status: ["pending", "active", "suspended", "cancelled"],
    },
  },
} as const
