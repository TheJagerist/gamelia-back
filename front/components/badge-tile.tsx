import type { Badge } from '@/lib/types';
import { cx } from './ui';

export function BadgeTile({ b, locked = false }: { b: Badge; locked?: boolean }) {
  return (
    <li className={cx('flex items-center gap-3 rounded-lg border p-3', locked ? 'border-dashed border-line' : 'border-line bg-surface')}>
      <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold', locked ? 'bg-sunken text-muted' : 'bg-accent text-[#2a1730]')} aria-hidden>
        {b.glyph}
      </span>
      <span className="min-w-0">
        <span className={cx('block font-semibold', locked && 'text-muted')}>{b.name}</span>
        <span className="block text-[13px] text-muted">{b.description}</span>
      </span>
      {locked && <span className="sr-only">(pas encore obtenu)</span>}
    </li>
  );
}
