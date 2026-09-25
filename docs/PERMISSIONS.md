# 🔑 Matrice des Permissions

Ce document définit les droits stricts par rôle. Un utilisateur ne doit jamais pouvoir exécuter une action hors de son périmètre de permission.
Les 4 rôles sont : **Platform Admin**, **Director**, **Accountant**, et **Parent**.

## Matrice des Droits

| Fonctionnalité / Objet | Platform Admin | Director | Accountant | Parent |
| :--- | :--- | :--- | :--- | :--- |
| **Établissements (Tenants)** | CRUD | Aucun (Lecture de son propre tenant) | Aucun | Aucun |
| **Années Scolaires** | Supervision | CRUD | Lecture | Aucun |
| **Classes** | Supervision | CRUD | Lecture | Aucun |
| **Élèves** | Supervision | CRUD | Lecture / Gestion opérationnelle | Lecture (uniquement ses enfants) |
| **Parents** | Supervision | CRUD | Lecture opérationnelle | Lecture / Modification (profil propre) |
| **Comptables** | Supervision | CRUD | Profil propre | Aucun |
| **Frais (Configuration)** | Supervision | CRUD | Lecture | Aucun |
| **Obligations Financières** | Supervision | CRUD | Gestion opérationnelle | Lecture (uniquement ses enfants) |
| **Paiements** | Supervision | Supervision | CRUD opérationnel (Enregistrement, répartition) | Lecture (uniquement ses enfants) |
| **Reçus (Receipts)** | Supervision | Gestion | Gestion | Lecture (uniquement ses enfants) |
| **Audit Logs** | Global | École (son tenant) | Limité (ses actions) | Aucun |
| **Notifications** | Supervision | Gestion globale (tenant) | Gestion de ses notifications | Gestion de ses notifications |

## Explications additionnelles

* **Platform Admin** : Administrateur du SaaS. Il supervise, mais ne devient pas automatiquement directeur ou comptable d'une école.
* **Director** : Administre son école de A à Z. Ne doit interagir qu'avec les données de son propre tenant.
* **Accountant** : Se concentre sur l'opérationnel : rechercher un élève, consulter ses obligations, enregistrer des paiements partiels/totaux, répartir un paiement, consulter les impayés et générer des reçus. N'a pas les droits de modifier la configuration structurelle de l'école (comme la création de nouveaux types de frais).
* **Parent** : Accès extrêmement limité en lecture seule sur les données financières de ses enfants.
  * Ne peut jamais créer, modifier ou supprimer un paiement.
  * Ne peut jamais créer ou modifier une obligation financière ou la configuration de l'école.
