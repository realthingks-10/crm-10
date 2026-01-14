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
      account_activities: {
        Row: {
          account_id: string
          activity_date: string
          activity_type: string
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          outcome: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          account_id: string
          activity_date?: string
          activity_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          outcome?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          activity_date?: string
          activity_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          outcome?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_owner: string | null
          company_name: string
          company_type: string | null
          contact_count: number | null
          country: string | null
          created_at: string | null
          created_by: string | null
          deal_count: number | null
          email: string | null
          id: string
          industry: string | null
          last_activity_date: string | null
          last_contacted_at: string | null
          modified_by: string | null
          notes: string | null
          phone: string | null
          region: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          account_owner?: string | null
          company_name: string
          company_type?: string | null
          contact_count?: number | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_count?: number | null
          email?: string | null
          id?: string
          industry?: string | null
          last_activity_date?: string | null
          last_contacted_at?: string | null
          modified_by?: string | null
          notes?: string | null
          phone?: string | null
          region?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          account_owner?: string | null
          company_name?: string
          company_type?: string | null
          contact_count?: number | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_count?: number | null
          email?: string | null
          id?: string
          industry?: string | null
          last_activity_date?: string | null
          last_contacted_at?: string | null
          modified_by?: string | null
          notes?: string | null
          phone?: string | null
          region?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string | null
          dismissed_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          announcement_id?: string | null
          dismissed_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string | null
          dismissed_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          message: string
          priority: string | null
          starts_at: string | null
          target_roles: string[] | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          priority?: string | null
          starts_at?: string | null
          target_roles?: string[] | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          priority?: string | null
          starts_at?: string | null
          target_roles?: string[] | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      approval_actions: {
        Row: {
          acted_at: string | null
          action: string
          approver_id: string
          comments: string | null
          id: string
          request_id: string | null
          step_number: number
        }
        Insert: {
          acted_at?: string | null
          action: string
          approver_id: string
          comments?: string | null
          id?: string
          request_id?: string | null
          step_number: number
        }
        Update: {
          acted_at?: string | null
          action?: string
          approver_id?: string
          comments?: string | null
          id?: string
          request_id?: string | null
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          entity_id: string
          entity_type: string
          id: string
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string | null
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          entity_id: string
          entity_type: string
          id?: string
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          entity_id?: string
          entity_type?: string
          id?: string
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          approval_steps: Json
          created_at: string | null
          created_by: string | null
          entity_type: string
          id: string
          is_enabled: boolean | null
          name: string
          trigger_conditions: Json | null
          updated_at: string | null
        }
        Insert: {
          approval_steps: Json
          created_at?: string | null
          created_by?: string | null
          entity_type: string
          id?: string
          is_enabled?: boolean | null
          name: string
          trigger_conditions?: Json | null
          updated_at?: string | null
        }
        Update: {
          approval_steps?: Json
          created_at?: string | null
          created_by?: string | null
          entity_type?: string
          id?: string
          is_enabled?: boolean | null
          name?: string
          trigger_conditions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      backup_schedules: {
        Row: {
          created_at: string | null
          created_by: string | null
          day_of_week: number | null
          frequency: string
          id: string
          is_enabled: boolean | null
          last_run_at: string | null
          next_run_at: string | null
          retention_days: number | null
          time_of_day: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          day_of_week?: number | null
          frequency?: string
          id?: string
          is_enabled?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          retention_days?: number | null
          time_of_day?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          day_of_week?: number | null
          frequency?: string
          id?: string
          is_enabled?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          retention_days?: number | null
          time_of_day?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      backups: {
        Row: {
          backup_type: string
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string
          id: string
          manifest: Json | null
          records_count: number | null
          size_bytes: number | null
          status: string
          tables_count: number | null
        }
        Insert: {
          backup_type?: string
          created_at?: string
          created_by?: string | null
          file_name: string
          file_path: string
          id?: string
          manifest?: Json | null
          records_count?: number | null
          size_bytes?: number | null
          status?: string
          tables_count?: number | null
        }
        Update: {
          backup_type?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string
          id?: string
          manifest?: Json | null
          records_count?: number | null
          size_bytes?: number | null
          status?: string
          tables_count?: number | null
        }
        Relationships: []
      }
      branding_settings: {
        Row: {
          accent_color: string | null
          app_name: string | null
          created_at: string | null
          custom_css: string | null
          favicon_url: string | null
          font_family: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          app_name?: string | null
          created_at?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          app_name?: string | null
          created_at?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_activities: {
        Row: {
          activity_date: string
          activity_type: string
          contact_id: string
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          outcome: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          activity_date?: string
          activity_type: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          outcome?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          activity_date?: string
          activity_type?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          outcome?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string | null
          communication_preferences: Json | null
          company_name: string | null
          contact_name: string
          contact_owner: string | null
          contact_source: string | null
          created_by: string | null
          created_time: string | null
          description: string | null
          email: string | null
          email_clicks: number | null
          email_opens: number | null
          engagement_score: number | null
          id: string
          industry: string | null
          last_contacted_at: string | null
          linkedin: string | null
          modified_by: string | null
          modified_time: string | null
          phone_no: string | null
          position: string | null
          region: string | null
          score: number | null
          segment: string | null
          tags: string[] | null
          website: string | null
        }
        Insert: {
          account_id?: string | null
          communication_preferences?: Json | null
          company_name?: string | null
          contact_name: string
          contact_owner?: string | null
          contact_source?: string | null
          created_by?: string | null
          created_time?: string | null
          description?: string | null
          email?: string | null
          email_clicks?: number | null
          email_opens?: number | null
          engagement_score?: number | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          linkedin?: string | null
          modified_by?: string | null
          modified_time?: string | null
          phone_no?: string | null
          position?: string | null
          region?: string | null
          score?: number | null
          segment?: string | null
          tags?: string[] | null
          website?: string | null
        }
        Update: {
          account_id?: string | null
          communication_preferences?: Json | null
          company_name?: string | null
          contact_name?: string
          contact_owner?: string | null
          contact_source?: string | null
          created_by?: string | null
          created_time?: string | null
          description?: string | null
          email?: string | null
          email_clicks?: number | null
          email_opens?: number | null
          engagement_score?: number | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          linkedin?: string | null
          modified_by?: string | null
          modified_time?: string | null
          phone_no?: string | null
          position?: string | null
          region?: string | null
          score?: number | null
          segment?: string | null
          tags?: string[] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_custom_fields: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number | null
          entity_type: string
          field_label: string
          field_name: string
          field_options: Json | null
          field_type: string
          id: string
          is_required: boolean | null
          is_visible: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          entity_type: string
          field_label: string
          field_name: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_required?: boolean | null
          is_visible?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          entity_type?: string
          field_label?: string
          field_name?: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_required?: boolean | null
          is_visible?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_preferences: {
        Row: {
          card_order: Json | null
          created_at: string | null
          dashboard_view: string | null
          id: string
          layout_view: string | null
          updated_at: string | null
          user_id: string
          visible_widgets: Json | null
          widget_layouts: Json | null
        }
        Insert: {
          card_order?: Json | null
          created_at?: string | null
          dashboard_view?: string | null
          id?: string
          layout_view?: string | null
          updated_at?: string | null
          user_id: string
          visible_widgets?: Json | null
          widget_layouts?: Json | null
        }
        Update: {
          card_order?: Json | null
          created_at?: string | null
          dashboard_view?: string | null
          id?: string
          layout_view?: string | null
          updated_at?: string | null
          user_id?: string
          visible_widgets?: Json | null
          widget_layouts?: Json | null
        }
        Relationships: []
      }
      deal_action_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          due_date: string | null
          id: string
          next_action: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          due_date?: string | null
          id?: string
          next_action: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          due_date?: string | null
          id?: string
          next_action?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_action_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          from_stage: string | null
          id: string
          notes: string | null
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          from_stage?: string | null
          id?: string
          notes?: string | null
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          from_stage?: string | null
          id?: string
          notes?: string | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          account_id: string | null
          action_items: string | null
          budget: string | null
          business_value: string | null
          closing: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          currency_type: string | null
          current_status: string | null
          customer_challenges: string | null
          customer_name: string | null
          customer_need: string | null
          deal_name: string
          decision_maker_level: string | null
          drop_reason: string | null
          end_date: string | null
          expected_closing_date: string | null
          handoff_status: string | null
          id: string
          implementation_start_date: string | null
          internal_comment: string | null
          is_recurring: string | null
          lead_name: string | null
          lead_owner: string | null
          lost_reason: string | null
          modified_at: string | null
          modified_by: string | null
          need_improvement: string | null
          priority: number | null
          probability: number | null
          project_duration: number | null
          project_name: string | null
          proposal_due_date: string | null
          quarterly_revenue_q1: number | null
          quarterly_revenue_q2: number | null
          quarterly_revenue_q3: number | null
          quarterly_revenue_q4: number | null
          region: string | null
          relationship_strength: string | null
          rfq_received_date: string | null
          rfq_status: string | null
          signed_contract_date: string | null
          stage: string
          start_date: string | null
          total_contract_value: number | null
          total_revenue: number | null
          won_reason: string | null
        }
        Insert: {
          account_id?: string | null
          action_items?: string | null
          budget?: string | null
          business_value?: string | null
          closing?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_type?: string | null
          current_status?: string | null
          customer_challenges?: string | null
          customer_name?: string | null
          customer_need?: string | null
          deal_name: string
          decision_maker_level?: string | null
          drop_reason?: string | null
          end_date?: string | null
          expected_closing_date?: string | null
          handoff_status?: string | null
          id?: string
          implementation_start_date?: string | null
          internal_comment?: string | null
          is_recurring?: string | null
          lead_name?: string | null
          lead_owner?: string | null
          lost_reason?: string | null
          modified_at?: string | null
          modified_by?: string | null
          need_improvement?: string | null
          priority?: number | null
          probability?: number | null
          project_duration?: number | null
          project_name?: string | null
          proposal_due_date?: string | null
          quarterly_revenue_q1?: number | null
          quarterly_revenue_q2?: number | null
          quarterly_revenue_q3?: number | null
          quarterly_revenue_q4?: number | null
          region?: string | null
          relationship_strength?: string | null
          rfq_received_date?: string | null
          rfq_status?: string | null
          signed_contract_date?: string | null
          stage?: string
          start_date?: string | null
          total_contract_value?: number | null
          total_revenue?: number | null
          won_reason?: string | null
        }
        Update: {
          account_id?: string | null
          action_items?: string | null
          budget?: string | null
          business_value?: string | null
          closing?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_type?: string | null
          current_status?: string | null
          customer_challenges?: string | null
          customer_name?: string | null
          customer_need?: string | null
          deal_name?: string
          decision_maker_level?: string | null
          drop_reason?: string | null
          end_date?: string | null
          expected_closing_date?: string | null
          handoff_status?: string | null
          id?: string
          implementation_start_date?: string | null
          internal_comment?: string | null
          is_recurring?: string | null
          lead_name?: string | null
          lead_owner?: string | null
          lost_reason?: string | null
          modified_at?: string | null
          modified_by?: string | null
          need_improvement?: string | null
          priority?: number | null
          probability?: number | null
          project_duration?: number | null
          project_name?: string | null
          proposal_due_date?: string | null
          quarterly_revenue_q1?: number | null
          quarterly_revenue_q2?: number | null
          quarterly_revenue_q3?: number | null
          quarterly_revenue_q4?: number | null
          region?: string | null
          relationship_strength?: string | null
          rfq_received_date?: string | null
          rfq_status?: string | null
          signed_contract_date?: string | null
          stage?: string
          start_date?: string | null
          total_contract_value?: number | null
          total_revenue?: number | null
          won_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_history: {
        Row: {
          account_id: string | null
          body: string | null
          bounce_reason: string | null
          bounce_type: string | null
          bounced_at: string | null
          click_count: number | null
          clicked_at: string | null
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          first_open_ip: string | null
          id: string
          is_reply: boolean | null
          is_valid_open: boolean | null
          last_reply_at: string | null
          lead_id: string | null
          message_id: string | null
          open_count: number | null
          opened_at: string | null
          parent_email_id: string | null
          recipient_email: string
          recipient_name: string | null
          replied_at: string | null
          reply_count: number | null
          sender_email: string
          sent_at: string
          sent_by: string | null
          status: string
          subject: string
          thread_id: string | null
          unique_opens: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          body?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          click_count?: number | null
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          first_open_ip?: string | null
          id?: string
          is_reply?: boolean | null
          is_valid_open?: boolean | null
          last_reply_at?: string | null
          lead_id?: string | null
          message_id?: string | null
          open_count?: number | null
          opened_at?: string | null
          parent_email_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          replied_at?: string | null
          reply_count?: number | null
          sender_email: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject: string
          thread_id?: string | null
          unique_opens?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          body?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          click_count?: number | null
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          first_open_ip?: string | null
          id?: string
          is_reply?: boolean | null
          is_valid_open?: boolean | null
          last_reply_at?: string | null
          lead_id?: string | null
          message_id?: string | null
          open_count?: number | null
          opened_at?: string | null
          parent_email_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          replied_at?: string | null
          reply_count?: number | null
          sender_email?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string
          thread_id?: string | null
          unique_opens?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_history_parent_email_id_fkey"
            columns: ["parent_email_id"]
            isOneToOne: false
            referencedRelation: "email_history"
            referencedColumns: ["id"]
          },
        ]
      }
      email_replies: {
        Row: {
          body_preview: string | null
          created_at: string | null
          email_history_id: string
          from_email: string
          from_name: string | null
          graph_message_id: string | null
          id: string
          received_at: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          body_preview?: string | null
          created_at?: string | null
          email_history_id: string
          from_email: string
          from_name?: string | null
          graph_message_id?: string | null
          id?: string
          received_at: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          body_preview?: string | null
          created_at?: string | null
          email_history_id?: string
          from_email?: string
          from_name?: string | null
          graph_message_id?: string | null
          id?: string
          received_at?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_replies_email_history_id_fkey"
            columns: ["email_history_id"]
            isOneToOne: false
            referencedRelation: "email_history"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_export_settings: {
        Row: {
          created_at: string
          default_values: Json | null
          entity_type: string
          field_mappings: Json | null
          id: string
          skip_duplicates: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_values?: Json | null
          entity_type: string
          field_mappings?: Json | null
          id?: string
          skip_duplicates?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_values?: Json | null
          entity_type?: string
          field_mappings?: Json | null
          id?: string
          skip_duplicates?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          integration_name: string
          is_enabled: boolean | null
          last_sync_at: string | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          integration_name: string
          is_enabled?: boolean | null
          last_sync_at?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          integration_name?: string
          is_enabled?: boolean | null
          last_sync_at?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      keep_alive: {
        Row: {
          "Able to read DB": string | null
          created_at: string
          id: number
        }
        Insert: {
          "Able to read DB"?: string | null
          created_at?: string
          id?: number
        }
        Update: {
          "Able to read DB"?: string | null
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      lead_action_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          lead_id: string
          next_action: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          lead_id: string
          next_action: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string
          next_action?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_statuses: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          is_converted_status: boolean | null
          status_color: string | null
          status_name: string
          status_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_converted_status?: boolean | null
          status_color?: string | null
          status_name: string
          status_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_converted_status?: boolean | null
          status_color?: string | null
          status_name?: string
          status_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          account_id: string | null
          company_name: string | null
          contact_owner: string | null
          contact_source: string | null
          converted_from_contact_id: string | null
          country: string | null
          created_by: string | null
          created_time: string | null
          description: string | null
          email: string | null
          id: string
          industry: string | null
          last_contacted_at: string | null
          lead_name: string
          lead_status: string | null
          linkedin: string | null
          modified_by: string | null
          modified_time: string | null
          phone_no: string | null
          position: string | null
          website: string | null
        }
        Insert: {
          account_id?: string | null
          company_name?: string | null
          contact_owner?: string | null
          contact_source?: string | null
          converted_from_contact_id?: string | null
          country?: string | null
          created_by?: string | null
          created_time?: string | null
          description?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          lead_name: string
          lead_status?: string | null
          linkedin?: string | null
          modified_by?: string | null
          modified_time?: string | null
          phone_no?: string | null
          position?: string | null
          website?: string | null
        }
        Update: {
          account_id?: string | null
          company_name?: string | null
          contact_owner?: string | null
          contact_source?: string | null
          converted_from_contact_id?: string | null
          country?: string | null
          created_by?: string | null
          created_time?: string | null
          description?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          lead_name?: string
          lead_status?: string | null
          linkedin?: string | null
          modified_by?: string | null
          modified_time?: string | null
          phone_no?: string | null
          position?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_from_contact_id_fkey"
            columns: ["converted_from_contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance: {
        Row: {
          asset_name: string
          created_at: string
          id: string
          maintenance_type: string | null
          notes: string | null
          performed_by: string | null
          scheduled_date: string
          status: string | null
          updated_at: string
        }
        Insert: {
          asset_name: string
          created_at?: string
          id?: string
          maintenance_type?: string | null
          notes?: string | null
          performed_by?: string | null
          scheduled_date: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          asset_name?: string
          created_at?: string
          id?: string
          maintenance_type?: string | null
          notes?: string | null
          performed_by?: string | null
          scheduled_date?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meeting_follow_ups: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_follow_ups_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_reminders: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          remind_15min: boolean
          remind_1day: boolean
          remind_1hr: boolean
          sent_15min: boolean
          sent_1day: boolean
          sent_1hr: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          remind_15min?: boolean
          remind_1day?: boolean
          remind_1hr?: boolean
          sent_15min?: boolean
          sent_1day?: boolean
          sent_1hr?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          remind_15min?: boolean
          remind_1day?: boolean
          remind_1hr?: boolean
          sent_15min?: boolean
          sent_1day?: boolean
          sent_1hr?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_reminders_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          account_id: string | null
          attendees: Json | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          end_time: string
          id: string
          join_url: string | null
          lead_id: string | null
          notes: string | null
          outcome: string | null
          start_time: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          attendees?: Json | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          end_time: string
          id?: string
          join_url?: string | null
          lead_id?: string | null
          notes?: string | null
          outcome?: string | null
          start_time: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          attendees?: Json | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          end_time?: string
          id?: string
          join_url?: string | null
          lead_id?: string | null
          notes?: string | null
          outcome?: string | null
          start_time?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          accounts_notifications: boolean | null
          contacts_notifications: boolean | null
          created_at: string
          deal_updates: boolean | null
          email_notifications: boolean | null
          id: string
          in_app_notifications: boolean | null
          lead_assigned: boolean | null
          leads_notifications: boolean | null
          meeting_reminders: boolean | null
          notification_frequency: string | null
          push_notifications: boolean | null
          task_reminders: boolean | null
          updated_at: string
          user_id: string
          weekly_digest: boolean | null
        }
        Insert: {
          accounts_notifications?: boolean | null
          contacts_notifications?: boolean | null
          created_at?: string
          deal_updates?: boolean | null
          email_notifications?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          lead_assigned?: boolean | null
          leads_notifications?: boolean | null
          meeting_reminders?: boolean | null
          notification_frequency?: string | null
          push_notifications?: boolean | null
          task_reminders?: boolean | null
          updated_at?: string
          user_id: string
          weekly_digest?: boolean | null
        }
        Update: {
          accounts_notifications?: boolean | null
          contacts_notifications?: boolean | null
          created_at?: string
          deal_updates?: boolean | null
          email_notifications?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          lead_assigned?: boolean | null
          leads_notifications?: boolean | null
          meeting_reminders?: boolean | null
          notification_frequency?: string | null
          push_notifications?: boolean | null
          task_reminders?: boolean | null
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_item_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          message: string
          notification_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_item_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          message: string
          notification_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_item_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string
          notification_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_permissions: {
        Row: {
          admin_access: boolean
          created_at: string
          description: string | null
          id: string
          manager_access: boolean
          page_name: string
          route: string
          updated_at: string
          user_access: boolean
        }
        Insert: {
          admin_access?: boolean
          created_at?: string
          description?: string | null
          id?: string
          manager_access?: boolean
          page_name: string
          route: string
          updated_at?: string
          user_access?: boolean
        }
        Update: {
          admin_access?: boolean
          created_at?: string
          description?: string | null
          id?: string
          manager_access?: boolean
          page_name?: string
          route?: string
          updated_at?: string
          user_access?: boolean
        }
        Relationships: []
      }
      pending_bounce_checks: {
        Row: {
          check_after: string
          check_result: string | null
          checked: boolean | null
          created_at: string | null
          email_history_id: string | null
          id: string
          recipient_email: string
          sender_email: string
        }
        Insert: {
          check_after: string
          check_result?: string | null
          checked?: boolean | null
          created_at?: string | null
          email_history_id?: string | null
          id?: string
          recipient_email: string
          sender_email: string
        }
        Update: {
          check_after?: string
          check_result?: string | null
          checked?: boolean | null
          created_at?: string | null
          email_history_id?: string | null
          id?: string
          recipient_email?: string
          sender_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_bounce_checks_email_history_id_fkey"
            columns: ["email_history_id"]
            isOneToOne: false
            referencedRelation: "email_history"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          is_lost_stage: boolean | null
          is_won_stage: boolean | null
          stage_color: string | null
          stage_name: string
          stage_order: number
          stage_probability: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_lost_stage?: boolean | null
          is_won_stage?: boolean | null
          stage_color?: string | null
          stage_name: string
          stage_order?: number
          stage_probability?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_lost_stage?: boolean | null
          is_won_stage?: boolean | null
          stage_color?: string | null
          stage_name?: string
          stage_order?: number
          stage_probability?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          "Email ID": string | null
          full_name: string | null
          id: string
          phone: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          "Email ID"?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          "Email ID"?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      report_schedules: {
        Row: {
          created_at: string | null
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          filters: Json | null
          frequency: string
          id: string
          is_enabled: boolean | null
          last_sent_at: string | null
          name: string
          recipients: Json | null
          report_type: string
          time_of_day: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          filters?: Json | null
          frequency?: string
          id?: string
          is_enabled?: boolean | null
          last_sent_at?: string | null
          name: string
          recipients?: Json | null
          report_type: string
          time_of_day?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          filters?: Json | null
          frequency?: string
          id?: string
          is_enabled?: boolean | null
          last_sent_at?: string | null
          name?: string
          recipients?: Json | null
          report_type?: string
          time_of_day?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          filter_type: string
          filters: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_type?: string
          filters: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_type?: string
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_updates: {
        Row: {
          created_at: string
          device_name: string
          id: string
          installed_on: string | null
          last_checked: string | null
          os_version: string | null
          patch_id: string | null
          remarks: string | null
          status: string | null
          update_type: string | null
          update_version: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_name: string
          id?: string
          installed_on?: string | null
          last_checked?: string | null
          os_version?: string | null
          patch_id?: string | null
          remarks?: string | null
          status?: string | null
          update_type?: string | null
          update_version?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_name?: string
          id?: string
          installed_on?: string | null
          last_checked?: string | null
          os_version?: string | null
          patch_id?: string | null
          remarks?: string | null
          status?: string | null
          update_type?: string | null
          update_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      table_column_preferences: {
        Row: {
          column_config: Json
          created_at: string | null
          id: string
          module_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          column_config: Json
          created_at?: string | null
          id?: string
          module_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          column_config?: Json
          created_at?: string | null
          id?: string
          module_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_reminder_logs: {
        Row: {
          created_at: string | null
          email_sent_to: string | null
          id: string
          overdue_count: number | null
          sent_at: string | null
          sent_date: string
          tasks_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_sent_to?: string | null
          id?: string
          overdue_count?: number | null
          sent_at?: string | null
          sent_date: string
          tasks_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_sent_to?: string | null
          id?: string
          overdue_count?: number | null
          sent_at?: string | null
          sent_date?: string
          tasks_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      task_subtasks: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          order_index: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          order_index?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          order_index?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          account_id: string | null
          assigned_to: string | null
          category: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          lead_id: string | null
          meeting_id: string | null
          module_type: string | null
          parent_task_id: string | null
          priority: string
          recurrence: string | null
          recurrence_end_date: string | null
          reminder_date: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          lead_id?: string | null
          meeting_id?: string | null
          module_type?: string | null
          parent_task_id?: string | null
          priority?: string
          recurrence?: string | null
          recurrence_end_date?: string | null
          reminder_date?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          lead_id?: string | null
          meeting_id?: string | null
          module_type?: string | null
          parent_task_id?: string | null
          priority?: string
          recurrence?: string | null
          recurrence_end_date?: string | null
          reminder_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access_cache: {
        Row: {
          cache_date: string
          computed_at: string
          id: string
          permissions: Json
          permissions_updated_at: string | null
          profile: Json | null
          role: string
          role_assigned_at: string | null
          user_id: string
        }
        Insert: {
          cache_date?: string
          computed_at?: string
          id?: string
          permissions?: Json
          permissions_updated_at?: string | null
          profile?: Json | null
          role?: string
          role_assigned_at?: string | null
          user_id: string
        }
        Update: {
          cache_date?: string
          computed_at?: string
          id?: string
          permissions?: Json
          permissions_updated_at?: string | null
          profile?: Json | null
          role?: string
          role_assigned_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          currency: string | null
          date_format: string | null
          default_module: string | null
          email_signature: string | null
          id: string
          language: string | null
          theme: string | null
          time_format: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          date_format?: string | null
          default_module?: string | null
          email_signature?: string | null
          id?: string
          language?: string | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          date_format?: string | null
          default_module?: string | null
          email_signature?: string | null
          id?: string
          language?: string | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_info: Json | null
          expires_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          last_active_at: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_active_at?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_active_at?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      yearly_revenue_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          total_target: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          total_target?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          total_target?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_account_score: {
        Args: { p_account_id: string }
        Returns: number
      }
      calculate_contact_score: {
        Args: { p_contact_id: string }
        Returns: number
      }
      get_my_access_snapshot: {
        Args: never
        Returns: {
          computed_at: string
          permissions: Json
          profile: Json
          role: string
        }[]
      }
      get_user_role: { Args: { p_user_id: string }; Returns: string }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_current_user_admin_by_metadata: { Args: never; Returns: boolean }
      is_user_admin: { Args: { user_id?: string }; Returns: boolean }
      is_user_manager: { Args: { user_id?: string }; Returns: boolean }
      log_data_access: {
        Args: {
          p_operation: string
          p_record_id?: string
          p_table_name: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: undefined
      }
      update_account_stats: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      update_contact_stats: {
        Args: { p_contact_id: string }
        Returns: undefined
      }
      update_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      task_priority: "high" | "medium" | "low"
      task_recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly"
      task_status: "open" | "in_progress" | "completed" | "deferred"
      user_role: "admin" | "manager" | "user"
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
      task_priority: ["high", "medium", "low"],
      task_recurrence: ["none", "daily", "weekly", "monthly", "yearly"],
      task_status: ["open", "in_progress", "completed", "deferred"],
      user_role: ["admin", "manager", "user"],
    },
  },
} as const
