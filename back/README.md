# GAMELIA — Backend (API)

Plateforme d'échange pour les développeurs, **pour l'Afrique et par l'Afrique** — projet présenté au concours CADEV (Systalink).
Ce dépôt contient l'API (Node.js / Express / PostgreSQL) consommée par le front Next.js.

## Prérequis

- Node.js **≥ 20** (testé sur 22)
- PostgreSQL **≥ 14** (testé sur 16) avec les extensions `pgcrypto` et `citext` (incluses dans `postgresql-contrib`)

## Installation locale

```bash
npm ci
cp .env.example .env          # puis renseigner DATABASE_URL, SESSION_SECRET, COOKIE_SECRET
npm run migrate               # crée les tables
npm run seed                  # catalogues (pistes, leçons, badges, défis…)
npm run seed:demo             # (optionnel, développement local uniquement) comptes de démonstration
npm run dev                   # http://localhost:4000  — test : GET /sante
```

## Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `PORT` | non (4000) | Port d'écoute |
| `NODE_ENV` | non | `production` active les cookies `secure` (HTTPS requis) |
| `FRONT_ORIGIN` | oui | Origine exacte du front (ex. `https://gamelia.exemple.com`), utilisée pour CORS |
| `DATABASE_URL` | oui | `postgres://utilisateur:mdp@hote:5432/base` |
| `SESSION_SECRET`, `COOKIE_SECRET` | oui | Chaînes aléatoires longues (voir ci-dessous) |
| `COOKIE_DOMAIN` | prod | Domaine parent partagé front/API, ex. `.exemple.com` (vide en local) |
| `SESSION_TTL_DAYS` | non | Durée de session |
| `AUTH_RATE_LIMIT_MAX` | non (10) | Tentatives par minute et par IP sur connexion, inscription et mot de passe oublié |
| `AGNES_API_KEY` | non | Clé de l'API Agnes AI. Sans clé, l'espace Agnès s'affiche « indisponible » |
| `AGNES_MODEL` | non (`agnes-2.0-flash`) | Modèle utilisé (gratuit par défaut) |
| `AGNES_API_URL` | non | `https://apihub.agnes-ai.com/v1` (API compatible OpenAI) |
| `AGNES_LIMIT_PER_HOUR` | non (30) | Demandes à Agnès par membre et par heure |
| `AGNES_TIMEOUT_MS` | non (60000) | Délai maximal d'une réponse d'Agnès |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | non | Serveur d'e-mails sortants (587 = STARTTLS, 465 = TLS immédiat). Sans `SMTP_HOST` et `MAIL_FROM`, aucun e-mail n'est envoyé |
| `MAIL_FROM` | non | Expéditeur, par ex. `"Gamelia <no-reply@votre-domaine>"` |
| `MAIL_REPLY_TO` | non | Adresse qui reçoit les réponses des membres |

Générer un secret : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Scripts

