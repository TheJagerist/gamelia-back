# Gamelia

**La plateforme africaine d'échange, par et pour les développeurs.** Poser une question, apprendre en pratiquant, prouver ses compétences par des défis et des projets réels, être repéré par des recruteurs.

Projet présenté au **Concours CADEV 2026 by Systalink**.

- **Site en ligne** : https://gamelia.ge-tech.site
- **Hébergement** : serveur cloud Systalink / Datacloud (`vps-systalink`, Ubuntu 22.04), site et base de données sur le même serveur
- **Comptes de démonstration pour le jury** : un compte développeur (`gameliagroupe+jury@gmail.com`) et un compte recruteur (`gameliagroupe+recruteur@gmail.com`). Les mots de passe sont communiqués au jury par la plateforme du concours, pas dans ce dépôt.

## Ce que fait Gamelia

| Pour qui         | Ce qu'on peut faire                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Les développeurs | Poser et répondre à des questions, voter, gagner des points et des badges ; suivre des pistes d'apprentissage (Web, API, Git) avec un éditeur « Essayer » ; relever des défis ; publier des projets ; Ajoute des demos de leurs differents projets ; construire un portfolio où chaque preuve est marquée « vérifiée » ou « déclarée » ; échanger par messagerie privée |
| Les recruteurs   | S'inscrire et être validés par l'équipe, publier des défis, repérer des talents, les contacter, évaluer des candidatures                                                                                                                                                                                                                                                |
| L'équipe (admin) | Valider les recruteurs, les défis et les solutions, traiter les signalements                                                                                                                                                                                                                                                                                            |
| Tout le monde    | **Agnès**, l'assistante IA : une première piste sur chaque question et une discussion privée                                                                                                                                                                                                                                                                            |

### Ce qui distingue Gamelia

- **Une preuve, pas une déclaration.** Un badge « vérifié » signifie un fait constaté : défi réussi, piste terminée, projet relu, compte GitHub confirmé.
- **Agnès, l'assistante IA** (API Agnes AI). Sa réponse est signalée « IA », ne rapporte aucun point, et ne remplace pas la communauté.
- **Pensé pour les connexions lentes** : pages légères (116 Ko de JavaScript au plus par page), états de chargement et d'erreur sur chaque écran, interface utilisable sur téléphone.
- **Apprendre en pratiquant** : l'éditeur « Essayer » exécute le code HTML, CSS et JavaScript de l'apprenant dans un cadre isolé du navigateur. Rien n'est envoyé au serveur.
- **Connexion avec Google ou GitHub** en plus de l'e-mail, avec les seuls droits de base (nom et adresse e-mail).

## Technique

| Couche          | Choix                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| Site            | Next.js 14, TypeScript, Tailwind CSS                                                       |
| API             | Node.js 22, Express, validation avec zod                                                   |
| Base de données | PostgreSQL (migrations versionnées)                                                        |
| Serveur         | nginx (HTTPS Let's Encrypt), services systemd, pare-feu, sauvegarde quotidienne de la base |
| IA              | API Agnes AI, appelée par le serveur (la clé n'est jamais dans le navigateur)              |
| E-mails         | Brevo (SMTP) : bienvenue, validation ou refus d'un compte recruteur, mot de passe oublié, et suivi d'activité hors du site (candidatures, retours des recruteurs, défis relevés, réponses, messages)   |

Tout est détaillé dans `front/README.md`, `back/README.md` et `DEPLOIEMENT-VPS.md` (installation complète du serveur en une commande).

## Sécurité

- Mots de passe chiffrés (bcrypt), sessions par cookie `httpOnly` et `Secure`, protection CSRF.
- Limites de débit sur la connexion, entrées validées partout, liens externes limités à `https`.
- Connexion avec GitHub ou Google : jamais de liaison automatique à un compte existant sur la seule base de l'adresse e-mail.
- La base de données n'est pas accessible depuis Internet. L'API n'écoute que derrière nginx.
- Aucun secret dans le code : clés dans un fichier `.env` sur le serveur.

## Qualité vérifiée

| Contrôle                                                                 | Résultat                 |
| ------------------------------------------------------------------------ | ------------------------ |
| Tests de l'API sur une vraie base PostgreSQL                             | tous réussis             |
| Parcours navigateur (téléphone et ordinateur)                            | tous réussis             |
| Parcours réels (site + API + base + connexion GitHub et Google simulées) | tous réussis             |
| Licences (`npm run licences`)                                            | aucune GPL, AGPL ni LGPL |
| Vulnérabilités de l'API (`npm audit`)                                    | 0                        |

## Licences et usage de l'IA

- **Composants tiers** : licences MIT, ISC, BSD, Apache 2.0, SIL OFL. Liste complète dans `front/LICENCES.md` et `back/docs/LICENCES.md`.
- **Intelligence artificielle** : usage déclaré dans `front/JOURNAL-IA.md` (outils, parties concernées). Claude (Anthropic) a vérifier le code, il a aussi ecris les defis servant a faire les demos mais aussi pour la resolution des defis.

### **Déclaration d'utilisation de l'IA**

L'IA a été utilisée comme outil d'accompagnement pour orienter l'équipe dans la mise en place du Back-End, comprendre la structure du framework (dossiers `lib`, `components`, `tests`) et faciliter l'intégration de certaines fonctionnalités, notamment la messagerie. Elle a également servi d'assistance technique et de vérification. Toutefois, la conception, le développement, l'intégration et les tests ont été réalisés par les membres de l'équipe.l'équipe a relu, testé et peut expliquer chaque partie. L'assistante Agnès utilise l'API Agnes AI.

## Limites connues

Elles sont assumées et détaillées dans `back/docs/LIMITES.md` : messagerie sans temps réel (rafraîchissement automatique), pas d'envoi de fichiers, Next.js en version 14 (avis de sécurité connus, risques réduits), un compte Google ou GitHub n'est jamais relié automatiquement à un compte existant.

## L'équipe

| Membre | Rôle |
| ------ | ---- |

Sopi MEKOLLE Contenu, tests et présentation.
MOKELE Emmanuel Conception Back-End.
Maney LAMBA
GARNIER Leonce Développement Front-End.
ALILA Gaby Design UI/UX sur Figma, ergonomie et animations.
