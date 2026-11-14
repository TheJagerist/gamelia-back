# Rapport de révision finale

Gamelia, Concours CADEV 2026. Révision du 12 novembre 2026, avant dépôt (limite : 15 novembre, 17 h 00 GMT).

## Verdict

**Le code est prêt à être déposé. Le dépôt lui-même ne l'est pas encore** : le site n'est pas installé sur le VPS, et Agnès n'a jamais été testée avec la vraie clé. Ces deux points se règlent en suivant `DEPLOIEMENT-VPS.md` (30 à 45 minutes). Tout ce qui pouvait être vérifié sans le VPS l'a été, par des tests automatiques et par une installation d'essai complète.

## Le site est-il connecté à la base de données ?

Oui, quand il est construit en mode réel, ce qui est désormais le mode par défaut. Preuves obtenues sur une installation d'essai (script du VPS exécuté sur un Ubuntu 24.04, nginx, HTTPS, API en mode production) :

| Contrôle | Résultat |
|---|---|
| `GET /api/sante` (interroge réellement PostgreSQL) | `{"ok":true,"database":true}` |
| Inscription, puis question publiée, à travers nginx en HTTPS | 201, cookies `Secure` et `httpOnly` |
| Redémarrage de l'API, puis relecture | session toujours valide, question toujours là |
| Lecture directe dans PostgreSQL | la question, la date d'acceptation des conditions, le mot de passe en bcrypt |
| PostgreSQL arrêté | `/api/sante` répond 503 `"database":false`, puis 200 dès que la base revient |
| Écriture sans jeton CSRF | 403 |
| API appelée sans passer par nginx, depuis l'extérieur | connexion refusée |

Avant la révision, un oubli de variable suffisait à mettre en ligne un site « de démonstration » sans base de données, sans que rien ne le signale. Ce n'est plus possible : sans adresse d'API, le build s'arrête.

## Contrôles

| Contrôle | Avant | Après |
|---|---|---|
| Tests du back (vraie base PostgreSQL) | 89, dont 1 instable | 91 réussis |
| Parcours navigateur, mode démonstration | 38 | 48 réussis |
| Parcours navigateur réels (front + API + base, nginx, HTTPS) | 8 | 12 réussis |
| Types (`tsc`), lint | propres | propres |
| `next build` | réussi | réussi, 116 Ko au plus par page |
| Licences front et back | conformes | conformes (aucune GPL, AGPL, LGPL) |
| `npm audit` back | 0 | 0 |
| `npm audit` front | avis sur Next.js 14 | inchangé, risques réduits (voir plus bas) |
| Débordement horizontal à 360 et 1280 px | 1 page (portfolio) | aucun sur 18 pages contrôlées |

## Problèmes trouvés et corrigés

### Bloquants

| Problème | Correction | Fichiers |
|---|---|---|
| Le badge « compte vérifié » s'obtenait en un clic, sans rien vérifier, alors que « vérifié ou déclaré » est l'argument central du site. | Vraie vérification : Gamelia donne un code, le membre le place dans la bio de son profil GitHub, l'API relit la bio publique. Un compte GitHub ne vérifie qu'un membre. | `back/src/routes/me.js`, migration `003`, `front/app/(developpeur)/profil/page.tsx` |
| Un lien de profil `javascript:…` était accepté par l'API puis affiché cliquable sur le profil public (exécution de code chez le visiteur). | L'API n'accepte que des liens `https://` ; le front ne rend cliquables que les liens http(s). | `me.js`, `front/components/ui.tsx`, `portfolio-list.tsx` |
| « Mot de passe oublié » affichait « un lien vient d'être envoyé » alors qu'aucun e-mail n'est jamais envoyé. Même promesse pour les recruteurs en attente. | Page honnête : écrire à l'équipe, qui remplace le mot de passe avec `npm run reset-password`. Textes corrigés. | `front/app/(public)/mot-de-passe-oublie`, `inscription`, `back/src/db/reset-password.js` |
| Le mode démonstration était le mode par défaut du front. | Site réel par défaut ; build arrêté si la configuration est incomplète ; bandeau « Démonstration » en mode simulé. | `front/next.config.mjs`, `lib/api/index.ts`, `components/shell.tsx` |
| Les comptes de démonstration et leurs mots de passe étaient inclus dans les fichiers du site en ligne, et rien n'empêchait de les créer en production. | Ce code n'est plus inclus dans le site réel (vérifié dans les fichiers construits) ; `seed:demo` refuse de tourner en production. | `components/demo-accounts.tsx`, `back/src/db/seed-demo.js` |
| Aucune page légale ni acceptation à l'inscription, alors que le site enregistre des comptes. | Pages Confidentialité et Conditions, liens en pied de page, case obligatoire à l'inscription, vérifiée aussi par l'API, date d'acceptation enregistrée. | `front/app/(public)/confidentialite`, `conditions`, `back/src/routes/auth.js` |

### Importants

