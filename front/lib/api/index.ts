// Module central des appels à l'API (cahier des charges, section 7).
// Aucun composant n'appelle fetch directement : tout passe par ici.
// Par défaut le site appelle l'API réelle. Avec NEXT_PUBLIC_API_MOCK=true (démonstration), les réponses
// viennent de lib/mock, qui a la même forme que l'API.
import type {
  AgnesAnswer, AgnesTurn, Application, Challenge, Conversation, ConversationSummary, FeedItem, LeaderboardRow, Lesson, Level, Notification, Page, PortfolioItem, PracticalSubmission,
  Message, Progression, Project, ProjectSummary, PublicProfile, PublicUser, Question, QuestionSummary, QuizResult, RecruiterChallenge,
  Report, Settings, Track, User,
} from '../types';
import { http } from './http';

export { ApiError, messageFor, ERROR_MESSAGES } from './errors';

export const MOCK = process.env.NEXT_PUBLIC_API_MOCK === 'true';

// Chargé à la demande : le serveur simulé n'alourdit pas les pages quand l'API réelle est branchée.
// La condition est écrite en toutes lettres (et non avec MOCK) pour que l'outil de build la résolve tout de suite :
// en mode réel, le serveur simulé et ses comptes de démonstration ne sont pas du tout inclus dans le site.
const off = () => Promise.reject(new Error('Données simulées indisponibles sur le site réel.'));
const m = () => (process.env.NEXT_PUBLIC_API_MOCK === 'true' ? import('../mock/server') : off());
const mm = () => (process.env.NEXT_PUBLIC_API_MOCK === 'true' ? import('../mock/messages') : off());
const ma = () => (process.env.NEXT_PUBLIC_API_MOCK === 'true' ? import('../mock/agnes') : off());

type Code = { lang: string; content: string };

