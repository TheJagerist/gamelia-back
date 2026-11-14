import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Espaces réservés aux membres connectés : rien à indexer.
        disallow: ['/admin', '/recruteur', '/profil', '/parametres', '/messages', '/notifications', '/agnes', '/fil', '/portfolio', '/progression'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
