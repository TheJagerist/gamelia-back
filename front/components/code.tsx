'use client';
import dynamic from 'next/dynamic';

// Chargement différé : la bibliothèque de coloration n'est téléchargée que si du code est affiché.
export const Code = dynamic(() => import('./code-block'), {
  ssr: false,
  loading: () => <div className="skeleton my-3 h-28 w-full" aria-hidden />,
});
