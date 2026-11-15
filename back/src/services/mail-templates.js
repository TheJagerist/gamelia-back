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

function layout(title, bodyHtml, footer = 'Vous recevez ce message parce que vous avez créé un compte sur Gamelia.') {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="margin:0 0 16px;font-size:20px;font-weight:bold">Gamelia</p>
<h1 style="margin:0 0 16px;font-size:18px">${esc(title)}</h1>
${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#78716c">${footer}</p>
</div></body></html>`;
}

function recruiterApproved({ name, company }) {
  const url = `${siteUrl()}/connexion`;
  const subject = 'Votre compte recruteur Gamelia est validé';
  const text = [
    `Bonjour ${name},`,
    '',
    `Bonne nouvelle : l'équipe Gamelia a vérifié votre identité et validé le compte recruteur de ${company || 'votre entreprise'}.`,
    'Vous pouvez dès maintenant vous connecter, publier vos défis et contacter des développeurs.',
    '',
    `Se connecter : ${url}`,
    '',
    "L'équipe Gamelia",
  ].join('\n');
  const html = layout(
    'Votre compte recruteur est validé',
    `<p>Bonjour ${esc(name)},</p>
<p>Bonne nouvelle : l'équipe Gamelia a vérifié votre identité et validé le compte recruteur de <strong>${esc(company || 'votre entreprise')}</strong>.
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


// --- E-mails de suivi d'activité (voir services/notifier.js) -----------------------------------------------------------
// Un seul gabarit : titre, quelques phrases, un bouton vers la page concernée. Les textes des membres (titres, noms)
// n'apparaissent que dans le corps, échappés ; jamais dans l'objet.
function activity({ name, subject, title, lines, cta, path, settings = true, footerNote }) {
  const url = `${siteUrl()}${path}`;
  const settingsUrl = `${siteUrl()}/parametres`;
  const footerText = settings
    ? `Vous recevez cet e-mail parce que les notifications de votre compte Gamelia sont activées. Vous pouvez les modifier dans Paramètres : ${settingsUrl}`
    : footerNote || 'Message envoyé par Gamelia au sujet de votre compte.';
  const text = [`Bonjour ${name},`, '', ...lines, '', `${cta} : ${url}`, '', SIGN, '', footerText].join('\n');
  const footerHtml = settings
    ? `Vous recevez cet e-mail parce que les notifications de votre compte Gamelia sont activées. Vous pouvez les modifier dans <a href="${esc(settingsUrl)}" style="color:#78716c">Paramètres</a>.`
    : esc(footerNote || 'Message envoyé par Gamelia au sujet de votre compte.');
  const html = layout(
    title,
    `<p>Bonjour ${esc(name)},</p>
${lines.map((l) => `<p>${esc(l)}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${esc(url)}" style="background:#16a34a;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(cta)}</a></p>
<p>${SIGN}</p>`,
    footerHtml
  );
  return { subject, text, html };
}

const quote = (t) => `« ${t} »`;

// Recruteur
const newApplication = ({ name, devName, challengeTitle, path }) =>
  activity({
    name,
    subject: 'Nouvelle candidature sur votre défi Gamelia',
    title: 'Vous avez une nouvelle candidature',
    lines: [`${devName} vient de relever votre défi ${quote(challengeTitle)} et vous a envoyé sa solution.`, 'Consultez le code et la démo, puis donnez votre note et votre décision.'],
    cta: 'Voir la candidature',
    path,
  });

const challengePublished = ({ name, challengeTitle, path }) =>
  activity({
    name,
    subject: 'Votre défi est publié sur Gamelia',
    title: 'Votre défi est publié',
    lines: [`L'équipe Gamelia a validé votre défi ${quote(challengeTitle)}. Il est maintenant visible par les développeurs, qui peuvent y candidater.`, 'Vous serez prévenu par e-mail à chaque nouvelle candidature.'],
    cta: 'Voir mes défis',
    path,
    settings: false,
  });

const challengeRefused = ({ name, challengeTitle, path }) =>
  activity({
    name,
    subject: "Votre défi n'a pas été accepté sur Gamelia",
    title: "Votre défi n'a pas été accepté",
    lines: [`Après examen, l'équipe Gamelia n'a pas pu publier votre défi ${quote(challengeTitle)}.`, 'Vous pouvez le reprendre, le préciser et le soumettre de nouveau. En cas de doute, répondez à ce message.'],
    cta: 'Voir mes défis',
    path,
    settings: false,
  });

// Développeur : retours du recruteur
const applicationEvaluated = ({ name, challengeTitle, path }) =>
  activity({
    name,
    subject: 'Le recruteur a évalué votre candidature',
    title: 'Votre candidature a été évaluée',
    lines: [`Le recruteur a évalué votre solution au défi ${quote(challengeTitle)} : une note et un retour vous attendent.`],
    cta: 'Lire le retour',
    path,
  });

const applicationRetained = ({ name, company, challengeTitle, path }) =>
  activity({
    name,
    subject: 'Félicitations : votre candidature est retenue',
    title: 'Votre candidature est retenue',
    lines: [`Bonne nouvelle : ${company} a retenu votre solution au défi ${quote(challengeTitle)} et vous propose une collaboration.`, 'Lisez sa proposition et répondez-lui depuis Gamelia.'],
    cta: 'Lire la proposition',
    path,
  });

const applicationNotRetained = ({ name, challengeTitle, path }) =>
  activity({
    name,
    subject: "Votre candidature n'a pas été retenue",
    title: "Votre candidature n'a pas été retenue",
    lines: [`Le recruteur n'a pas retenu votre solution au défi ${quote(challengeTitle)}. Ce n'est pas un échec : le retour qu'il a laissé peut vous aider pour la suite.`, 'Beaucoup d’autres défis vous attendent.'],
    cta: 'Voir le retour',
    path,
  });

const recruiterContact = ({ name, from, company, path }) =>
  activity({
    name,
    subject: 'Un recruteur souhaite vous contacter sur Gamelia',
    title: 'Un recruteur vous a écrit',
    lines: [`${from} (${company}) vous a envoyé un message privé après avoir consulté votre profil.`, 'Répondez-lui directement depuis la messagerie de Gamelia.'],
    cta: 'Lire le message',
    path,
  });

const newPrivateMessage = ({ name, from, path }) =>
  activity({
    name,
    subject: 'Nouveau message privé sur Gamelia',
    title: 'Vous avez un nouveau message',
    lines: [`${from} vous a écrit sur Gamelia.`, 'Pour protéger votre vie privée, le contenu du message n’est pas recopié dans cet e-mail.'],
    cta: 'Ouvrir la conversation',
    path,
  });

// Développeur : défi de la plateforme
const challengeValidated = ({ name, challengeTitle, points, path }) =>
  activity({
    name,
    subject: 'Bravo ! Vous avez relevé un défi sur Gamelia',
    title: 'Bravo, défi relevé !',
    lines: [
      `Félicitations de la part de toute l'équipe Gamelia : votre solution au défi ${quote(challengeTitle)} est validée.`,
      `Vous gagnez ${points} points, et ce défi apparaît sur votre profil avec la mention « vérifié ».`,
      'Continuez : chaque défi réussi renforce votre portfolio aux yeux des recruteurs.',
    ],
    cta: 'Voir mon profil',
    path,
    settings: false,
  });

const challengeToReview = ({ name, challengeTitle, path }) =>
  activity({
    name,
    subject: 'Votre solution à un défi Gamelia doit être revue',
    title: 'Votre solution doit être revue',
    lines: [`L'équipe a relu votre solution au défi ${quote(challengeTitle)} : elle doit être corrigée avant d'être validée.`, 'Reprenez-la et envoyez une nouvelle version. Vous pouvez y arriver !'],
    cta: 'Reprendre le défi',
    path,
    settings: false,
  });

// Communauté
const answerReceived = ({ name, from, questionTitle, path }) =>
  activity({
    name,
    subject: 'Quelqu’un a répondu à votre question sur Gamelia',
    title: 'Vous avez une nouvelle réponse',
    lines: [`${from} a répondu à votre question ${quote(questionTitle)}.`],
    cta: 'Lire la réponse',
    path,
  });

const bestAnswer = ({ name, questionTitle, path }) =>
  activity({
    name,
    subject: 'Votre réponse a été choisie comme la meilleure',
    title: 'Meilleure réponse !',
    lines: [`Félicitations : votre réponse à la question ${quote(questionTitle)} a été choisie comme la meilleure. Vous gagnez 25 points.`],
    cta: 'Voir la question',
    path,
  });

const commentReceived = ({ name, from, what, path }) =>
  activity({
    name,
    subject: 'Nouveau commentaire sur Gamelia',
    title: 'Vous avez un nouveau commentaire',
    lines: [`${from} ${what}`],
    cta: 'Voir',
    path,
  });

const collaboration = ({ name, text, path }) =>
  activity({
    name,
    subject: 'Collaboration sur un projet Gamelia',
    title: 'Collaboration sur un projet',
    lines: [text],
    cta: 'Voir le projet',
    path,
    settings: false,
  });

// Administrateurs
const adminToValidate = ({ name, text, path }) =>
  activity({
    name,
    subject: 'Gamelia : un élément attend votre validation',
    title: 'Validation en attente',
    lines: [text],
    cta: 'Ouvrir l’espace admin',
    path,
    settings: false,
    footerNote: 'Message adressé aux administrateurs de Gamelia.',
  });

module.exports = {
  newApplication, challengePublished, challengeRefused, applicationEvaluated, applicationRetained, applicationNotRetained,
  recruiterContact, newPrivateMessage, challengeValidated, challengeToReview, answerReceived, bestAnswer, commentReceived,
  collaboration, adminToValidate,
  recruiterApproved, recruiterRefused, welcomeDeveloper, welcomeRecruiterPending, passwordReset, passwordChanged, esc };
