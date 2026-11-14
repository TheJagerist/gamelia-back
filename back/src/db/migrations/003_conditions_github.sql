-- Révision finale (novembre 2026).
-- 1. Acceptation des conditions d'utilisation et de la politique de confidentialité à l'inscription.
--    NULL pour les comptes créés avant cette migration et pour l'admin créé en ligne de commande.
ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMPTZ;

-- 2. Vérification réelle du compte GitHub : le membre place un code à usage unique dans sa bio GitHub,
--    l'API relit la bio publique et confirme. Un compte GitHub ne peut vérifier qu'un seul compte Gamelia.
ALTER TABLE users ADD COLUMN github_username VARCHAR(39);
ALTER TABLE users ADD COLUMN github_code VARCHAR(40);
ALTER TABLE users ADD COLUMN github_code_expires_at TIMESTAMPTZ;
CREATE UNIQUE INDEX uniq_users_github_verified ON users (lower(github_username)) WHERE github_verified;
