'use client';
import Link from 'next/link';
import { BookOpen, Check, FolderGit2, MessageSquare, PlayCircle, Users } from 'lucide-react';
import { plural, timeAgo } from '@/lib/format';
import type { Challenge, FeedItem, ProjectSummary, QuestionSummary, RecruiterChallenge } from '@/lib/types';
import { daysLeft } from '@/lib/format';
import { LevelPill, PointsChip, StatusPill, Tag, UserLine, cx } from './ui';

export function QuestionRow({ q }: { q: QuestionSummary }) {
  return (
    <li className="flex gap-4 px-4 py-4 sm:px-5">
      <div className="hidden w-[92px] shrink-0 flex-col items-end whitespace-nowrap gap-1.5 pt-0.5 text-[13px] text-muted sm:flex">
        <span className="tabular-nums">{plural(q.votes, 'vote', 'votes')}</span>
        <span
          className={cx(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold tabular-nums',
            q.hasBestAnswer ? 'bg-primary text-primary-ink' : q.answerCount ? 'border border-primary text-primary' : 'text-muted',
          )}
        >
          {q.hasBestAnswer && <Check className="h-3.5 w-3.5" aria-hidden />}
          {plural(q.answerCount, 'réponse', 'réponses')}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[1.05rem] font-semibold leading-snug">
          <Link href={`/questions/${q.id}`} className="hover:text-primary hover:underline">
            {q.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-[15px] text-muted">{q.excerpt}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-wrap gap-1.5">
            {q.tags.map((t) => (
              <Tag key={t} name={t} href={`/questions?tag=${encodeURIComponent(t)}`} />
            ))}
          </div>
          <span className="text-[13px] text-muted sm:hidden">
            {plural(q.answerCount, 'réponse', 'réponses')}
            {q.hasBestAnswer && ', résolue'}
          </span>
          <span className="ml-auto">
            <UserLine user={q.author} extra={<span className="text-muted">{timeAgo(q.createdAt)}</span>} />
          </span>
        </div>
      </div>
    </li>
  );
}

export function ProjectCard({ p }: { p: ProjectSummary }) {
  return (
    <article className="panel relative flex flex-col p-5 transition-colors hover:border-primary/50">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {p.hasVideo && (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
            <PlayCircle className="h-4 w-4" aria-hidden />
            Démo vidéo
          </span>
        )}
        {p.seekingCollaborators && <StatusPill tone="accent">Cherche des collaborateurs</StatusPill>}
      </div>
      <h3 className="text-lg font-semibold leading-snug">
        <Link href={`/projets/${p.id}`} className="after:absolute after:inset-0 hover:underline">
          {p.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[15px] text-muted">{p.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.techs.map((t) => (
          <Tag key={t} name={t} />
        ))}
      </div>
      <div className="relative z-10 mt-auto flex items-center justify-between gap-3 pt-4">
        <UserLine user={p.owner} />
        {p.validatedReviews > 0 && <span className="shrink-0 text-[13px] font-semibold text-primary">{plural(p.validatedReviews, 'revue validée', 'revues validées')}</span>}
      </div>
    </article>
  );
}

const STATUS: Record<Challenge['status'], { label: string; tone: 'neutral' | 'primary' | 'accent' | 'success' | 'danger' } | null> = {
  a_faire: null,
  reussi: { label: 'Réussi', tone: 'success' },
  echoue: { label: 'À retenter', tone: 'danger' },
  en_attente: { label: 'En attente de validation', tone: 'accent' },
  refuse: { label: 'À revoir', tone: 'danger' },
};

