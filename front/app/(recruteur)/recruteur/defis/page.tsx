'use client';
import Link from 'next/link';
import { Async, EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { api } from '@/lib/api';
import { daysLeft } from '@/lib/format';
import { useResource } from '@/lib/hooks';
import { CHALLENGE_STATUS as STATUS } from '@/components/recruiter';

export default function RecruiterChallengesPage() {
  const res = useResource(() => api.recruiter.myChallenges(), []);
  return (
    <>
      <PageHeader title="Mes défis" description="Chaque défi est relu par l'équipe Gamelia avant publication, en général sous 24 h." actions={<Link href="/recruteur/defis/nouveau" className="btn">Publier un défi</Link>} />
      <Async res={res} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Vous n'avez publié aucun défi." text="Un défi tiré de votre vrai travail attire les développeurs qui savent le faire." action={<Link href="/recruteur/defis/nouveau" className="btn">Publier un premier défi</Link>} />}>
        {(list) => (
          <ul className="panel divide-y divide-line">
            {list.map((c) => {
              const s = STATUS[c.status];
              return (
                <li key={c.id}>
                  <Link href={`/recruteur/defis/${c.id}`} className="flex flex-col gap-2 p-4 hover:bg-sunken sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold">{c.title}</span>
                      <span className="text-sm text-muted">
                        {c.skills.join(', ')}. {daysLeft(c.deadline)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                      <span className="text-sm font-semibold tabular-nums">{c.applicationCount} candidature{c.applicationCount > 1 ? 's' : ''}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
    </>
  );
}
