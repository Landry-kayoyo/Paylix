# 🛡 Sécurité

## Architecture de Sécurité
L'architecture de sécurité suit un modèle de défense en profondeur, défini selon ce flux :
```text
Authentication (Supabase Auth)
      ↓
Tenant isolation (Contrôle d'appartenance via user_memberships)
      ↓
Role (Platform Admin, Director, Accountant, Parent)
      ↓
Permission (Matrice des droits)
      ↓
Object-level authorization (Vérifications spécifiques à l'objet)
      ↓
RLS (Row Level Security au niveau de PostgreSQL)
```
**Règle absolue : La sécurité ne doit jamais dépendre uniquement de l'interface frontend ou des routes frontend.**

## 1. Multi-Tenant et Isolation
Paylix est un système multi-tenant. Les données de l'École A ne doivent **jamais** être accessibles aux utilisateurs de l'École B. Cette isolation est gérée à la fois au niveau applicatif et strictement renforcée en base de données par les RLS.

## 2. Row Level Security (RLS)
L'utilisation des RLS est **obligatoire** pour toutes les tables exposées. Les politiques doivent être conçues explicitement pour `SELECT`, `INSERT`, `UPDATE` et `DELETE` en tenant compte du rôle de l'utilisateur (`user_memberships`) et du tenant associé.
Le `service_role` (clé secrète Supabase) contourne les RLS ; il doit être strictement réservé à l'usage côté serveur.

## 3. Règle Critique : Sécurité du Parent
Un parent **ne doit pas** pouvoir consulter les informations d'un élève sous prétexte qu'ils appartiennent au même tenant.
Le système doit valider le lien réel avant d'autoriser l'accès aux données financières :
```text
auth.uid()
    ↓
parent
    ↓
parent_students (Vérification du lien)
    ↓
student
    ↓
financial data
```
Le parent ne peut consulter que les données financières de **ses propres enfants**.

## 4. Authentification
* **Flux prévus** : login, logout, activation de compte parent, définition du mot de passe, mot de passe oublié, réinitialisation du mot de passe, gestion de session.
* L'activation du compte parent s'effectue via un lien sécurisé, temporaire et à usage unique (table `activation_tokens`).
* **Aucun mot de passe en clair** ne doit être stocké ou envoyé par email.

## 5. Prévention IDOR
Chaque appel API ou Server Action modifiant une ressource doit vérifier que l'utilisateur possède l'autorisation sur l'objet ciblé, indépendamment du fait que l'ID soit connu. L'appartenance au `tenant_id` doit toujours être validée.

## 6. Audit & Traçabilité
Toute modification d'une ressource critique (paiements, annulations, obligations) doit générer une entrée dans `audit_logs` avec les informations sur l'acteur, l'action, l'adresse IP et le `user_agent`.

## 7. Protection des Secrets et des Fichiers
* Les variables d'environnement (`NEXT_PUBLIC_` vs privées) doivent être respectées.
* Les reçus (fichiers PDF) stockés dans Supabase Storage doivent être protégés par des politiques d'accès. Un parent ne peut télécharger que les reçus de ses enfants.
