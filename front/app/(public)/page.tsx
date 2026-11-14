import Link from 'next/link';
import { BadgeCheck, CircleDashed, Code2, Flame, Sparkles, Trophy } from 'lucide-react';
import { LatestOnHome } from '@/components/home/latest';
import { MOCK } from '@/lib/api';

// Accueil public : proposition de valeur, bouton « Rejoindre la communauté », dernières questions et derniers projets.

function Ring() {
  // Le cercle Gamelia, en grand, derrière la conversation.
  const n = 28;
  return (
    <svg viewBox="0 0 400 400" className="pointer-events-none absolute -right-16 -top-10 hidden h-[560px] w-[560px] lg:block" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return <circle key={i} cx={200 + Math.cos(a) * 180} cy={200 + Math.sin(a) * 180} r={i % 3 === 0 ? 6 : 3.5} fill={i % 2 ? "#ba88ae" : "#9e6899"} opacity={i % 3 === 0 ? 0.35 : 0.2} />;
      })}
      <circle cx="200" cy="200" r="120" fill="none" stroke="#ba88ae" strokeOpacity=".45" strokeWidth="1.5" strokeDasharray="2 8" />
    </svg>
  );
}

function Floater({ className, delay, rotate, children }: { className: string; delay: number; rotate: number; children: React.ReactNode }) {
  return (
    <div className={`floaty pointer-events-none absolute z-20 hidden md:flex ${className}`} style={{ animationDelay: `${delay}ms`, ['--r' as string]: `${rotate}deg` }} aria-hidden>
      {children}
    </div>
  );
}

