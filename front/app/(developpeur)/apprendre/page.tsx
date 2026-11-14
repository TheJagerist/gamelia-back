'use client';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { LearnNav } from '@/components/learn-nav';
import { Async, LevelPill, PageHeader, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { useResource } from '@/lib/hooks';

export default function ApprendrePage() {
  const res = useResource(() => api.learn.tracks(), []);
  return (
    <>
      <PageHeader title="Apprendre" description="Trois pistes courtes. Chaque leçon se lit en moins de dix minutes et se termine par un quiz corrigé tout de suite." />
      <LearnNav />
      <Async res={res} isEmpty={(d) => d.length === 0}>
        {(tracks) => (
          <div className="grid gap-4 md:grid-cols-3">
            {tracks.map((t) => {
              const pct = Math.round(t.progress * 100);
              const next = t.lessons.find((l) => !l.done);
              return (
                <article key={t.id} className="panel relative flex flex-col p-5">
                  <LevelPill level={t.level} />
                  <h2 className="mt-3 text-xl">
                    <Link href={`/apprendre/${t.id}`} className="after:absolute after:inset-0 hover:underline">
                      {t.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-[15px] text-muted">{t.description}</p>
                  <ol className="mt-4 space-y-1.5 text-sm">
                    {t.lessons.map((l) => (
                      <li key={l.id} className="flex items-center gap-2">
                        <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', l.done ? 'border-success bg-success text-white' : 'border-line')}>{l.done && <Check className="h-3 w-3" aria-hidden />}</span>
                        <span className={cx(l.done && 'text-muted')}>{l.title}</span>
                        <span className="sr-only">{l.done ? '(terminée)' : ''}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-auto pt-5">
                    <div className="mb-1.5 flex justify-between text-[13px] font-semibold">
                      <span>{pct === 100 ? 'Piste terminée' : next ? `Suite : ${next.title}` : ''}</span>
                      <span className="tabular-nums text-muted">{pct} %</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progression de la piste ${t.title}`}>
                      <div className={cx('h-full rounded-full', pct === 100 ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Async>
    </>
  );
}
