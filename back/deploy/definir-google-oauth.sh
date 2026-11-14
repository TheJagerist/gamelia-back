#!/usr/bin/env bash
# Active « Continuer avec Google » : enregistre l'identifiant et le secret du client OAuth Google dans back/.env.
# Le secret est saisi en masqué : il n'apparaît ni à l'écran, ni dans l'historique, ni dans les journaux.
#
#   sudo bash back/deploy/definir-google-oauth.sh
#
# Avant : créer le client sur https://console.cloud.google.com (voir DEPLOIEMENT-VPS.md, « Connexion avec Google »).
# Puis le script vérifie auprès de Google que l'identifiant et le secret vont ensemble, enregistre, et redémarre l'API.
#
# L'adresse de retour n'est PAS écrite dans .env : l'API la calcule à partir de FRONT_ORIGIN
# (<FRONT_ORIGIN>/api/auth/google/callback). Si le nom de domaine change, elle suit toute seule ;
# il restera seulement à l'ajouter dans la console Google.
set -euo pipefail

ENV_FILE="${ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env}"
[[ -f "$ENV_FILE" ]] || { echo "Fichier introuvable : $ENV_FILE (lancez d'abord installer-vps.sh)."; exit 1; }

ORIGINE="$(grep -E '^FRONT_ORIGIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || true)"
ORIGINE="${ORIGINE%/}"
[[ -n "$ORIGINE" ]] || { echo "FRONT_ORIGIN est absent de $ENV_FILE : impossible de calculer l'adresse de retour."; exit 1; }
CALLBACK="$ORIGINE/api/auth/google/callback"
echo "Adresse du site (« Origines JavaScript autorisées » chez Google) :"
echo "  $ORIGINE"
echo "Adresse de retour (« URI de redirection autorisés » chez Google) :"
echo "  $CALLBACK"
echo

read -rp "ID client (se termine par .apps.googleusercontent.com) : " ID
ID="$(printf '%s' "$ID" | tr -d '[:space:]')"
[[ "$ID" =~ ^[0-9]+-[A-Za-z0-9_]+\.apps\.googleusercontent\.com$ ]] || { echo "Cet ID client semble incorrect (attendu : 123456-abc.apps.googleusercontent.com). Rien n'a été modifié."; exit 1; }

read -rsp "Code secret du client (commence par GOCSPX-, rien ne s'affiche, c'est normal) : " SECRET
echo
SECRET="$(printf '%s' "$SECRET" | tr -d '[:space:]')"
[[ ${#SECRET} -ge 20 ]] || { echo "Ce secret semble trop court. Rien n'a été modifié."; exit 1; }
[[ "$SECRET" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Ce secret contient des caractères inattendus. Rien n'a été modifié."; exit 1; }

# Vérification AVANT d'écrire : un code bidon est refusé (« invalid_grant ») si l'identifiant et le secret sont bons,
# et « invalid_client » s'ils ne vont pas ensemble.
REP="$(printf 'client_id=%s&client_secret=%s&code=verification-gamelia&grant_type=authorization_code&redirect_uri=%s' "$ID" "$SECRET" "$CALLBACK" | curl -sS --max-time 20 \
  -H 'Accept: application/json' -X POST -d @- https://oauth2.googleapis.com/token || echo '{"error":"injoignable"}')"
case "$REP" in
  *invalid_client*) echo "Google refuse ce couple ID client / secret. Vérifiez-les sur console.cloud.google.com (Identifiants). Rien n'a été modifié."; exit 1 ;;
  *invalid_grant*) echo "Google reconnaît ce couple ID client / secret." ;;
  *injoignable*) echo "Google est injoignable depuis ce serveur : enregistrement sans vérification." ;;
  *) echo "Réponse inattendue de Google (enregistrement quand même) : $(printf '%s' "$REP" | head -c 200)" ;;
esac

# Réécriture sans passer le secret en argument d'une commande (il serait visible dans la liste des processus).
TMP="$(mktemp "$ENV_FILE.XXXXXX")"
grep -vE '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOOGLE_CALLBACK_URL)=' "$ENV_FILE" > "$TMP" || true
{
  printf 'GOOGLE_CLIENT_ID=%s\n' "$ID"
  printf 'GOOGLE_CLIENT_SECRET=%s\n' "$SECRET"
} >> "$TMP"
chown --reference="$ENV_FILE" "$TMP" && chmod 600 "$TMP"
mv "$TMP" "$ENV_FILE"
echo "Enregistré dans $ENV_FILE (secret de ${#SECRET} caractères, se terminant par …${SECRET: -4})."

if command -v systemctl >/dev/null && systemctl list-unit-files gamelia-api.service >/dev/null 2>&1; then
  systemctl restart gamelia-api
  sleep 2
  echo -n "Google vu par l'API : "
  curl -fsS http://127.0.0.1:4000/auth/google/etat || echo "API injoignable -> journalctl -u gamelia-api -n 30"
  echo
fi
unset SECRET
