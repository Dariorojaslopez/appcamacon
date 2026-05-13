import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Montserrat } from 'next/font/google';
import './globals.css';

/** Manual de identidad Camacon: tipografía principal Montserrat. */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Camacon App',
  description: 'Sistema de gestión de obra para constructora, optimizado para campo y PWA.',
  themeColor: '#111485',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    shortcut: '/icons/icon-192.png',
    apple: '/icons/icon-512.png',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="es" className="app-html" nonce={nonce}>
      <body className={`app-body ${montserrat.className}`}>
        {children}
      </body>
    </html>
  );
}
