#!/usr/bin/env bash
# Enregistre la clé Agnès dans back/.env sur le serveur, sans jamais l'afficher :
# la saisie est masquée et la clé n'apparaît ni à l'écran, ni dans l'historique des commandes, ni dans les journaux.
#
#   sudo bash back/deploy/definir-cle-agnes.sh
#
# Puis le script redémarre l'API et vérifie que la clé est acceptée par Agnes AI.
set -euo pipefail

ENV_FILE="${ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env}"
[[ -f "$ENV_FILE" ]] || { echo "Fichier introuvable : $ENV_FILE (lancez d'abord installer-vps.sh)."; exit 1; }

read -rsp "Collez la clé Agnès puis appuyez sur Entrée (rien ne s'affiche, c'est normal) : " CLE
echo
CLE="$(printf '%s' "$CLE" | tr -d '[:space:]')"
[[ ${#CLE} -ge 20 ]] || { echo "Cette clé semble trop courte. Rien n'a été modifié."; exit 1; }
[[ "$CLE" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Cette clé contient des caractères inattendus. Rien n'a été modifié."; exit 1; }

# Réécriture du fichier sans passer la clé en argument d'une commande (elle serait visible dans la liste des processus).
TMP="$(mktemp "$ENV_FILE.XXXXXX")"
grep -v '^AGNES_API_KEY=' "$ENV_FILE" > "$TMP" || true
printf 'AGNES_API_KEY=%s\n' "$CLE" >> "$TMP"
chown --reference="$ENV_FILE" "$TMP" && chmod 600 "$TMP"
mv "$TMP" "$ENV_FILE"
echo "Clé enregistrée dans $ENV_FILE (${#CLE} caractères, se terminant par …${CLE: -4})."

if command -v systemctl >/dev/null && systemctl list-unit-files gamelia-api.service >/dev/null 2>&1; then
  systemctl restart gamelia-api
  sleep 2
  echo -n "État d'Agnès vu par l'API : "
  curl -fsS http://127.0.0.1:4000/agnes/etat || echo "API injoignable -> journalctl -u gamelia-api -n 30"
  echo
fi

# Vérification directe auprès d'Agnes AI : seule la réponse est affichée, jamais la clé.
URL="$(grep -E '^AGNES_API_URL=' "$ENV_FILE" | cut -d= -f2- || true)"; URL="${URL:-https://apihub.agnes-ai.com/v1}"
MODELE="$(grep -E '^AGNES_MODEL=' "$ENV_FILE" | cut -d= -f2- || true)"; MODELE="${MODELE:-agnes-2.0-flash}"
echo -n "Test de la clé auprès d'Agnes AI : "
CODE="$(printf 'header = "Authorization: Bearer %s"\n' "$CLE" | curl -sS -o /tmp/agnes-test.json -w '%{http_code}' -K - \
  -H 'Content-Type: application/json' --max-time 60 \
  -d "{\"model\":\"$MODELE\",\"messages\":[{\"role\":\"user\",\"content\":\"Réponds seulement : OK\"}],\"max_tokens\":20}" \
  "${URL%/}/chat/completions" || echo 000)"
case "$CODE" in
  200) echo "clé acceptée (réponse 200). Agnès est prête." ;;
  401|403) echo "clé REFUSÉE (réponse $CODE). Vérifiez la clé sur agnes-ai.com puis relancez ce script." ;;
  429) echo "clé reconnue, mais le quota est atteint pour le moment (réponse 429)." ;;
  000) echo "Agnes AI injoignable depuis ce serveur. Réessayez dans quelques minutes." ;;
  *) echo "réponse inattendue ($CODE) : $(head -c 300 /tmp/agnes-test.json 2>/dev/null)" ;;
esac
rm -f /tmp/agnes-test.json
unset CLE
