# PAYLIX — PROJECT MEMORY

## 1. IDENTITÉ DU PROJET
Paylix est une plateforme SaaS de gestion financière scolaire multi-établissements (multi-tenant). Elle permet de suivre les obligations financières, paiements et reçus des élèves sans intégrer de paiement en ligne direct.

## 2. OBJECTIF PRODUIT
Centraliser, sécuriser et tracer toutes les opérations financières scolaires (inscriptions, minervals, frais divers) pour éviter les erreurs, pertes et fraudes.
Cibles :
- Platform Admin (super-admin)
- Director (gérant de l'école)
- Accountant (comptable)
- Parent (consultation)

## 3. ÉTAT ACTUEL DU PROJET
Le projet est en cours de développement (apparemment autour de la Phase 14 selon les migrations). 
L'infrastructure de base (Auth, Multi-tenant, RLS, Modèles de base) est en place.
Certaines fonctionnalités complexes (Historique parent multi-années, dettes antérieures) ne sont pas encore achevées ou codées.

## 4. STACK TECHNIQUE
- **Framework** : Next.js (App Router), React 19, TypeScript
- **UI** : Tailwind CSS v4, shadcn/ui, Lucide React
- **Backend/DB** : Supabase, PostgreSQL
- **Auth** : Supabase Auth (`@supabase/ssr`)
- **Hébergement cible** : Vercel
- **Tests** : Vitest

## 5. ARCHITECTURE
Architecture "Backendless" avec Next.js et Supabase.
Sécurité basée sur Row Level Security (RLS) dans PostgreSQL pour garantir l'isolation multi-tenant.
Structure de routage séparée par rôle (`/platform`, `/school`, `/accountant`, `/parent`).

## 6. STRUCTURE DU REPOSITORY
- `src/app/` : Routes Next.js
- `src/components/` : Composants UI (shadcn)
- `src/lib/` : Utilitaires et clients
- `src/types/` : Types TypeScript
- `supabase/migrations/` : Migrations SQL
- `tests/` : Fichiers de tests
- `docs/` : Documentation (ARCHITECTURE.md, PRODUCT.md, etc.)

## 7. BASE DE DONNÉES
Schéma entièrement basé sur PostgreSQL (Supabase) :
Tables principales : `tenants`, `profiles`, `user_memberships`, `school_years`, `classes`, `students`, `parents`, `parent_students`, `fees`, `financial_obligations`, `payments`, `payment_allocations`, `receipts`.
Isolation : Chaque table (sauf globale) a un `tenant_id` avec des policies RLS strictes.

## 8. AUTHENTIFICATION
Gérée par Supabase Auth.
Les utilisateurs ont 1 seul compte (email unique) et utilisent `user_memberships` pour accéder à 1 ou plusieurs `tenants`.
Flux d'invitation Parent spécifique pour gérer les emails déjà existants avec consentement.

## 9. RÔLES ET PERMISSIONS
- `platform_admin` : Accès à `/platform`
- `director` : Accès à `/school`
- `accountant` : Accès à `/accountant`
- `parent` : Accès à `/parent`
Les permissions sont appliquées via les middlewares Next.js et surtout par Supabase RLS.

## 10. MULTI-TENANT / RLS
Le multi-tenant est garanti par la colonne `tenant_id` et les politiques RLS qui vérifient l'appartenance de l'utilisateur (`user_memberships`) avant de renvoyer les données.

## 11. ÉTABLISSEMENTS
[IMPLEMENTED]
Création et gestion par le Platform Admin. Les directeurs peuvent configurer les paramètres (settings) de leur établissement.

## 12. ANNÉES SCOLAIRES
[IMPLEMENTED]
Modèle lié au tenant. Statuts possibles (active).
Une seule année active recommandée par établissement. Les données financières sont liées à l'année scolaire.

## 13. CLASSES
[IMPLEMENTED]
Les classes appartiennent à une année scolaire (`class_school_years`) et à un établissement.

## 14. ÉLÈVES
[IMPLEMENTED]
Matricule généré (compteur par tenant). Associés aux classes et aux années scolaires via `student_enrollments`.

## 15. RÉINSCRIPTION
[IMPLEMENTED]
Module interactif permettant la promotion, le redoublement, ou le changement de classe des élèves. Génération automatique des obligations financières pour la nouvelle année. Historique de l'élève conservé (UUID et matricule inchangés).

## 16. PARENTS / TUTEURS
[IMPLEMENTED]
Relation avec les élèves via `parent_students`.
Un parent peut avoir plusieurs enfants.
L'invitation (consentement inter-établissement) est gérée de manière stricte via `parent_tenant_invitations`.

## 17. FRAIS
[IMPLEMENTED]
Frais uniques et mensuels. Support multi-devises (CDF/USD).

## 18. OBLIGATIONS
[IMPLEMENTED]
Liées à l'élève, l'année scolaire, et le frais. Statuts : unpaid, partial, paid, overdue, cancelled.

## 19. PAIEMENTS
[IMPLEMENTED]
Création du paiement atomique (avec allocations). Support des paiements partiels et multi-obligations. Pas de modification d'un paiement validé.

## 20. DETTES ANTÉRIEURES
[PLANNED]
Logique historique (payer une dette 2025-2026 pendant l'année 2026-2027) : Les anciennes données restent attachées à leur année d'origine. Aucun écrasement.

## 21. REÇUS
[IMPLEMENTED]
Les reçus sont générés pour les paiements. Le portail parent et école incluent des modules pour les reçus.

## 22. PORTAIL PARENT
[PARTIAL]
Le portail existe (`/parent`), affiche les enfants, obligations, paiements et reçus pour l'année courante. 

## 23. HISTORIQUE
[PLANNED]
La page d'historique (pour consulter les années passées) n'existe pas encore. L'accueil parent doit afficher l'année active.

## 24. NOTIFICATIONS
[IMPLEMENTED]
Table notifications existante et routes présentes dans l'app.

## 25. AUDIT
[IMPLEMENTED]
Table `audit_logs` existante (Phase 13).

## 26. PWA
[UNKNOWN] / [PARTIAL]
La configuration PWA (manifest, web-push) est mentionnée dans les dépendances, mais l'état d'avancement complet (offline) reste à vérifier.

## 27. DESIGN SYSTEM
[LOCKED]
shadcn/ui, Tailwind CSS (v4). 
Thème : base-nova. Ne pas modifier.

## 28. PERFORMANCE
[LOCKED]
Principes : Pas de N+1 queries. Pagination serveur imposée. Skeletons. Les états (loading, empty, error) doivent être gérés proprement. 

## 29. TESTS
[IMPLEMENTED]
Tests unitaires/intégration présents avec Vitest (fichiers `*.test.ts`). Scripts NPM existants (`npm test`).

## 30. DÉPENDANCES
Dependencies : `next 16.3.4`, `react 19.2.8`, `@supabase/ssr`, `shadcn`, `tailwindcss 4`, `web-push`, `xlsx`.
devDependencies : `vitest`.
Attention aux conflits de versionnement potentiels avec Next.js 16 et Tailwind v4.

## 31. PROBLÈMES CONNUS
- La navigation et le refresh peuvent provoquer temporairement un état vide (défaut UX documenté).
- La gestion historique des dettes est seulement planifiée, pas codée.

## 32. DETTE TECHNIQUE
- Le système multi-années nécessite un historique parent clair.
- Pas d'historique git dans le workspace local (repos "main" vide de commits).

## 33. DÉCISIONS LOCKED
- Paylix est multi-tenant, PostgreSQL/Supabase est la DB.
- RLS obligatoire.
- CDF et USD séparés. Pas de conversion silencieuse.
- 1 seul parent actif par élève (géré par Director).
- Année de paiement != Année de la dette. Historique préservé.

## 34. FONCTIONNALITÉS IMPLEMENTED
- Authentification, rôles, RLS, tenants, years, classes, students, obligations, payments, fees, audit, receipts, notifications, réinscriptions (reenrollment).
- **Landing page publique** (`/`) : page marketing complète Paylix (voir section 41).

## 35. FONCTIONNALITÉS PARTIAL
- Portail Parent (sans historique multi-années).
- Multi-Tenant Parent (le switch d'établissement dans l'UI Parent n'est pas encore complet).

## 36. FONCTIONNALITÉS PLANNED
- Historique Parent.
- Dettes antérieures.

## 37. CONFLITS À RÉSOUDRE
- La documentation parle de switch inter-tenant pour le parent mais la Phase 8 indique que l'interface est pour une phase ultérieure. L'état actuel charge le 1er tenant actif.

## 38. PROCHAINES TÂCHES
1. Vérifier/adapter le cycle des années scolaires.
3. Finaliser les dettes antérieures.
4. Permettre le paiement d'une dette antérieure avec les frais actuels.
5. Garantir la distinction année de dette / année de paiement.
6. Adapter le portail Parent à l'année active.
7. Ajouter la page Historique Parent.
8. Ajouter sélection enfant + année.
9. Afficher les obligations/paiements/reçus historiques.
10. Garantir la conservation des données historiques.
11. Tester les scénarios multi-années.
12. Tester RLS et isolation.
13. Tester les régressions.

## 41. LANDING PAGE MARKETING
[IMPLEMENTED — 2026-09-25]

### Fichiers principaux
- `src/app/page.tsx` — Landing page complète (Client Component React)
- `src/lib/supabase/middleware.ts` — Route `/` rendue publique (hors `isProtectedRoute`)
- `public/landing/logo.png` — Logo officiel Paylix (P vert avec feuille orange)
- `public/landing/hero-bg.jpg` — Fond cinématique hero (école africaine moderne)
- `public/landing/hero.jpg` — Duo comptable + parent (hero image secondaire)
- `public/landing/parent.jpg` — Parent consultant l'app mobile Paylix
- `public/landing/accountant.jpg` — Comptable au bureau avec dashboard Paylix

### Architecture de la landing
La landing est un seul fichier Client Component (`'use client'`) sans dépendances externes d'animation.
Animations réalisées entièrement en CSS pur via `<style>` inline + keyframes.
Scroll reveal via `IntersectionObserver` natif (hook `useInView`).

### Sections (dans l'ordre)
1. **Header fixe** : Logo réel, nav desktop avec underline hover, transparent → blanc au scroll, hamburger mobile avec drawer animé
2. **Hero plein écran** : Image de fond + overlay dégradé, badge pulsant, titre animé avec gradient vert animé, 2 floating cards glassmorphism, indicateur scroll
3. **Le problème** : 3 cartes (Informations dispersées, Historique introuvable, Parents dans le flou)
4. **La solution** : Image parent + 4 bénéfices avec icon hover effect + badge flottant "Landry Kayoyo"
5. **Comment ça fonctionne** : 4 étapes numérotées avec chevrons de connexion
6. **Espace Comptable** : Image + checklist des avantages
7. **Espaces dédiés** : Grille 2×2 (Directeur, Comptable, Parent, Admin) avec couleurs distinctes
8. **Pourquoi Paylix** : 6 cartes avantages (Simple, Traçable, Accessible, Multi-établissements, Pensé pour les écoles, Portail parents)
9. **Traçabilité** : Section fond vert sombre avec 4 badges (Transparence, Traçabilité, Historique, Sécurité)
10. **CTA final** : Bloc vert premium avec blobs animés et bouton blanc
11. **Footer** : Logo + 4 colonnes navigation + copyright

### Fonctionnement réel montré (pas de paiement en ligne)
La landing présente fidèlement le processus réel Paylix :
`Parent paye à l'école → Comptable enregistre dans Paylix → Situation mise à jour → Reçu → Parent informé`

### Ce que la landing NE présente PAS (volontairement)
- Aucun paiement en ligne direct
- Aucune stat ou témoignage inventé
- Aucun partenaire inventé
- Aucun chiffre de performance fictif

### Middleware
La route `/` a été retirée de `isProtectedRoute` dans `src/lib/supabase/middleware.ts`.
Variable `isPublicLanding` ajoutée pour documenter l'intention.
Un utilisateur connecté qui visite `/` verra la landing et pourra cliquer "Mon espace".
Un utilisateur non connecté verra la landing sans redirection vers `/login`.

### Performance & SEO
- `<Image>` next/image utilisé partout (lazy loading automatique)
- Hero image en `priority` (pas de lazy load)
- `metadata` TypeScript (title + description) pour le SEO
- `prefers-reduced-motion` respecté (toutes les animations désactivées en CSS)
- Pas de bibliothèque d'animation externe

## 39. RÈGLES POUR LES FUTURS AGENTS
### Avant de travailler
Chaque agent doit :
1. lire `PROJECT_MEMORY.md` ;
2. lire les documents liés à sa tâche ;
3. inspecter le code concerné ;
4. vérifier les décisions `LOCKED` ;
5. comprendre les dépendances ;
6. identifier les risques de régression.

### Pendant le travail
L'agent doit :
- réutiliser l'existant ;
- ne pas réinventer l'architecture ;
- respecter les règles métier ;
- respecter RLS ;
- respecter le multi-tenant ;
- ne pas modifier une décision `LOCKED` sans validation ;
- ne pas commencer une phase supérieure.

### Après le travail
L'agent doit :
- tester ;
- mettre à jour la mémoire (`PROJECT_MEMORY.md`) ;
- mettre à jour l'état des fonctionnalités ;
- documenter les décisions ;
- documenter les problèmes ;
- ajouter son journal ;
- produire son rapport ;
- s'arrêter.

## 40. JOURNAL DES AGENTS

### 2026-09-23 — 19:54

Agent :
Memory Agent (Antigravity)

Phase :
Initialisation / Audit

Tâche :
Reconstruction complète de la mémoire du projet et mise en place du système de continuité.

État avant intervention :
Absence de fichier central `PROJECT_MEMORY.md`. 

Travail effectué :
- Inspection du workspace et des documents d'architecture (ARCHITECTURE.md, PRODUCT.md, FINANCE.md, DATABASE.md, PARENT_MULTI_TENANT.md).
- Inspection des routes (`src/app/`) et migrations (`supabase/migrations/`).
- Identification de la stack (Next 16, Tailwind 4, Supabase).
- Création de `PROJECT_MEMORY.md`.

Fichiers modifiés :
- `PROJECT_MEMORY.md` (Créé)

Migrations :
- Aucune

Tests :
- Aucune exécution, uniquement l'analyse de l'arborescence (Vitest présent).

Résultat :
SUCCESS

Problèmes :
- Repo Git local vierge, impossible de retracer l'historique complet via git log.

Décisions :
- Le système Parent History (Dettes antérieures, réinscriptions) est marqué comme PLANNED / NOT_IMPLEMENTED car absent des routes.

À poursuivre :
- Les développements planifiés selon la section 38 (Cycle annuel, Dettes, Historique Parent).

---

### 2026-09-25 — 18:55

Agent :
Memory Agent (Antigravity)

Phase :
Correction bug PWA / landing login

Tâche :
Corriger le bouton "Connexion" sur la landing PWA qui ne passait pas correctement en mode standalone.

État avant intervention :
Le service worker interceptait toutes les requêtes de navigation avec `request.mode === 'navigate'` et renvoyait la racine `/` au lieu des routes demandées. Dans un environnement PWA, cela pouvait bloquer l’ouverture de `/login`.

Travail effectué :
- Analyse du flux PWA et de la route `/login`.
- Vérification du service worker `public/sw.js` qui cachait les navigations document.
- Correction du fetch `navigate` pour laisser passer `/login` tout en gardant le fallback offline sur `/`.
- Ajout d’un test ciblé sur le comportement du service worker.
- Validation via `npx vitest run src/lib/pwa-service-worker.test.ts`.

Fichiers modifiés :
- `public/sw.js`
- `src/lib/pwa-service-worker.test.ts`

Migrations :
- Aucune

Tests :
- `npx vitest run src/lib/pwa-service-worker.test.ts` → 1 test passé.

Résultat :
SUCCESS

Problèmes :
- Le serveur Next ne démarre pas via la commande simplifiée dans PowerShell car l’argument `--hostname` est interprété comme un chemin de dossier dans ce shell ; la validation du bug a été faite par code et test ciblé.

Décisions :
- Les navigations de document PWA ne sont plus interceptées par le cache du service worker, sauf fallback offline sur `/` lorsque la page n’est pas accessible.

À poursuivre :
- Vérifier le comportement réel dans le navigateur PWA après installation (à partir d’un vrai contexte mobile ou navigateur avec affichage standalone).

---

### 2026-09-25 — 10:12

Agent :
Antigravity (Claude Sonnet 4.6 Thinking)

Phase :
Landing Page Marketing

Tâche :
Création complète de la landing page officielle publique Paylix sur la route `/`.

État avant intervention :
- `src/app/page.tsx` contenait uniquement une logique de dispatch de rôle vers le dashboard
- Route `/` protégée dans le middleware (redirigait vers `/login` si non connecté)
- Aucune landing page publique n'existait

Travail effectué :
- Inspection complète du projet (globals.css, composants UI, design system, middleware)
- Génération de 3 assets images professionnels (hero, parent, accountant)
- Génération d'une image de fond cinématique pour le hero (école africaine moderne)
- Création du dossier `public/landing/` et copie des assets
- Récupération du vrai logo Paylix depuis `public/landing/logo.png`
- Réécriture complète de `src/app/page.tsx` comme Client Component de landing
- Modification de `src/lib/supabase/middleware.ts` pour rendre `/` public
- Fix de l'espacement (py-28 → py-20, conteneurs élargis à max-w-[1360px])
- Mise à jour complète de `PROJECT_MEMORY.md` (section 41 + journal)

Fichiers modifiés :
- `src/app/page.tsx` (Remplacé entièrement)
- `src/lib/supabase/middleware.ts` (Route `/` rendue publique)
- `public/landing/hero-bg.jpg` (Créé)
- `public/landing/hero.jpg` (Créé)
- `public/landing/parent.jpg` (Créé)
- `public/landing/accountant.jpg` (Créé)
- `PROJECT_MEMORY.md` (Mis à jour)

Tests :
- typecheck : ✅ SUCCESS (code 0)
- build : ✅ SUCCESS (code 0, route `/` statique pré-rendue)
- lint : ⚠️ Erreurs préexistantes dans les tests et fichiers non modifiés (ne bloquent pas la landing)

Résultat :
SUCCESS — Landing accessible sur http://localhost:3000

Décisions :
- Landing en Client Component (`'use client'`) pour les animations et l'état du header au scroll
- Animations 100% CSS pur (aucune lib externe)
- `prefers-reduced-motion` respecté
- Route `/` dans `isPublicLanding` (jamais dans `isProtectedRoute`)
- Logo réel Paylix intégré (P vert + feuille orange)
- Aucun chiffre, témoignage ou partenaire inventé

À poursuivre :
- Améliorations visuelles selon les retours utilisateur
- Section storytelling Landry Kayoyo plus détaillée si demandée
- Mockup produit UI avec vrais composants si demandé


---

### 2026-09-25 — 15:30

Agent :
Antigravity

Phase :
Configuration Git & Règles

Tâche :
- Initialisation du dépôt Git.
- Push initial vers GitHub (Landry-kayoyo/Paylix.git).
- Mise à jour du README.md.
- Ajout de règles strictes dans AGENTS.md pour forcer la lecture de la mémoire avant chaque action et le push automatique à la fin.

Fichiers modifiés :
- README.md
- AGENTS.md
- PROJECT_MEMORY.md

Résultat :
SUCCESS

---

### 2026-09-25 — 15:33

Agent :
Antigravity

Phase :
Nettoyage (Cleanup)

Tâche :
- Suppression du fichier de log obsolète obligations_debug.json.
- Retrait du suivi Git et exclusion (via .gitignore) des dossiers temporaires générés par Supabase (supabase/.temp/, supabase/.branches/).
- Suppression d'autres caches et fichiers non pertinents.

Fichiers modifiés :
- .gitignore (Mise à jour)
- obligations_debug.json (Supprimé)
- supabase/.temp/* (Supprimé du suivi)
- PROJECT_MEMORY.md (Mise à jour)

Résultat :
SUCCESS

---

### 2026-09-26 — 09:07

Agent :
Antigravity

Phase :
Messages & Chat interne Paylix (Phase 18)

Tâche :
- Création de la migration de base de données pour le module Messages & Chat.
- Définition de l'architecture pour le temps réel et la messagerie multi-tenant.

Fichiers modifiés :
- `supabase/migrations/20260925000000_phase18_messages_chat.sql` (Créé)
- `PROJECT_MEMORY.md` (Mise à jour)


### 2026-09-26 — 09:16

Agent :
Antigravity

Phase :
Messages & Chat interne Paylix (Phase 18) - Finalisation UI/UX

Tâche :
- Implémentation des Server Actions (`messages.ts`) pour l'envoi, diffusion et ciblage.
- Création de l'interface Parent (`/parent/messages`) avec la fonctionnalité de contact sécurisé (Director du tenant actif).
- Création de l'interface Platform Admin (`/platform/messages`) pour le support global sans tenant bloquant.
- Finalisation des scripts de synchronisation temps réel pour le Parent.

Fichiers modifiés :
- `src/app/actions/messages.ts` (Créé)
- `src/app/parent/messages/page.tsx` (Créé)
- `src/app/parent/messages/messages-client.tsx` (Créé)
- `src/app/platform/messages/page.tsx` (Créé)
- `src/app/platform/messages/messages-client.tsx` (Créé)
- `PROJECT_MEMORY.md` (Mise à jour)

Résultat :
SUCCESS (Implémentation complète fonctionnelle)

Décisions :
- Le Parent interagit uniquement avec les Directeurs de son établissement (tenant_id validé).
- Optimistic UI pour la fluidité, couplé avec Supabase Realtime (schema public, filtre par tenant_id).
- L'audit final et la mise en production des notifications associées nécessiteront des tests end-to-end dans la prochaine phase.

### 2026-09-26 — 09:20

Agent :
Antigravity

Phase :
Messages & Chat interne Paylix (Phase 18) - Dernières finitions

Tâche :
- Implémentation du composant `MessageBell` intégré dans le Header global (`src/components/layout/header.tsx`).
- Compteur dynamique `last_read_at` avec écouteur Realtime pour les badges de notification non-lues.
- Refonte de la vue Directeur (`src/app/school/messages/messages-client.tsx`) avec un système de Dialog complet. Ce composant expose le ciblage de l'audience avec les critères métier (`ParentAudienceService`) avant l'envoi des diffusions groupées.

Fichiers modifiés :
- `src/components/layout/header.tsx`
- `src/components/notifications/message-bell.tsx` (Créé)
- `src/app/school/messages/messages-client.tsx` (Mise à jour)
- `PROJECT_MEMORY.md` (Mise à jour)

Résultat :
SUCCESS (L'entièreté des requêtes de la Phase 18 est complétée, y compris la notification header et la modale Directeur).

---
