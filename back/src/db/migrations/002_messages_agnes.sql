-- ============================================================================
-- GAMELIA — Migration 002 : messagerie privée et assistante Agnès
-- Miroir de lib/mock/messages.ts (front) et du nouvel espace « Agnès ».
-- ============================================================================

-- ----------------------------------------------------------------------------
-- MESSAGERIE PRIVÉE
-- ----------------------------------------------------------------------------
-- Une conversation relie exactement deux membres. La paire est normalisée
-- (user_low < user_high) pour qu'il n'existe jamais deux conversations entre
-- les mêmes personnes, quel que soit celui qui écrit en premier.
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_conversation_pair CHECK (user_low < user_high),
  UNIQUE (user_low, user_high)
);
CREATE INDEX idx_conversations_low ON conversations(user_low, last_message_at DESC);
CREATE INDEX idx_conversations_high ON conversations(user_high, last_message_at DESC);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            VARCHAR(1000) NOT NULL CHECK (length(btrim(body)) >= 1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_author_date ON messages(author_id, created_at); -- limite de 10 messages par minute

-- Dernière lecture de chaque membre dans chaque conversation (calcul des non-lus).
CREATE TABLE conversation_reads (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Blocages : « blocker » ne reçoit plus rien de « blocked » et ne peut plus lui écrire.
CREATE TABLE user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_block_self CHECK (blocker_id <> blocked_id)
);

-- ----------------------------------------------------------------------------
-- AGNÈS (assistante IA, API Agnes AI)
-- ----------------------------------------------------------------------------
-- Une seule piste d'Agnès par question, générée à la demande d'un membre puis
-- visible par tous : un seul appel à l'API par question, quel que soit le trafic.
-- Elle ne rapporte aucun point et ne peut pas devenir « meilleure réponse ».
CREATE TABLE agnes_answers (
  question_id  UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  model        VARCHAR(80) NOT NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Journal minimal des appels (sans le contenu) : sert à la limite d'usage par membre.
CREATE TABLE agnes_usage (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       VARCHAR(20) NOT NULL CHECK (kind IN ('question', 'discussion')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agnes_usage_user_date ON agnes_usage(user_id, created_at);
