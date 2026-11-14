'use client';
import { OpportunityCard } from '@/components/cards';
import { LearnNav } from '@/components/learn-nav';
import { Async, EmptyState, PageHeader, Pagination, SelectField } from '@/components/ui';
import { api } from '@/lib/api';
import { TAGS } from '@/lib/constants';
import { useQueryState, useResource } from '@/lib/hooks';

export default function OpportunitesPage() {
  const qs = useQueryState();
  const skill = qs.get('competence') || '';
  const page = Number(qs.get('page') || 1);
  const res = useResource(() => api.opportunities.list({ skill: skill || undefined, page }), [skill, page], qs.ready);
  return (
    <>
      <PageHeader title="Défis recruteurs" description="Des entreprises publient un problème réel. Envoyez votre solution : les meilleures reçoivent une proposition de collaboration." />
      <LearnNav />
      <SelectField label="Compétence" className="mb-5 sm:w-60" value={skill} onChange={(e) => qs.set({ competence: e.target.value || null, page: null })}>
        <option value="">Toutes</option>
        {TAGS.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </SelectField>
      <Async res={res} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="Aucun défi recruteur ouvert pour cette compétence." text="Revenez bientôt : de nouveaux défis sont publiés chaque semaine." />}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {d.items.map((c) => (
                <OpportunityCard key={c.id} c={c} href={`/opportunites/${c.id}`} />
              ))}
            </div>
            <Pagination page={d.page} pageCount={d.pageCount} onChange={(p) => qs.set({ page: p > 1 ? p : null })} />
          </>
        )}
      </Async>
    </>
  );
}
