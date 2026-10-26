# Déploiement sur le VPS Datacloud

Hypothèses : Ubuntu/Debian, un domaine `exemple.com` : front sur `gamelia.exemple.com`, API sur `api.gamelia.exemple.com` (même domaine parent).

## 1. Paquets système

```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib nginx certbot python3-certbot-nginx git ufw
# Node 20+ (via NodeSource ou nvm)
node -v   # >= 20
```

## 2. Base de données

```bash
sudo -u postgres psql <<'SQL'
CREATE USER gamelia_app WITH PASSWORD 'MOT_DE_PASSE_FORT';
CREATE DATABASE gamelia OWNER gamelia_app;
\c gamelia
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
SQL
```

## 3. Application

```bash
sudo useradd -m -s /bin/bash gamelia
sudo -u gamelia -i
git clone <URL_DU_DEPOT> gamelia-back && cd gamelia-back
git checkout v1.0-gel          # le tag du gel de code
npm ci --omit=dev
cp .env.example .env && chmod 600 .env
```

`.env` de production :

```
PORT=4000
NODE_ENV=production
FRONT_ORIGIN=https://gamelia.exemple.com
COOKIE_DOMAIN=.exemple.com
DATABASE_URL=postgres://gamelia_app:MOT_DE_PASSE_FORT@localhost:5432/gamelia
SESSION_SECRET=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
COOKIE_SECRET=<autre valeur aléatoire>
```

```bash
npm run migrate && npm run seed
npm run seed:demo        # données de démo pour le jury
ADMIN_EMAIL=admin@exemple.com ADMIN_PASSWORD='mot-de-passe-de-12+-caracteres' npm run create-admin
```

## 4. Service systemd

```bash
sudo cp deploy/gamelia-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now gamelia-api
sudo systemctl status gamelia-api
journalctl -u gamelia-api -f
```

## 5. nginx + HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/gamelia-api
# éditer server_name, puis :
sudo ln -s /etc/nginx/sites-available/gamelia-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.gamelia.exemple.com -d gamelia.exemple.com
```

Le front (Next.js) est servi sur le même VPS (`npm run build && npm start` derrière nginx sur `gamelia.exemple.com`), avec :
`NEXT_PUBLIC_API_MOCK=false` et `NEXT_PUBLIC_API_URL=https://api.gamelia.exemple.com`.

## 6. Pare-feu

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```
Le port 4000 et PostgreSQL (5432) ne doivent **pas** être exposés.

## 7. Vérifications

```bash
curl https://api.gamelia.exemple.com/sante          # {"ok":true}
```
Puis dans le navigateur : inscription, connexion, poser une question, voir les points. Si les actions d'écriture échouent en 403, vérifier `COOKIE_DOMAIN` et `FRONT_ORIGIN`.

## Mise à jour

```bash
cd ~/gamelia-back && git pull && npm ci --omit=dev && npm run migrate && sudo systemctl restart gamelia-api
```
