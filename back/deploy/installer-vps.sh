#!/usr/bin/env bash
# Gamelia : installation complète sur un VPS Ubuntu (22.04 ou 24.04), en une commande.
#
#   sudo DOMAINE=gamelia.exemple.com EMAIL_CONTACT=equipe@exemple.com bash back/deploy/installer-vps.sh
#
# Le script peut être relancé sans risque (mise à jour du code, reprise après une erreur) : il ne recrée
# ni la base de données ni les secrets s'ils existent déjà, et ne touche jamais aux données.
# Il n'installe AUCUN compte de démonstration et n'écrit AUCUNE clé Agnès : voir la fin du script.
#
# Résultat : https://DOMAINE (site) et https://DOMAINE/api (API), PostgreSQL en local, HTTPS, pare-feu,
# redémarrage automatique des services, sauvegarde quotidienne de la base.
set -euo pipefail

APP_USER=gamelia
APP_DIR=/home/$APP_USER/gamelia
DB_NAME=gamelia
DB_USER=gamelia_app
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Étapes à exécuter (toutes par défaut). Exemple pour ne refaire que le site : ETAPES="code dependances build services"
ETAPES="${ETAPES:-paquets swap utilisateur code base env dependances build services nginx parefeu https sauvegarde verification}"

etape() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
veut() { [[ " $ETAPES " == *" $1 "* ]]; }
en_tant_que_app() { sudo -u "$APP_USER" -H bash -lc "$1"; }

[[ $EUID -eq 0 ]] || { echo "Lancez ce script avec sudo (ou en root)."; exit 1; }

