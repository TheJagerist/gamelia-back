#!/usr/bin/env bash
# Gamelia : lancement du site en local
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then echo "Installez Node.js (version LTS) depuis https://nodejs.org puis relancez."; exit 1; fi
[ -d node_modules ] || { echo "Première installation, quelques minutes..."; npm install; }
[ -f .env.local ] || cp .env.example .env.local
( sleep 8; (command -v open >/dev/null && open http://localhost:3000) || xdg-open http://localhost:3000 ) >/dev/null 2>&1 &
echo "Le site s'ouvre sur http://localhost:3000 (Ctrl+C pour arrêter)."
npm run dev
