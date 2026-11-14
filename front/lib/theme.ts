'use client';
// Thème clair, sombre ou celui du système : préférence mémorisée dans le navigateur.
export type Theme = 'light' | 'dark';
export type ThemePref = 'systeme' | 'clair' | 'sombre';
const KEY = 'gamelia-theme';

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    window.localStorage.setItem(KEY, t);
  } catch {
    /* ignoré */
  }
}

export function themePref(): ThemePref {
  try {
    const t = window.localStorage.getItem(KEY);
    return t === 'dark' ? 'sombre' : t === 'light' ? 'clair' : 'systeme';
  } catch {
    return 'systeme';
  }
}

export function applyThemePref(p: ThemePref) {
  if (p === 'systeme') {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignoré */
    }
    document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else applyTheme(p === 'sombre' ? 'dark' : 'light');
}
