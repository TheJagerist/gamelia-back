# Gamelia, front-end

Plateforme africaine d'échange, par et pour les développeurs (Concours CADEV by Systalink).
Next.js 14 (App Router), TypeScript, Tailwind CSS. Conforme au *Cahier des charges front-end*, version 2 du 7 octobre 2026.

## Voir le site sur son ordinateur

Windows : double-cliquer sur `LANCER-WINDOWS.bat`. Mac ou Linux : lancer `./LANCER-MAC-LINUX.sh`. Il faut Node.js (version LTS, https://nodejs.org). Le site s'ouvre sur http://localhost:3000.

## Lancer le projet (ligne de commande)

```bash
npm ci
cp .env.example .env.local   # mode démonstration : NEXT_PUBLIC_API_MOCK=true
npm run dev                  # http://localhost:3000
```

Le site a deux modes, choisis dans `.env.local` (voir `.env.example`) :

- **site réel (par défaut)** : le front appelle l'API et PostgreSQL. Il faut `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` et `NEXT_PUBLIC_CONTACT_EMAIL` ; sans elles, le build s'arrête avec un message clair ;
- **démonstration** (`NEXT_PUBLIC_API_MOCK=true`) : données simulées dans le navigateur, sans serveur. Un bandeau « Démonstration » s'affiche en haut du site.

Le mode démonstration ne peut donc pas être mis en ligne par oubli. Dans le site réel, les données simulées et les comptes de démonstration ne sont même pas inclus dans les fichiers envoyés au navigateur.

Comptes du mode démonstration (mot de passe `demo1234`), proposés en un clic sur la page de connexion : `awa@demo.gamelia` (développeuse), `recruteur@demo.gamelia` (recruteuse validée), `samuel@demo.gamelia` (recruteur en attente), `admin@demo.gamelia` (admin). Pour voir l'état d'erreur d'un écran en démonstration : ajouter `?demo=erreur` à l'adresse.

En développement local avec l'API réelle, `npm run seed:demo` (côté back) crée des comptes d'essai (mot de passe `Demo2026!`) ; `NEXT_PUBLIC_SHOW_DEMO=true` les propose sur la page de connexion. Ni l'un ni l'autre n'existe sur le site en ligne.

## Le lien avec l'API

Tous les appels passent par `lib/api/index.ts`. Chaque fonction a deux branches : les données simulées (`lib/mock/`) et l'appel HTTP réel (`lib/api/http.ts`), avec les routes proposées en français (`/questions`, `/defis-recruteurs/:id/candidatures`…). Le choix se fait au build (voir ci-dessus).

Les formes de réponse attendues sont dans `lib/types.ts`.

La session est un cookie httpOnly posé par l'API (`credentials: 'include'`) ; le jeton CSRF est lu dans le cookie `gamelia_csrf` et renvoyé dans l'en-tête `X-CSRF-Token`. Aucun jeton n'est stocké dans le navigateur. Les erreurs 400, 401, 403, 404, 429 et 500 ont chacune un message utilisateur (`lib/api/errors.ts`).

Le serveur simulé reproduit les règles prévues côté API pour que l'interface soit testable : rôles, plafond de 200 points par jour, aucun point sur son propre contenu, validation admin des recruteurs, des défis et des solutions pratiques. En mode démo, la session et les données sont gardées dans le navigateur ; ce n'est pas le fonctionnement réel.

## Agnès, l'assistante IA

Agnès est l'assistante IA de Gamelia, branchée sur l'API Agnes AI **par le back** (la clé n'est jamais dans le navigateur).

- **Sur chaque question** (`components/agnes.tsx`, `AgnesQuestionPanel`) : « La piste d'Agnès ». Un membre connecté la demande ; elle est générée une fois puis visible par tous, visiteurs compris. Badge « IA », rappel qu'il faut la vérifier, aucun point, jamais « meilleure réponse ». Bouton « Approfondir avec Agnès ».
- **Page `/agnes`** (tous les membres connectés : développeurs, recruteurs, admin) : discussion privée, suggestions de départ, contexte d'une question (`/agnes?question=ID`), copie des réponses, nouvelle discussion. La discussion reste dans l'onglet (sessionStorage), rien n'est stocké côté serveur.
- **Accès** : icône dans l'en-tête (ordinateur et tablette), en tête du menu sur téléphone, menu du compte, pied de page, page d'accueil et « Comment ça marche ».
- **Sécurité** : les réponses d'Agnès sont rendues par un mini-Markdown maison (paragraphes, listes, `code`, **gras**, blocs de code colorés) converti en éléments React, sans `dangerouslySetInnerHTML`.
- **Sans clé** côté back : l'espace s'affiche « indisponible » et le reste du site fonctionne. En mode démo (`lib/mock/agnes.ts`), les réponses sont simulées et signalées comme telles.

## Messagerie privée

`/messages` (développeurs et recruteurs validés) : conversations, non-lus dans l'en-tête, blocage, premier message depuis un profil public (« Écrire ») ou par le contact d'un recruteur. Relecture automatique toutes les 10 secondes (pas de temps réel). Données simulées : `lib/mock/messages.ts` ; routes réelles : `/messages/*` du back.

## Organisation

```
app/
  (public)/       accueil, questions (lecture), projets (lecture), profil public /u/[pseudo], classement, connexion, inscription, aide
  (developpeur)/  fil, poser une question, apprendre, défis, points et badges, portfolio, publier un projet, profil, défis recruteurs
  (recruteur)/    talents, défis, candidatures, compte
  (admin)/        validations, signalements
  (compte)/       notifications, paramètres, messages, Agnès (tous les rôles connectés)
components/       composants communs (ui.tsx : boutons, champs, pastilles, états ; cards, quiz, vidéo, code, commentaires…)
lib/              api, session, types, hooks (chargement, brouillons, filtres dans l'adresse), mock
styles/charte.css variables de la charte (2 couleurs, mode clair et sombre)
tests/            parcours clés en mode démo (Playwright, téléphone et ordinateur)
tests-integration/ parcours réels front + back + PostgreSQL (npm run test:integration)
```

La navigation est celle d'un site web : en-tête avec les liens de l'espace (développeur, recruteur ou admin), menu déroulant sur téléphone, pied de page sur toutes les pages. Pas de barre d'application ni d'installation : Gamelia est un site.

Chaque groupe d'espace est protégé par `components/guard.tsx` : un utilisateur qui ouvre une page d'un autre espace est redirigé avec un message clair. Ce masquage ne remplace pas les contrôles de l'API.

## Charte

- Palette violette : `#F3CCDE`, `#D6A8C4`, `#BA88AE`, `#9E6899`, `#5B3765`. Prune `#5B3765` en couleur principale, mauve clair `#D6A8C4` en accent ; variantes plus foncées pour le texte (contrastes AA). Valeurs dans `styles/charte.css`.
- Une seule police : Bricolage Grotesque (SIL OFL), servie par notre serveur, graisses 400 à 700.
- Signature visuelle : **vérifié** = sceau plein prune ; **déclaré** = contour pointillé.
- Motif : le cercle Gamelia (huit joueurs autour d'un même défi), dans le logo et l'accueil.

## Qualité

| Contrôle | Commande | Résultat au 12 novembre 2026 |
|---|---|---|
| Types | `npm run typecheck` | 0 erreur |
| Lint | `npm run lint` | 0 avertissement |
| Poids JS par page | `npm run build` | 87 Ko partagés, 116 Ko au maximum par page (objectif < 150 Ko) |
| Parcours clés (démonstration) | `npm run build && npm test` | 48 tests réussis (24 parcours, téléphone et ordinateur) |
| Parcours réels | `npm run test:integration` | 12 tests réussis contre le back et PostgreSQL, à travers nginx en HTTPS |
| Largeurs d'écran | contrôle automatique | aucun débordement à 360 et 1280 px |
| Licences | `npm run licences` | aucune GPL, AGPL, LGPL ; voir `LICENCES.md` |

`npm test` demande un build en mode démonstration (`NEXT_PUBLIC_API_MOCK=true` dans `.env.local`).

### Lancer les parcours réels

1. Back : `npm run migrate && npm run seed && npm run seed:demo` (hors production), puis `npm start` avec `FRONT_ORIGIN=http://localhost:3000`. Pour Agnès, une clé `AGNES_API_KEY` (ou un serveur de test compatible OpenAI via `AGNES_API_URL`).
2. Front : `.env.local` avec `NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `NEXT_PUBLIC_CONTACT_EMAIL=…`, sans `NEXT_PUBLIC_API_MOCK`, puis `npm run build && npm start`.
3. `npm run test:integration` (relancer `npm run seed:demo` avant chaque exécution).

Chaque écran gère les trois états : chargement (squelettes), erreur avec « Réessayer », vide avec une action utile. Brouillons enregistrés automatiquement (question, réponse, projet, défi recruteur). Zones tactiles de 44 px, navigation au clavier, `prefers-reduced-motion` respecté. Aucun `dangerouslySetInnerHTML` : le texte des membres est toujours affiché comme texte, le code est coloré jeton par jeton.

## Déploiement sur le VPS Datacloud

`next.config.mjs` produit un serveur autonome (`output: 'standalone'`), lancé par systemd derrière nginx, avec l'API sur le même domaine (`/api`). Tout est fait par une commande : voir [`DEPLOIEMENT-VPS.md`](../DEPLOIEMENT-VPS.md) à la racine. Ni Vercel ni Netlify pour la version déposée (règlement, article 6 : déploiement avec un produit Datacloud).

## Ce qui reste

- Connexion Google ou GitHub (P3) : boutons présents mais désactivés, « bientôt ».
- Traduction anglaise (P3) : textes en français clair, regroupés par écran ; l'anglais n'est pas encore écrit.
- Tests sur vrais téléphones et en 3G.
- Mot de passe oublié : pas d'e-mail automatique ; l'équipe remplace le mot de passe à la demande (`npm run reset-password` côté back).
