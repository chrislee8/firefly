import Link from 'next/link';
import { slugify } from '@/lib/slug';
import type { Category } from '@/lib/types';

const COLORS: Record<Category, string> = {
  'Model Release': '#7dd3fc',
  Funding: '#86efac',
  Regulation: '#fca5a5',
  Research: '#c4b5fd',
  Infrastructure: '#5eead4',
  Product: '#fcd34d',
  Opinion: '#f0abfc',
};

export function CategoryPill({ category, link = true }: { category: Category; link?: boolean }) {
  const color = COLORS[category] ?? 'var(--muted)';
  const inner = (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      {category}
    </span>
  );
  if (!link) return inner;
  return (
    <Link href={`/category/${slugify(category)}`} className="hover:opacity-80">
      {inner}
    </Link>
  );
}
