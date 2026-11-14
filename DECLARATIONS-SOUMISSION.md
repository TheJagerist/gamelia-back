# Déclarations à faire lors de la soumission (brouillon)

Règlement du Concours CADEV 2026, article 6. Ce document est un **brouillon préparé pendant la révision finale** : chaque membre de l'équipe doit le relire, le corriger si besoin et n'envoyer que ce qui est exact. Les déclarations engagent les membres, pas l'outil qui a aidé à les rédiger.

## 1. Produit Datacloud utilisé

- Serveur cloud (VPS) Datacloud, Ubuntu. *À compléter : référence de la commande, région, date d'achat.*
- *Le cas échéant : nom de domaine acheté sur Datacloud.*
- Adresse du projet déployé : `https://…` *(à compléter)*

## 2. Originalité et titularité

À déclarer par **chaque membre**, personnellement :

- le projet a été réalisé pour l'essentiel par l'équipe pendant la durée du Concours ; il n'existait pas avant ;
- il a été créé en dehors de toute mission confiée par un employeur, un client ou un établissement d'enseignement susceptible d'en revendiquer les droits. *Si le projet a un lien avec un cours, un stage ou un travail noté, il faut l'autorisation écrite de l'établissement ou de l'employeur : à vérifier par chaque membre avant de déclarer.*
- éléments de code antérieurs au Concours appartenant à un membre : *aucun / à lister*.

## 3. Composants tiers et licences

Aucun composant sous licence à réciprocité (GPL, AGPL, LGPL). Contrôle automatique : `npm run licences` dans `front/` et dans `back/` (échoue si une telle licence apparaît). Listes complètes, dépendances indirectes comprises : `front/LICENCES.md` et `back/docs/LICENCES.md`.

| Composant | Licence | Rôle |
|---|---|---|
| Next.js 14, React 18 | MIT | site web |
| Tailwind CSS (outil de build) | MIT | mise en forme |
| lucide-react | ISC | icônes |
| prism-react-renderer | MIT | coloration du code |
| Bricolage Grotesque (police) | SIL OFL 1.1 | typographie |
| Express 4, cors, helmet, cookie-parser, express-rate-limit | MIT | API |
| pg (client PostgreSQL) | MIT | accès à la base |
| zod | MIT | validation des entrées |
| bcryptjs | MIT | chiffrement des mots de passe |
| dotenv | BSD-2-Clause | configuration |
| uuid | MIT | identifiants |
| nodemailer | MIT-0 (MIT sans obligation de citer l'auteur) | envoi des e-mails automatiques |

Logiciels du serveur (non modifiés, non distribués avec le projet) : Ubuntu, PostgreSQL (licence PostgreSQL), nginx (BSD-2-Clause), Node.js (MIT), certbot (Apache-2.0).

Services extérieurs appelés par la solution : Agnes AI (assistante Agnès), API publique de GitHub (vérification de compte), YouTube et Vimeo (lecteurs vidéo intégrés), Let's Encrypt (certificat HTTPS), service d'envoi d'e-mails SMTP (à préciser une fois choisi).

## 4. Usage de l'intelligence artificielle

Journal détaillé : `front/JOURNAL-IA.md`. Résumé :

| Outil | Parties du projet concernées |
|---|---|
| Claude (Anthropic) | code initial du front à partir du cahier des charges ; assemblage front + back ; routes de messagerie et d'Agnès ; révision finale (sécurité, validation, pages légales, vérification GitHub, scripts de déploiement, tests, documentation) |
| *Autres outils utilisés par les membres* | *à compléter (par exemple pour le back, le design, les textes)* |
| Agnes AI | ce n'est pas un outil de développement : c'est le service qui fait fonctionner l'assistante Agnès dans le site |

Avant de déclarer :

- compléter la colonne « Relu et compris par » de `front/JOURNAL-IA.md` : seuls les membres peuvent l'attester ;
- vérifier que l'usage de chaque outil respecte ses conditions d'utilisation, y compris la clé Agnes AI (offre gratuite : usage autorisé pour un site public ?) ;
- le jury note la **maîtrise** de la solution, y compris des parties produites avec l'IA (annexe 1, 30 % de la note) : chaque membre doit pouvoir expliquer les points de la section suivante.

## 5. Ce que chaque membre doit savoir expliquer au jury

1. **Les deux modes du front** (site réel par défaut, démonstration avec `NEXT_PUBLIC_API_MOCK=true`) et pourquoi le site en ligne ne contient aucune donnée simulée.
2. **La connexion** : mot de passe chiffré avec bcrypt, session dans un cookie `httpOnly`, jeton CSRF renvoyé dans un en-tête, limite de 10 tentatives par minute.
3. **Vérifié ou déclaré** : ce que Gamelia vérifie réellement (défi réussi, piste terminée, projet relu, compte GitHub confirmé par un code placé dans la bio) et ce qui reste déclaratif.
4. **Les points** : barème, plafond de 200 points par jour, aucun point sur son propre contenu.
5. **Agnès** : la clé reste sur le serveur, quota par membre, une seule piste par question, que se passe-t-il si le service est indisponible.
6. **Le déploiement** : nginx devant le site et l'API sur un seul domaine, PostgreSQL non exposé, services systemd, HTTPS, sauvegarde.
7. **Les limites connues** (`back/docs/LIMITES.md`) : pas d'e-mail, pas de temps réel dans la messagerie, version de Next.js.
