# Phase 8 - Interface frais et obligations

## Écrans

- `/school/fees` présente les frais de l'année scolaire active, une recherche, un filtre par type, quatre KPI et un tableau responsive.
- `/school/obligations` présente les obligations financières existantes avec recherche, filtres par statut et mois, KPI et panneau de détail.
- Les deux routes utilisent un `loading.tsx` dédié afin de ne pas afficher un état vide avant la fin du chargement.

## Parcours de création et de modification

Le dialogue des frais suit quatre étapes dans le même modal:

1. Informations générales: nom, type, devise et montant par défaut.
2. Classes concernées: une ou plusieurs classes, ou toutes les classes de l'année active.
3. Configuration: pour un frais mensuel, sélection des mois, montant et échéance de chaque mois.
4. Résumé: vérification du frais avant enregistrement.

Le formulaire valide le nom, le montant, les classes et, pour un frais mensuel, chaque mois, montant et échéance. Le montant par défaut est prérempli sur chaque nouveau mois mais reste modifiable individuellement.

Une modification normale remplace les classes et les échéances uniquement lorsqu'aucune obligation n'existe encore. Si le frais est déjà utilisé, seuls ses attributs généraux sont modifiés; l'interface informe que les obligations historiques conservent leurs montants.

La désactivation est une mise à jour de statut, jamais une suppression. La confirmation rappelle que les obligations déjà créées sont conservées.

## Obligations et statuts

Les obligations sont lues depuis `financial_obligations`, avec les élèves, classes, frais et échéances associés. Aucun paiement n'est créé dans cette phase. Les montants affichés utilisent `initial_amount`, `paid_amount` et `remaining_amount` de la base.

Le statut de base provient du backend. L'interface affiche `En retard` lorsque l'échéance est dépassée et que le montant restant est positif; `Payée`, `Partiellement payée`, `À payer` et `Annulée` restent les autres états possibles. Le Directeur ne peut pas modifier manuellement le statut depuis ces écrans.

## Permissions

- Directeur: création, modification, désactivation des frais et consultation des obligations.
- Comptable: consultation des frais et des obligations.
- Parent: aucun accès à ces routes de gestion.
- Les actions serveur vérifient le rôle et le tenant; le frontend ne constitue pas la sécurité.

## Décisions UX

- Les données de l'année active sont chargées côté serveur.
- Les états vides ne sont rendus qu'après la fin du chargement; les erreurs remontent à l'écran Next de la route.
- Les listes sont scrollables horizontalement sur mobile et les formulaires restent utilisables dans un modal limité en hauteur.
- Les KPI financiers affichent `Indisponible` lorsqu'il n'y a pas de données, plutôt qu'une estimation ou un faux zéro.
- La Phase 9 n'est pas implémentée: aucun formulaire de paiement, allocation, reçu, remboursement ou annulation n'a été ajouté.
