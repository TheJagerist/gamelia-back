-- Connexion avec GitHub (OAuth).
-- 1. github_id : identifiant numérique GitHub, qui ne change jamais (contrairement au nom d'utilisateur).
--    Un compte GitHub ne peut être relié qu'à un seul compte Gamelia.
ALTER TABLE users ADD COLUMN github_id BIGINT;
CREATE UNIQUE INDEX uniq_users_github_id ON users (github_id) WHERE github_id IS NOT NULL;

-- 2. has_password : faux pour un compte créé avec GitHub (son mot de passe est une valeur aléatoire que personne ne
--    connaît). Le membre peut en définir un depuis ses paramètres ; tant qu'il n'en a pas, il confirme la suppression
--    de son compte en tapant son nom d'utilisateur.
ALTER TABLE users ADD COLUMN has_password BOOLEAN NOT NULL DEFAULT true;
