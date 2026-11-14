-- ============================================================================
-- GAMELIA — Schéma PostgreSQL
-- Déduit de lib/types.ts, lib/mock/seed.ts et lib/mock/server.ts (front Next.js)
-- Version 1 · 24 octobre 2026
-- ============================================================================
-- Convention : tous les id métier exposés au front sont des chaînes courtes
-- (ex. "u1", "q3") dans le mock. En base réelle on utilise des UUID, mais on
-- garde un "username" lisible pour les URLs publiques (/u/[username]).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";   -- comparaison insensible à la casse (ex. email)

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

CREATE TYPE role_type AS ENUM ('developpeur', 'recruteur', 'admin');
CREATE TYPE level_type AS ENUM ('Débutant', 'Intermédiaire', 'Confirmé');
CREATE TYPE recruiter_status_type AS ENUM ('en_attente', 'valide', 'refuse');
CREATE TYPE declared_link_kind AS ENUM ('github', 'site', 'projet');
CREATE TYPE vote_value AS ENUM ('1', '-1'); -- stocké en smallint en pratique, voir table votes
CREATE TYPE challenge_kind AS ENUM ('quiz', 'pratique');
CREATE TYPE challenge_status_type AS ENUM ('a_faire', 'reussi', 'echoue', 'en_attente', 'refuse');
CREATE TYPE submission_status_type AS ENUM ('en_attente', 'valide', 'refuse');
CREATE TYPE application_status_type AS ENUM ('recue', 'evaluee', 'retenue', 'non_retenue');
CREATE TYPE recruiter_challenge_status AS ENUM ('en_attente', 'publie', 'cloture', 'refuse');
CREATE TYPE collab_status_type AS ENUM ('en_attente', 'acceptee', 'refusee');
CREATE TYPE report_target_type AS ENUM ('question', 'reponse', 'projet', 'commentaire');
CREATE TYPE report_status_type AS ENUM ('ouvert', 'traite', 'rejete');
CREATE TYPE notification_kind AS ENUM ('reponse', 'commentaire', 'badge', 'candidature', 'validation', 'collaboration');
CREATE TYPE theme_type AS ENUM ('systeme', 'clair', 'sombre');
CREATE TYPE language_type AS ENUM ('fr', 'en');

-- ----------------------------------------------------------------------------
-- UTILISATEURS
-- ----------------------------------------------------------------------------
-- Couvre User (lib/types.ts). password n'est jamais renvoyé au front
-- (voir toMe() dans mock/server.ts qui l'exclut explicitement).

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username           VARCHAR(40) NOT NULL UNIQUE,         -- utilisé dans /u/[username], slug depuis le nom
  name               VARCHAR(120) NOT NULL,
  email              CITEXT NOT NULL UNIQUE,               -- nécessite l'extension citext pour email insensible à la casse
  password_hash      TEXT NOT NULL,                        -- bcrypt/argon2, jamais en clair (cf. plan de réalisation, étape 4)
  role               role_type NOT NULL,
  country            VARCHAR(60) NOT NULL,
  city               VARCHAR(80),
  bio                VARCHAR(280) NOT NULL DEFAULT '',     -- limite validée côté API (voir updateProfile)
  avatar_url         TEXT,
  skills             TEXT[] NOT NULL DEFAULT '{}',         -- simple : pas de table séparée, cohérent avec TAGS en dur côté front
  level              level_type NOT NULL DEFAULT 'Débutant',
  points             INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  github_verified    BOOLEAN NOT NULL DEFAULT false,
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  company            VARCHAR(120),                         -- recruteur uniquement
  recruiter_status   recruiter_status_type,                -- NULL sauf si role = 'recruteur'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_recruiter_fields CHECK (
    (role = 'recruteur' AND company IS NOT NULL AND recruiter_status IS NOT NULL)
    OR (role <> 'recruteur' AND recruiter_status IS NULL)
  )
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_country ON users(country);
CREATE INDEX idx_users_points ON users(points DESC); -- classement

-- Sessions actives. Le cookie httpOnly posé côté client ne contient que cet id,
-- jamais l'id utilisateur directement : révocable à tout moment (logout, expiration)
-- sans dépendre d'un JWT signé. csrf_token alimente le cookie non-httpOnly
-- gamelia_csrf (double-submit cookie), lu par lib_api_http.ts et renvoyé dans le
-- header X-CSRF-Token sur toute requête non-GET. Voir src/middleware/auth.js côté back.
CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token UUID NOT NULL DEFAULT gen_random_uuid(),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at); -- purge périodique des sessions expirées

