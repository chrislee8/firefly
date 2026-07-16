import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { JobRunner } from '@/components/admin/JobRunner';
import { SourceManager } from '@/components/admin/SourceManager';
import type { Source } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminSourcesPage() {
  // Auth gate belongs HERE, not only in the layout: Next renders page children
  // first and passes them to the layout, so a layout-only check still lets this
  // component run its service-role query and serialize the rows into the RSC
  // payload sent to logged-out visitors. Bail before touching the database.
  if (!(await getUser())) return null; // layout renders <LoginForm /> instead

  const db = createServiceClient();
  const { data } = await db.from('sources').select('*').order('tier').order('name');
  const sources = (data ?? []) as Source[];

  const errored = sources.filter((s) => s.last_fetch_status === 'error');

  return (
    <div className="space-y-5">
      <JobRunner />
      {errored.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: 'rgba(252,165,165,0.08)', borderColor: '#fca5a555', color: '#fca5a5' }}
        >
          ⚠ {errored.length} source(s) failed their last fetch: {errored.map((s) => s.name).join(', ')}
        </div>
      )}
      <SourceManager initial={sources} />
    </div>
  );
}
