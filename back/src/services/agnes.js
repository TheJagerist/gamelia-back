// Client unique de l'API Agnes AI (compatible OpenAI : POST {AGNES_API_URL}/chat/completions).
// La clé reste côté serveur : le navigateur ne parle jamais directement à Agnes AI.
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const SYSTEM_PROMPT = [
  'Tu es Agnès, l’assistante technique de Gamelia, la plateforme africaine d’échange par et pour les développeurs.',
  'Tu aides des développeurs de tous niveaux, souvent sur téléphone et avec une connexion lente.',
  'Règles :',
  '- Réponds en français clair et simple (ou dans la langue de la question si elle n’est pas en français).',
  '- Va droit au but : explique d’abord la cause probable, puis la solution étape par étape.',
  '- Mets tout le code dans des blocs Markdown avec le langage indiqué (```python, ```js…). Code court, commenté, prêt à copier.',
  '- Reste concise : 250 mots au maximum hors code, sauf si la question l’exige vraiment.',
  '- Si tu n’es pas sûre ou s’il manque des informations, dis-le et indique ce qu’il faut vérifier ou préciser.',
  '- N’invente jamais de bibliothèque, de fonction ou de lien. Ne demande et ne répète jamais de mot de passe, clé ou donnée personnelle.',
  '- Tu parles de développement logiciel, d’apprentissage et de carrière tech. Pour un autre sujet, ramène poliment la discussion vers ces thèmes.',
].join('\n');

const isAvailable = () => Boolean(env.agnes.apiKey);

// Certains modèles de raisonnement renvoient leur réflexion entre balises <think> : on ne garde que la réponse.
function cleanReply(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

/**
 * Envoie une conversation à Agnès et renvoie le texte de sa réponse.
 * @param {{ role: 'user' | 'assistant', content: string }[]} messages
 * @param {{ maxTokens?: number }} [opts]
 */
async function ask(messages, { maxTokens = 1200 } = {}) {
  if (!isAvailable()) {
    throw new ApiError(503, 'Agnès n’est pas disponible pour le moment. L’équipe Gamelia doit configurer sa clé d’accès.', { code: 'agnes_indisponible' });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.agnes.timeoutMs);
  let res;
  try {
    res = await fetch(`${env.agnes.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.agnes.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        model: env.agnes.model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.4,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    const timeout = err && err.name === 'AbortError';
    // eslint-disable-next-line no-console
    console.error('[agnes] appel impossible :', timeout ? 'délai dépassé' : err && err.message);
    throw new ApiError(502, timeout ? 'Agnès met trop de temps à répondre. Réessayez dans un instant.' : 'Agnès est injoignable pour le moment. Réessayez dans un instant.', { code: 'agnes_erreur' });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* corps vide ou non JSON */
  }

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`[agnes] réponse ${res.status} :`, data && (data.error?.message || data.message));
    if (res.status === 429) throw new ApiError(429, 'Agnès reçoit beaucoup de demandes. Patientez une minute puis réessayez.', { code: 'agnes_occupee' });
    if (res.status === 401 || res.status === 403) {
      throw new ApiError(503, 'Agnès n’est pas disponible pour le moment (clé d’accès refusée). L’équipe Gamelia a été prévenue.', { code: 'agnes_indisponible' });
    }
    throw new ApiError(502, 'Agnès n’a pas pu répondre. Réessayez dans un instant.', { code: 'agnes_erreur' });
  }

  const reply = cleanReply(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
  if (!reply) throw new ApiError(502, 'Agnès n’a pas pu répondre. Reformulez votre demande ou réessayez.', { code: 'agnes_erreur' });
  return reply;
}

/** Construit la demande envoyée à Agnès pour une question du forum. */
function questionPrompt(q) {
  const parts = [`Titre : ${q.title}`];
  if (q.tags && q.tags.length) parts.push(`Technologies : ${q.tags.join(', ')}`);
  parts.push(`Description :\n${q.body}`);
  if (q.code_content) parts.push(`Code fourni (${q.code_lang}) :\n\`\`\`${q.code_lang}\n${q.code_content}\n\`\`\``);
  return [
    'Un membre de Gamelia a publié cette question sur le forum. Propose une première piste de réponse.',
    'La communauté répondra aussi : termine par une phrase indiquant ce qu’il faut vérifier ou préciser si ta piste ne suffit pas.',
    '',
    parts.join('\n\n'),
  ].join('\n');
}

module.exports = { ask, isAvailable, questionPrompt, SYSTEM_PROMPT };
