'use client';
import Link from 'next/link';
import { ProjectCard } from '@/components/cards';
import { Async, EmptyState, PageHeader, Pagination, SelectField } from '@/components/ui';
import { api } from '@/lib/api';
import { TAGS } from '@/lib/constants';
import { useQueryState, useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';

export default function ProjetsPage() {
  const { user } = useSession();
  const qs = useQueryState();
  const tech = qs.get('tech') || '';
  const seeking = qs.get('collab') === '1';
  const page = Number(qs.get('page') || 1);
  const res = useResource(() => api.projects.list({ tech: tech || undefined, seeking, page }), [tech, seeking, page], qs.ready);
  const isDev = user?.role === 'developpeur';

  return (
    <>
      <PageHeader
        title="Projets"
        description="Ce que les membres construisent, avec une démo vidéo et le lien vers le code. Rejoignez ceux qui cherchent des collaborateurs."
        actions={
          <Link href={isDev ? '/projets/nouveau' : '/connexion?suite=/projets/nouveau'} className="btn">
            Publier un projet
          </Link>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <SelectField label="Technologie" className="sm:w-60" value={tech} onChange={(e) => qs.set({ tech: e.target.value || null, page: null })}>
          <option value="">Toutes</option>
          {TAGS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </SelectField>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={seeking} onChange={(e) => qs.set({ collab: e.target.checked ? '1' : null, page: null })} />
          Cherchent des collaborateurs
        </label>
      </div>
      <Async
        res={res}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="Aucun projet ne correspond." text="Changez de technologie ou publiez le premier." action={isDev ? <Link href="/projets/nouveau" className="btn">Publier un projet</Link> : undefined} />}
      >
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.items.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
            <Pagination page={d.page} pageCount={d.pageCount} onChange={(p) => qs.set({ page: p > 1 ? p : null })} />
          </>
        )}
      </Async>
    </>
  );
}
