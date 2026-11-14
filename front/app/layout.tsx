import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { Providers } from '@/components/providers';
import './globals.css';

// Une seule police (Bricolage Grotesque, licence SIL OFL), servie depuis notre serveur, graisses 400 à 700.
const gamelia = localFont({
  src: './fonts/bricolage.woff2',
  variable: '--font-gamelia',
  weight: '400 700',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Gamelia, la plateforme africaine des développeurs', template: '%s | Gamelia' },
  description: 'Posez vos questions, apprenez, prouvez vos compétences par des défis et des projets réels, et faites-vous repérer par des recruteurs.',
  applicationName: 'Gamelia',
  icons: { icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }, { url: '/icons/icon-192.png', sizes: '192x192' }], apple: '/icons/icon-192.png' },
  openGraph: { title: 'Gamelia', description: 'Échanger, apprendre, prouver, être repéré.', type: 'website', locale: 'fr_FR' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf6f9' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1020' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={gamelia.variable} suppressHydrationWarning>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
