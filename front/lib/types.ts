// Types partagés : même forme que les réponses prévues de l'API (A et B).

export type Role = 'developpeur' | 'recruteur' | 'admin';
export type Level = 'Débutant' | 'Intermédiaire' | 'Confirmé';

export interface DeclaredLink {
  kind: 'github' | 'site' | 'projet';
  label: string;
  url: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  country: string;
  city?: string;
  bio: string;
  avatarUrl?: string; // image compressée (256 px) envoyée à l'API
  skills: string[];
  level: Level;
  points: number;
  githubVerified: boolean;
  hasPassword?: boolean; // false : compte créé avec GitHub ou Google, sans mot de passe défini
  googleLinked?: boolean; // un compte Google est relié à ce compte
  links: DeclaredLink[];
  joinedAt: string;
  company?: string; // recruteur
  recruiterStatus?: 'en_attente' | 'valide' | 'refuse';
  following?: string[]; // technologies suivies
}

export type PublicUser = Pick<
  User,
  'id' | 'username' | 'name' | 'role' | 'country' | 'city' | 'bio' | 'avatarUrl' | 'skills' | 'level' | 'points' | 'githubVerified' | 'links' | 'joinedAt' | 'company'
>;

export interface CodeSnippet {
  lang: string;
  content: string;
}

export interface Comment {
  id: string;
  author: PublicUser;
  body: string;
  createdAt: string;
}

export interface Answer {
  id: string;
  author: PublicUser;
  body: string;
  code?: CodeSnippet;
  createdAt: string;
  votes: number;
  myVote?: 1 | -1 | 0;
  comments: Comment[];
}

export interface QuestionSummary {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  author: PublicUser;
  createdAt: string;
  votes: number;
  answerCount: number;
  hasBestAnswer: boolean;
}

export interface Question extends QuestionSummary {
  body: string;
  code?: CodeSnippet;
  myVote?: 1 | -1 | 0;
  bestAnswerId?: string;
  answers: Answer[];
}

export interface Review {
  id: string;
  author: PublicUser;
  rating: number; // 1 à 5
  body: string;
  createdAt: string;
  validatedByOwner: boolean;
}

export interface CollabRequest {
  id: string;
  from: PublicUser;
  role: string;
  message: string;
  status: 'en_attente' | 'acceptee' | 'refusee';
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  summary: string;
  techs: string[];
  owner: PublicUser;
  hasVideo: boolean;
  videoUrl?: string;
  seekingCollaborators: boolean;
  createdAt: string;
  validatedReviews: number;
}

