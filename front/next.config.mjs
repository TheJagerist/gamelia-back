// Deux modes, choisis au moment du build (les variables NEXT_PUBLIC_ sont figées dans le code envoyé au navigateur) :
//   - site réel (par défaut)  : le front appelle l'API (NEXT_PUBLIC_API_URL) et PostgreSQL ;
//   - démonstration           : NEXT_PUBLIC_API_MOCK=true, données simulées dans le navigateur, sans serveur.
// Le site réel est le mode par défaut pour qu'un oubli de configuration ne mette jamais de fausses données en ligne :
// sans adresse d'API, le build s'arrête avec un message clair au lieu de produire un site « de démonstration ».
const mock = process.env.NEXT_PUBLIC_API_MOCK === 'true';
const building = process.argv.includes('build');
const checked = building || process.argv.includes('dev'); // pas de contrôle pour lint, start, tests

if (!mock && checked) {
  const missing = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_CONTACT_EMAIL'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `\n\n[Gamelia] Configuration incomplète : ${missing.join(', ')}.\n` +
        '  - Site réel : renseignez ces variables dans front/.env.local (modèle : .env.example), puis relancez.\n' +
        '  - Démonstration sans serveur : mettez NEXT_PUBLIC_API_MOCK=true dans front/.env.local.\n'
    );
  }
  if (process.env.NEXT_PUBLIC_SHOW_DEMO === 'true') {
    console.warn('\n[Gamelia] ATTENTION : NEXT_PUBLIC_SHOW_DEMO=true affiche les comptes de démonstration sur la page de connexion. À ne jamais utiliser pour le site en ligne.\n');
  }
} else if (mock && building) {
  console.warn('\n[Gamelia] Build en mode DÉMONSTRATION (NEXT_PUBLIC_API_MOCK=true) : données simulées, aucune base de données. À ne pas mettre en ligne comme site réel.\n');
}

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone', // servi depuis le VPS Datacloud (node .next/standalone/server.js)
  // Le site n'utilise pas l'optimisation d'images de Next.js (aucun composant next/image) : elle reste désactivée,
  // et nginx bloque en plus l'adresse /_next/image (voir back/deploy/nginx.conf.example).
  images: { unoptimized: true },
  // Toujours définies, même absentes du fichier .env : l'outil de build peut alors retirer du site réel
  // tout le code de démonstration (données simulées, comptes de démonstration).
  env: {
    NEXT_PUBLIC_API_MOCK: mock ? 'true' : 'false',
    NEXT_PUBLIC_SHOW_DEMO: process.env.NEXT_PUBLIC_SHOW_DEMO === 'true' ? 'true' : 'false',
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
