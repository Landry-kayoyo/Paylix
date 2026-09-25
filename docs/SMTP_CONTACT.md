# SMTP Gmail - Formulaire de contact Paylix

## Vue d'ensemble

Le formulaire de contact de la landing page envoie les messages directement via SMTP Gmail (nodemailer, port 465, connexion securisee).

Aucun service tiers (Resend, SendGrid, Brevo, Mailgun) n'est utilise.

---

## Variables d'environnement requises

| Variable        | Description                                    |
|-----------------|------------------------------------------------|
| SMTP_HOST       | smtp.gmail.com                                 |
| SMTP_PORT       | 465                                            |
| SMTP_USER       | Adresse Gmail utilisee pour envoyer les emails |
| SMTP_PASSWORD   | Mot de passe d'application Google (PAS le mot de passe Gmail normal) |
| CONTACT_EMAIL   | Adresse qui recoit les messages du formulaire  |

**IMPORTANT** : Ces variables ne doivent JAMAIS etre prefixees par NEXT_PUBLIC_
Elles restent exclusivement cote serveur.

---

## Configuration Gmail (OBLIGATOIRE)

### 1. Activer la validation en deux etapes
Allez sur : https://myaccount.google.com/security
Activez la validation en deux etapes si ce n'est pas deja fait.

### 2. Creer un mot de passe d'application
Allez sur : https://myaccount.google.com/apppasswords
- Choisissez "Autre (nom personnalise)"
- Nommez-le "Paylix SMTP"
- Copiez le mot de passe genere (16 caracteres)

Ce mot de passe d'application va dans SMTP_PASSWORD.
Ne jamais utiliser votre mot de passe Gmail normal.

---

## Configuration locale (.env.local)

`env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=votre.adresse@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
CONTACT_EMAIL=votre.adresse@gmail.com
`

---

## Configuration Vercel (Production)

Dans le dashboard Vercel :
1. Allez dans Settings > Environment Variables
2. Ajoutez chaque variable avec les vraies valeurs
3. Selectionnez l'environnement : Production (et Preview si souhaite)

Variables a ajouter :
- SMTP_HOST = smtp.gmail.com
- SMTP_PORT = 465
- SMTP_USER = (votre adresse Gmail)
- SMTP_PASSWORD = (votre mot de passe d'application)
- CONTACT_EMAIL = (adresse destinataire)

---

## Architecture technique

`
Navigateur
    |
    | POST /api/contact (JSON: name, email, subject, customSubject, message, website)
    v
src/app/api/contact/route.ts
    |
    | 1. Rate limiting IP (3 req / 10 min)
    | 2. Parse JSON
    | 3. Validation Zod (serveur)
    | 4. Honeypot check (champ website)
    | 5. Verification env vars SMTP
    | 6. import('nodemailer') — lazy, serveur uniquement
    | 7. sendMail via SMTP Gmail port 465
    v
Gmail (CONTACT_EMAIL)
`

---

## Format de l'email envoye

**Objet :** [Paylix] {sujet} - {nom}

**From :** Paylix Contact <SMTP_USER>
**To :** CONTACT_EMAIL
**Reply-To :** Adresse du visiteur

Repondre au message depuis Gmail repond directement au visiteur.

---

## Securite

- Secrets SMTP : serveur uniquement, jamais en NEXT_PUBLIC_
- Contenu utilisateur : echappe (HTML) avant insertion dans le template email
- Destinataire : controle exclusivement par CONTACT_EMAIL (variable serveur)
- Honeypot : champ website cache, rejet silencieux si rempli
- Rate limiting : 3 soumissions par IP par 10 minutes
- Validation : doublee (frontend + Zod serveur)
- Logs : message d'erreur SMTP sans identifiants

---

## Test d'envoi

1. Remplissez les variables SMTP dans .env.local
2. Demarrez npm run dev
3. Allez sur http://localhost:3000/#contact
4. Remplissez le formulaire et envoyez
5. Verifiez la boite Gmail de CONTACT_EMAIL

---

## Depannage SMTP

### Erreur : "Invalid login"
- Verifiez que SMTP_USER est correct
- Verifiez que SMTP_PASSWORD est un mot de passe d'application (pas le mot de passe Gmail)
- Verifiez que la validation en deux etapes est activee sur le compte Google

### Erreur : "Connection timeout"
- Verifiez que SMTP_HOST = smtp.gmail.com
- Verifiez que SMTP_PORT = 465
- Verifiez que secure = true (port 465)

### Le formulaire affiche "Configuration serveur incomplete"
- Les variables SMTP manquent dans .env.local
- Redemarrez npm run dev apres avoir modifie .env.local

### Les emails arrivent dans le spam
- Ajoutez le domaine dans la liste blanche de votre client email
- Verifiez la configuration SPF/DKIM du domaine expediteur
