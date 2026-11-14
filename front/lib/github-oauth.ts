// Connexion avec GitHub : adresse de départ et messages des erreurs renvoyées par l'API dans l'URL (?erreur=… ou ?github=…).

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

/** Adresse qui envoie le navigateur vers GitHub (navigation complète, pas un appel fetch). */
export function githubStartUrl(mode: 'connexion' | 'lier'): string {
  return `${BASE}/auth/github/start?mode=${mode}`;
}

export const GITHUB_ERRORS: Record<string, string> = {
  github_indisponible: 'La connexion avec GitHub n’est pas disponible pour le moment. Utilisez votre adresse e-mail.',
  github_refuse: 'Vous avez annulé la connexion sur GitHub. Rien n’a été modifié.',
  github_etat: 'La connexion a expiré ou a été interrompue. Réessayez.',
  github_echec: 'GitHub n’a pas répondu comme prévu. Réessayez dans un instant.',
  github_email: 'Votre compte GitHub n’a aucune adresse e-mail vérifiée. Vérifiez-en une dans les réglages de GitHub, puis réessayez.',
  github_email_existe: 'Un compte Gamelia existe déjà avec l’adresse e-mail de ce compte GitHub. Connectez-vous avec votre mot de passe, puis liez GitHub depuis votre profil.',
  github_deja_lie: 'Ce compte GitHub est déjà relié à un autre compte Gamelia.',
  recruteur_non_valide: 'Votre compte recruteur est en cours de validation par l’équipe Gamelia.',
  session: 'Votre session ne correspond plus à cette demande. Connectez-vous puis réessayez.',
};

export function githubErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return GITHUB_ERRORS[code] || 'La connexion avec GitHub a échoué. Réessayez.';
}
