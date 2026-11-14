'use client';
import { usePathname } from 'next/navigation';
import { SubNav } from './ui';

export function LearnNav() {
  const path = usePathname();
  return (
    <SubNav
      current={path}
      items={[
        { href: '/defis', label: 'Défis techniques' },
        { href: '/apprendre', label: 'Pistes d’apprentissage' },
        { href: '/opportunites', label: 'Défis recruteurs' },
      ]}
    />
  );
}