| Problème | Correction |
|---|---|
| Un texte trop long (nom de 200 caractères à l'inscription, par exemple) provoquait une erreur 500. | Longueurs maximales sur tous les champs de l'API, avec un message par champ ; filet de sécurité dans le gestionnaire d'erreurs. |
| Deux clics simultanés sur « Demander à Agnès » pouvaient déclencher deux appels payants à l'API (test instable). | Toute la demande est regroupée dans un seul travail partagé. |
| `/sante` répondait « ok » même si la base était arrêtée. | `/sante` interroge PostgreSQL et répond 503 sinon. |
| Changer son mot de passe laissait les autres appareils connectés. | Les autres sessions sont fermées. |
| « Retirer la photo » de profil ne retirait rien côté serveur. | Le front envoie explicitement la suppression ; l'API n'accepte que JPEG, PNG, WebP ou un lien https (pas de SVG). |
| Après l'inscription, la page de bienvenue du profil n'apparaissait jamais (redirection concurrente). | Corrigé. |
| Le texte de suppression de compte annonçait que les questions restaient « signées membre supprimé » ; en réalité tout est effacé. | Texte aligné sur le comportement réel. |
| L'API pouvait démarrer en production avec les secrets d'exemple (`change-me`) ou sans HTTPS. | Démarrage refusé, avec la liste des réglages à corriger. |
| L'API écoutait sur toutes les interfaces du serveur. | Écoute sur `127.0.0.1` en production, derrière nginx. |
| Le guide de déploiement utilisait `pm2` (licence AGPL) et demandait deux sous-domaines. | systemd, et un seul domaine (`/` et `/api`) : plus simple, sans réglage de cookies. |
| Avis de sécurité critiques sur l'optimisation d'images de Next.js 14. | Optimisation désactivée (le site ne l'utilise pas) et adresse `/_next/image` fermée par nginx : 404 vérifié. |

### Mineurs

Débordement de la page portfolio sur téléphone ; cookies de session mal effacés à la suppression du compte quand un domaine de cookie est défini ; `robots.txt` complété et `sitemap.xml` ajouté ; commentaires et documentation mis à jour ; fichiers `.env.example` réécrits.

## Agnès

| Point | État |
|---|---|
| Sans clé : espace « indisponible », le reste du site fonctionne | vérifié (tests) |
| La clé n'est lue que par le serveur ; absente des fichiers du site et du dépôt | vérifié (recherche dans les fichiers construits et dans le projet) |
| Quota par membre, une seule piste par question, erreurs 429, 502, 503 traduites | vérifié avec un serveur de test compatible |
| Script de saisie de la clé : saisie masquée, fichier en lecture restreinte, test de la clé | vérifié avec un serveur de test (clé acceptée, clé refusée, clé trop courte) |
| **Appel réel à Agnes AI avec la vraie clé** | **non vérifié** : à faire sur le VPS, étape 5 du guide |

La clé qui a été collée dans une conversation doit être considérée comme exposée : en créer une nouvelle sur agnes-ai.com et n'utiliser que celle-là sur le VPS.

## Ce qui n'a pas pu être vérifié ici

- L'appel réel à Agnes AI, et le respect de ses conditions d'utilisation pour un site public.
- L'appel réel à `api.github.com` depuis le VPS (testé avec un serveur de remplacement).
- Les étapes du script qui dépendent du vrai serveur : services systemd, pare-feu, certificat Let's Encrypt. Leur syntaxe est contrôlée (`bash -n`, `shellcheck`) ; la base, la configuration, le build et nginx ont été exécutés réellement.
- L'obtention d'un certificat pour un nom `sslip.io` : ce service gratuit est très utilisé, donc Let's Encrypt peut limiter les demandes. Un vrai nom de domaine est plus sûr.
- Le site sur de vrais téléphones et en connexion lente.

## Limites assumées (non corrigées, volontairement)

- **Next.js reste en version 14.2.35.** `npm audit` signale des avis corrigés seulement en version 15 ou 16. Monter de version à trois jours du dépôt aurait été risqué, et Next 15 embarque `sharp`/`libvips` (LGPL), ce que l'article 6 du règlement interdit. Les avis critiques concernent l'optimisation d'images (fermée) et les serveurs Windows (non concerné). Il reste des avis de déni de service.
- **Pas d'en-tête Content-Security-Policy** sur le site : Next.js 14 utilise des scripts en ligne, une politique stricte demanderait un travail à part.
- **Aucun e-mail envoyé** : mot de passe oublié et validation des recruteurs passent par l'équipe.
- **Supprimer un compte** efface aussi ses questions et les réponses des autres membres qui s'y trouvaient.
- **Messagerie sans temps réel**, connexion Google ou GitHub et version anglaise absentes (boutons désactivés, « bientôt »).

## Ce qui reste à faire par l'équipe

1. **Installer le site sur le VPS** en suivant `DEPLOIEMENT-VPS.md`, puis dérouler le parcours de vérification de l'étape 6.
2. **Créer une nouvelle clé Agnès** et la saisir à l'étape 5.
3. **Relire les pages Confidentialité et Conditions** : elles ont été rédigées pendant la révision, sans juriste. Vérifier en particulier le nom du responsable, l'adresse de contact et la phrase sur l'hébergement.
4. **Compléter `front/JOURNAL-IA.md`** (colonne « Relu et compris par ») et relire `DECLARATIONS-SOUMISSION.md`.
5. **Vérifier la titularité** avec chaque membre (projet hors mission d'une école ou d'un employeur, ou autorisation écrite).
6. **Déposer le projet** sur la plateforme avant le 15 novembre, 17 h 00 GMT, puis **voter** (vote des pairs obligatoire pour chaque membre, du 15 novembre 18 h 00 au 16 novembre 23 h 59, sous peine d'exclusion).
7. Ne plus utiliser la démonstration Vercel comme adresse du projet : elle affiche des données simulées et ne compte pas pour le règlement.