export const api = {
  home: async (): Promise<{ questions: QuestionSummary[]; projects: ProjectSummary[]; stats: { devs: number; countries: number; answers: number } }> =>
    MOCK ? (await m()).home() : http('GET', '/accueil'),

  auth: {
    me: async (): Promise<User | null> => (MOCK ? (await m()).auth.me() : http<User>('GET', '/auth/me').catch(() => null)),
    login: async (email: string, password: string): Promise<User> => (MOCK ? (await m()).auth.login(email, password) : http('POST', '/auth/connexion', { email, password })),
    register: async (input: { role: 'developpeur' | 'recruteur'; name: string; email: string; password: string; country: string; company?: string; acceptTerms: boolean }): Promise<User | { pending: true }> =>
      MOCK ? (await m()).auth.register(input) : http('POST', '/auth/inscription', input),
    logout: async (): Promise<void> => (MOCK ? (await m()).auth.logout() : http('POST', '/auth/deconnexion')),
    updateProfile: async (patch: Partial<Pick<User, 'name' | 'bio' | 'country' | 'city' | 'skills' | 'links' | 'following'>> & { avatarUrl?: string | null }): Promise<User> =>
      MOCK ? (await m()).auth.updateProfile(patch) : http('PATCH', '/moi', patch),
    // Vérification GitHub en deux temps : un code à placer dans la bio GitHub, puis la relecture de cette bio par l'API.
    githubCode: async (username: string): Promise<{ username: string; code: string; expiresAt: string }> =>
      MOCK ? (await m()).auth.githubCode(username) : http('POST', '/moi/github/code', { username }),
    githubVerify: async (): Promise<User> => (MOCK ? (await m()).auth.githubVerify() : http('POST', '/moi/github/verification')),
    // Connexion avec GitHub (OAuth) : absente de la démonstration, qui n'a pas de serveur.
    // Mot de passe oublié par e-mail : disponible seulement si l'API a un serveur d'e-mails (sinon on renvoie vers l'équipe).
    forgotEtat: async (): Promise<{ enabled: boolean }> => (MOCK ? { enabled: false } : http<{ enabled: boolean }>('GET', '/auth/mot-de-passe-oublie/etat').catch(() => ({ enabled: false }))),
    forgot: async (email: string): Promise<void> => {
      if (MOCK) throw new Error('Indisponible en démonstration.');
      await http('POST', '/auth/mot-de-passe-oublie', { email });
    },
    resetPassword: async (token: string, password: string): Promise<void> => {
      if (MOCK) throw new Error('Indisponible en démonstration.');
      await http('POST', '/auth/reinitialiser-mot-de-passe', { token, password });
    },
    githubEtat: async (): Promise<{ enabled: boolean }> => (MOCK ? { enabled: false } : http<{ enabled: boolean }>('GET', '/auth/github/etat').catch(() => ({ enabled: false }))),
    githubPending: async (): Promise<{ login: string; name: string; email: string }> => http('GET', '/auth/github/en-attente'),
    githubFinaliser: async (input: { country: string; acceptTerms: boolean }): Promise<User> => http('POST', '/auth/github/finaliser', input),
  },

  settings: {
    get: async (): Promise<Settings> => (MOCK ? (await m()).settings.get() : http('GET', '/moi/parametres')),
    update: async (patch: Partial<Settings>): Promise<Settings> => (MOCK ? (await m()).settings.update(patch) : http('PATCH', '/moi/parametres', patch)),
    // current : absent pour un compte créé avec GitHub qui définit son premier mot de passe.
    changePassword: async (current: string | undefined, next: string): Promise<void> => (MOCK ? (await m()).settings.changePassword(current ?? '', next) : http('POST', '/moi/mot-de-passe', { current, next })),
    // Compte sans mot de passe : on confirme en retapant son nom d'utilisateur (confirm).
    deleteAccount: async (input: { password?: string; confirm?: string }): Promise<void> => (MOCK ? (await m()).settings.deleteAccount(input.password ?? '') : http('DELETE', '/moi', input)),
  },

  questions: {
    list: async (o: { tag?: string; sort?: 'recentes' | 'sans-reponse' | 'votes'; page?: number; q?: string }): Promise<Page<QuestionSummary>> =>
      MOCK ? (await m()).questions.list(o) : http('GET', '/questions', undefined, o),
    get: async (id: string): Promise<Question> => (MOCK ? (await m()).questions.get(id) : http('GET', `/questions/${id}`)),
    create: async (input: { title: string; body: string; tags: string[]; code?: Code }): Promise<{ id: string }> =>
      MOCK ? (await m()).questions.create(input) : http('POST', '/questions', input),
    answer: async (id: string, input: { body: string; code?: Code }): Promise<{ points: number }> =>
      MOCK ? (await m()).questions.answer(id, input) : http('POST', `/questions/${id}/reponses`, input),
    comment: async (id: string, answerId: string, body: string): Promise<void> =>
      MOCK ? (await m()).questions.comment(id, answerId, body) : http('POST', `/reponses/${answerId}/commentaires`, { body }),
    vote: async (id: string, targetId: string, dir: 1 | -1): Promise<{ votes: number; myVote: 1 | -1 | 0 }> =>
      MOCK ? (await m()).questions.vote(id, targetId, dir) : http('POST', `/votes`, { questionId: id, targetId, dir }),
    markBest: async (id: string, answerId: string): Promise<void> =>
      MOCK ? (await m()).questions.markBest(id, answerId) : http('POST', `/questions/${id}/meilleure-reponse`, { answerId }),
  },

  feed: async (o: { type?: 'question' | 'projet' | 'lecon'; page?: number; following?: boolean }): Promise<Page<FeedItem>> =>
    MOCK ? (await m()).feed(o) : http('GET', '/fil', undefined, o),

  notifications: {
    list: async (): Promise<Notification[]> => (MOCK ? (await m()).notifications.list() : http('GET', '/notifications')),
    unread: async (): Promise<number> => (MOCK ? (await m()).notifications.unread() : http<{ count: number }>('GET', '/notifications/non-lues').then((r) => r.count)),
    markAllRead: async (): Promise<void> => (MOCK ? (await m()).notifications.markAllRead() : http('POST', '/notifications/tout-lu')),
  },

  learn: {
    tracks: async (): Promise<Track[]> => (MOCK ? (await m()).learn.tracks() : http('GET', '/pistes')),
    track: async (id: string): Promise<Track> => (MOCK ? (await m()).learn.track(id) : http('GET', `/pistes/${id}`)),
    lesson: async (id: string): Promise<Lesson & { trackTitle: string; next?: string; prev?: string }> => (MOCK ? (await m()).learn.lesson(id) : http('GET', `/lecons/${id}`)),
    submitQuiz: async (id: string, answers: number[]): Promise<QuizResult> => (MOCK ? (await m()).learn.submitQuiz(id, answers) : http('POST', `/lecons/${id}/quiz`, { answers })),
  },

  challenges: {
    list: async (o: { kind?: 'quiz' | 'pratique'; level?: Level; page?: number }): Promise<Page<Challenge>> => (MOCK ? (await m()).challenges.list(o) : http('GET', '/defis', undefined, o)),
    get: async (id: string): Promise<Challenge> => (MOCK ? (await m()).challenges.get(id) : http('GET', `/defis/${id}`)),
    submitQuiz: async (id: string, answers: number[]): Promise<QuizResult> => (MOCK ? (await m()).challenges.submitQuiz(id, answers) : http('POST', `/defis/${id}/quiz`, { answers })),
    submitPractical: async (id: string, codeUrl: string, note: string): Promise<void> =>
      MOCK ? (await m()).challenges.submitPractical(id, codeUrl, note) : http('POST', `/defis/${id}/solutions`, { codeUrl, note }),
  },

  progression: async (): Promise<Progression> => (MOCK ? (await m()).progression() : http('GET', '/moi/progression')),
  portfolio: async (): Promise<{ verified: PortfolioItem[]; declared: PortfolioItem[]; username: string }> => (MOCK ? (await m()).portfolio() : http('GET', '/moi/portfolio')),
  publicProfile: async (username: string): Promise<PublicProfile> => (MOCK ? (await m()).publicProfile(username) : http('GET', `/profils/${encodeURIComponent(username)}`)),
  leaderboard: async (o: { country?: string; page?: number }): Promise<Page<LeaderboardRow>> => (MOCK ? (await m()).leaderboard(o) : http('GET', '/classement', undefined, o)),

  projects: {
    list: async (o: { tech?: string; seeking?: boolean; page?: number; owner?: string }): Promise<Page<ProjectSummary>> => (MOCK ? (await m()).projects.list(o) : http('GET', '/projets', undefined, o)),
    get: async (id: string): Promise<Project> => (MOCK ? (await m()).projects.get(id) : http('GET', `/projets/${id}`)),
    create: async (input: { title: string; summary: string; description: string; techs: string[]; videoUrl?: string; codeUrl: string; seekingCollaborators: boolean }): Promise<{ id: string; points: number }> =>
      MOCK ? (await m()).projects.create(input) : http('POST', '/projets', input),
    comment: async (id: string, body: string): Promise<void> => (MOCK ? (await m()).projects.comment(id, body) : http('POST', `/projets/${id}/commentaires`, { body })),
    review: async (id: string, rating: number, body: string): Promise<void> => (MOCK ? (await m()).projects.review(id, rating, body) : http('POST', `/projets/${id}/revues`, { rating, body })),
    validateReview: async (id: string, reviewId: string): Promise<void> => (MOCK ? (await m()).projects.validateReview(id, reviewId) : http('POST', `/projets/${id}/revues/${reviewId}/valider`)),
    requestCollab: async (id: string, role: string, message: string): Promise<void> =>
      MOCK ? (await m()).projects.requestCollab(id, role, message) : http('POST', `/projets/${id}/collaborations`, { role, message }),
    answerCollab: async (id: string, requestId: string, accept: boolean): Promise<void> =>
      MOCK ? (await m()).projects.answerCollab(id, requestId, accept) : http('POST', `/projets/${id}/collaborations/${requestId}`, { accept }),
  },

  opportunities: {
    list: async (o: { skill?: string; page?: number }): Promise<Page<RecruiterChallenge>> => (MOCK ? (await m()).opportunities.list(o) : http('GET', '/defis-recruteurs', undefined, o)),
    get: async (id: string): Promise<RecruiterChallenge> => (MOCK ? (await m()).opportunities.get(id) : http('GET', `/defis-recruteurs/${id}`)),
    apply: async (id: string, input: { codeUrl: string; demoUrl?: string; message: string }): Promise<void> =>
      MOCK ? (await m()).opportunities.apply(id, input) : http('POST', `/defis-recruteurs/${id}/candidatures`, input),
  },

  recruiter: {
    myChallenges: async (): Promise<RecruiterChallenge[]> => (MOCK ? (await m()).recruiter.myChallenges() : http('GET', '/recruteur/defis')),
    challenge: async (id: string): Promise<{ challenge: RecruiterChallenge; applications: Application[] }> => (MOCK ? (await m()).recruiter.challenge(id) : http('GET', `/recruteur/defis/${id}`)),
    applications: async (o: { status?: string; page?: number }): Promise<Page<Application>> => (MOCK ? (await m()).recruiter.applications(o) : http('GET', '/recruteur/candidatures', undefined, o)),
    create: async (input: { title: string; summary: string; brief: string; skills: string[]; country: string; remote: boolean; deadline: string; reward: string }): Promise<{ id: string }> =>
      MOCK ? (await m()).recruiter.create(input) : http('POST', '/recruteur/defis', input),
    evaluate: async (appId: string, score: number, feedback: string): Promise<void> =>
      MOCK ? (await m()).recruiter.evaluate(appId, score, feedback) : http('POST', `/recruteur/candidatures/${appId}/evaluation`, { score, feedback }),
    decide: async (appId: string, retained: boolean, proposal?: string): Promise<void> =>
      MOCK ? (await m()).recruiter.decide(appId, retained, proposal) : http('POST', `/recruteur/candidatures/${appId}/decision`, { retained, proposal }),
    close: async (id: string): Promise<void> => (MOCK ? (await m()).recruiter.close(id) : http('POST', `/recruteur/defis/${id}/cloturer`)),
    searchTalents: async (o: { skill?: string; country?: string; level?: Level; q?: string; page?: number }): Promise<Page<PublicUser & { verifiedCount: number }>> =>
      MOCK ? (await m()).recruiter.searchTalents(o) : http('GET', '/recruteur/talents', undefined, o),
    contact: async (username: string, message: string): Promise<void> => {
      if (!MOCK) return http('POST', `/recruteur/contacts`, { username, message });
      await (await m()).recruiter.contact(username, message);
      await (await mm()).messages.start(username, message);
    },
  },

  messages: {
    list: async (): Promise<ConversationSummary[]> => (MOCK ? (await mm()).messages.list() : http('GET', '/messages/conversations')),
    thread: async (id: string): Promise<Conversation> => (MOCK ? (await mm()).messages.thread(id) : http('GET', `/messages/conversations/${id}`)),
    send: async (id: string, body: string): Promise<Message> =>
      MOCK ? (await mm()).messages.send(id, body) : http('POST', `/messages/conversations/${id}/messages`, { body }),
    start: async (username: string, body: string): Promise<{ id: string }> =>
      MOCK ? (await mm()).messages.start(username, body) : http('POST', '/messages/conversations', { username, body }),
    markRead: async (id: string): Promise<void> => (MOCK ? (await mm()).messages.markRead(id) : http('POST', `/messages/conversations/${id}/lu`)),
    unread: async (): Promise<number> => (MOCK ? (await mm()).messages.unread() : http<{ count: number }>('GET', '/messages/non-lus').then((r) => r.count)),
    block: async (username: string): Promise<void> => (MOCK ? (await mm()).messages.block(username) : http('POST', '/messages/blocages', { username })),
    unblock: async (username: string): Promise<void> =>
      MOCK ? (await mm()).messages.unblock(username) : http('DELETE', `/messages/blocages/${encodeURIComponent(username)}`),
  },

  // Agnès, l'assistante IA. L'API Agnes AI est appelée par notre serveur : la clé n'est jamais dans le navigateur.
  agnes: {
    status: async (): Promise<{ available: boolean; model: string }> => (MOCK ? (await ma()).agnes.status() : http('GET', '/agnes/etat')),
    forQuestion: async (questionId: string): Promise<{ available: boolean; answer: AgnesAnswer | null }> =>
      MOCK ? (await ma()).agnes.forQuestion(questionId) : http('GET', `/agnes/questions/${questionId}`),
    askQuestion: async (questionId: string): Promise<AgnesAnswer> =>
      MOCK ? (await ma()).agnes.askQuestion(questionId) : http('POST', `/agnes/questions/${questionId}`),
    chat: async (messages: AgnesTurn[]): Promise<{ reply: string }> => (MOCK ? (await ma()).agnes.chat(messages) : http('POST', '/agnes/discussion', { messages })),
  },

  report: async (input: { targetType: Report['targetType']; targetId: string; reason: string; details?: string }): Promise<void> =>
    MOCK ? (await m()).report(input) : http('POST', '/signalements', input),

  admin: {
    counts: async (): Promise<{ recruiters: number; challenges: number; submissions: number; reports: number }> => (MOCK ? (await m()).admin.counts() : http('GET', '/admin/compteurs')),
    pendingRecruiters: async (): Promise<User[]> => (MOCK ? (await m()).admin.pendingRecruiters() : http('GET', '/admin/recruteurs')),
    decideRecruiter: async (id: string, approve: boolean): Promise<void> => (MOCK ? (await m()).admin.decideRecruiter(id, approve) : http('POST', `/admin/recruteurs/${id}`, { approve })),
    pendingChallenges: async (): Promise<RecruiterChallenge[]> => (MOCK ? (await m()).admin.pendingChallenges() : http('GET', '/admin/defis')),
    decideChallenge: async (id: string, approve: boolean): Promise<void> => (MOCK ? (await m()).admin.decideChallenge(id, approve) : http('POST', `/admin/defis/${id}`, { approve })),
    submissions: async (): Promise<PracticalSubmission[]> => (MOCK ? (await m()).admin.submissions() : http('GET', '/admin/solutions')),
    decideSubmission: async (id: string, approve: boolean): Promise<void> => (MOCK ? (await m()).admin.decideSubmission(id, approve) : http('POST', `/admin/solutions/${id}`, { approve })),
    reports: async (status: 'ouvert' | 'traite' | 'rejete' = 'ouvert'): Promise<Report[]> => (MOCK ? (await m()).admin.reports(status) : http('GET', '/admin/signalements', undefined, { status })),
    decideReport: async (id: string, action: 'retirer' | 'rejeter'): Promise<void> => (MOCK ? (await m()).admin.decideReport(id, action) : http('POST', `/admin/signalements/${id}`, { action })),
  },

  resetDemo: async () => {
    if (MOCK) {
      (await m()).resetDemo();
      (await mm()).reset();
      (await ma()).reset();
    }
  },
};
