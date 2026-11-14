'use client';
// Structure de site web : en-tête avec navigation selon le rôle, menu déroulant sur téléphone, pied de page.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Award, BadgeCheck, Bell, Briefcase, ChevronDown, FolderGit2, HelpCircle, LogOut, Menu, MessageSquare, MessagesSquare, Moon, Plus, Search, Settings, Sparkles, Sun, User as UserIcon, X,
} from 'lucide-react';
import { MOCK, api } from '@/lib/api';
import { ROLE_HOME, ROLE_LABEL, useSession } from '@/lib/session';
import { applyTheme, currentTheme } from '@/lib/theme';
import type { Role } from '@/lib/types';
import { Avatar, Dialog, Logo, cx } from './ui';

type NavItem = { href: string; label: string; match?: string[] };

const NAV: Record<Role | 'visiteur', NavItem[]> = {
  visiteur: [
    { href: '/questions', label: 'Questions' },
    { href: '/projets', label: 'Projets' },
    { href: '/classement', label: 'Classement' },
    { href: '/aide', label: 'Comment ça marche' },
  ],
  developpeur: [
    { href: '/fil', label: 'Accueil' },
    { href: '/questions', label: 'Questions' },
    { href: '/projets', label: 'Projets' },
    { href: '/apprendre', label: 'Apprendre' },
    { href: '/defis', label: 'Défis', match: ['/opportunites'] },
    { href: '/classement', label: 'Classement' },
  ],
  recruteur: [
    { href: '/recruteur/talents', label: 'Talents' },
    { href: '/recruteur/defis', label: 'Mes défis' },
    { href: '/recruteur/candidatures', label: 'Candidatures' },
    { href: '/classement', label: 'Classement' },
  ],
  admin: [
    { href: '/admin/validations', label: 'Validations' },
    { href: '/admin/signalements', label: 'Signalements' },
    { href: '/questions', label: 'Questions' },
  ],
};

function isOn(path: string, it: NavItem) {
  if (it.href === '/') return path === '/';
  return path === it.href || path.startsWith(it.href + '/') || !!it.match?.some((m) => path === m || path.startsWith(m + '/'));
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, status } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [compose, setCompose] = useState(false);

  // Un utilisateur connecté qui ouvre l'accueil public arrive sur son espace.
  useEffect(() => {
    if (status === 'ready' && user && path === '/') router.replace(ROLE_HOME[user.role]);
  }, [status, user, path, router]);

  const full = path === '/' && !user;
  return (
    <>
      <a href="#contenu" className="sr-only z-[70] rounded bg-primary px-4 py-2 font-semibold text-primary-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Aller au contenu
      </a>
      {MOCK && (
        <p className="bg-accent-soft px-4 py-1.5 text-center text-[13px] font-semibold text-accent-ink" role="note">
          Démonstration : données simulées, rien n&apos;est enregistré sur un serveur.
        </p>
      )}
      <Header loading={status === 'loading'} onCompose={() => setCompose(true)} />
      <main id="contenu" className="min-h-[60vh]">
        {full ? children : <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">{children}</div>}
      </main>
      <Footer />
      {user?.role === 'developpeur' && <ComposeDialog open={compose} onClose={() => setCompose(false)} />}
    </>
  );
}

/* ---------- En-tête ---------- */

