# Roadmap SYGMA

## Correction de création des demandes
- [x] Auditer les règles de création, de lecture et de pièces jointes
- [x] Corriger la lecture immédiate à la création et les écritures d'historique, sans élargir les droits de création
- [x] Dix tests réussis ; création connectée avec pièce jointe, relecture et téléchargement vérifiés ; données de test supprimées

## En cours — Techniciens / Prestataires / Établissements
- [x] Schéma BDD : compétences, disponibilité, supérieur hiérarchique, table `prestataires`, `prestataire_id` sur DI et interventions
- [x] Lib `src/lib/prestataires.ts` et `src/lib/techniciens.ts`
- [x] Écran Techniciens (équipe + planning / charge)
- [x] Écran Prestataires (CRUD, contrat)
- [x] Écran Établissements (gestion + vue consolidée multi-sites)
- [x] Affectation d'une DI à un prestataire externe
- [x] Affectation d'une intervention à un prestataire (création + fiche)
- [x] Portail prestataire (interventions affectées uniquement, rapport identique)
- [x] Liens sidebar : Techniciens, Prestataires, Établissements

## Rapports & notifications
- [x] Table rapports_generes + stockage
- [x] Bibliothèque de rapports (/rapports)
- [x] Rapport personnalisé PDF/Excel
- [ ] Rapport mensuel automatique sécurisé — bloqué : secret de tâche planifiée à configurer ; relance manuelle disponible
- [x] Exports Excel/CSV/PDF : DI, équipements, interventions
- [ ] Notifications e-mail — bloqué : domaine e-mail à configurer

## Cloisonnement des établissements
- [x] Étape 1 : règles d'accès base de données par site, rôles par site, Site B de test
- [x] Étape 2 : rôles actifs par site, nouveau cache et formulaires au changement, écran rôles par établissement, listes principales filtrées
- [x] Étape 3 : fichiers liés au site et à leur dossier parent, exports filtrés, changements d'établissement interdits, audit des comptes
- [ ] Validation complète connectée — bloqué : session transmise non valide et aucun compte correspondant à l’adresse du demandeur pour créer une session

### Suite demandée
- [x] Rôles actifs du site sélectionné, cache isolé et formulaires réinitialisés au changement de site
- [x] Gestion des rôles par établissement avec contrôles serveur et conservation des droits des autres sites
- [x] Cinq tests de non-contournement des droits ; compilation validée
