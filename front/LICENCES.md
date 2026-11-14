# Composants et licences

Liste générée avec `npm run licences` (license-checker). Aucune dépendance sous GPL, AGPL ou LGPL.

## Dépendances directes (livrées au navigateur ou au serveur)

| Composant | Licence | Rôle |
|---|---|---|
| @fontsource-variable/bricolage-grotesque@5.3.0 | OFL-1.1 | Police unique de la charte (fichier woff2 servi par notre serveur) |
| lucide-react@0.468.0 | ISC | Icônes |
| next@14.2.35 | MIT | Framework (rendu, routes) |
| prism-react-renderer@2.4.1 | MIT | Coloration du code, chargée seulement sur les pages qui affichent du code |
| react-dom@18.3.1 | MIT | Interface |
| react@18.3.1 | MIT | Interface |

## Outils de développement (non livrés)

| Outil | Licence |
|---|---|
| typescript | Apache-2.0 |
| tailwindcss | MIT |
| eslint, eslint-config-next | MIT |
| @playwright/test | Apache-2.0 |
| license-checker | BSD-3-Clause |
| postcss, autoprefixer | MIT |

## Services externes

| Service | Usage | Conditions |
|---|---|---|
| YouTube (lecteur intégré youtube-nocookie.com) | Vidéos de démonstration, chargées au clic | Conditions d'utilisation des services d'API YouTube |
| Vimeo (lecteur intégré) | Vidéos de démonstration, chargées au clic | Conditions d'utilisation de Vimeo |
| Agnes AI (API compatible OpenAI, appelée par le back) | Réponses de l'assistante Agnès | Conditions d'utilisation d'Agnes AI |
| API publique de GitHub (appelée par le back, sans clé) | Vérification d'un compte GitHub par lecture de la bio publique | Conditions d'utilisation de l'API GitHub |
| Let's Encrypt (certbot, sur le serveur) | Certificat HTTPS | Conditions d'abonné Let's Encrypt |

## Toutes les dépendances de production (transitives comprises)

| Paquet | Licence |
|---|---|
| @fontsource-variable/bricolage-grotesque@5.3.0 | OFL-1.1 |
| @next/env@14.2.35 | MIT |
| @next/swc-linux-x64-gnu@14.2.33 | MIT |
| @next/swc-linux-x64-musl@14.2.33 | MIT |
| @playwright/test@1.56.1 | Apache-2.0 |
| @swc/counter@0.1.3 | Apache-2.0 |
| @swc/helpers@0.5.5 | Apache-2.0 |
| @types/prismjs@1.26.6 | MIT |
| busboy@1.6.0 | MIT |
| caniuse-lite@1.0.30001816 | CC-BY-4.0 |
| client-only@0.0.1 | MIT |
| clsx@2.1.1 | MIT |
| graceful-fs@4.2.11 | ISC |
| js-tokens@4.0.0 | MIT |
| loose-envify@1.4.0 | MIT |
| lucide-react@0.468.0 | ISC |
| nanoid@3.3.20 | MIT |
| next@14.2.35 | MIT |
| picocolors@1.1.1 | ISC |
| playwright-core@1.56.1 | Apache-2.0 |
| playwright@1.56.1 | Apache-2.0 |
| postcss@8.4.31 | MIT |
| prism-react-renderer@2.4.1 | MIT |
| react-dom@18.3.1 | MIT |
| react@18.3.1 | MIT |
| scheduler@0.23.2 | MIT |
| source-map-js@1.2.2 | BSD-3-Clause |
| streamsearch@1.1.0 | MIT |
| styled-jsx@5.1.1 | MIT |
| tslib@2.8.1 | 0BSD |
