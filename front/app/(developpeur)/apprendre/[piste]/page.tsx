'use client';
import Link from 'next/link';
import { Check, Clock } from 'lucide-react';
import { Async, LevelPill, PageHeader, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { useResource } from '@/lib/hooks';

export default function TrackPage({ params }: { params: { piste: string } }) {
  const res = useResource(() => api.learn.track(params.piste), [params.piste]);
  return (
    <Async res={res}>
      {(t) => {
        const next = t.lessons.find((l) => !l.done) ?? t.lessons[0]!;
        const pct = Math.round(t.progress * 100);
        return (
          <>
            <PageHeader
              back={{ href: '/apprendre', label: 'Pistes' }}
              title={t.title}
              description={t.description}
              actions={
                <Link href={`/apprendre/${t.id}/${next.id}`} className="btn">
                  {pct === 0 ? 'Commencer la piste' : pct === 100 ? 'Revoir la piste' : 'Reprendre'}
                </Link>
              }
            />
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <LevelPill level={t.level} />
              <span className="text-sm text-muted">
                {t.lessons.filter((l) => l.done).length} leçon(s) terminée(s) sur {t.lessons.length}
              </span>
            </div>
            <ol className="panel divide-y divide-line">
              {t.lessons.map((l, i) => (
                <li key={l.id}>
                  <Link href={`/apprendre/${t.id}/${l.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-sunken sm:px-5">
                    <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-bold tabular-nums', l.done ? 'border-success bg-success text-white' : 'border-primary text-primary')}>
                      {l.done ? <Check className="h-5 w-5" aria-label="Terminée" /> : i + 1}
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{l.title}</span>
                      <span className="inline-flex items-center gap-1 text-[13px] text-muted">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {l.minutes} min, puis un quiz de 3 questions
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-muted">Chaque quiz réussi rapporte 15 points. Terminer la piste rapporte 60 points de plus et le badge « Piste terminée ».</p>
          </>
        );
      }}
    </Async>
  );
}
