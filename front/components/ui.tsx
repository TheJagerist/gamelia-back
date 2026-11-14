'use client';
// Composants communs, créés une seule fois et réutilisés partout (cahier des charges, section 8).
import Link from 'next/link';
import { forwardRef, useEffect, useId, useRef } from 'react';
import { AlertTriangle, BadgeCheck, ChevronLeft, ChevronRight, CircleDashed, RotateCcw, X } from 'lucide-react';
import { messageFor, ApiError } from '@/lib/api';
import { initials } from '@/lib/format';
import type { Level, PublicUser } from '@/lib/types';
import type { Resource } from '@/lib/hooks';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/* ---------- Identité ---------- */

export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  // Le cercle Gamelia : des joueurs autour d'un même défi.
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: 16 + Math.cos(a) * 11.5, y: 16 + Math.sin(a) * 11.5 };
  });
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={i % 2 ? 2.2 : 2.8} fill="var(--primary)" />
      ))}
      <circle cx="16" cy="16" r="5.2" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  // compact : sur les très petits écrans (< 360 px), seul le symbole reste visible dans l'en-tête.
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2 rounded text-[1.3rem] font-bold tracking-tight text-ink" aria-label="Gamelia, accueil">
      <LogoMark />
      <span className={compact ? 'max-[359px]:hidden' : undefined}>gamelia</span>
    </Link>
  );
}

const AVATAR_TONES = ['bg-primary text-primary-ink', 'bg-accent text-[#2a1730]', 'bg-primary-soft text-primary', 'bg-accent-soft text-accent-ink'];

export function Avatar({ user, size = 'md' }: { user: Pick<PublicUser, 'name' | 'id' | 'avatarUrl'>; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const px = { sm: 28, md: 36, lg: 56, xl: 80 }[size];
  if (user.avatarUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" width={px} height={px} loading="lazy" className="shrink-0 rounded-full object-cover" style={{ width: px, height: px }} />;
  const tone = AVATAR_TONES[[...user.id].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  const sz = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' }[size];
  return (
    <span className={cx('inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold', tone, sz)} aria-hidden>
      {initials(user.name)}
    </span>
  );
}

export function UserLine({ user, extra, size = 'sm' }: { user: PublicUser; extra?: React.ReactNode; size?: 'sm' | 'md' }) {
  const href = user.role === 'developpeur' ? `/u/${user.username}` : undefined;
  const name = <span className="font-semibold text-ink">{user.name}</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-muted">
      <Avatar user={user} size={size} />
      {href ? (
        <Link href={href} className="truncate hover:underline">
          {name}
        </Link>
      ) : (
        name
      )}
      {user.githubVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Compte vérifié" />}
      {extra}
    </span>
  );
}

/* ---------- Pastilles ---------- */

export function Tag({ name, href }: { name: string; href?: string }) {
  const cls = 'inline-flex min-h-[28px] items-center rounded-full bg-sunken px-2.5 text-[13px] font-semibold text-muted';
  return href ? (
    <Link href={href} className={cx(cls, 'hover:bg-primary-soft hover:text-primary')}>
      {name}
    </Link>
  ) : (
    <span className={cls}>{name}</span>
  );
}

export function LevelPill({ level }: { level: Level }) {
  const n = level === 'Débutant' ? 1 : level === 'Intermédiaire' ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted" title={`Niveau ${level}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cx('h-2.5 w-1.5 rounded-sm', i <= n ? 'bg-primary' : 'bg-line')} />
        ))}
      </span>
      {level}
    </span>
  );
}

export function PointsChip({ points, sign = false }: { points: number; sign?: boolean }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-[13px] font-bold text-accent-ink tabular-nums">
      {sign && points > 0 ? '+' : ''}
      {points.toLocaleString('fr-FR')} pts
    </span>
  );
}

/** Signature de Gamelia : ce qui est prouvé (sceau plein) et ce qui est seulement déclaré (contour pointillé). */
export function ProofMark({ verified, compact = false }: { verified: boolean; compact?: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-ink">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      {compact ? 'Vérifié' : 'Vérifié par Gamelia'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted/60 px-2.5 py-0.5 text-[12px] font-semibold text-muted">
      <CircleDashed className="h-3.5 w-3.5" aria-hidden />
      Déclaré
    </span>
  );
}

export function StatusPill({ tone, children }: { tone: 'neutral' | 'primary' | 'accent' | 'success' | 'danger'; children: React.ReactNode }) {
  const t = {
    neutral: 'bg-sunken text-muted',
    primary: 'bg-primary-soft text-primary',
    accent: 'bg-accent-soft text-accent-ink',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
  }[tone];
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold', t)}>{children}</span>;
}

/* ---------- Mise en page ---------- */

