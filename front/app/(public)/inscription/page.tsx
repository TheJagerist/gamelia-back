'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Briefcase, Clock, Code2, Github } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { useToast } from '@/components/toast';
import { SelectField, TextField, cx } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { COUNTRIES } from '@/lib/constants';
import { githubStartUrl } from '@/lib/github-oauth';
import { googleStartUrl } from '@/lib/google-oauth';
import { GoogleIcon } from '@/components/google-icon';
import { ROLE_HOME, useSession } from '@/lib/session';

type Role = 'developpeur' | 'recruteur';
type Form = { name: string; email: string; password: string; country: string; company: string };
const TERMS_ERROR = 'Cochez la case pour accepter les conditions et la politique de confidentialité.';

function validate(f: Form, role: Role): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.name.trim().length < 2) e.name = 'Indiquez votre nom.';
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Adresse e-mail invalide, par exemple nom@exemple.com.';
  if (f.password.length < 8) e.password = 'Au moins 8 caractères.';
  if (!f.country) e.country = 'Choisissez votre pays.';
  if (role === 'recruteur' && f.company.trim().length < 2) e.company = "Indiquez le nom de l'entreprise.";
  return e;
}

export default function InscriptionPage() {
  const { setUser, user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [role, setRole] = useState<Role>('developpeur');
  const [f, setF] = useState<Form>({ name: '', email: '', password: '', country: '', company: '' });
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [serverErr, setServerErr] = useState<Partial<Record<keyof Form, string>>>({});
  const [globalErr, setGlobalErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [accept, setAccept] = useState(false);
  const [acceptTouched, setAcceptTouched] = useState(false);
  const [githubOn, setGithubOn] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('role') === 'recruteur') setRole('recruteur');
    void api.auth.githubEtat().then((r) => setGithubOn(r.enabled));
    void api.auth.googleEtat().then((r) => setGoogleOn(r.enabled));
  }, []);
  // Déjà connecté en arrivant sur la page : retour à son espace. Après une inscription réussie, en revanche,
  // on laisse la redirection vers le profil (« bienvenue ») se faire.
  const justRegistered = useRef(false);
  useEffect(() => {
    if (user && !justRegistered.current) router.replace(ROLE_HOME[user.role]);
  }, [user, router]);

  const errs = validate(f, role);
  const show = (k: keyof Form) => serverErr[k] || (touched[k] ? errs[k] : undefined);
  const bind = (k: keyof Form) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setF({ ...f, [k]: e.target.value });
      setServerErr({ ...serverErr, [k]: undefined });
    },
    onBlur: () => setTouched({ ...touched, [k]: true }),
    error: show(k),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, country: true, company: true });
    setAcceptTouched(true);
    if (Object.keys(errs).length || !accept) return;
    setBusy(true);
    setGlobalErr('');
    try {
      const res = await api.auth.register({ role, name: f.name, email: f.email, password: f.password, country: f.country, company: role === 'recruteur' ? f.company : undefined, acceptTerms: accept });
      if ('pending' in res) setPending(true);
      else {
        toast('Bienvenue sur Gamelia ! Complétez votre profil pour être repéré.');
        justRegistered.current = true;
        setUser(res);
        router.replace('/profil?bienvenue=1');
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields) setServerErr(err.fields as Partial<Record<keyof Form, string>>);
      setGlobalErr(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  if (pending)
    return (
      <AuthCard title="Compte créé, en attente de validation">
        <div className="flex gap-3 rounded-lg bg-accent-soft p-5">
          <Clock className="mt-0.5 h-6 w-6 shrink-0 text-accent-ink" aria-hidden />
          <div>
            <p className="font-semibold">L&apos;équipe Gamelia vérifie {f.company}.</p>
            <p className="mt-1 text-sm">
              Nous validons chaque compte recruteur pour protéger les développeurs. Gamelia n&apos;envoie pas d&apos;e-mail : revenez vous connecter avec {f.email}. Tant que la
              validation n&apos;est pas faite, la page de connexion vous l&apos;indique ; ensuite vous pourrez publier des défis et contacter des profils.
            </p>
          </div>
        </div>
        <Link href="/" className="btn btn-secondary mt-5">
          Revenir à l&apos;accueil
        </Link>
      </AuthCard>
    );

  return (
    <AuthCard
      title="Rejoindre Gamelia"
      subtitle={
        <>
          Déjà inscrit ?{' '}
          <Link href="/connexion" className="link">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <fieldset>
          <legend className="field-label">Vous êtes</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { v: 'developpeur', t: 'Développeur', d: 'Échanger, apprendre, prouver mes compétences.', icon: Code2 },
                { v: 'recruteur', t: 'Recruteur', d: 'Publier des défis et repérer des talents. Compte validé par l’équipe.', icon: Briefcase },
              ] as const
            ).map((o) => {
              const Icon = o.icon;
              const on = role === o.v;
              return (
                <label key={o.v} className={cx('flex cursor-pointer gap-3 rounded-lg border-2 p-4 transition-colors', on ? 'border-primary bg-primary-soft' : 'border-line hover:border-muted')}>
                  <input type="radio" name="role" value={o.v} checked={on} onChange={() => setRole(o.v)} className="sr-only" />
                  <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', on ? 'text-primary' : 'text-muted')} aria-hidden />
                  <span>
                    <span className="block font-semibold">{o.t}</span>
                    <span className="text-sm text-muted">{o.d}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <TextField label="Nom complet" autoComplete="name" {...bind('name')} />
        {role === 'recruteur' && <TextField label="Entreprise" autoComplete="organization" {...bind('company')} />}
        <TextField label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" {...bind('email')} />
        <TextField label="Mot de passe" type="password" autoComplete="new-password" hint="Au moins 8 caractères." {...bind('password')} />
        <SelectField label="Pays" {...bind('country')}>
          <option value="">Choisir un pays</option>
          {COUNTRIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectField>

        {globalErr && (
          <p role="alert" className="rounded bg-danger-soft p-3 text-sm font-semibold text-danger">
            {globalErr}
          </p>
        )}
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-[15px]">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
              checked={accept}
              onChange={(e) => {
                setAccept(e.target.checked);
                setAcceptTouched(true);
              }}
              aria-invalid={acceptTouched && !accept}
              aria-describedby={acceptTouched && !accept ? 'accept-err' : undefined}
            />
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
          {acceptTouched && !accept && (
            <p id="accept-err" role="alert" className="mt-1.5 text-sm font-semibold text-danger">
              {TERMS_ERROR}
            </p>
          )}
        </div>
        <button className="btn w-full" disabled={busy}>
          {busy ? 'Création du compte…' : role === 'recruteur' ? 'Demander un compte recruteur' : 'Créer mon compte'}
        </button>
        <p className="text-center text-[13px] text-muted">Vos données servent uniquement à faire fonctionner votre compte Gamelia.</p>
      </form>
      {(googleOn || githubOn) && role === 'developpeur' && (
        <div className="mt-6 space-y-3 border-t border-line pt-5">
          {googleOn && (
            <a className="btn btn-secondary w-full" href={googleStartUrl('connexion')}>
              <GoogleIcon className="h-5 w-5" />
              S&apos;inscrire avec Google
            </a>
          )}
          {githubOn && (
            <a className="btn btn-secondary w-full" href={githubStartUrl('connexion')}>
              <Github className="h-5 w-5" aria-hidden />
              S&apos;inscrire avec GitHub
            </a>
          )}
        </div>
      )}
    </AuthCard>
  );
}
