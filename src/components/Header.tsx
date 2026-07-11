import Link from 'next/link';

export function Header() {
  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur-md"
      style={{ background: 'rgba(10,11,15,0.8)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl leading-none glow-text" aria-hidden>
            ✦
          </span>
          <span className="text-lg font-bold tracking-tight">
            Fire<span className="glow-text">fly</span>
          </span>
          <span className="ml-1 hidden text-xs sm:inline" style={{ color: 'var(--muted)' }}>
            AI news, ranked by what matters
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm" style={{ color: 'var(--muted)' }}>
          <Link href="/" className="hover:text-foreground">
            Feed
          </Link>
          <Link href="/?sort=latest" className="hover:text-foreground">
            Latest
          </Link>
        </nav>
      </div>
    </header>
  );
}
