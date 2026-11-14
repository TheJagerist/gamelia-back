'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LifeBuoy, MailCheck } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { TextField } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { CONTACT_EMAIL } from '@/lib/site';

// Si l'API a un serveur d'e-mails : formulaire d'envoi d'un lien de réinitialisation.
// Sinon (démonstration, ou SMTP non configuré) : l'équipe remplace le mot de passe à la main
// (commande `npm run reset-password` du back) après avoir vérifié l'identité du membre.
export function ForgotPassword() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.auth.forgotEtat().then((r) => setEnabled(r.enabled));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.auth.forgot(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  if (enabled === null) {
    return <AuthCard title="Mot de passe oublié">{<p className="text-muted">Chargement…</p>}</AuthCard>;
  }

  if (enabled) {
    return (
      <AuthCard title="Mot de passe oublié" subtitle="Indiquez l'adresse e-mail de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.">
        {sent ? (
          <div className="rounded-lg bg-primary-soft p-5" role="status">
            <MailCheck className="mb-2 h-6 w-6 text-primary" aria-hidden />
            <p className="font-semibold">Vérifiez votre boîte e-mail.</p>
            <p className="mt-2 text-sm">
              Si un compte existe avec l&apos;adresse <strong className="break-all">{email.trim()}</strong>, vous y recevrez dans quelques minutes un lien valable 60 minutes. Pensez à regarder dans les courriers indésirables.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="rounded-lg bg-danger-soft p-4 text-sm font-semibold text-danger">
                {error}
              </div>
            )}
            <TextField label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn w-full" disabled={busy || !email.trim()}>
              {busy ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}
        <Link href="/connexion" className="btn btn-secondary mt-5">
          Revenir à la connexion
        </Link>
      </AuthCard>
    );
  }

  const subject = encodeURIComponent('Gamelia : mot de passe oublié');
  return (
    <AuthCard title="Mot de passe oublié" subtitle="L'équipe Gamelia vous aide à retrouver l'accès à votre compte.">
      <div className="rounded-lg bg-primary-soft p-5">
        <LifeBuoy className="mb-2 h-6 w-6 text-primary" aria-hidden />
        <p className="font-semibold">Écrivez-nous depuis l&apos;adresse e-mail de votre compte.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          <li>
            Envoyez un message à{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}`} className="link break-all">
              {CONTACT_EMAIL}
            </a>{' '}
            en indiquant votre nom sur Gamelia.
          </li>
          <li>L&apos;équipe vérifie que la demande vient bien de vous, puis vous répond avec un mot de passe provisoire.</li>
          <li>Connectez-vous, puis choisissez votre propre mot de passe dans Paramètres, Mot de passe.</li>
        </ol>
        <p className="mt-3 text-sm text-muted">Gamelia n&apos;envoie pas d&apos;e-mail automatique : aucun lien ne vous sera envoyé sans que vous ayez écrit d&apos;abord.</p>
      </div>
      <Link href="/connexion" className="btn btn-secondary mt-5">
        Revenir à la connexion
      </Link>
    </AuthCard>
  );
}
