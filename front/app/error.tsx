'use client';
import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md py-16 text-center" role="alert">
      <h1 className="text-2xl">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="mt-2 text-muted">Un problème inattendu est survenu. Réessayez ; s&apos;il persiste, signalez-le à l&apos;équipe Gamelia.</p>
      <button onClick={reset} className="btn mt-6">
        <RotateCcw className="h-4 w-4" aria-hidden />
        Réessayer
      </button>
    </div>
  );
}
