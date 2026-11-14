import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, CircleDashed, Sparkles } from 'lucide-react';

export const metadata: Metadata = { title: 'Comment ça marche' };

const POINTS: [string, string][] = [
  ['Répondre à une question', '+10'],
  ['Réponse votée utile', '+5'],
  ['Meilleure réponse choisie par l’auteur', '+25'],
  ['Leçon réussie', '+15'],
  ['Piste terminée', '+60'],
  ['Défi réussi', '+40 à +250'],
  ['Projet publié', '+30'],
  ['Revue validée par le propriétaire du projet', '+10'],
];

export default function AidePage() {
  return (
    <div className="mx-auto max-w-[46rem]">
      <h1 className="text-[2rem]">Comment ça marche</h1>
      <p className="mt-2 text-lg text-muted">Gamelia est un lieu d&apos;échange entre développeurs. Voici les règles du jeu, en bref.</p>

      <section className="mt-10" aria-labelledby="a1">
        <h2 id="a1" className="text-xl">Vérifié ou déclaré</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-primary/40 bg-surface p-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-ink">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Vérifié
            </span>
            <p className="mt-2 text-[15px]">Défi réussi, piste terminée, projet relu par des pairs, compte GitHub confirmé par un code placé sur le profil GitHub. Gamelia en a la preuve.</p>
          </div>
          <div className="rounded-lg border border-dashed border-line p-4">
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted/60 px-2.5 py-0.5 text-[12px] font-semibold text-muted">
              <CircleDashed className="h-3.5 w-3.5" aria-hidden />
              Déclaré
            </span>
            <p className="mt-2 text-[15px]">Compétences, liens et projets ajoutés par le membre lui-même. Utile, mais pas encore prouvé.</p>
          </div>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="a2">
        <h2 id="a2" className="text-xl">Les points</h2>
        <table className="panel mt-4 w-full text-left text-[15px]">
          <caption className="sr-only">Barème des points</caption>
          <tbody className="divide-y divide-line">
            {POINTS.map(([a, p]) => (
              <tr key={a}>
                <th scope="row" className="px-4 py-2.5 font-normal">{a}</th>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums">{p}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[15px] text-muted">Pour que le classement reste juste : 200 points au plus par jour, et aucun point sur son propre projet ou sa propre question.</p>
      </section>

      <section className="mt-10" aria-labelledby="a3">
        <h2 id="a3" className="text-xl">Recruteurs</h2>
        <p className="mt-3 text-[15px]">Chaque compte recruteur et chaque défi recruteur sont validés par l&apos;équipe avant publication. Les recruteurs évaluent des solutions réelles, puis proposent une collaboration.</p>
      </section>

      <section className="mt-10" aria-labelledby="a5">
        <h2 id="a5" className="flex items-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          Agnès, l&apos;assistante IA
        </h2>
        <p className="mt-3 text-[15px]">
          Sur chaque question, un membre connecté peut demander « la piste d&apos;Agnès » : une première réponse rédigée par l&apos;intelligence artificielle, visible ensuite par tous. Elle ne rapporte aucun point, ne peut pas devenir meilleure réponse et ne remplace pas la communauté : vérifiez-la toujours. Depuis le menu, la page <Link href="/agnes" className="link">Agnès</Link> permet aussi d&apos;échanger avec elle en privé. Ne lui confiez jamais de mot de passe ni de clé secrète.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="a4">
        <h2 id="a4" className="text-xl">Respect</h2>
        <p className="mt-3 text-[15px]">Personne n&apos;est jugé pour une question de débutant. Un contenu offensant, un spam ou un doublon se signale avec le bouton « Signaler » ; l&apos;équipe le traite rapidement.</p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/inscription" className="btn">Rejoindre la communauté</Link>
        <Link href="/questions" className="btn btn-secondary">Lire les questions</Link>
      </div>
    </div>
  );
}
