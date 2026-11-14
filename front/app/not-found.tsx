import Link from 'next/link';
import { LogoMark } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <LogoMark className="mx-auto h-12 w-12" />
      <h1 className="mt-4 text-2xl">Page introuvable</h1>
      <p className="mt-2 text-muted">Le lien est peut-être incorrect, ou le contenu a été retiré.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className="btn">Revenir à l&apos;accueil</Link>
        <Link href="/questions" className="btn btn-secondary">Voir les questions</Link>
      </div>
    </div>
  );
}
