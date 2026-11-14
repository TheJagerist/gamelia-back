'use client';
// Agnès, l'assistante IA de Gamelia : identité visuelle, rendu de ses réponses et panneau sur chaque question.
// Ses réponses sont affichées comme du texte : un Markdown très simple (paragraphes, listes, titres,
// `code`, **gras**, _note_, blocs ```code```) est converti en éléments React, jamais en HTML brut.
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { MessageCircleQuestion, RotateCcw, Sparkles } from 'lucide-react';
import { api, messageFor } from '@/lib/api';
import { dateLong } from '@/lib/format';
import { useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { AgnesAnswer } from '@/lib/types';
import { Code } from './code';
import { useToast } from './toast';
import { Skeleton, cx } from './ui';

/* ---------- Identité ---------- */

export function AgnesMark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sz = { sm: 'h-7 w-7', md: 'h-10 w-10', lg: 'h-14 w-14' }[size];
  const icon = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-7 w-7' }[size];
  return (
    <span
      className={cx('relative inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-[0_6px_18px_-8px_rgba(91,55,101,.8)]', sz, className)}
      style={{ background: 'conic-gradient(from 210deg, #5b3765, #9e6899, #d6a8c4, #9e6899, #5b3765)' }}
      aria-hidden
    >
      <span className="absolute inset-[2px] rounded-full bg-gradient-to-br from-[#5b3765] to-[#9e6899]" />
      <Sparkles className={cx('relative', icon)} />
    </span>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-ink">
      <Sparkles className="h-3 w-3" aria-hidden />
      IA
    </span>
  );
}

/** Points de suspension animés pendant qu'Agnès rédige. */
export function Thinking({ label = 'Agnès rédige sa réponse' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <span className="inline-flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="agnes-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </span>
      {label}…
    </span>
  );
}

/* ---------- Rendu du texte d'Agnès ---------- */

type Block = { kind: 'code'; lang: string; content: string } | { kind: 'text'; content: string };

function splitBlocks(text: string): Block[] {
  const out: Block[] = [];
  const re = /```([\w+#.-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: 'text', content: text.slice(last, m.index) });
    out.push({ kind: 'code', lang: (m[1] || 'code').toLowerCase(), content: m[2].replace(/\n$/, '') });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ kind: 'text', content: text.slice(last) });
  return out;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
          return (
            <code key={i} className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
              {p.slice(1, -1)}
            </code>
          );
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function TextBlock({ text }: { text: string }) {
  const paragraphs = text.trim().split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, i) => {
        const lines = para.split('\n').filter((l) => l.trim());
        if (!lines.length) return null;
        const bullet = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const ordered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (bullet || ordered) {
          const Tag = ordered ? 'ol' : 'ul';
          return (
            <Tag key={i} className={cx('space-y-1.5 pl-5', ordered ? 'list-decimal' : 'list-disc marker:text-primary')}>
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')} />
                </li>
              ))}
            </Tag>
          );
        }
        // Paragraphe entier en italique (_…_) : note discrète.
        if (/^_[^_]+_$/.test(para.trim()))
          return (
            <p key={i} className="text-sm italic text-muted">
              {para.trim().slice(1, -1)}
            </p>
          );
        const heading = lines.length === 1 && /^#{1,4}\s+/.test(lines[0]);
        if (heading)
          return (
            <p key={i} className="pt-1 font-bold text-ink">
              <Inline text={lines[0].replace(/^#{1,4}\s+/, '')} />
            </p>
          );
        return (
          <p key={i} className="whitespace-pre-line">
            <Inline text={lines.join('\n')} />
          </p>
        );
      })}
    </>
  );
}

export function AgnesText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx('space-y-3 break-words leading-relaxed', className)}>
      {splitBlocks(text).map((b, i) => (b.kind === 'code' ? <Code key={i} code={b.content} lang={b.lang} /> : <TextBlock key={i} text={b.content} />))}
    </div>
  );
}

/* ---------- Panneau « La piste d'Agnès » sur une question ---------- */

export function AgnesQuestionPanel({ questionId }: { questionId: string }) {
  const { user } = useSession();
  const toast = useToast();
  const res = useResource(() => api.agnes.forQuestion(questionId), [questionId]);
  const [answer, setAnswer] = useState<AgnesAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const shown = answer ?? res.data?.answer ?? null;
  const available = res.data?.available ?? false;

  const ask = async () => {
    setBusy(true);
    setError('');
    try {
      setAnswer(await api.agnes.askQuestion(questionId));
    } catch (e) {
      const msg = messageFor(e);
      setError(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Le panneau ne doit jamais empêcher de lire la question : en cas d'erreur de chargement, il reste discret.
  if (res.loading && !res.data) {
    return (
      <div className="panel mt-8 flex items-center gap-3 p-5" aria-busy="true">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    );
  }
  if (res.error && !shown) return null;

  return (
    <section aria-labelledby="agnes-titre" className="agnes-panel relative mt-8 overflow-hidden rounded-xl border border-accent/70 p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/25 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-start gap-3">
        <AgnesMark />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="agnes-titre" className="text-lg">
              La piste d&apos;Agnès
            </h2>
            <AiBadge />
          </div>
          <p className="mt-0.5 text-sm text-muted">L&apos;assistante IA de Gamelia propose une première piste. Vérifiez-la : elle ne remplace pas les réponses de la communauté et ne rapporte pas de points.</p>
        </div>
      </div>

      <div className="relative mt-4">
        {shown ? (
          <>
            <AgnesText text={shown.body} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-accent/40 pt-3">
              <p className="text-[13px] text-muted">Proposée le {dateLong(shown.createdAt)}. Une erreur ? Signalez-la en commentaire d&apos;une réponse.</p>
              {user && (
                <Link href={`/agnes?question=${encodeURIComponent(questionId)}`} className="btn btn-secondary btn-sm">
                  <MessageCircleQuestion className="h-4 w-4" aria-hidden />
                  Approfondir avec Agnès
                </Link>
              )}
            </div>
          </>
        ) : busy ? (
          <div className="rounded-lg bg-surface/70 p-4">
            <Thinking />
            <div className="mt-3 space-y-2" aria-hidden>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        ) : !available ? (
          <p className="rounded-lg bg-surface/70 p-4 text-sm text-muted">Agnès n&apos;est pas disponible pour le moment. Les réponses de la communauté restent ouvertes ci-dessous.</p>
        ) : user ? (
          <div className="flex flex-col items-start gap-3 rounded-lg bg-surface/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">{error || 'Pas encore de piste. Demandez à Agnès : sa réponse restera visible pour tout le monde.'}</p>
            <button onClick={ask} className="btn shrink-0">
              {error ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              {error ? 'Réessayer' : 'Demander à Agnès'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-lg bg-surface/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">Connectez-vous pour demander à Agnès une première piste sur cette question.</p>
            <Link href={`/connexion?suite=/questions/${questionId}`} className="btn btn-secondary shrink-0">
              Se connecter
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
