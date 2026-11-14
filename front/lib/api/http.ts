// Client HTTP unique. La session est un cookie httpOnly posé par l'API : aucun jeton n'est stocké dans le navigateur.
import { ApiError, ERROR_MESSAGES } from './errors';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';
const TIMEOUT_MS = 15000;

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(name + '='))
    ?.split('=')[1];
}

type Query = Record<string, string | number | boolean | undefined>;

export async function http<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, query?: Query): Promise<T> {
  const url = new URL(BASE + path, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Jeton CSRF (double cookie) : lu dans un cookie non httpOnly posé par l'API, renvoyé dans un en-tête.
  const csrf = readCookie('gamelia_csrf');
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = decodeURIComponent(csrf);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, ERROR_MESSAGES[0]);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* corps vide */
  }
  if (!res.ok) {
    const e = (data || {}) as { message?: string; code?: string; fields?: Record<string, string> };
    // Le serveur écrit des messages en français pour ces statuts (validation, droits, limites, Agnès) :
    // on les affiche tels quels ; sinon message générique traduit.
    const msg = [400, 403, 409, 429, 502, 503].includes(res.status) ? e.message : undefined;
    throw new ApiError(res.status, msg, e.code, e.fields);
  }
  return data as T;
}