export function PageHeader({ title, description, actions, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex min-h-[36px] items-center gap-1 rounded text-sm font-semibold text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] sm:text-[2rem]">{title}</h1>
          {description && <p className="mt-1.5 max-w-prose text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SubNav({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <nav aria-label="Sous-navigation" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {items.map((it) => {
          const on = current === it.href || current.startsWith(it.href + '/');
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={on ? 'page' : undefined}
                className={cx('-mb-px inline-flex min-h-[44px] items-center border-b-[3px] px-3 text-[15px] font-semibold', on ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink')}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function FilterChips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex min-h-[40px] shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
              on ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-muted hover:border-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Les trois états ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="panel space-y-3 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  return (
    <div role="alert" className="panel flex flex-col items-start gap-3 border-danger/30 bg-danger-soft/40 p-5">
      <div className="flex items-center gap-2 font-semibold text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden />
        {status === 404 ? 'Contenu introuvable' : status === 401 ? 'Connexion nécessaire' : 'Chargement impossible'}
      </div>
      <p className="text-sm">{messageFor(error)}</p>
      <div className="flex gap-2">
        {status === 401 ? (
          <Link href="/connexion" className="btn btn-sm">
            Se connecter
          </Link>
        ) : status === 404 ? (
          <Link href="/" className="btn btn-secondary btn-sm">
            Revenir à l&apos;accueil
          </Link>
        ) : (
          onRetry && (
            <button className="btn btn-sm" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Réessayer
            </button>
          )
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <div className="mb-3 text-muted">{icon ?? <LogoMark className="h-10 w-10 opacity-60" />}</div>
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Affiche chargement, erreur ou vide, puis les données. */
export function Async<T>({ res, skeleton, isEmpty, empty, children }: { res: Resource<T>; skeleton?: React.ReactNode; isEmpty?: (d: T) => boolean; empty?: React.ReactNode; children: (d: T) => React.ReactNode }) {
  if (res.loading && res.data === undefined) return <>{skeleton ?? <ListSkeleton />}</>;
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (res.data === undefined) return null;
  if (isEmpty?.(res.data)) return <>{empty ?? <EmptyState title="Rien à afficher pour l'instant." />}</>;
  return <div className={cx(res.loading && 'opacity-60 transition-opacity')}>{children(res.data)}</div>;
}

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Précédente
      </button>
      <span className="text-sm text-muted tabular-nums">
        Page {page} sur {pageCount}
      </span>
      <button className="btn btn-secondary btn-sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Suivante
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}

/* ---------- Formulaires ---------- */

type FieldProps = { label: string; hint?: string; error?: string; optional?: boolean };

export const TextField = forwardRef<HTMLInputElement, FieldProps & React.InputHTMLAttributes<HTMLInputElement>>(function TextField({ label, hint, error, optional, className, ...rest }, ref) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label} {optional && <span className="font-normal text-muted">(facultatif)</span>}
      </label>
      <input ref={ref} id={id} className="field" aria-invalid={!!error} aria-describedby={hint || error ? `${id}-h` : undefined} {...rest} />
      <FieldHelp id={`${id}-h`} hint={hint} error={error} />
    </div>
  );
});

export function TextArea({ label, hint, error, optional, className, counter, ...rest }: FieldProps & { counter?: number } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const len = typeof rest.value === 'string' ? rest.value.length : 0;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label} {optional && <span className="font-normal text-muted">(facultatif)</span>}
      </label>
      <textarea id={id} className="field min-h-[120px] resize-y leading-relaxed" aria-invalid={!!error} aria-describedby={`${id}-h`} {...rest} />
      <div className="flex justify-between gap-3">
        <FieldHelp id={`${id}-h`} hint={hint} error={error} />
        {counter && <span className={cx('mt-1 text-xs tabular-nums', len > counter ? 'text-danger' : 'text-muted')}>{len}/{counter}</span>}
      </div>
    </div>
  );
}

export function SelectField({ label, hint, error, optional, className, children, ...rest }: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label} {optional && <span className="font-normal text-muted">(facultatif)</span>}
      </label>
      <select id={id} className="field appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234e5574' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} aria-invalid={!!error} {...rest}>
        {children}
      </select>
      <FieldHelp id={`${id}-h`} hint={hint} error={error} />
    </div>
  );
}

function FieldHelp({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error)
    return (
      <p id={id} className="mt-1 text-sm font-semibold text-danger">
        {error}
      </p>
    );
  if (hint)
    return (
      <p id={id} className="mt-1 text-sm text-muted">
        {hint}
      </p>
    );
  return null;
}

/** Choix multiple de tags, accessible au clavier. */
export function TagPicker({ label, options, value, onChange, max = 4, error, hint }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; max?: number; error?: string; hint?: string }) {
  const id = useId();
  return (
    <fieldset aria-describedby={`${id}-h`}>
      <legend className="field-label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((t) => {
          const on = value.includes(t);
          const disabled = !on && value.length >= max;
          return (
            <button
              type="button"
              key={t}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])}
              className={cx(
                'inline-flex min-h-[36px] items-center rounded-full border px-3 text-sm font-semibold transition-colors disabled:opacity-40',
                on ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface text-muted hover:border-primary hover:text-primary',
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
      <FieldHelp id={`${id}-h`} hint={hint ?? `Jusqu'à ${max}.`} error={error} />
    </fieldset>
  );
}

/* ---------- Fenêtre modale (dialog natif : piège du focus et touche Échap inclus) ---------- */

export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto w-full max-w-none rounded-t-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-[#1a1020]/50 sm:m-auto sm:max-w-lg sm:rounded-xl"
      aria-labelledby="dlg-title"
    >
      {open && (
        <div className="rise">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id="dlg-title" className="text-lg">
              {title}
            </h2>
            <button onClick={onClose} className="-m-2 inline-flex h-11 w-11 items-center justify-center rounded text-muted hover:bg-sunken hover:text-ink" aria-label="Fermer">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  // Un lien fourni par un membre n'est rendu cliquable que s'il est en http(s) : jamais « javascript: » ni autre schéma.
  if (!/^https?:\/\//i.test(href)) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function Stars({ value, onChange, label = 'Note' }: { value: number; onChange?: (v: number) => void; label?: string }) {
  if (!onChange)
    return (
      <span className="text-accent" aria-label={`${value} sur 5`}>
        {'★'.repeat(value)}
        <span className="text-line">{'★'.repeat(5 - value)}</span>
      </span>
    );
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sur 5`}
          onClick={() => onChange(n)}
          className={cx('inline-flex h-11 w-11 items-center justify-center rounded text-2xl', n <= value ? 'text-accent' : 'text-line hover:text-accent/60')}
        >
          ★
        </button>
      ))}
    </div>
  );
}
