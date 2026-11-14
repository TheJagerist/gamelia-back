import type { Metadata } from 'next';
import { ResetPassword } from '@/components/reset-password';

// Le lien contient un jeton secret : pas d'indexation, et le navigateur n'envoie pas l'adresse à d'autres sites.
export const metadata: Metadata = { title: 'Nouveau mot de passe', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function ResetPage() {
  return <ResetPassword />;
}
