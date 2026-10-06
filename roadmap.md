# Roadmap SYGMA

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
- [x] Rapport mensuel automatique des visites (1er du mois)
- [x] Exports Excel/CSV/PDF : DI, équipements, interventions
- [ ] Notifications e-mail — bloqué : domaine e-mail à configurer

## Cloisonnement des établissements
- [x] Étape 1 : règles d'accès base de données par site, rôles par site, Site B de test
- [ ] Étape 2 : interface (sélecteur branché partout, vidage du cache, écran rôles par site, listes déroulantes filtrées)
- [ ] Étape 3 : fichiers par site, exports, transferts inter-sites, audit étendu, tests complets connectés
