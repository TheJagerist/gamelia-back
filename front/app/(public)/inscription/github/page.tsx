'use client';
import { Github } from 'lucide-react';
import { OAuthFinish } from '@/components/oauth-finish';
import { api } from '@/lib/api';

// Dernière étape de l'inscription avec GitHub : GitHub a confirmé l'identité, il reste le pays et les conditions.
export default function InscriptionGithubPage() {
  return (
    <OAuthFinish
      service="GitHub"
      loadPending={api.auth.githubPending}
      finalise={api.auth.githubFinaliser}
      icon={<Github className="h-5 w-5" aria-hidden />}
      emailLabel="E-mail GitHub vérifié"
      subtitle={(info) => (
        <>
          Vous êtes connecté à GitHub en tant que <strong>{info.login}</strong>. Choisissez votre pays pour créer votre compte.
        </>
      )}
    />
  );
}