export function ChallengeCard({ c }: { c: Challenge }) {
  const s = STATUS[c.status];
  return (
    <article className={cx('panel relative flex flex-col p-5 transition-colors hover:border-primary/50', c.weekly && 'border-accent bg-accent-soft/40')}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-muted">{c.weekly ? 'Défi de la semaine' : c.kind === 'quiz' ? 'Quiz corrigé automatiquement' : 'Défi pratique, validé par l’équipe'}</span>
        {s && <StatusPill tone={s.tone}>{s.label}</StatusPill>}
      </div>
      <h3 className="text-lg font-semibold leading-snug">
        <Link href={`/defis/${c.id}`} className="after:absolute after:inset-0 hover:underline">
          {c.title}
        </Link>
      </h3>
      <p className="mt-1.5 text-[15px] text-muted">{c.summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
        <PointsChip points={c.points} />
        <LevelPill level={c.level} />
        <span className="ml-auto text-[13px] text-muted">{plural(c.participants, 'participant', 'participants')}</span>
      </div>
    </article>
  );
}

export function OpportunityCard({ c, href }: { c: RecruiterChallenge; href: string }) {
  return (
    <article className="panel relative flex flex-col p-5 transition-colors hover:border-primary/50">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-muted">
          {c.company}, {c.country}
          {c.remote ? ', à distance' : ''}
        </span>
        {c.myApplication && <StatusPill tone={c.myApplication.status === 'retenue' ? 'success' : 'primary'}>{c.myApplication.status === 'retenue' ? 'Retenu' : 'Candidature envoyée'}</StatusPill>}
      </div>
      <h3 className="text-lg font-semibold leading-snug">
        <Link href={href} className="after:absolute after:inset-0 hover:underline">
          {c.title}
        </Link>
      </h3>
      <p className="mt-1.5 text-[15px] text-muted">{c.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.skills.map((s) => (
          <Tag key={s} name={s} />
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-[13px]">
        <span className="font-semibold text-accent-ink">{c.reward}</span>
        <span className="text-muted">{daysLeft(c.deadline)}</span>
      </div>
    </article>
  );
}

const FEED_META = {
  question: { label: 'Question', icon: MessageSquare, tone: 'text-primary' },
  projet: { label: 'Projet', icon: FolderGit2, tone: 'text-accent-ink' },
  lecon: { label: 'Leçon', icon: BookOpen, tone: 'text-success' },
};

export function FeedRow({ f }: { f: FeedItem }) {
  const m = FEED_META[f.type];
  const Icon = m.icon;
  return (
    <li className="flex gap-3 px-4 py-4 sm:px-5">
      <span className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken', m.tone)}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-muted">
          {m.label}
          {f.type === 'lecon' && `, piste « ${f.item.trackTitle} »`}
          <span className="font-normal">, {timeAgo(f.date)}</span>
        </p>
        {f.type === 'question' && (
          <>
            <h3 className="mt-0.5 font-semibold leading-snug">
              <Link href={`/questions/${f.item.id}`} className="hover:text-primary hover:underline">
                {f.item.title}
              </Link>
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {f.item.tags.map((t) => (
                <Tag key={t} name={t} />
              ))}
              <span className="text-[13px] text-muted">
                {plural(f.item.answerCount, 'réponse', 'réponses')}, par {f.item.author.name}
              </span>
            </div>
          </>
        )}
        {f.type === 'projet' && (
          <>
            <h3 className="mt-0.5 font-semibold leading-snug">
              <Link href={`/projets/${f.item.id}`} className="hover:text-primary hover:underline">
                {f.item.title}
              </Link>
            </h3>
            <p className="mt-0.5 line-clamp-2 text-[15px] text-muted">{f.item.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {f.item.techs.map((t) => (
                <Tag key={t} name={t} />
              ))}
              {f.item.seekingCollaborators && (
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-ink">
                  <Users className="h-4 w-4" aria-hidden />
                  Cherche des collaborateurs
                </span>
              )}
            </div>
          </>
        )}
        {f.type === 'lecon' && (
          <h3 className="mt-0.5 font-semibold leading-snug">
            <Link href={`/apprendre/${f.item.trackId}/${f.item.id}`} className="hover:text-primary hover:underline">
              {f.item.title}
            </Link>
            <span className="ml-2 text-[13px] font-normal text-muted">{f.item.minutes} min de lecture</span>
          </h3>
        )}
      </div>
    </li>
  );
}
