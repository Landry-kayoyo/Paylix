# Phase 14A : Paramètres & Gestion Sécurisée des Comptes

## Objectifs
- Gestion sécurisée du profil utilisateur (Nom, Prénom, Téléphone, etc.).
- Modification de l'adresse e-mail et du mot de passe via Supabase Auth.
- Upload de la photo de profil (Avatar) dans un bucket privé.
- Paramètres globaux de la plateforme (Super Admin).
- Paramètres de l'établissement (Directeur) incluant l'upload de logos, signatures et cachets.

## Structure de la base de données
- Création de la table `platform_settings` (key, value) pour stocker les configurations générales de la plateforme (par ex. `platform_info`, `global_preferences`).
- Ajout de colonnes à la table `tenants` pour la personnalisation des reçus et des identités visuelles : `short_name`, `receipt_footer_text`, `receipt_signature_url`, `receipt_stamp_url`.
- Création des buckets Supabase Storage :
  - `profile-images` (Privé) : Stockage des avatars des utilisateurs.
  - `tenant-assets` (Public) : Stockage des logos, signatures, et cachets des établissements.

## Actions Serveur
Les actions serveur sont réparties en fonction des domaines :
- `src/app/actions/account.ts` : Gestion du profil (nom, email, mot de passe) et de l'avatar.
- `src/app/platform/settings/actions.ts` : Sauvegarde et récupération des paramètres de la plateforme (réservé au `platform_admin`).
- `src/app/school/settings/actions.ts` : Sauvegarde et récupération des paramètres de l'établissement (réservé au `director`).

## Composants Interface
- `AvatarUpload` (`src/components/shared/avatar-upload.tsx`) : Upload sécurisé de la photo de profil.
- `AssetUpload` (`src/components/shared/asset-upload.tsx`) : Upload des logos, signatures et cachets pour l'établissement.
- Formulaires de mise à jour :
  - `UpdateProfileForm` : Formulaire de mise à jour des informations personnelles.
  - `ChangePasswordForm` : Changement sécurisé du mot de passe.
  - `PlatformSettingsForm` : Configuration générale pour le Super Admin.
  - `SchoolSettingsForm` : Configuration de l'école pour le Directeur.

## Sécurité & RLS
- Les utilisateurs ne peuvent modifier que leur propre profil et uploader dans leur propre dossier `profile-images/{user_id}/`.
- Les modifications de mot de passe passent par `supabase.auth.updateUser` sans jamais transiter en clair dans les logs d'audit.
- Les actions nécessitant le rôle `platform_admin` ou `director` sont protégées par une vérification stricte côté serveur avec `user_memberships`.
- Toutes les actions de mise à jour et d'upload génèrent une entrée dans le journal d'audit (`audit_logs`) sans exposer de données sensibles.

## Audit Logs
Les nouveaux types d'action d'audit suivants ont été intégrés :
- `PROFILE_UPDATED`
- `PROFILE_EMAIL_CHANGED`
- `PROFILE_PASSWORD_CHANGED`
- `PROFILE_AVATAR_UPLOADED`
- `PROFILE_AVATAR_DELETED`
- `TENANT_SETTINGS_UPDATED`
- `TENANT_ASSET_UPLOADED`
- `PLATFORM_SETTINGS_UPDATED`

## Navigation & Middleware
- Ajout de la route `/account` accessible à tous les rôles authentifiés.
- Le profil de l'utilisateur connecté est désormais affiché dynamiquement dans le composant `Header`.
