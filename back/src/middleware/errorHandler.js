// Doit rester le DERNIER middleware monté dans server.js.
const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json(err.toJSON());
  }

  // Corps de requête illisible ou trop gros (erreurs d'express.json) : c'est une faute du client, pas du serveur.
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'La requête est illisible (JSON invalide).' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'La requête est trop volumineuse.' });
  }

  // Identifiant mal formé dans l'URL (ex. /questions/abc alors que les ids sont des UUID) :
  // PostgreSQL lève 22P02. Pour le client, ce contenu n'existe simplement pas.
  if (err && err.code === '22P02') {
    return res.status(404).json({ message: "Ce contenu n'existe pas ou a été supprimé." });
  }

  // Texte plus long que la colonne (22001) : filet de sécurité si un schéma de validation laisse passer.
  if (err && err.code === '22001') {
    return res.status(400).json({ message: 'Un des textes est trop long. Raccourcissez-le puis réessayez.' });
  }

  // Contrainte PostgreSQL violée (ex. UNIQUE) non anticipée par une route :
  // on la traduit en 409 générique plutôt que de divulguer le détail SQL.
  if (err && err.code === '23505') {
    return res.status(409).json({ message: 'Ce contenu existe déjà.' });
  }

  // eslint-disable-next-line no-console
  console.error('[erreur non gérée]', err);
  res.status(500).json({ message: 'Le serveur a rencontré un problème. Réessayez dans un instant.' });
}

module.exports = errorHandler;
