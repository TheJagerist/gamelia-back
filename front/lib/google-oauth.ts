// Connexion avec Google : adresse de départ et messages des erreurs renvoyées par l'API dans l'URL (?erreur=… ou ?google=…).
import { GITHUB_ERRORS } from '@/lib/github-oauth';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

/** Adresse qui envoie le navigateur vers Google (navigation complète, pas un appel fetch). */
export function googleStartUrl(mode: 'connexion' | 'lier'): string {
  return `${BASE}/auth/google/start?mode=${mode}`;
}

export const GOOGLE_ERRORS: Record<string, string> = {
  google_indisponible: 'La connexion avec Google n’est pas disponible pour le moment. Utilisez votre adresse e-mail.',
  google_refuse: 'Vous avez annulé la connexion sur Google. Rien n’a été modifié.',
  google_etat: 'La connexion a expiré ou a été interrompue. Réessayez.',
  google_echec: 'Google n’a pas répondu comme prévu. Réessayez dans un instant.',
  google_email: 'L’adresse e-mail de ce compte Google n’est pas vérifiée par Google. Vérifiez-la dans votre compte Google, puis réessayez.',
  google_email_existe: 'Un compte Gamelia existe déjà avec l’adresse e-mail de ce compte Google. Connectez-vous avec votre mot de passe, puis liez Google depuis vos paramètres.',
  google_deja_lie: 'Ce compte Google est déjà relié à un autre compte Gamelia.',
  recruteur_non_valide: 'Votre compte recruteur est en cours de validation par l’équipe Gamelia.',
  session: 'Votre session ne correspond plus à cette demande. Connectez-vous puis réessayez.',
};

export function googleErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return GOOGLE_ERRORS[code] || 'La connexion avec Google a échoué. Réessayez.';
}

/**
 * Message d'erreur pour n'importe quelle connexion « avec un service » (GitHub ou Google) : le code reçu dans l'URL
 * (?erreur=…) dit de quel service il vient ; un code inconnu donne un message général.
 */
export function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code.startsWith('google_')) return googleErrorMessage(code);
  if (code in GITHUB_ERRORS) return GITHUB_ERRORS[code];
  if (code in GOOGLE_ERRORS) return GOOGLE_ERRORS[code]; // codes communs (recruteur_non_valide, session)
  return null;
}
