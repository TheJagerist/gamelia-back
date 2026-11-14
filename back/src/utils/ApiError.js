// Miroir exact de lib/api/errors.ts (front) : { message, code?, fields? }.
// Pour 400/403, lib_api_http.ts affiche `message` TEL QUEL à l'utilisateur :
// toujours écrire des messages en français correct, jamais de message technique.
class ApiError extends Error {
  constructor(status, message, { code, fields } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  toJSON() {
    const body = { message: this.message };
    if (this.code) body.code = this.code;
    if (this.fields) body.fields = this.fields;
    return body;
  }
}

// Raccourcis pour les cas les plus fréquents du contrat de routes.
ApiError.badRequest = (message, fields) => new ApiError(400, message, { fields });
ApiError.unauthorized = (message = 'Vous devez être connecté.') => new ApiError(401, message);
ApiError.forbidden = (message = "Vous n'avez pas accès à cette action.", code) => new ApiError(403, message, { code });
ApiError.notFound = (message = "Ce contenu n'existe pas ou a été supprimé.") => new ApiError(404, message);
ApiError.conflict = (message = 'Ce contenu existe déjà.', code) => new ApiError(409, message, { code });
ApiError.tooMany = (message = 'Trop de tentatives. Patientez une minute avant de réessayer.') => new ApiError(429, message);

module.exports = ApiError;