export interface Project extends ProjectSummary {
  description: string;
  codeUrl: string;
  comments: Comment[];
  reviews: Review[];
  collabRequests: CollabRequest[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer?: number; // non renvoyé par l'API avant correction
}

export interface QuizCorrection {
  questionId: string;
  correct: boolean;
  chosen: number;
  answer: number;
  explanation: string;
}

export interface QuizResult {
  score: number;
  total: number;
  passed: boolean;
  pointsEarned: number;
  corrections: QuizCorrection[];
  badge?: Badge;
}

export type LessonBlock =
  | { type: 'p'; text: string }
  | { type: 'code'; lang: string; content: string }
  | { type: 'tip'; text: string }
  // Éditeur « Essayer » : HTML, CSS et JavaScript modifiables, résultat dans un cadre isolé.
  | { type: 'try'; title: string; html: string; css: string; js: string; hint?: string };

export interface Lesson {
  id: string;
  trackId: string;
  title: string;
  minutes: number;
  blocks: LessonBlock[];
  quiz: QuizQuestion[];
  done?: boolean;
}

export interface Track {
  id: string;
  title: string;
  level: Level;
  description: string;
  lessons: Pick<Lesson, 'id' | 'title' | 'minutes' | 'done'>[];
  progress: number; // 0 à 1
}

export type ChallengeStatus = 'a_faire' | 'reussi' | 'echoue' | 'en_attente' | 'refuse';

export interface Challenge {
  id: string;
  title: string;
  kind: 'quiz' | 'pratique';
  level: Level;
  tags: string[];
  points: number;
  summary: string;
  brief: string;
  quiz?: QuizQuestion[];
  status: ChallengeStatus;
  participants: number;
  weekly?: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  glyph: string; // une lettre ou un symbole court
  earnedAt?: string;
}

export interface PointEvent {
  id: string;
  label: string;
  points: number;
  date: string;
}

export interface Progression {
  points: number;
  level: Level;
  nextLevelAt: number | null;
  levelFloor: number;
  todayPoints: number;
  dailyCap: number;
  history: PointEvent[];
  badges: Badge[];
  lockedBadges: Badge[];
}

export interface PortfolioItem {
  id: string;
  kind: 'defi' | 'projet' | 'piste' | 'lien';
  title: string;
  detail: string;
  href?: string;
  verified: boolean;
  date?: string;
}

export interface PublicProfile {
  user: PublicUser;
  verified: PortfolioItem[];
  declared: PortfolioItem[];
  badges: Badge[];
  stats: { answers: number; bestAnswers: number; projects: number; challenges: number };
  rankInCountry: number | null;
}

export type ApplicationStatus = 'recue' | 'evaluee' | 'retenue' | 'non_retenue';

export interface Application {
  id: string;
  challengeId: string;
  challengeTitle: string;
  dev: PublicUser;
  codeUrl: string;
  demoUrl?: string;
  message: string;
  createdAt: string;
  status: ApplicationStatus;
  score?: number; // sur 5
  feedback?: string;
  proposal?: string;
}

export interface RecruiterChallenge {
  id: string;
  title: string;
  company: string;
  recruiter: PublicUser;
  summary: string;
  brief: string;
  skills: string[];
  country: string;
  remote: boolean;
  deadline: string;
  reward: string;
  status: 'en_attente' | 'publie' | 'cloture' | 'refuse';
  applicationCount: number;
  myApplication?: Application;
}

export interface Settings {
  theme: 'systeme' | 'clair' | 'sombre';
  language: 'fr' | 'en';
  notify: { reponses: boolean; commentaires: boolean; badges: boolean; candidatures: boolean; resumeHebdo: boolean };
  privacy: { profilPublic: boolean; afficherVille: boolean; visibleRecruteurs: boolean };
}

export interface Notification {
  id: string;
  kind: 'reponse' | 'commentaire' | 'badge' | 'candidature' | 'validation' | 'collaboration';
  text: string;
  href: string;
  read: boolean;
  date: string;
}

export interface Report {
  id: string;
  targetType: 'question' | 'reponse' | 'projet' | 'commentaire';
  targetId: string;
  targetTitle: string;
  targetHref: string;
  reason: string;
  details?: string;
  reporter: PublicUser;
  date: string;
  status: 'ouvert' | 'traite' | 'rejete';
}

export interface PracticalSubmission {
  id: string;
  challenge: Pick<Challenge, 'id' | 'title' | 'points'>;
  dev: PublicUser;
  codeUrl: string;
  note: string;
  date: string;
  status: 'en_attente' | 'valide' | 'refuse';
}

export type FeedItem =
  | { type: 'question'; date: string; item: QuestionSummary }
  | { type: 'projet'; date: string; item: ProjectSummary }
  | { type: 'lecon'; date: string; item: { id: string; trackId: string; title: string; trackTitle: string; minutes: number } };

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

export interface LeaderboardRow {
  rank: number;
  user: PublicUser;
  points: number;
  weekPoints: number;
}

export interface Message {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  mine: boolean; // calculé par l'API pour la personne connectée
}

export interface ConversationSummary {
  id: string;
  with: PublicUser; // l'autre membre
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
  blockedByMe: boolean;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}
// ---------- Agnès, l'assistante IA ----------

/** Piste de réponse d'Agnès sur une question du forum (générée une fois, visible par tous). */
export interface AgnesAnswer {
  questionId: string;
  body: string; // texte Markdown simple : paragraphes, listes et blocs de code
  model: string;
  createdAt: string;
}

export interface AgnesTurn {
  role: 'user' | 'assistant';
  content: string;
}
