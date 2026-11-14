'use client';
import Link from 'next/link';
import { FeedRow } from '@/components/cards';
import { Async, EmptyState, FilterChips, PageHeader, Pagination, PointsChip } from '@/components/ui';
import { api } from '@/lib/api';
import { useQueryState, useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';

type T = 'tout' | 'question' | 'projet' | 'lecon';

export default function FilPage() {
  const { user } = useSession();
  const qs = useQueryState();
  const type = (qs.get('type') as T) || 'tout';
  const following = qs.get('suivis') === '1';
  const page = Number(qs.get('page') || 1);
  const res = useResource(() => api.feed({ type: type === 'tout' ? undefined : type, page, following }), [type, page, following], qs.ready);
  const hasFollow = !!user?.following?.length;

  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.name.split(' ')[0] ?? ''}`}
        description="Questions, projets et leçons de la communauté, du plus récent au plus ancien."
        actions={
          <Link href="/progression" className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:border-primary">
            Mes points <PointsChip points={user?.points ?? 0} />
          </Link>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips
          label="Type de contenu"
          value={type}
          onChange={(v) => qs.set({ type: v === 'tout' ? null : v, page: null })}
          options={[
            { value: 'tout', label: 'Tout' },
            { value: 'question', label: 'Questions' },
            { value: 'projet', label: 'Projets' },
            { value: 'lecon', label: 'Leçons' },
          ]}
        />
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--primary)]"
            checked={following}
            disabled={!hasFollow}
            onChange={(e) => qs.set({ suivis: e.target.checked ? '1' : null, page: null })}
          />
          Seulement mes technologies
          {!hasFollow && (
            <Link href="/profil" className="font-normal text-primary underline">
              (à choisir)
            </Link>
          )}
        </label>
      </div>

      <Async
        res={res}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="Rien de neuf ici pour l'instant." text="Élargissez les filtres ou lancez la conversation." action={<Link href="/questions/nouvelle" className="btn">Poser une question</Link>} />}
      >
        {(d) => (
          <>
            <ul className="panel divide-y divide-line">
              {d.items.map((f) => (
                <FeedRow key={`${f.type}-${f.item.id}`} f={f} />
              ))}
            </ul>
            <Pagination page={d.page} pageCount={d.pageCount} onChange={(p) => qs.set({ page: p > 1 ? p : null })} />
          </>
        )}
      </Async>
    </>
  );
}
