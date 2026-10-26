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
npm run seed:demo             # (optionnel) données et comptes de démonstration
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
| `AUTH_RATE_LIMIT_MAX` | non (10) | Tentatives par minute sur `/auth/*` |

Générer un secret : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Scripts

| Commande | Effet |
|---|---|
| `npm start` / `npm run dev` | Lance l'API |
| `npm run migrate` | Applique les migrations SQL de `src/db/migrations` |
| `npm run seed` | Insère les catalogues (idempotent) |
| `npm run seed:demo` | Comptes + données de démo (idempotent, supprime les `@demo.gamelia` avant) |
| `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin` | Crée ou promeut un administrateur (mot de passe ≥ 12 caractères) |
| `npm test` | 78 tests d'intégration sur une **vraie base PostgreSQL** |
| `npm run licences` | Vérifie les licences des dépendances |

### Comptes de démonstration (`npm run seed:demo`, mot de passe `Demo2026!`)

- `dev@demo.gamelia` — développeuse (Fatou Diop)
- `recruteur@demo.gamelia` — recruteur validé (Baobab Tech)
- `recruteur.attente@demo.gamelia` — recruteur en attente de validation
- `admin@demo.gamelia` — administrateur

> Ne **jamais** lancer `seed:demo` en production réelle avec ces mots de passe publics sans les changer ; pour la démo du concours, c'est volontaire.

## Tests

```bash
createdb gamelia_test        # le nom DOIT contenir « test » (garde-fou)
DATABASE_URL=postgres://user:mdp@localhost:5432/gamelia_test npm test
```

Les tests migrent et alimentent la base, démarrent le serveur, puis nettoient leurs comptes (`@test.gamelia`).
Ils refusent de tourner sur une base dont le nom ne contient pas « test ».

## Structure

```
src/
  server.js          Assemblage Express, sécurité, routes, arrêt propre
  config/env.js      Lecture/validation de l'environnement (échoue vite)
  db/                Migrations, seeds, création d'admin
  middleware/        Session, CSRF, gestion d'erreurs
  routes/            Un fichier par domaine (auth, questions, learn, projets, recruteur…)
  services/          Points (plafond, verrou), résumés partagés
  utils/             Cookies, sérialisation des utilisateurs, validation
tests/               Tests d'intégration (node:test)
docs/                Déploiement, licences, limites connues
deploy/              Exemples nginx et systemd
```

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

Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md). Point critique : **front et API doivent partager le même domaine parent** (ex. `gamelia.exemple.com` et `api.gamelia.exemple.com`) et être servis en **HTTPS**, sinon le cookie CSRF n'est pas lisible par le front.

## Limites connues

Voir [docs/LIMITES.md](docs/LIMITES.md).
