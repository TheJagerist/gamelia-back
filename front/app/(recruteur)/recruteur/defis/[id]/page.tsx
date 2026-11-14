'use client';
import { ApplicationCard, CHALLENGE_STATUS } from '@/components/recruiter';
import { PlainText } from '@/components/social';
import { useToast } from '@/components/toast';
import { Async, EmptyState, FilterChips, PageHeader, StatusPill, Tag } from '@/components/ui';
import { api, messageFor } from '@/lib/api';
import { dateLong } from '@/lib/format';
import { useResource } from '@/lib/hooks';
import { useState } from 'react';

type F = 'toutes' | 'recue' | 'evaluee' | 'retenue';

export default function RecruiterChallengePage({ params }: { params: { id: string } }) {
  const res = useResource(() => api.recruiter.challenge(params.id), [params.id]);
  const toast = useToast();
  const [filter, setFilter] = useState<F>('toutes');
  return (
    <Async res={res}>
      {({ challenge: c, applications }) => {
        const s = CHALLENGE_STATUS[c.status];
        const list = filter === 'toutes' ? applications : applications.filter((a) => a.status === filter);
        return (
          <>
            <PageHeader
              back={{ href: '/recruteur/defis', label: 'Mes défis' }}
              title={c.title}
              description={c.summary}
              actions={
                c.status === 'publie' && (
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      try {
                        await api.recruiter.close(c.id);
                        toast('Défi clôturé : il ne reçoit plus de candidatures.');
                        res.reload();
                      } catch (e) {
                        toast(messageFor(e), 'error');
                      }
                    }}
                  >
                    Clôturer le défi
                  </button>
                )
              }
            />
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <StatusPill tone={s.tone}>{s.label}</StatusPill>
              <span className="text-sm text-muted">Date limite : {dateLong(c.deadline)}</span>
              {c.skills.map((k) => <Tag key={k} name={k} />)}
            </div>
            <details className="panel mb-8 p-5">
              <summary className="cursor-pointer font-semibold">Voir l&apos;énoncé</summary>
              <PlainText text={c.brief} className="mt-3 max-w-prose" />
            </details>

            <h2 className="mb-3 text-xl">Candidatures ({applications.length})</h2>
            {applications.length > 0 && (
              <div className="mb-4">
                <FilterChips label="Filtrer les candidatures" value={filter} onChange={setFilter} options={[{ value: 'toutes', label: 'Toutes' }, { value: 'recue', label: 'À évaluer' }, { value: 'evaluee', label: 'Évaluées' }, { value: 'retenue', label: 'Retenues' }]} />
              </div>
            )}
            {list.length === 0 ? (
              <EmptyState title={applications.length ? 'Aucune candidature dans cette catégorie.' : 'Pas encore de candidature.'} text={c.status === 'en_attente' ? "Le défi sera visible des développeurs dès sa validation par l'équipe." : 'Partagez le défi : les candidatures arrivent ici.'} />
            ) : (
              <div className="space-y-4">
                {list.map((a) => <ApplicationCard key={a.id} a={a} onChange={res.reload} />)}
              </div>
            )}
          </>
        );
      }}
    </Async>
  );
}