-- Liens déclarés (DeclaredLink[] dans User). Affichés "déclarés" tant que non vérifiés ;
-- seul kind='github' peut devenir vérifié, via users.github_verified (pas par lien individuel,
-- cf. portfolioOf() dans mock/server.ts qui ne vérifie que u.githubVerified globalement).
CREATE TABLE declared_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       declared_link_kind NOT NULL,
  label      VARCHAR(160) NOT NULL,
  url        TEXT NOT NULL,
  position   SMALLINT NOT NULL DEFAULT 0,  -- ordre d'affichage
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_declared_links_user ON declared_links(user_id);

-- Technologies suivies (User.following) pour le fil filtré
CREATE TABLE followed_tags (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag     VARCHAR(40) NOT NULL,
  PRIMARY KEY (user_id, tag)
);

-- Paramètres utilisateur (Settings). 1 ligne par user, créée au premier accès
-- ou par défaut à l'inscription (cf. DEFAULT_SETTINGS dans mock/server.ts).
CREATE TABLE user_settings (
  user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme                   theme_type NOT NULL DEFAULT 'systeme',
  language                language_type NOT NULL DEFAULT 'fr',
  notify_reponses         BOOLEAN NOT NULL DEFAULT true,
  notify_commentaires     BOOLEAN NOT NULL DEFAULT true,
  notify_badges           BOOLEAN NOT NULL DEFAULT true,
  notify_candidatures     BOOLEAN NOT NULL DEFAULT true,
  notify_resume_hebdo     BOOLEAN NOT NULL DEFAULT false,
  privacy_profil_public   BOOLEAN NOT NULL DEFAULT true,
  privacy_afficher_ville  BOOLEAN NOT NULL DEFAULT true,
  privacy_visible_recruteurs BOOLEAN NOT NULL DEFAULT true
);

-- ----------------------------------------------------------------------------
-- QUESTIONS / RÉPONSES / COMMENTAIRES (section 5.2 du cahier des charges)
-- ----------------------------------------------------------------------------

CREATE TABLE questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(200) NOT NULL,   -- front exige >= 10 caractères à la création
  body             TEXT NOT NULL,            -- >= 20 caractères
  code_lang        VARCHAR(20),              -- CodeSnippet optionnel : lang + content à plat (1 seul bloc de code par question)
  code_content     TEXT,
  author_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  best_answer_id   UUID,                     -- FK ajoutée après création de answers (référence circulaire)
  votes            INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_question_code CHECK ((code_lang IS NULL) = (code_content IS NULL))
);
CREATE INDEX idx_questions_author ON questions(author_id);
CREATE INDEX idx_questions_created ON questions(created_at DESC);

-- Tags en table de jointure plutôt qu'en TEXT[] : filtrage par tag très fréquent
-- (liste des questions, "Espaces par technologie" P2) → index plus efficace qu'un GIN sur array ici.
CREATE TABLE question_tags (
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag         VARCHAR(40) NOT NULL,
  PRIMARY KEY (question_id, tag)
);
CREATE INDEX idx_question_tags_tag ON question_tags(tag);

CREATE TABLE answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,   -- >= 10 caractères
  code_lang   VARCHAR(20),
  code_content TEXT,
  votes       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_answer_code CHECK ((code_lang IS NULL) = (code_content IS NULL))
);
CREATE INDEX idx_answers_question ON answers(question_id);

ALTER TABLE questions
  ADD CONSTRAINT fk_questions_best_answer
  FOREIGN KEY (best_answer_id) REFERENCES answers(id) ON DELETE SET NULL;

CREATE TABLE answer_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id  UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       VARCHAR(500) NOT NULL,  -- plafonné à 500 car. côté front (slice(0,500))
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_answer_comments_answer ON answer_comments(answer_id);

-- Votes sur question OU réponse : une seule ligne par (user, cible), togglable.
-- target_type + target_id plutôt que deux tables de votes séparées, car le front
-- traite question et réponse comme une même "cible votable" (route unique /votes).
CREATE TABLE votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE, -- regroupement nécessaire pour markBest/validation
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('question', 'answer')),
  target_id   UUID NOT NULL,   -- = question_id si target_type='question', sinon answers.id
  direction   SMALLINT NOT NULL CHECK (direction IN (1, -1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, target_id)  -- toggle : un seul vote actif par user+cible (cf. questions.vote() dans mock/server.ts)
);
CREATE INDEX idx_votes_target ON votes(target_id);

