// Serveur simulé : reproduit les règles prévues côté API (rôles, points, plafond, validations)
// pour développer sans attendre les routes. Les données vivent dans le navigateur (démo uniquement).
import { ApiError } from '../api/errors';
import type {
  Answer, Application, Badge, Challenge, FeedItem, LeaderboardRow, Lesson, Level, Notification, Page, PortfolioItem,
  PracticalSubmission, Progression, Project, ProjectSummary, PublicProfile, PublicUser, Question, QuestionSummary, QuizResult,
  RecruiterChallenge, Report, Role, Settings, Track, User,
} from '../types';
import * as seed from './seed';

const STORE_KEY = 'gamelia-demo-v4';
const SESSION_KEY = 'gamelia-demo-session';
const PAGE_SIZE = 6;
const DAILY_CAP = 200;

export type Db = {
  users: seed.DbUser[];
  questions: seed.DbQuestion[];
  projects: seed.DbProject[];
  recruiterChallenges: seed.DbRecruiterChallenge[];
  applications: seed.DbApplication[];
  submissions: seed.DbSubmission[];
  reports: seed.DbReport[];
  notifications: seed.DbNotification[];
  progress: typeof seed.progressSeed;
  votes: Record<string, 1 | -1>; // `${userId}:${targetId}`
  settings?: Record<string, Settings>;
  seq: number;
};

let db: Db | null = null;

function fresh(): Db {
  return JSON.parse(
    JSON.stringify({
      users: seed.users, questions: seed.questions, projects: seed.projects, recruiterChallenges: seed.recruiterChallenges,
      applications: seed.applications, submissions: seed.submissions, reports: seed.reports, notifications: seed.notifications,
      progress: seed.progressSeed, votes: {}, seq: 100,
    }),
  );
}

export function load(): Db {
  if (db) return db;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORE_KEY) : null;
    db = raw ? (JSON.parse(raw) as Db) : fresh();
  } catch {
    db = fresh();
  }
  return db!;
}

function save() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch {
    /* stockage indisponible : la démo continue en mémoire */
  }
}

export function resetDemo() {
  db = fresh();
  save();
}

const id = (p: string) => `${p}${++load().seq}`;
export const now = () => new Date().toISOString();
const wait = (ms = 280 + Math.random() * 320) => new Promise((r) => setTimeout(r, ms));

// Permet de montrer l'état d'erreur : ajouter ?demo=erreur à l'adresse.
export async function net() {
  await wait();
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'erreur') {
    throw new ApiError(500);
  }
}

function paginate<T>(items: T[], page = 1, size = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((p - 1) * size, p * size), page: p, pageCount, total: items.length };
}

const levelFor = (points: number): Level => (points >= 2000 ? 'Confirmé' : points >= 500 ? 'Intermédiaire' : 'Débutant');

export function pub(u: seed.DbUser): PublicUser {
  const { id: uid, username, name, role, country, city, bio, avatarUrl, skills, level, points, githubVerified, links, joinedAt, company } = u;
  const showCity = load().settings?.[uid]?.privacy.afficherVille !== false;
  return { id: uid, username, name, role, country, city: showCity ? city : undefined, bio, avatarUrl, skills, level, points, githubVerified, links, joinedAt, company };
}
const userById = (uid: string) => {
  const u = load().users.find((x) => x.id === uid);
  if (!u) throw new ApiError(404);
  return u;
};
const pubById = (uid: string) => pub(userById(uid));

