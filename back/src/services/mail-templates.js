// Modèles d'e-mails (français). Chaque modèle renvoie { subject, text, html }.
// Toute valeur venant d'un membre (nom, entreprise) est échappée dans la version HTML.
const env = require('../config/env');

const esc = (v) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const siteUrl = () => env.frontOrigin.replace(/\/+$/, '');

function layout(title, bodyHtml) {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="margin:0 0 16px;font-size:20px;font-weight:bold">Gamelia</p>
<h1 style="margin:0 0 16px;font-size:18px">${esc(title)}</h1>
${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#78716c">Vous recevez ce message parce que vous avez créé un compte sur Gamelia.</p>
</div></body></html>`;
}

function recruiterApproved({ name, company }) {
  const url = `${siteUrl()}/connexion`;
  const subject = 'Votre compte recruteur Gamelia est validé';
  const text = [
    `Bonjour ${name},`,
    '',
    `Bonne nouvelle : le compte recruteur de ${company || 'votre entreprise'} a été validé par l'équipe Gamelia.`,
    'Vous pouvez dès maintenant vous connecter, publier vos défis et contacter des développeurs.',
    '',
    `Se connecter : ${url}`,
    '',
    "L'équipe Gamelia",
  ].join('\n');
  const html = layout(
    'Votre compte recruteur est validé',
    `<p>Bonjour ${esc(name)},</p>
<p>Bonne nouvelle : le compte recruteur de <strong>${esc(company || 'votre entreprise')}</strong> a été validé par l'équipe Gamelia.
Vous pouvez dès maintenant vous connecter, publier vos défis et contacter des développeurs.</p>
<p style="margin:24px 0"><a href="${esc(url)}" style="background:#16a34a;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Se connecter</a></p>
<p>L'équipe Gamelia</p>`
  );
  return { subject, text, html };
}

function recruiterRefused({ name, company }) {
  const subject = "Votre demande de compte recruteur Gamelia n'a pas pu être validée";
  const text = [
    `Bonjour ${name},`,
    '',
    `Après examen, l'équipe Gamelia n'a pas pu valider le compte recruteur de ${company || 'votre entreprise'}.`,
    "Si vous pensez qu'il s'agit d'une erreur, ou pour nous transmettre des informations complémentaires sur votre entreprise, répondez simplement à ce message.",
    '',
    "L'équipe Gamelia",
  ].join('\n');
  const html = layout(
    'Votre demande n’a pas pu être validée',
    `<p>Bonjour ${esc(name)},</p>
<p>Après examen, l'équipe Gamelia n'a pas pu valider le compte recruteur de <strong>${esc(company || 'votre entreprise')}</strong>.</p>
<p>Si vous pensez qu'il s'agit d'une erreur, ou pour nous transmettre des informations complémentaires sur votre entreprise, répondez simplement à ce message.</p>
<p>L'équipe Gamelia</p>`
  );
  return { subject, text, html };
}

const SIGN = "L'équipe Gamelia";

function welcomeDeveloper({ name }) {
  const url = `${siteUrl()}/connexion`;
  const subject = 'Bienvenue sur Gamelia';
  const text = [
    `Bonjour ${name},`,
    '',
    'Votre compte Gamelia est créé. Bienvenue dans la communauté des développeurs africains !',
    'Posez vos questions, apprenez avec les pistes, relevez des défis et présentez vos projets.',
    '',
    `Se connecter : ${url}`,
    '',
    SIGN,
  ].join('\n');
  const html = layout(
    'Bienvenue sur Gamelia',
    `<p>Bonjour ${esc(name)},</p>
<p>Votre compte Gamelia est créé. Bienvenue dans la communauté des développeurs africains !<br>Posez vos questions, apprenez avec les pistes, relevez des défis et présentez vos projets.</p>
<p style="margin:24px 0"><a href="${esc(url)}" style="background:#16a34a;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Se connecter</a></p>
<p>${SIGN}</p>`
  );
  return { subject, text, html };
}

function welcomeRecruiterPending({ name, company }) {
  const subject = 'Votre demande de compte recruteur Gamelia est bien reçue';
  const text = [
    `Bonjour ${name},`,
    '',
    `Nous avons bien reçu la demande de compte recruteur de ${company || 'votre entreprise'}.`,
    "Un administrateur la vérifie avant de l'activer. Vous recevrez un e-mail dès que la décision sera prise ; en attendant, vous ne pouvez pas encore vous connecter.",
    '',
    SIGN,
  ].join('\n');
  const html = layout(
    'Votre demande est bien reçue',
    `<p>Bonjour ${esc(name)},</p>
<p>Nous avons bien reçu la demande de compte recruteur de <strong>${esc(company || 'votre entreprise')}</strong>.</p>
<p>Un administrateur la vérifie avant de l'activer. Vous recevrez un e-mail dès que la décision sera prise ; en attendant, vous ne pouvez pas encore vous connecter.</p>
<p>${SIGN}</p>`
  );
  return { subject, text, html };
}

function passwordReset({ name, url, validityMinutes }) {
  const subject = 'Réinitialisation de votre mot de passe Gamelia';
  const text = [
    `Bonjour ${name},`,
    '',
    'Vous (ou quelqu\'un d\'autre) avez demandé à réinitialiser le mot de passe de votre compte Gamelia.',
    `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable ${validityMinutes} minutes, utilisable une seule fois) :`,
    url,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste inchangé.",
    '',
    SIGN,
  ].join('\n');
  const html = layout(
    'Réinitialisation de votre mot de passe',
    `<p>Bonjour ${esc(name)},</p>
<p>Vous (ou quelqu'un d'autre) avez demandé à réinitialiser le mot de passe de votre compte Gamelia.</p>
<p style="margin:24px 0"><a href="${esc(url)}" style="background:#16a34a;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Choisir un nouveau mot de passe</a></p>
<p style="font-size:14px">Ce lien est valable ${validityMinutes} minutes et ne peut servir qu'une seule fois.<br>Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br><span style="word-break:break-all">${esc(url)}</span></p>
<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste inchangé.</p>
<p>${SIGN}</p>`
  );
  return { subject, text, html };
}

function passwordChanged({ name }) {
  const url = `${siteUrl()}/mot-de-passe-oublie`;
  const subject = 'Votre mot de passe Gamelia a été modifié';
  const text = [
    `Bonjour ${name},`,
    '',
    'Le mot de passe de votre compte Gamelia vient d\'être modifié, et vos autres appareils ont été déconnectés.',
    `Si ce n'est pas vous, réinitialisez-le tout de suite : ${url}`,
    '',
    SIGN,
  ].join('\n');
  const html = layout(
    'Votre mot de passe a été modifié',
    `<p>Bonjour ${esc(name)},</p>
<p>Le mot de passe de votre compte Gamelia vient d'être modifié, et vos autres appareils ont été déconnectés.</p>
<p>Si ce n'est pas vous, <a href="${esc(url)}">réinitialisez-le tout de suite</a>.</p>
<p>${SIGN}</p>`
  );
  return { subject, text, html };
}

module.exports = { recruiterApproved, recruiterRefused, welcomeDeveloper, welcomeRecruiterPending, passwordReset, passwordChanged, esc };
