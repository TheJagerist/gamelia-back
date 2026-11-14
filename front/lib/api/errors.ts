// Messages utilisateur associés à chaque erreur de l'API (cahier des charges, section 7).

export const ERROR_MESSAGES: Record<number, string> = {
  0: 'Connexion impossible. Vérifiez votre réseau puis réessayez.',
  400: 'Certaines informations sont incorrectes. Vérifiez le formulaire.',
  401: 'Votre session a expiré. Connectez-vous pour continuer.',
  403: "Vous n'avez pas accès à cette action.",
  404: "Ce contenu n'existe pas ou a été supprimé.",
  409: 'Ce contenu existe déjà.',
  429: 'Trop de tentatives. Patientez une minute avant de réessayer.',
  500: 'Le serveur a rencontré un problème. Réessayez dans un instant.',
  502: 'Le service a mis trop de temps à répondre. Réessayez dans un instant.',
  503: 'Ce service est momentanément indisponible. Réessayez plus tard.',
};

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;

  constructor(status: number, message?: string, code?: string, fields?: Record<string, string>) {
    super(message || ERROR_MESSAGES[status] || ERROR_MESSAGES[500]);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return ERROR_MESSAGES[0];
}
