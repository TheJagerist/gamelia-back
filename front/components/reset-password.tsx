'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { TextField } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';

// Page ouverte depuis le lien de l'e-mail : /reinitialiser-mot-de-passe?token=…
export function ResetPassword() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ message: string; expired: boolean } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    // Ne jamais écraser un jeton déjà lu : React peut exécuter cet effet deux fois (mode strict), et la seconde fois
    // l'adresse ne contient plus le jeton (il est retiré ci-dessous).
    setToken((prev) => prev ?? (t && t.length >= 20 ? t : null));
    setReady(true);
    // Le jeton ne doit pas rester dans l'historique ni dans la barre d'adresse une fois lu.
    if (t) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (password.length < 8) return setFieldError('Le mot de passe doit contenir au moins 8 caractères.');
    if (password !== confirm) return setFieldError('Les deux mots de passe ne sont pas identiques.');
    if (!token) return;
    setBusy(true);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const expired = err instanceof ApiError && err.code === 'lien_invalide';
      setError({ message: err instanceof ApiError ? err.message : messageFor(err), expired });
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <AuthCard title="Nouveau mot de passe">{<p className="text-muted">Chargement…</p>}</AuthCard>;

  if (done) {
    return (
      <AuthCard title="Mot de passe modifié">
        <div className="rounded-lg bg-primary-soft p-5" role="status">
          <CheckCircle2 className="mb-2 h-6 w-6 text-primary" aria-hidden />
          <p className="font-semibold">Votre mot de passe a bien été modifié.</p>
          <p className="mt-2 text-sm">Pour votre sécurité, vous avez été déconnecté de tous vos appareils. Connectez-vous avec votre nouveau mot de passe.</p>
        </div>
        <Link href="/connexion" className="btn mt-5">
          Se connecter
        </Link>
      </AuthCard>
    );
  }

  if (!token || error?.expired) {
    return (
      <AuthCard title="Lien invalide ou expiré">
        <div role="alert" className="rounded-lg bg-danger-soft p-4 text-sm text-danger">
          <p className="font-semibold">{error?.message || 'Ce lien est invalide ou a expiré.'}</p>
          <p className="mt-1">Un lien n&apos;est valable que 60 minutes et ne peut servir qu&apos;une seule fois.</p>
        </div>
        <Link href="/mot-de-passe-oublie" className="btn mt-5">
          Demander un nouveau lien
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nouveau mot de passe" subtitle="Choisissez un mot de passe d'au moins 8 caractères.">
      {error && (
        <div role="alert" className="mb-5 rounded-lg bg-danger-soft p-4 text-sm font-semibold text-danger">
          {error.message}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="relative">
          <TextField label="Nouveau mot de passe" type={show ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-0 top-[1.6rem] inline-flex h-11 w-11 items-center justify-center text-muted hover:text-ink" aria-label={show ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}>
            {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
          </button>
        </div>
        <TextField label="Confirmer le mot de passe" type={show ? 'text' : 'password'} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fieldError ?? undefined} />
        <button className="btn w-full" disabled={busy || !password || !confirm}>
          {busy ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </AuthCard>
  );
}
