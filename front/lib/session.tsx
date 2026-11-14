'use client';
// Session côté interface. Le serveur reste l'autorité : masquer un menu ne remplace pas les contrôles de l'API.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import type { Role, User } from './types';

type SessionCtx = {
  user: User | null;
  status: 'loading' | 'ready';
  /** Vrai juste après une déconnexion volontaire : les pages protégées renvoient alors à l'accueil, sans message. */
  loggedOut: boolean;
  setUser: (u: User | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [loggedOut, setLoggedOut] = useState(false);
  const setUserAndFlag = useCallback((u: User | null) => {
    if (u) setLoggedOut(false);
    setUser(u);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.auth.me());
    } catch {
      setUser(null);
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => undefined);
    setLoggedOut(true);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, status, loggedOut, setUser: setUserAndFlag, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession doit être utilisé dans SessionProvider');
  return c;
}

export const ROLE_HOME: Record<Role, string> = {
  developpeur: '/fil',
  recruteur: '/recruteur/talents',
  admin: '/admin/validations',
};

export const ROLE_LABEL: Record<Role, string> = {
  developpeur: 'Développeur',
  recruteur: 'Recruteur',
  admin: 'Administrateur',
};