-- ----------------------------------------------------------------------------
-- FIL D'ACTUALITÉ (section 5.2, P2)
-- ----------------------------------------------------------------------------
-- Pas de table dédiée : le fil (FeedItem) est une union de questions + projets
-- + leçons, triée par date. À implémenter côté API comme une vue/requête UNION,
-- pas une table physique (cohérent avec feed() dans mock/server.ts qui recompose
-- à la volée). Si la perf devient un problème, envisager une table feed_items
-- dénormalisée alimentée par triggers — pas nécessaire pour le MVP.

-- ----------------------------------------------------------------------------
-- APPRENTISSAGE : PISTES / LEÇONS / QUIZ (section 5.3)
-- ----------------------------------------------------------------------------

CREATE TABLE tracks (
  id          VARCHAR(40) PRIMARY KEY,  -- slug stable ("web", "api", "git") : référencé dans les URLs /apprendre/[piste]
  title       VARCHAR(160) NOT NULL,
  level       level_type NOT NULL,
  description TEXT NOT NULL,
  position    SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE lessons (
  id         VARCHAR(40) PRIMARY KEY,  -- slug stable ("web-1") : référencé dans /apprendre/[piste]/[lecon]
  track_id   VARCHAR(40) NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  title      VARCHAR(160) NOT NULL,
  minutes    SMALLINT NOT NULL,
  position   SMALLINT NOT NULL DEFAULT 0,  -- ordre dans la piste (remplace l'array lessonIds du mock)
  -- blocks (LessonBlock[]) stockés en JSONB : structure hétérogène (p/code/tip),
  -- jamais interrogée par son contenu, seulement lue en bloc → JSONB adapté, pas de table séparée
  blocks     JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_lessons_track ON lessons(track_id, position);

CREATE TABLE lesson_quiz_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     VARCHAR(40) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL,
  prompt        TEXT NOT NULL,
  options       TEXT[] NOT NULL,
  correct_index SMALLINT NOT NULL,   -- jamais renvoyé au front avant correction (cf. QuizQuestion.answer non envoyé par learn.lesson())
  explanation   TEXT NOT NULL
);
CREATE INDEX idx_lesson_quiz_lesson ON lesson_quiz_questions(lesson_id);

-- Progression par leçon (remplace progressSeed.lessonsDone)
CREATE TABLE user_lesson_progress (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    VARCHAR(40) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

-- ----------------------------------------------------------------------------
-- DÉFIS TECHNIQUES (section 5.3)
-- ----------------------------------------------------------------------------

CREATE TABLE challenges (
  id           VARCHAR(40) PRIMARY KEY,  -- slug stable ("d1"), référencé en URL /defis/[id]
  title        VARCHAR(200) NOT NULL,
  kind         challenge_kind NOT NULL,
  level        level_type NOT NULL,
  points       INTEGER NOT NULL CHECK (points > 0),
  summary      VARCHAR(200) NOT NULL,
  brief        TEXT NOT NULL,
  weekly       BOOLEAN NOT NULL DEFAULT false,  -- mis en avant dans le tri (cf. list() : tri par weekly d'abord)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE challenge_tags (
  challenge_id VARCHAR(40) NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  tag          VARCHAR(40) NOT NULL,
  PRIMARY KEY (challenge_id, tag)
);

CREATE TABLE challenge_quiz_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  VARCHAR(40) NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL,
  prompt        TEXT NOT NULL,
  options       TEXT[] NOT NULL,
  correct_index SMALLINT NOT NULL,
  explanation   TEXT NOT NULL
);
CREATE INDEX idx_challenge_quiz_challenge ON challenge_quiz_questions(challenge_id);

-- Statut du défi quiz par utilisateur (réussi/échoué). Pour les défis "pratique",
-- le statut réel vient de practical_submissions ; cette table garde seulement
-- le cas 'reussi'/'echoue' des quiz (cf. challengeStatus dans progressSeed, qui mélange les deux).
CREATE TABLE user_challenge_status (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id VARCHAR(40) NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  status       challenge_status_type NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id)
);

-- Défis pratiques : solution soumise, validée par un admin sous 48h (section 5.3 + cahier des charges)
CREATE TABLE practical_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id VARCHAR(40) NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  dev_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_url     TEXT NOT NULL,   -- doit matcher github.com|gitlab.com|bitbucket.org (validé aussi côté API, pas que front)
  note         VARCHAR(500) NOT NULL DEFAULT '',
  status       submission_status_type NOT NULL DEFAULT 'en_attente',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);
CREATE INDEX idx_practical_submissions_status ON practical_submissions(status);
CREATE INDEX idx_practical_submissions_dev ON practical_submissions(dev_id);
-- Anti-doublon : pas deux soumissions "en_attente" pour le même (dev, défi) en même temps
CREATE UNIQUE INDEX uq_submission_pending ON practical_submissions(challenge_id, dev_id) WHERE status = 'en_attente';

-- ----------------------------------------------------------------------------
-- POINTS, NIVEAUX, BADGES (section 5.3 + anti-triche section 6 du plan)
-- ----------------------------------------------------------------------------

-- Historique de points : SOURCE DE VÉRITÉ pour le plafond quotidien (200 pts/jour,
-- cf. DAILY_CAP dans mock/server.ts). users.points est un total dénormalisé,
-- recalculable depuis cette table — ne jamais incrémenter points sans y insérer une ligne.
CREATE TABLE point_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      VARCHAR(200) NOT NULL,
  points     INTEGER NOT NULL CHECK (points > 0),  -- toujours positif : pas de retrait de points dans le mock actuel
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_point_events_user_date ON point_events(user_id, created_at);
-- ^ index clé pour calculer todayPoints(uid) = SUM(points) WHERE user_id=? AND created_at::date = today

CREATE TABLE badges (
  id          VARCHAR(20) PRIMARY KEY,  -- slug stable ("b1"), catalogue fixe (8 badges dans le seed)
  name        VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  glyph       VARCHAR(4) NOT NULL
);

CREATE TABLE user_badges (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id   VARCHAR(20) NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)  -- un badge ne peut être obtenu qu'une fois (cf. giveBadge() qui vérifie includes())
);

