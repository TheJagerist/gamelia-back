// Évite d'écrire try/catch dans chaque route async : toute erreur (ou rejet
// de promesse) est transmise à next(), donc interceptée par errorHandler.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
