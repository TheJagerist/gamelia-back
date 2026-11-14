#!/usr/bin/env bash
# Enregistre les réglages d'envoi d'e-mails (SMTP) dans back/.env sur le serveur, sans jamais afficher le mot de passe :
# la saisie est masquée et le mot de passe n'apparaît ni à l'écran, ni dans l'historique des commandes, ni dans les journaux.
#
#   sudo bash back/deploy/definir-smtp.sh
#
# Puis le script redémarre l'API et envoie un e-mail d'essai à l'adresse de votre choix.
set -euo pipefail

APP_BACK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$APP_BACK/.env}"
[[ -f "$ENV_FILE" ]] || { echo "Fichier introuvable : $ENV_FILE (lancez d'abord installer-vps.sh)."; exit 1; }

echo "Réglages SMTP : ils sont fournis par votre service d'e-mails (hébergeur du domaine, Brevo, Mailjet, Gmail avec mot de passe d'application, etc.)."
read -rp "Serveur SMTP (ex. smtp.exemple.com) : " HOTE
read -rp "Port [587] (587 = STARTTLS, 465 = TLS immédiat) : " PORT; PORT="${PORT:-587}"
read -rp "Identifiant SMTP (souvent une adresse e-mail) : " UTIL
read -rsp "Mot de passe SMTP (rien ne s'affiche, c'est normal) : " MDP; echo
read -rp "Adresse d'expéditeur (ex. no-reply@votre-domaine) : " DE
read -rp "Adresse de réponse de l'équipe (facultatif, Entrée pour passer) : " REPONSE

HOTE="$(printf '%s' "$HOTE" | tr -d '[:space:]')"
[[ "$HOTE" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Nom de serveur invalide. Rien n'a été modifié."; exit 1; }
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "Port invalide. Rien n'a été modifié."; exit 1; }
[[ "$DE" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo "Adresse d'expéditeur invalide. Rien n'a été modifié."; exit 1; }
[[ -z "$REPONSE" || "$REPONSE" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo "Adresse de réponse invalide. Rien n'a été modifié."; exit 1; }
[[ "$UTIL$MDP" != *$'\n'* && "$UTIL$MDP" != *\"* && "$MDP" != *'#'* && "$MDP" != *'\'* ]] || { echo "Le mot de passe ou l'identifiant contient un caractère non pris en charge (guillemet, # ou \\). Rien n'a été modifié."; exit 1; }
SECURE=false; [[ "$PORT" == "465" ]] && SECURE=true

# Réécriture du fichier sans passer le mot de passe en argument d'une commande (il serait visible dans la liste des processus).
TMP="$(mktemp "$ENV_FILE.XXXXXX")"
grep -vE '^(SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|SMTP_PASSWORD|MAIL_FROM|MAIL_REPLY_TO)=' "$ENV_FILE" > "$TMP" || true
{
  printf 'SMTP_HOST=%s\n' "$HOTE"
  printf 'SMTP_PORT=%s\n' "$PORT"
  printf 'SMTP_SECURE=%s\n' "$SECURE"
  printf 'SMTP_USER="%s"\n' "$UTIL"
  printf 'SMTP_PASSWORD="%s"\n' "$MDP"
  printf 'MAIL_FROM="Gamelia <%s>"\n' "$DE"
  [[ -n "$REPONSE" ]] && printf 'MAIL_REPLY_TO=%s\n' "$REPONSE"
} >> "$TMP"
chown --reference="$ENV_FILE" "$TMP" && chmod 600 "$TMP"
mv "$TMP" "$ENV_FILE"
echo "Réglages enregistrés dans $ENV_FILE (serveur $HOTE, port $PORT, expéditeur $DE)."

if command -v systemctl >/dev/null && systemctl list-unit-files gamelia-api.service >/dev/null 2>&1; then
  systemctl restart gamelia-api
  sleep 2
fi

read -rp "Adresse où envoyer un e-mail d'essai (Entrée pour ne pas tester) : " TEST
if [[ -n "$TEST" ]]; then
  [[ "$TEST" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo "Adresse d'essai invalide."; exit 1; }
  echo -n "E-mail d'essai : "
  RUN_AS=(); [[ $EUID -eq 0 ]] && id gamelia >/dev/null 2>&1 && RUN_AS=(sudo -u gamelia)
  if (cd "$APP_BACK" && TEST_TO="$TEST" "${RUN_AS[@]}" node -e "
    const { sendMail } = require('./src/services/mailer');
    sendMail({ to: process.env.TEST_TO, subject: 'Gamelia : e-mail d\'essai', text: 'Si vous lisez ce message, l\'envoi d\'e-mails de Gamelia fonctionne.' })
      .then((r) => { console.log(r.sent ? 'envoyé, vérifiez la boîte de réception (et les courriers indésirables).' : 'ÉCHEC (' + r.reason + '), voir : journalctl -u gamelia-api -n 30'); process.exit(r.sent ? 0 : 1); });
  "); then :; else echo "Vérifiez le serveur, le port, l'identifiant et le mot de passe, puis relancez ce script."; fi
fi
unset MDP
