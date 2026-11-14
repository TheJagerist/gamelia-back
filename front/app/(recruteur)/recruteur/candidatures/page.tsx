'use client';
import { ApplicationCard } from '@/components/recruiter';
import { Async, EmptyState, FilterChips, PageHeader, Pagination } from '@/components/ui';
import { api } from '@/lib/api';
import { useQueryState, useResource } from '@/lib/hooks';

type F = 'toutes' | 'recue' | 'evaluee' | 'retenue' | 'non_retenue';

export default function CandidaturesPage() {
  const qs = useQueryState();
  const status = (qs.get('statut') as F) || 'toutes';
  const page = Number(qs.get('page') || 1);
  const res = useResource(() => api.recruiter.applications({ status: status === 'toutes' ? undefined : status, page }), [status, page], qs.ready);
  return (
    <>
      <PageHeader title="Candidatures" description="Toutes les solutions reçues sur vos défis. Évaluez-les, puis proposez une collaboration aux meilleures." />
      <div className="mb-5">
        <FilterChips
          label="Statut"
          value={status}
          onChange={(v) => qs.set({ statut: v === 'toutes' ? null : v, page: null })}
          options={[
            { value: 'toutes', label: 'Toutes' },
            { value: 'recue', label: 'À évaluer' },
            { value: 'evaluee', label: 'Évaluées' },
            { value: 'retenue', label: 'Retenues' },
            { value: 'non_retenue', label: 'Non retenues' },
          ]}
        />
      </div>
      <Async res={res} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="Aucune candidature ici." text="Les solutions envoyées sur vos défis apparaissent dans cette liste." />}>
        {(d) => (
          <>
            <div className="space-y-4">
              {d.items.map((a) => <ApplicationCard key={a.id} a={a} onChange={res.reload} showChallenge />)}
            </div>
            <Pagination page={d.page} pageCount={d.pageCount} onChange={(p) => qs.set({ page: p > 1 ? p : null })} />
          </>
        )}
      </Async>
    </>
  );
}
