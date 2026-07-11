import { Header } from '@/components/Header';

/** Chrome for the reading views (list, article, source, category). */
export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <footer
        className="border-t px-4 py-6 text-center text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        Firefly aggregates headlines and links to original sources. All content belongs to its
        respective publishers.
      </footer>
    </div>
  );
}
