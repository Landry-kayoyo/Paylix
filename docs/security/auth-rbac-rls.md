# Architecture Authentification, RBAC et RLS

Ce document détaille l'implémentation de la Phase 3 concernant l'authentification et l'isolation des données dans Paylix.

## 1. Authentification (Supabase SSR)

Paylix utilise `@supabase/ssr` avec le App Router de Next.js.
- **Client Supabase** : 
  - `src/lib/supabase/client.ts` pour les composants côté client.
  - `src/lib/supabase/server.ts` pour les Server Components et Server Actions.
- **Gestion de Session** :
  - `src/lib/supabase/middleware.ts` est utilisé par le `middleware.ts` à la racine pour rafraîchir le jeton d'authentification (`updateSession`) de manière transparente.
- **Protection des Routes** :
  - Le middleware vérifie si l'utilisateur est authentifié pour les routes protégées (`/platform`, `/school`, `/accountant`, `/parent`). Si non, il redirige vers `/login`.
  - Inversement, il redirige les utilisateurs déjà connectés de `/login` vers `/` (qui routera par la suite vers l'espace approprié selon le rôle).

## 2. Modèle Multi-Tenant

L'application est fondamentalement isolée par `tenant_id` (l'établissement scolaire).
L'appartenance d'un utilisateur à un tenant est définie par la table `user_memberships`.
- Structure : `Profiles` -> `user_memberships` -> `Tenants`

## 3. Rôles (RBAC)

Les rôles officiels sont définis par l'enum `user_role` dans PostgreSQL :
- `platform_admin` : Accès global à tous les tenants et à toutes les données.
- `director` : Gestionnaire principal d'un tenant. Peut modifier les paramètres, les classes, les élèves et les frais.
- `accountant` : Rôle financier d'un tenant. Accès en lecture aux élèves, et accès en écriture aux obligations financières et paiements.
- `parent` : Rôle client. Accès en lecture uniquement aux données de **ses propres enfants**.

## 4. Row Level Security (RLS)

Toutes les tables (20 au total) ont la sécurité au niveau des lignes activée (`ENABLE ROW LEVEL SECURITY`).
Les accès sont gérés par des politiques explicites pour `SELECT`, `INSERT`, `UPDATE`, et `DELETE`.

### Contournement de la Récursion
La table `user_memberships` pointant vers `tenants`, une vérification naïve créerait une boucle de récursion.
Nous avons implémenté une fonction `SECURITY DEFINER` :
```sql
CREATE FUNCTION public.get_user_memberships()
RETURNS TABLE (tenant_id UUID, role user_role)
```
Cette fonction permet de récupérer les rôles et tenants de l'utilisateur de manière sécurisée et performante.

### Politiques Critiques : Cas du Parent
Le parent ne peut voir un élève que si une ligne existe dans `parent_students` reliant son ID `parent` à cet `student_id`.
```sql
CREATE POLICY "Parents can view own students" ON students FOR SELECT USING (
  id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
);
```
Il en va de même pour les `financial_obligations`, `payments`, `payment_allocations` et `receipts`.

## 5. Procédure de Test

Les tests de sécurité RLS sont définis via le framework **Vitest** dans le fichier `tests/rls.test.ts`.
Ils peuvent être exécutés avec :
```bash
npm run test
```
Ces tests utilisent le client Supabase standard et s'appuient sur l'isolation des identités pour s'assurer qu'un accès non autorisé (via Supabase ou API) est bien bloqué par la base de données.
