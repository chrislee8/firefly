import { getNightSkyItems, getSkyMonthRange, type FireflyItem } from '@/lib/nightsky';
import { NightSky } from '@/components/nightsky/NightSky';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: raw } = await searchParams;
  const range = await getSkyMonthRange();

  // A valid ?month within range selects that month; otherwise default to latest.
  const requested =
    raw && MONTH_RE.test(raw) && range && raw >= range.min && raw <= range.max ? raw : undefined;
  const selectedMonth = requested ?? range?.max;

  // The latest month is the recency-ranked "now" view (no month arg); older
  // months load that month's archive, ranked by significance.
  const isPast = !!(requested && range && requested < range.max);

  let items: FireflyItem[] = [];
  try {
    items = await getNightSkyItems(isPast ? requested : undefined);
  } catch {
    items = [];
  }

  return <NightSky items={items} monthRange={range ?? undefined} selectedMonth={selectedMonth} />;
}
