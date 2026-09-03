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
      bons_sortie: {
        Row: {
          created_at: string
          cree_par: string | null
          date_sortie: string
          demande_id: string
          etablissement_id: string
          id: string
          intervention_id: string | null
          magasin_id: string
          numero: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cree_par?: string | null
          date_sortie?: string
          demande_id: string
          etablissement_id: string
          id?: string
          intervention_id?: string | null
          magasin_id: string
          numero?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cree_par?: string | null
          date_sortie?: string
          demande_id?: string
          etablissement_id?: string
          id?: string
          intervention_id?: string | null
          magasin_id?: string
          numero?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bons_sortie_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_sortie_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: true
            referencedRelation: "demandes_sortie_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_sortie_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_sortie_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_sortie_magasin_id_fkey"
            columns: ["magasin_id"]
            isOneToOne: false
            referencedRelation: "magasins"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_operations: {
        Row: {
          actif: boolean
          categorie_equipement: string | null
          created_at: string
          id: string
          libelle: string
          ordre: number
          phase: number
          updated_at: string
        }
        Insert: {
          actif?: boolean
          categorie_equipement?: string | null
          created_at?: string
          id?: string
          libelle: string
          ordre?: number
          phase: number
          updated_at?: string
        }
        Update: {
          actif?: boolean
          categorie_equipement?: string | null
          created_at?: string
          id?: string
          libelle?: string
          ordre?: number
          phase?: number
          updated_at?: string
        }
        Relationships: []
      }
      commandes_achat: {
        Row: {
          created_at: string
          date_commande: string | null
          demandeur_id: string | null
          etablissement_id: string
          fournisseur: string
          id: string
          magasin_id: string | null
          montant_estime: number | null
          notes: string | null
          numero: number
          pieces_jointes: string[]
          reference: string | null
          statut: Database["public"]["Enums"]["commande_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_commande?: string | null
          demandeur_id?: string | null
          etablissement_id: string
          fournisseur: string
          id?: string
          magasin_id?: string | null
          montant_estime?: number | null
          notes?: string | null
          numero?: number
          pieces_jointes?: string[]
          reference?: string | null
          statut?: Database["public"]["Enums"]["commande_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_commande?: string | null
          demandeur_id?: string | null
          etablissement_id?: string
          fournisseur?: string
          id?: string
          magasin_id?: string | null
          montant_estime?: number | null
          notes?: string | null
          numero?: number
          pieces_jointes?: string[]
          reference?: string | null
          statut?: Database["public"]["Enums"]["commande_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commandes_achat_demandeur_id_fkey"
            columns: ["demandeur_id"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_achat_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_achat_magasin_id_fkey"
            columns: ["magasin_id"]
            isOneToOne: false
            referencedRelation: "magasins"
            referencedColumns: ["id"]
          },
        ]
      }
      commandes_achat_lignes: {
        Row: {
          commande_id: string
          created_at: string
          id: string
          piece_id: string
          prix_unitaire: number | null
          quantite_commandee: number
          quantite_recue: number
          updated_at: string
        }
        Insert: {
          commande_id: string
          created_at?: string
          id?: string
          piece_id: string
          prix_unitaire?: number | null
          quantite_commandee: number
          quantite_recue?: number
          updated_at?: string
        }
        Update: {
          commande_id?: string
          created_at?: string
          id?: string
          piece_id?: string
          prix_unitaire?: number | null
          quantite_commandee?: number
          quantite_recue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commandes_achat_lignes_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_achat_lignes_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_intervention: {
        Row: {
          created_at: string
          demandeur_id: string
          description: string
          equipement_id: string | null
          etablissement_id: string
          id: string
          localisation: string | null
          pieces_jointes: string[]
          prestataire_id: string | null
          priorite: Database["public"]["Enums"]["di_priorite"]
          statut: Database["public"]["Enums"]["di_statut"]
          technicien_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          demandeur_id: string
          description: string
          equipement_id?: string | null
          etablissement_id: string
          id?: string
          localisation?: string | null
          pieces_jointes?: string[]
          prestataire_id?: string | null
          priorite?: Database["public"]["Enums"]["di_priorite"]
          statut?: Database["public"]["Enums"]["di_statut"]
          technicien_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          demandeur_id?: string
          description?: string
          equipement_id?: string | null
          etablissement_id?: string
          id?: string
          localisation?: string | null
          pieces_jointes?: string[]
          prestataire_id?: string | null
          priorite?: Database["public"]["Enums"]["di_priorite"]
          statut?: Database["public"]["Enums"]["di_statut"]
          technicien_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandes_intervention_demandeur_id_fkey"
            columns: ["demandeur_id"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_intervention_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_intervention_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_intervention_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_intervention_technicien_id_fkey"
            columns: ["technicien_id"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_intervention_historique: {
        Row: {
          ancien_statut: Database["public"]["Enums"]["di_statut"] | null
          created_at: string
          demande_id: string
          id: string
          nouveau_statut: Database["public"]["Enums"]["di_statut"]
          user_id: string | null
        }
        Insert: {
          ancien_statut?: Database["public"]["Enums"]["di_statut"] | null
          created_at?: string
          demande_id: string
          id?: string
          nouveau_statut: Database["public"]["Enums"]["di_statut"]
          user_id?: string | null
        }
        Update: {
          ancien_statut?: Database["public"]["Enums"]["di_statut"] | null
          created_at?: string
          demande_id?: string
          id?: string
          nouveau_statut?: Database["public"]["Enums"]["di_statut"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_intervention_historique_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes_intervention"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_sortie_lignes: {
        Row: {
          created_at: string
          demande_id: string
          id: string
          piece_id: string
          quantite_demandee: number
          quantite_sortie: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          demande_id: string
          id?: string
          piece_id: string
          quantite_demandee: number
          quantite_sortie?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          demande_id?: string
          id?: string
          piece_id?: string
          quantite_demandee?: number
          quantite_sortie?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandes_sortie_lignes_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes_sortie_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_sortie_lignes_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_sortie_pieces: {
        Row: {
          created_at: string
          equipement_id: string | null
          etablissement_id: string
          id: string
          intervention_id: string | null
          justification: string | null
          motif_refus: string | null
          statut: Database["public"]["Enums"]["ds_statut"]
          technicien_id: string
          traite_at: string | null
          traite_par: string | null
          updated_at: string
          urgence: Database["public"]["Enums"]["di_priorite"]
          valide_at: string | null
          valide_par: string | null
        }
        Insert: {
          created_at?: string
          equipement_id?: string | null
          etablissement_id: string
          id?: string
          intervention_id?: string | null
          justification?: string | null
          motif_refus?: string | null
          statut?: Database["public"]["Enums"]["ds_statut"]
          technicien_id: string
          traite_at?: string | null
          traite_par?: string | null
          updated_at?: string
          urgence?: Database["public"]["Enums"]["di_priorite"]
          valide_at?: string | null
          valide_par?: string | null
        }
        Update: {
          created_at?: string
          equipement_id?: string | null
          etablissement_id?: string
          id?: string
          intervention_id?: string | null
          justification?: string | null
          motif_refus?: string | null
          statut?: Database["public"]["Enums"]["ds_statut"]
          technicien_id?: string
          traite_at?: string | null
          traite_par?: string | null
          updated_at?: string
          urgence?: Database["public"]["Enums"]["di_priorite"]
          valide_at?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_sortie_pieces_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_sortie_pieces_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_sortie_pieces_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_sortie_pieces_technicien_id_fkey"
            columns: ["technicien_id"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_sortie_pieces_traite_par_fkey"
            columns: ["traite_par"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_sortie_pieces_valide_par_fkey"
            columns: ["valide_par"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      equipements: {
        Row: {
          categorie: string | null
          created_at: string
          date_mise_en_service: string | null
          designation: string
          etablissement_id: string
          fournisseur: string | null
          gamme_path: string | null
          id: string
          manuel_path: string | null
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
          gamme_path?: string | null
          id?: string
          manuel_path?: string | null
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
          gamme_path?: string | null
          id?: string
          manuel_path?: string | null
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
      fiche_de_vie_evenements: {
        Row: {
          created_at: string
          date_evenement: string
          equipement_id: string | null
          etablissement_id: string
          id: string
          intervention_id: string | null
          nature: Database["public"]["Enums"]["intervention_nature"]
          resume: string | null
          statut_final: Database["public"]["Enums"]["intervention_statut"]
          techniciens: string | null
          updated_at: string
          visite_id: string | null
        }
        Insert: {
          created_at?: string
          date_evenement?: string
          equipement_id?: string | null
          etablissement_id: string
          id?: string
          intervention_id?: string | null
          nature: Database["public"]["Enums"]["intervention_nature"]
          resume?: string | null
          statut_final: Database["public"]["Enums"]["intervention_statut"]
          techniciens?: string | null
          updated_at?: string
          visite_id?: string | null
        }
        Update: {
          created_at?: string
          date_evenement?: string
          equipement_id?: string | null
          etablissement_id?: string
          id?: string
          intervention_id?: string | null
          nature?: Database["public"]["Enums"]["intervention_nature"]
          resume?: string | null
          statut_final?: Database["public"]["Enums"]["intervention_statut"]
          techniciens?: string | null
          updated_at?: string
          visite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiche_de_vie_evenements_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiche_de_vie_evenements_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiche_de_vie_evenements_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: true
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiche_de_vie_evenements_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites_quotidiennes"
            referencedColumns: ["id"]
          },
        ]
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
      intervention_techniciens: {
        Row: {
          created_at: string
          id: string
          intervention_id: string
          technicien_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_id: string
          technicien_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intervention_id?: string
          technicien_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_techniciens_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_techniciens_technicien_id_fkey"
            columns: ["technicien_id"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          created_at: string
          cree_par: string
          date_appel: string | null
          date_debut: string | null
          date_fin: string | null
          date_planifiee: string | null
          demande_id: string | null
          description: string
          duree_estimee_minutes: number | null
          duree_minutes: number | null
          equipement_id: string | null
          etablissement_id: string
          id: string
          interventions_complementaires: string | null
          localisation: string | null
          nature: Database["public"]["Enums"]["intervention_nature"]
          observations: string | null
          pieces_utilisees: string | null
          prestataire_id: string | null
          signature_superviseur: string | null
          signature_superviseur_at: string | null
          signature_superviseur_nom: string | null
          signature_valideur: string | null
          signature_valideur_at: string | null
          signature_valideur_nom: string | null
          statut: Database["public"]["Enums"]["intervention_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          cree_par?: string
          date_appel?: string | null
          date_debut?: string | null
          date_fin?: string | null
          date_planifiee?: string | null
          demande_id?: string | null
          description: string
          duree_estimee_minutes?: number | null
          duree_minutes?: number | null
          equipement_id?: string | null
          etablissement_id: string
          id?: string
          interventions_complementaires?: string | null
          localisation?: string | null
          nature?: Database["public"]["Enums"]["intervention_nature"]
          observations?: string | null
          pieces_utilisees?: string | null
          prestataire_id?: string | null
          signature_superviseur?: string | null
          signature_superviseur_at?: string | null
          signature_superviseur_nom?: string | null
          signature_valideur?: string | null
          signature_valideur_at?: string | null
          signature_valideur_nom?: string | null
          statut?: Database["public"]["Enums"]["intervention_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          cree_par?: string
          date_appel?: string | null
          date_debut?: string | null
          date_fin?: string | null
          date_planifiee?: string | null
          demande_id?: string | null
          description?: string
          duree_estimee_minutes?: number | null
          duree_minutes?: number | null
          equipement_id?: string | null
          etablissement_id?: string
          id?: string
          interventions_complementaires?: string | null
          localisation?: string | null
          nature?: Database["public"]["Enums"]["intervention_nature"]
          observations?: string | null
          pieces_utilisees?: string | null
          prestataire_id?: string | null
          signature_superviseur?: string | null
          signature_superviseur_at?: string | null
          signature_superviseur_nom?: string | null
          signature_valideur?: string | null
          signature_valideur_at?: string | null
          signature_valideur_nom?: string | null
          statut?: Database["public"]["Enums"]["intervention_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes_intervention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
        ]
      }
      magasins: {
        Row: {
          created_at: string
          etablissement_id: string
          id: string
          localisation: string | null
          nom: string
          responsable: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          etablissement_id: string
          id?: string
          localisation?: string | null
          nom: string
          responsable?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          etablissement_id?: string
          id?: string
          localisation?: string | null
          nom?: string
          responsable?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "magasins_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      pieces: {
        Row: {
          categorie: string | null
          code_article: string
          created_at: string
          designation: string
          fournisseur: string | null
          id: string
          prix_unitaire: number | null
          unite: string
          updated_at: string
        }
        Insert: {
          categorie?: string | null
          code_article: string
          created_at?: string
          designation: string
          fournisseur?: string | null
          id?: string
          prix_unitaire?: number | null
          unite?: string
          updated_at?: string
        }
        Update: {
          categorie?: string | null
          code_article?: string
          created_at?: string
          designation?: string
          fournisseur?: string | null
          id?: string
          prix_unitaire?: number | null
          unite?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_echeances: {
        Row: {
          compteur_dernier_declenchement: number
          compteur_releve: number
          created_at: string
          derniere_execution: string | null
          equipement_id: string
          id: string
          plan_id: string
          prochaine_echeance: string | null
          updated_at: string
        }
        Insert: {
          compteur_dernier_declenchement?: number
          compteur_releve?: number
          created_at?: string
          derniere_execution?: string | null
          equipement_id: string
          id?: string
          plan_id: string
          prochaine_echeance?: string | null
          updated_at?: string
        }
        Update: {
          compteur_dernier_declenchement?: number
          compteur_releve?: number
          created_at?: string
          derniere_execution?: string | null
          equipement_id?: string
          id?: string
          plan_id?: string
          prochaine_echeance?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_echeances_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_echeances_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans_preventifs"
            referencedColumns: ["id"]
          },
        ]
      }
      plans_preventifs: {
        Row: {
          actif: boolean
          categorie_equipement: string | null
          checklist_categorie: string | null
          created_at: string
          cree_par: string | null
          date_debut: string
          description: string | null
          duree_estimee_minutes: number | null
          equipement_id: string | null
          etablissement_id: string
          id: string
          libelle: string
          periodicite: Database["public"]["Enums"]["periodicite_type"]
          periodicite_valeur: number
          unite_compteur: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          categorie_equipement?: string | null
          checklist_categorie?: string | null
          created_at?: string
          cree_par?: string | null
          date_debut?: string
          description?: string | null
          duree_estimee_minutes?: number | null
          equipement_id?: string | null
          etablissement_id: string
          id?: string
          libelle: string
          periodicite?: Database["public"]["Enums"]["periodicite_type"]
          periodicite_valeur: number
          unite_compteur?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          categorie_equipement?: string | null
          checklist_categorie?: string | null
          created_at?: string
          cree_par?: string | null
          date_debut?: string
          description?: string | null
          duree_estimee_minutes?: number | null
          equipement_id?: string | null
          etablissement_id?: string
          id?: string
          libelle?: string
          periodicite?: Database["public"]["Enums"]["periodicite_type"]
          periodicite_valeur?: number
          unite_compteur?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_preventifs_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_preventifs_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_preventifs_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      prestataires: {
        Row: {
          actif: boolean
          contact_email: string | null
          contact_nom: string | null
          contact_telephone: string | null
          contrat_debut: string | null
          contrat_fin: string | null
          contrat_notes: string | null
          contrat_reference: string | null
          created_at: string
          etablissement_id: string | null
          id: string
          raison_sociale: string
          specialite: string | null
          updated_at: string
          user_id: string | null
          zone_intervention: string | null
        }
        Insert: {
          actif?: boolean
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          contrat_debut?: string | null
          contrat_fin?: string | null
          contrat_notes?: string | null
          contrat_reference?: string | null
          created_at?: string
          etablissement_id?: string | null
          id?: string
          raison_sociale: string
          specialite?: string | null
          updated_at?: string
          user_id?: string | null
          zone_intervention?: string | null
        }
        Update: {
          actif?: boolean
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          contrat_debut?: string | null
          contrat_fin?: string | null
          contrat_notes?: string | null
          contrat_reference?: string | null
          created_at?: string
          etablissement_id?: string | null
          id?: string
          raison_sociale?: string
          specialite?: string | null
          updated_at?: string
          user_id?: string | null
          zone_intervention?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prestataires_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      profils_utilisateurs: {
        Row: {
          competences: string[]
          created_at: string
          disponibilite: string
          id: string
          nom: string | null
          prenom: string | null
          superieur_id: string | null
          updated_at: string
        }
        Insert: {
          competences?: string[]
          created_at?: string
          disponibilite?: string
          id: string
          nom?: string | null
          prenom?: string | null
          superieur_id?: string | null
          updated_at?: string
        }
        Update: {
          competences?: string[]
          created_at?: string
          disponibilite?: string
          id?: string
          nom?: string | null
          prenom?: string | null
          superieur_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profils_utilisateurs_superieur_id_fkey"
            columns: ["superieur_id"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      rapport_operations_realisees: {
        Row: {
          commentaire: string | null
          created_at: string
          cree_par: string | null
          id: string
          intervention_id: string
          libelle_libre: string | null
          operation_id: string | null
          phase: number
          realisee: boolean
          updated_at: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          cree_par?: string | null
          id?: string
          intervention_id: string
          libelle_libre?: string | null
          operation_id?: string | null
          phase: number
          realisee?: boolean
          updated_at?: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          cree_par?: string | null
          id?: string
          intervention_id?: string
          libelle_libre?: string | null
          operation_id?: string | null
          phase?: number
          realisee?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rapport_operations_realisees_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapport_operations_realisees_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "checklist_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_mouvements: {
        Row: {
          created_at: string
          date_mouvement: string
          etat_piece: Database["public"]["Enums"]["piece_etat"]
          id: string
          justification: string | null
          magasin_id: string
          origine: Database["public"]["Enums"]["stock_mouvement_origine"]
          piece_id: string
          quantite: number
          reference: string | null
          type: Database["public"]["Enums"]["stock_mouvement_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date_mouvement?: string
          etat_piece?: Database["public"]["Enums"]["piece_etat"]
          id?: string
          justification?: string | null
          magasin_id: string
          origine?: Database["public"]["Enums"]["stock_mouvement_origine"]
          piece_id: string
          quantite: number
          reference?: string | null
          type: Database["public"]["Enums"]["stock_mouvement_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date_mouvement?: string
          etat_piece?: Database["public"]["Enums"]["piece_etat"]
          id?: string
          justification?: string | null
          magasin_id?: string
          origine?: Database["public"]["Enums"]["stock_mouvement_origine"]
          piece_id?: string
          quantite?: number
          reference?: string | null
          type?: Database["public"]["Enums"]["stock_mouvement_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_mouvements_magasin_id_fkey"
            columns: ["magasin_id"]
            isOneToOne: false
            referencedRelation: "magasins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_seuils: {
        Row: {
          created_at: string
          id: string
          magasin_id: string
          piece_id: string
          seuil_alerte: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          magasin_id: string
          piece_id: string
          seuil_alerte?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          magasin_id?: string
          piece_id?: string
          seuil_alerte?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_seuils_magasin_id_fkey"
            columns: ["magasin_id"]
            isOneToOne: false
            referencedRelation: "magasins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_seuils_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
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
      visites_quotidiennes: {
        Row: {
          created_at: string
          date_visite: string
          equipement_id: string
          etablissement_id: string
          id: string
          observations: string | null
          signature: string | null
          signature_at: string | null
          signature_nom: string | null
          technicien_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_visite?: string
          equipement_id: string
          etablissement_id: string
          id?: string
          observations?: string | null
          signature?: string | null
          signature_at?: string | null
          signature_nom?: string | null
          technicien_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_visite?: string
          equipement_id?: string
          etablissement_id?: string
          id?: string
          observations?: string | null
          signature?: string | null
          signature_at?: string | null
          signature_nom?: string | null
          technicien_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visites_quotidiennes_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_quotidiennes_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_quotidiennes_technicien_id_fkey"
            columns: ["technicien_id"]
            isOneToOne: false
            referencedRelation: "profils_utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      visites_quotidiennes_operations: {
        Row: {
          commentaire: string | null
          conforme: boolean
          created_at: string
          id: string
          libelle_libre: string | null
          operation_id: string | null
          updated_at: string
          visite_id: string
        }
        Insert: {
          commentaire?: string | null
          conforme?: boolean
          created_at?: string
          id?: string
          libelle_libre?: string | null
          operation_id?: string | null
          updated_at?: string
          visite_id: string
        }
        Update: {
          commentaire?: string | null
          conforme?: boolean
          created_at?: string
          id?: string
          libelle_libre?: string | null
          operation_id?: string | null
          updated_at?: string
          visite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visites_quotidiennes_operations_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "checklist_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_quotidiennes_operations_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites_quotidiennes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_stock_actuel: {
        Row: {
          magasin_id: string | null
          piece_id: string | null
          quantite: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_mouvements_magasin_id_fkey"
            columns: ["magasin_id"]
            isOneToOne: false
            referencedRelation: "magasins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_edit_visite: {
        Args: { _user_id: string; _visite_id: string }
        Returns: boolean
      }
      can_manage_commande: {
        Args: { _commande_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_demande_sortie: {
        Args: { _demande_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_intervention: {
        Args: { _etab: string; _user_id: string }
        Returns: boolean
      }
      can_manage_stock: {
        Args: { _etab: string; _user_id: string }
        Returns: boolean
      }
      can_view_demande: {
        Args: { _demande_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_demande_sortie: {
        Args: { _demande_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_visite: {
        Args: { _user_id: string; _visite_id: string }
        Returns: boolean
      }
      demande_sortie_is_owner_editable: {
        Args: { _demande_id: string; _user_id: string }
        Returns: boolean
      }
      di_transition_autorisee: {
        Args: {
          _ancien: Database["public"]["Enums"]["di_statut"]
          _nouveau: Database["public"]["Enums"]["di_statut"]
        }
        Returns: boolean
      }
      generer_interventions_preventives: { Args: never; Returns: number }
      has_global_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      intervention_etab: { Args: { _intervention_id: string }; Returns: string }
      is_intervention_technicien: {
        Args: { _intervention_id: string; _user_id: string }
        Returns: boolean
      }
      magasin_etab: { Args: { _magasin_id: string }; Returns: string }
      reception_commande: {
        Args: { _commande_id: string; _lignes: Json; _magasin_id: string }
        Returns: undefined
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
      commande_statut:
        | "a_commander"
        | "commandee"
        | "recue_partiellement"
        | "recue"
        | "cloturee"
      di_priorite: "faible" | "moyenne" | "haute" | "critique"
      di_statut:
        | "nouvelle"
        | "validee"
        | "affectee"
        | "en_cours"
        | "terminee"
        | "cloturee"
        | "refusee"
      ds_statut: "demande_creee" | "validee" | "traitee" | "refusee"
      equipement_statut:
        | "en_service"
        | "en_panne"
        | "en_maintenance"
        | "hors_service"
        | "reforme"
      intervention_nature: "curative" | "preventive"
      intervention_statut: "planifiee" | "en_cours" | "terminee" | "signee"
      periodicite_type: "temps" | "compteur"
      piece_etat: "neuf" | "fonctionnel" | "hors_service"
      stock_mouvement_origine: "commande_achat" | "cannibalisation" | "autre"
      stock_mouvement_type: "entree" | "sortie" | "ajustement"
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
      app_role: [
        "super_admin",
        "responsable_maintenance",
        "technicien",
        "demandeur",
        "gestionnaire_stock",
        "prestataire",
        "responsable_etablissement",
      ],
      commande_statut: [
        "a_commander",
        "commandee",
        "recue_partiellement",
        "recue",
        "cloturee",
      ],
      di_priorite: ["faible", "moyenne", "haute", "critique"],
      di_statut: [
        "nouvelle",
        "validee",
        "affectee",
        "en_cours",
        "terminee",
        "cloturee",
        "refusee",
      ],
      ds_statut: ["demande_creee", "validee", "traitee", "refusee"],
      equipement_statut: [
        "en_service",
        "en_panne",
        "en_maintenance",
        "hors_service",
        "reforme",
      ],
      intervention_nature: ["curative", "preventive"],
      intervention_statut: ["planifiee", "en_cours", "terminee", "signee"],
      periodicite_type: ["temps", "compteur"],
      piece_etat: ["neuf", "fonctionnel", "hors_service"],
      stock_mouvement_origine: ["commande_achat", "cannibalisation", "autre"],
      stock_mouvement_type: ["entree", "sortie", "ajustement"],
    },
  },
} as const