| Commande | Effet |
|---|---|
| `npm start` / `npm run dev` | Lance l'API |
| `npm run migrate` | Applique les migrations SQL de `src/db/migrations` |
| `npm run seed` | Insère les catalogues (idempotent) |
| `npm run seed:demo` | Comptes + données de démo (idempotent, supprime les `@demo.gamelia` avant) |
| `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin` | Crée ou promeut un administrateur (mot de passe ≥ 12 caractères) |
| `npm run reset-password` | Remplace le mot de passe d'un membre qui l'a perdu (sert quand l'envoi d'e-mails n'est pas configuré, ou pour un cas particulier) |
| `sudo bash deploy/definir-smtp.sh` | (VPS) Enregistre les réglages SMTP en saisie masquée et envoie un e-mail d'essai |
| `npm test` | 143 tests d'intégration sur une **vraie base PostgreSQL** |
| `npm run licences` | Vérifie les licences des dépendances |

### Comptes de démonstration, pour le développement local (`npm run seed:demo`, mot de passe `Demo2026!`)

- `dev@demo.gamelia` — développeuse (Fatou Diop)
- `recruteur@demo.gamelia` — recruteur validé (Baobab Tech)
- `recruteur.attente@demo.gamelia` — recruteur en attente de validation
- `admin@demo.gamelia` — administrateur

Les comptes de démo ont aussi des conversations privées (Fatou ↔ Landry, Fatou ↔ la recruteuse, Fatou ↔ Omar).

> Ces mots de passe sont publics : `seed:demo` **refuse de s'exécuter en production** (`NODE_ENV=production`). Le site en ligne ne contient aucun compte de démonstration.

## Tests

```bash
createdb gamelia_test        # le nom DOIT contenir « test » (garde-fou)
DATABASE_URL=postgres://user:mdp@localhost:5432/gamelia_test npm test
```

Les tests migrent et alimentent la base, démarrent le serveur, puis nettoient leurs comptes (`@test.gamelia`).
Agnès est testée contre un faux serveur compatible OpenAI lancé par les tests : aucune clé ni connexion Internet n'est nécessaire.
Ils refusent de tourner sur une base dont le nom ne contient pas « test ».

## Structure

```
src/
  server.js          Assemblage Express, sécurité, routes, arrêt propre
  config/env.js      Lecture/validation de l'environnement (échoue vite)
  db/                Migrations, seeds, création d'admin
  middleware/        Session, CSRF, gestion d'erreurs
  routes/            Un fichier par domaine (auth, questions, learn, projets, recruteur, messages, agnes…)
  services/          Points (plafond, verrou), résumés partagés, client de l'API Agnès
  utils/             Cookies, sérialisation des utilisateurs, validation
tests/               Tests d'intégration (node:test)
docs/                Déploiement, licences, limites connues
deploy/              Exemples nginx et systemd
```

## Messagerie privée

| Route | Rôle |
|---|---|
| `GET /messages/conversations` | Conversations du membre connecté (avec non-lus et blocage) |
| `GET /messages/conversations/:id` | Une conversation et ses messages (404 si elle n'est pas à vous) |
| `POST /messages/conversations` | Premier message à un membre `{ username, body }` (rouvre la conversation si elle existe) |
| `POST /messages/conversations/:id/messages` | Envoyer `{ body }` (1 à 1000 caractères, 10 par minute) |
| `POST /messages/conversations/:id/lu` | Marquer comme lue |
| `GET /messages/non-lus` | `{ count }` |
| `POST /messages/blocages`, `DELETE /messages/blocages/:username` | Bloquer, débloquer |

Réservée aux développeurs et aux recruteurs validés (l'admin n'a pas de messagerie). Le contact d'un recruteur (`POST /recruteur/contacts`) ouvre aussi une conversation.

## E-mails automatiques

Envoyés par SMTP (`src/services/mailer.js`, modèles français dans `src/services/mail-templates.js`) :

| Événement | Destinataire | E-mail |
|---|---|---|
| Inscription développeur (formulaire ou GitHub) | le développeur | Bienvenue, lien de connexion |
| Inscription recruteur | le recruteur | Demande bien reçue, compte en attente de validation |
| L'admin valide / refuse (`POST /admin/recruteurs/:id`) | le recruteur | Compte validé (lien de connexion) / non validé |
| « Mot de passe oublié » | le membre | Lien de réinitialisation, valable 60 minutes, à usage unique |
| Mot de passe changé | le membre | Confirmation, avec lien pour réagir si ce n'est pas lui |

**Mot de passe oublié** : `POST /auth/mot-de-passe-oublie {email}` répond toujours `202 {sent:true}` (compte existant ou non : on ne révèle pas quelles adresses sont inscrites) ; `POST /auth/reinitialiser-mot-de-passe {token, password}` change le mot de passe (`204`) ou répond `400` avec le code `lien_invalide`. `GET /auth/mot-de-passe-oublie/etat` indique si la fonction est disponible (`{enabled}`) : sans SMTP, le front renvoie vers l'équipe.
Le jeton (32 octets aléatoires) n'est jamais stocké en clair, seulement son empreinte SHA-256 (table `password_reset_tokens`). Un nouveau lien annule les précédents, 3 demandes maximum par compte et par heure, et un changement de mot de passe ferme toutes les sessions du compte.

- **Non bloquant** : la réponse de l'API part sans attendre le serveur d'e-mails ; une panne SMTP est écrite dans les journaux et n'empêche jamais l'action.
- **Pas de doublon** : l'e-mail d'une décision admin n'est envoyé que si le statut change réellement.
- **Une nouvelle tentative** après une panne passagère (réseau, réponse 4xx) ; aucune pour un refus définitif (5xx).
- **Sécurité** : valeurs des membres échappées dans le HTML, aucun texte de membre dans l'objet, adresses masquées dans les journaux, chiffrement obligatoire en production (sauf relais installé sur le serveur).
- **Facultatif** : sans `SMTP_HOST` et `MAIL_FROM`, rien n'est envoyé. Configuration sur le VPS : `deploy/definir-smtp.sh`.
- Tests : `tests/mail.test.js` et `tests/password-reset.test.js`, avec un faux serveur SMTP local (aucun vrai e-mail envoyé).

## Agnès, l'assistante IA

Agnès s'appuie sur l'API **Agnes AI** (compatible OpenAI, modèle gratuit `agnes-2.0-flash`). C'est le back qui l'appelle : la clé reste sur le serveur.

| Route | Rôle |
|---|---|
| `GET /agnes/etat` | `{ available, model }` |
| `GET /agnes/questions/:id` | Piste d'Agnès sur une question (publique) : `{ available, answer }` |
| `POST /agnes/questions/:id` | Générer la piste (membre connecté). Générée **une seule fois** puis partagée ; deux clics simultanés ne déclenchent qu'un appel |
| `POST /agnes/discussion` | Discussion privée `{ messages: [{ role: 'user' \| 'assistant', content }] }` → `{ reply }` |

Règles : la piste ne rapporte aucun point et ne peut pas être « meilleure réponse » ; quota par membre (`AGNES_LIMIT_PER_HOUR`) ; seules les 12 dernières répliques sont transmises ; les discussions privées ne sont pas stockées (seul un compteur d'usage l'est, sans contenu). Erreurs traduites pour le front : 503 `agnes_indisponible` (pas de clé ou clé refusée), 429 (quota), 502 `agnes_erreur` (service injoignable ou trop lent).

## Choix de sécurité

- Mots de passe : bcrypt (coût 12). Sessions **opaques côté serveur** (table `sessions`), cookie `httpOnly`.
- **CSRF** : double-submit (`gamelia_csrf` + en-tête `X-CSRF-Token`) vérifié sur toute requête mutante authentifiée.
- CORS à origine exacte avec credentials, `helmet`, limitation de débit sur `/auth`, validation `zod` de toutes les entrées.
- Points : verrou de ligne (`FOR UPDATE`), plafond de 200 pts/jour, seuls les développeurs en gagnent, anti-triche sur ses propres contenus.
- Vie privée : ville et profil masquables, e-mails jamais exposés publiquement.
- Aucun secret dans Git (`.env` ignoré). `npm audit` : 0 vulnérabilité. Licences : MIT / ISC / BSD uniquement.

## Contrat d'API

Le contrat suit exactement le front (`lib/types.ts`, serveur mock). Format d'erreur : `{ "message": string, "code"?: string, "fields"?: {…} }`.
Détail des routes : `claude/api-routes.md` (projet GAMELIA) et `schema.sql` pour le schéma.

## Déploiement

Voir [`DEPLOIEMENT-VPS.md`](../DEPLOIEMENT-VPS.md) à la racine : une seule commande (`deploy/installer-vps.sh`) installe tout sur le VPS Datacloud. Le site et l'API sont servis par nginx derrière **un seul domaine en HTTPS** (`https://domaine` et `https://domaine/api`) : les cookies de session et le jeton CSRF fonctionnent sans réglage de domaine. En production, l'API refuse de démarrer si la configuration est dangereuse (secrets d'exemple, origine sans HTTPS).

## Limites connues

Voir [docs/LIMITES.md](docs/LIMITES.md).
