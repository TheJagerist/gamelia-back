#!/usr/bin/env bash
# Active « Continuer avec GitHub » : enregistre l'identifiant et le secret de l'application OAuth GitHub dans back/.env.
# Le secret est saisi en masqué : il n'apparaît ni à l'écran, ni dans l'historique, ni dans les journaux.
#
#   sudo bash back/deploy/definir-github-oauth.sh
#
# Avant : créer l'application sur https://github.com/settings/developers -> « New OAuth App » (voir DEPLOIEMENT-VPS.md).
# Puis le script redémarre l'API et vérifie auprès de GitHub que l'identifiant et le secret vont ensemble.
set -euo pipefail

ENV_FILE="${ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env}"
[[ -f "$ENV_FILE" ]] || { echo "Fichier introuvable : $ENV_FILE (lancez d'abord installer-vps.sh)."; exit 1; }

ORIGINE="$(grep -E '^FRONT_ORIGIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || true)"
ORIGINE="${ORIGINE%/}"
[[ -n "$ORIGINE" ]] || { echo "FRONT_ORIGIN est absent de $ENV_FILE : impossible de calculer l'adresse de retour."; exit 1; }
CALLBACK="$ORIGINE/api/auth/github/callback"
echo "Adresse de retour à donner à GitHub (« Authorization callback URL ») :"
echo "  $CALLBACK"
echo

read -rp "Client ID (visible, commence souvent par Ov23 ou Iv1.) : " ID
ID="$(printf '%s' "$ID" | tr -d '[:space:]')"
[[ "$ID" =~ ^[A-Za-z0-9._-]{12,}$ ]] || { echo "Ce Client ID semble incorrect. Rien n'a été modifié."; exit 1; }

read -rsp "Client secret (rien ne s'affiche, c'est normal) : " SECRET
echo
SECRET="$(printf '%s' "$SECRET" | tr -d '[:space:]')"
[[ ${#SECRET} -ge 20 ]] || { echo "Ce secret semble trop court. Rien n'a été modifié."; exit 1; }
[[ "$SECRET" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Ce secret contient des caractères inattendus. Rien n'a été modifié."; exit 1; }

# Vérification AVANT d'écrire : un code bidon est refusé de la même façon quel que soit le client,
# sauf si l'identifiant ou le secret est faux (« incorrect_client_credentials »).
REP="$(printf 'client_id=%s&client_secret=%s&code=verification-gamelia' "$ID" "$SECRET" | curl -sS --max-time 20 \
  -H 'Accept: application/json' -X POST -d @- https://github.com/login/oauth/access_token || echo '{"error":"injoignable"}')"
case "$REP" in
  *incorrect_client_credentials*) echo "GitHub refuse ce couple identifiant / secret. Vérifiez-les sur github.com/settings/developers. Rien n'a été modifié."; exit 1 ;;
  *bad_verification_code*) echo "GitHub reconnaît ce couple identifiant / secret." ;;
  *injoignable*) echo "GitHub est injoignable depuis ce serveur : enregistrement sans vérification." ;;
  *) echo "Réponse inattendue de GitHub (enregistrement quand même) : $(printf '%s' "$REP" | head -c 200)" ;;
esac

# Réécriture sans passer le secret en argument d'une commande (il serait visible dans la liste des processus).
TMP="$(mktemp "$ENV_FILE.XXXXXX")"
grep -vE '^(GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET|GITHUB_CALLBACK_URL)=' "$ENV_FILE" > "$TMP" || true
{
  printf 'GITHUB_CLIENT_ID=%s\n' "$ID"
  printf 'GITHUB_CLIENT_SECRET=%s\n' "$SECRET"
  printf 'GITHUB_CALLBACK_URL=%s\n' "$CALLBACK"
} >> "$TMP"
chown --reference="$ENV_FILE" "$TMP" && chmod 600 "$TMP"
mv "$TMP" "$ENV_FILE"
echo "Enregistré dans $ENV_FILE (secret de ${#SECRET} caractères, se terminant par …${SECRET: -4})."

if command -v systemctl >/dev/null && systemctl list-unit-files gamelia-api.service >/dev/null 2>&1; then
  systemctl restart gamelia-api
  sleep 2
  echo -n "GitHub vu par l'API : "
  curl -fsS http://127.0.0.1:4000/auth/github/etat || echo "API injoignable -> journalctl -u gamelia-api -n 30"
  echo
fi
unset SECRET
