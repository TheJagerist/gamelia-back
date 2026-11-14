'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { useToast } from '@/components/toast';
import { SelectField } from '@/components/ui';
import { ApiError, messageFor } from '@/lib/api';
import { COUNTRIES } from '@/lib/constants';
import { ROLE_HOME, useSession } from '@/lib/session';
import type { User } from '@/lib/types';

type Info = { name: string; email: string; login?: string };

/**
 * Dernière étape de l'inscription avec un service externe (GitHub, Google) : le service a confirmé l'identité,
 * il reste le pays et l'acceptation des conditions. Les deux pages /inscription/github et /inscription/google s'appuient dessus.
 */
export function OAuthFinish({
  service,
  loadPending,
  finalise,
  icon,
  subtitle,
  emailLabel,
}: {
  service: 'GitHub' | 'Google';
  loadPending: () => Promise<Info>;
  finalise: (input: { country: string; acceptTerms: boolean }) => Promise<User>;
  icon: React.ReactNode;
  subtitle: (info: Info) => React.ReactNode;
  emailLabel: string;
}) {
  const { setUser, user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [info, setInfo] = useState<Info | null>(null);
  const [expired, setExpired] = useState(false);
  const [country, setCountry] = useState('');
  const [accept, setAccept] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const done = useState({ current: false })[0];

  useEffect(() => {
    loadPending()
      .then(setInfo)
      .catch(() => setExpired(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (user && !done.current) router.replace(ROLE_HOME[user.role]);
  }, [user, router, done]);

  if (expired)
    return (
      <AuthCard title={`Connexion ${service} expirée`}>
        <p className="rounded-lg bg-accent-soft p-4 text-sm">Cette étape n&apos;est plus valable (elle expire au bout de 15 minutes). Recommencez la connexion avec {service}.</p>
        <Link href="/connexion" className="btn mt-5">
          Revenir à la connexion
        </Link>
      </AuthCard>
    );
  if (!info) return <AuthCard title={`Connexion avec ${service}`}>{<p className="text-muted">Chargement…</p>}</AuthCard>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!country || !accept) return;
    setBusy(true);
    setError('');
    try {
      const u = await finalise({ country, acceptTerms: true });
      toast('Bienvenue sur Gamelia ! Complétez votre profil pour être repéré.');
      done.current = true;
      setUser(u);
      router.replace('/profil?bienvenue=1');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? `Cette étape a expiré. Recommencez la connexion avec ${service}.` : messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Dernière étape" subtitle={subtitle(info)}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <dl className="rounded-lg bg-sunken p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Nom</dt>
            <dd className="font-semibold">{info.name || info.login}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-4">
            <dt className="text-muted">{emailLabel}</dt>
            <dd className="break-all text-right font-semibold">{info.email}</dd>
          </div>
        </dl>
        <SelectField label="Pays" value={country} onChange={(e) => setCountry(e.target.value)} error={touched && !country ? 'Choisissez votre pays.' : undefined}>
          <option value="">Choisir un pays</option>
          {COUNTRIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectField>
        {error && (
          <p role="alert" className="rounded bg-danger-soft p-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]" checked={accept} onChange={(e) => setAccept(e.target.checked)} aria-invalid={touched && !accept} />
            <span>
              J&apos;accepte les{' '}
              <Link href="/conditions" target="_blank" className="link">
                conditions d&apos;utilisation
              </Link>{' '}
              et la{' '}
              <Link href="/confidentialite" target="_blank" className="link">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>
          {touched && !accept && (
            <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">
              Cochez la case pour accepter les conditions et la politique de confidentialité.
            </p>
          )}
        </div>
        <button className="btn w-full" disabled={busy}>
          {icon}
          {busy ? 'Création du compte…' : 'Créer mon compte'}
        </button>
        <p className="text-center text-[13px] text-muted">Compte développeur. Vous pourrez définir un mot de passe plus tard dans les paramètres.</p>
      </form>
    </AuthCard>
  );
}
