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
      ai_alert_events_kpi: {
        Row: {
          alert_id: string
          condition_snapshot: Json | null
          email_error: string | null
          email_sent: boolean | null
          id: string
          triggered_at: string
        }
        Insert: {
          alert_id: string
          condition_snapshot?: Json | null
          email_error?: string | null
          email_sent?: boolean | null
          id?: string
          triggered_at?: string
        }
        Update: {
          alert_id?: string
          condition_snapshot?: Json | null
          email_error?: string | null
          email_sent?: boolean | null
          id?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_alert_events_kpi_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "ai_alerts_kpi"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_alerts_kpi: {
        Row: {
          condition_config: Json
          condition_type: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          last_evaluated_at: string | null
          last_triggered_at: string | null
          name: string
          notification_email: string
          updated_at: string | null
          user_email: string
        }
        Insert: {
          condition_config?: Json
          condition_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_evaluated_at?: string | null
          last_triggered_at?: string | null
          name: string
          notification_email: string
          updated_at?: string | null
          user_email: string
        }
        Update: {
          condition_config?: Json
          condition_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_evaluated_at?: string | null
          last_triggered_at?: string | null
          name?: string
          notification_email?: string
          updated_at?: string | null
          user_email?: string
        }
        Relationships: []
      }
      candidate_job_history_kpi: {
        Row: {
          association_type: string | null
          candidate_id: string
          candidate_name: string | null
          candidate_status_in_jo: string | null
          fetched_at: string | null
          id: string
          job_opening_id: string | null
          job_opening_title: string | null
          zoho_record_id: string | null
        }
        Insert: {
          association_type?: string | null
          candidate_id: string
          candidate_name?: string | null
          candidate_status_in_jo?: string | null
          fetched_at?: string | null
          id?: string
          job_opening_id?: string | null
          job_opening_title?: string | null
          zoho_record_id?: string | null
        }
        Update: {
          association_type?: string | null
          candidate_id?: string
          candidate_name?: string | null
          candidate_status_in_jo?: string | null
          fetched_at?: string | null
          id?: string
          job_opening_id?: string | null
          job_opening_title?: string | null
          zoho_record_id?: string | null
        }
        Relationships: []
      }
      candidates_kpi: {
        Row: {
          assigned_agency: string | null
          candidate_stage: string | null
          cliente: string | null
          coordinador: string | null
          created_at: string | null
          created_time: string | null
          current_status: string | null
          days_in_process: number | null
          days_since_activity: number | null
          dropout_attendance_pct: number | null
          dropout_date: string | null
          dropout_days_of_training: number | null
          dropout_language_level: string | null
          dropout_modality: string | null
          dropout_notes: string | null
          dropout_reason: string | null
          dropout_start_date: string | null
          email: string | null
          english_level: string | null
          fecha_fin_formacion: string | null
          fecha_inicio_trabajo: string | null
          full_name: string | null
          german_level: string | null
          global_status: string | null
          gp_assignment: string | null
          gp_availability: string | null
          gp_has_profile: boolean | null
          gp_kontaktperson: string | null
          gp_open_to: string | null
          gp_priority: string | null
          gp_shots: string | null
          gp_training_status: string | null
          id: string
          job_opening_id: string | null
          job_opening_title: string | null
          last_activity_time: string | null
          last_synced_at: string | null
          mes_llegada: string | null
          modified_time: string | null
          nationality: string | null
          native_language: string | null
          notas_excel: string | null
          owner: string | null
          phone: string | null
          promocion_nombre: string | null
          quincena: string | null
          sla_status: string | null
          source: string | null
          tags: string[] | null
          tiempo_colocacion: string | null
          tipo_perfil: string | null
          transferred_to: string | null
          updated_at: string | null
          work_permit: string | null
        }
        Insert: {
          assigned_agency?: string | null
          candidate_stage?: string | null
          cliente?: string | null
          coordinador?: string | null
          created_at?: string | null
          created_time?: string | null
          current_status?: string | null
          days_in_process?: number | null
          days_since_activity?: number | null
          dropout_attendance_pct?: number | null
          dropout_date?: string | null
          dropout_days_of_training?: number | null
          dropout_language_level?: string | null
          dropout_modality?: string | null
          dropout_notes?: string | null
          dropout_reason?: string | null
          dropout_start_date?: string | null
          email?: string | null
          english_level?: string | null
          fecha_fin_formacion?: string | null
          fecha_inicio_trabajo?: string | null
          full_name?: string | null
          german_level?: string | null
          global_status?: string | null
          gp_assignment?: string | null
          gp_availability?: string | null
          gp_has_profile?: boolean | null
          gp_kontaktperson?: string | null
          gp_open_to?: string | null
          gp_priority?: string | null
          gp_shots?: string | null
          gp_training_status?: string | null
          id: string
          job_opening_id?: string | null
          job_opening_title?: string | null
          last_activity_time?: string | null
          last_synced_at?: string | null
          mes_llegada?: string | null
          modified_time?: string | null
          nationality?: string | null
          native_language?: string | null
          notas_excel?: string | null
          owner?: string | null
          phone?: string | null
          promocion_nombre?: string | null
          quincena?: string | null
          sla_status?: string | null
          source?: string | null
          tags?: string[] | null
          tiempo_colocacion?: string | null
          tipo_perfil?: string | null
          transferred_to?: string | null
          updated_at?: string | null
          work_permit?: string | null
        }
        Update: {
          assigned_agency?: string | null
          candidate_stage?: string | null
          cliente?: string | null
          coordinador?: string | null
          created_at?: string | null
          created_time?: string | null
          current_status?: string | null
          days_in_process?: number | null
          days_since_activity?: number | null
          dropout_attendance_pct?: number | null
          dropout_date?: string | null
          dropout_days_of_training?: number | null
          dropout_language_level?: string | null
          dropout_modality?: string | null
          dropout_notes?: string | null
          dropout_reason?: string | null
          dropout_start_date?: string | null
          email?: string | null
          english_level?: string | null
          fecha_fin_formacion?: string | null
          fecha_inicio_trabajo?: string | null
          full_name?: string | null
          german_level?: string | null
          global_status?: string | null
          gp_assignment?: string | null
          gp_availability?: string | null
          gp_has_profile?: boolean | null
          gp_kontaktperson?: string | null
          gp_open_to?: string | null
          gp_priority?: string | null
          gp_shots?: string | null
          gp_training_status?: string | null
          id?: string
          job_opening_id?: string | null
          job_opening_title?: string | null
          last_activity_time?: string | null
          last_synced_at?: string | null
          mes_llegada?: string | null
          modified_time?: string | null
          nationality?: string | null
          native_language?: string | null
          notas_excel?: string | null
          owner?: string | null
          phone?: string | null
          promocion_nombre?: string | null
          quincena?: string | null
          sla_status?: string | null
          source?: string | null
          tags?: string[] | null
          tiempo_colocacion?: string | null
          tipo_perfil?: string | null
          transferred_to?: string | null
          updated_at?: string | null
          work_permit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_by_opening"
            referencedColumns: ["id"]
          },
        ]
      }
      charlas_programa_totales_kpi: {
        Row: {
          created_at: string | null
          id: string
          programa: string
          total_personas_formaciones: number | null
          total_registros: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          programa: string
          total_personas_formaciones?: number | null
          total_registros?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          programa?: string
          total_personas_formaciones?: number | null
          total_registros?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      charlas_temporada_kpi: {
        Row: {
          charlas_realizadas: number | null
          created_at: string | null
          formacion_from_uni: number | null
          formacion_from_webinar: number | null
          id: string
          observaciones: string | null
          programa: string
          promociones_revisadas: number | null
          temporada: string
          total_formacion: number | null
          total_inscritos: number | null
          total_inscritos_charlas: number | null
          total_inscritos_webinars: number | null
          updated_at: string | null
        }
        Insert: {
          charlas_realizadas?: number | null
          created_at?: string | null
          formacion_from_uni?: number | null
          formacion_from_webinar?: number | null
          id?: string
          observaciones?: string | null
          programa: string
          promociones_revisadas?: number | null
          temporada: string
          total_formacion?: number | null
          total_inscritos?: number | null
          total_inscritos_charlas?: number | null
          total_inscritos_webinars?: number | null
          updated_at?: string | null
        }
        Update: {
          charlas_realizadas?: number | null
          created_at?: string | null
          formacion_from_uni?: number | null
          formacion_from_webinar?: number | null
          id?: string
          observaciones?: string | null
          programa?: string
          promociones_revisadas?: number | null
          temporada?: string
          total_formacion?: number | null
          total_inscritos?: number | null
          total_inscritos_charlas?: number | null
          total_inscritos_webinars?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages_kpi: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          role: string
          session_id: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          role: string
          session_id: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          role?: string
          session_id?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_kpi_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions_kpi"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions_kpi: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_email: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_email: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_email?: string
        }
        Relationships: []
      }
      daily_snapshot_kpi: {
        Row: {
          count: number | null
          id: number
          job_opening_id: string | null
          job_opening_title: string | null
          snapshot_date: string
          status: string | null
        }
        Insert: {
          count?: number | null
          id?: number
          job_opening_id?: string | null
          job_opening_title?: string | null
          snapshot_date: string
          status?: string | null
        }
        Update: {
          count?: number | null
          id?: number
          job_opening_id?: string | null
          job_opening_title?: string | null
          snapshot_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_snapshot_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_snapshot_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_by_opening"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_config_kpi: {
        Row: {
          config_key: string
          config_value: Json | null
          id: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json | null
          id?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json | null
          id?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      document_tracking: {
        Row: {
          created_at: string | null
          delivery_error: string | null
          delivery_status: string | null
          document_name: string | null
          firma_id: string
          id: string
          metadata: Json | null
          promotion_id: string | null
          signed_at: string | null
          status: string | null
          student_id: string | null
          template_id: string | null
          template_name: string | null
          updated_at: string | null
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_error?: string | null
          delivery_status?: string | null
          document_name?: string | null
          firma_id: string
          id?: string
          metadata?: Json | null
          promotion_id?: string | null
          signed_at?: string | null
          status?: string | null
          student_id?: string | null
          template_id?: string | null
          template_name?: string | null
          updated_at?: string | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_error?: string | null
          delivery_status?: string | null
          document_name?: string | null
          firma_id?: string
          id?: string
          metadata?: Json | null
          promotion_id?: string | null
          signed_at?: string | null
          status?: string | null
          student_id?: string | null
          template_id?: string | null
          template_name?: string | null
          updated_at?: string | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_tracking_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tracking_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings_kpi: {
        Row: {
          category: string
          client_name: string | null
          created_at: string | null
          date_opened: string | null
          es_proceso_atraccion_actual: boolean
          hired_count: number | null
          id: string
          is_active: boolean | null
          is_visible: boolean | null
          job_description: string | null
          last_synced_at: string | null
          owner: string | null
          status: string | null
          tags: string[]
          tipo_profesional: string
          title: string
          total_candidates: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string
          client_name?: string | null
          created_at?: string | null
          date_opened?: string | null
          es_proceso_atraccion_actual?: boolean
          hired_count?: number | null
          id: string
          is_active?: boolean | null
          is_visible?: boolean | null
          job_description?: string | null
          last_synced_at?: string | null
          owner?: string | null
          status?: string | null
          tags?: string[]
          tipo_profesional?: string
          title: string
          total_candidates?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          client_name?: string | null
          created_at?: string | null
          date_opened?: string | null
          es_proceso_atraccion_actual?: boolean
          hired_count?: number | null
          id?: string
          is_active?: boolean | null
          is_visible?: boolean | null
          job_description?: string | null
          last_synced_at?: string | null
          owner?: string | null
          status?: string | null
          tags?: string[]
          tipo_profesional?: string
          title?: string
          total_candidates?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pagos_candidato_kpi: {
        Row: {
          anexo_firmado: boolean | null
          candidate_id: string | null
          condiciones_fase: string | null
          coordinador: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          fase_abandono: string | null
          fecha_abandono: string | null
          fecha_inicio_formacion: string | null
          fecha_respuesta_mail: string | null
          fecha_viaje_noruega: string | null
          full_name: string
          horas_cursadas: number | null
          id: string
          modalidad: string | null
          perfil: string | null
          precio_formacion: number | null
          precio_hora: number | null
          precio_total: number | null
          promocion_anterior: string | null
          promocion_nombre: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          anexo_firmado?: boolean | null
          candidate_id?: string | null
          condiciones_fase?: string | null
          coordinador?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          fase_abandono?: string | null
          fecha_abandono?: string | null
          fecha_inicio_formacion?: string | null
          fecha_respuesta_mail?: string | null
          fecha_viaje_noruega?: string | null
          full_name: string
          horas_cursadas?: number | null
          id?: string
          modalidad?: string | null
          perfil?: string | null
          precio_formacion?: number | null
          precio_hora?: number | null
          precio_total?: number | null
          promocion_anterior?: string | null
          promocion_nombre?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          anexo_firmado?: boolean | null
          candidate_id?: string | null
          condiciones_fase?: string | null
          coordinador?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          fase_abandono?: string | null
          fecha_abandono?: string | null
          fecha_inicio_formacion?: string | null
          fecha_respuesta_mail?: string | null
          fecha_viaje_noruega?: string | null
          full_name?: string
          horas_cursadas?: number | null
          id?: string
          modalidad?: string | null
          perfil?: string | null
          precio_formacion?: number | null
          precio_hora?: number | null
          precio_total?: number | null
          promocion_anterior?: string | null
          promocion_nombre?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_candidato_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_candidato_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates_active"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_job_link_kpi: {
        Row: {
          created_at: string | null
          job_opening_id: string | null
          promocion_nombre: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          job_opening_id?: string | null
          promocion_nombre: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          job_opening_id?: string | null
          promocion_nombre?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_job_link_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_job_link_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_by_opening"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_sheets_kpi: {
        Row: {
          created_at: string | null
          id: string
          job_opening_id: string | null
          last_synced_at: string | null
          sheet_id: string | null
          sheet_name: string | null
          sheet_url: string
          sync_error: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_opening_id?: string | null
          last_synced_at?: string | null
          sheet_id?: string | null
          sheet_name?: string | null
          sheet_url: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_opening_id?: string | null
          last_synced_at?: string | null
          sheet_id?: string | null
          sheet_name?: string | null
          sheet_url?: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_sheets_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_sheets_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_by_opening"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_students_kpi: {
        Row: {
          country_of_residence: string | null
          created_at: string | null
          dropout_date: string | null
          dropout_days_of_training: number | null
          dropout_modality: string | null
          dropout_notes: string | null
          dropout_reason: string | null
          email: string | null
          end_date: string | null
          english_level: string | null
          enrollment_date: string | null
          full_name: string | null
          german_level: string | null
          id: string
          job_opening_id: string | null
          match_confidence: string | null
          nationality: string | null
          native_language: string | null
          notes: string | null
          phone: string | null
          promo_sheet_id: string
          raw_data: Json | null
          row_number: number | null
          sheet_stage: string | null
          sheet_status: string | null
          start_date: string | null
          tab_name: string | null
          updated_at: string | null
          work_permit: string | null
          zoho_candidate_id: string | null
          zoho_matched_at: string | null
          zoho_status: string | null
        }
        Insert: {
          country_of_residence?: string | null
          created_at?: string | null
          dropout_date?: string | null
          dropout_days_of_training?: number | null
          dropout_modality?: string | null
          dropout_notes?: string | null
          dropout_reason?: string | null
          email?: string | null
          end_date?: string | null
          english_level?: string | null
          enrollment_date?: string | null
          full_name?: string | null
          german_level?: string | null
          id?: string
          job_opening_id?: string | null
          match_confidence?: string | null
          nationality?: string | null
          native_language?: string | null
          notes?: string | null
          phone?: string | null
          promo_sheet_id: string
          raw_data?: Json | null
          row_number?: number | null
          sheet_stage?: string | null
          sheet_status?: string | null
          start_date?: string | null
          tab_name?: string | null
          updated_at?: string | null
          work_permit?: string | null
          zoho_candidate_id?: string | null
          zoho_matched_at?: string | null
          zoho_status?: string | null
        }
        Update: {
          country_of_residence?: string | null
          created_at?: string | null
          dropout_date?: string | null
          dropout_days_of_training?: number | null
          dropout_modality?: string | null
          dropout_notes?: string | null
          dropout_reason?: string | null
          email?: string | null
          end_date?: string | null
          english_level?: string | null
          enrollment_date?: string | null
          full_name?: string | null
          german_level?: string | null
          id?: string
          job_opening_id?: string | null
          match_confidence?: string | null
          nationality?: string | null
          native_language?: string | null
          notes?: string | null
          phone?: string | null
          promo_sheet_id?: string
          raw_data?: Json | null
          row_number?: number | null
          sheet_stage?: string | null
          sheet_status?: string | null
          start_date?: string | null
          tab_name?: string | null
          updated_at?: string | null
          work_permit?: string | null
          zoho_candidate_id?: string | null
          zoho_matched_at?: string | null
          zoho_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_students_promo_sheet_id_fkey"
            columns: ["promo_sheet_id"]
            isOneToOne: false
            referencedRelation: "promo_sheets_kpi"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_targets_kpi: {
        Row: {
          cliente: string | null
          contratos_firmados: number | null
          coordinador: string | null
          created_at: string | null
          expectativa_finalizan: number | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          last_synced_at: string | null
          modalidad: string | null
          objetivo_atraccion: number | null
          objetivo_programa: number | null
          pais: string | null
          pct_consecucion_atraccion: number | null
          pct_consecucion_programa: number | null
          pct_exito_estimado: number | null
          promocion: string
          raw_data: Json | null
          total_aceptados: number | null
          total_programa: number | null
          updated_at: string | null
        }
        Insert: {
          cliente?: string | null
          contratos_firmados?: number | null
          coordinador?: string | null
          created_at?: string | null
          expectativa_finalizan?: number | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          last_synced_at?: string | null
          modalidad?: string | null
          objetivo_atraccion?: number | null
          objetivo_programa?: number | null
          pais?: string | null
          pct_consecucion_atraccion?: number | null
          pct_consecucion_programa?: number | null
          pct_exito_estimado?: number | null
          promocion: string
          raw_data?: Json | null
          total_aceptados?: number | null
          total_programa?: number | null
          updated_at?: string | null
        }
        Update: {
          cliente?: string | null
          contratos_firmados?: number | null
          coordinador?: string | null
          created_at?: string | null
          expectativa_finalizan?: number | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          last_synced_at?: string | null
          modalidad?: string | null
          objetivo_atraccion?: number | null
          objetivo_programa?: number | null
          pais?: string | null
          pct_consecucion_atraccion?: number | null
          pct_consecucion_programa?: number | null
          pct_exito_estimado?: number | null
          promocion?: string
          raw_data?: Json | null
          total_aceptados?: number | null
          total_programa?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promotion_templates: {
        Row: {
          created_at: string | null
          id: string
          promotion_id: string
          template_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          promotion_id: string
          template_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          promotion_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_templates_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string | null
          description: string | null
          destination_country: string
          id: string
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          destination_country?: string
          id?: string
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          destination_country?: string
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      promotions_kpi: {
        Row: {
          cliente: string | null
          coordinador: string | null
          created_at: string | null
          expectativa_finalizan: number | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          is_active: boolean | null
          modalidad: string | null
          nombre: string
          numero: number | null
          objetivo_atraccion: number | null
          objetivo_programa: number | null
          pais: string | null
          phase: string | null
          raw_data: Json | null
          sheet_madre_row: number | null
          sheet_url: string | null
          total_aceptados: number | null
          total_candidates: number | null
          total_dropouts: number | null
          total_hired: number | null
          total_programa: number | null
          updated_at: string | null
          zoho_job_opening_id: string | null
        }
        Insert: {
          cliente?: string | null
          coordinador?: string | null
          created_at?: string | null
          expectativa_finalizan?: number | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          is_active?: boolean | null
          modalidad?: string | null
          nombre: string
          numero?: number | null
          objetivo_atraccion?: number | null
          objetivo_programa?: number | null
          pais?: string | null
          phase?: string | null
          raw_data?: Json | null
          sheet_madre_row?: number | null
          sheet_url?: string | null
          total_aceptados?: number | null
          total_candidates?: number | null
          total_dropouts?: number | null
          total_hired?: number | null
          total_programa?: number | null
          updated_at?: string | null
          zoho_job_opening_id?: string | null
        }
        Update: {
          cliente?: string | null
          coordinador?: string | null
          created_at?: string | null
          expectativa_finalizan?: number | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          is_active?: boolean | null
          modalidad?: string | null
          nombre?: string
          numero?: number | null
          objetivo_atraccion?: number | null
          objetivo_programa?: number | null
          pais?: string | null
          phase?: string | null
          raw_data?: Json | null
          sheet_madre_row?: number | null
          sheet_url?: string | null
          total_aceptados?: number | null
          total_candidates?: number | null
          total_dropouts?: number | null
          total_hired?: number | null
          total_programa?: number | null
          updated_at?: string | null
          zoho_job_opening_id?: string | null
        }
        Relationships: []
      }
      shipment_batches: {
        Row: {
          created_at: string | null
          id: string
          name: string
          promotion_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          promotion_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          promotion_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_batches_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_alerts_kpi: {
        Row: {
          alert_level: string | null
          candidate_id: string | null
          candidate_name: string | null
          created_at: string | null
          current_status: string | null
          days_stuck: number | null
          id: number
          job_opening_id: string | null
          job_opening_title: string | null
          notified_at: string | null
          owner: string | null
          resolved_at: string | null
          updated_at: string | null
        }
        Insert: {
          alert_level?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          created_at?: string | null
          current_status?: string | null
          days_stuck?: number | null
          id?: number
          job_opening_id?: string | null
          job_opening_title?: string | null
          notified_at?: string | null
          owner?: string | null
          resolved_at?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_level?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          created_at?: string | null
          current_status?: string | null
          days_stuck?: number | null
          id?: number
          job_opening_id?: string | null
          job_opening_title?: string | null
          notified_at?: string | null
          owner?: string | null
          resolved_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_alerts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_alerts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_alerts_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_alerts_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_by_opening"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_snapshots_kpi: {
        Row: {
          account_id: string
          captured_at: string | null
          followers_count: number | null
          following_count: number | null
          handle: string | null
          id: string
          metric_name: string
          platform: string
          posts_count: number | null
          raw_data: Json | null
          subscribers_count: number | null
          total_views: number | null
        }
        Insert: {
          account_id: string
          captured_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          handle?: string | null
          id?: string
          metric_name?: string
          platform: string
          posts_count?: number | null
          raw_data?: Json | null
          subscribers_count?: number | null
          total_views?: number | null
        }
        Update: {
          account_id?: string
          captured_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          handle?: string | null
          id?: string
          metric_name?: string
          platform?: string
          posts_count?: number | null
          raw_data?: Json | null
          subscribers_count?: number | null
          total_views?: number | null
        }
        Relationships: []
      }
      stage_history_kpi: {
        Row: {
          candidate_id: string | null
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          days_in_stage: number | null
          from_status: string | null
          id: number
          job_opening_id: string | null
          to_status: string | null
        }
        Insert: {
          candidate_id?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          days_in_stage?: number | null
          from_status?: string | null
          id?: number
          job_opening_id?: string | null
          to_status?: string | null
        }
        Update: {
          candidate_id?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          days_in_stage?: number | null
          from_status?: string | null
          id?: number
          job_opening_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidates_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_history_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_history_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_by_opening"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string | null
          email: string
          email_checked_at: string | null
          email_reason: string | null
          email_status: string | null
          first_name: string
          id: string
          last_name: string
          profession: string | null
          promotion_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          email_checked_at?: string | null
          email_reason?: string | null
          email_status?: string | null
          first_name: string
          id?: string
          last_name: string
          profession?: string | null
          promotion_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          email_checked_at?: string | null
          email_reason?: string | null
          email_status?: string | null
          first_name?: string
          id?: string
          last_name?: string
          profession?: string | null
          promotion_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log_kpi: {
        Row: {
          api_calls_used: number | null
          error_message: string | null
          finished_at: string | null
          id: number
          records_processed: number | null
          started_at: string | null
          status: string | null
          sync_type: string | null
        }
        Insert: {
          api_calls_used?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: number
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Update: {
          api_calls_used?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: number
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Relationships: []
      }
      user_openai_keys_kpi: {
        Row: {
          created_at: string | null
          encrypted_key: string
          model_preference: string
          updated_at: string | null
          user_email: string
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          model_preference?: string
          updated_at?: string | null
          user_email: string
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          model_preference?: string
          updated_at?: string | null
          user_email?: string
        }
        Relationships: []
      }
      user_preferences_kpi: {
        Row: {
          created_at: string | null
          id: string
          preference_type: string
          updated_at: string | null
          user_key: string
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          preference_type: string
          updated_at?: string | null
          user_key?: string
          value?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          preference_type?: string
          updated_at?: string | null
          user_key?: string
          value?: Json
        }
        Relationships: []
      }
      vacancy_status_counts_kpi: {
        Row: {
          count: number
          id: string
          status: string
          synced_at: string
          vacancy_id: string
        }
        Insert: {
          count?: number
          id?: string
          status: string
          synced_at?: string
          vacancy_id: string
        }
        Update: {
          count?: number
          id?: string
          status?: string
          synced_at?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_status_counts_kpi_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "job_openings_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancy_status_counts_kpi_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_by_opening"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          signing_request_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          signing_request_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          signing_request_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_avg_time_by_stage: {
        Row: {
          dias_max: number | null
          dias_medio: number | null
          dias_min: number | null
          from_status: string | null
          num_candidatos: number | null
          to_status: string | null
        }
        Relationships: []
      }
      v_candidates_active: {
        Row: {
          candidate_stage: string | null
          created_at: string | null
          created_time: string | null
          current_status: string | null
          days_in_process: number | null
          days_since_activity: number | null
          dias_sin_actividad: number | null
          dias_total_proceso: number | null
          email: string | null
          english_level: string | null
          full_name: string | null
          german_level: string | null
          global_status: string | null
          id: string | null
          job_opening_id: string | null
          job_opening_title: string | null
          last_activity_time: string | null
          last_synced_at: string | null
          modified_time: string | null
          nationality: string | null
          native_language: string | null
          owner: string | null
          phone: string | null
          sla_status: string | null
          source: string | null
          updated_at: string | null
          vacante: string | null
          vacante_visible: boolean | null
          work_permit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings_kpi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_by_opening"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pipeline_by_opening: {
        Row: {
          alertas_amarillas: number | null
          alertas_rojas: number | null
          contratados: number | null
          dias_medio_proceso: number | null
          id: string | null
          is_visible: boolean | null
          status: string | null
          title: string | null
          total_candidatos: number | null
        }
        Relationships: []
      }
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
    Enums: {},
  },
} as const

// ---------------------------------------------------------------------------
// Convenience type aliases (re-exported for backwards compatibility)
// ---------------------------------------------------------------------------
export type JobOpening = Tables<'job_openings_kpi'>
export type JobOpeningInsert = TablesInsert<'job_openings_kpi'>
export type Candidate = Tables<'candidates_kpi'>
export type CandidateInsert = TablesInsert<'candidates_kpi'>
export type SlaAlert = Tables<'sla_alerts_kpi'>
export type SyncLog = Tables<'sync_log_kpi'>
export type StageHistory = Tables<'stage_history_kpi'>
export type VacancyStatusCount = Tables<'vacancy_status_counts_kpi'>

export type CandidateJobHistory = Tables<'candidate_job_history_kpi'>
export type PromoTarget = Tables<'promo_targets_kpi'>
export type PromoSheet = Tables<'promo_sheets_kpi'>
export type DashboardConfig = Tables<'dashboard_config_kpi'>
export type Promotion = Tables<'promotions_kpi'>
export type PromotionInsert = TablesInsert<'promotions_kpi'>
export type PromotionUpdate = TablesUpdate<'promotions_kpi'>
