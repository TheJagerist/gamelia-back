'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Award, BadgeCheck, BarChart3, Bell, Camera, Copy, Github, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/toast';
import { Avatar, ExternalLink, LevelPill, PageHeader, PointsChip, ProofMark, SelectField, TagPicker, TextArea, TextField } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { COUNTRIES, TAGS } from '@/lib/constants';
import { githubErrorMessage, githubStartUrl } from '@/lib/github-oauth';
import { useSession } from '@/lib/session';
import type { DeclaredLink, User } from '@/lib/types';

/** Réduit la photo à 256 px côté navigateur avant l'envoi : page légère, envoi rapide en 3G. */
async function compressPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const s = Math.min(bmp.width, bmp.height);
  c.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.8);
}

export default function ProfilPage() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [welcome, setWelcome] = useState(false);
  const [form, setForm] = useState(() => ({
    name: user!.name,
    bio: user!.bio,
    country: user!.country,
    city: user!.city || '',
    skills: user!.skills,
    following: user!.following || [],
    links: user!.links,
    avatarUrl: user!.avatarUrl,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setWelcome(q.get('bienvenue') === '1');
    // Retour de GitHub après « Lier mon compte GitHub » : ?github=ok ou ?github=<code d'erreur>.
    const gh = q.get('github');
    if (gh === 'ok') {
      void api.auth.me().then((u) => {
        if (u) setUser(u);
      });
      toast('Compte GitHub relié. Votre profil porte maintenant le badge « compte vérifié ».');
    } else if (gh) toast(githubErrorMessage(gh) || 'La liaison avec GitHub a échoué.', 'error');
    if (gh) window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/u/${user.username}` : `/u/${user.username}`;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const links = form.links.filter((l) => l.url.trim());
      const bad = links.findIndex((l) => !/^https:\/\/\S+\.\S+/.test(l.url));
      if (bad >= 0) throw new ApiError(400, 'Un lien doit commencer par https://', 'validation', { [`link${bad}`]: 'Lien invalide : il doit commencer par https://' });
      // avatarUrl : null demande explicitement au serveur de retirer la photo (un champ absent ne change rien).
      const u = await api.auth.updateProfile({ ...form, links, avatarUrl: form.avatarUrl ?? null });
      setUser(u);
      toast('Profil enregistré.');
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast(messageFor(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setLink = (i: number, patch: Partial<DeclaredLink>) => setForm({ ...form, links: form.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <>
      <PageHeader
        title="Mon profil"
        description="Ce que vous écrivez ici est affiché comme « déclaré ». Les défis réussis et les projets relus s'ajoutent tout seuls, avec le sceau « vérifié »."
        actions={
          <Link href={`/u/${user.username}`} className="btn btn-secondary">
            Voir mon profil public
          </Link>
        }
      />

      {welcome && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary-soft p-5" role="status">
          <p className="font-semibold">Bienvenue, {user.name.split(' ')[0]} !</p>
          <p className="mt-1 text-sm">Ajoutez une photo, vos compétences et vos liens. Ensuite, posez une première question ou relevez un défi pour gagner vos premiers points.</p>
        </div>
      )}

      {/* Mon espace : accès en un clic depuis le téléphone */}
      <nav aria-label="Mon espace" className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: '/progression', label: 'Points et badges', icon: Award, extra: <PointsChip points={user.points} /> },
          { href: '/portfolio', label: 'Portfolio', icon: BadgeCheck },
          { href: '/classement', label: 'Classement', icon: BarChart3 },
          { href: '/notifications', label: 'Notifications', icon: Bell },
        ].map((it) => (
          <Link key={it.href} href={it.href} className="panel flex flex-col gap-2 p-4 hover:border-primary">
            <it.icon className="h-5 w-5 text-primary" aria-hidden />
            <span className="font-semibold">{it.label}</span>
            {it.extra}
          </Link>
        ))}
      </nav>

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_320px]" noValidate>
        <div className="space-y-6">
          <section className="panel space-y-5 p-5 sm:p-6" aria-labelledby="ident">
            <h2 id="ident" className="text-lg">
              Identité
            </h2>
            <div className="flex items-center gap-4">
              <Avatar user={{ ...user, avatarUrl: form.avatarUrl, name: form.name || user.name }} size="xl" />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  <Camera className="h-4 w-4" aria-hidden />
                  {form.avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
                </button>
                {form.avatarUrl && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, avatarUrl: undefined })}>
                    Retirer
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Choisir une photo de profil"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 8 * 1024 * 1024) return toast('Photo trop lourde : 8 Mo au maximum.', 'error');
                    try {
                      setForm({ ...form, avatarUrl: await compressPhoto(file) });
                    } catch {
                      toast('Impossible de lire cette image. Essayez un fichier JPEG ou PNG.', 'error');
                    }
                  }}
                />
                <p className="w-full text-[13px] text-muted">Réduite à 256 px avant l&apos;envoi.</p>
              </div>
            </div>
            <TextField label="Nom complet" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} autoComplete="name" />
            <TextArea label="Bio" hint="Ce que vous faites, ce que vous cherchez." counter={280} rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} error={errors.bio} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Pays" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </SelectField>
              <TextField label="Ville" optional value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" />
            </div>
          </section>

          <section className="panel space-y-5 p-5 sm:p-6" aria-labelledby="comp">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="comp" className="text-lg">
                Compétences
              </h2>
              <ProofMark verified={false} />
            </div>
            <TagPicker label="Ce que vous savez faire" options={TAGS} value={form.skills} onChange={(skills) => setForm({ ...form, skills })} max={8} hint="Jusqu'à 8. Les recruteurs filtrent les profils avec ces compétences." />
            <TagPicker label="Technologies suivies" options={TAGS} value={form.following} onChange={(following) => setForm({ ...form, following })} max={6} hint="Votre fil d'actualité peut n'afficher que ces technologies." />
          </section>

          <section className="panel space-y-4 p-5 sm:p-6" aria-labelledby="liens">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="liens" className="text-lg">
                Projets, sites et liens
              </h2>
              <ProofMark verified={false} />
            </div>
            <p className="text-sm text-muted">Ces liens sont affichés comme déclarés. Pour qu&apos;un projet soit vérifié, publiez-le sur Gamelia et faites-le relire par des pairs.</p>
            {form.links.length === 0 && <p className="rounded border border-dashed border-line p-4 text-sm text-muted">Aucun lien pour l&apos;instant. Ajoutez votre GitHub, votre site ou un projet en ligne.</p>}
            <ul className="space-y-4">
              {form.links.map((l, i) => (
                <li key={i} className="grid gap-3 rounded-lg bg-sunken p-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
                  <SelectField label="Type" value={l.kind} onChange={(e) => setLink(i, { kind: e.target.value as DeclaredLink['kind'] })}>
                    <option value="github">GitHub</option>
                    <option value="site">Site</option>
                    <option value="projet">Projet</option>
                  </SelectField>
                  <TextField label="Lien" type="url" inputMode="url" placeholder="https://" value={l.url} onChange={(e) => setLink(i, { url: e.target.value, label: e.target.value.replace(/^https?:\/\//, '').replace(/\/$/, '') })} error={errors[`link${i}`]} />
                  <button type="button" className="btn btn-ghost h-11 text-danger" onClick={() => setForm({ ...form, links: form.links.filter((_, j) => j !== i) })} aria-label={`Supprimer le lien ${i + 1}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {form.links.length < 6 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...form, links: [...form.links, { kind: 'site', label: '', url: '' }] })}>
                <Plus className="h-4 w-4" aria-hidden />
                Ajouter un lien
              </button>
            )}
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <button className="btn w-full sm:w-auto" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer le profil'}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="panel p-5" aria-labelledby="niveau">
            <h2 id="niveau" className="text-base">
              Mon niveau
            </h2>
            <div className="mt-3 flex items-center justify-between">
              <LevelPill level={user.level} />
              <PointsChip points={user.points} />
            </div>
            <Link href="/progression" className="link mt-3 inline-block text-sm">
              Voir l&apos;historique des points
            </Link>
          </section>

          <section className="panel p-5" aria-labelledby="gh">
            <h2 id="gh" className="text-base">
              Compte vérifié
            </h2>
            {user.githubVerified ? (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <BadgeCheck className="h-5 w-5 text-primary" aria-hidden />
                Compte GitHub confirmé. Vous pouvez retirer le code de votre bio GitHub.
              </p>
            ) : (
              <GithubVerification onVerified={setUser} />
            )}
          </section>

          <section className="panel p-5" aria-labelledby="partage">
            <h2 id="partage" className="text-base">
              Partager mon profil
            </h2>
            <p className="mt-2 break-all rounded bg-sunken px-3 py-2 text-[13px]">{publicUrl}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-3"
              onClick={() => navigator.clipboard?.writeText(publicUrl).then(() => toast('Lien copié.'), () => toast('Copie impossible, sélectionnez le lien.', 'error'))}
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copier le lien
            </button>
          </section>
        </aside>
      </form>
    </>
  );
}

