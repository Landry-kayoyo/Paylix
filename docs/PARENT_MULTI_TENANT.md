# RÈGLE : Compte Parent Multi-Établissement

> **Statut** : Règle de sécurité fondamentale — Phase 7  
> **Domaine** : Authentification, Isolation tenant, UX Parent  
> **Auteur** : Implémentation Phase 7 — Septembre 2026

---

## 1. Principe fondamental

Un parent peut avoir des enfants dans **plusieurs établissements** différents utilisant Paylix.

**Règle absolue** : **1 compte Supabase Auth = 1 seul utilisateur**, identifié par son adresse email. Un parent ne doit jamais avoir deux comptes Auth distincts, même s'il est inscrit dans N établissements différents.

```
parent@exemple.com  ──→  1 compte auth.users  ──→  N memberships (1 par établissement)
                                                      ├── Établissement A (parent, active)
                                                      ├── Établissement B (parent, active)
                                                      └── Établissement C (parent, pending)
```

---

## 2. Le problème de sécurité : le consentement

Lorsque l'établissement B enregistre un parent dont l'email existe déjà (il est déjà inscrit dans l'établissement A), **il ne faut PAS automatiquement lui donner accès à l'établissement B**.

### Pourquoi ?

- **Isolation des données** : un parent ne doit pas accéder à un établissement sans y avoir explicitement consenti.
- **Protection contre les erreurs** : un directeur pourrait enregistrer le mauvais email.
- **Confiance** : le parent doit savoir exactement à quels établissements son compte donne accès.
- **RGPD** : le consentement explicite est requis avant tout accès aux données d'un établissement.

---

## 3. Flux standard (email inconnu)

```
Directeur crée un parent (email inconnu)
        │
        ▼
Supabase Auth : inviteUserByEmail()
        │   → crée le compte auth.users
        │   → envoie un email d'invitation standard
        ▼
Membership créé IMMÉDIATEMENT (status: active)
        │
        ▼
Parent clique le lien → définit son mot de passe → accède à /parent
```

**Résultat** : `account_status = 'invited'` → après connexion → `'active'`

---

## 4. Flux multi-établissement (email déjà connu) — RÈGLE CRITIQUE

```
Directeur crée un parent (email DÉJÀ dans auth.users)
        │
        ▼
Détection : cet email appartient à un compte existant
        │   (dans un autre établissement)
        │
        ▼
NE PAS donner accès automatiquement.
        │
        ▼
Créer parent record (account_status: 'invited')
        +
Créer parent_tenant_invitations { token, expires_at: +7j, status: 'pending' }
        │
        ▼
Afficher au directeur : lien de consentement sécurisé
        │   → le directeur transmet ce lien au parent
        │     (email, WhatsApp, SMS…)
        │
        ▼
Parent clique le lien → /parent/join?token=...
        │
        ├── Non connecté → affiché l'invite, puis redirigé vers /login
        │                  (avec next=/parent/join?token=...)
        │
        └── Connecté (bon compte) → page de consentement explicite
                │
                ├── Accepte ──→ user_memberships INSERT (status: active)
                │               account_status → 'active'
                │               invitation.status → 'accepted'
                │               → redirigé vers /parent (peut switcher)
                │
                └── Refuse ──→ account_status → 'inactive'
                                invitation.status → 'declined'
                                (pas d'accès accordé)
```

---

## 5. Schema DB impliqué

### Table `parent_tenant_invitations`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | L'établissement qui invite |
| `parent_id` | UUID | Le parent créé dans ce tenant |
| `auth_user_id` | UUID | L'utilisateur Auth existant |
| `token` | TEXT UNIQUE | Token sécurisé (32 bytes hex) |
| `status` | TEXT | `pending`, `accepted`, `declined`, `expired` |
| `invited_by` | UUID | Director qui a créé l'invitation |
| `expires_at` | TIMESTAMPTZ | Par défaut NOW() + 7 jours |
| `responded_at` | TIMESTAMPTZ | Quand le parent a répondu |

### Contrainte d'expiry

Les tokens expirent automatiquement après 7 jours. Le middleware vérifie l'expiry à chaque accès à `/parent/join?token=...`.

Le directeur peut réenvoyer une invitation depuis la fiche parent (`resendParentInvitation()`), ce qui crée un nouveau token.

---

## 6. RLS (Row Level Security)

| Acteur | Permission |
|--------|-----------|
| **Director** | Peut lire les invitations de son tenant |
| **Parent (invité)** | Peut lire ET mettre à jour sa propre invitation (via `auth_user_id = auth.uid()`) |
| **Autres** | Aucun accès |

L'acceptation/refus se fait côté serveur via une Server Action qui vérifie doublement que `auth_user_id = user.id` avant toute modification.

---

## 7. Expérience utilisateur

### Du côté du directeur

Lors de la création d'un parent avec un email existant, une notice claire apparaît dans le dialog :

```
┌─────────────────────────────────────────────────────────┐
│  ℹ️  Ce parent a déjà un compte Paylix                 │
│                                                         │
│  parent@exemple.com est lié à un compte existant dans  │
│  « École Primaire Saint-Jean ».                         │
│                                                         │
│  Prochaine étape — à communiquer au parent              │
│  ────────────────────────────────────────────────────   │
│  Pour des raisons de sécurité, son accès ne sera        │
│  activé qu'après son consentement explicite.            │
│                                                         │
│  Lien sécurisé :                                        │
│  https://app.paylix.com/parent/join?token=xxx...  [Copier]│
│                                                         │
│  ⚠️ Ce lien expire dans 7 jours.                      │
└─────────────────────────────────────────────────────────┘
```

### Du côté du parent

La page `/parent/join?token=...` affiche :

- Le nom de l'établissement qui invite
- Qui l'a inscrit (le directeur)
- L'enfant concerné
- La date d'expiration
- Une notice de sécurité claire sur ce qu'il autorise
- Deux boutons : **Autoriser l'accès** / **Refuser**

Si le parent n'est pas connecté → il est redirigé vers `/login?next=/parent/join?token=...`, puis revient sur la page de consentement après connexion.

---

## 8. Après acceptation : le switch d'établissement

Une fois que le parent a accepté une invitation d'un second établissement, son compte dispose de **N memberships actifs**. Son portail `/parent` doit :

1. Détecter tous les `user_memberships` actifs avec `role = 'parent'`
2. Charger les données du tenant actif (celui sélectionné)
3. Permettre de changer d'établissement (switcher)

> **Note Phase 8+** : L'interface de switch inter-établissement dans le portail parent est à implémenter dans une phase ultérieure. Aujourd'hui, le portail charge le premier établissement actif trouvé.

---

## 9. Règles immuables à ne jamais contourner

> [!CAUTION]
> **Ne jamais faire ceci :**
> - Appeler `user_memberships.insert()` directement lors de la création d'un parent à email existant sans avoir passé par le flux de consentement.
> - Appeler `auth.admin.inviteUserByEmail()` sur un email qui existe déjà — cela retourne une erreur Supabase et ne doit pas être tenté.
> - Supprimer un compte `auth.users` lorsqu'un parent est retiré d'un établissement — le compte peut appartenir à d'autres établissements.

> [!IMPORTANT]
> **À toujours vérifier :**
> 1. Avant `createParent()` : vérifier si l'email existe dans `auth.users` via `admin.listUsers()`.
> 2. Si oui : créer une `parent_tenant_invitations` et communiquer le lien au directeur.
> 3. Ne donner le membership que lors de l'`acceptCrossTenantInvitation()`.
> 4. Toujours vérifier `invitation.auth_user_id === auth.uid()` côté serveur avant d'activer.

---

## 10. Fichiers de référence

| Fichier | Rôle |
|---------|------|
| [`src/app/school/parents/actions.ts`](../src/app/school/parents/actions.ts) | `createParent()` — détection email + dispatch des deux flows |
| [`src/app/parent/join/actions.ts`](../src/app/parent/join/actions.ts) | `acceptCrossTenantInvitation()`, `declineCrossTenantInvitation()` |
| [`src/app/parent/join/page.tsx`](../src/app/parent/join/page.tsx) | Page de consentement (Server) |
| [`src/app/parent/join/consent-client.tsx`](../src/app/parent/join/consent-client.tsx) | UI de consentement (Client) |
| [`src/app/school/parents/create-parent-dialog.tsx`](../src/app/school/parents/create-parent-dialog.tsx) | Notice directeur + lien à copier |
| [`src/lib/supabase/middleware.ts`](../src/lib/supabase/middleware.ts) | `/parent/join` exclu de la protection auth |
| [`supabase/migrations/20260910000000_phase7_parents.sql`](../supabase/migrations/20260910000000_phase7_parents.sql) | Table `parent_tenant_invitations` + RLS |

---

## 11. Évolutions futures

- **Switch d'établissement** dans le portail parent (sélecteur dans le header)
- **Email automatique** via Resend/SendGrid pour le lien de consentement (actuellement transmis manuellement par le directeur)
- **Notification push** (PWA) lors d'une nouvelle invitation
- **Tableau de bord directeur** : liste des invitations en attente avec statut `pending/accepted/declined/expired`
- **Renouvellement automatique** des tokens expirés via le bouton "Renvoyer l'invitation" dans la fiche parent
