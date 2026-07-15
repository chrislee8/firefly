import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono, Barlow_Condensed } from 'next/font/google';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import './globals.css';

const display = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});
const mono = IBM_Plex_Mono({
  variable: '--font-plex',
  subsets: ['latin'],
  weight: ['400', '500'],
});
// thin, tall, condensed — architectural-line feel for the ambient date reel
const reel = Barlow_Condensed({
  variable: '--font-reel',
  subsets: ['latin'],
  weight: ['200', '300'],
});

// Public analytics IDs. Set NEXT_PUBLIC_GA_ID (G-XXXXXXXXXX) and/or
// NEXT_PUBLIC_GTM_ID (GTM-XXXXXXX) in Vercel + .env.local to enable.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export const metadata: Metadata = {
  title: 'Firefly — AI news, ranked by what matters',
  description:
    'An ambient, ranked feed of AI-industry news from primary labs, credible reporting, and research — scored by significance, not just recency.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${reel.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
        {GTM_ID ? <GoogleTagManager gtmId={GTM_ID} /> : null}
      </body>
    </html>
  );
}