if [[ -z "${DOMAINE:-}" ]]; then read -rp "Nom de domaine du site (ex. gamelia.exemple.com) : " DOMAINE; fi
if [[ -z "${EMAIL_CONTACT:-}" ]]; then read -rp "Adresse e-mail de l'équipe (affichée sur le site, utilisée pour le certificat HTTPS) : " EMAIL_CONTACT; fi
DOMAINE="${DOMAINE#http://}"; DOMAINE="${DOMAINE#https://}"; DOMAINE="${DOMAINE%%/*}"
[[ "$DOMAINE" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo "Nom de domaine invalide : « $DOMAINE ». Une adresse IP seule ne permet pas le HTTPS (voir DEPLOIEMENT-VPS.md)."; exit 1; }
[[ "$EMAIL_CONTACT" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo "Adresse e-mail invalide : « $EMAIL_CONTACT »."; exit 1; }
[[ -f "$SRC_DIR/back/package.json" && -f "$SRC_DIR/front/package.json" ]] || { echo "Dossiers back/ et front/ introuvables à côté de ce script ($SRC_DIR)."; exit 1; }

export DEBIAN_FRONTEND=noninteractive

if veut paquets; then
  etape "1/14 Paquets système (PostgreSQL, nginx, certbot, Node.js 22)"
  apt-get update -y
  apt-get install -y sudo postgresql postgresql-contrib nginx certbot python3-certbot-nginx ufw curl ca-certificates rsync openssl cron
  if ! command -v node >/dev/null || (( $(node -p 'process.versions.node.split(".")[0]') < 20 )); then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
  echo "Node.js $(node -v), npm $(npm -v)"
  systemctl enable --now postgresql nginx
fi

if veut swap; then
  etape "2/14 Mémoire d'échange (la construction du site demande plus de 1 Go)"
  if [[ -z "$(swapon --show --noheadings)" ]] && (( $(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo) < 3500 )); then
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "2 Go de mémoire d'échange ajoutés."
  else
    echo "Rien à faire."
  fi
fi

if veut utilisateur; then
  etape "3/14 Utilisateur « $APP_USER » (le site ne tourne jamais en root)"
  id "$APP_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$APP_USER"
fi

if veut code; then
  etape "4/14 Copie du code dans $APP_DIR"
  mkdir -p "$APP_DIR"
  if [[ "$SRC_DIR" != "$APP_DIR" ]]; then
    # Les fichiers de configuration et les dossiers construits du serveur sont conservés.
    rsync -a --delete \
      --exclude node_modules --exclude .next --exclude .env --exclude .env.local \
      --exclude test-results --exclude playwright-report --exclude .git \
      "$SRC_DIR/" "$APP_DIR/"
  fi
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

ENV_BACK="$APP_DIR/back/.env"

if veut base; then
  etape "5/14 Base de données PostgreSQL"
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || sudo -u postgres psql -qc "CREATE ROLE $DB_USER LOGIN"
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  sudo -u postgres psql -qd "$DB_NAME" -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;'
  echo "Base « $DB_NAME » prête (accessible seulement depuis le serveur lui-même)."
fi

if veut env; then
  etape "6/14 Fichiers de configuration"
  if [[ ! -f "$ENV_BACK" ]]; then
    DB_PASS="$(openssl rand -hex 24)"
    sudo -u postgres psql -qc "ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASS'"
    cat > "$ENV_BACK" <<EOF
# Créé par installer-vps.sh le $(date +%F). Ne jamais copier ce fichier ailleurs ni le montrer.
PORT=4000
HOST=127.0.0.1
NODE_ENV=production
FRONT_ORIGIN=https://$DOMAINE
DATABASE_URL=postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
SESSION_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
COOKIE_DOMAIN=localhost
SESSION_TTL_DAYS=30
# Clé Agnès : à saisir avec  sudo bash $APP_DIR/back/deploy/definir-cle-agnes.sh
AGNES_API_KEY=
# E-mails automatiques (validation des recruteurs) : à saisir avec  sudo bash $APP_DIR/back/deploy/definir-smtp.sh
EOF
    echo "back/.env créé, avec un mot de passe de base de données et des secrets aléatoires."
  else
    sed -i "s#^FRONT_ORIGIN=.*#FRONT_ORIGIN=https://$DOMAINE#" "$ENV_BACK"
    echo "back/.env existant conservé (secrets, base de données et clé Agnès inchangés)."
  fi
  chown "$APP_USER:$APP_USER" "$ENV_BACK" && chmod 600 "$ENV_BACK"

  cat > "$APP_DIR/front/.env.local" <<EOF
# Créé par installer-vps.sh : site réel (aucune donnée simulée, aucun compte de démonstration).
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SITE_URL=https://$DOMAINE
NEXT_PUBLIC_CONTACT_EMAIL=$EMAIL_CONTACT
EOF
  chown "$APP_USER:$APP_USER" "$APP_DIR/front/.env.local"
fi

if veut dependances; then
  etape "7/14 Dépendances, tables et catalogues (pistes, défis, badges)"
  en_tant_que_app "cd '$APP_DIR/back' && npm ci --omit=dev --no-audit --no-fund && npm run migrate && npm run seed"
fi

if veut build; then
  etape "8/14 Construction du site (quelques minutes)"
  en_tant_que_app "cd '$APP_DIR/front' && npm ci --no-audit --no-fund && npm run build && rm -rf .next/standalone/public .next/standalone/.next/static && cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static"
fi

if veut services; then
  etape "9/14 Services (démarrage automatique, redémarrage en cas de panne)"
  install -m 644 "$APP_DIR/back/deploy/gamelia-api.service" "$APP_DIR/back/deploy/gamelia-front.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable gamelia-api gamelia-front >/dev/null
  systemctl restart gamelia-api gamelia-front
fi

if veut nginx; then
  etape "10/14 nginx (un seul domaine : / pour le site, /api pour l'API)"
  CONF=/etc/nginx/sites-available/gamelia
  # Si certbot a déjà ajouté le HTTPS à ce fichier, on ne l'écrase pas.
  if [[ ! -f "$CONF" ]] || ! grep -q 'managed by Certbot' "$CONF" || ! grep -q "server_name $DOMAINE;" "$CONF"; then
    sed "s/DOMAINE/$DOMAINE/g" "$APP_DIR/back/deploy/nginx-gamelia.conf" > "$CONF"
  fi
  ln -sf "$CONF" /etc/nginx/sites-enabled/gamelia
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
fi

if veut parefeu; then
  etape "11/14 Pare-feu (seuls SSH, HTTP et HTTPS sont ouverts)"
  ufw allow OpenSSH >/dev/null
  ufw allow 'Nginx Full' >/dev/null
  ufw --force enable >/dev/null
  ufw status | sed -n '1,12p'
fi

HTTPS_OK=1
if veut https; then
  etape "12/14 Certificat HTTPS (Let's Encrypt)"
  if ! certbot --nginx -d "$DOMAINE" --non-interactive --agree-tos -m "$EMAIL_CONTACT" --redirect; then
    HTTPS_OK=0
    echo
    echo "!! Le certificat n'a pas pu être obtenu. Cause la plus fréquente : le nom « $DOMAINE » ne pointe pas"
    echo "   encore vers l'adresse IP de ce serveur. Corrigez le DNS, attendez quelques minutes, puis relancez :"
    echo "   sudo DOMAINE=$DOMAINE EMAIL_CONTACT=$EMAIL_CONTACT ETAPES=\"https verification\" bash $APP_DIR/back/deploy/installer-vps.sh"
  fi
fi

if veut sauvegarde; then
  etape "13/14 Sauvegarde quotidienne de la base (7 jours conservés)"
  install -d -m 700 -o postgres -g postgres /var/backups/gamelia
  cat > /etc/cron.d/gamelia-sauvegarde <<EOF
# Gamelia : copie de la base chaque nuit à 2 h 30, dans /var/backups/gamelia (7 jours conservés).
30 2 * * * postgres pg_dump -Fc $DB_NAME > /var/backups/gamelia/$DB_NAME-\$(date +\%F).dump && find /var/backups/gamelia -name '*.dump' -mtime +7 -delete
EOF
  chmod 644 /etc/cron.d/gamelia-sauvegarde
  echo "Restauration : sudo -u postgres pg_restore --clean -d $DB_NAME /var/backups/gamelia/<fichier>.dump"
fi

if veut verification; then
  etape "14/14 Vérifications"
  sleep 3
  echo -n "API + base de données (en local) : "; curl -fsS http://127.0.0.1:4000/sante || echo "ÉCHEC -> journalctl -u gamelia-api -n 50"
  echo
  echo -n "Site (en local)                  : "; curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/ || echo "ÉCHEC -> journalctl -u gamelia-front -n 50"
  if (( HTTPS_OK )); then
    echo -n "Site en ligne                    : "; curl -fsS -o /dev/null -w '%{http_code}\n' "https://$DOMAINE/" || echo "ÉCHEC"
    echo -n "API en ligne                     : "; curl -fsS "https://$DOMAINE/api/sante" || echo "ÉCHEC"
    echo
  fi
fi

cat <<EOF

Installation terminée. Il reste deux commandes à lancer vous-même :

1. Créer le compte administrateur de l'équipe (mot de passe d'au moins 12 caractères) :
   cd $APP_DIR/back && sudo -u $APP_USER ADMIN_EMAIL='$EMAIL_CONTACT' ADMIN_PASSWORD='choisissez-un-mot-de-passe' ADMIN_NAME='Équipe Gamelia' npm run create-admin

2. Saisir la clé Agnès (elle n'est ni affichée ni gardée dans l'historique) :
   sudo bash $APP_DIR/back/deploy/definir-cle-agnes.sh

3. (Recommandé) Activer les e-mails automatiques envoyés aux recruteurs quand leur compte est validé ou refusé :
   sudo bash $APP_DIR/back/deploy/definir-smtp.sh

Puis ouvrez https://$DOMAINE dans un navigateur.
EOF
