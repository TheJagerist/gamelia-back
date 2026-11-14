'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Clock } from 'lucide-react';
import { PlainText } from '@/components/social';
import { Quiz } from '@/components/quiz';
import { useToast } from '@/components/toast';
import { Async, LevelPill, PageHeader, PointsChip, StatusPill, Tag, TextArea, TextField } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { plural } from '@/lib/format';
import { useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { Challenge } from '@/lib/types';

export default function DefiPage({ params }: { params: { id: string } }) {
  const res = useResource(() => api.challenges.get(params.id), [params.id]);
  return <Async res={res}>{(c) => <DefiView c={c} reload={res.reload} />}</Async>;
}

function DefiView({ c, reload }: { c: Challenge; reload: () => void }) {
  const { refresh } = useSession();
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <PageHeader back={{ href: '/defis', label: 'Défis' }} title={c.title} />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <PointsChip points={c.points} />
          <LevelPill level={c.level} />
          {c.tags.map((t) => (
            <Tag key={t} name={t} />
          ))}
        </div>
        <PlainText text={c.brief} className="max-w-prose text-[1.05rem] leading-relaxed" />

        <section className="mt-8 border-t border-line pt-8" aria-labelledby="participer">
          <h2 id="participer" className="mb-5 text-xl">
            {c.kind === 'quiz' ? 'Répondre au quiz' : 'Envoyer ma solution'}
          </h2>
          {c.kind === 'quiz' && c.quiz ? (
            c.status === 'reussi' ? (
              <p className="rounded-lg bg-success-soft p-4 font-semibold">Défi réussi. Il apparaît dans votre portfolio comme élément vérifié.</p>
            ) : (
              <Quiz questions={c.quiz} passLabel="Défi réussi ! Il est ajouté à votre portfolio." onSubmit={(a) => api.challenges.submitQuiz(c.id, a)} onPassed={() => refresh()} />
            )
          ) : (
            <PracticalForm c={c} onDone={reload} />
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:pt-14">
        <div className="panel p-5">
          <h2 className="text-base">Comment c&apos;est validé</h2>
          <p className="mt-2 text-sm text-muted">
            {c.kind === 'quiz'
              ? 'Correction automatique. Il faut au moins 75 % de bonnes réponses. Vous pouvez réessayer autant de fois que nécessaire.'
              : "Un membre de l'équipe Gamelia ouvre votre dépôt, vérifie qu'il répond à l'énoncé et valide sous 48 h. Vous êtes prévenu dans vos notifications."}
          </p>
          <p className="mt-3 text-sm text-muted">{plural(c.participants, 'personne a', 'personnes ont')} déjà tenté ce défi.</p>
        </div>
        <Link href="/progression" className="block rounded-lg bg-sunken p-5 text-sm hover:bg-primary-soft">
          <span className="font-semibold">Plafond quotidien</span>
          <span className="mt-1 block text-muted">Vous pouvez gagner jusqu&apos;à 200 points par jour, pour que le classement reste juste.</span>
        </Link>
      </aside>
    </div>
  );
}

function PracticalForm({ c, onDone }: { c: Challenge; onDone: () => void }) {
  const toast = useToast();
  const [codeUrl, setCodeUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (c.status === 'en_attente')
    return (
      <div className="flex gap-3 rounded-lg bg-accent-soft p-5" role="status">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
        <div>
          <StatusPill tone="accent">En attente de validation</StatusPill>
          <p className="mt-2">Votre solution a bien été reçue. L&apos;équipe la vérifie sous 48 h ; vous serez prévenu dans vos notifications.</p>
        </div>
      </div>
    );
  if (c.status === 'reussi') return <p className="rounded-lg bg-success-soft p-4 font-semibold">Solution validée. Le défi apparaît dans votre portfolio comme élément vérifié.</p>;

  return (
    <form
      noValidate
      className="panel space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api.challenges.submitPractical(c.id, codeUrl.trim(), note);
          toast('Solution envoyée. Statut : en attente de validation.');
          onDone();
        } catch (err) {
          setError(err instanceof ApiError && err.fields?.codeUrl ? err.fields.codeUrl : messageFor(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {c.status === 'refuse' && <p className="rounded bg-danger-soft p-3 text-sm">Votre précédente solution doit être revue. Corrigez-la puis envoyez à nouveau le lien.</p>}
      <TextField label="Lien vers le dépôt" type="url" inputMode="url" placeholder="https://github.com/vous/projet" hint="GitHub, GitLab ou Bitbucket. Le dépôt doit être public." value={codeUrl} onChange={(e) => setCodeUrl(e.target.value)} error={error} />
      <TextArea label="Note pour le correcteur" optional rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn" disabled={busy || !codeUrl}>
        {busy ? 'Envoi…' : 'Envoyer ma solution'}
      </button>
    </form>
  );
}
