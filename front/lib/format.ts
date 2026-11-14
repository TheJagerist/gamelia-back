// Utilitaires d'affichage (français). Les chaînes sont regroupées pour faciliter l'ajout de l'anglais.

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

export function timeAgo(iso: string): string {
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function dateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function daysLeft(iso: string): string {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86400000);
  if (days < 0) return 'Clôturé';
  if (days === 0) return "Se termine aujourd'hui";
  return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
}

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString('fr-FR')} ${n > 1 ? many : one}`;
export const fmt = (n: number) => n.toLocaleString('fr-FR');

export function initials(name: string) {
  return name
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
