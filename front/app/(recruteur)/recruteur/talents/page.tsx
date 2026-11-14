'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BadgeCheck, Search } from 'lucide-react';
import { ContactButton } from '@/components/contact-button';
import { Async, Avatar, EmptyState, LevelPill, PageHeader, Pagination, PointsChip, SelectField, Tag } from '@/components/ui';
import { api } from '@/lib/api';
import { COUNTRIES, LEVELS, TAGS } from '@/lib/constants';
import { useQueryState, useResource } from '@/lib/hooks';
import type { Level } from '@/lib/types';

export default function TalentsPage() {
  const qs = useQueryState();
  const skill = qs.get('competence') || '';
  const country = qs.get('pays') || '';
  const level = (qs.get('niveau') as Level) || '';
  const q = qs.get('q') || '';
  const page = Number(qs.get('page') || 1);
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  const res = useResource(() => api.recruiter.searchTalents({ skill: skill || undefined, country: country || undefined, level: level || undefined, q: q || undefined, page }), [skill, country, level, q, page], qs.ready);
  const filtered = skill || country || level || q;

  return (
    <>
      <PageHeader title="Talents" description="Cherchez par compétence, pays et niveau. Le nombre d'éléments vérifiés montre ce que chaque profil a réellement prouvé." actions={<Link href="/recruteur/defis/nouveau" className="btn">Publier un défi</Link>} />
      <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <form
          role="search"
          className="sm:col-span-2 lg:col-span-1"
          onSubmit={(e) => {
            e.preventDefault();
            qs.set({ q: search.trim() || null, page: null });
          }}
        >
          <label htmlFor="tq" className="field-label">
            Nom ou mot-clé
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="tq" type="search" className="field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => qs.set({ q: search.trim() || null, page: null })} />
          </div>
        </form>
        <SelectField label="Compétence" value={skill} onChange={(e) => qs.set({ competence: e.target.value || null, page: null })}>
          <option value="">Toutes</option>
          {TAGS.map((t) => <option key={t}>{t}</option>)}
        </SelectField>
        <SelectField label="Pays" value={country} onChange={(e) => qs.set({ pays: e.target.value || null, page: null })}>
          <option value="">Tous</option>
          {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
        </SelectField>
        <SelectField label="Niveau" value={level} onChange={(e) => qs.set({ niveau: e.target.value || null, page: null })}>
          <option value="">Tous</option>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </SelectField>
      </div>
      <Async
        res={res}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="Aucun profil ne correspond." text="Retirez un filtre, ou publiez un défi : les développeurs viendront à vous." action={filtered ? <button className="btn btn-secondary" onClick={() => qs.set({ competence: null, pays: null, niveau: null, q: null, page: null })}>Effacer les filtres</button> : undefined} />}
      >
        {(d) => (
          <>
            <p className="mb-2 text-sm text-muted">{d.total} profil{d.total > 1 ? 's' : ''}, du plus actif au moins actif</p>
            <ul className="panel divide-y divide-line">
              {d.items.map((u) => (
                <li key={u.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <Avatar user={u} size="lg" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={`/u/${u.username}`} className="text-lg font-semibold hover:underline">
                          {u.name}
                        </Link>
                        {u.githubVerified && <BadgeCheck className="h-4 w-4 text-primary" aria-label="Compte vérifié" />}
                      </p>
                      <p className="text-sm text-muted">
                        {u.city ? `${u.city}, ` : ''}
                        {u.country}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <LevelPill level={u.level} />
                        <PointsChip points={u.points} />
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-[12px] font-bold text-primary">
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                          {u.verifiedCount} vérifié{u.verifiedCount > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {u.skills.map((s) => <Tag key={s} name={s} />)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col">
                    <Link href={`/u/${u.username}`} className="btn btn-secondary btn-sm flex-1">
                      Voir le profil
                    </Link>
                    <ContactButton username={u.username} name={u.name} className="btn btn-sm flex-1" />
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={d.page} pageCount={d.pageCount} onChange={(p) => qs.set({ page: p > 1 ? p : null })} />
          </>
        )}
      </Async>
    </>
  );
}
