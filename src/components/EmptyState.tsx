export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      className="rounded-xl border border-dashed px-6 py-16 text-center"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mb-3 text-3xl glow-text" aria-hidden>
        ✦
      </div>
      <p className="font-medium">{title}</p>
      {hint && (
        <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'var(--muted)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
