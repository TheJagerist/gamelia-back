import type { Metadata } from 'next';
import { ForgotPassword } from '@/components/forgot-password';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default function ForgotPage() {
  return <ForgotPassword />;
}
