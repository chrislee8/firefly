/** Impact score 0–100 as a glowing amber ring. Brightness scales with score. */
export function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const s = Math.round(score);
  const intensity = Math.min(1, Math.max(0.15, s / 100));
  const dims =
    size === 'lg'
      ? { box: 60, font: 20 }
      : size === 'sm'
        ? { box: 34, font: 12 }
        : { box: 46, font: 16 };

  return (
    <div
      className="relative flex items-center justify-center rounded-full font-mono font-semibold shrink-0"
      style={{
        width: dims.box,
        height: dims.box,
        fontSize: dims.font,
        color: 'var(--glow)',
        border: '1.5px solid var(--glow)',
        background: `radial-gradient(circle at center, rgba(255,200,87,${0.16 * intensity}), transparent 70%)`,
        boxShadow: `0 0 ${10 * intensity}px rgba(255,200,87,${0.5 * intensity})`,
      }}
      title={`Impact score: ${s}/100`}
      aria-label={`Impact score ${s} of 100`}
    >
      {s}
    </div>
  );
}
