'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Clock, Eye, EyeOff, Github } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { useToast } from '@/components/toast';
import { TextField } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { githubErrorMessage, githubStartUrl } from '@/lib/github-oauth';
import { ROLE_HOME, useSession } from '@/lib/session';

// Comptes de démonstration : développement local uniquement. La condition est écrite en toutes lettres pour que
// l'outil de build la résolve : sur le site en ligne, ce composant et ses identifiants ne sont pas inclus du tout.
const DemoAccounts =
  process.env.NEXT_PUBLIC_API_MOCK === 'true' || process.env.NEXT_PUBLIC_SHOW_DEMO === 'true'
    ? dynamic(() => import('@/components/demo-accounts').then((mod) => mod.DemoAccounts))
    : null;

export default function ConnexionPage() {
  const { setUser, user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [suite, setSuite] = useState<string | null>(null);
  const [githubOn, setGithubOn] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('suite');
    // On n'accepte que des chemins internes, pour éviter les redirections vers un autre site.
    if (s && s.startsWith('/') && !s.startsWith('//')) setSuite(s);
    // Retour de GitHub en erreur : l'API renvoie ici avec ?erreur=<code>.
    const code = q.get('erreur');
    const msg = githubErrorMessage(code);
    if (code && msg) setError(new ApiError(400, msg, code));
    void api.auth.githubEtat().then((r) => setGithubOn(r.enabled));
  }, []);

  useEffect(() => {
    if (user) router.replace(ROLE_HOME[user.role]);
  }, [user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await api.auth.login(email, password);
      toast(`Bonjour ${u.name.split(' ')[0]}, vous êtes connecté.`);
      setUser(u);
      router.replace(suite || ROLE_HOME[u.role]);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, messageFor(err)));
    } finally {
      setBusy(false);
    }
  };

  const pending = error?.code === 'recruteur_non_valide';

  return (
    <AuthCard
      title="Se connecter"
      subtitle={
        <>
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="link">
            Rejoindre la communauté
          </Link>
        </>
      }
      aside={
        DemoAccounts && (
          <DemoAccounts
            onPick={(demoEmail, demoPassword) => {
              setEmail(demoEmail);
              setPassword(demoPassword);
              setError(null);
            }}
          />
        )
      }
    >
      {error && (
        <div role="alert" className={`mb-5 flex gap-3 rounded-lg p-4 text-sm ${pending ? 'bg-accent-soft text-ink' : 'bg-danger-soft text-danger'}`}>
          {pending && <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden />}
          <div>
            {pending && <p className="font-semibold">Compte recruteur en cours de validation</p>}
            <p className={pending ? 'mt-0.5' : 'font-semibold'}>{error.message}</p>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <div className="relative">
            <TextField label="Mot de passe" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} className="absolute bottom-0 right-0 inline-flex h-11 w-11 items-center justify-center text-muted hover:text-ink" aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
              {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
            </button>
          </div>
          <Link href="/mot-de-passe-oublie" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <button className="btn w-full" disabled={busy || !email || !password}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      {githubOn && (
        <div className="mt-6 border-t border-line pt-5">
          {/* Navigation complète (pas un appel fetch) : le navigateur part vers GitHub puis revient sur le site. */}
          <a className="btn btn-secondary w-full" href={githubStartUrl('connexion')}>
            <Github className="h-5 w-5" aria-hidden />
            Continuer avec GitHub
          </a>
          <p className="mt-2 text-center text-[13px] text-muted">Aucun mot de passe GitHub n&apos;est transmis à Gamelia.</p>
        </div>
      )}
    </AuthCard>
  );
}