// ---------- Session ----------
function sessionId(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function current(): seed.DbUser | null {
  const sid = sessionId();
  return sid ? load().users.find((u) => u.id === sid) || null : null;
}
export function requireUser(roles?: Role[]): seed.DbUser {
  const u = current();
  if (!u) throw new ApiError(401);
  if (roles && !roles.includes(u.role)) throw new ApiError(403);
  if (u.role === 'recruteur' && u.recruiterStatus !== 'valide') throw new ApiError(403, 'Votre compte recruteur attend la validation de l’équipe.', 'recruteur_non_valide');
  return u;
}
function toMe(u: seed.DbUser): User {
  const { password: _pw, ...rest } = u;
  void _pw;
  return rest;
}

function progressOf(uid: string) {
  const d = load();
  if (!d.progress[uid]) d.progress[uid] = { lessonsDone: [], challengeStatus: {}, badgeIds: [], history: [] };
  return d.progress[uid];
}

function todayPoints(uid: string) {
  const today = new Date().toISOString().slice(0, 10);
  return progressOf(uid).history.filter((h) => h.date.slice(0, 10) === today).reduce((s, h) => s + h.points, 0);
}

/** Ajoute des points en respectant le plafond quotidien (anti-triche). Renvoie les points réellement crédités. */
function award(uid: string, points: number, label: string): number {
  const u = userById(uid);
  if (u.role !== 'developpeur') return 0;
  const room = Math.max(0, DAILY_CAP - todayPoints(uid));
  const credited = Math.min(points, room);
  if (credited > 0) {
    u.points += credited;
    u.level = levelFor(u.points);
    progressOf(uid).history.unshift({ label, points: credited, date: now() });
  }
  return credited;
}

function giveBadge(uid: string, badgeId: string): Badge | undefined {
  const p = progressOf(uid);
  if (p.badgeIds.includes(badgeId)) return undefined;
  p.badgeIds.push(badgeId);
  const b = seed.badges.find((x) => x.id === badgeId);
  if (b) notify(uid, 'badge', `Vous avez obtenu le badge « ${b.name} ».`, '/progression');
  return b ? { ...b, earnedAt: now() } : undefined;
}

function notify(userId: string, kind: seed.DbNotification['kind'], text: string, href: string) {
  const n = load().settings?.[userId]?.notify;
  const off = n && ((kind === 'reponse' && !n.reponses) || (kind === 'commentaire' && !n.commentaires) || (kind === 'badge' && !n.badges) || (kind === 'candidature' && !n.candidatures));
  if (off) return;
  load().notifications.unshift({ id: id('n'), userId, kind, text, href, read: false, date: now() });
}

// ---------- Authentification ----------
let githubPending = false;

export const auth = {
  async me(): Promise<User | null> {
    await wait(120);
    const u = current();
    return u ? toMe(u) : null;
  },
  async login(email: string, password: string): Promise<User> {
    await net();
    const u = load().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) throw new ApiError(400, 'Adresse e-mail ou mot de passe incorrect.', 'identifiants');
    if (u.role === 'recruteur' && u.recruiterStatus !== 'valide') {
      throw new ApiError(403, "Votre compte recruteur n'est pas encore validé. L'équipe Gamelia vous écrit dès qu'il l'est, en général sous 24 h.", 'recruteur_non_valide');
    }
    window.localStorage.setItem(SESSION_KEY, u.id);
    return toMe(u);
  },
  async register(input: { role: 'developpeur' | 'recruteur'; name: string; email: string; password: string; country: string; company?: string; acceptTerms: boolean }): Promise<User | { pending: true }> {
    await net();
    const d = load();
    const fields: Record<string, string> = {};
    if (input.name.trim().length < 2) fields.name = 'Indiquez votre nom.';
    if (!/^\S+@\S+\.\S+$/.test(input.email)) fields.email = 'Adresse e-mail invalide.';
    if (input.password.length < 8) fields.password = 'Au moins 8 caractères.';
    if (input.role === 'recruteur' && !input.company?.trim()) fields.company = "Indiquez le nom de l'entreprise.";
    if (input.acceptTerms !== true) fields.acceptTerms = 'Vous devez accepter les conditions d’utilisation et la politique de confidentialité.';
    if (Object.keys(fields).length) throw new ApiError(400, 'Certaines informations sont incorrectes.', 'validation', fields);
    if (d.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new ApiError(409, 'Un compte existe déjà avec cette adresse e-mail.', 'email', { email: 'Adresse déjà utilisée.' });
    const base = input.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
    const u: seed.DbUser = {
      id: id('u'), username: d.users.some((x) => x.username === base) ? `${base}.${d.seq}` : base, name: input.name.trim(), email: input.email.trim(),
      password: input.password, role: input.role, country: input.country, bio: '', skills: [], level: 'Débutant', points: 0, githubVerified: false,
      links: [], joinedAt: now(), company: input.company?.trim(), recruiterStatus: input.role === 'recruteur' ? 'en_attente' : undefined,
    };
    d.users.push(u);
    if (u.role === 'recruteur') {
      d.users.filter((x) => x.role === 'admin').forEach((a) => notify(a.id, 'validation', `Nouveau compte recruteur à valider : ${u.company}.`, '/admin/validations'));
      save();
      return { pending: true };
    }
    window.localStorage.setItem(SESSION_KEY, u.id);
    save();
    return toMe(u);
  },
  async logout() {
    await wait(100);
    window.localStorage.removeItem(SESSION_KEY);
  },
  async updateProfile(patch: Partial<Pick<User, 'name' | 'bio' | 'country' | 'city' | 'skills' | 'links' | 'following'>> & { avatarUrl?: string | null }): Promise<User> {
    await net();
    const u = requireUser();
    if (patch.name !== undefined && patch.name.trim().length < 2) throw new ApiError(400, 'Indiquez votre nom.', 'validation', { name: 'Indiquez votre nom.' });
    if (patch.bio && patch.bio.length > 280) throw new ApiError(400, 'La bio dépasse 280 caractères.', 'validation', { bio: '280 caractères maximum.' });
    Object.assign(u, { ...patch, avatarUrl: patch.avatarUrl === null ? undefined : patch.avatarUrl ?? u.avatarUrl });
    save();
    return toMe(u);
  },
  // Démonstration : le code est généré comme sur le vrai site, mais la bio GitHub n'est pas relue
  // (aucun appel réseau en mode simulé) : la vérification réussit dès qu'un code a été demandé.
  async githubCode(username: string): Promise<{ username: string; code: string; expiresAt: string }> {
    await net();
    requireUser(['developpeur']);
    const name = username.trim().replace(/^@/, '');
    if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(name)) {
      const msg = 'Indiquez votre nom d’utilisateur GitHub (lettres, chiffres et tirets), sans l’adresse complète.';
      throw new ApiError(400, msg, 'validation', { username: msg });
    }
    githubPending = true;
    return { username: name, code: `gamelia-${Math.random().toString(16).slice(2, 12).padEnd(10, '0')}`, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
  },
  async githubVerify(): Promise<User> {
    await net();
    const u = requireUser(['developpeur']);
    if (!githubPending) throw new ApiError(400, 'Votre code a expiré. Demandez un nouveau code puis recommencez.');
    githubPending = false;
    u.githubVerified = true;
    giveBadge(u.id, 'b8');
    save();
    return toMe(u);
  },
};

// ---------- Paramètres ----------
const DEFAULT_SETTINGS: Settings = {
  theme: 'systeme',
  language: 'fr',
  notify: { reponses: true, commentaires: true, badges: true, candidatures: true, resumeHebdo: false },
  privacy: { profilPublic: true, afficherVille: true, visibleRecruteurs: true },
};

export const settings = {
  async get(): Promise<Settings> {
    await net();
    const u = requireUserAny();
    const d = load();
    return JSON.parse(JSON.stringify(d.settings?.[u.id] ?? DEFAULT_SETTINGS));
  },
  async update(patch: Partial<Settings>): Promise<Settings> {
    await net();
    const u = requireUserAny();
    const d = load();
    d.settings = d.settings || {};
    const cur = d.settings[u.id] ?? JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    d.settings[u.id] = { ...cur, ...patch, notify: { ...cur.notify, ...patch.notify }, privacy: { ...cur.privacy, ...patch.privacy } };
    save();
    return d.settings[u.id];
  },
  async changePassword(current: string, next: string) {
    await net();
    const u = requireUserAny();
    if (u.password !== current) throw new ApiError(400, 'Le mot de passe actuel est incorrect.', 'validation', { current: 'Mot de passe incorrect.' });
    if (next.length < 8) throw new ApiError(400, 'Le nouveau mot de passe doit faire au moins 8 caractères.', 'validation', { next: 'Au moins 8 caractères.' });
    u.password = next;
    save();
  },
  async deleteAccount(password: string) {
    await net();
    const u = requireUserAny();
    if (u.password !== password) throw new ApiError(400, 'Mot de passe incorrect.', 'validation', { password: 'Mot de passe incorrect.' });
    if (u.role === 'admin') throw new ApiError(403, "Un compte admin ne peut pas être supprimé depuis l'interface.");
    const d = load();
    d.users = d.users.filter((x) => x.id !== u.id);
    window.localStorage.removeItem(SESSION_KEY);
    save();
  },
};

/** Comme requireUser, mais accepte aussi un recruteur en attente (il peut gérer ses paramètres). */
function requireUserAny(): seed.DbUser {
  const u = current();
  if (!u) throw new ApiError(401);
  return u;
}

// ---------- Questions ----------
function questionSummary(q: seed.DbQuestion): QuestionSummary {
  return { id: q.id, title: q.title, excerpt: q.body.slice(0, 160), tags: q.tags, author: pubById(q.authorId), createdAt: q.createdAt, votes: q.votes, answerCount: q.answers.length, hasBestAnswer: !!q.bestAnswerId };
}

export const questions = {
  async list(opts: { tag?: string; sort?: 'recentes' | 'sans-reponse' | 'votes'; page?: number; q?: string }): Promise<Page<QuestionSummary>> {
    await net();
    let list = [...load().questions];
    if (opts.tag) list = list.filter((q) => q.tags.includes(opts.tag!));
    if (opts.q) {
      const s = opts.q.toLowerCase();
      list = list.filter((q) => q.title.toLowerCase().includes(s) || q.body.toLowerCase().includes(s));
    }
    if (opts.sort === 'sans-reponse') list = list.filter((q) => q.answers.length === 0);
    if (opts.sort === 'votes') list.sort((a, b) => b.votes - a.votes);
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(list.map(questionSummary), opts.page);
  },
  async get(qid: string): Promise<Question> {
    await net();
    const q = load().questions.find((x) => x.id === qid);
    if (!q) throw new ApiError(404);
    const me = current();
    const v = (tid: string): 1 | -1 | 0 => (me ? load().votes[`${me.id}:${tid}`] || 0 : 0);
    const answers: Answer[] = q.answers
      .map((a) => ({ id: a.id, author: pubById(a.authorId), body: a.body, code: a.code, createdAt: a.createdAt, votes: a.votes, myVote: v(a.id), comments: a.comments.map((c) => ({ id: c.id, author: pubById(c.authorId), body: c.body, createdAt: c.createdAt })) }))
      .sort((a, b) => (a.id === q.bestAnswerId ? -1 : b.id === q.bestAnswerId ? 1 : b.votes - a.votes));
    return { ...questionSummary(q), body: q.body, code: q.code, myVote: v(q.id), bestAnswerId: q.bestAnswerId, answers };
  },
  async create(input: { title: string; body: string; tags: string[]; code?: { lang: string; content: string } }): Promise<{ id: string }> {
    await net();
    const u = requireUser(['developpeur']);
    const fields: Record<string, string> = {};
    if (input.title.trim().length < 10) fields.title = 'Le titre doit faire au moins 10 caractères.';
    if (input.body.trim().length < 20) fields.body = 'Décrivez votre problème en au moins 20 caractères.';
    if (!input.tags.length) fields.tags = 'Choisissez au moins un tag.';
    if (Object.keys(fields).length) throw new ApiError(400, 'Certaines informations sont incorrectes.', 'validation', fields);
    const q: seed.DbQuestion = { id: id('q'), title: input.title.trim(), body: input.body.trim(), tags: input.tags.slice(0, 4), code: input.code?.content.trim() ? input.code : undefined, authorId: u.id, createdAt: now(), votes: 0, answers: [] };
    load().questions.unshift(q);
    save();
    return { id: q.id };
  },
  async answer(qid: string, input: { body: string; code?: { lang: string; content: string } }): Promise<{ points: number }> {
    await net();
    const u = requireUser(['developpeur']);
    const q = load().questions.find((x) => x.id === qid);
    if (!q) throw new ApiError(404);
    if (input.body.trim().length < 10) throw new ApiError(400, 'Votre réponse doit faire au moins 10 caractères.', 'validation', { body: 'Au moins 10 caractères.' });
    q.answers.push({ id: id('a'), authorId: u.id, body: input.body.trim(), code: input.code?.content.trim() ? input.code : undefined, createdAt: now(), votes: 0, comments: [] });
    const pts = q.authorId === u.id ? 0 : award(u.id, 10, `Réponse à « ${q.title} »`);
    giveBadge(u.id, 'b1');
    if (q.authorId !== u.id) notify(q.authorId, 'reponse', `${u.name} a répondu à « ${q.title} »`, `/questions/${q.id}`);
    save();
    return { points: pts };
  },
  async comment(qid: string, answerId: string, body: string) {
    await net();
    const u = requireUser(['developpeur']);
    const q = load().questions.find((x) => x.id === qid);
    const a = q?.answers.find((x) => x.id === answerId);
    if (!q || !a) throw new ApiError(404);
    if (body.trim().length < 2) throw new ApiError(400, 'Le commentaire est vide.');
    a.comments.push({ id: id('c'), authorId: u.id, body: body.trim().slice(0, 500), createdAt: now() });
    if (a.authorId !== u.id) notify(a.authorId, 'commentaire', `${u.name} a commenté votre réponse.`, `/questions/${q.id}`);
    save();
  },
  async vote(qid: string, targetId: string, dir: 1 | -1): Promise<{ votes: number; myVote: 1 | -1 | 0 }> {
    await wait(150);
    const u = requireUser(['developpeur']);
    const d = load();
    const q = d.questions.find((x) => x.id === qid);
    if (!q) throw new ApiError(404);
    const target = targetId === q.id ? q : q.answers.find((a) => a.id === targetId);
    if (!target) throw new ApiError(404);
    if (target.authorId === u.id) throw new ApiError(403, 'Vous ne pouvez pas voter pour votre propre contenu.');
    const key = `${u.id}:${targetId}`;
    const prev = d.votes[key] || 0;
    const next = prev === dir ? 0 : dir;
    target.votes += next - prev;
    if (next) d.votes[key] = next;
    else delete d.votes[key];
    if (next === 1 && prev !== 1 && targetId !== q.id) award(target.authorId, 5, 'Réponse votée utile');
    save();
    return { votes: target.votes, myVote: next };
  },
  async markBest(qid: string, answerId: string): Promise<void> {
    await net();
    const u = requireUser(['developpeur']);
    const q = load().questions.find((x) => x.id === qid);
    const a = q?.answers.find((x) => x.id === answerId);
    if (!q || !a) throw new ApiError(404);
    if (q.authorId !== u.id) throw new ApiError(403, "Seul l'auteur de la question peut choisir la meilleure réponse.");
    q.bestAnswerId = a.id;
    if (a.authorId !== u.id) {
      award(a.authorId, 25, `Meilleure réponse sur « ${q.title} »`);
      giveBadge(a.authorId, 'b2');
      notify(a.authorId, 'reponse', `Votre réponse a été choisie comme meilleure réponse sur « ${q.title} ».`, `/questions/${q.id}`);
    }
    save();
  },
};

// ---------- Projets ----------
function projectSummary(p: seed.DbProject): ProjectSummary {
  return { id: p.id, title: p.title, summary: p.summary, techs: p.techs, owner: pubById(p.ownerId), hasVideo: !!p.videoUrl, videoUrl: p.videoUrl, seekingCollaborators: p.seekingCollaborators, createdAt: p.createdAt, validatedReviews: p.reviews.filter((r) => r.validatedByOwner).length };
}
export function isAllowedVideo(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return ['youtube.com', 'youtu.be', 'm.youtube.com', 'vimeo.com', 'player.vimeo.com'].includes(h);
  } catch {
    return false;
  }
}

