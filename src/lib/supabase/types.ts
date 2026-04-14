export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      candidates: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          job_opening_id: string | null
          job_opening_title: string | null
          current_status: string | null
          candidate_stage: string | null
          global_status: string | null
          owner: string | null
          source: string | null
          nationality: string | null
          native_language: string | null
          english_level: string | null
          german_level: string | null
          work_permit: string | null
          created_time: string | null
          modified_time: string | null
          last_activity_time: string | null
          days_in_process: number | null
          days_since_activity: number | null
          sla_status: string | null
          last_synced_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          job_opening_id?: string | null
          job_opening_title?: string | null
          current_status?: string | null
          candidate_stage?: string | null
          global_status?: string | null
          owner?: string | null
          source?: string | null
          nationality?: string | null
          native_language?: string | null
          english_level?: string | null
          german_level?: string | null
          work_permit?: string | null
          created_time?: string | null
          modified_time?: string | null
          last_activity_time?: string | null
          days_in_process?: number | null
          days_since_activity?: number | null
          sla_status?: string | null
          last_synced_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          job_opening_id?: string | null
          job_opening_title?: string | null
          current_status?: string | null
          candidate_stage?: string | null
          global_status?: string | null
          owner?: string | null
          source?: string | null
          nationality?: string | null
          native_language?: string | null
          english_level?: string | null
          german_level?: string | null
          work_permit?: string | null
          created_time?: string | null
          modified_time?: string | null
          last_activity_time?: string | null
          days_in_process?: number | null
          days_since_activity?: number | null
          sla_status?: string | null
          last_synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'candidates_job_opening_id_fkey'
            columns: ['job_opening_id']
            isOneToOne: false
            referencedRelation: 'job_openings'
            referencedColumns: ['id']
          },
        ]
      }
      job_openings: {
        Row: {
          id: string
          title: string
          status: string | null
          date_opened: string | null
          client_name: string | null
          owner: string | null
          total_candidates: number | null
          hired_count: number | null
          is_active: boolean | null
          is_visible: boolean | null
          last_synced_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          title: string
          status?: string | null
          date_opened?: string | null
          client_name?: string | null
          owner?: string | null
          total_candidates?: number | null
          hired_count?: number | null
          is_active?: boolean | null
          is_visible?: boolean | null
          last_synced_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          status?: string | null
          date_opened?: string | null
          client_name?: string | null
          owner?: string | null
          total_candidates?: number | null
          hired_count?: number | null
          is_active?: boolean | null
          is_visible?: boolean | null
          last_synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stage_history: {
        Row: {
          id: number
          candidate_id: string | null
          job_opening_id: string | null
          from_status: string | null
          to_status: string | null
          changed_at: string | null
          days_in_stage: number | null
          changed_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          candidate_id?: string | null
          job_opening_id?: string | null
          from_status?: string | null
          to_status?: string | null
          changed_at?: string | null
          days_in_stage?: number | null
          changed_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: number
          candidate_id?: string | null
          job_opening_id?: string | null
          from_status?: string | null
          to_status?: string | null
          changed_at?: string | null
          days_in_stage?: number | null
          changed_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'stage_history_candidate_id_fkey'
            columns: ['candidate_id']
            isOneToOne: false
            referencedRelation: 'candidates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stage_history_job_opening_id_fkey'
            columns: ['job_opening_id']
            isOneToOne: false
            referencedRelation: 'job_openings'
            referencedColumns: ['id']
          },
        ]
      }
      sla_alerts: {
        Row: {
          id: number
          candidate_id: string | null
          candidate_name: string | null
          job_opening_id: string | null
          job_opening_title: string | null
          current_status: string | null
          days_stuck: number | null
          alert_level: string | null
          owner: string | null
          notified_at: string | null
          resolved_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          candidate_id?: string | null
          candidate_name?: string | null
          job_opening_id?: string | null
          job_opening_title?: string | null
          current_status?: string | null
          days_stuck?: number | null
          alert_level?: string | null
          owner?: string | null
          notified_at?: string | null
          resolved_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          candidate_id?: string | null
          candidate_name?: string | null
          job_opening_id?: string | null
          job_opening_title?: string | null
          current_status?: string | null
          days_stuck?: number | null
          alert_level?: string | null
          owner?: string | null
          notified_at?: string | null
          resolved_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sla_alerts_candidate_id_fkey'
            columns: ['candidate_id']
            isOneToOne: false
            referencedRelation: 'candidates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sla_alerts_job_opening_id_fkey'
            columns: ['job_opening_id']
            isOneToOne: false
            referencedRelation: 'job_openings'
            referencedColumns: ['id']
          },
        ]
      }
      daily_snapshot: {
        Row: {
          id: number
          snapshot_date: string
          job_opening_id: string | null
          job_opening_title: string | null
          status: string | null
          count: number | null
        }
        Insert: {
          id?: number
          snapshot_date: string
          job_opening_id?: string | null
          job_opening_title?: string | null
          status?: string | null
          count?: number | null
        }
        Update: {
          id?: number
          snapshot_date?: string
          job_opening_id?: string | null
          job_opening_title?: string | null
          status?: string | null
          count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'daily_snapshot_job_opening_id_fkey'
            columns: ['job_opening_id']
            isOneToOne: false
            referencedRelation: 'job_openings'
            referencedColumns: ['id']
          },
        ]
      }
      dashboard_config: {
        Row: {
          id: number
          config_key: string
          config_value: Json | null
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          config_key: string
          config_value?: Json | null
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          config_key?: string
          config_value?: Json | null
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          id: string
          user_key: string
          preference_type: string
          value: Json
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_key?: string
          preference_type: string
          value?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_key?: string
          preference_type?: string
          value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          id: number
          sync_type: string | null
          started_at: string | null
          finished_at: string | null
          records_processed: number | null
          api_calls_used: number | null
          status: string | null
          error_message: string | null
        }
        Insert: {
          id?: number
          sync_type?: string | null
          started_at?: string | null
          finished_at?: string | null
          records_processed?: number | null
          api_calls_used?: number | null
          status?: string | null
          error_message?: string | null
        }
        Update: {
          id?: number
          sync_type?: string | null
          started_at?: string | null
          finished_at?: string | null
          records_processed?: number | null
          api_calls_used?: number | null
          status?: string | null
          error_message?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          id: string
          event_id: string
          event_type: string
          signing_request_id: string | null
          payload: Json
          processed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          event_type: string
          signing_request_id?: string | null
          payload: Json
          processed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          event_type?: string
          signing_request_id?: string | null
          payload?: Json
          processed_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenient type aliases
export type Candidate = Database['public']['Tables']['candidates']['Row']
export type CandidateInsert = Database['public']['Tables']['candidates']['Insert']
export type CandidateUpdate = Database['public']['Tables']['candidates']['Update']

export type JobOpening = Database['public']['Tables']['job_openings']['Row']
export type JobOpeningInsert = Database['public']['Tables']['job_openings']['Insert']
export type JobOpeningUpdate = Database['public']['Tables']['job_openings']['Update']

export type StageHistory = Database['public']['Tables']['stage_history']['Row']
export type StageHistoryInsert = Database['public']['Tables']['stage_history']['Insert']
export type StageHistoryUpdate = Database['public']['Tables']['stage_history']['Update']

export type SlaAlert = Database['public']['Tables']['sla_alerts']['Row']
export type SlaAlertInsert = Database['public']['Tables']['sla_alerts']['Insert']
export type SlaAlertUpdate = Database['public']['Tables']['sla_alerts']['Update']

export type DailySnapshot = Database['public']['Tables']['daily_snapshot']['Row']
export type DailySnapshotInsert = Database['public']['Tables']['daily_snapshot']['Insert']
export type DailySnapshotUpdate = Database['public']['Tables']['daily_snapshot']['Update']

export type DashboardConfig = Database['public']['Tables']['dashboard_config']['Row']
export type DashboardConfigInsert = Database['public']['Tables']['dashboard_config']['Insert']
export type DashboardConfigUpdate = Database['public']['Tables']['dashboard_config']['Update']

export type SyncLog = Database['public']['Tables']['sync_log']['Row']
export type SyncLogInsert = Database['public']['Tables']['sync_log']['Insert']
export type SyncLogUpdate = Database['public']['Tables']['sync_log']['Update']

export type WebhookEvent = Database['public']['Tables']['webhook_events']['Row']
export type WebhookEventInsert = Database['public']['Tables']['webhook_events']['Insert']
export type WebhookEventUpdate = Database['public']['Tables']['webhook_events']['Update']

export type UserPreference = Database['public']['Tables']['user_preferences']['Row']
export type UserPreferenceInsert = Database['public']['Tables']['user_preferences']['Insert']
export type UserPreferenceUpdate = Database['public']['Tables']['user_preferences']['Update']
