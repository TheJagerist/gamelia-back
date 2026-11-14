// Sérialisation unique des utilisateurs, conforme à lib/types.ts du front :
//   - PublicUser : visible par les autres (city masquée si privacy_afficher_ville = false,
//     jamais d'email) ; équivalent de pub() dans lib/mock/server.ts.
//   - User       : le compte connecté (email, recruiterStatus, following…) ; équivalent de toMe().
const { query } = require('../db/pool');

/**
 * Colonnes SQL à ajouter dans un SELECT pour reconstruire un PublicUser depuis la table `users`
 * jointe sous `alias`. Les colonnes sont renommées `${prefix}colonne` (ex. 'author_' -> author_links).
 * `links` est agrégé en JSON dans la requête (pas de requête supplémentaire par ligne côté JS).
 */
function userCols(alias, prefix = '') {
  const c = (name) => `${prefix}${name}`;
  return `
    ${alias}.id AS ${c('id')}, ${alias}.username AS ${c('username')}, ${alias}.name AS ${c('name')},
    ${alias}.role AS ${c('role')}, ${alias}.country AS ${c('country')},
    CASE WHEN COALESCE((SELECT us.privacy_afficher_ville FROM user_settings us WHERE us.user_id = ${alias}.id), true)
         THEN ${alias}.city END AS ${c('city')},
    ${alias}.bio AS ${c('bio')}, ${alias}.avatar_url AS ${c('avatar_url')}, ${alias}.skills AS ${c('skills')},
    ${alias}.level AS ${c('level')}, ${alias}.points AS ${c('points')}, ${alias}.github_verified AS ${c('github_verified')},
    ${alias}.joined_at AS ${c('joined_at')}, ${alias}.company AS ${c('company')},
    COALESCE((SELECT json_agg(json_build_object('kind', dl.kind, 'label', dl.label, 'url', dl.url) ORDER BY dl.position)
              FROM declared_links dl WHERE dl.user_id = ${alias}.id), '[]'::json) AS ${c('links')}`;
}

/** Construit un PublicUser à partir d'une ligne produite avec userCols(alias, prefix). */
function toPublicUser(row, prefix = '') {
  const p = (k) => row[`${prefix}${k}`];
  return {
    id: p('id'),
    username: p('username'),
    name: p('name'),
    role: p('role'),
    country: p('country'),
    city: p('city') ?? undefined,
    bio: p('bio'),
    avatarUrl: p('avatar_url') ?? undefined,
    skills: p('skills'),
    level: p('level'),
    points: p('points'),
    githubVerified: p('github_verified'),
    links: p('links') || [],
    joinedAt: p('joined_at'),
    company: p('company') ?? undefined,
  };
}

/** Le compte connecté, complet (type User). Jamais de password_hash. */
async function loadMe(userId) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.name, u.email, u.role, u.country, u.city, u.bio, u.avatar_url, u.skills,
            u.level, u.points, u.github_verified, u.has_password, u.joined_at, u.company, u.recruiter_status,
            COALESCE((SELECT json_agg(json_build_object('kind', dl.kind, 'label', dl.label, 'url', dl.url) ORDER BY dl.position)
                      FROM declared_links dl WHERE dl.user_id = u.id), '[]'::json) AS links,
            COALESCE((SELECT array_agg(ft.tag ORDER BY ft.tag) FROM followed_tags ft WHERE ft.user_id = u.id), '{}') AS following
     FROM users u WHERE u.id = $1`,
    [userId]
  );
  const u = rows[0];
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    country: u.country,
    city: u.city ?? undefined,
    bio: u.bio,
    avatarUrl: u.avatar_url ?? undefined,
    skills: u.skills,
    level: u.level,
    points: u.points,
    githubVerified: u.github_verified,
    hasPassword: u.has_password, // faux pour un compte créé avec GitHub tant qu'il n'a pas défini de mot de passe
    links: u.links,
    joinedAt: u.joined_at,
    company: u.company ?? undefined,
    recruiterStatus: u.recruiter_status ?? undefined,
    following: u.following,
  };
}

module.exports = { userCols, toPublicUser, loadMe };
