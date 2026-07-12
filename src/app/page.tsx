import { getNightSkyItems, type FireflyItem } from '@/lib/nightsky';
import { NightSky } from '@/components/nightsky/NightSky';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let items: FireflyItem[] = [];
  try {
    items = await getNightSkyItems();
  } catch {
    items = [];
  }
  return <NightSky items={items} />;
}
