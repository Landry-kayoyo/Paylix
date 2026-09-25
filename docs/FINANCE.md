# 💰 Règles Financières

Ce document est la référence obligatoire pour toutes les fonctionnalités financières de Paylix. Les opérations financières exigent une rigueur absolue.

## 1. Devises
Paylix supporte :
* **CDF** (Franc Congolais) affiché `FC`
* **USD** (Dollar Américain) affiché `$`

**Règles strictes :**
* Ne **jamais** convertir automatiquement une devise en une autre.
* Ne **jamais** mélanger silencieusement les devises dans un total.

## 2. Types de Frais
* **Frais uniques** : Payer une seule fois pour l'année scolaire (ex: Frais d'inscription).
* **Frais mensuels** : Payer récurremment. Ils utilisent des échéances (`fee_schedules`) basées sur des mois individuels. Il ne faut pas créer de logique `start_date/end_date` pour remplacer les mois.

## 3. Paiement Partiel
Les paiements partiels sont autorisés.
*Exemple :*
- Obligation = 100 $
- Paiement reçu = 40 $
- **Reste à payer** = 60 $
- **Statut de l'obligation** = `partial`

## 4. Paiement couvrant plusieurs obligations
Un seul paiement peut être réparti sur plusieurs obligations via la table `payment_allocations`.
*Exemple :*
- Obligation A = 50 $
- Obligation B = 30 $
- Paiement reçu = 80 $
- **Allocation** : L'enregistrement crée une allocation de 50 $ pour l'obligation A, et de 30 $ pour la B.

## 5. Transactions Atomiques
L'enregistrement financier doit être traité comme une opération atomique stricte.
Flux obligatoire :
```text
validation de la requête
    ↓
création du paiement (payments)
    ↓
création des allocations (payment_allocations)
    ↓
vérification du total (allocations == montant du paiement)
    ↓
mise à jour des statuts des obligations (financial_obligations)
    ↓
génération du reçu (receipts)
    ↓
enregistrement de l'audit (audit_logs)
    ↓
commit de la transaction
```
Si une seule étape échoue, l'opération complète doit être annulée (Rollback). L'idempotence des requêtes doit être garantie pour éviter les doubles paiements involontaires.

## 6. Suppression et Correction des Paiements
**Règle absolue : Un paiement confirmé ne doit JAMAIS être supprimé physiquement de la base de données.**
Toute erreur ou correction doit se faire par :
* **Cancellation** (Annulation du paiement avant réception finale ou en cas d'erreur de frappe immédiate).
* **Reversal** (Remboursement ou annulation comptable formelle).

L'historique financier doit rester intact et traçable dans les audits.

## 7. Règles d'intégrité
* Un montant de paiement ne peut pas être négatif.
* La somme des `payment_allocations` pour un paiement doit correspondre exactement au `amount` du paiement parent.
* Les obligations ne peuvent pas être surpayées (allocation > montant dû).
