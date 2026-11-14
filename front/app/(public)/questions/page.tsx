'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { QuestionRow } from '@/components/cards';
import { Async, EmptyState, FilterChips, PageHeader, Pagination, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { TAGS } from '@/lib/constants';
import { useQueryState, useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';

type Sort = 'recentes' | 'sans-reponse' | 'votes';

export default function QuestionsPage() {
  const { user } = useSession();
  const qs = useQueryState();
  const tag = qs.get('tag') || '';
  const sort = (qs.get('tri') as Sort) || 'recentes';
  const page = Number(qs.get('page') || 1);
  const q = qs.get('q') || '';
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  const res = useResource(() => api.questions.list({ tag: tag || undefined, sort, page, q: q || undefined }), [tag, sort, page, q], qs.ready);
  const canAsk = user?.role === 'developpeur';

  return (
    <>
      <PageHeader
        title="Questions"
        description="Toutes les questions de la communauté. Lecture libre, sans compte."
        actions={
          <Link href={canAsk ? '/questions/nouvelle' : '/connexion?suite=/questions/nouvelle'} className="btn">
            Poser une question
          </Link>
        }
      />

      <form
        role="search"
        className="relative mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          qs.set({ q: search.trim() || null, page: null });
        }}
      >
        <label htmlFor="q" className="sr-only">
          Rechercher dans les questions
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input id="q" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher : useEffect, Laravel 419, Mobile Money…" className="field pl-9" />
      </form>

      <div className="mb-3">
        <FilterChips
          label="Trier les questions"
          value={sort}
          onChange={(v) => qs.set({ tri: v === 'recentes' ? null : v, page: null })}
          options={[
            { value: 'recentes', label: 'Récentes' },
            { value: 'sans-reponse', label: 'Sans réponse' },
            { value: 'votes', label: 'Les plus votées' },
          ]}
        />
      </div>

      <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrer par technologie">
        {['', ...TAGS].map((t) => (
          <button
            key={t || 'tout'}
            onClick={() => qs.set({ tag: t || null, page: null })}
            aria-pressed={tag === t}
            className={cx('inline-flex min-h-[36px] shrink-0 items-center rounded-full px-3 text-[13px] font-semibold', tag === t ? 'bg-primary text-primary-ink' : 'bg-sunken text-muted hover:text-ink')}
          >
            {t || 'Toutes les technologies'}
          </button>
        ))}
      </div>

      {q && (
        <p className="mb-3 text-sm text-muted">
          Résultats pour « {q} ».{' '}
          <button className="font-semibold text-primary hover:underline" onClick={() => qs.set({ q: null, page: null })}>
            Effacer la recherche
          </button>
        </p>
      )}

      <Async
        res={res}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={sort === 'sans-reponse' ? 'Toutes les questions ont une réponse.' : 'Aucune question ne correspond.'}
            text={tag || q ? 'Essayez une autre technologie ou un autre mot-clé.' : 'Soyez la première personne à poser une question.'}
            action={
              tag || q ? (
                <button className="btn btn-secondary" onClick={() => qs.set({ tag: null, q: null, tri: null, page: null })}>
                  Voir toutes les questions
                </button>
              ) : (
                <Link href="/questions/nouvelle" className="btn">
                  Poser une question
                </Link>
              )
            }
          />
        }
      >
        {(d) => (
          <>
            <p className="mb-2 text-sm text-muted">{d.total.toLocaleString('fr-FR')} question{d.total > 1 ? 's' : ''}</p>
            <ul className="panel divide-y divide-line">
              {d.items.map((item) => (
                <QuestionRow key={item.id} q={item} />
              ))}
            </ul>
            <Pagination
              page={d.page}
              pageCount={d.pageCount}
              onChange={(p) => {
                qs.set({ page: p > 1 ? p : null });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}
      </Async>
    </>
  );
}
