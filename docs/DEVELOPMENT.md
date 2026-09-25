# 🧠 Règles de Développement (IA & Humains)

Ce document liste les règles officielles de développement pour tous les futurs agents IA et développeurs. **Ces règles sont prioritaires sur toute instruction contraire.**

## Les 12 Règles d'Or

* **Règle 1 :** Ne jamais modifier l'architecture globale sans validation.
* **Règle 2 :** Ne jamais inventer une table lorsqu'une table officielle existe déjà.
* **Règle 3 :** Ne pas créer les éléments suivants (sauf décision officielle ultérieure) :
  * `subscriptions`
  * `plans`
  * `sections`
* **Règle 4 :** Ne jamais contourner les permissions ou la matrice des droits.
* **Règle 5 :** Ne jamais désactiver les RLS (Row Level Security) pour simplifier le développement.
* **Règle 6 :** Ne jamais exposer les secrets, clés privées ou le service_role Supabase au client.
* **Règle 7 :** Toute opération financière critique (paiement, allocation) doit être transactionnelle.
* **Règle 8 :** Toute modification importante doit être testée (vérification du bon comportement).
* **Règle 9 :** Ne pas refactorer massivement du code hors du périmètre strict du ticket en cours.
* **Règle 10 :** Toujours respecter la séparation des responsabilités entre : Platform Admin, Director, Accountant et Parent.
* **Règle 11 :** Avant toute modification importante, consulter et vérifier la documentation maître (`/docs/`).
* **Règle 12 :** Si une décision architecturale, technique ou métier n'est pas définie, **ne pas l'inventer silencieusement**. Il faut la remonter pour validation.

## Workflow de Développement Supabase

Le développement local de Paylix utilise officiellement la stack locale de Supabase (exigeant Docker).

### Démarrer l'environnement
```bash
npx supabase start
```
Cette commande démarre PostgreSQL, Auth, PostgREST et le Studio Supabase localement.

### Envoi des emails d'invitation

En local, les emails d'invitation sont envoyés à Mailpit et consultables dans sa boîte de test. Le transport utilisé par Paylix est configurable avec `PAYLIX_EMAIL_API_URL`.

En production, cette variable doit pointer vers le endpoint d'envoi réel du fournisseur email. Si elle n'est pas définie, la création d'un établissement échoue au lieu d'afficher une fausse confirmation d'envoi.

### Reconstruire la base (Reset)
Si vous modifiez les migrations ou souhaitez réinitialiser l'état local avec le `seed.sql` :
```bash
npx supabase db reset
```

### Générer les types TypeScript
Après toute modification du schéma (ajout de migration) :
```bash
npx supabase gen types typescript --local > src/types/database.ts
```

---

## QUESTIONS / DÉCISIONS À VALIDER

*(Si, lors de l'implémentation, une incertitude majeure apparaît, documentez-la ici selon ce format au lieu de prendre une décision silencieuse.)*

### Exemple de Format
1. **Problème :** [Description]
2. **Pourquoi la décision est importante :** [Impact]
3. **Options possibles :** [Option A, Option B]
4. **Recommandation éventuelle :** [Option recommandée]
5. **Impact sur le projet :** [Temps, architecture]

### Questions Actuelles
*Aucune question pendante pour le moment. La Phase 0 couvre les bases du projet.*