function Header({ loading, onCompose }: { loading: boolean; onCompose: () => void }) {
  const { user } = useSession();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const role: Role | 'visiteur' = user?.role ?? 'visiteur';
  const nav = NAV[role];
  const unread = useUnread(path, !!user);
  const unreadMessages = useUnreadMessages(path, !!user && user.role !== 'admin');

  useEffect(() => setOpen(false), [path]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:gap-6 sm:px-6 lg:gap-4">
        <Logo href={user ? ROLE_HOME[user.role] : '/'} compact />

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((it) => {
              const on = isOn(path, it);
              return (
                <li key={it.href}>
                  <Link href={it.href} aria-current={on ? 'page' : undefined} className={cx('relative flex h-16 items-center px-2.5 text-[15px] font-semibold transition-colors', on ? 'text-ink' : 'text-muted hover:text-ink')}>
                    {it.label}
                    {on && <span className="absolute inset-x-2.5 bottom-0 h-[3px] rounded-t-full bg-primary" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={cx('ml-auto flex items-center gap-0.5 transition-opacity sm:gap-1.5', loading && 'opacity-0')}>
          {user ? (
            <>
              <SearchBox className="hidden xl:block" />
              {user.role === 'developpeur' && (
                <button onClick={onCompose} className="btn btn-sm hidden sm:inline-flex lg:w-10 lg:px-0" title="Publier une question ou un projet">
                  <Plus className="h-4 w-4" aria-hidden />
                  <span className="lg:sr-only">Publier</span>
                </button>
              )}

              <Link
                href="/agnes"
                aria-current={path === '/agnes' ? 'page' : undefined}
                className={cx('hidden h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-sunken sm:inline-flex', path === '/agnes' ? 'text-ink' : 'text-muted hover:text-ink')}
                aria-label="Agnès, l'assistante IA"
                title="Agnès, l'assistante IA"
              >
                <span className={cx('inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#5b3765] to-[#9e6899] text-white', path === '/agnes' && 'ring-2 ring-accent ring-offset-2 ring-offset-bg')}>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>

              {user.role !== 'admin' && (
                <Link href="/messages" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label={unreadMessages ? `Messages, ${unreadMessages} non lu${unreadMessages > 1 ? 's' : ''}` : 'Messages'}>
                  <MessageSquare className="h-5 w-5" aria-hidden />
                  {unreadMessages > 0 && <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-[#2a1730]">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
                </Link>
              )}

              <Link href="/notifications" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}>
                <Bell className="h-5 w-5" aria-hidden />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-[#2a1730]">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <ThemeButton />
              <Link href="/connexion" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                Se connecter
              </Link>
              <Link href="/inscription" className="btn btn-sm">
                Rejoindre
              </Link>
            </>
          )}
          <button onClick={() => setOpen(!open)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-sunken lg:hidden" aria-expanded={open} aria-controls="menu-mobile" aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}>
            {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Menu sur téléphone et tablette */}
      {open && (
        <div id="menu-mobile" className="rise border-t border-line bg-surface lg:hidden">
          <div className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:px-6">
            {user && <SearchBox />}
            <ul className="grid gap-1 sm:grid-cols-2">
              {nav.map((it) => {
                const on = isOn(path, it);
                return (
                  <li key={it.href}>
                    <Link href={it.href} aria-current={on ? 'page' : undefined} className={cx('flex min-h-[48px] items-center rounded px-3 text-[16px] font-semibold', on ? 'bg-primary-soft text-primary' : 'hover:bg-sunken')}>
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {user && (
              <Link href="/agnes" className="flex min-h-[48px] items-center gap-3 rounded border border-accent/60 bg-accent-soft px-3 text-[16px] font-semibold">
                <Sparkles className="h-5 w-5 text-accent-ink" aria-hidden />
                Demander à Agnès, l&apos;assistante IA
              </Link>
            )}
            {user?.role === 'developpeur' && (
              <button onClick={onCompose} className="btn w-full sm:hidden">
                <Plus className="h-4 w-4" aria-hidden />
                Publier une question ou un projet
              </button>
            )}
            {!user && (
              <Link href="/connexion" className="btn btn-secondary w-full sm:hidden">
                Se connecter
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/* ---------- Pied de page ---------- */

function Footer() {
  const { user } = useSession();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">La plateforme africaine d&apos;échange, par et pour les développeurs. Échanger, apprendre, prouver, être repéré.</p>
        </div>
        <FooterCol
          title="Communauté"
          links={[
            ['/questions', 'Questions'],
            ['/projets', 'Projets'],
            ['/classement', 'Classement par pays'],
          ]}
        />
        <FooterCol
          title="Progresser"
          links={[
            ['/apprendre', 'Pistes d’apprentissage'],
            ['/defis', 'Défis'],
            ['/opportunites', 'Défis recruteurs'],
          ]}
        />
        <FooterCol
          title="Gamelia"
          links={[
            ['/aide', 'Comment ça marche'],
            [user ? '/agnes' : '/connexion?suite=/agnes', 'Agnès, l’assistante IA'],
            [user ? '/parametres' : '/inscription?role=recruteur', user ? 'Paramètres' : 'Espace recruteur'],
            [user ? ROLE_HOME[user.role] : '/connexion', user ? 'Mon espace' : 'Se connecter'],
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-[13px] text-muted sm:px-6">
          <p>Gamelia, Concours CADEV by Systalink, 2026.</p>
          <nav aria-label="Informations légales">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              <li>
                <Link href="/conditions" className="hover:text-ink hover:underline">
                  Conditions d&apos;utilisation
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="hover:text-ink hover:underline">
                  Confidentialité
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title}>
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <ul className="space-y-2 text-sm text-muted">
        {links.map(([href, label]) => (
          <li key={href + label}>
            <Link href={href} className="hover:text-ink hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ---------- Éléments de l'en-tête ---------- */

function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      className={cx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        const url = `/questions?q=${encodeURIComponent(q.trim())}`;
        if (path === '/questions') window.history.pushState(null, '', url);
        else router.push(url);
      }}
    >
      <label htmlFor={className ? 'recherche' : 'recherche-mobile'} className="sr-only">
        Rechercher une question
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input id={className ? 'recherche' : 'recherche-mobile'} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une question" className="field min-h-[40px] w-full rounded-full bg-sunken pl-9 text-sm xl:w-40" />
    </form>
  );
}

function UserMenu() {
  const { user, logout } = useSession();
  const router = useRouter();
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  if (!user) return null;
  return (
    <details ref={ref} className="relative">
      <summary className="flex h-11 min-w-[44px] cursor-pointer list-none items-center justify-center gap-1 rounded-full px-1 hover:bg-sunken sm:pl-1 sm:pr-2 [&::-webkit-details-marker]:hidden" aria-label="Menu du compte">
        <Avatar user={user} size="sm" />
        <ChevronDown className="hidden h-4 w-4 text-muted sm:block" aria-hidden />
      </summary>
      <div className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-line bg-surface p-2 shadow-[0_16px_40px_-16px_rgba(42,23,48,.4)]">
        <div className="flex items-center gap-3 border-b border-line px-3 pb-3 pt-2">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.role === 'developpeur' ? `${user.points.toLocaleString('fr-FR')} pts, ${user.level}` : user.role === 'recruteur' ? user.company : ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <ul className="py-1 text-[15px]">
          {user.role === 'developpeur' && (
            <>
              <MenuLink href="/profil" icon={UserIcon}>Mon profil</MenuLink>
              <MenuLink href="/progression" icon={Award}>Points et badges</MenuLink>
              <MenuLink href="/portfolio" icon={BadgeCheck}>Portfolio</MenuLink>
              <MenuLink href="/opportunites" icon={Briefcase}>Défis recruteurs</MenuLink>
              <MenuLink href={`/u/${user.username}`} icon={BadgeCheck}>Voir mon profil public</MenuLink>
            </>
          )}
          {user.role === 'recruteur' && <MenuLink href="/recruteur/compte" icon={UserIcon}>Mon compte</MenuLink>}
          <MenuLink href="/agnes" icon={Sparkles}>Agnès, l&apos;assistante IA</MenuLink>
          <MenuLink href="/parametres" icon={Settings}>Paramètres</MenuLink>
          <MenuLink href="/aide" icon={HelpCircle}>Comment ça marche</MenuLink>
          <li>
            <ThemeButton row />
          </li>
          <li className="mt-1 border-t border-line pt-1">
            <button
              className="flex min-h-[44px] w-full items-center gap-3 rounded px-3 text-left text-danger hover:bg-danger-soft"
              onClick={async () => {
                await logout();
                router.push('/');
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Se déconnecter
            </button>
          </li>
        </ul>
      </div>
    </details>
  );
}

function MenuLink({ href, icon: Icon, children }: { href: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex min-h-[44px] items-center gap-3 rounded px-3 hover:bg-sunken">
        <Icon className="h-4 w-4 text-muted" />
        {children}
      </Link>
    </li>
  );
}

export function ThemeButton({ row = false }: { row?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(currentTheme() === 'dark'), []);
  const toggle = () => {
    applyTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  };
  const Icon = dark ? Sun : Moon;
  if (row)
    return (
      <button onClick={toggle} className="flex min-h-[44px] w-full items-center gap-3 rounded px-3 text-left hover:bg-sunken">
        <Icon className="h-4 w-4 text-muted" aria-hidden />
        {dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      </button>
    );
  return (
    <button onClick={toggle} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}>
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

function ComposeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <Dialog open={open} onClose={onClose} title="Que voulez-vous publier ?">
      <div className="grid gap-3 pb-2">
        <button onClick={() => go('/questions/nouvelle')} className="flex items-start gap-4 rounded-lg border border-line p-4 text-left hover:border-primary hover:bg-primary-soft">
          <MessagesSquare className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block font-semibold">Poser une question</span>
            <span className="text-sm text-muted">Décrivez le problème, ajoutez votre code. La communauté répond.</span>
          </span>
        </button>
        <button onClick={() => go('/projets/nouveau')} className="flex items-start gap-4 rounded-lg border border-line p-4 text-left hover:border-primary hover:bg-primary-soft">
          <FolderGit2 className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block font-semibold">Publier un projet</span>
            <span className="text-sm text-muted">Montrez ce que vous avez construit, avec une courte démo vidéo.</span>
          </span>
        </button>
      </div>
    </Dialog>
  );
}

function useUnread(path: string, enabled: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return setN(0);
    let alive = true;
    api.notifications.unread().then((c) => alive && setN(c), () => undefined);
    return () => {
      alive = false;
    };
  }, [path, enabled]);
  return n;
}

function useUnreadMessages(path: string, enabled: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return setN(0);
    let alive = true;
    const load = () => api.messages.unread().then((c) => alive && setN(c), () => undefined);
    load();
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [path, enabled]);
  return n;
}
