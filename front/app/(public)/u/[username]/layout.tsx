import type { Metadata } from 'next';

export function generateMetadata({ params }: { params: { username: string } }): Metadata {
  return { title: `Profil de ${params.username}`, description: 'Profil public vérifiable sur Gamelia : éléments vérifiés et déclarés séparés.' };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
