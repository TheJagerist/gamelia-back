import Link from 'next/link';
import { Award, BookOpen, FolderGit2, Link2 } from 'lucide-react';
import type { PortfolioItem } from '@/lib/types';
import { ProofMark, cx } from './ui';

const ICON = { defi: Award, projet: FolderGit2, piste: BookOpen, lien: Link2 };

export function PortfolioList({ items, verified, empty }: { items: PortfolioItem[]; verified: boolean; empty: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">{empty}</p>;
  return (
    <ul className={cx('divide-y rounded-lg border', verified ? 'divide-primary/20 border-primary/40 bg-surface' : 'divide-line border-dashed border-line')}>
      {items.map((it) => {
        const Icon = ICON[it.kind];
        // Seuls les liens https (externes) et les chemins internes sont cliquables : jamais « javascript: » ni autre schéma.
        const external = !!it.href && /^https?:\/\//i.test(it.href);
        const internal = !!it.href && it.href.startsWith('/') && !it.href.startsWith('//');
        const title = it.href && (external || internal) ? (
          external ? (
            <a href={it.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {it.title}
            </a>
          ) : (
            <Link href={it.href} className="hover:underline">
              {it.title}
            </Link>
          )
        ) : (
          it.title
        );
        return (
          <li key={it.id} className="flex items-center gap-3 px-4 py-3.5">
            <Icon className={cx('h-5 w-5 shrink-0', verified ? 'text-primary' : 'text-muted')} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{title}</span>
              <span className="block text-[13px] text-muted">{it.detail}</span>
            </span>
            <ProofMark verified={it.verified} compact />
          </li>
        );
      })}
    </ul>
  );
}
