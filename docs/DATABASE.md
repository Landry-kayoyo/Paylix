# 🗄 Modèle de Données Officiel

Ce document décrit avec précision les tables prévues pour la base de données PostgreSQL de Paylix.

*Règle : Il n'y a pas de table `sections` dans Paylix. Ne pas en créer une.*

## 1. `tenants`
* **Rôle** : Établissements scolaires (isolation de base).
* **Colonnes** :
  * `id` (UUID, PK)
  * `name`
  * `slug`
  * `code`
  * `logo_url`
  * `email`
  * `phone`
  * `address`
  * `city`
  * `country`
  * `status`
  * `created_at`
  * `updated_at`

## 2. `profiles`
* **Rôle** : Profil global de l'utilisateur lié à Supabase Auth.
* **Colonnes** :
  * `id` (UUID, PK → FK vers `auth.users.id`)
  * `first_name`
  * `last_name`
  * `post_name`
  * `phone`
  * `avatar_url`
  * `status`
  * `created_at`
  * `updated_at`

## 3. `user_memberships`
* **Rôle** : Détermine l'appartenance d'un utilisateur à un tenant et son rôle.
* **Colonnes** :
  * `id` (UUID, PK)
  * `user_id` (FK)
  * `tenant_id` (FK)
  * `role`
  * `status`
  * `created_at`
  * `updated_at`

## 4. `school_years`
* **Rôle** : Années scolaires (Une seule active recommandée par établissement).
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `name`
  * `start_date`
  * `end_date`
  * `status`
  * `created_at`
  * `updated_at`

## 5. `classes`
* **Rôle** : Les classes de l'école (ex: 7e Scientifique).
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `school_year_id` (FK)
  * `name`
  * `code`
  * `status`
  * `created_at`
  * `updated_at`

## 6. `students`
* **Rôle** : Les élèves.
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `school_year_id` (FK)
  * `class_id` (FK)
  * `matricule` (Généré automatiquement, unique dans le tenant)
  * `first_name`
  * `post_name`
  * `last_name`
  * `date_of_birth`
  * `gender`
  * `status`
  * `created_at`
  * `updated_at`

## 7. `parents`
* **Rôle** : Parents d'élèves (crée un compte utilisateur).
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `user_id` (FK)
  * `first_name`
  * `post_name`
  * `last_name`
  * `phone`
  * `email`
  * `address`
  * `status`
  * `created_at`
  * `updated_at`

## 8. `parent_students`
* **Rôle** : Table de jointure entre parents et enfants.
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `parent_id` (FK)
  * `student_id` (FK)
  * `relationship`
  * `is_primary`
  * `created_at`

## 9. `accountants`
* **Rôle** : Comptables de l'établissement.
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `user_id` (FK)
  * `employee_code`
  * `phone`
  * `status`
  * `created_at`
  * `updated_at`

## 10. `fees`
* **Rôle** : Types de frais existants.
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `school_year_id` (FK)
  * `name`
  * `description`
  * `fee_type` (unique, monthly)
  * `status`
  * `created_at`
  * `updated_at`

## 11. `fee_schedules`
* **Rôle** : Échéances pour les frais mensuels (Mois individuels, ne pas utiliser start/end date).
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `fee_id` (FK)
  * `month`
  * `amount`
  * `currency`
  * `due_date`
  * `status`
  * `created_at`
  * `updated_at`

## 12. `fee_classes`
* **Rôle** : Jointure frais et classes associées.
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `fee_id` (FK)
  * `class_id` (FK)
  * `created_at`

## 13. `financial_obligations`
* **Rôle** : Ce que doit payer un élève (Statuts: unpaid, partial, paid, overdue, cancelled).
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `school_year_id` (FK)
  * `student_id` (FK)
  * `fee_id` (FK)
  * `fee_schedule_id` (FK, nullable)
  * `amount_due`
  * `currency`
  * `due_date`
  * `status`
  * `created_at`
  * `updated_at`

## 14. `payment_methods`
* **Rôle** : Méthodes de paiement (espèces, banque, mobile...).
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `name`
  * `code`
  * `status`
  * `created_at`
  * `updated_at`

## 15. `payments`
* **Rôle** : Les paiements reçus (Statuts: confirmed, cancelled, reversed).
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `school_year_id` (FK)
  * `student_id` (FK)
  * `amount`
  * `currency`
  * `payment_date`
  * `payment_method_id` (FK)
  * `reference`
  * `notes`
  * `recorded_by` (FK)
  * `status`
  * `created_at`
  * `updated_at`

## 16. `payment_allocations`
* **Rôle** : Obligatoire pour gérer la répartition d'un paiement sur plusieurs obligations ou paiements partiels.
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `payment_id` (FK)
  * `obligation_id` (FK)
  * `amount`
  * `created_at`

## 17. `receipts`
* **Rôle** : Les reçus générés.
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `payment_id` (FK)
  * `receipt_number` (Unique dans le tenant)
  * `pdf_path`
  * `issued_at`
  * `created_at`

## 18. `notifications`
* **Rôle** : Notifications utilisateurs.
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (FK)
  * `user_id` (FK)
  * `type`
  * `title`
  * `message`
  * `data` (JSONB)
  * `read_at`
  * `created_at`

## 19. `audit_logs`
* **Rôle** : Traçabilité et historique.
* **Colonnes** :
  * `id` (UUID, PK)
  * `tenant_id` (nullable)
  * `actor_user_id` (nullable)
  * `action`
  * `resource_type`
  * `resource_id`
  * `result`
  * `metadata` (JSONB)
  * `ip_address`
  * `user_agent`
  * `created_at`

## 20. `activation_tokens`
* **Rôle** : Activation des comptes parents (lien sécurisé).
* **Colonnes** :
  * `id` (UUID, PK)
  * `user_id` (FK)
  * `token_hash` (Ne jamais stocker le token brut en base)
  * `expires_at`
  * `used_at`
  * `created_at`

## Relations Principales

```text
tenant
 ├── school_years
 │     └── classes
 │           └── students
 │
 ├── parents
 │     └── parent_students
 │             └── students
 │
 ├── accountants
 │
 ├── fees
 │     ├── fee_schedules
 │     └── fee_classes
 │
 ├── financial_obligations
 │
 ├── payments
 │     └── payment_allocations
 │
 ├── receipts
 │
 ├── notifications
 │
 └── audit_logs
```

Relation Auth : `auth.users` → `profiles` → `user_memberships` → `tenant + role`.
