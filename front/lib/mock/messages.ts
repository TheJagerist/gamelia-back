// Messagerie privée simulée. Elle applique les règles à reproduire côté API :
//  - il faut être connecté (développeur ou recruteur validé) ; l'admin n'a pas de messagerie ;
//  - on ne lit que ses propres conversations (sinon 404, sans révéler qu'elles existent) ;
//  - 1 à 1000 caractères par message, 10 messages par minute au maximum (429) ;
//  - un membre bloqué ne peut plus écrire, et on ne peut pas s'écrire à soi-même.
// Les données vivent dans le navigateur (démo uniquement) : elles ne sont pas partagées entre deux personnes.
import { ApiError } from '../api/errors';
import type { Role, Conversation, ConversationSummary, Message } from '../types';
import { load, net, now, pub, requireUser } from './server';

const KEY = 'gamelia-demo-messages-v1';
const MAX_LEN = 1000;
const MAX_PER_MINUTE = 10;
const MEMBERS: Role[] = ['developpeur', 'recruteur'];

interface DbMessage { id: string; authorId: string; body: string; createdAt: string }
interface DbConv { id: string; a: string; b: string; messages: DbMessage[]; lastRead: Record<string, string> }
interface Store { convs: DbConv[]; blocks: { by: string; target: string }[]; seq: number }

const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();

function fresh(): Store {
  return {
    seq: 100,
    blocks: [],
    convs: [
      {
        id: 'c1', a: 'u1', b: 'u2', lastRead: { u1: ago(300), u2: ago(10) },
        messages: [
          { id: 'm1', authorId: 'u2', createdAt: ago(1500), body: "Salut Awa, j'ai vu ta question sur la connexion à une API. Tu utilises quelle bibliothèque ?" },
          { id: 'm2', authorId: 'u1', createdAt: ago(1480), body: "Salut Koffi ! J'utilise requests en Python, mais je ne récupère rien côté page web." },
          { id: 'm3', authorId: 'u2', createdAt: ago(40), body: "Regarde si ta requête part bien en POST. Tu peux m'envoyer l'adresse que tu appelles ?" },
        ],
      },
      {
        id: 'c2', a: 'r1', b: 'u1', lastRead: { r1: ago(2650), u1: ago(2600) },
        messages: [
          { id: 'm4', authorId: 'r1', createdAt: ago(2900), body: "Bonjour Awa, j'ai lu votre profil et votre projet Bus Dakar. Kivu Tech cherche une aide ponctuelle en Python pour un script de rapports. Seriez-vous disponible ?" },
          { id: 'm5', authorId: 'u1', createdAt: ago(2700), body: "Bonjour Madame Mbuyi, merci pour votre message. Oui, je suis disponible le week-end. Quelle serait la durée de la mission ?" },
        ],
      },
      {
        id: 'c3', a: 'u7', b: 'u1', lastRead: { u7: ago(7800), u1: ago(7800) },
        messages: [
          { id: 'm6', authorId: 'u7', createdAt: ago(8000), body: 'Merci pour ta réponse sur pandas, ça marche !' },
          { id: 'm7', authorId: 'u1', createdAt: ago(7900), body: "Avec plaisir ! N'hésite pas si tu bloques ailleurs." },
        ],
      },
    ],
  };
}

let store: Store | null = null;

function db(): Store {
  if (store) return store;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    store = raw ? (JSON.parse(raw) as Store) : fresh();
  } catch {
    store = fresh();
  }
  return store as Store;
}

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db()));
  } catch {
    /* stockage indisponible : la démo continue en mémoire */
  }
}

export function reset() {
  store = fresh();
  save();
}

// ---------- Outils ----------
const sendLog: Record<string, number[]> = {};

function tooFast(userId: string): boolean {
  const t = Date.now();
  const recent = (sendLog[userId] || []).filter((x) => t - x < 60000);
  sendLog[userId] = recent;
  if (recent.length >= MAX_PER_MINUTE) return true;
  recent.push(t);
  return false;
}

const isBlocked = (by: string, target: string) => db().blocks.some((b) => b.by === by && b.target === target);
const otherOf = (c: DbConv, me: string) => (c.a === me ? c.b : c.a);

function cleanBody(body: string): string {
  const text = (body || '').trim();
  if (text.length < 1 || text.length > MAX_LEN) {
    throw new ApiError(400, `Votre message doit contenir entre 1 et ${MAX_LEN} caractères.`, 'validation', { body: `Entre 1 et ${MAX_LEN} caractères.` });
  }
  return text;
}

function assertCanWrite(meId: string, otherId: string) {
  if (isBlocked(meId, otherId)) throw new ApiError(403, 'Débloquez ce membre pour lui écrire.', 'bloque_par_moi');
  if (isBlocked(otherId, meId)) throw new ApiError(403, 'Vous ne pouvez pas écrire à ce membre.', 'bloque');
}

