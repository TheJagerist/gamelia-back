'use client';
import Link from 'next/link';
import { Lightbulb } from 'lucide-react';
import { Code } from '@/components/code';
import { Quiz } from '@/components/quiz';
import { TryEditor } from '@/components/try-editor';
import { Async, PageHeader, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';

export default function LessonPage({ params }: { params: { piste: string; lecon: string } }) {
  const res = useResource(() => api.learn.lesson(params.lecon), [params.lecon]);
  const { refresh } = useSession();
  return (
    <Async
      res={res}
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      {(l) => (
        <div className="mx-auto max-w-[44rem]">
          <PageHeader back={{ href: `/apprendre/${l.trackId}`, label: l.trackTitle }} title={l.title} description={`${l.minutes} minutes de lecture, puis un quiz.`} />
          <article className="space-y-4 text-[1.05rem] leading-relaxed">
            {l.blocks.map((b, i) =>
              b.type === 'p' ? (
                <p key={i}>{b.text}</p>
              ) : b.type === 'code' ? (
                <Code key={i} code={b.content} lang={b.lang} />
              ) : b.type === 'try' ? (
                <TryEditor key={i} title={b.title} html={b.html} css={b.css} js={b.js} hint={b.hint} />
              ) : (
                <aside key={i} className="flex gap-3 rounded-lg border-l-4 border-accent bg-accent-soft p-4 text-[15px]">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
                  <p>{b.text}</p>
                </aside>
              ),
            )}
          </article>

          <section className="mt-10 border-t border-line pt-8" aria-labelledby="quiz">
            <h2 id="quiz" className="mb-1 text-xl">
              Quiz
            </h2>
            <p className="mb-6 text-sm text-muted">{l.done ? 'Leçon déjà réussie. Vous pouvez refaire le quiz pour réviser.' : 'Deux bonnes réponses sur trois pour valider la leçon.'}</p>
            <Quiz key={l.id} questions={l.quiz} passLabel="Leçon validée !" onSubmit={(a) => api.learn.submitQuiz(l.id, a)} onPassed={() => refresh()} />
          </section>

          <nav className="mt-10 flex flex-wrap justify-between gap-3 border-t border-line pt-6" aria-label="Leçons">
            {l.prev ? (
              <Link href={`/apprendre/${l.trackId}/${l.prev}`} className="btn btn-secondary">
                Leçon précédente
              </Link>
            ) : (
              <span />
            )}
            {l.next ? (
              <Link href={`/apprendre/${l.trackId}/${l.next}`} className="btn">
                Leçon suivante
              </Link>
            ) : (
              <Link href="/defis" className="btn">
                Passer aux défis
              </Link>
            )}
          </nav>
        </div>
      )}
    </Async>
  );
}