-- ----------------------------------------------------------------------------
-- PROJETS (section 5.4)
-- ----------------------------------------------------------------------------

CREATE TABLE projects (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  VARCHAR(200) NOT NULL,   -- >= 5 caractères
  summary                VARCHAR(200) NOT NULL,   -- >= 10 caractères
  description            TEXT NOT NULL,
  owner_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url              TEXT,                    -- YouTube/Vimeo uniquement, liste blanche validée en back (isAllowedVideo)
  code_url               TEXT NOT NULL,            -- doit commencer par https://
  seeking_collaborators  BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_seeking ON projects(seeking_collaborators) WHERE seeking_collaborators = true;

CREATE TABLE project_techs (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tech       VARCHAR(40) NOT NULL,
  PRIMARY KEY (project_id, tech)
);
CREATE INDEX idx_project_techs_tech ON project_techs(tech);

CREATE TABLE project_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_comments_project ON project_comments(project_id);

-- Revues par les pairs. validated_by_owner=false tant que le propriétaire n'a pas validé
-- (seul ce qui est validé compte dans le portfolio "vérifié" et rapporte des points à l'auteur).
CREATE TABLE project_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body                TEXT NOT NULL,  -- >= 10 caractères
  validated_by_owner  BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, author_id)  -- un seul avis par personne et par projet (cf. ApiError 409 dans review())
);
CREATE INDEX idx_project_reviews_author ON project_reviews(author_id, validated_by_owner);

CREATE TABLE collab_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(120) NOT NULL,
  message    TEXT NOT NULL,  -- >= 10 caractères
  status     collab_status_type NOT NULL DEFAULT 'en_attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_collab_requests_project ON collab_requests(project_id);
-- Pas d'index unique strict ici : le front vérifie "déjà une demande en_attente" en app,
-- mais ça peut aussi se faire par contrainte partielle si on veut la garantie en base :
CREATE UNIQUE INDEX uq_collab_pending ON collab_requests(project_id, from_id) WHERE status = 'en_attente';

-- ----------------------------------------------------------------------------
-- DÉFIS RECRUTEURS + CANDIDATURES (section 5.4)
-- ----------------------------------------------------------------------------

CREATE TABLE recruiter_challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,   -- >= 8 caractères
  summary      VARCHAR(200) NOT NULL,   -- >= 15 caractères
  brief        TEXT NOT NULL,            -- >= 50 caractères
  country      VARCHAR(60) NOT NULL,
  remote       BOOLEAN NOT NULL DEFAULT true,
  deadline     TIMESTAMPTZ NOT NULL,     -- doit être future à la création
  reward       VARCHAR(200) NOT NULL DEFAULT 'À discuter',
  status       recruiter_challenge_status NOT NULL DEFAULT 'en_attente',  -- validé par un admin avant publication
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recruiter_challenges_recruiter ON recruiter_challenges(recruiter_id);
CREATE INDEX idx_recruiter_challenges_status ON recruiter_challenges(status);

