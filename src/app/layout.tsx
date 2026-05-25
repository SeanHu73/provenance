import type { Metadata, Viewport } from 'next';
import { Newsreader, DM_Serif_Display, Montserrat } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import ThemeColorMeta from '@/components/ThemeColorMeta';
import SplashScreen from '@/components/SplashScreen';
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

// Wordmark font for the splash screen.
const montserrat = Montserrat({
  weight: '500',
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const fontVariables = [
  newsreader.variable,
  dmSerifDisplay.variable,
  montserrat.variable,
].join(' ');

export const metadata: Metadata = {
  title: 'Provenance',
  description: 'A place-based learning experience. Look carefully. Discuss what you see.',
  manifest: '/manifest.json',
  applicationName: 'Provenance',
  // Name shown under the icon when added to the iOS home screen.
  appleWebApp: {
    capable: true,
    title: 'Provenance',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
          <ThemeColorMeta />
          <SplashScreen>{children}</SplashScreen>
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
