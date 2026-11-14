'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BadgeCheck, ChevronDown, ChevronUp, Code2 } from 'lucide-react';
import { AgnesQuestionPanel } from '@/components/agnes';
import { Code } from '@/components/code';
import { CommentList, PlainText, ReportButton } from '@/components/social';
import { useToast } from '@/components/toast';
import { Async, PageHeader, SelectField, Skeleton, Tag, TextArea, UserLine, cx } from '@/components/ui';
import { api, messageFor } from '@/lib/api';
import { CODE_LANGS } from '@/lib/constants';
import { plural, timeAgo } from '@/lib/format';
import { useDraft, useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { Answer, Question } from '@/lib/types';

function Votes({ value, mine, onVote, disabled, label, row = false }: { value: number; mine?: 1 | -1 | 0; onVote: (d: 1 | -1) => void; disabled: boolean; label: string; row?: boolean }) {
  return (
    <div className={cx('items-center gap-0.5', row ? 'flex gap-2 sm:hidden' : 'hidden flex-col sm:flex')} role="group" aria-label={`Votes pour ${label}`}>
      <button
        onClick={() => onVote(1)}
        disabled={disabled}
        aria-pressed={mine === 1}
        aria-label="Utile"
        className={cx('inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:opacity-40', mine === 1 ? 'border-primary bg-primary text-primary-ink' : 'border-line hover:border-primary hover:text-primary')}
      >
        <ChevronUp className="h-5 w-5" aria-hidden />
      </button>
      <span className="py-0.5 text-lg font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        onClick={() => onVote(-1)}
        disabled={disabled}
        aria-pressed={mine === -1}
        aria-label="Pas utile"
        className={cx('inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:opacity-40', mine === -1 ? 'border-danger bg-danger-soft text-danger' : 'border-line hover:border-danger hover:text-danger')}
      >
        <ChevronDown className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-4/5" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export default function QuestionPage({ params }: { params: { id: string } }) {
  const res = useResource(() => api.questions.get(params.id), [params.id]);
  return (
    <Async res={res} skeleton={<DetailSkeleton />}>
      {(q) => <QuestionView q={q} reload={res.reload} mutate={res.mutate} />}
    </Async>
  );
}

function QuestionView({ q, reload, mutate }: { q: Question; reload: () => void; mutate: (fn: (q: Question) => Question) => void }) {
  const { user } = useSession();
  const toast = useToast();
  const isDev = user?.role === 'developpeur';
  const isAuthor = user?.id === q.author.id;

  const vote = async (targetId: string, dir: 1 | -1) => {
    if (!isDev) return toast('Connectez-vous avec un compte développeur pour voter.', 'info');
    try {
      const r = await api.questions.vote(q.id, targetId, dir);
      mutate((x) =>
        targetId === x.id ? { ...x, votes: r.votes, myVote: r.myVote } : { ...x, answers: x.answers.map((a) => (a.id === targetId ? { ...a, votes: r.votes, myVote: r.myVote } : a)) },
      );
    } catch (e) {
      toast(messageFor(e), 'error');
    }
  };

  const markBest = async (a: Answer) => {
    try {
      await api.questions.markBest(q.id, a.id);
      toast(`Réponse de ${a.author.name} choisie comme meilleure réponse. ${a.author.id !== user?.id ? 'Elle gagne 25 points.' : ''}`);
      reload();
    } catch (e) {
      toast(messageFor(e), 'error');
    }
  };

  return (
    <>
      <PageHeader back={{ href: '/questions', label: 'Questions' }} title={q.title} />

      <article className="flex gap-6" aria-label="Question">
        <Votes value={q.votes} mine={q.myVote} onVote={(d) => vote(q.id, d)} disabled={isAuthor} label="la question" />
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <UserLine user={q.author} extra={<span>a demandé {timeAgo(q.createdAt)}</span>} />
          </div>
          <PlainText text={q.body} className="text-[1.05rem] leading-relaxed" />
          {q.code && <Code code={q.code.content} lang={q.code.lang} />}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Votes row value={q.votes} mine={q.myVote} onVote={(d) => vote(q.id, d)} disabled={isAuthor} label="la question" />
            <div className="flex flex-wrap gap-1.5">
              {q.tags.map((t) => (
                <Tag key={t} name={t} href={`/questions?tag=${encodeURIComponent(t)}`} />
              ))}
            </div>
            <ReportButton targetType="question" targetId={q.id} />
          </div>
        </div>
      </article>

      <AgnesQuestionPanel questionId={q.id} />

      <section className="mt-10" aria-labelledby="reponses">
        <h2 id="reponses" className="mb-1 text-xl">
          {q.answers.length ? plural(q.answers.length, 'réponse', 'réponses') : 'Pas encore de réponse'}
        </h2>
        {isAuthor && q.answers.length > 0 && !q.bestAnswerId && <p className="mb-4 text-sm text-muted">Une réponse vous a aidé ? Choisissez-la comme meilleure réponse : son auteur gagne 25 points.</p>}
        <ol className="mt-4 space-y-4">
          {q.answers.map((a) => {
            const best = a.id === q.bestAnswerId;
            return (
              <li key={a.id} className={cx('panel flex gap-4 p-4 sm:gap-6 sm:p-5', best && 'border-2 border-primary')}>
                <Votes value={a.votes} mine={a.myVote} onVote={(d) => vote(a.id, d)} disabled={a.author.id === user?.id} label={`la réponse de ${a.author.name}`} />
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <UserLine user={a.author} extra={<span>{timeAgo(a.createdAt)}</span>} />
                    {best && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-ink">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                        Meilleure réponse
                      </span>
                    )}
                  </div>
                  <PlainText text={a.body} className="leading-relaxed" />
                  {a.code && <Code code={a.code.content} lang={a.code.lang} />}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Votes row value={a.votes} mine={a.myVote} onVote={(d) => vote(a.id, d)} disabled={a.author.id === user?.id} label={`la réponse de ${a.author.name}`} />
                    {isAuthor && !best && (
                      <button onClick={() => markBest(a)} className="btn btn-secondary btn-sm">
                        <BadgeCheck className="h-4 w-4" aria-hidden />
                        Choisir comme meilleure réponse
                      </button>
                    )}
                    <ReportButton targetType="reponse" targetId={a.id} />
                  </div>
                  <CommentList
                    compact
                    comments={a.comments}
                    canComment={isDev}
                    onSend={async (body) => {
                      await api.questions.comment(q.id, a.id, body);
                      reload();
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="repondre">
        <h2 id="repondre" className="mb-4 text-xl">
          Votre réponse
        </h2>
        {isDev ? (
          <AnswerForm qid={q.id} onDone={reload} />
        ) : user ? (
          <p className="rounded-lg bg-sunken p-4 text-sm text-muted">Seuls les comptes développeur peuvent répondre aux questions.</p>
        ) : (
          <div className="panel flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p>Vous connaissez la réponse ? Rejoignez Gamelia pour aider et gagner des points.</p>
            <div className="flex gap-2">
              <Link href={`/connexion?suite=/questions/${q.id}`} className="btn btn-secondary">
                Se connecter
              </Link>
              <Link href="/inscription" className="btn">
                Rejoindre
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function AnswerForm({ qid, onDone }: { qid: string; onDone: () => void }) {
  const toast = useToast();
  const draft = useDraft(`reponse-${qid}`, { body: '', lang: 'javascript', code: '' });
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const v = draft.value;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (v.body.trim().length < 10) return setError('Votre réponse doit faire au moins 10 caractères.');
    setBusy(true);
    setError('');
    try {
      const r = await api.questions.answer(qid, { body: v.body, code: v.code.trim() ? { lang: v.lang, content: v.code } : undefined });
      draft.clear();
      setShowCode(false);
      toast(r.points ? `Réponse publiée. +${r.points} points.` : 'Réponse publiée.');
      onDone();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel space-y-4 p-5" noValidate>
      {draft.restored && <p className="rounded bg-accent-soft px-3 py-2 text-sm">Brouillon retrouvé : vous pouvez reprendre où vous en étiez.</p>}
      <TextArea label="Réponse" hint="Expliquez la cause, puis la solution. Restez bienveillant." rows={6} value={v.body} onChange={(e) => draft.setValue({ ...v, body: e.target.value })} error={error} />
      {showCode || v.code ? (
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <SelectField label="Langage" value={v.lang} onChange={(e) => draft.setValue({ ...v, lang: e.target.value })}>
            {CODE_LANGS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </SelectField>
          <TextArea label="Code" optional rows={6} spellCheck={false} className="font-mono" value={v.code} onChange={(e) => draft.setValue({ ...v, code: e.target.value })} />
        </div>
      ) : (
        <button type="button" onClick={() => setShowCode(true)} className="btn btn-secondary btn-sm">
          <Code2 className="h-4 w-4" aria-hidden />
          Ajouter du code
        </button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted">{draft.savedAt ? 'Brouillon enregistré sur cet appareil.' : ''}</span>
        <button className="btn" disabled={busy}>
          {busy ? 'Publication…' : 'Publier ma réponse'}
        </button>
      </div>
    </form>
  );
}
