# Gamelia

La plateforme africaine d'échange, par et pour les développeurs : poser ses questions, apprendre, prouver ses compétences par des défis et des projets réels, être repéré par des recruteurs. Projet présenté au **Concours CADEV by Systalink**.

```
gamelia/
  front/   Site web : Next.js 14, TypeScript, Tailwind CSS
  back/    API : Node.js, Express, PostgreSQL
```

## Site en ligne

Mis en ligne le 14 novembre 2026 sur le VPS Datacloud : **https://gamelia.ge-tech.site** (site) et **https://gamelia.ge-tech.site/api** (API, contrôle : `/api/sante`). Le sous-domaine `gamelia` du nom `ge-tech.site` pointe vers le serveur par un enregistrement DNS de type A ; le HTTPS vient de Let's Encrypt. Les e-mails automatiques passent par un service SMTP (Brevo), avec le domaine authentifié (DKIM et DMARC) pour ne pas arriver dans les courriers indésirables.

## Mettre le site en ligne (VPS Datacloud)

Une commande installe tout (PostgreSQL, API, site, HTTPS, pare-feu, sauvegardes) : suivre [`DEPLOIEMENT-VPS.md`](DEPLOIEMENT-VPS.md). Le site en ligne ne contient ni données simulées ni compte de démonstration.

Documents de la révision finale : [`RAPPORT-REVISION.md`](RAPPORT-REVISION.md) (ce qui a été vérifié et corrigé) et [`DECLARATIONS-SOUMISSION.md`](DECLARATIONS-SOUMISSION.md) (brouillon des déclarations à faire au dépôt).

## Tester sans rien installer

Ouvrir **https://gamelia.ge-tech.site**. Un développeur peut créer un compte avec n'importe quelle adresse e-mail et tout essayer : questions, leçons, défis, projets, classement, Agnès. Le site en ligne ne contient aucun compte de démonstration ; un compte **recruteur** est en attente de validation tant qu'un administrateur de l'équipe ne l'a pas validé (il reçoit alors un e-mail).

## Développement local

### Démonstration en deux minutes (sans base de données)

