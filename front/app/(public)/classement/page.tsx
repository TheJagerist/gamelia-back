'use client';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { Async, Avatar, EmptyState, PageHeader, Pagination, SelectField, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { COUNTRIES } from '@/lib/constants';
import { fmt } from '@/lib/format';
import { useQueryState, useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';

export default function ClassementPage() {
  const qs = useQueryState();
  const { user } = useSession();
  const country = qs.get('pays') || '';
  const page = Number(qs.get('page') || 1);
  const res = useResource(() => api.leaderboard({ country: country || undefined, page }), [country, page], qs.ready);

  return (
    <>
      <PageHeader title={country ? `Classement : ${country}` : 'Classement'} description="Les développeurs qui contribuent le plus, par points gagnés en aidant, apprenant et construisant." />
      <SelectField label="Pays" className="mb-5 sm:w-64" value={country} onChange={(e) => qs.set({ pays: e.target.value || null, page: null })}>
        <option value="">Tous les pays</option>
        {COUNTRIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </SelectField>
      <Async res={res} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title={`Personne n'est encore classé pour ${country}.`} text="Invitez les développeurs de votre pays à rejoindre Gamelia." />}>
        {(d) => (
          <>
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <caption className="sr-only">Classement des développeurs {country ? `du pays ${country}` : 'tous pays confondus'}</caption>
                <thead>
                  <tr className="border-b border-line text-sm text-muted">
                    <th scope="col" className="w-16 px-4 py-3 font-semibold">Rang</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Développeur</th>
                    <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">Pays</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Cette semaine</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.items.map((r) => (
                    <tr key={r.user.id} className={cx(r.user.id === user?.id && 'bg-primary-soft')}>
                      <td className="px-4 py-3">
                        <span className={cx('inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums', r.rank <= 3 ? 'bg-accent text-[#2a1730]' : 'text-muted')}>{r.rank}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/u/${r.user.username}`} className="flex items-center gap-3 font-semibold hover:underline">
                          <Avatar user={r.user} size="sm" />
                          {r.user.name}
                          {r.user.githubVerified && <BadgeCheck className="h-4 w-4 text-primary" aria-label="Compte vérifié" />}
                          {r.user.id === user?.id && <span className="text-[13px] font-normal text-muted">(vous)</span>}
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 text-muted sm:table-cell">{r.user.country}</td>
                      <td className="px-4 py-3 text-right text-sm text-accent-ink tabular-nums">+{fmt(r.weekPoints)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={d.page} pageCount={d.pageCount} onChange={(p) => qs.set({ page: p > 1 ? p : null })} />
          </>
        )}
      </Async>
    </>
  );
}
