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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      equipements: {
        Row: {
          categorie: string | null
          created_at: string
          date_mise_en_service: string | null
          designation: string
          etablissement_id: string
          fournisseur: string | null
          id: string
          marque: string | null
          modele: string | null
          numero_serie: string | null
          photo_path: string | null
          reference: string
          statut: Database["public"]["Enums"]["equipement_statut"]
          updated_at: string
          zone: string | null
        }
        Insert: {
          categorie?: string | null
          created_at?: string
          date_mise_en_service?: string | null
          designation: string
          etablissement_id: string
          fournisseur?: string | null
          id?: string
          marque?: string | null
          modele?: string | null
          numero_serie?: string | null
          photo_path?: string | null
          reference: string
          statut?: Database["public"]["Enums"]["equipement_statut"]
          updated_at?: string
          zone?: string | null
        }
        Update: {
          categorie?: string | null
          created_at?: string
          date_mise_en_service?: string | null
          designation?: string
          etablissement_id?: string
          fournisseur?: string | null
          id?: string
          marque?: string | null
          modele?: string | null
          numero_serie?: string | null
          photo_path?: string | null
          reference?: string
          statut?: Database["public"]["Enums"]["equipement_statut"]
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipements_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      etablissements: {
        Row: {
          adresse: string | null
          contact: string | null
          created_at: string
          id: string
          nom: string
          responsable: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          nom: string
          responsable?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          nom?: string
          responsable?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      health_check: {
        Row: {
          created_at: string
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      profils_utilisateurs: {
        Row: {
          created_at: string
          id: string
          nom: string | null
          prenom: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nom?: string | null
          prenom?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string | null
          prenom?: string | null
          updated_at?: string
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
      utilisateur_etablissements: {
        Row: {
          created_at: string
          etablissement_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          etablissement_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          etablissement_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utilisateur_etablissements_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_global_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_in_etablissement: {
        Args: { _etab: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "responsable_maintenance"
        | "technicien"
        | "demandeur"
        | "gestionnaire_stock"
        | "prestataire"
        | "responsable_etablissement"
      equipement_statut:
        | "en_service"
        | "en_panne"
        | "en_maintenance"
        | "hors_service"
        | "reforme"
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
        "responsable_maintenance",
        "technicien",
        "demandeur",
        "gestionnaire_stock",
        "prestataire",
        "responsable_etablissement",
      ],
      equipement_statut: [
        "en_service",
        "en_panne",
        "en_maintenance",
        "hors_service",
        "reforme",
      ],
    },
  },
} as const
