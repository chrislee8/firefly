import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Firefly — AI news, ranked by what matters',
  description:
    'A ranked, filterable feed of AI-industry news from primary labs, credible reporting, and research — scored by significance, not just recency.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <footer
          className="border-t px-4 py-6 text-center text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          Firefly aggregates headlines and links to original sources. All content belongs to its
          respective publishers.
        </footer>
      </body>
    </html>
  );
}