/**
 * Vérification du compte GitHub, sans mot de passe : Gamelia donne un code, le membre le colle dans la bio
 * de son profil GitHub (lui seul peut la modifier), puis l'API relit cette bio publique et confirme.
 */
function GithubVerification({ onVerified }: { onVerified: (u: User) => void }) {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [pending, setPending] = useState<{ username: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [oauth, setOauth] = useState(false);
  useEffect(() => {
    void api.auth.githubEtat().then((r) => setOauth(r.enabled));
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError((err instanceof ApiError && err.fields?.username) || messageFor(err));
    } finally {
      setBusy(false);
    }
  };
  const askCode = () => void run(async () => setPending(await api.auth.githubCode(username)));

  // Pas de balise <form> ici : ce bloc est affiché à l'intérieur du formulaire du profil.
  if (!pending)
    return (
      <div className="mt-2 space-y-3">
        <p className="text-sm text-muted">Prouvez que votre compte GitHub est bien le vôtre pour obtenir le badge « compte vérifié ». Aucun mot de passe GitHub n&apos;est demandé.</p>
        {oauth && (
          <>
            <a className="btn btn-sm w-fit" href={githubStartUrl('lier')}>
              <Github className="h-4 w-4" aria-hidden />
              Lier mon compte GitHub
            </a>
            <p className="text-sm text-muted">Ou, sans quitter Gamelia, prouvez-le avec un code dans votre bio GitHub :</p>
          </>
        )}
        <TextField label="Nom d'utilisateur GitHub" placeholder="awa-diop" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault(); // Entrée ne doit pas enregistrer tout le profil
            if (username.trim() && !busy) askCode();
          }}
          error={error}
        />
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !username.trim()} onClick={askCode}>
          <Github className="h-4 w-4" aria-hidden />
          {busy ? 'Préparation…' : 'Obtenir mon code'}
        </button>
      </div>
    );

  return (
    <div className="mt-2 space-y-3 text-sm">
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Copiez ce code : <code className="select-all rounded bg-sunken px-1.5 py-0.5 font-mono font-semibold">{pending.code}</code>
        </li>
        <li>
          Collez-le dans la bio de votre profil GitHub ({pending.username}), puis enregistrez :{' '}
          <ExternalLink href="https://github.com/settings/profile" className="link">
            ouvrir mon profil GitHub
          </ExternalLink>
          .
        </li>
        <li>Revenez ici et lancez la vérification. Le code est valable 30 minutes.</li>
      </ol>
      {error && (
        <p role="alert" className="rounded bg-danger-soft p-3 font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              onVerified(await api.auth.githubVerify());
              toast('Compte GitHub confirmé. Votre profil porte maintenant le badge « compte vérifié ».');
            })
          }
        >
          {busy ? 'Vérification…' : 'Vérifier mon compte'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => {
            setPending(null);
            setError('');
          }}
        >
          Changer de compte
        </button>
      </div>
    </div>
  );
}