function mine(meId: string): DbConv[] {
  return db().convs.filter((c) => c.a === meId || c.b === meId);
}

function findConv(id: string, meId: string): DbConv {
  const c = mine(meId).find((x) => x.id === id);
  if (!c) throw new ApiError(404);
  return c;
}

function summary(c: DbConv, meId: string): ConversationSummary | null {
  const otherId = otherOf(c, meId);
  const other = load().users.find((u) => u.id === otherId);
  if (!other) return null; // compte supprimé : la conversation n'est plus listée
  const last = c.messages[c.messages.length - 1];
  const readAt = c.lastRead[meId] || '';
  return {
    id: c.id,
    with: pub(other),
    lastMessage: last ? { body: last.body, createdAt: last.createdAt, mine: last.authorId === meId } : null,
    unread: c.messages.filter((m) => m.authorId !== meId && m.createdAt > readAt).length,
    blockedByMe: isBlocked(meId, otherId),
  };
}

function toMessage(m: DbMessage, convId: string, meId: string): Message {
  return { id: m.id, conversationId: convId, body: m.body, createdAt: m.createdAt, mine: m.authorId === meId };
}

function push(c: DbConv, meId: string, body: string): Message {
  const d = db();
  const m: DbMessage = { id: `m${++d.seq}`, authorId: meId, body, createdAt: now() };
  c.messages.push(m);
  c.lastRead[meId] = m.createdAt;
  save();
  return toMessage(m, c.id, meId);
}

// ---------- API simulée ----------
export const messages = {
  async list(): Promise<ConversationSummary[]> {
    await net();
    const me = requireUser(MEMBERS);
    const list: ConversationSummary[] = [];
    mine(me.id).forEach((c) => {
      const s = summary(c, me.id);
      if (s) list.push(s);
    });
    return list.sort((x, y) => (y.lastMessage?.createdAt || '').localeCompare(x.lastMessage?.createdAt || ''));
  },

  async thread(id: string): Promise<Conversation> {
    await net();
    const me = requireUser(MEMBERS);
    const c = findConv(id, me.id);
    const s = summary(c, me.id);
    if (!s) throw new ApiError(404);
    return { ...s, messages: c.messages.map((m) => toMessage(m, c.id, me.id)) };
  },

  async send(id: string, body: string): Promise<Message> {
    await net();
    const me = requireUser(MEMBERS);
    const c = findConv(id, me.id);
    const text = cleanBody(body);
    assertCanWrite(me.id, otherOf(c, me.id));
    if (tooFast(me.id)) throw new ApiError(429);
    return push(c, me.id, text);
  },

  async start(username: string, body: string): Promise<{ id: string }> {
    await net();
    const me = requireUser(MEMBERS);
    const other = load().users.find((u) => u.username === username);
    if (!other) throw new ApiError(404);
    if (other.id === me.id) throw new ApiError(400, 'Vous ne pouvez pas vous écrire à vous-même.', 'validation');
    if (other.role === 'admin') throw new ApiError(403);
    const text = cleanBody(body);
    assertCanWrite(me.id, other.id);
    if (tooFast(me.id)) throw new ApiError(429);
    const d = db();
    let c = d.convs.find((x) => (x.a === me.id && x.b === other.id) || (x.a === other.id && x.b === me.id));
    if (!c) {
      c = { id: `c${++d.seq}`, a: me.id, b: other.id, messages: [], lastRead: {} };
      d.convs.push(c);
    }
    push(c, me.id, text);
    return { id: c.id };
  },

  async markRead(id: string): Promise<void> {
    await net();
    const me = requireUser(MEMBERS);
    const c = findConv(id, me.id);
    c.lastRead[me.id] = now();
    save();
  },

  async unread(): Promise<number> {
    await net();
    const me = requireUser(MEMBERS);
    return mine(me.id).reduce((total, c) => total + (summary(c, me.id)?.unread || 0), 0);
  },

  async block(username: string): Promise<void> {
    await net();
    const me = requireUser(MEMBERS);
    const other = load().users.find((u) => u.username === username);
    if (!other || other.id === me.id) throw new ApiError(404);
    if (!isBlocked(me.id, other.id)) db().blocks.push({ by: me.id, target: other.id });
    save();
  },

  async unblock(username: string): Promise<void> {
    await net();
    const me = requireUser(MEMBERS);
    const other = load().users.find((u) => u.username === username);
    if (!other) throw new ApiError(404);
    const d = db();
    d.blocks = d.blocks.filter((b) => !(b.by === me.id && b.target === other.id));
    save();
  },
};
