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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          analytic: boolean
          church_kind: Database["public"]["Enums"]["contribution_kind"] | null
          code: string
          created_at: string
          id: string
          name: string
          org_id: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          analytic?: boolean
          church_kind?: Database["public"]["Enums"]["contribution_kind"] | null
          code: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          analytic?: boolean
          church_kind?: Database["public"]["Enums"]["contribution_kind"] | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_budget_history: {
        Row: {
          action: string
          budget_id: string
          details: Json | null
          id: string
          org_id: string
          performed_at: string
          performed_by: string | null
        }
        Insert: {
          action: string
          budget_id: string
          details?: Json | null
          id?: string
          org_id: string
          performed_at?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          budget_id?: string
          details?: Json | null
          id?: string
          org_id?: string
          performed_at?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annual_budget_history_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "annual_budget_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_budget_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_budget_items: {
        Row: {
          account_id: string
          budget_id: string
          congregation_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string | null
          id: string
          monthly_values: Json
          org_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          budget_id: string
          congregation_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          monthly_values?: Json
          org_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          budget_id?: string
          congregation_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          monthly_values?: Json
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annual_budget_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "annual_budget_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_budget_items_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_budget_items_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_budget_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_budget_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          end_date: string | null
          fiscal_year: number
          id: string
          notes: string | null
          org_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          fiscal_year: number
          id?: string
          notes?: string | null
          org_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          fiscal_year?: number
          id?: string
          notes?: string | null
          org_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "annual_budget_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_id: string
          account_label: string | null
          account_number_masked: string | null
          active: boolean
          bank_name: string
          branch: string | null
          created_at: string
          id: string
          opening_balance: number
          opening_date: string
          org_id: string
        }
        Insert: {
          account_id: string
          account_label?: string | null
          account_number_masked?: string | null
          active?: boolean
          bank_name: string
          branch?: string | null
          created_at?: string
          id?: string
          opening_balance?: number
          opening_date?: string
          org_id: string
        }
        Update: {
          account_id?: string
          account_label?: string | null
          account_number_masked?: string | null
          active?: boolean
          bank_name?: string
          branch?: string | null
          created_at?: string
          id?: string
          opening_balance?: number
          opening_date?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          action: string
          difference: number
          id: string
          journal_line_id: string
          org_id: string
          performed_at: string
          performed_by: string
          statement_line_id: string
        }
        Insert: {
          action?: string
          difference?: number
          id?: string
          journal_line_id: string
          org_id: string
          performed_at?: string
          performed_by?: string
          statement_line_id: string
        }
        Update: {
          action?: string
          difference?: number
          id?: string
          journal_line_id?: string
          org_id?: string
          performed_at?: string
          performed_by?: string
          statement_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_journal_line_id_fkey"
            columns: ["journal_line_id"]
            isOneToOne: false
            referencedRelation: "journal_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number
          bank_account_id: string
          description: string
          direction: string
          document: string | null
          id: string
          journal_line_id: string | null
          line_hash: string
          org_id: string
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_status: string
          statement_id: string
          transaction_date: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          description: string
          direction: string
          document?: string | null
          id?: string
          journal_line_id?: string | null
          line_hash: string
          org_id: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_status?: string
          statement_id: string
          transaction_date: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          description?: string
          direction?: string
          document?: string | null
          id?: string
          journal_line_id?: string | null
          line_hash?: string
          org_id?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_status?: string
          statement_id?: string
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_journal_line_id_fkey"
            columns: ["journal_line_id"]
            isOneToOne: true
            referencedRelation: "journal_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          closing_balance: number
          created_at: string
          id: string
          import_source: string | null
          imported_by: string | null
          opening_balance: number
          org_id: string
          statement_date: string
        }
        Insert: {
          bank_account_id: string
          closing_balance?: number
          created_at?: string
          id?: string
          import_source?: string | null
          imported_by?: string | null
          opening_balance?: number
          org_id: string
          statement_date: string
        }
        Update: {
          bank_account_id?: string
          closing_balance?: number
          created_at?: string
          id?: string
          import_source?: string | null
          imported_by?: string | null
          opening_balance?: number
          org_id?: string
          statement_date?: string
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
            foreignKeyName: "bank_statements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      church_members: {
        Row: {
          address: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          joined_at: string | null
          notes: string | null
          org_id: string
          phone: string | null
          registration_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          joined_at?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          registration_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          joined_at?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          registration_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      congregations: {
        Row: {
          city: string | null
          created_at: string
          id: string
          leader: string | null
          name: string
          org_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          leader?: string | null
          name: string
          org_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          leader?: string | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "congregations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          amount: number
          congregation_id: string | null
          contribution_date: string
          contributor: string | null
          created_at: string
          entry_id: string | null
          id: string
          kind: Database["public"]["Enums"]["contribution_kind"]
          member_id: string | null
          org_id: string
        }
        Insert: {
          amount: number
          congregation_id?: string | null
          contribution_date?: string
          contributor?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["contribution_kind"]
          member_id?: string | null
          org_id: string
        }
        Update: {
          amount?: number
          congregation_id?: string | null
          contribution_date?: string
          contributor?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["contribution_kind"]
          member_id?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_year_closings: {
        Row: {
          closed_at: string
          closed_by: string
          entry_id: string | null
          fiscal_year: number
          id: string
          notes: string | null
          org_id: string
          profit_loss_account_id: string | null
          result_amount: number
        }
        Insert: {
          closed_at?: string
          closed_by?: string
          entry_id?: string | null
          fiscal_year: number
          id?: string
          notes?: string | null
          org_id: string
          profit_loss_account_id?: string | null
          result_amount?: number
        }
        Update: {
          closed_at?: string
          closed_by?: string
          entry_id?: string | null
          fiscal_year?: number
          id?: string
          notes?: string | null
          org_id?: string
          profit_loss_account_id?: string | null
          result_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_year_closings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_year_closings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_year_closings_profit_loss_account_id_fkey"
            columns: ["profit_loss_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          acquisition_date: string | null
          acquisition_value: number
          asset_code: string
          category: string | null
          condition: string
          congregation_id: string | null
          created_at: string
          description: string
          id: string
          location: string | null
          org_id: string
          residual_value: number
          responsible: string | null
          serial_number: string | null
          status: string
          useful_life_months: number | null
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_value?: number
          asset_code: string
          category?: string | null
          condition?: string
          congregation_id?: string | null
          created_at?: string
          description: string
          id?: string
          location?: string | null
          org_id: string
          residual_value?: number
          responsible?: string | null
          serial_number?: string | null
          status?: string
          useful_life_months?: number | null
        }
        Update: {
          acquisition_date?: string | null
          acquisition_value?: number
          asset_code?: string
          category?: string | null
          condition?: string
          congregation_id?: string | null
          created_at?: string
          description?: string
          id?: string
          location?: string | null
          org_id?: string
          residual_value?: number
          responsible?: string | null
          serial_number?: string | null
          status?: string
          useful_life_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string
          id: string
          min_quantity: number
          org_id: string
          sku: string | null
          unit: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description: string
          id?: string
          min_quantity?: number
          org_id: string
          sku?: string | null
          unit?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          min_quantity?: number
          org_id?: string
          sku?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string
          document: string | null
          from_congregation_id: string | null
          id: string
          item_id: string
          movement_date: string
          movement_type: string
          notes: string | null
          org_id: string
          quantity: number
          responsible: string | null
          session_id: string | null
          to_congregation_id: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          document?: string | null
          from_congregation_id?: string | null
          id?: string
          item_id: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          org_id: string
          quantity: number
          responsible?: string | null
          session_id?: string | null
          to_congregation_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          document?: string | null
          from_congregation_id?: string | null
          id?: string
          item_id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          org_id?: string
          quantity?: number
          responsible?: string | null
          session_id?: string | null
          to_congregation_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_from_congregation_id_fkey"
            columns: ["from_congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "physical_inventory_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_to_congregation_id_fkey"
            columns: ["to_congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string
          description: string
          document: string | null
          entry_date: string
          id: string
          mode: Database["public"]["Enums"]["entry_mode"]
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description: string
          document?: string | null
          entry_date?: string
          id?: string
          mode?: Database["public"]["Enums"]["entry_mode"]
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          document?: string | null
          entry_date?: string
          id?: string
          mode?: Database["public"]["Enums"]["entry_mode"]
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_reversals: {
        Row: {
          id: string
          org_id: string
          original_entry_id: string
          reason: string
          reversal_entry_id: string
          reversed_at: string
          reversed_by: string
        }
        Insert: {
          id?: string
          org_id: string
          original_entry_id: string
          reason: string
          reversal_entry_id: string
          reversed_at?: string
          reversed_by?: string
        }
        Update: {
          id?: string
          org_id?: string
          original_entry_id?: string
          reason?: string
          reversal_entry_id?: string
          reversed_at?: string
          reversed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_reversals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_reversals_original_entry_id_fkey"
            columns: ["original_entry_id"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_reversals_reversal_entry_id_fkey"
            columns: ["reversal_entry_id"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          congregation_id: string | null
          cost_center_id: string | null
          credit: number
          debit: number
          entry_id: string
          id: string
          memo: string | null
          org_id: string
        }
        Insert: {
          account_id: string
          congregation_id?: string | null
          cost_center_id?: string | null
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          memo?: string | null
          org_id: string
        }
        Update: {
          account_id?: string
          congregation_id?: string | null
          cost_center_id?: string | null
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          memo?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accountant_crc: string | null
          accountant_name: string | null
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          cnpj: string | null
          created_at: string
          created_by: string
          document: string | null
          id: string
          legal_name: string | null
          legal_representative_name: string | null
          name: string
          type: Database["public"]["Enums"]["org_type"]
        }
        Insert: {
          accountant_crc?: string | null
          accountant_name?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string
          document?: string | null
          id?: string
          legal_name?: string | null
          legal_representative_name?: string | null
          name: string
          type?: Database["public"]["Enums"]["org_type"]
        }
        Update: {
          accountant_crc?: string | null
          accountant_name?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string
          document?: string | null
          id?: string
          legal_name?: string | null
          legal_representative_name?: string | null
          name?: string
          type?: Database["public"]["Enums"]["org_type"]
        }
        Relationships: []
      }
      physical_inventory_counts: {
        Row: {
          counted_quantity: number
          created_at: string
          expected_quantity: number
          id: string
          item_id: string
          org_id: string
          session_id: string
          variance: number
        }
        Insert: {
          counted_quantity: number
          created_at?: string
          expected_quantity?: number
          id?: string
          item_id: string
          org_id: string
          session_id: string
          variance?: number
        }
        Update: {
          counted_quantity?: number
          created_at?: string
          expected_quantity?: number
          id?: string
          item_id?: string
          org_id?: string
          session_id?: string
          variance?: number
        }
        Relationships: [
          {
            foreignKeyName: "physical_inventory_counts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_inventory_counts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_inventory_counts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "physical_inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      physical_inventory_sessions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          org_id: string
          reference_date: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id: string
          reference_date?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          reference_date?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "physical_inventory_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_member_by_email: {
        Args: {
          _email: string
          _org: string
          _role: Database["public"]["Enums"]["org_role"]
        }
        Returns: undefined
      }
      approve_annual_budget: {
        Args: { _budget_id: string; _org: string }
        Returns: undefined
      }
      approve_physical_inventory: {
        Args: { _org: string; _session_id: string }
        Returns: undefined
      }
      can_write: { Args: { _org: string }; Returns: boolean }
      close_fiscal_year: {
        Args: {
          _notes: string
          _org: string
          _profit_loss_account_id: string
          _year: number
        }
        Returns: string
      }
      create_contribution: {
        Args: {
          _amount: number
          _cash_account_id: string
          _congregation_id: string
          _contributor: string
          _date: string
          _kind: Database["public"]["Enums"]["contribution_kind"]
          _member_id: string
          _org: string
          _revenue_account_id: string
        }
        Returns: string
      }
      create_journal_entry: {
        Args: {
          _date: string
          _description: string
          _document: string
          _lines: Json
          _mode: Database["public"]["Enums"]["entry_mode"]
          _org: string
        }
        Returns: string
      }
      import_bank_statement: {
        Args: {
          _bank_account_id: string
          _closing_balance: number
          _import_source: string
          _opening_balance: number
          _org: string
          _rows: Json
          _statement_date: string
        }
        Returns: Json
      }
      inventory_balance: { Args: { _item: string }; Returns: number }
      is_member: { Args: { _org: string }; Returns: boolean }
      is_org_admin: { Args: { _org: string }; Returns: boolean }
      is_period_closed: {
        Args: { _date: string; _org: string }
        Returns: boolean
      }
      org_role_of: {
        Args: { _org: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      reconcile_bank_statement_line: {
        Args: {
          _journal_line_id: string
          _org: string
          _statement_line_id: string
        }
        Returns: undefined
      }
      record_inventory_movement: {
        Args: {
          _document: string
          _from_congregation_id: string
          _item_id: string
          _movement_date: string
          _movement_type: string
          _notes: string
          _org: string
          _quantity: number
          _responsible: string
          _to_congregation_id: string
          _unit_cost: number
        }
        Returns: string
      }
      reject_annual_budget: {
        Args: { _budget_id: string; _org: string; _reason: string }
        Returns: undefined
      }
      reverse_journal_entry: {
        Args: { _entry_id: string; _org: string; _reason: string }
        Returns: string
      }
      submit_physical_inventory: {
        Args: { _org: string; _session_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "ativo" | "passivo" | "patrimonio" | "receita" | "despesa"
      contribution_kind: "dizimo" | "oferta" | "missoes" | "outro"
      entry_mode: "dobrada" | "simples"
      org_role: "admin" | "contador" | "leitor"
      org_type: "empresa" | "igreja"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: ["ativo", "passivo", "patrimonio", "receita", "despesa"],
      contribution_kind: ["dizimo", "oferta", "missoes", "outro"],
      entry_mode: ["dobrada", "simples"],
      org_role: ["admin", "contador", "leitor"],
      org_type: ["empresa", "igreja"],
    },
  },
} as const
