import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/site';

export const metadata: Metadata = { title: 'Confidentialité', description: 'Quelles données Gamelia enregistre, pourquoi, pendant combien de temps, et comment les faire supprimer.' };

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

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-[46rem]">
      <h1 className="text-[2rem]">Politique de confidentialité</h1>
      <p className="mt-2 text-lg text-muted">Ce que Gamelia enregistre sur vous, pourquoi, et comment garder la main dessus.</p>
      <p className="mt-2 text-sm text-muted">Dernière mise à jour : {LEGAL_UPDATED}.</p>

      <Section id="c1" title="Qui est responsable de vos données">
        <p>
          Gamelia est un projet présenté au Concours CADEV by Systalink, édition 2026. Les données sont traitées par l&apos;équipe Gamelia, que vous pouvez joindre à l&apos;adresse{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="link break-all">
            {CONTACT_EMAIL}
          </a>
          . Le traitement respecte la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel.
        </p>
      </Section>

      <Section id="c2" title="Les données enregistrées">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Votre compte :</strong> nom, adresse e-mail, pays, mot de passe (enregistré sous forme chiffrée, illisible même pour l&apos;équipe), rôle, et pour un recruteur le nom de l&apos;entreprise.
          </li>
          <li>
            <strong>Votre profil, si vous le remplissez :</strong> ville, présentation, photo (un lien), compétences, liens, nom d&apos;utilisateur GitHub si vous faites vérifier votre compte.
          </li>
          <li>
            <strong>Ce que vous publiez :</strong> questions, réponses, commentaires, votes, projets, revues, solutions aux défis, candidatures, signalements.
          </li>
          <li>
            <strong>Vos messages privés :</strong> ils sont enregistrés pour être remis à votre correspondant. L&apos;équipe ne les consulte pas, sauf signalement ou obligation légale.
          </li>
          <li>
            <strong>Votre activité sur le site :</strong> points, badges, leçons et défis réussis, notifications, date d&apos;inscription, date d&apos;acceptation des conditions.
          </li>
          <li>
            <strong>Votre connexion :</strong> un identifiant de session et le type de navigateur utilisé, pour vous garder connecté.
          </li>
        </ul>
        <p>Gamelia ne demande ni numéro de téléphone, ni adresse postale, ni pièce d&apos;identité, ni moyen de paiement.</p>
      </Section>

      <Section id="c3" title="À quoi elles servent">
        <p>
          Uniquement à faire fonctionner le site : vous connecter, afficher vos publications et votre profil, calculer vos points et le classement, remettre vos messages, permettre aux recruteurs validés de
          trouver des profils, et modérer les contenus signalés. Vos données ne sont ni vendues, ni utilisées pour de la publicité. Le site n&apos;envoie pas d&apos;e-mail : votre adresse sert seulement
          d&apos;identifiant de connexion et permet à l&apos;équipe de vous répondre si vous lui écrivez.
        </p>
      </Section>

      <Section id="c4" title="Ce qui est public">
        <p>
          Vos questions, réponses, projets, votre nom, votre pays, vos points et vos badges sont visibles par tous les visiteurs. Votre adresse e-mail n&apos;est jamais affichée. Dans{' '}
          <Link href="/parametres#confidentialite" className="link">
            Paramètres, Confidentialité
          </Link>
          , vous pouvez réserver votre profil aux membres connectés, masquer votre ville et ne plus apparaître dans la recherche des recruteurs.
        </p>
      </Section>

      <Section id="c5" title="Les services extérieurs">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Agnès, l&apos;assistante IA :</strong> quand vous lui posez une question ou demandez une piste sur une question du forum, le texte concerné est envoyé au service Agnes AI, qui produit la
            réponse. Votre nom et votre adresse e-mail ne sont pas transmis. N&apos;écrivez pas de mot de passe ni de donnée personnelle dans vos demandes. Vos discussions privées avec Agnès restent dans
            votre navigateur ; les pistes qu&apos;elle propose sur une question du forum sont enregistrées et visibles par tous.
          </li>
          <li>
            <strong>GitHub :</strong> si vous faites vérifier votre compte, Gamelia lit la présentation publique du compte GitHub que vous indiquez. Si vous choisissez « Continuer avec GitHub », GitHub transmet à Gamelia votre identifiant GitHub, votre nom d&apos;utilisateur, votre nom et votre adresse e-mail vérifiée, et rien d&apos;autre : Gamelia n&apos;accède ni à vos dépôts ni à votre mot de passe GitHub, et ne garde pas le jeton de connexion.
          </li>
          <li>
            <strong>Google :</strong> si vous choisissez « Continuer avec Google », Google transmet à Gamelia un identifiant propre à votre compte Google, votre nom et votre adresse e-mail (seulement si Google l&apos;a vérifiée), et rien d&apos;autre : Gamelia n&apos;accède ni à votre messagerie Gmail, ni à vos fichiers, ni à votre mot de passe Google, et ne garde pas le jeton de connexion.
          </li>
          <li>
            <strong>Envoi d&apos;e-mails :</strong> pour vous écrire (bienvenue, validation d&apos;un compte recruteur, réinitialisation du mot de passe), Gamelia transmet votre nom et votre adresse e-mail à un prestataire d&apos;envoi d&apos;e-mails, qui ne s&apos;en sert que pour les acheminer. Ces messages ne contiennent ni publicité ni information sur vos contenus.
          </li>
          <li>
            <strong>YouTube et Vimeo :</strong> les vidéos de démonstration ne se chargent que si vous cliquez pour les lire. Ces services reçoivent alors votre adresse IP, selon leurs propres règles.
          </li>
          <li>
            <strong>Hébergement :</strong> le site et sa base de données sont hébergés sur un serveur cloud de la plateforme Datacloud (Systalink).
          </li>
        </ul>
      </Section>

      <Section id="c6" title="Cookies et stockage dans le navigateur">
        <p>
          Gamelia utilise deux cookies, indispensables au fonctionnement : un cookie de session pour vous garder connecté (30 jours au maximum) et un cookie de sécurité qui protège vos actions contre les
          sites malveillants. Votre navigateur garde aussi votre choix de thème et vos brouillons. Il n&apos;y a aucun cookie publicitaire ni outil de mesure d&apos;audience.
        </p>
      </Section>

      <Section id="c7" title="Durée de conservation">
        <p>
          Vos données sont conservées tant que votre compte existe. Les sessions expirées sont effacées automatiquement. Quand vous supprimez votre compte, votre profil, vos publications, vos messages et
          vos points sont effacés de la base de données ; des copies peuvent subsister quelques jours dans les sauvegardes du serveur.
        </p>
      </Section>

      <Section id="c8" title="Vos droits">
        <p>Vous pouvez à tout moment :</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            consulter et corriger vos informations dans{' '}
            <Link href="/profil" className="link">
              votre profil
            </Link>{' '}
            et vos{' '}
            <Link href="/parametres" className="link">
              paramètres
            </Link>{' '}
            ;
          </li>
          <li>
            supprimer votre compte et vos données depuis{' '}
            <Link href="/parametres#suppression" className="link">
              Paramètres, Supprimer le compte
            </Link>{' '}
            ;
          </li>
          <li>
            demander une copie de vos données, vous opposer à un traitement ou poser une question en écrivant à{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="link break-all">
              {CONTACT_EMAIL}
            </a>
            .
          </li>
        </ul>
        <p>Si la réponse ne vous satisfait pas, vous pouvez saisir la Commission de protection des données personnelles (CDP) du Sénégal.</p>
      </Section>

      <Section id="c9" title="Sécurité">
        <p>
          Les échanges avec le site sont chiffrés (HTTPS). Les mots de passe sont enregistrés sous forme chiffrée. La base de données n&apos;est pas accessible depuis Internet. Aucun système n&apos;est
          infaillible : choisissez un mot de passe que vous n&apos;utilisez nulle part ailleurs.
        </p>
      </Section>

      <p className="mt-10 text-sm text-muted">
        Voir aussi les{' '}
        <Link href="/conditions" className="link">
          conditions d&apos;utilisation
        </Link>
        .
      </p>
    </div>
  );
}