Il faut Node.js (version LTS, https://nodejs.org). Windows : double-cliquer sur `LANCER-DEMO-WINDOWS.bat`. Mac ou Linux : `./LANCER-DEMO-MAC-LINUX.sh`.

Le site s'ouvre sur http://localhost:3000 en **mode démonstration** : données simulées dans le navigateur, bandeau « Démonstration » en haut de page, réponses d'Agnès simulées. Comptes proposés en un clic sur la page de connexion (mot de passe `demo1234`). Ce mode sert à découvrir le site ; il n'est jamais celui du site en ligne.

### Site complet (front + API + PostgreSQL)

Prérequis : Node.js 20 ou plus, PostgreSQL 14 ou plus (avec `postgresql-contrib`).

```bash
# 1. API
cd back
npm ci
cp .env.example .env            # renseigner DATABASE_URL, SESSION_SECRET, COOKIE_SECRET, et AGNES_API_KEY pour Agnès
npm run migrate && npm run seed
npm run seed:demo               # facultatif : comptes d'essai, refusés en production
npm run dev                     # http://localhost:4000 (contrôle : /sante vérifie aussi la base)

# 2. Site
cd ../front
npm ci
cp .env.example .env.local      # retirer NEXT_PUBLIC_API_MOCK, puis NEXT_PUBLIC_API_URL=http://localhost:4000,
                                # NEXT_PUBLIC_SITE_URL=http://localhost:3000, NEXT_PUBLIC_CONTACT_EMAIL=vous@exemple.com
npm run build && npm start      # http://localhost:3000
```

Les **e-mails** (bienvenue, validation d'un recruteur, mot de passe oublié) sont facultatifs en local : sans `SMTP_HOST` ni `MAIL_FROM` dans `back/.env`, rien n'est envoyé et « Mot de passe oublié » renvoie vers l'équipe. Pour les essayer, renseigner les variables `SMTP_*` et `MAIL_FROM` décrites dans `back/README.md`.

### Lancer les tests

```bash
# API : 143 tests, sur une VRAIE base PostgreSQL dont le nom contient « test » (garde-fou)
createdb gamelia_test
cd back
DATABASE_URL=postgres://utilisateur:motdepasse@localhost:5432/gamelia_test SESSION_SECRET=une-longue-chaine-aleatoire-1 COOKIE_SECRET=une-autre-longue-chaine-2 FRONT_ORIGIN=http://localhost:3000 npm test

# Site, mode démonstration : parcours dans un navigateur, téléphone et ordinateur (48 tests)
cd ../front
npx playwright install chromium    # une seule fois
NEXT_PUBLIC_API_MOCK=true npm run build
npm test
```

`npm run typecheck` et `npm run lint` (dans `front/`) contrôlent le code du site ; les tests de parcours réels à travers nginx (`npm run test:integration`) demandent l'installation complète décrite dans `DEPLOIEMENT-VPS.md`.

## Comment ça marche

```
Navigateur ──HTTPS──> nginx ──/api/*──> API Express (port 4000) ──> PostgreSQL
                        └────── /* ───> Site Next.js (port 3000)
```

- **Un seul nom de domaine** : nginx envoie `/api/…` à l'API et tout le reste au site. Le navigateur ne parle donc qu'à un seul domaine, ce qui permet les cookies de session sans configuration particulière. Les deux programmes sont des services systemd (`gamelia-api`, `gamelia-front`), redémarrés automatiquement.
- **Trois rôles** : **développeur** (pose des questions, apprend, relève des défis, publie des projets, gagne des points), **recruteur** (publie des défis, consulte les candidatures, cherche des talents ; son compte doit d'abord être **validé par un administrateur**, qui le prévient par e-mail), **administrateur** (valide les recruteurs, les défis et les solutions, traite les signalements ; créé uniquement avec `npm run create-admin`, jamais par le formulaire d'inscription).
- **Connexion** : un cookie de session (httpOnly, durée de 30 jours) pointe vers une session stockée dans PostgreSQL ; un second cookie sert de protection CSRF (le site le renvoie dans l'en-tête `X-CSRF-Token` pour chaque action qui modifie des données). Connexion aussi possible avec GitHub.
- **Points** : seuls les développeurs en gagnent (réponses, votes reçus, leçons, défis, etc.), avec un **plafond de 200 points par jour** et une protection contre l'auto-attribution. Le niveau (Débutant, Confirmé…) découle du total.
- **Où trouver quoi** : `front/app/` (pages), `front/components/` (éléments d'interface), `front/lib/api/` (appels à l'API), `back/src/routes/` (une route par domaine), `back/src/services/` (points, e-mails, Agnès), `back/src/db/migrations/` (le schéma de la base, appliqué par `npm run migrate`).
- **Mode démonstration du site** : `NEXT_PUBLIC_API_MOCK=true` remplace l'API par une simulation dans le navigateur (aucun serveur nécessaire). Il sert aux essais et aux tests, jamais au site en ligne. Toute nouvelle fonction doit donc exister dans les deux modes (`front/lib/mock/` et `back/src/routes/`).

## Travailler à plusieurs

1. **Une branche par sujet** à partir de `main` (`git checkout -b feature/mon-sujet`), jamais de travail direct sur `main` une fois le code gelé.
2. **Avant de proposer un changement** : `npm test` dans `back/` ; `npm run typecheck`, `npm run lint` et `npm test` dans `front/`. Les tests de l'API tournent sur une vraie base, ils doivent tous passer.
3. **Une demande de fusion** (pull request) relue par un autre membre, puis fusion dans `main`.
4. **Jamais dans Git** : `.env`, clés, mots de passe, clé Agnès, clé SMTP. Seuls les fichiers `.env.example` sont versionnés. Ces secrets se saisissent sur le serveur avec les scripts de `back/deploy/`.
5. **Un changement de base de données** passe par une **nouvelle migration** (fichier numéroté suivant dans `back/src/db/migrations/`), jamais en modifiant une migration déjà appliquée.
6. **Mettre à jour le serveur** : envoyer la nouvelle version et relancer l'installateur (voir `DEPLOIEMENT-VPS.md`) ; il ne touche ni aux données ni aux secrets existants.
7. **Journal de l'IA** : tout usage d'une IA qui a produit du code ou du texte est noté dans `front/JOURNAL-IA.md` (règlement, article 6).

## Agnès, l'assistante IA

Agnès répond aux développeurs grâce à l'API **Agnes AI** (modèle gratuit `agnes-2.0-flash`) :

- **sur chaque question du forum**, « La piste d'Agnès » : une première réponse demandée par un membre, générée une fois puis visible par tous. Elle est signalée « IA », ne rapporte aucun point et ne remplace pas les réponses de la communauté ;
- **sur la page `/agnes`**, une discussion privée pour comprendre une erreur, revoir une notion ou faire relire du code, y compris à partir d'une question (« Approfondir avec Agnès »).

Pour l'activer, mettre la clé dans `back/.env` : `AGNES_API_KEY=…`. Elle reste sur le serveur et n'est jamais envoyée au navigateur. Sans clé, l'espace Agnès s'affiche « indisponible » et tout le reste du site fonctionne. Chaque membre est limité à 30 demandes par heure (réglable avec `AGNES_LIMIT_PER_HOUR`).

## Qualité (12 novembre 2026, révision finale)

| Partie | Contrôle | Résultat |
|---|---|---|
| back | `npm test` (vraie base PostgreSQL) | 143 tests réussis (dont 27 pour les e-mails automatiques et le mot de passe oublié, ajoutés le 14 novembre) |
| back | `npm audit` | 0 vulnérabilité |
| front | `npm run typecheck`, `npm run lint` | 0 erreur, 0 avertissement |
| front | `npm run build` | 116 Ko de JavaScript au maximum par page (objectif < 150 Ko) |
| front | `npm test` (parcours en mode démonstration) | 48 tests réussis, téléphone et ordinateur |
| front + back | `npm run test:integration` (parcours réels, à travers nginx en HTTPS) | 12 tests réussis |
| front + back | licences (`npm run licences`) | MIT, ISC, BSD, Apache-2.0, OFL ; aucune GPL, AGPL, LGPL |
| déploiement | `installer-vps.sh` exécuté sur un Ubuntu 24.04 de test | base, configuration, build et nginx validés |

Le détail, les limites et ce qui reste à faire par l'équipe sont dans [`RAPPORT-REVISION.md`](RAPPORT-REVISION.md).

## E-mails automatiques (14 novembre 2026)

E-mails de bienvenue à l'inscription, e-mail quand l'admin valide ou refuse un compte recruteur, et « mot de passe oublié » par lien à usage unique (deux nouvelles pages du front : `/mot-de-passe-oublie` et `/reinitialiser-mot-de-passe`). Facultatif (sans SMTP, rien n'est envoyé), jamais bloquant, sans doublon. Configuration sur le VPS : `sudo bash back/deploy/definir-smtp.sh` (étape 8 de [`DEPLOIEMENT-VPS.md`](DEPLOIEMENT-VPS.md)). Détails : `back/README.md`.

## Historique : version du 2 novembre 2026

**Ajouts**

- Espace Agnès complet : piste d'Agnès sur chaque question, page de discussion `/agnes`, accès depuis l'en-tête, le menu, l'accueil et « Comment ça marche ».
- Back : routes de messagerie privée (le front les appelait déjà, elles n'existaient pas côté API), routes Agnès, migration `002_messages_agnes.sql`, conversations de démonstration, 11 nouveaux tests.
- Le contact d'un recruteur ouvre désormais une vraie conversation à laquelle le développeur peut répondre.
- Tests de parcours réels front + back (`front/tests-integration`).

**Corrections**

- Les pages Défis et détail d'un défi plantaient avec l'API réelle (champ `participants` absent).
- La limite anti-force brute s'appliquait aussi à `GET /auth/me`, appelé à chaque page : au-delà de 10 pages par minute, ou derrière une adresse IP partagée (cybercafé, campus, réseau mobile), les membres apparaissaient déconnectés.
- Les messages d'erreur précis du serveur (« Vous avez déjà candidaté à ce défi », limites, indisponibilité) étaient remplacés par un texte générique.
- L'en-tête débordait de l'écran sur les téléphones de 360 px et sur ordinateur à 1280 px (cloche et avatar poussés hors cadre).
- Sur téléphone, la fenêtre « Bloquer ce membre » de la messagerie sortait de l'écran (conséquence du débordement).
- Se déconnecter depuis une page protégée renvoyait vers « Se connecter » avec un message d'erreur, au lieu de l'accueil.
- La police du thème Tailwind pointait vers une variable inexistante ; libellés « 1 non lus » corrigés ; adresses e-mail longues qui élargissaient les cartes de l'espace admin ; lien « Voir un profil public » de l'accueil cassé avec l'API réelle ; champ `recruiter` manquant dans les défis du recruteur.

## Documentation

- `front/README.md` : fonctionnement du site, charte, qualité, déploiement du front.
- `back/README.md` : API, variables d'environnement, routes de messagerie et d'Agnès, sécurité.
- `DEPLOIEMENT-VPS.md` : mise en ligne sur le VPS Datacloud, pas à pas.
- `RAPPORT-REVISION.md`, `DECLARATIONS-SOUMISSION.md` : révision finale et déclarations du dépôt.
- `back/docs/LIMITES.md` : limites connues.
- `front/JOURNAL-IA.md` : journal d'usage de l'IA (règlement, article 6), à compléter par l'équipe.