CREATE TABLE recruiter_challenge_skills (
  challenge_id UUID NOT NULL REFERENCES recruiter_challenges(id) ON DELETE CASCADE,
  skill        VARCHAR(40) NOT NULL,
  PRIMARY KEY (challenge_id, skill)
);
CREATE INDEX idx_rc_skills_skill ON recruiter_challenge_skills(skill);

CREATE TABLE applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES recruiter_challenges(id) ON DELETE CASCADE,
  dev_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_url      TEXT NOT NULL,            -- https obligatoire
  demo_url      TEXT,
  message       TEXT NOT NULL,            -- >= 20 caractères
  status        application_status_type NOT NULL DEFAULT 'recue',
  score         SMALLINT CHECK (score BETWEEN 1 AND 5),
  feedback      TEXT,
  proposal      TEXT,                     -- rempli seulement si retenue=true, >= 20 caractères (validé en back)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (challenge_id, dev_id)  -- une seule candidature par dev et par défi (cf. ApiError 409 dans apply())
);
CREATE INDEX idx_applications_challenge ON applications(challenge_id);
CREATE INDEX idx_applications_dev ON applications(dev_id);

-- Important : les candidatures (code, démo, message) ne sont visibles QUE du recruteur
-- propriétaire du défi et du candidat lui-même — à appliquer en back (jamais dans une
-- route publique), cf. section 6 du plan de réalisation ("visibles que du recruteur et du candidat").

-- ----------------------------------------------------------------------------
-- SIGNALEMENTS (section 5.4 / 6)
-- ----------------------------------------------------------------------------

CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type report_target_type NOT NULL,
  target_id   UUID NOT NULL,   -- polymorphe : question.id / answers.id / projects.id selon target_type
  reason      VARCHAR(100) NOT NULL,
  details     TEXT,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      report_status_type NOT NULL DEFAULT 'ouvert',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_status ON reports(status);
-- Pas de doublon ouvert par la même personne sur la même cible (cf. ApiError 409 dans report())
CREATE UNIQUE INDEX uq_report_open ON reports(reporter_id, target_id) WHERE status = 'ouvert';

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS (section 5.2, P2)
-- ----------------------------------------------------------------------------

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       notification_kind NOT NULL,
  text       TEXT NOT NULL,
  href       VARCHAR(300) NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read, created_at DESC);

-- ============================================================================
-- NOTES D'IMPLÉMENTATION (règles métier à coder en back, pas en contrainte SQL)
-- ============================================================================
-- 1. PLAFOND QUOTIDIEN (200 pts/jour) : avant tout INSERT dans point_events,
--    calculer SUM(points) WHERE user_id=? AND created_at >= aujourd'hui minuit UTC,
--    et plafonner le montant crédité à (200 - déjà_gagné_aujourd'hui). Ne jamais
--    insérer un point_event si le crédit réel est 0.
--
-- 2. ANTI-TRICHE : un user ne peut pas voter pour son propre contenu (question/réponse),
--    ne peut pas évaluer son propre projet (review), ne peut pas gagner de points sur
--    ses propres votes reçus s'il est l'auteur. À vérifier en app avant insert.
--
-- 3. CASCADE RECRUTEUR : un recruteur ne peut publier de défi, et un compte recruteur
--    ne peut se connecter normalement, tant que recruiter_status != 'valide'
--    (cf. requireUser() dans mock/server.ts qui bloque avec ApiError 403).
--
-- 4. VISIBILITÉ CANDIDATURES : /recruteur/defis/:id et /recruteur/candidatures ne
--    doivent renvoyer que les candidatures des défis appartenant au recruteur connecté.
--
-- 5. CONFIDENTIALITÉ : respecter user_settings.privacy_visible_recruteurs (exclure des
--    résultats de recherche recruteur), privacy_afficher_ville (masquer city dans les
--    réponses publiques), privacy_profil_public (403 sur profil public si connecté=false).
--
-- 6. NIVEAU DÉRIVÉ : users.level recalculé à chaque award() de points, pas une colonne
--    librement modifiable — seuils : 0-499 Débutant, 500-1999 Intermédiaire, 2000+ Confirmé
--    (cf. levelFor() dans mock/server.ts).
--
-- 7. VALIDATION CÔTÉ API OBLIGATOIRE (cahier des charges, section 6) : toute règle
--    appliquée côté front (longueurs min, domaines vidéo autorisés, formats d'URL)
--    DOIT être revalidée en back — "les masquages d'interface selon le rôle ne
--    remplacent pas les contrôles de l'API : le serveur décide toujours".
-- ============================================================================
