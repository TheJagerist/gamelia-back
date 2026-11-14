-- Connexion avec Google (OAuth / OpenID Connect).
-- google_id : identifiant « sub » de Google, qui ne change jamais (contrairement à l'adresse e-mail). C'est du texte
-- (Google le définit comme une chaîne). Un compte Google ne peut être relié qu'à un seul compte Gamelia.
ALTER TABLE users ADD COLUMN google_id TEXT;
CREATE UNIQUE INDEX uniq_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;
