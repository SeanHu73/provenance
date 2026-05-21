import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Outfit, Cormorant_Garamond, Space_Grotesk } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import { ThemeProvider } from '@/context/ThemeContext';

// Red theme fonts
const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm-serif-display',
  display: 'swap',
});
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

// Teal theme fonts
const cormorantGaramond = Cormorant_Garamond({
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-cormorant-garamond',
  display: 'swap',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const fontVariables = [
  dmSerifDisplay.variable,
  outfit.variable,
  cormorantGaramond.variable,
  spaceGrotesk.variable,
].join(' ');

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
const themeInitScript = `(function(){try{var t=localStorage.getItem('provenance-theme');document.documentElement.dataset.theme=(t==='teal')?'teal':'red';}catch(e){document.documentElement.dataset.theme='red';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${fontVariables}`} data-theme="red">
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