export const projects = {
  async list(opts: { tech?: string; seeking?: boolean; page?: number; owner?: string }): Promise<Page<ProjectSummary>> {
    await net();
    let list = [...load().projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (opts.tech) list = list.filter((p) => p.techs.includes(opts.tech!));
    if (opts.seeking) list = list.filter((p) => p.seekingCollaborators);
    if (opts.owner) list = list.filter((p) => userById(p.ownerId).username === opts.owner);
    return paginate(list.map(projectSummary), opts.page);
  },
  async get(pid: string): Promise<Project> {
    await net();
    const p = load().projects.find((x) => x.id === pid);
    if (!p) throw new ApiError(404);
    const me = current();
    return {
      ...projectSummary(p), description: p.description, codeUrl: p.codeUrl,
      comments: p.comments.map((c) => ({ id: c.id, author: pubById(c.authorId), body: c.body, createdAt: c.createdAt })),
      reviews: p.reviews.map((r) => ({ id: r.id, author: pubById(r.authorId), rating: r.rating, body: r.body, createdAt: r.createdAt, validatedByOwner: r.validatedByOwner })),
      collabRequests: me && me.id === p.ownerId ? p.collabRequests.map((c) => ({ id: c.id, from: pubById(c.fromId), role: c.role, message: c.message, status: c.status, createdAt: c.createdAt })) : [],
    };
  },
  async create(input: { title: string; summary: string; description: string; techs: string[]; videoUrl?: string; codeUrl: string; seekingCollaborators: boolean }): Promise<{ id: string; points: number }> {
    await net();
    const u = requireUser(['developpeur']);
    const fields: Record<string, string> = {};
    if (input.title.trim().length < 5) fields.title = 'Au moins 5 caractères.';
    if (input.summary.trim().length < 10) fields.summary = 'Résumez le projet en une phrase.';
    if (!input.techs.length) fields.techs = 'Choisissez au moins une technologie.';
    if (input.videoUrl && !isAllowedVideo(input.videoUrl)) fields.videoUrl = 'Seuls les liens YouTube ou Vimeo sont acceptés.';
    if (!/^https:\/\//.test(input.codeUrl)) fields.codeUrl = 'Indiquez un lien https vers le code.';
    if (Object.keys(fields).length) throw new ApiError(400, 'Certaines informations sont incorrectes.', 'validation', fields);
    const p: seed.DbProject = { id: id('p'), title: input.title.trim(), summary: input.summary.trim(), description: input.description.trim(), techs: input.techs, ownerId: u.id, videoUrl: input.videoUrl || undefined, codeUrl: input.codeUrl, seekingCollaborators: input.seekingCollaborators, createdAt: now(), comments: [], reviews: [], collabRequests: [] };
    load().projects.unshift(p);
    const pts = award(u.id, 30, `Projet publié : ${p.title}`);
    if (p.videoUrl) giveBadge(u.id, 'b5');
    save();
    return { id: p.id, points: pts };
  },
  async comment(pid: string, body: string) {
    await net();
    const u = requireUser(['developpeur']);
    const p = load().projects.find((x) => x.id === pid);
    if (!p) throw new ApiError(404);
    if (body.trim().length < 2) throw new ApiError(400, 'Le commentaire est vide.');
    p.comments.push({ id: id('c'), authorId: u.id, body: body.trim().slice(0, 500), createdAt: now() });
    if (p.ownerId !== u.id) notify(p.ownerId, 'commentaire', `${u.name} a commenté votre projet « ${p.title} ».`, `/projets/${p.id}`);
    save();
  },
  async review(pid: string, rating: number, body: string) {
    await net();
    const u = requireUser(['developpeur']);
    const p = load().projects.find((x) => x.id === pid);
    if (!p) throw new ApiError(404);
    if (p.ownerId === u.id) throw new ApiError(403, 'Vous ne pouvez pas évaluer votre propre projet.');
    if (p.reviews.some((r) => r.authorId === u.id)) throw new ApiError(409, 'Vous avez déjà évalué ce projet.');
    if (rating < 1 || rating > 5 || body.trim().length < 10) throw new ApiError(400, 'Donnez une note et au moins une phrase de retour.');
    p.reviews.push({ id: id('rv'), authorId: u.id, rating, body: body.trim(), createdAt: now(), validatedByOwner: false });
    notify(p.ownerId, 'commentaire', `${u.name} a évalué votre projet « ${p.title} ».`, `/projets/${p.id}`);
    save();
  },
  async validateReview(pid: string, reviewId: string) {
    await net();
    const u = requireUser(['developpeur']);
    const p = load().projects.find((x) => x.id === pid);
    const r = p?.reviews.find((x) => x.id === reviewId);
    if (!p || !r) throw new ApiError(404);
    if (p.ownerId !== u.id) throw new ApiError(403, 'Seul le propriétaire du projet peut valider une revue.');
    r.validatedByOwner = true;
    award(r.authorId, 10, `Revue validée sur « ${p.title} »`);
    const validated = load().projects.flatMap((x) => x.reviews).filter((x) => x.authorId === r.authorId && x.validatedByOwner).length;
    if (validated >= 3) giveBadge(r.authorId, 'b6');
    save();
  },
  async requestCollab(pid: string, role: string, message: string) {
    await net();
    const u = requireUser(['developpeur']);
    const p = load().projects.find((x) => x.id === pid);
    if (!p) throw new ApiError(404);
    if (p.ownerId === u.id) throw new ApiError(403, 'C’est votre propre projet.');
    if (p.collabRequests.some((c) => c.fromId === u.id && c.status === 'en_attente')) throw new ApiError(409, 'Vous avez déjà une demande en attente sur ce projet.');
    if (!role.trim() || message.trim().length < 10) throw new ApiError(400, 'Indiquez un rôle et un message d’au moins 10 caractères.');
    p.collabRequests.push({ id: id('cr'), fromId: u.id, role: role.trim(), message: message.trim(), status: 'en_attente', createdAt: now() });
    notify(p.ownerId, 'collaboration', `${u.name} propose de rejoindre « ${p.title} » comme ${role}.`, `/projets/${p.id}`);
    save();
  },
  async answerCollab(pid: string, requestId: string, accept: boolean) {
    await net();
    const u = requireUser(['developpeur']);
    const p = load().projects.find((x) => x.id === pid);
    const c = p?.collabRequests.find((x) => x.id === requestId);
    if (!p || !c) throw new ApiError(404);
    if (p.ownerId !== u.id) throw new ApiError(403);
    c.status = accept ? 'acceptee' : 'refusee';
    notify(c.fromId, 'collaboration', `${u.name} a ${accept ? 'accepté' : 'refusé'} votre demande sur « ${p.title} ».`, `/projets/${p.id}`);
    save();
  },
};

// ---------- Fil d'actualité ----------
export async function feed(opts: { type?: 'question' | 'projet' | 'lecon'; page?: number; following?: boolean }): Promise<Page<FeedItem>> {
  await net();
  const d = load();
  const me = current();
  const follow = opts.following && me?.following?.length ? me.following : null;
  let items: FeedItem[] = [
    ...d.questions.filter((q) => !follow || q.tags.some((t) => follow.includes(t))).map((q) => ({ type: 'question' as const, date: q.createdAt, item: questionSummary(q) })),
    ...d.projects.filter((p) => !follow || p.techs.some((t) => follow.includes(t))).map((p) => ({ type: 'projet' as const, date: p.createdAt, item: projectSummary(p) })),
    ...seed.lessons.filter((_, i) => i % 3 === 0).map((l, i) => {
      const t = seed.tracks.find((x) => x.id === l.trackId)!;
      return { type: 'lecon' as const, date: new Date(Date.now() - (1 + i * 2.5) * 86400000).toISOString(), item: { id: l.id, trackId: l.trackId, title: l.title, trackTitle: t.title, minutes: l.minutes } };
    }),
  ];
  if (opts.type) items = items.filter((i) => i.type === opts.type);
  items.sort((a, b) => b.date.localeCompare(a.date));
  return paginate(items, opts.page, 8);
}

// ---------- Notifications ----------
export const notifications = {
  async list(): Promise<Notification[]> {
    await net();
    const u = requireUser();
    return load().notifications.filter((n) => n.userId === u.id).map(({ userId: _u, ...n }) => { void _u; return n; });
  },
  async unread(): Promise<number> {
    await wait(80);
    const u = current();
    if (!u) return 0;
    return load().notifications.filter((n) => n.userId === u.id && !n.read).length;
  },
  async markAllRead() {
    await wait(120);
    const u = requireUser();
    load().notifications.filter((n) => n.userId === u.id).forEach((n) => (n.read = true));
    save();
  },
};

// ---------- Apprendre ----------
export const learn = {
  async tracks(): Promise<Track[]> {
    await net();
    const me = current();
    const done = me ? progressOf(me.id).lessonsDone : [];
    return seed.tracks.map((t) => {
      const ls = t.lessonIds.map((lid) => seed.lessons.find((l) => l.id === lid)!);
      return { id: t.id, title: t.title, level: t.level, description: t.description, lessons: ls.map((l) => ({ id: l.id, title: l.title, minutes: l.minutes, done: done.includes(l.id) })), progress: ls.filter((l) => done.includes(l.id)).length / ls.length };
    });
  },
  async track(tid: string): Promise<Track> {
    const all = await learn.tracks();
    const t = all.find((x) => x.id === tid);
    if (!t) throw new ApiError(404);
    return t;
  },
  async lesson(lid: string): Promise<Lesson & { trackTitle: string; next?: string; prev?: string }> {
    await net();
    const l = seed.lessons.find((x) => x.id === lid);
    if (!l) throw new ApiError(404);
    const t = seed.tracks.find((x) => x.id === l.trackId)!;
    const i = t.lessonIds.indexOf(l.id);
    const me = current();
    return { id: l.id, trackId: l.trackId, title: l.title, minutes: l.minutes, blocks: l.blocks, quiz: l.quiz.map(({ answer: _a, ...q }) => { void _a; return q; }), done: me ? progressOf(me.id).lessonsDone.includes(l.id) : false, trackTitle: t.title, next: t.lessonIds[i + 1], prev: t.lessonIds[i - 1] };
  },
  async submitQuiz(lid: string, answers: number[]): Promise<QuizResult> {
    await net();
    const u = requireUser(['developpeur']);
    const l = seed.lessons.find((x) => x.id === lid);
    if (!l) throw new ApiError(404);
    const corrections = l.quiz.map((q, i) => ({ questionId: q.id, chosen: answers[i], answer: q.answer!, correct: answers[i] === q.answer, explanation: l.explanations[i] }));
    const score = corrections.filter((c) => c.correct).length;
    const passed = score >= Math.ceil(l.quiz.length * 0.66);
    let pointsEarned = 0;
    let badge: Badge | undefined;
    const p = progressOf(u.id);
    if (passed && !p.lessonsDone.includes(l.id)) {
      p.lessonsDone.push(l.id);
      pointsEarned = award(u.id, 15, `Leçon réussie : ${l.title}`);
      const t = seed.tracks.find((x) => x.id === l.trackId)!;
      if (t.lessonIds.every((x) => p.lessonsDone.includes(x))) {
        pointsEarned += award(u.id, 60, `Piste terminée : ${t.title}`);
        badge = giveBadge(u.id, 'b3');
      }
    }
    save();
    return { score, total: l.quiz.length, passed, pointsEarned, corrections, badge };
  },
};

// ---------- Défis techniques ----------
function challengeView(c: seed.DbChallenge, uid?: string): Challenge {
  const status = uid ? progressOf(uid).challengeStatus[c.id] || 'a_faire' : 'a_faire';
  return { id: c.id, title: c.title, kind: c.kind, level: c.level, tags: c.tags, points: c.points, summary: c.summary, brief: c.brief, quiz: c.quiz?.map(({ answer: _a, ...q }) => { void _a; return q; }), status, participants: c.participants, weekly: c.weekly };
}

export const challenges = {
  async list(opts: { kind?: 'quiz' | 'pratique'; level?: Level; page?: number }): Promise<Page<Challenge>> {
    await net();
    const me = current();
    let list = seed.challenges.map((c) => challengeView(c, me?.id));
    if (opts.kind) list = list.filter((c) => c.kind === opts.kind);
    if (opts.level) list = list.filter((c) => c.level === opts.level);
    list.sort((a, b) => Number(!!b.weekly) - Number(!!a.weekly));
    return paginate(list, opts.page);
  },
  async get(cid: string): Promise<Challenge> {
    await net();
    const c = seed.challenges.find((x) => x.id === cid);
    if (!c) throw new ApiError(404);
    return challengeView(c, current()?.id);
  },
  async submitQuiz(cid: string, answers: number[]): Promise<QuizResult> {
    await net();
    const u = requireUser(['developpeur']);
    const c = seed.challenges.find((x) => x.id === cid);
    if (!c || !c.quiz) throw new ApiError(404);
    const corrections = c.quiz.map((q, i) => ({ questionId: q.id, chosen: answers[i], answer: q.answer!, correct: answers[i] === q.answer, explanation: c.explanations?.[i] || '' }));
    const score = corrections.filter((x) => x.correct).length;
    const passed = score / c.quiz.length >= 0.75;
    const p = progressOf(u.id);
    let pointsEarned = 0;
    let badge: Badge | undefined;
    if (passed && p.challengeStatus[c.id] !== 'reussi') {
      p.challengeStatus[c.id] = 'reussi';
      pointsEarned = award(u.id, c.points, `Défi réussi : ${c.title}`);
      badge = giveBadge(u.id, 'b4');
    } else if (!passed && p.challengeStatus[c.id] !== 'reussi') {
      p.challengeStatus[c.id] = 'echoue';
    }
    save();
    return { score, total: c.quiz.length, passed, pointsEarned, corrections, badge };
  },
  async submitPractical(cid: string, codeUrl: string, note: string) {
    await net();
    const u = requireUser(['developpeur']);
    const c = seed.challenges.find((x) => x.id === cid);
    if (!c || c.kind !== 'pratique') throw new ApiError(404);
    if (!/^https:\/\/(www\.)?(github\.com|gitlab\.com|bitbucket\.org)\//.test(codeUrl)) throw new ApiError(400, 'Indiquez un lien vers un dépôt GitHub, GitLab ou Bitbucket.', 'validation', { codeUrl: 'Lien de dépôt attendu (GitHub, GitLab ou Bitbucket).' });
    const d = load();
    if (d.submissions.some((s) => s.challengeId === cid && s.devId === u.id && s.status === 'en_attente')) throw new ApiError(409, 'Votre solution est déjà en attente de validation.');
    d.submissions.unshift({ id: id('s'), challengeId: cid, devId: u.id, codeUrl, note: note.trim(), date: now(), status: 'en_attente' });
    progressOf(u.id).challengeStatus[cid] = 'en_attente';
    save();
  },
};

// ---------- Progression et portfolio ----------
export async function progression(): Promise<Progression> {
  await net();
  const u = requireUser(['developpeur']);
  const p = progressOf(u.id);
  const floor = u.points >= 2000 ? 2000 : u.points >= 500 ? 500 : 0;
  return {
    points: u.points, level: u.level, levelFloor: floor, nextLevelAt: u.points >= 2000 ? null : u.points >= 500 ? 2000 : 500,
    todayPoints: todayPoints(u.id), dailyCap: DAILY_CAP,
    history: p.history.map((h, i) => ({ id: `h${i}`, ...h })),
    badges: seed.badges.filter((b) => p.badgeIds.includes(b.id)),
    lockedBadges: seed.badges.filter((b) => !p.badgeIds.includes(b.id)),
  };
}

function portfolioOf(u: seed.DbUser): { verified: PortfolioItem[]; declared: PortfolioItem[] } {
  const p = progressOf(u.id);
  const verified: PortfolioItem[] = [];
  Object.entries(p.challengeStatus).filter(([, s]) => s === 'reussi').forEach(([cid]) => {
    const c = seed.challenges.find((x) => x.id === cid);
    if (c) verified.push({ id: `v-${cid}`, kind: 'defi', title: c.title, detail: c.kind === 'quiz' ? 'Défi quiz corrigé automatiquement' : "Défi pratique validé par l'équipe", href: `/defis/${c.id}`, verified: true });
  });
  load().submissions.filter((s) => s.devId === u.id && s.status === 'valide').forEach((s) => {
    const c = seed.challenges.find((x) => x.id === s.challengeId);
    if (c && !verified.some((v) => v.id === `v-${c.id}`)) verified.push({ id: `v-${c.id}`, kind: 'defi', title: c.title, detail: "Défi pratique validé par l'équipe", href: `/defis/${c.id}`, verified: true });
  });
  seed.tracks.forEach((t) => {
    if (t.lessonIds.every((l) => p.lessonsDone.includes(l))) verified.push({ id: `t-${t.id}`, kind: 'piste', title: t.title, detail: 'Piste terminée, quiz réussis', href: `/apprendre/${t.id}`, verified: true });
  });
  const declared: PortfolioItem[] = [];
  load().projects.filter((x) => x.ownerId === u.id).forEach((x) => {
    const n = x.reviews.filter((r) => r.validatedByOwner).length;
    const item: PortfolioItem = { id: `p-${x.id}`, kind: 'projet', title: x.title, detail: n ? `Projet relu par ${n} pair${n > 1 ? 's' : ''}` : 'Projet publié, pas encore relu par des pairs', href: `/projets/${x.id}`, verified: n > 0 };
    (n > 0 ? verified : declared).push(item);
  });
  u.links.forEach((l, i) => {
    const ok = l.kind === 'github' && u.githubVerified;
    const item: PortfolioItem = { id: `l-${i}`, kind: 'lien', title: l.label, detail: l.kind === 'github' ? (ok ? 'Compte GitHub relié et confirmé' : 'Compte GitHub déclaré') : l.kind === 'site' ? 'Site déclaré' : 'Projet déclaré', href: l.url, verified: ok };
    (ok ? verified : declared).push(item);
  });
  return { verified, declared };
}

export async function portfolio(): Promise<{ verified: PortfolioItem[]; declared: PortfolioItem[]; username: string }> {
  await net();
  const u = requireUser(['developpeur']);
  return { ...portfolioOf(u), username: u.username };
}

export async function publicProfile(username: string): Promise<PublicProfile> {
  await net();
  const d = load();
  const u = d.users.find((x) => x.username === username && x.role === 'developpeur');
  if (!u) throw new ApiError(404);
  if (d.settings?.[u.id]?.privacy.profilPublic === false && !current()) throw new ApiError(403, 'Ce membre a choisi de montrer son profil uniquement aux membres connectés.');
  const pf = portfolioOf(u);
  const sameCountry = d.users.filter((x) => x.role === 'developpeur' && x.country === u.country).sort((a, b) => b.points - a.points);
  const answers = d.questions.flatMap((q) => q.answers.filter((a) => a.authorId === u.id));
  const best = d.questions.filter((q) => q.answers.some((a) => a.id === q.bestAnswerId && a.authorId === u.id)).length;
  return {
    user: pub(u), ...pf,
    badges: seed.badges.filter((b) => progressOf(u.id).badgeIds.includes(b.id)),
    stats: { answers: answers.length, bestAnswers: best, projects: d.projects.filter((p) => p.ownerId === u.id).length, challenges: pf.verified.filter((v) => v.kind === 'defi').length },
    rankInCountry: sameCountry.findIndex((x) => x.id === u.id) + 1 || null,
  };
}

export async function leaderboard(opts: { country?: string; page?: number }): Promise<Page<LeaderboardRow>> {
  await net();
  let list = load().users.filter((u) => u.role === 'developpeur');
  if (opts.country) list = list.filter((u) => u.country === opts.country);
  list.sort((a, b) => b.points - a.points);
  const rows = list.map((u, i) => ({ rank: i + 1, user: pub(u), points: u.points, weekPoints: progressOf(u.id).history.slice(0, 4).reduce((s, h) => s + h.points, 0) || Math.round(u.points / 40) }));
  return paginate(rows, opts.page, 10);
}

// ---------- Défis recruteurs ----------
function rcView(c: seed.DbRecruiterChallenge, uid?: string): RecruiterChallenge {
  const d = load();
  const r = userById(c.recruiterId);
  const mine = uid ? d.applications.find((a) => a.challengeId === c.id && a.devId === uid) : undefined;
  return { id: c.id, title: c.title, company: r.company || '', recruiter: pub(r), summary: c.summary, brief: c.brief, skills: c.skills, country: c.country, remote: c.remote, deadline: c.deadline, reward: c.reward, status: c.status, applicationCount: d.applications.filter((a) => a.challengeId === c.id).length, myApplication: mine ? appView(mine) : undefined };
}
function appView(a: seed.DbApplication): Application {
  const c = load().recruiterChallenges.find((x) => x.id === a.challengeId)!;
  return { id: a.id, challengeId: a.challengeId, challengeTitle: c.title, dev: pubById(a.devId), codeUrl: a.codeUrl, demoUrl: a.demoUrl, message: a.message, createdAt: a.createdAt, status: a.status, score: a.score, feedback: a.feedback, proposal: a.proposal };
}

export const opportunities = {
  async list(opts: { skill?: string; page?: number }): Promise<Page<RecruiterChallenge>> {
    await net();
    const me = requireUser(['developpeur']);
    let list = load().recruiterChallenges.filter((c) => c.status === 'publie');
    if (opts.skill) list = list.filter((c) => c.skills.includes(opts.skill!));
    return paginate(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => rcView(c, me.id)), opts.page);
  },
  async get(cid: string): Promise<RecruiterChallenge> {
    await net();
    const me = requireUser(['developpeur']);
    const c = load().recruiterChallenges.find((x) => x.id === cid && x.status !== 'en_attente');
    if (!c) throw new ApiError(404);
    return rcView(c, me.id);
  },
  async apply(cid: string, input: { codeUrl: string; demoUrl?: string; message: string }) {
    await net();
    const me = requireUser(['developpeur']);
    const d = load();
    const c = d.recruiterChallenges.find((x) => x.id === cid && x.status === 'publie');
    if (!c) throw new ApiError(404);
    const fields: Record<string, string> = {};
    if (!/^https:\/\//.test(input.codeUrl)) fields.codeUrl = 'Indiquez un lien https vers le code.';
    if (input.demoUrl && !isAllowedVideo(input.demoUrl) && !/^https:\/\//.test(input.demoUrl)) fields.demoUrl = 'Lien de démo invalide.';
    if (input.message.trim().length < 20) fields.message = 'Présentez votre solution en au moins 20 caractères.';
    if (Object.keys(fields).length) throw new ApiError(400, 'Certaines informations sont incorrectes.', 'validation', fields);
    if (d.applications.some((a) => a.challengeId === cid && a.devId === me.id)) throw new ApiError(409, 'Vous avez déjà candidaté à ce défi.');
    d.applications.unshift({ id: id('ap'), challengeId: cid, devId: me.id, codeUrl: input.codeUrl, demoUrl: input.demoUrl || undefined, message: input.message.trim(), createdAt: now(), status: 'recue' });
    notify(c.recruiterId, 'candidature', `Nouvelle candidature de ${me.name} sur « ${c.title} ».`, `/recruteur/defis/${c.id}`);
    save();
  },
};

export const recruiter = {
  async myChallenges(): Promise<RecruiterChallenge[]> {
    await net();
    const me = requireUser(['recruteur']);
    return load().recruiterChallenges.filter((c) => c.recruiterId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => rcView(c));
  },
  async challenge(cid: string): Promise<{ challenge: RecruiterChallenge; applications: Application[] }> {
    await net();
    const me = requireUser(['recruteur']);
    const c = load().recruiterChallenges.find((x) => x.id === cid);
    if (!c) throw new ApiError(404);
    if (c.recruiterId !== me.id) throw new ApiError(403);
    return { challenge: rcView(c), applications: load().applications.filter((a) => a.challengeId === cid).map(appView) };
  },
  async applications(opts: { status?: string; page?: number }): Promise<Page<Application>> {
    await net();
    const me = requireUser(['recruteur']);
    const mine = load().recruiterChallenges.filter((c) => c.recruiterId === me.id).map((c) => c.id);
    let list = load().applications.filter((a) => mine.includes(a.challengeId));
    if (opts.status) list = list.filter((a) => a.status === opts.status);
    return paginate(list.map(appView), opts.page, 8);
  },
  async create(input: { title: string; summary: string; brief: string; skills: string[]; country: string; remote: boolean; deadline: string; reward: string }): Promise<{ id: string }> {
    await net();
    const me = requireUser(['recruteur']);
    const fields: Record<string, string> = {};
    if (input.title.trim().length < 8) fields.title = 'Au moins 8 caractères.';
    if (input.summary.trim().length < 15) fields.summary = 'Résumez le défi en une phrase.';
    if (input.brief.trim().length < 50) fields.brief = 'Décrivez le travail attendu (au moins 50 caractères).';
    if (!input.skills.length) fields.skills = 'Choisissez au moins une compétence.';
    if (!input.deadline || Date.parse(input.deadline) < Date.now()) fields.deadline = 'Choisissez une date future.';
    if (Object.keys(fields).length) throw new ApiError(400, 'Certaines informations sont incorrectes.', 'validation', fields);
    const c: seed.DbRecruiterChallenge = { id: id('rc'), recruiterId: me.id, title: input.title.trim(), summary: input.summary.trim(), brief: input.brief.trim(), skills: input.skills, country: input.country, remote: input.remote, deadline: new Date(input.deadline).toISOString(), reward: input.reward.trim() || 'À discuter', status: 'en_attente', createdAt: now() };
    load().recruiterChallenges.unshift(c);
    load().users.filter((x) => x.role === 'admin').forEach((a) => notify(a.id, 'validation', `Nouveau défi recruteur à valider : ${c.title}.`, '/admin/validations'));
    save();
    return { id: c.id };
  },
  async evaluate(appId: string, score: number, feedback: string) {
    await net();
    const me = requireUser(['recruteur']);
    const a = load().applications.find((x) => x.id === appId);
    if (!a) throw new ApiError(404);
    const c = load().recruiterChallenges.find((x) => x.id === a.challengeId)!;
    if (c.recruiterId !== me.id) throw new ApiError(403);
    if (score < 1 || score > 5) throw new ApiError(400, 'Donnez une note de 1 à 5.');
    a.score = score;
    a.feedback = feedback.trim();
    if (a.status === 'recue') a.status = 'evaluee';
    notify(a.devId, 'candidature', `Votre candidature sur « ${c.title} » a été évaluée.`, `/opportunites/${c.id}`);
    save();
  },
  async decide(appId: string, retained: boolean, proposal?: string) {
    await net();
    const me = requireUser(['recruteur']);
    const a = load().applications.find((x) => x.id === appId);
    if (!a) throw new ApiError(404);
    const c = load().recruiterChallenges.find((x) => x.id === a.challengeId)!;
    if (c.recruiterId !== me.id) throw new ApiError(403);
    if (retained && (!proposal || proposal.trim().length < 20)) throw new ApiError(400, 'Rédigez une proposition de collaboration (au moins 20 caractères).', 'validation', { proposal: 'Au moins 20 caractères.' });
    a.status = retained ? 'retenue' : 'non_retenue';
    a.proposal = retained ? proposal!.trim() : undefined;
    notify(a.devId, 'candidature', retained ? `${me.company} vous propose une collaboration après « ${c.title} ».` : `Votre candidature sur « ${c.title} » n'a pas été retenue.`, `/opportunites/${c.id}`);
    save();
  },
  async close(cid: string) {
    await net();
    const me = requireUser(['recruteur']);
    const c = load().recruiterChallenges.find((x) => x.id === cid);
    if (!c || c.recruiterId !== me.id) throw new ApiError(404);
    c.status = 'cloture';
    save();
  },
  async searchTalents(opts: { skill?: string; country?: string; level?: Level; q?: string; page?: number }): Promise<Page<PublicUser & { verifiedCount: number }>> {
    await net();
    requireUser(['recruteur']);
    const st = load().settings || {};
    let list = load().users.filter((u) => u.role === 'developpeur' && st[u.id]?.privacy.visibleRecruteurs !== false);
    if (opts.skill) list = list.filter((u) => u.skills.includes(opts.skill!));
    if (opts.country) list = list.filter((u) => u.country === opts.country);
    if (opts.level) list = list.filter((u) => u.level === opts.level);
    if (opts.q) {
      const s = opts.q.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(s) || u.bio.toLowerCase().includes(s));
    }
    list.sort((a, b) => b.points - a.points);
    return paginate(list.map((u) => ({ ...pub(u), verifiedCount: portfolioOf(u).verified.length })), opts.page, 8);
  },
  async contact(username: string, message: string) {
    await net();
    const me = requireUser(['recruteur']);
    const u = load().users.find((x) => x.username === username);
    if (!u) throw new ApiError(404);
    if (message.trim().length < 20) throw new ApiError(400, 'Votre message doit faire au moins 20 caractères.', 'validation', { message: 'Au moins 20 caractères.' });
    notify(u.id, 'candidature', `${me.name} (${me.company}) souhaite vous contacter : « ${message.trim().slice(0, 80)}… »`, '/notifications');
    save();
  },
};

// ---------- Signalements ----------
export async function report(input: { targetType: Report['targetType']; targetId: string; reason: string; details?: string }) {
  await net();
  const u = requireUser();
  if (!input.reason) throw new ApiError(400, 'Choisissez un motif.');
  const d = load();
  if (d.reports.some((r) => r.reporterId === u.id && r.targetId === input.targetId && r.status === 'ouvert')) throw new ApiError(409, 'Vous avez déjà signalé ce contenu.');
  d.reports.unshift({ id: id('sg'), ...input, reporterId: u.id, date: now(), status: 'ouvert' });
  save();
}

// ---------- Admin ----------
function reportView(r: seed.DbReport): Report {
  const d = load();
  let title = '';
  let href = '#';
  if (r.targetType === 'question') {
    const q = d.questions.find((x) => x.id === r.targetId);
    title = q?.title || 'Question supprimée';
    href = `/questions/${r.targetId}`;
  } else if (r.targetType === 'projet') {
    const p = d.projects.find((x) => x.id === r.targetId);
    title = p?.title || 'Projet supprimé';
    href = `/projets/${r.targetId}`;
  } else {
    const q = d.questions.find((x) => x.answers.some((a) => a.id === r.targetId));
    const a = q?.answers.find((x) => x.id === r.targetId);
    title = a ? `Réponse : « ${a.body.slice(0, 60)}… »` : 'Réponse supprimée';
    href = q ? `/questions/${q.id}` : '#';
  }
  return { id: r.id, targetType: r.targetType, targetId: r.targetId, targetTitle: title, targetHref: href, reason: r.reason, details: r.details, reporter: pubById(r.reporterId), date: r.date, status: r.status };
}

export const admin = {
  async pendingRecruiters(): Promise<User[]> {
    await net();
    requireUser(['admin']);
    return load().users.filter((u) => u.role === 'recruteur' && u.recruiterStatus === 'en_attente').map(toMe);
  },
  async decideRecruiter(uid: string, approve: boolean) {
    await net();
    requireUser(['admin']);
    const u = userById(uid);
    u.recruiterStatus = approve ? 'valide' : 'refuse';
    save();
  },
  async pendingChallenges(): Promise<RecruiterChallenge[]> {
    await net();
    requireUser(['admin']);
    return load().recruiterChallenges.filter((c) => c.status === 'en_attente').map((c) => rcView(c));
  },
  async decideChallenge(cid: string, approve: boolean) {
    await net();
    requireUser(['admin']);
    const c = load().recruiterChallenges.find((x) => x.id === cid);
    if (!c) throw new ApiError(404);
    c.status = approve ? 'publie' : 'refuse';
    notify(c.recruiterId, 'validation', approve ? `Votre défi « ${c.title} » est publié.` : `Votre défi « ${c.title} » n'a pas été accepté.`, '/recruteur/defis');
    save();
  },
  async submissions(): Promise<PracticalSubmission[]> {
    await net();
    requireUser(['admin']);
    return load().submissions.filter((s) => s.status === 'en_attente').map((s) => {
      const c = seed.challenges.find((x) => x.id === s.challengeId)!;
      return { id: s.id, challenge: { id: c.id, title: c.title, points: c.points }, dev: pubById(s.devId), codeUrl: s.codeUrl, note: s.note, date: s.date, status: s.status };
    });
  },
  async decideSubmission(sid: string, approve: boolean) {
    await net();
    requireUser(['admin']);
    const s = load().submissions.find((x) => x.id === sid);
    if (!s) throw new ApiError(404);
    const c = seed.challenges.find((x) => x.id === s.challengeId)!;
    s.status = approve ? 'valide' : 'refuse';
    progressOf(s.devId).challengeStatus[c.id] = approve ? 'reussi' : 'refuse';
    if (approve) {
      award(s.devId, c.points, `Défi réussi : ${c.title}`);
      giveBadge(s.devId, 'b4');
    }
    notify(s.devId, 'validation', approve ? `Votre solution au défi « ${c.title} » est validée.` : `Votre solution au défi « ${c.title} » doit être revue.`, `/defis/${c.id}`);
    save();
  },
  async reports(status: 'ouvert' | 'traite' | 'rejete' = 'ouvert'): Promise<Report[]> {
    await net();
    requireUser(['admin']);
    return load().reports.filter((r) => r.status === status).map(reportView);
  },
  async decideReport(rid: string, action: 'retirer' | 'rejeter') {
    await net();
    requireUser(['admin']);
    const d = load();
    const r = d.reports.find((x) => x.id === rid);
    if (!r) throw new ApiError(404);
    if (action === 'retirer') {
      if (r.targetType === 'question') d.questions = d.questions.filter((q) => q.id !== r.targetId);
      if (r.targetType === 'projet') d.projects = d.projects.filter((p) => p.id !== r.targetId);
      if (r.targetType === 'reponse') d.questions.forEach((q) => (q.answers = q.answers.filter((a) => a.id !== r.targetId)));
      r.status = 'traite';
    } else r.status = 'rejete';
    save();
  },
  async counts(): Promise<{ recruiters: number; challenges: number; submissions: number; reports: number }> {
    await wait(100);
    const d = load();
    return { recruiters: d.users.filter((u) => u.recruiterStatus === 'en_attente').length, challenges: d.recruiterChallenges.filter((c) => c.status === 'en_attente').length, submissions: d.submissions.filter((s) => s.status === 'en_attente').length, reports: d.reports.filter((r) => r.status === 'ouvert').length };
  },
};

// ---------- Accueil public ----------
export async function home(): Promise<{ questions: QuestionSummary[]; projects: ProjectSummary[]; stats: { devs: number; countries: number; answers: number } }> {
  await net();
  const d = load();
  const devs = d.users.filter((u) => u.role === 'developpeur');
  return {
    questions: [...d.questions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4).map(questionSummary),
    projects: [...d.projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3).map(projectSummary),
    stats: { devs: devs.length, countries: new Set(devs.map((u) => u.country)).size, answers: d.questions.reduce((s, q) => s + q.answers.length, 0) },
  };
}
