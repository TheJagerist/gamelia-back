// Fait le pont entre un schéma zod et le format { message, fields } attendu
// par lib_api_errors.ts. zod donne déjà une liste d'erreurs par champ : on la
// transforme en objet plat { nomDuChamp: "message en français" }.
const ApiError = require('./ApiError');

function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw ApiError.badRequest('Certaines informations sont incorrectes. Vérifiez le formulaire.', fields);
}

module.exports = validate;
