import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/site';

export const metadata: Metadata = { title: "Conditions d'utilisation", description: 'Les règles à respecter pour utiliser Gamelia.' };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10" aria-labelledby={id}>
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

export default function ConditionsPage() {
  return (
    <div className="mx-auto max-w-[46rem]">
      <h1 className="text-[2rem]">Conditions d&apos;utilisation</h1>
      <p className="mt-2 text-lg text-muted">Les règles du site, en langage clair. En créant un compte, vous les acceptez.</p>
      <p className="mt-2 text-sm text-muted">Dernière mise à jour : {LEGAL_UPDATED}.</p>

      <Section id="u1" title="Le service">
        <p>
          Gamelia est une plateforme d&apos;échange entre développeurs : questions et réponses, pistes d&apos;apprentissage, défis, projets, messagerie, mise en relation avec des recruteurs, et une assistante
          IA appelée Agnès. Le service est gratuit. C&apos;est un projet présenté au Concours CADEV by Systalink, édition 2026 : il est fourni tel quel, sans garantie de disponibilité permanente.
        </p>
      </Section>

      <Section id="u2" title="Votre compte">
        <ul className="list-disc space-y-2 pl-5">
          <li>Donnez des informations exactes : votre vrai nom, une adresse e-mail que vous consultez, et pour un recruteur le vrai nom de l&apos;entreprise.</li>
          <li>Un compte par personne. Gardez votre mot de passe pour vous : vous êtes responsable de ce qui est fait avec votre compte.</li>
          <li>Un compte recruteur n&apos;est actif qu&apos;après validation par l&apos;équipe, pour protéger les développeurs.</li>
          <li>
            Le site n&apos;envoie pas d&apos;e-mail. Si vous perdez votre mot de passe, écrivez à l&apos;équipe (voir{' '}
            <Link href="/mot-de-passe-oublie" className="link">
              Mot de passe oublié
            </Link>
            ).
          </li>
        </ul>
      </Section>

      <Section id="u3" title="Ce que vous publiez">
        <p>
          Vous restez propriétaire de vos contenus (questions, réponses, projets, messages). En les publiant, vous autorisez Gamelia à les afficher sur le site. Ne publiez que ce que vous avez le droit de
          partager : pas de code ni de texte copié sans autorisation, pas de mot de passe, de clé d&apos;accès ni de donnée personnelle d&apos;une autre personne.
        </p>
      </Section>

      <Section id="u4" title="Ce qui est interdit">
        <ul className="list-disc space-y-2 pl-5">
          <li>les insultes, le harcèlement, les propos haineux ou discriminatoires ;</li>
          <li>les contenus illégaux, trompeurs ou publicitaires sans rapport avec le développement ;</li>
          <li>la triche sur les points : comptes multiples, votes arrangés, solutions copiées ;</li>
          <li>les fausses offres, les demandes d&apos;argent et toute tentative d&apos;arnaque envers les membres ;</li>
          <li>les tentatives de contourner la sécurité du site ou d&apos;en perturber le fonctionnement.</li>
        </ul>
      </Section>

      <Section id="u5" title="Points, badges et éléments vérifiés">
        <p>
          Les points et les badges récompensent la participation ; ils n&apos;ont aucune valeur en argent. La mention « vérifié » signifie seulement que Gamelia a constaté un fait précis : un défi réussi, une
          piste terminée, un projet relu, un compte GitHub confirmé. Elle ne garantit pas le niveau global d&apos;une personne. Les règles de calcul sont expliquées dans{' '}
          <Link href="/aide" className="link">
            Comment ça marche
          </Link>
          .
        </p>
      </Section>

      <Section id="u6" title="Agnès, l'assistante IA">
        <p>
          Agnès est un programme d&apos;intelligence artificielle. Ses réponses peuvent contenir des erreurs : vérifiez-les et testez le code avant de l&apos;utiliser. Le nombre de demandes par heure est
          limité. Si le service extérieur dont elle dépend est indisponible, le reste du site continue de fonctionner.
        </p>
      </Section>

      <Section id="u7" title="Recruteurs">
        <p>
          Les défis et les propositions publiés par les recruteurs les engagent seuls. Gamelia met en relation, mais n&apos;est partie à aucun contrat de travail ou de prestation et ne garantit aucune
          embauche. Ne payez jamais pour candidater.
        </p>
      </Section>

      <Section id="u8" title="Modération">
        <p>
          Chaque contenu peut être signalé. L&apos;équipe peut retirer un contenu contraire à ces règles et, en cas d&apos;abus grave ou répété, fermer un compte. Vous pouvez contester une décision en écrivant
          à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="link break-all">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section id="u9" title="Vos données et la fin du compte">
        <p>
          Le traitement de vos données est décrit dans la{' '}
          <Link href="/confidentialite" className="link">
            politique de confidentialité
          </Link>
          . Vous pouvez supprimer votre compte à tout moment depuis vos paramètres.
        </p>
      </Section>

      <Section id="u10" title="Évolution de ces conditions et droit applicable">
        <p>
          Ces conditions peuvent évoluer ; la date de mise à jour figure en haut de la page. Elles sont soumises au droit sénégalais. Pour toute question, écrivez à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="link break-all">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
