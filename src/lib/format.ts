/** Compact "time ago" label, e.g. "3h ago", "2d ago". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Hostname of a URL, sans www (for the "read at source" label). */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Named entities that show up in RSS titles; numeric refs are handled generically.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', hellip: '…',
};

function fromCode(n: number): string {
  try {
    return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : '';
  } catch {
    return '';
  }
}

/**
 * Decode HTML entities in text pulled from feeds — titles routinely carry
 * `&#8217;`, `&amp;`, `&#x2019;`, etc., which React would otherwise print
 * literally. A few passes so double-encoded values (`&amp;#8217;`) also resolve.
 * A string with no `&` is returned unchanged.
 */
export function decodeEntities(input: string): string {
  if (!input || !input.includes('&')) return input;
  let out = input;
  for (let pass = 0; pass < 3 && out.includes('&'); pass++) {
    const next = out
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => fromCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => fromCode(parseInt(dec, 10)))
      .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? m);
    if (next === out) break;
    out = next;
  }
  return out;
}
