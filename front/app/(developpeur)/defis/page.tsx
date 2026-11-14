'use client';
import { ChallengeCard } from '@/components/cards';
import { LearnNav } from '@/components/learn-nav';
import { Async, EmptyState, FilterChips, PageHeader, Pagination, SelectField } from '@/components/ui';
import { api } from '@/lib/api';
import { LEVELS } from '@/lib/constants';
import { useQueryState, useResource } from '@/lib/hooks';
import type { Level } from '@/lib/types';

type K = 'tous' | 'quiz' | 'pratique';

export default function DefisPage() {
  const qs = useQueryState();
  const kind = (qs.get('type') as K) || 'tous';
  const level = (qs.get('niveau') as Level) || '';
  const page = Number(qs.get('page') || 1);
  const res = useResource(() => api.challenges.list({ kind: kind === 'tous' ? undefined : kind, level: level || undefined, page }), [kind, level, page], qs.ready);

  return (
    <>
      <PageHeader title="Défis" description="Prouvez ce que vous savez. Les quiz sont corrigés tout de suite ; les défis pratiques sont vérifiés par l'équipe sous 48 h." />
      <LearnNav />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <FilterChips
          label="Type de défi"
          value={kind}
          onChange={(v) => qs.set({ type: v === 'tous' ? null : v, page: null })}
          options={[
            { value: 'tous', label: 'Tous' },
            { value: 'quiz', label: 'Quiz' },
            { value: 'pratique', label: 'Pratiques' },
          ]}
        />
        <SelectField label="Niveau" className="sm:w-52" value={level} onChange={(e) => qs.set({ niveau: e.target.value || null, page: null })}>
          <option value="">Tous les niveaux</option>
          {LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </SelectField>
      </div>
      <Async
        res={res}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="Aucun défi pour ces filtres." action={<button className="btn btn-secondary" onClick={() => qs.set({ type: null, niveau: null, page: null })}>Voir tous les défis</button>} />}
      >
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {d.items.map((c) => (
                <ChallengeCard key={c.id} c={c} />
              ))}
            </div>
            <Pagination page={d.page} pageCount={d.pageCount} onChange={(p) => qs.set({ page: p > 1 ? p : null })} />
          </>
        )}
      </Async>
    </>
  );
}
