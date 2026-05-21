import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import { ThemeProvider } from '@/context/ThemeContext';

export const metadata: Metadata = {
  title: 'Memorial Church — Provenance',
  description: 'A place-based learning tool for Stanford Memorial Church. Look carefully. Discuss what you see.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8B2538',
};

// Applies the stored theme to <html> before first paint so there is
// no flash of the default theme for users who picked the other one.
const themeInitScript = `(function(){try{var t=localStorage.getItem('provenance-theme');document.documentElement.dataset.theme=(t==='folio')?'folio':'ledger';}catch(e){document.documentElement.dataset.theme='ledger';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" data-theme="ledger">
      <body className="h-full">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          {children}
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
