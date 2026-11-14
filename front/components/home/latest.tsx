'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { ProjectCard, QuestionRow } from '../cards';
import { Async, EmptyState, FilterChips, ListSkeleton } from '../ui';

export function LatestOnHome() {
  const res = useResource(() => api.home(), []);
  const [tab, setTab] = useState<'questions' | 'projets'>('questions');
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Afficher"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'questions', label: 'Dernières questions' },
            { value: 'projets', label: 'Derniers projets' },
          ]}
        />
        <Link href={tab === 'questions' ? '/questions' : '/projets'} className="link text-sm">
          {tab === 'questions' ? 'Toutes les questions' : 'Tous les projets'}
        </Link>
      </div>
      <Async res={res} skeleton={<ListSkeleton rows={3} />}>
        {(d) =>
          tab === 'questions' ? (
            d.questions.length ? (
              <ul className="panel divide-y divide-line">
                {d.questions.map((q) => (
                  <QuestionRow key={q.id} q={q} />
                ))}
              </ul>
            ) : (
              <EmptyState title="Aucune question pour l'instant." text="Soyez la première personne à en poser une." />
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.projects.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          )
        }
      </Async>
    </>
  );
}
