'use client';
import Link from 'next/link';
import { BadgeCheck, Copy, MapPin } from 'lucide-react';
import { BadgeTile } from '@/components/badge-tile';
import { ProjectCard } from '@/components/cards';
import { ContactButton } from '@/components/contact-button';
import { MessageButton } from '@/components/message-button';
import { PortfolioList } from '@/components/portfolio-list';
import { useToast } from '@/components/toast';
import { Async, Avatar, LevelPill, PointsChip, ProofMark, Skeleton, Tag } from '@/components/ui';
import { api } from '@/lib/api';
import { dateLong, fmt } from '@/lib/format';
import { useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';

export default function PublicProfilePage({ params }: { params: { username: string } }) {
  const res = useResource(() => api.publicProfile(params.username), [params.username]);
  const projects = useResource(() => api.projects.list({ owner: params.username }), [params.username]);
  const { user: me } = useSession();
  const toast = useToast();

  return (
    <Async
      res={res}
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      {(p) => {
        const u = p.user;
        return (
          <>
            <section className="panel overflow-hidden" aria-label={`Profil de ${u.name}`}>
              <div className="h-20 bg-primary sm:h-24 dark:bg-primary-soft" aria-hidden>
                <svg viewBox="0 0 600 96" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
                  {Array.from({ length: 40 }, (_, i) => (
                    <circle key={i} cx={i * 16 + 8} cy={48 + Math.sin(i / 2) * 22} r={i % 4 === 0 ? 4 : 2.5} fill="#fff" opacity={i % 4 === 0 ? 0.3 : 0.15} />
                  ))}
                </svg>
              </div>
              <div className="px-5 pb-6 sm:px-8">
                <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
                  <div className="rounded-full ring-4 ring-surface">
                    <Avatar user={u} size="xl" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => toast('Lien du profil copié.'))}>
                      <Copy className="h-4 w-4" aria-hidden />
                      Copier le lien
                    </button>
                    {me?.role === 'recruteur' && <ContactButton username={u.username} name={u.name} className="btn btn-sm" />}
                    {me?.role === 'developpeur' && me.id !== u.id && <MessageButton username={u.username} className="btn btn-sm" />}
                    {me?.id === u.id && (
                      <Link href="/profil" className="btn btn-sm">
                        Modifier
                      </Link>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <h1 className="text-[1.9rem]">{u.name}</h1>
                  {u.githubVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[13px] font-bold text-primary-ink">
                      <BadgeCheck className="h-4 w-4" aria-hidden />
                      Compte vérifié
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" aria-hidden />
                    {u.city ? `${u.city}, ` : ''}
                    {u.country}
                  </span>
                  <span>Membre depuis le {dateLong(u.joinedAt)}</span>
                </p>
                {u.bio && <p className="mt-4 max-w-prose text-[1.05rem]">{u.bio}</p>}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <PointsChip points={u.points} />
                  <LevelPill level={u.level} />
                  {p.rankInCountry && (
                    <Link href={`/classement?pays=${encodeURIComponent(u.country)}`} className="text-sm font-semibold text-primary hover:underline">
                      {p.rankInCountry === 1 ? '1er' : `${p.rankInCountry}e`} au classement {u.country}
                    </Link>
                  )}
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
                  {[
                    ['Réponses', p.stats.answers],
                    ['Meilleures réponses', p.stats.bestAnswers],
                    ['Défis réussis', p.stats.challenges],
                    ['Projets', p.stats.projects],
                  ].map(([l, n]) => (
                    <div key={l as string} className="bg-surface p-4">
                      <dt className="text-[13px] text-muted">{l}</dt>
                      <dd className="text-2xl font-bold tabular-nums">{fmt(n as number)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <section aria-labelledby="pv">
                <div className="mb-3 flex items-center justify-between">
                  <h2 id="pv" className="text-xl">
                    Vérifié par Gamelia
                  </h2>
                  <ProofMark verified compact />
                </div>
                <PortfolioList items={p.verified} verified empty="Aucun élément vérifié pour l'instant." />
              </section>
              <section aria-labelledby="pd">
                <div className="mb-3 flex items-center justify-between">
                  <h2 id="pd" className="text-xl">
                    Déclaré
                  </h2>
                  <ProofMark verified={false} />
                </div>
                {u.skills.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Compétences déclarées">
                    {u.skills.map((s) => (
                      <Tag key={s} name={s} />
                    ))}
                  </div>
                )}
                <PortfolioList items={p.declared} verified={false} empty="Aucun lien déclaré." />
              </section>
            </div>

            {p.badges.length > 0 && (
              <section className="mt-10" aria-labelledby="bdg">
                <h2 id="bdg" className="mb-4 text-xl">
                  Badges
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {p.badges.map((b) => (
                    <BadgeTile key={b.id} b={b} />
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-10" aria-labelledby="prj">
              <h2 id="prj" className="mb-4 text-xl">
                Projets
              </h2>
              <Async res={projects} isEmpty={(d) => d.items.length === 0} empty={<p className="text-sm text-muted">Aucun projet publié.</p>}>
                {(d) => (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {d.items.map((x) => (
                      <ProjectCard key={x.id} p={x} />
                    ))}
                  </div>
                )}
              </Async>
            </section>
          </>
        );
      }}
    </Async>
  );
}
