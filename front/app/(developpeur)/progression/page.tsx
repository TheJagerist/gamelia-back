'use client';
import { BadgeTile } from '@/components/badge-tile';
import { Async, LevelPill, PageHeader, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { fmt, timeAgo } from '@/lib/format';
import { useResource } from '@/lib/hooks';

const RULES: [string, number][] = [
  ['Répondre à une question', 10],
  ['Réponse votée utile', 5],
  ['Meilleure réponse choisie', 25],
  ['Leçon réussie', 15],
  ['Piste terminée', 60],
  ['Défi réussi', 40],
  ['Projet publié', 30],
  ['Revue validée par le propriétaire', 10],
];

export default function ProgressionPage() {
  const res = useResource(() => api.progression(), []);
  return (
    <>
      <PageHeader title="Points, niveaux et badges" description="Chaque action utile rapporte des points visibles sur votre profil public." />
      <Async
        res={res}
        skeleton={
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        }
      >
        {(p) => {
          const span = p.nextLevelAt ? p.nextLevelAt - p.levelFloor : 1;
          const pct = p.nextLevelAt ? Math.min(100, Math.round(((p.points - p.levelFloor) / span) * 100)) : 100;
          const capPct = Math.min(100, Math.round((p.todayPoints / p.dailyCap) * 100));
          return (
            <>
              <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
                <section className="rounded-xl bg-primary p-6 text-primary-ink" aria-labelledby="total">
                  <h2 id="total" className="text-base font-semibold opacity-90">
                    Total
                  </h2>
                  <p className="mt-1 text-[3.2rem] font-bold leading-none tabular-nums">{fmt(p.points)}</p>
                  <p className="mt-1 opacity-90">points de contribution</p>
                  <div className="mt-6">
                    <div className="mb-1.5 flex justify-between text-sm font-semibold">
                      <span>Niveau {p.level}</span>
                      <span className="tabular-nums">{p.nextLevelAt ? `${fmt(p.nextLevelAt - p.points)} pts avant le niveau suivant` : 'Niveau maximal'}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression vers le niveau suivant">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </section>
                <section className="panel p-6" aria-labelledby="jour">
                  <h2 id="jour" className="text-base">
                    Aujourd&apos;hui
                  </h2>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {p.todayPoints} <span className="text-base font-semibold text-muted">/ {p.dailyCap} pts</span>
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={capPct} aria-valuemin={0} aria-valuemax={100} aria-label="Points gagnés aujourd'hui par rapport au plafond">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${capPct}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-muted">Le plafond quotidien garde le classement juste. Aucun point n&apos;est accordé sur son propre projet.</p>
                  <div className="mt-4">
                    <LevelPill level={p.level} />
                  </div>
                </section>
              </div>

              <section className="mt-10" aria-labelledby="badges">
                <h2 id="badges" className="mb-4 text-xl">
                  Badges ({p.badges.length} sur {p.badges.length + p.lockedBadges.length})
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {p.badges.map((b) => (
                    <BadgeTile key={b.id} b={b} />
                  ))}
                  {p.lockedBadges.map((b) => (
                    <BadgeTile key={b.id} b={b} locked />
                  ))}
                </ul>
              </section>

              <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
                <section aria-labelledby="historique">
                  <h2 id="historique" className="mb-4 text-xl">
                    Historique
                  </h2>
                  {p.history.length ? (
                    <ul className="panel divide-y divide-line">
                      {p.history.map((h) => (
                        <li key={h.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
                          <span className="min-w-0">
                            <span className="block">{h.label}</span>
                            <span className="text-[13px] text-muted">{timeAgo(h.date)}</span>
                          </span>
                          <span className="shrink-0 font-bold text-accent-ink tabular-nums">+{h.points}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-dashed border-line p-6 text-center text-muted">Pas encore de points. Répondez à une question ou réussissez un quiz pour commencer.</p>
                  )}
                </section>
                <section aria-labelledby="regles">
                  <h2 id="regles" className="mb-4 text-xl">
                    Comment gagner des points
                  </h2>
                  <table className="panel w-full text-left text-sm">
                    <caption className="sr-only">Barème des points</caption>
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th scope="col" className="px-4 py-2.5 font-semibold">Action</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-semibold">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {RULES.map(([a, n]) => (
                        <tr key={a}>
                          <td className="px-4 py-2.5">{a}</td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums">{a === 'Défi réussi' ? '40 à 250' : `+${n}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-sm text-muted">Niveaux : Débutant jusqu&apos;à 499 pts, Intermédiaire de 500 à 1 999, Confirmé à partir de 2 000.</p>
                </section>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
