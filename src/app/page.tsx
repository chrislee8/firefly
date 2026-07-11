import { getSwarmItems, type FireflyItem } from '@/lib/swarm';
import { Swarm } from '@/components/swarm/Swarm';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let items: FireflyItem[] = [];
  try {
    items = await getSwarmItems();
  } catch {
    items = [];
  }
  return <Swarm items={items} />;
}
