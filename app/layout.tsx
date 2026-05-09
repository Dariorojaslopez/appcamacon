import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Camacon App',
  description: 'Sistema de gestión de obra para constructora, optimizado para campo y PWA.',
  themeColor: '#1F2937',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="app-html">
      <body className="app-body">
        {children}
      </body>
    </html>
  );
}
