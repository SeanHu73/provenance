import type { Metadata, Viewport } from 'next';
import { Newsreader, DM_Serif_Display } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import { ThemeProvider } from '@/context/ThemeContext';

// Shared content/body font — used for all reading text in both themes.
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

// Title font — used by both themes.
const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm-serif-display',
  display: 'swap',
});

const fontVariables = [
  newsreader.variable,
  dmSerifDisplay.variable,
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
