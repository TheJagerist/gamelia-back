// Envoi d'e-mails par SMTP (nodemailer).
//
// Règles :
//  - jamais bloquant : une panne du serveur d'e-mails ne doit pas faire échouer une action du site (validation d'un
//    compte, par exemple). sendMail() ne lève jamais d'erreur : elle renvoie { sent, reason } et écrit dans les journaux ;
//  - facultatif : sans SMTP_HOST et MAIL_FROM, rien n'est envoyé et le site fonctionne normalement ;
//  - une seule nouvelle tentative, et seulement pour une panne passagère (réseau, réponse 4xx).
const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const m = env.mail;
  const isLocalRelay = ['localhost', '127.0.0.1', '::1'].includes(m.host);
  transporter = nodemailer.createTransport({
    host: m.host,
    port: m.port,
    secure: m.secure,
    // En production, on refuse d'envoyer sans chiffrement (sauf vers un relais installé sur le serveur lui-même).
    requireTLS: env.isProd && !m.secure && !isLocalRelay,
    auth: m.user ? { user: m.user, pass: m.password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

// « jean@exemple.com » -> « j***@exemple.com » : les journaux ne doivent pas contenir d'adresses complètes.
function maskAddress(addr) {
  const [local = '', domain = ''] = String(addr).split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

function isTransient(err) {
  if (err && typeof err.responseCode === 'number') return err.responseCode >= 400 && err.responseCode < 500;
  return Boolean(err && ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'ECONNREFUSED', 'EDNS'].includes(err.code));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendMail({ to, subject, text, html }) {
  const masked = maskAddress(to);
  if (!env.mail.enabled) {
    // eslint-disable-next-line no-console
    console.warn(`[mail] SMTP non configuré : « ${subject} » n'a pas été envoyé à ${masked}.`);
    return { sent: false, reason: 'non_configure' };
  }
  const message = { from: env.mail.from, to, subject, text, html, ...(env.mail.replyTo ? { replyTo: env.mail.replyTo } : {}) };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await getTransporter().sendMail(message);
      // eslint-disable-next-line no-console
      console.log(`[mail] envoyé : « ${subject} » à ${masked}`);
      return { sent: true };
    } catch (err) {
      if (attempt === 1 && isTransient(err)) {
        await wait(Number(process.env.MAIL_RETRY_DELAY_MS || 1500));
        continue;
      }
      // eslint-disable-next-line no-console
      console.error(`[mail] échec d'envoi à ${masked} : ${err.code || ''} ${err.message}`.trim());
      return { sent: false, reason: 'echec' };
    }
  }
  return { sent: false, reason: 'echec' };
}

// Envoi « et on n'attend pas » : la réponse de l'API part sans attendre le serveur d'e-mails.
function sendMailInBackground(mail) {
  sendMail(mail).catch(() => {}); // sendMail ne lève pas, ceci est un filet de sécurité
}

module.exports = { sendMail, sendMailInBackground, maskAddress };
