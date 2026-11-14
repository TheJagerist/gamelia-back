'use client';
// Protection des pages selon le rôle. Le serveur reste l'autorité : cette garde évite seulement
// d'afficher un écran inutilisable, l'API refuse de toute façon les actions non autorisées.
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ROLE_HOME, ROLE_LABEL, useSession } from '@/lib/session';
import type { Role } from '@/lib/types';
import { useToast } from './toast';
import { ListSkeleton, Skeleton } from './ui';

const SPACE_LABEL: Record<Role, string> = {
  developpeur: 'aux développeurs',
  recruteur: 'aux recruteurs',
  admin: "à l'équipe Gamelia",
};

export function RoleGuard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, status, loggedOut } = useSession();
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const warned = useRef(false);
  const allowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (status !== 'ready' || allowed || warned.current) return;
    warned.current = true;
    if (!user && loggedOut) {
      router.replace('/'); // déconnexion volontaire : retour à l'accueil, sans message
    } else if (!user) {
      toast('Connectez-vous pour accéder à cette page.', 'info');
      router.replace(`/connexion?suite=${encodeURIComponent(path)}`);
    } else {
      toast(`Cette page est réservée ${SPACE_LABEL[roles[0]!]}. Vous êtes connecté en tant que ${ROLE_LABEL[user.role].toLowerCase()}.`, 'info');
      router.replace(ROLE_HOME[user.role]);
    }
  }, [status, allowed, user, loggedOut, roles, router, path, toast]);

  if (!allowed)
    return (
      <div aria-busy="true" className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <ListSkeleton rows={3} />
      </div>
    );
  return <>{children}</>;
}
