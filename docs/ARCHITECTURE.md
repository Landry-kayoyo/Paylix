# 🏗 Architecture Technique de Paylix

## Stack Technologique Officielle
La stack retenue et verrouillée pour Paylix est :
* **Framework** : Next.js (App Router), React, TypeScript
* **UI/CSS** : Tailwind CSS, shadcn/ui
* **Base de données & Backend-as-a-Service** : Supabase, PostgreSQL
* **Authentification** : Supabase Auth
* **Stockage** : Supabase Storage
* **Formulaires & Validation** : React Hook Form, Zod
* **Hébergement** : Vercel
* **Client** : PWA (Progressive Web App)

*Règle absolue : L'application sera conçue comme une application Next.js full-stack. Ne pas créer de backend Django séparé. Ne pas créer de backend Express séparé. Ne pas remplacer Supabase. Ne rajouter aucune dépendance sans justification absolue.*

## Architecture Générale
Paylix est une architecture "Backendless" (BaaS) couplée à un framework Full-stack (Next.js). La sécurité repose massivement sur la base de données PostgreSQL via les RLS (Row Level Security).

## Espaces Utilisateurs (App Router)
Next.js App Router permet d'organiser les routes avec des dossiers et des `layout.tsx`, séparant clairement les espaces utilisateurs sans reconstruire inutilement les layouts partagés.

1. **Admin SaaS (`/platform/`)**
   - Vues : dashboard, schools, users, activity, audit, settings
2. **Directeur (`/school/`)**
   - Vues : dashboard, students, parents, accountants, classes, school-years, fees, obligations, payments, receipts, reports, notifications, settings
3. **Comptable (`/accountant/`)**
   - Vues : dashboard, students, obligations, payments, receipts, history, overdue, reports, notifications, profile
4. **Parent (`/parent/`)**
   - Vues : dashboard, children, payments, receipts, notifications, profile

## Séparation Frontend / Backend Logique
L'arborescence standard :
```text
src/
├── app/          # Routes, pages, et Server Components par espace utilisateur
├── components/   # Composants UI partagés, composants shadcn
├── lib/          # Utilitaires, clients Supabase, configuration
└── types/        # Schémas Zod, types TypeScript
```

## Performance & UX
La performance est une priorité majeure de Paylix :
* Éviter absolument les requêtes inutiles, les appels réseau redondants et les N+1 queries.
* Imposer la pagination et la recherche côté serveur pour les grands ensembles de données.
* Toute liste de données affichée dans le système doit exposer une pagination réutilisable, même si elle fonctionne en local ou en appel de serveur.
* Le composant partagé de pagination doit être utilisé comme convention systématique sur les vues de listes, listes d’élèves, listes de classes, listes de parents, listes de paiements, listes de notifications et toutes autres tables de données.
* Toute action de rafraîchissement ou de reload doit passer par un composant partagé de refresh afin d’unifier l’expérience UX.
* Utilisation des index adaptés en base de données.
* Privilégier les Server Components pour les pages principalement en lecture.
* JavaScript client limité au nécessaire.
* TanStack Query ne doit être utilisé que lorsqu'il apporte une vraie valeur.
* **Gestion du cache** : Cache maîtrisé, invalidation contrôlée, pas de refetch inutile.

### Problème critique : Les données qui disparaissent
Une actualisation ne doit jamais donner l'impression que les données ont été supprimées temporairement (écran vide → "aucune donnée" → chargement → réapparition).
**Exigences :**
* Bootstrap stable et session stable.
* Gestion correcte et cohérente des états (distinction claire entre `loading`, `empty` et `error`).
* Utilisation de skeletons lors du chargement initial ou partiel.
* Le système doit être perçu comme fluide et stable.

## Évolutivité & Multi-Tenant
L'architecture est construite autour de l'isolation des tenants (les écoles). Le backend logique et la base de données doivent concevoir chaque requête en injectant implicitement ou explicitement le contexte du tenant actuel pour garantir l'étanchéité des données.
