import type { MetadataRoute } from 'next';

// Pages publiques stables. Les questions, projets et profils sont découverts par les liens internes.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return ['', '/questions', '/projets', '/classement', '/aide', '/conditions', '/confidentialite'].map((path) => ({ url: `${base}${path}` }));
}
