'use client';
import { GoogleIcon } from '@/components/google-icon';
import { OAuthFinish } from '@/components/oauth-finish';
import { api } from '@/lib/api';

// Dernière étape de l'inscription avec Google : Google a confirmé l'identité, il reste le pays et les conditions.
export default function InscriptionGooglePage() {
  return (
    <OAuthFinish
      service="Google"
      loadPending={api.auth.googlePending}
      finalise={api.auth.googleFinaliser}
      icon={<GoogleIcon className="h-5 w-5" />}
      emailLabel="E-mail Google vérifié"
      subtitle={(info) => (
        <>
          Vous êtes connecté avec Google (<strong>{info.email}</strong>). Choisissez votre pays pour créer votre compte.
        </>
      )}
    />
  );
}
