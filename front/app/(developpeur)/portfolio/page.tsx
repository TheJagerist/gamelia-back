'use client';
import Link from 'next/link';
import { PortfolioList } from '@/components/portfolio-list';
import { Async, PageHeader, ProofMark } from '@/components/ui';
import { api } from '@/lib/api';
import { useResource } from '@/lib/hooks';

export default function PortfolioPage() {
  const res = useResource(() => api.portfolio(), []);
  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Ce que Gamelia a vérifié, séparé de ce que vous déclarez. C'est ce que voient les recruteurs sur votre profil public."
        actions={
          res.data && (
            <Link href={`/u/${res.data.username}`} className="btn">
              Voir mon profil public
            </Link>
          )
        }
      />
      <Async res={res}>
        {(p) => (
          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="verifie" className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="verifie" className="text-xl">
                  Vérifié
                </h2>
                <ProofMark verified />
              </div>
              <p className="mb-4 text-sm text-muted">Défis réussis, pistes terminées, projets relus par des pairs, compte GitHub confirmé. Ajoutés automatiquement.</p>
              <PortfolioList items={p.verified} verified empty="Rien de vérifié pour l'instant. Réussissez un défi pour obtenir votre premier élément vérifié." />
              {p.verified.length === 0 && (
                <Link href="/defis" className="btn mt-4">
                  Voir les défis
                </Link>
              )}
            </section>
            <section aria-labelledby="declare" className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="declare" className="text-xl">
                  Déclaré
                </h2>
                <ProofMark verified={false} />
              </div>
              <p className="mb-4 text-sm text-muted">Liens ajoutés dans votre profil et projets publiés qui n&apos;ont pas encore été relus par des pairs.</p>
              <PortfolioList items={p.declared} verified={false} empty="Aucun élément déclaré." />
              <Link href="/profil" className="btn btn-secondary mt-4">
                Modifier mes liens
              </Link>
            </section>
          </div>
        )}
      </Async>
    </>
  );
}
