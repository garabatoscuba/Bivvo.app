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
      accounting_asset_interventions: {
        Row: {
          asset_id: string
          cost: number
          created_at: string
          description: string
          id: string
          intervention_date: string
          intervention_type: string
          responsible: string | null
        }
        Insert: {
          asset_id: string
          cost?: number
          created_at?: string
          description: string
          id?: string
          intervention_date?: string
          intervention_type?: string
          responsible?: string | null
        }
        Update: {
          asset_id?: string
          cost?: number
          created_at?: string
          description?: string
          id?: string
          intervention_date?: string
          intervention_type?: string
          responsible?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_asset_interventions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "accounting_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_asset_maintenances: {
        Row: {
          asset_id: string
          created_at: string | null
          description: string
          id: string
          is_completed: boolean | null
          scheduled_date: string
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          description: string
          id?: string
          is_completed?: boolean | null
          scheduled_date: string
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          description?: string
          id?: string
          is_completed?: boolean | null
          scheduled_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_asset_maintenances_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "accounting_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_assets: {
        Row: {
          acquisition_cost: number
          acquisition_date: string | null
          adjusted_cost: number
          asset_class: string
          branch_id: string | null
          business_id: string
          code: string | null
          condition: string
          created_at: string
          depreciation_method: string | null
          description: string
          id: string
          location: string | null
          observations: string | null
          quantity: number
          residual_value: number | null
          responsible: string | null
          retirement_date: string | null
          state: string
          supplier: string | null
          useful_life_months: number | null
        }
        Insert: {
          acquisition_cost?: number
          acquisition_date?: string | null
          adjusted_cost?: number
          asset_class?: string
          branch_id?: string | null
          business_id: string
          code?: string | null
          condition?: string
          created_at?: string
          depreciation_method?: string | null
          description: string
          id?: string
          location?: string | null
          observations?: string | null
          quantity?: number
          residual_value?: number | null
          responsible?: string | null
          retirement_date?: string | null
          state?: string
          supplier?: string | null
          useful_life_months?: number | null
        }
        Update: {
          acquisition_cost?: number
          acquisition_date?: string | null
          adjusted_cost?: number
          asset_class?: string
          branch_id?: string | null
          business_id?: string
          code?: string | null
          condition?: string
          created_at?: string
          depreciation_method?: string | null
          description?: string
          id?: string
          location?: string | null
          observations?: string | null
          quantity?: number
          residual_value?: number | null
          responsible?: string | null
          retirement_date?: string | null
          state?: string
          supplier?: string | null
          useful_life_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_expenses: {
        Row: {
          amount: number
          branch_id: string | null
          business_id: string
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          expense_type: string
          frequency: string | null
          id: string
          name: string
          paid_at: string | null
          receipt_url: string | null
          status: string
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          business_id: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          expense_type?: string
          frequency?: string | null
          id?: string
          name: string
          paid_at?: string | null
          receipt_url?: string | null
          status?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          expense_type?: string
          frequency?: string | null
          id?: string
          name?: string
          paid_at?: string | null
          receipt_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "treasury_categories"
            referencedColumns: ["id"]
          },
        ]
      }
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
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "platform_announcements"
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
      assistant_business_type_instructions: {
        Row: {
          business_type: string
          created_at: string
          id: string
          instructions: string
          updated_at: string
        }
        Insert: {
          business_type: string
          created_at?: string
          id?: string
          instructions?: string
          updated_at?: string
        }
        Update: {
          business_type?: string
          created_at?: string
          id?: string
          instructions?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_config: {
        Row: {
          assistant_name: string
          base_instructions: string
          created_at: string
          id: string
          is_enabled: boolean
          tone: string
          updated_at: string
        }
        Insert: {
          assistant_name?: string
          base_instructions?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          tone?: string
          updated_at?: string
        }
        Update: {
          assistant_name?: string
          base_instructions?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_context_actions: {
        Row: {
          action_payload: Json
          action_type: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          action_payload?: Json
          action_type?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      assistant_conversations: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
          user_role: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
          user_role?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_feature_pricing: {
        Row: {
          availability: string
          created_at: string
          feature_id: string
          id: string
          monthly_price: number
          plan_type: string
          updated_at: string
        }
        Insert: {
          availability?: string
          created_at?: string
          feature_id: string
          id?: string
          monthly_price?: number
          plan_type: string
          updated_at?: string
        }
        Update: {
          availability?: string
          created_at?: string
          feature_id?: string
          id?: string
          monthly_price?: number
          plan_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_feature_pricing_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "assistant_features"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_feature_roles: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          is_allowed: boolean
          role: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          is_allowed?: boolean
          role: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          is_allowed?: boolean
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_feature_roles_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "assistant_features"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_feature_usage: {
        Row: {
          business_id: string
          created_at: string
          feature_key: string
          id: string
          last_used_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          feature_key: string
          id?: string
          last_used_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          feature_key?: string
          id?: string
          last_used_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_feature_usage_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_features: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      assistant_module_instructions: {
        Row: {
          id: string
          instructions: string
          module_key: string
          updated_at: string
        }
        Insert: {
          id?: string
          instructions?: string
          module_key: string
          updated_at?: string
        }
        Update: {
          id?: string
          instructions?: string
          module_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_quick_questions: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          is_active: boolean
          module_key: string | null
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          module_key?: string | null
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          module_key?: string | null
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      assistant_training_examples: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_description: string
          action_type: string
          branch_id: string | null
          business_id: string
          code: string
          created_at: string
          device_info: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string
          user_name: string
          user_role: string
        }
        Insert: {
          action_description?: string
          action_type: string
          branch_id?: string | null
          business_id: string
          code: string
          created_at?: string
          device_info?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id: string
          user_name?: string
          user_role?: string
        }
        Update: {
          action_description?: string
          action_type?: string
          branch_id?: string | null
          business_id?: string
          code?: string
          created_at?: string
          device_info?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string
          user_name?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      business_periods: {
        Row: {
          business_id: string
          created_at: string
          ended_at: string | null
          id: string
          is_active: boolean
          name: string
          started_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          started_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_periods_business_id_fkey"
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
          is_free: boolean
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
          is_free?: boolean
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
          is_free?: boolean
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
          dashboard_reset_at: string | null
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
          dashboard_reset_at?: string | null
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
          dashboard_reset_at?: string | null
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
          low_bill_denominations: number[]
          mode: string
          next_day_fund_amount: number
          next_day_fund_mode: string
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
          low_bill_denominations?: number[]
          mode?: string
          next_day_fund_amount?: number
          next_day_fund_mode?: string
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
          low_bill_denominations?: number[]
          mode?: string
          next_day_fund_amount?: number
          next_day_fund_mode?: string
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
      cash_register_movements: {
        Row: {
          amount: number
          archived: boolean
          archived_at: string | null
          branch_id: string
          business_id: string
          cash_register_id: string
          created_at: string
          id: string
          movement_type: string
          reason: string | null
          user_id: string
        }
        Insert: {
          amount: number
          archived?: boolean
          archived_at?: string | null
          branch_id: string
          business_id: string
          cash_register_id: string
          created_at?: string
          id?: string
          movement_type: string
          reason?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          archived?: boolean
          archived_at?: string | null
          branch_id?: string
          business_id?: string
          cash_register_id?: string
          created_at?: string
          id?: string
          movement_type?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
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
          next_day_fund: number
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
          next_day_fund?: number
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
          next_day_fund?: number
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
          full_multiplier: number
          id: string
          mode: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          full_multiplier?: number
          id?: string
          mode?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          full_multiplier?: number
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
          archived: boolean
          archived_at: string | null
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
          archived?: boolean
          archived_at?: string | null
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
          archived?: boolean
          archived_at?: string | null
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
      employee_insumo_areas: {
        Row: {
          business_id: string | null
          created_at: string | null
          employee_id: string | null
          id: string
          insumo_area_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          insumo_area_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          insumo_area_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_insumo_areas_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_insumo_areas_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_insumo_areas_insumo_area_id_fkey"
            columns: ["insumo_area_id"]
            isOneToOne: false
            referencedRelation: "insumo_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_material_stock: {
        Row: {
          branch_id: string | null
          business_id: string
          created_at: string
          employee_id: string
          id: string
          material_id: string
          stock: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          created_at?: string
          employee_id: string
          id?: string
          material_id: string
          stock?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          material_id?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_material_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_material_stock_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_material_stock_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_material_stock_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
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
      employee_salary_deductions: {
        Row: {
          aplicado: boolean | null
          business_id: string
          concepto: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          id: string
          monto: number
          notas: string | null
          periodo_fin: string
          periodo_inicio: string
          referencia_id: string | null
          referencia_tipo: string | null
        }
        Insert: {
          aplicado?: boolean | null
          business_id: string
          concepto: string
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          id?: string
          monto: number
          notas?: string | null
          periodo_fin: string
          periodo_inicio: string
          referencia_id?: string | null
          referencia_tipo?: string | null
        }
        Update: {
          aplicado?: boolean | null
          business_id?: string
          concepto?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          id?: string
          monto?: number
          notas?: string | null
          periodo_fin?: string
          periodo_inicio?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_deductions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_records: {
        Row: {
          amount: number
          branch_id: string
          business_id: string
          created_at: string
          employee_name: string
          employee_user_id: string | null
          id: string
          jornada_id: string | null
          payment_method: string
          salary_date: string
        }
        Insert: {
          amount?: number
          branch_id: string
          business_id: string
          created_at?: string
          employee_name: string
          employee_user_id?: string | null
          id?: string
          jornada_id?: string | null
          payment_method?: string
          salary_date?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          business_id?: string
          created_at?: string
          employee_name?: string
          employee_user_id?: string | null
          id?: string
          jornada_id?: string | null
          payment_method?: string
          salary_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_records_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          age: number | null
          auth_user_id: string | null
          branch_id: string | null
          business_id: string
          ci: string
          contract_number: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_jefe: boolean | null
          license_number: string | null
          merma_descuento_pct: number | null
          position: string
          start_date: string
          station: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          auth_user_id?: string | null
          branch_id?: string | null
          business_id: string
          ci: string
          contract_number: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_jefe?: boolean | null
          license_number?: string | null
          merma_descuento_pct?: number | null
          position?: string
          start_date?: string
          station?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          auth_user_id?: string | null
          branch_id?: string | null
          business_id?: string
          ci?: string
          contract_number?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_jefe?: boolean | null
          license_number?: string | null
          merma_descuento_pct?: number | null
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
      evaluation_templates: {
        Row: {
          business_id: string
          categories: Json
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          categories?: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          categories?: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      insumo_areas: {
        Row: {
          business_id: string
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_internal: boolean
          name: string
        }
        Insert: {
          business_id: string
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_internal?: boolean
          name: string
        }
        Update: {
          business_id?: string
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_internal?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumo_areas_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          branch_id: string
          business_id: string
          counted_stock: number
          created_at: string
          difference: number
          id: string
          product_id: string
          shift_id: string | null
          system_stock: number
          user_id: string
        }
        Insert: {
          branch_id: string
          business_id: string
          counted_stock?: number
          created_at?: string
          difference?: number
          id?: string
          product_id: string
          shift_id?: string | null
          system_stock?: number
          user_id: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          counted_stock?: number
          created_at?: string
          difference?: number
          id?: string
          product_id?: string
          shift_id?: string | null
          system_stock?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_voided: boolean
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          user_id: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_voided?: boolean
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          user_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_voided?: boolean
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          user_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
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
          archived: boolean
          archived_at: string | null
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
          archived?: boolean
          archived_at?: string | null
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
          archived?: boolean
          archived_at?: string | null
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
      kitchen_orders: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          id: string
          items: Json
          notes: string | null
          priority: string | null
          sale_id: string | null
          sale_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          priority?: string | null
          sale_id?: string | null
          sale_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          priority?: string | null
          sale_id?: string | null
          sale_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      module_assignments: {
        Row: {
          created_at: string
          id: string
          module_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
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
      partner_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          paid_at: string
          partner_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          partner_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referrals: {
        Row: {
          commission_earned: number
          commission_status: string
          created_at: string
          id: string
          partner_id: string
          plan_type: string | null
          referred_user_id: string
          used_at: string
        }
        Insert: {
          commission_earned?: number
          commission_status?: string
          created_at?: string
          id?: string
          partner_id: string
          plan_type?: string | null
          referred_user_id: string
          used_at?: string
        }
        Update: {
          commission_earned?: number
          commission_status?: string
          created_at?: string
          id?: string
          partner_id?: string
          plan_type?: string | null
          referred_user_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          applies_to_plans: string[]
          code: string
          commission_duration_months: number | null
          commission_percent: number
          created_at: string
          discount_duration_months: number | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          user_id: string
          user_limit: number | null
        }
        Insert: {
          applies_to_plans?: string[]
          code: string
          commission_duration_months?: number | null
          commission_percent?: number
          created_at?: string
          discount_duration_months?: number | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          user_id: string
          user_limit?: number | null
        }
        Update: {
          applies_to_plans?: string[]
          code?: string
          commission_duration_months?: number | null
          commission_percent?: number
          created_at?: string
          discount_duration_months?: number | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          user_id?: string
          user_limit?: number | null
        }
        Relationships: []
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
      plan_offers: {
        Row: {
          applies_to_plans: string[]
          created_at: string
          description: string | null
          discount_duration_months: number | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          name: string
          starts_at: string
          target_type: string
          target_user_ids: string[]
          updated_at: string
        }
        Insert: {
          applies_to_plans?: string[]
          created_at?: string
          description?: string | null
          discount_duration_months?: number | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          starts_at?: string
          target_type?: string
          target_user_ids?: string[]
          updated_at?: string
        }
        Update: {
          applies_to_plans?: string[]
          created_at?: string
          description?: string | null
          discount_duration_months?: number | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          starts_at?: string
          target_type?: string
          target_user_ids?: string[]
          updated_at?: string
        }
        Relationships: []
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
          is_free: boolean
          months: number
          partner_id: string | null
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
          is_free?: boolean
          months: number
          partner_id?: string | null
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
          is_free?: boolean
          months?: number
          partner_id?: string | null
          plan_type?: string
          price_per_branch?: number
          status?: string
          total_amount?: number
          total_branches?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_requests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          frequency_days: number
          id: string
          is_active: boolean
          is_persistent: boolean
          link_label: string | null
          link_url: string | null
          message: string
          starts_at: string
          target_type: string
          target_value: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          frequency_days?: number
          id?: string
          is_active?: boolean
          is_persistent?: boolean
          link_label?: string | null
          link_url?: string | null
          message: string
          starts_at?: string
          target_type?: string
          target_value?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          frequency_days?: number
          id?: string
          is_active?: boolean
          is_persistent?: boolean
          link_label?: string | null
          link_url?: string | null
          message?: string
          starts_at?: string
          target_type?: string
          target_value?: string | null
          title?: string
          updated_at?: string
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
      portal_promo_blocks: {
        Row: {
          block_number: number
          branch_id: string
          business_id: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_target: string | null
          text_primary: string | null
          text_secondary: string | null
          updated_at: string
        }
        Insert: {
          block_number: number
          branch_id: string
          business_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_target?: string | null
          text_primary?: string | null
          text_secondary?: string | null
          updated_at?: string
        }
        Update: {
          block_number?: number
          branch_id?: string
          business_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_target?: string | null
          text_primary?: string | null
          text_secondary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_promo_blocks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_promo_blocks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
      print_active_sheets: {
        Row: {
          branch_id: string
          business_id: string
          closed_at: string | null
          created_at: string
          id: string
          material_id: string
          status: string
          tramos_total: number
          tramos_usados: number
          user_id: string
        }
        Insert: {
          branch_id: string
          business_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          material_id: string
          status?: string
          tramos_total?: number
          tramos_usados?: number
          user_id: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          material_id?: string
          status?: string
          tramos_total?: number
          tramos_usados?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_active_sheets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_active_sheets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_active_sheets_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
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
      print_ink_inventory: {
        Row: {
          business_id: string
          cantidad: number
          color: string
          costo_total: number
          created_at: string
          fecha_compra: string
          id: string
          nota: string | null
          tipo: string
          ubicacion: string
          unidad: string
          user_id: string
        }
        Insert: {
          business_id: string
          cantidad?: number
          color?: string
          costo_total?: number
          created_at?: string
          fecha_compra?: string
          id?: string
          nota?: string | null
          tipo?: string
          ubicacion?: string
          unidad?: string
          user_id: string
        }
        Update: {
          business_id?: string
          cantidad?: number
          color?: string
          costo_total?: number
          created_at?: string
          fecha_compra?: string
          id?: string
          nota?: string | null
          tipo?: string
          ubicacion?: string
          unidad?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_ink_inventory_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      print_ink_usage: {
        Row: {
          business_id: string
          cantidad_consumida: number
          color: string
          costo_por_hoja: number
          created_at: string
          hojas_impresas: number
          id: string
          is_automatic: boolean
          job_item_id: string | null
          nota: string | null
          periodo_fin: string | null
          periodo_inicio: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          cantidad_consumida?: number
          color: string
          costo_por_hoja?: number
          created_at?: string
          hojas_impresas?: number
          id?: string
          is_automatic?: boolean
          job_item_id?: string | null
          nota?: string | null
          periodo_fin?: string | null
          periodo_inicio?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          cantidad_consumida?: number
          color?: string
          costo_por_hoja?: number
          created_at?: string
          hojas_impresas?: number
          id?: string
          is_automatic?: boolean
          job_item_id?: string | null
          nota?: string | null
          periodo_fin?: string | null
          periodo_inicio?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_ink_usage_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_ink_usage_job_item_id_fkey"
            columns: ["job_item_id"]
            isOneToOne: false
            referencedRelation: "print_job_items"
            referencedColumns: ["id"]
          },
        ]
      }
      print_job_items: {
        Row: {
          cantidad: number
          colores_seleccionados: string[] | null
          costo_insumo: number
          created_at: string
          es_color: boolean
          es_doble_cara: boolean
          es_full: boolean
          id: string
          job_id: string
          material_consumido: number
          nota: string | null
          precio_cobrado: number
          printer_id: string | null
          service_type_id: string | null
        }
        Insert: {
          cantidad?: number
          colores_seleccionados?: string[] | null
          costo_insumo?: number
          created_at?: string
          es_color?: boolean
          es_doble_cara?: boolean
          es_full?: boolean
          id?: string
          job_id: string
          material_consumido?: number
          nota?: string | null
          precio_cobrado?: number
          printer_id?: string | null
          service_type_id?: string | null
        }
        Update: {
          cantidad?: number
          colores_seleccionados?: string[] | null
          costo_insumo?: number
          created_at?: string
          es_color?: boolean
          es_doble_cara?: boolean
          es_full?: boolean
          id?: string
          job_id?: string
          material_consumido?: number
          nota?: string | null
          precio_cobrado?: number
          printer_id?: string | null
          service_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "print_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_job_items_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "print_printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_job_items_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "print_service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          branch_id: string | null
          business_id: string
          created_at: string
          id: string
          nota: string | null
          payment_method: string
          total: number
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          nota?: string | null
          payment_method?: string
          total?: number
          user_id: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          nota?: string | null
          payment_method?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      print_material_types: {
        Row: {
          created_at: string
          id: string
          name: string
          permite_tramos: boolean
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permite_tramos?: boolean
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permite_tramos?: boolean
          unit?: string
        }
        Relationships: []
      }
      print_printers: {
        Row: {
          branch_id: string | null
          business_id: string
          colores: string[]
          created_at: string
          id: string
          is_active: boolean
          name: string
          soporta_full: boolean
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          colores?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          soporta_full?: boolean
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          colores?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          soporta_full?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "print_printers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_printers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      print_productions: {
        Row: {
          branch_id: string | null
          business_id: string
          cantidad_producida: number
          created_at: string
          id: string
          nota: string | null
          recipe_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          cantidad_producida?: number
          created_at?: string
          id?: string
          nota?: string | null
          recipe_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          cantidad_producida?: number
          created_at?: string
          id?: string
          nota?: string | null
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_productions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_productions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_productions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "print_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      print_recipe_materials: {
        Row: {
          cantidad_por_produccion: number
          created_at: string
          id: string
          material_id: string
          recipe_id: string
        }
        Insert: {
          cantidad_por_produccion?: number
          created_at?: string
          id?: string
          material_id: string
          recipe_id: string
        }
        Update: {
          cantidad_por_produccion?: number
          created_at?: string
          id?: string
          material_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_recipe_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_recipe_materials_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "print_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      print_recipes: {
        Row: {
          business_id: string
          created_at: string
          descripcion: string | null
          id: string
          is_active: boolean
          name: string
          unidades_produce: number
        }
        Insert: {
          business_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          is_active?: boolean
          name: string
          unidades_produce?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          is_active?: boolean
          name?: string
          unidades_produce?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_recipes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      print_service_types: {
        Row: {
          admite_color: boolean
          admite_doble_cara: boolean
          admite_full: boolean
          business_id: string
          consumo_por_unidad: number
          created_at: string
          icon: string
          id: string
          is_active: boolean
          material_id: string | null
          name: string
          precio_base: number
          rendimiento_especial: Json | null
          tramos_por_unidad: number
          unit_label: string
          vende_por_tramos: boolean
        }
        Insert: {
          admite_color?: boolean
          admite_doble_cara?: boolean
          admite_full?: boolean
          business_id: string
          consumo_por_unidad?: number
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          material_id?: string | null
          name: string
          precio_base?: number
          rendimiento_especial?: Json | null
          tramos_por_unidad?: number
          unit_label?: string
          vende_por_tramos?: boolean
        }
        Update: {
          admite_color?: boolean
          admite_doble_cara?: boolean
          admite_full?: boolean
          business_id?: string
          consumo_por_unidad?: number
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          material_id?: string | null
          name?: string
          precio_base?: number
          rendimiento_especial?: Json | null
          tramos_por_unidad?: number
          unit_label?: string
          vende_por_tramos?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "print_service_types_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_service_types_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      print_shrinkage: {
        Row: {
          branch_id: string | null
          business_id: string
          cantidad: number
          created_at: string
          estado: string | null
          id: string
          material_id: string
          monto_descuento: number | null
          motivo: string | null
          nota: string | null
          resuelto_at: string | null
          resuelto_por: string | null
          user_id: string
          valor_perdido: number | null
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          cantidad?: number
          created_at?: string
          estado?: string | null
          id?: string
          material_id: string
          monto_descuento?: number | null
          motivo?: string | null
          nota?: string | null
          resuelto_at?: string | null
          resuelto_por?: string | null
          user_id: string
          valor_perdido?: number | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          cantidad?: number
          created_at?: string
          estado?: string | null
          id?: string
          material_id?: string
          monto_descuento?: number | null
          motivo?: string | null
          nota?: string | null
          resuelto_at?: string | null
          resuelto_por?: string | null
          user_id?: string
          valor_perdido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "print_shrinkage_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_shrinkage_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_shrinkage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
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
      product_entries: {
        Row: {
          branch_id: string
          business_id: string
          cost_per_unit: number
          created_at: string
          entry_date: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          sale_price_per_unit: number
          user_id: string | null
        }
        Insert: {
          branch_id: string
          business_id: string
          cost_per_unit?: number
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          sale_price_per_unit?: number
          user_id?: string | null
        }
        Update: {
          branch_id?: string
          business_id?: string
          cost_per_unit?: number
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          sale_price_per_unit?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_entries: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          freight_cost: number | null
          id: string
          is_voided: boolean
          notes: string | null
          product_id: string
          purchase_unit: string | null
          quantity: number
          reason: string | null
          resulting_avg_cost: number | null
          sale_price: number | null
          supplier: string | null
          unit_cost: number | null
          user_id: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          freight_cost?: number | null
          id?: string
          is_voided?: boolean
          notes?: string | null
          product_id: string
          purchase_unit?: string | null
          quantity?: number
          reason?: string | null
          resulting_avg_cost?: number | null
          sale_price?: number | null
          supplier?: string | null
          unit_cost?: number | null
          user_id: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          freight_cost?: number | null
          id?: string
          is_voided?: boolean
          notes?: string | null
          product_id?: string
          purchase_unit?: string | null
          quantity?: number
          reason?: string | null
          resulting_avg_cost?: number | null
          sale_price?: number | null
          supplier?: string | null
          unit_cost?: number | null
          user_id?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_entries_product_id_fkey"
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
          cost_method: string | null
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          indirect_cost_amount: number | null
          indirect_cost_percentage: number | null
          insumo_area_id: string | null
          min_stock: number
          name: string
          sale_price: number
          status: Database["public"]["Enums"]["product_status"]
          supplier: string | null
          tipo: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          business_id: string
          category_id?: string | null
          code: string
          cost_method?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          indirect_cost_amount?: number | null
          indirect_cost_percentage?: number | null
          insumo_area_id?: string | null
          min_stock?: number
          name: string
          sale_price?: number
          status?: Database["public"]["Enums"]["product_status"]
          supplier?: string | null
          tipo?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          business_id?: string
          category_id?: string | null
          code?: string
          cost_method?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          indirect_cost_amount?: number | null
          indirect_cost_percentage?: number | null
          insumo_area_id?: string | null
          min_stock?: number
          name?: string
          sale_price?: number
          status?: Database["public"]["Enums"]["product_status"]
          supplier?: string | null
          tipo?: string
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
          {
            foreignKeyName: "products_insumo_area_id_fkey"
            columns: ["insumo_area_id"]
            isOneToOne: false
            referencedRelation: "insumo_areas"
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
          last_login_at: string | null
          onboarding_completed: boolean
          phone: string | null
          plan_type: string
          referral_code: string | null
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
          last_login_at?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          plan_type?: string
          referral_code?: string | null
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
          last_login_at?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          plan_type?: string
          referral_code?: string | null
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
      raw_material_entries: {
        Row: {
          branch_id: string | null
          business_id: string
          cantidad: number
          costo_unitario: number
          created_at: string
          entry_type: string
          id: string
          is_voided: boolean
          material_id: string
          nota: string | null
          purchase_unit: string | null
          resulting_avg_cost: number | null
          user_id: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          cantidad?: number
          costo_unitario?: number
          created_at?: string
          entry_type?: string
          id?: string
          is_voided?: boolean
          material_id: string
          nota?: string | null
          purchase_unit?: string | null
          resulting_avg_cost?: number | null
          user_id: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          cantidad?: number
          costo_unitario?: number
          created_at?: string
          entry_type?: string
          id?: string
          is_voided?: boolean
          material_id?: string
          nota?: string | null
          purchase_unit?: string | null
          resulting_avg_cost?: number | null
          user_id?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_entries_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_transfers: {
        Row: {
          branch_id: string | null
          business_id: string
          cantidad: number
          created_at: string
          from_user_id: string
          id: string
          material_id: string
          nota: string | null
          to_user_id: string
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          cantidad?: number
          created_at?: string
          from_user_id: string
          id?: string
          material_id: string
          nota?: string | null
          to_user_id: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          cantidad?: number
          created_at?: string
          from_user_id?: string
          id?: string
          material_id?: string
          nota?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_transfers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_transfers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_transfers_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          area_id: string | null
          branch_id: string | null
          brand: string | null
          business_id: string
          category_id: string | null
          conversion_factor: number | null
          costo_unitario: number
          created_at: string
          description: string | null
          id: string
          material_type_id: string | null
          name: string
          porcentaje_tinta: number
          stock_almacen: number
          stock_minimo: number
          stock_vendedor: number
          unit_purchase: string | null
          unit_use: string | null
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          branch_id?: string | null
          brand?: string | null
          business_id: string
          category_id?: string | null
          conversion_factor?: number | null
          costo_unitario?: number
          created_at?: string
          description?: string | null
          id?: string
          material_type_id?: string | null
          name: string
          porcentaje_tinta?: number
          stock_almacen?: number
          stock_minimo?: number
          stock_vendedor?: number
          unit_purchase?: string | null
          unit_use?: string | null
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          branch_id?: string | null
          brand?: string | null
          business_id?: string
          category_id?: string | null
          conversion_factor?: number | null
          costo_unitario?: number
          created_at?: string
          description?: string | null
          id?: string
          material_type_id?: string | null
          name?: string
          porcentaje_tinta?: number
          stock_almacen?: number
          stock_minimo?: number
          stock_vendedor?: number
          unit_purchase?: string | null
          unit_use?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "insumo_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_material_type_id_fkey"
            columns: ["material_type_id"]
            isOneToOne: false
            referencedRelation: "print_material_types"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          gramaje: number
          id: string
          ingredient_id: string
          ingredient_type: string
          is_raw_material: boolean
          quantity: number
          recipe_id: string
          surcharge: number
          unit: string
        }
        Insert: {
          created_at?: string
          gramaje?: number
          id?: string
          ingredient_id: string
          ingredient_type?: string
          is_raw_material?: boolean
          quantity?: number
          recipe_id: string
          surcharge?: number
          unit?: string
        }
        Update: {
          created_at?: string
          gramaje?: number
          id?: string
          ingredient_id?: string
          ingredient_type?: string
          is_raw_material?: boolean
          quantity?: number
          recipe_id?: string
          surcharge?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          product_id: string
          updated_at: string
          yield_quantity: number
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_id: string
          updated_at?: string
          yield_quantity?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_id?: string
          updated_at?: string
          yield_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          affiliate_id: string | null
          branch_id: string
          comment: string | null
          created_at: string
          id: string
          is_visible: boolean
          phone_number: string | null
          product_name: string | null
          rating: number | null
        }
        Insert: {
          affiliate_id?: string | null
          branch_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          phone_number?: string | null
          product_name?: string | null
          rating?: number | null
        }
        Update: {
          affiliate_id?: string | null
          branch_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          phone_number?: string | null
          product_name?: string | null
          rating?: number | null
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
          archived: boolean
          archived_at: string | null
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
          user_id: string | null
        }
        Insert: {
          amount_paid?: number
          archived?: boolean
          archived_at?: string | null
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
          user_id?: string | null
        }
        Update: {
          amount_paid?: number
          archived?: boolean
          archived_at?: string | null
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
          user_id?: string | null
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
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_catalog: boolean
          payment_type: string
          service_name: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          branch_id: string
          business_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_catalog?: boolean
          payment_type?: string
          service_name?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          business_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_catalog?: boolean
          payment_type?: string
          service_name?: string | null
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
          whatsapp_number: string | null
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
          whatsapp_number?: string | null
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
          whatsapp_number?: string | null
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
      treasury_categories: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "treasury_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_movements: {
        Row: {
          amount: number
          archived: boolean
          archived_at: string | null
          branch_id: string | null
          business_id: string
          cash_amount: number
          category_id: string | null
          created_at: string
          id: string
          label: string
          movement_type: string
          origin: string | null
          payment_method: string
          reason: string | null
          registered_by: string
          transfer_amount: number
        }
        Insert: {
          amount: number
          archived?: boolean
          archived_at?: string | null
          branch_id?: string | null
          business_id: string
          cash_amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          label?: string
          movement_type: string
          origin?: string | null
          payment_method?: string
          reason?: string | null
          registered_by: string
          transfer_amount?: number
        }
        Update: {
          amount?: number
          archived?: boolean
          archived_at?: string | null
          branch_id?: string | null
          business_id?: string
          cash_amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          label?: string
          movement_type?: string
          origin?: string | null
          payment_method?: string
          reason?: string | null
          registered_by?: string
          transfer_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "treasury_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_movements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "treasury_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_pending_entries: {
        Row: {
          amount: number
          business_id: string
          cash_register_id: string
          created_at: string
          employee_user_id: string
          id: string
          status: string
        }
        Insert: {
          amount?: number
          business_id: string
          cash_register_id: string
          created_at?: string
          employee_user_id: string
          id?: string
          status?: string
        }
        Update: {
          amount?: number
          business_id?: string
          cash_register_id?: string
          created_at?: string
          employee_user_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_pending_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_pending_entries_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
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
      convert_recipe_units: {
        Args: { _from_unit: string; _qty: number; _to_unit: string }
        Returns: number
      }
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
      increment_feature_usage: {
        Args: { _business_id: string; _feature_key: string; _user_id: string }
        Returns: undefined
      }
      insert_audit_log: {
        Args: {
          _action_description: string
          _action_type: string
          _branch_id: string
          _business_id: string
          _device_info?: string
          _entity_id?: string
          _entity_type?: string
          _user_id: string
          _user_name: string
          _user_role: string
        }
        Returns: undefined
      }
      is_employee_of_business: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      recalculate_elaborado_stock: {
        Args: { _branch_id: string; _elaborado_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "owner"
        | "manager"
        | "seller"
        | "accountant"
        | "affiliated"
        | "partner"
        | "cocina"
        | "operator"
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
        | "fixed_plus_profit_percent"
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
        "partner",
        "cocina",
        "operator",
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
        "fixed_plus_profit_percent",
      ],
      sale_status: ["completed", "pending", "cancelled"],
      subscription_status: ["pending", "active", "suspended", "cancelled"],
    },
  },
} as const
