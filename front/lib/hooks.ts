'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export type Resource<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
  mutate: (fn: (d: T) => T) => void;
};

/** Charge une ressource et expose les trois états : chargement, erreur, données. */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[], enabled = true): Resource<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const ref = useRef(fetcher);
  ref.current = fetcher;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    setError(undefined);
    ref.current().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setLoading(false);
      },
      (e) => {
        if (!alive) return;
        setError(e);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const mutate = useCallback((fn: (d: T) => T) => setData((d) => (d === undefined ? d : fn(d))), []);
  return { data, error, loading, reload, mutate };
}

/** Brouillon enregistré automatiquement dans le navigateur (aucune donnée sensible). */
export function useDraft<T extends object>(key: string, initial: T) {
  const storageKey = `gamelia-brouillon:${key}`;
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        setValue({ ...initial, ...JSON.parse(raw) });
        setRestored(true);
      }
    } catch {
      /* ignoré */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const empty = JSON.stringify(value) === JSON.stringify(initial);
        if (empty) window.localStorage.removeItem(storageKey);
        else {
          window.localStorage.setItem(storageKey, JSON.stringify(value));
          setSavedAt(new Date());
        }
      } catch {
        /* ignoré */
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, storageKey]);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignoré */
    }
    setValue(initial);
    setRestored(false);
    setSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  return { value, setValue, restored, savedAt, clear };
}

/** Lit et écrit les filtres dans l'adresse : la page reste partageable et « Retour » fonctionne.
 *  (Next.js 14.1+ synchronise history.pushState/replaceState avec useSearchParams.) */
export function useQueryState() {
  const sp = useSearchParams();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const get = useCallback((k: string) => sp.get(k), [sp]);
  const set = useCallback(
    (patch: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === '') next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    },
    [sp],
  );
  return { ready, get, set };
}

