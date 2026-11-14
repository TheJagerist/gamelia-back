'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, Globe, KeyRound, Lock, Monitor, Moon, Palette, Sun, Trash2, UserRound } from 'lucide-react';
import { useToast } from '@/components/toast';
import { Async, Dialog, PageHeader, TextField, cx } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { ROLE_LABEL, useSession } from '@/lib/session';
import { applyThemePref, themePref, type ThemePref } from '@/lib/theme';
import type { Settings } from '@/lib/types';

const SECTIONS = [
  { id: 'compte', label: 'Compte', icon: UserRound },
  { id: 'apparence', label: 'Apparence', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'confidentialite', label: 'Confidentialité', icon: Lock },
  { id: 'langue', label: 'Langue', icon: Globe },
  { id: 'securite', label: 'Mot de passe', icon: KeyRound },
  { id: 'suppression', label: 'Supprimer le compte', icon: Trash2 },
];

/** Interrupteur accessible (rôle switch), 44 px de zone tactile. */
function Switch({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-semibold">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-primary' : 'bg-line')}
      >
        <span className={cx('inline-block h-5 w-5 rounded-full bg-surface shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}

function Section({ id, title, description, children, danger }: { id: string; title: string; description?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className={cx('panel scroll-mt-24 p-5 sm:p-6', danger && 'border-danger/40')}>
      <h2 id={`${id}-t`} className={cx('text-lg', danger && 'text-danger')}>
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ParametresPage() {
  const res = useResource(() => api.settings.get(), []);
  return (
    <>
      <PageHeader title="Paramètres" description="Votre compte, l'apparence du site, les notifications et la confidentialité." />
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Sections des paramètres" className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={cx('flex min-h-[40px] items-center gap-2.5 rounded px-3 text-[15px] font-semibold hover:bg-sunken', s.id === 'suppression' ? 'text-danger' : 'text-muted hover:text-ink')}>
                  <s.icon className="h-4 w-4" aria-hidden />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Async res={res}>{(s) => <SettingsForm initial={s} />}</Async>
      </div>
    </>
  );
}

function SettingsForm({ initial }: { initial: Settings }) {
  const { user, logout } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [theme, setTheme] = useState<ThemePref>('systeme');
  useEffect(() => setTheme(themePref()), []);
  if (!user) return null;
  const isDev = user.role === 'developpeur';

  const save = async (patch: Partial<Settings>, ok = 'Paramètre enregistré.') => {
    const prev = s;
    setS({ ...s, ...patch, notify: { ...s.notify, ...patch.notify }, privacy: { ...s.privacy, ...patch.privacy } });
    try {
      setS(await api.settings.update(patch));
      toast(ok);
    } catch (e) {
      setS(prev);
      toast(messageFor(e), 'error');
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <Section id="compte" title="Compte">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Nom</dt>
            <dd className="font-semibold">{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Adresse e-mail</dt>
            <dd className="font-semibold break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Type de compte</dt>
            <dd className="font-semibold">{ROLE_LABEL[user.role]}{user.company ? `, ${user.company}` : ''}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Pays</dt>
            <dd className="font-semibold">{user.country}</dd>
          </div>
        </dl>
        {user.role !== 'admin' && (
          <Link href={isDev ? '/profil' : '/recruteur/compte'} className="btn btn-secondary btn-sm mt-5">
            Modifier mon profil
          </Link>
        )}
      </Section>

      <Section id="apparence" title="Apparence" description="Le choix est mémorisé sur cet appareil.">
        <div role="radiogroup" aria-label="Thème" className="grid gap-3 sm:grid-cols-3">
          {(
            [
              { v: 'clair', label: 'Clair', icon: Sun },
              { v: 'sombre', label: 'Sombre', icon: Moon },
              { v: 'systeme', label: 'Comme mon appareil', icon: Monitor },
            ] as const
          ).map((o) => {
            const on = theme === o.v;
            return (
              <button
                key={o.v}
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setTheme(o.v);
                  applyThemePref(o.v);
                  toast('Thème appliqué.');
                }}
                className={cx('flex min-h-[64px] items-center gap-3 rounded-lg border-2 px-4 text-left font-semibold transition-colors', on ? 'border-primary bg-primary-soft' : 'border-line hover:border-muted')}
              >
                <o.icon className={cx('h-5 w-5', on ? 'text-primary' : 'text-muted')} aria-hidden />
                {o.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section id="notifications" title="Notifications" description="Ce qui apparaît dans la cloche de l'en-tête.">
        <div className="divide-y divide-line">
          {isDev && <Switch label="Réponses à mes questions" checked={s.notify.reponses} onChange={(v) => save({ notify: { ...s.notify, reponses: v } })} />}
          {isDev && <Switch label="Commentaires et revues" hint="Sur vos réponses et vos projets." checked={s.notify.commentaires} onChange={(v) => save({ notify: { ...s.notify, commentaires: v } })} />}
          {isDev && <Switch label="Badges et points" checked={s.notify.badges} onChange={(v) => save({ notify: { ...s.notify, badges: v } })} />}
          {user.role !== 'admin' && <Switch label={isDev ? 'Candidatures et messages de recruteurs' : 'Nouvelles candidatures'} checked={s.notify.candidatures} onChange={(v) => save({ notify: { ...s.notify, candidatures: v } })} />}
          <Switch label="Résumé hebdomadaire par e-mail" hint="Un e-mail le lundi avec l'essentiel de la semaine." checked={s.notify.resumeHebdo} onChange={(v) => save({ notify: { ...s.notify, resumeHebdo: v } })} />
        </div>
      </Section>

      {isDev && (
        <Section id="confidentialite" title="Confidentialité">
          <div className="divide-y divide-line">
            <Switch label="Profil public" hint="Votre page /u/… est visible par tous. Désactivé, seuls les membres connectés la voient." checked={s.privacy.profilPublic} onChange={(v) => save({ privacy: { ...s.privacy, profilPublic: v } })} />
            <Switch label="Afficher ma ville" hint="Sinon, seul le pays est affiché." checked={s.privacy.afficherVille} onChange={(v) => save({ privacy: { ...s.privacy, afficherVille: v } })} />
            <Switch label="Visible par les recruteurs" hint="Apparaître dans la recherche de talents et pouvoir être contacté." checked={s.privacy.visibleRecruteurs} onChange={(v) => save({ privacy: { ...s.privacy, visibleRecruteurs: v } })} />
          </div>
        </Section>
      )}

      <Section id="langue" title="Langue">
        <div role="radiogroup" aria-label="Langue" className="flex flex-wrap gap-3">
          <button role="radio" aria-checked={s.language === 'fr'} className="btn btn-secondary border-2 border-primary bg-primary-soft">
            Français
          </button>
          <button role="radio" aria-checked={false} disabled className="btn btn-secondary" title="Bientôt disponible">
            English (bientôt)
          </button>
        </div>
      </Section>

      <Section id="securite" title="Mot de passe">
        <PasswordForm />
      </Section>

      {user.role !== 'admin' && (
        <Section id="suppression" title="Supprimer le compte" description="Votre profil, vos questions, vos réponses, vos projets, vos messages et vos points sont effacés définitivement. Les réponses des autres membres à vos questions disparaissent avec elles." danger>
          <DeleteAccount
            onDeleted={async () => {
              await logout();
              toast('Votre compte a été supprimé.');
              router.push('/');
            }}
          />
        </Section>
      )}
    </div>
  );
}

function PasswordForm() {
  const toast = useToast();
  const { user, setUser } = useSession();
  // Compte créé avec GitHub : pas de mot de passe actuel à fournir pour en définir un.
  const first = user?.hasPassword === false;
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <form
      noValidate
      className="grid gap-4 sm:max-w-md"
      onSubmit={async (e) => {
        e.preventDefault();
        if (f.next !== f.confirm) return setErrors({ confirm: 'Les deux mots de passe ne sont pas identiques.' });
        setBusy(true);
        setErrors({});
        try {
          await api.settings.changePassword(first ? undefined : f.current, f.next);
          setF({ current: '', next: '', confirm: '' });
          if (first && user) setUser({ ...user, hasPassword: true });
          toast(first ? 'Mot de passe défini. Vous pouvez aussi vous connecter avec votre e-mail.' : 'Mot de passe modifié.');
        } catch (err) {
          if (err instanceof ApiError && err.fields) setErrors(err.fields);
          else toast(messageFor(err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      {first ? (
        <p className="rounded-lg bg-sunken p-3 text-sm">Votre compte a été créé avec GitHub et n&apos;a pas encore de mot de passe. Vous pouvez en définir un pour vous connecter aussi avec votre adresse e-mail.</p>
      ) : (
        <TextField label="Mot de passe actuel" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} error={errors.current} />
      )}
      <TextField label="Nouveau mot de passe" type="password" autoComplete="new-password" hint="Au moins 8 caractères." value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} error={errors.next} />
      <TextField label="Confirmer le nouveau mot de passe" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} error={errors.confirm} />
      <button className="btn w-fit" disabled={busy || (!first && !f.current) || !f.next || !f.confirm}>
        {busy ? 'Enregistrement…' : first ? 'Définir un mot de passe' : 'Changer le mot de passe'}
      </button>
    </form>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const { user } = useSession();
  // Compte sans mot de passe : on confirme en retapant son nom d'utilisateur.
  const noPassword = user?.hasPassword === false;
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className="btn btn-danger" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden />
        Supprimer mon compte
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Supprimer votre compte Gamelia ?"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Garder mon compte
            </button>
            <button
              className="btn btn-danger"
              disabled={busy || !pw}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api.settings.deleteAccount(noPassword ? { confirm: pw } : { password: pw });
                  setOpen(false);
                  onDeleted();
                } catch (e) {
                  setError(e instanceof ApiError && e.fields?.password ? e.fields.password : messageFor(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          </>
        }
      >
        <p className="mb-4">{noPassword ? `Cette action est définitive. Tapez votre nom d'utilisateur (${user?.username}) pour confirmer.` : 'Cette action est définitive. Saisissez votre mot de passe pour confirmer.'}</p>
        {noPassword ? (
          <TextField label="Nom d'utilisateur" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={pw} onChange={(e) => setPw(e.target.value)} error={error} />
        ) : (
          <TextField label="Mot de passe" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} error={error} />
        )}
      </Dialog>
    </>
  );
}
