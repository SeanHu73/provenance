import type { Metadata, Viewport } from 'next';
import { Newsreader, DM_Serif_Display, Montserrat, Lato, Gelasio } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import ThemeColorMeta from '@/components/ThemeColorMeta';
import ContextOnboarding from '@/components/onboarding/ContextOnboarding';
import { ThemeProvider } from '@/context/ThemeContext';
import { RoomProvider } from '@/context/RoomContext';

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

// Display face for the actual discussion question text.
const marigoldSans = localFont({
  src: '../../public/fonts/Marigold-Sans.otf',
  variable: '--font-marigold-sans',
  display: 'swap',
});

// ---- Context Journal redesign ------------------------------------
// The redesigned type scale uses two families: Georgia for the serif
// headings and Lato for everything else. Weights cover Regular (body),
// Bold (titles, buttons) and Black (Link S).
const lato = Lato({
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-lato',
  display: 'swap',
});

// Georgia is a system font — present on Windows, macOS and iOS but not
// on Android, where the headings would otherwise fall back to Noto
// Serif and reflow. Gelasio is metric-compatible with Georgia, so it
// stands in on those devices without shifting any layout. The serif
// stack in design-tokens.css lists Georgia first, so devices that have
// it keep using the real thing.
const gelasio = Gelasio({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-gelasio',
  display: 'swap',
});

const fontVariables = [
  newsreader.variable,
  dmSerifDisplay.variable,
  montserrat.variable,
  marigoldSans.variable,
  lato.variable,
  gelasio.variable,
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
    // Plain cream startup images — suppresses iOS's default icon-on-white
    // launch screen so the installed PWA opens straight into our animated
    // splash. Sizes match modern iPhone / iPad portrait resolutions; iOS
    // falls back to its default when no media query matches.
    startupImage: [
      { url: '/splash/iphone-14promax.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/iphone-12promax.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/iphone-14pro.png',    media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/iphone-13.png',       media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/iphone-xsmax.png',    media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/iphone-x.png',        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/iphone-xr.png',       media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
      { url: '/splash/iphone-8plus.png',    media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/iphone-8.png',        media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
      { url: '/splash/ipadpro-12.png',      media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
      { url: '/splash/ipadpro-11.png',      media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
    ],
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
          <RoomProvider>
            <ContextOnboarding>{children}</ContextOnboarding>
          </RoomProvider>
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