function Msg({ who, initial, tone, children, delay, best }: { who: string; initial: string; tone: string; children: React.ReactNode; delay: number; best?: boolean }) {
  return (
    <article className={`rise relative rounded-lg border bg-surface p-4 shadow-[0_12px_32px_-20px_rgba(42,23,48,.45)] ${best ? 'border-primary' : 'border-line'}`} style={{ animationDelay: `${delay}ms` }}>
      <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${tone}`} aria-hidden>
          {initial}
        </span>
        {who}
      </p>
      {children}
    </article>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Hero : une vraie conversation de développeurs */}
      <section className="relative overflow-hidden">
        <div className="wrap grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="relative z-10">
            <h1 className="text-[2.35rem] leading-[1.04] tracking-[-0.03em] sm:text-[3.2rem] lg:text-[3.9rem]">Posez la question. Montrez le projet. Prouvez ce que vous savez.</h1>
            <p className="mt-5 max-w-[34rem] text-lg text-muted">
              Gamelia réunit les développeurs africains pour échanger, apprendre et se faire repérer par des recruteurs, même depuis un simple téléphone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/inscription" className="btn px-6 text-[17px]">
                Rejoindre la communauté
              </Link>
              <Link href="/questions" className="btn btn-secondary px-6 text-[17px]">
                Lire les questions
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">Gratuit. Lecture des questions sans compte.</p>
          </div>

          <figure className="relative" aria-label="Exemple d'échange sur Gamelia">
            <Ring />
            <Floater className="-top-12 left-6 items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-sm font-bold text-[#2a1730] shadow-[0_14px_30px_-12px_rgba(91,55,101,.55)]" delay={0} rotate={-6}>
              <Trophy className="h-4 w-4" />
              Défi réussi, +150 pts
            </Floater>
            <Floater className="-left-6 top-[44%] h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-ink shadow-[0_14px_30px_-12px_rgba(91,55,101,.6)]" delay={1200} rotate={8}>
              <Code2 className="h-7 w-7" />
            </Floater>
            <Floater className="-bottom-6 left-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold shadow-[0_14px_30px_-14px_rgba(42,23,48,.45)]" delay={600} rotate={4}>
              <BadgeCheck className="h-4 w-4 text-primary" />
              Compte vérifié
            </Floater>
            <Floater className="-top-9 right-8 h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-ink shadow-[0_10px_24px_-12px_rgba(91,55,101,.5)]" delay={1800} rotate={0}>
              <Flame className="h-5 w-5" />
            </Floater>
            <div className="relative space-y-3 lg:pl-8">
              <Msg who="Awa pose une question" initial="A" tone="bg-primary text-primary-ink" delay={80}>
                <h2 className="text-lg font-semibold">Comment connecter mon application à une API ?</h2>
                <p className="mt-1 text-[15px] text-muted">Mon formulaire envoie les données, mais je ne reçois rien en retour.</p>
                <div className="mt-3 flex gap-1.5">
                  <span className="rounded-full bg-sunken px-2.5 py-0.5 text-[13px] font-semibold text-muted">Python</span>
                  <span className="rounded-full bg-sunken px-2.5 py-0.5 text-[13px] font-semibold text-muted">API</span>
                </div>
              </Msg>
              <div className="sm:ml-10">
                <Msg who="Koffi répond" initial="K" tone="bg-accent text-[#2a1730]" delay={520} best>
                  <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-ink">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Meilleure réponse
                  </span>
                  <p className="text-[15px]">Il manque les parenthèses : reponse.json est une méthode. Affiche ensuite la réponse dans la console.</p>
                  <p className="mt-2 text-[13px] font-bold text-accent-ink">+25 points de contribution pour Koffi</p>
                </Msg>
              </div>
              <div className="sm:ml-20">
                <Msg who="Mireille répond" initial="M" tone="bg-primary-soft text-primary" delay={960}>
                  <p className="text-[15px]">Je peux te montrer mon projet qui fait la même chose, avec une courte vidéo.</p>
                </Msg>
              </div>
            </div>
          </figure>
        </div>
      </section>

      {/* Le parcours : c'est une vraie séquence, d'où la numérotation */}
      <section className="border-y border-line bg-surface" aria-labelledby="parcours">
        <div className="wrap py-14 sm:py-20">
          <h2 id="parcours" className="max-w-xl text-[1.9rem] sm:text-[2.3rem]">
            De la première question au premier contrat
          </h2>
          <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Échanger', "Posez une question, répondez à celle d'un autre, commentez. Personne n'est jugé, chaque réponse utile rapporte des points."],
              ['Apprendre', 'Suivez une piste courte : une leçon, un quiz, une correction immédiate. Puis la suivante.'],
              ['Prouver', 'Réussissez des défis et publiez vos projets avec une démo. Ce qui est vérifié est marqué comme tel.'],
              ['Être repéré', 'Les recruteurs publient des défis réels et contactent les profils qui ont fait leurs preuves.'],
            ].map(([t, d], i) => (
              <li key={t} className="relative">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary text-lg font-bold text-primary tabular-nums">{i + 1}</span>
                <h3 className="text-xl">{t}</h3>
                <p className="mt-2 text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Vérifié ou déclaré : l'innovation de Gamelia */}
      <section className="wrap grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2" aria-labelledby="preuve">
        <div>
          <h2 id="preuve" className="text-[1.9rem] sm:text-[2.3rem]">
            Un profil qui montre ce qui est prouvé
          </h2>
          <p className="mt-4 max-w-prose text-lg text-muted">
            Tout le monde peut écrire « je connais React ». Sur Gamelia, les défis réussis et les projets relus par des pairs portent un sceau. Le reste est affiché comme
            déclaré. Un recruteur voit la différence d&apos;un coup d&apos;œil.
          </p>
          <Link href={MOCK ? '/u/awa.diop' : '/classement'} className="link mt-6 inline-block">
            {MOCK ? 'Voir un profil public' : 'Voir les profils de la communauté'}
          </Link>
        </div>
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line p-5">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-ink" aria-hidden>
              AD
            </span>
            <div>
              <p className="font-semibold">Awa Diop</p>
              <p className="text-sm text-muted">Dakar, Sénégal. Python, Django, SQL</p>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {[
              ['Défi « Les bases de JavaScript »', 'Quiz corrigé automatiquement', true],
              ['Piste « Créer son premier site web »', 'Trois leçons, quiz réussis', true],
              ['Compte GitHub', 'Relié et confirmé', true],
              ['Site personnel awa.dev', 'Ajouté par Awa', false],
            ].map(([t, d, v]) => (
              <li key={t as string} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t}</p>
                  <p className="text-sm text-muted">{d}</p>
                </div>
                {v ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-ink">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Vérifié
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-muted/60 px-2.5 py-0.5 text-[12px] font-semibold text-muted">
                    <CircleDashed className="h-3.5 w-3.5" aria-hidden />
                    Déclaré
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Agnès, l'assistante IA */}
      <section className="border-y border-line bg-surface" aria-labelledby="agnes">
        <div className="wrap grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2">
          <div className="relative order-2 min-w-0 lg:order-1">
            <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-accent/30 blur-3xl" aria-hidden />
            <div className="panel relative space-y-4 p-5 shadow-[0_24px_60px_-30px_rgba(91,55,101,.55)]">
              <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-primary px-4 py-2.5 text-primary-ink">
                Mon fetch renvoie une erreur CORS, je fais comment ?
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5b3765] to-[#9e6899] text-white" aria-hidden>
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 rounded-lg rounded-tl-sm border border-line bg-sunken/60 px-4 py-3 text-[15px]">
                  <p>Le navigateur bloque la réponse tant que ton API n&apos;autorise pas l&apos;origine du front. Côté Express :</p>
                  <pre className="mt-2 overflow-x-auto rounded bg-[#2a1730] px-3 py-2 font-mono text-[13px] text-[#f6ecf3]">
                    {"app.use(cors({ origin: 'https://ton-site', credentials: true }))"}
                  </pre>
                </div>
              </div>
            </div>
            <span className="floaty absolute -top-4 right-2 inline-flex sm:-right-3 items-center gap-1 rounded-full border border-accent bg-accent-soft px-3 py-1 text-xs font-bold text-accent-ink shadow-sm" style={{ ['--r' as string]: '6deg' }} aria-hidden>
              <Sparkles className="h-3.5 w-3.5" />
              Réponse en quelques secondes
            </span>
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <p className="inline-flex items-center gap-2 font-semibold text-primary">
              <Sparkles className="h-4 w-4" aria-hidden />
              Nouveau : Agnès
            </p>
            <h2 id="agnes" className="mt-2 text-[1.9rem] sm:text-[2.3rem]">
              Bloqué à minuit ? Agnès répond tout de suite.
            </h2>
            <p className="mt-4 max-w-prose text-lg text-muted">
              Agnès, l&apos;assistante IA de Gamelia, propose une première piste sur chaque question et vous explique une erreur ou une notion en privé. La communauté prend ensuite le relais pour confirmer, corriger et aller plus loin.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/connexion?suite=/agnes" className="btn">
                Parler à Agnès
              </Link>
              <Link href="/aide" className="btn btn-secondary">
                Comment ça marche
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dernières questions et derniers projets */}
      <section className="wrap pb-16" aria-labelledby="maintenant">
        <h2 id="maintenant" className="mb-5 text-[1.9rem] sm:text-[2.3rem]">
          Sur Gamelia en ce moment
        </h2>
        <LatestOnHome />
      </section>

      {/* Défi de la semaine */}
      <section className="bg-accent" aria-labelledby="defi">
        <div className="wrap flex flex-col items-start justify-between gap-6 py-12 text-[#2a1730] md:flex-row md:items-center">
          <div>
            <p className="font-semibold">Défi de la semaine</p>
            <h2 id="defi" className="mt-1 text-[1.8rem] sm:text-[2.2rem]">
              Créer une API de tâches
            </h2>
            <p className="mt-2 max-w-xl">Soumettez votre solution, recevez la validation de l&apos;équipe et gagnez 150 points.</p>
          </div>
          <Link href="/defis/d1" className="btn shrink-0 bg-[#2a1730] px-6 text-white hover:bg-black">
            Participer au défi
          </Link>
        </div>
      </section>

      {/* Recruteurs */}
      <section className="wrap py-16 sm:py-20" aria-labelledby="recruteurs">
        <div className="grid gap-8 rounded-xl bg-primary p-8 text-primary-ink sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <h2 id="recruteurs" className="text-[1.8rem] sm:text-[2.2rem]">
              Vous recrutez ? Jugez sur pièces.
            </h2>
            <p className="mt-3 max-w-xl opacity-90">Publiez un défi tiré de votre vrai travail, évaluez les solutions reçues et proposez une collaboration aux meilleurs profils.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/inscription?role=recruteur" className="btn btn-sun px-6">
              Créer un compte recruteur
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
