import type { ReactElement } from 'react';

// The firefly mark (same art as the favicon), as an SVG data URI for next/og.
// viewBox padded beyond 0–128 so the bloom fades to zero *inside* the canvas —
// otherwise its soft edge gets clipped to a faint square on a near-black card.
const FIREFLY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="-24 -24 176 176">
<defs>
<radialGradient id="b" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 74) scale(54)">
<stop stop-color="#ffb267" stop-opacity="0.55"/><stop offset="0.4" stop-color="#ff8f3c" stop-opacity="0.18"/><stop offset="1" stop-color="#ff8f3c" stop-opacity="0"/>
</radialGradient>
<radialGradient id="l" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 84) scale(22)">
<stop stop-color="#fff4d6"/><stop offset="0.4" stop-color="#ffb35a"/><stop offset="0.62" stop-color="#ec6a1f" stop-opacity="0.9"/><stop offset="1" stop-color="#e0601a" stop-opacity="0"/>
</radialGradient>
<radialGradient id="t" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 50) scale(8 14)">
<stop stop-color="#ffc078" stop-opacity="0.8"/><stop offset="0.7" stop-color="#ffc078" stop-opacity="0.55"/><stop offset="1" stop-color="#ffc078" stop-opacity="0"/>
</radialGradient>
</defs>
<g transform="translate(64 66) scale(1.5) translate(-64 -74)">
<circle cx="64" cy="74" r="54" fill="url(#b)"/>
<ellipse cx="48" cy="58" rx="11" ry="19" transform="rotate(-28.6 48 58)" fill="#ffdcae" opacity="0.4"/>
<ellipse cx="80" cy="58" rx="11" ry="19" transform="rotate(28.6 80 58)" fill="#ffdcae" opacity="0.4"/>
<ellipse cx="64" cy="50" rx="8" ry="14" fill="url(#t)"/>
<ellipse cx="64" cy="84" rx="15" ry="20" fill="url(#l)"/>
</g></svg>`;

export const FIREFLY_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(FIREFLY_SVG)}`;

// Warm firefly palette (mirrors the night sky's rank colours: gold → orange → red).
const WARM: Array<[number, number, number]> = [
  [255, 210, 63], [255, 179, 71], [255, 138, 58], [255, 224, 138], [255, 243, 214], [255, 106, 77],
];
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A deterministic scatter of glowing fireflies (absolutely-positioned) to lay
 * behind OG content — a small night sky. Seeded, so the image is stable/cached.
 */
export function fireflyField(opts?: {
  count?: number;
  seed?: number;
  width?: number;
  height?: number;
  maxOpacity?: number;
}): ReactElement[] {
  const count = opts?.count ?? 26;
  const W = opts?.width ?? 1200;
  const H = opts?.height ?? 630;
  const maxO = opts?.maxOpacity ?? 0.9;
  const rand = mulberry32(opts?.seed ?? 20260711);
  const out: ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const core = 4 + rand() * 9;
    const glow = core * (2.6 + rand() * 3.4);
    const [r, g, b] = WARM[Math.floor(rand() * WARM.length)];
    const opacity = maxO * (0.3 + rand() * 0.7);
    out.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x - core / 2,
          top: y - core / 2,
          width: core,
          height: core,
          borderRadius: core,
          background: `rgb(${r},${g},${b})`,
          boxShadow: `0 0 ${glow}px ${glow / 3}px rgba(${r},${g},${b},0.55)`,
          opacity,
        }}
      />,
    );
  }
  return out;
}
