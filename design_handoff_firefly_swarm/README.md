# Handoff: Firefly AI News Portal — Front Page Swarm

## Overview
An ambient front page for an AI-news portal. 100–200 "fireflies" (glowing dots) drift in a 3D cloud on a near-black background. Each firefly IS a news item. Rank drives color, size, and depth: rank 1 is red, large, closest to camera; the lowest rank is yellow, small, far away — with a continuous gradient between. Fireflies pulse like real fireflies (quick flash, slow fade), wander only tiny distances around a home position, and never travel across the screen. Hover brightens/enlarges a firefly and shows its headline; click opens a small news card. A slash-command bar (`/`) handles search/filter and motion settings.

## About the Design Files
The bundled file is a **design reference created in HTML** — a working prototype showing intended look and behavior, not production code to copy directly. Recreate it in the target codebase's environment (React, Vue, vanilla, etc.) using its established patterns. The three.js scene logic, however, is real and portable — the `initScene` / `tick` functions in the file can be lifted nearly as-is into any framework.

## Fidelity
**High-fidelity.** Colors, typography, motion parameters, and interactions are final intent. Recreate pixel-perfectly.

## Tech
- **three.js** (tested with r147, plain `<script>` build). Scene = one `THREE.Sprite` per firefly using a shared radial-gradient `CanvasTexture`, `AdditiveBlending`, `depthWrite: false`, `PerspectiveCamera` (fov 55, z=26), `Raycaster` for hover/click.
- UI overlays (logo, legend, tooltip, card, command bar) are plain DOM absolutely positioned over the canvas.

## Screens / Views

### Front page (single screen)
- **Background**: fixed, `radial-gradient(ellipse at 50% 60%, #0a0d07 0%, #050604 55%, #020302 100%)`.
- **Canvas mount**: absolute inset 0, behind all overlays.
- **Logo** (top-left, 28px/32px offset): pulsing 10px yellow dot (`#ffd23f`, glow `0 0 12px 3px rgba(255,210,63,0.7)`, 3.2s blink) + "FIREFLY" (Space Grotesk 700, 17px, letter-spacing 0.14em, #f2f0e6) over "AI NEWS" (10px, letter-spacing 0.3em, 40% opacity).
- **Legend** (top-right): two dot+label pairs — red `#ff4433` "TOP RANK", yellow `#ffd23f` "LOW RANK". IBM Plex Mono 10px, letter-spacing 0.12em, rgba(242,240,230,0.45).
- **Status line** (bottom center): IBM Plex Mono 10px, letter-spacing 0.18em, rgba(242,240,230,0.25). Default text "PRESS / FOR COMMANDS"; shows active FILTER / MOTION state when set.

### Hover tooltip
Positioned at the firefly's projected screen coords, `translate(-50%, -140%)`. IBM Plex Mono 11px, rgba(242,240,230,0.85), background rgba(5,6,4,0.72), 1px border rgba(242,240,230,0.12), padding 5px 10px, radius 3px, single-line ellipsis, max-width 420px. Hidden while a card is open.

### News card (on click)
300px wide, positioned near the clicked firefly, clamped to viewport (18px right offset, kept ≥12px from edges). Background rgba(10,12,8,0.92), border 1px rgba(242,240,230,0.14), radius 6px, padding 16px 18px, backdrop-blur 12px, shadow `0 12px 40px rgba(0,0,0,0.6)`, enter animation 0.18s ease-out (fade + 6px rise + scale 0.97→1).
Contents: category dot (firefly's exact color + glow) + "RANK #N" (Plex Mono 10px, ls 0.15em, 50% opacity) + ✕ close; headline (Space Grotesk 500, 15px, line-height 1.4, #f2f0e6); footer row: "Source · 2h ago" (Plex Mono 10px, 40%) and "read →" link (#ffd23f, hover #ffe27a). Escape or ✕ or clicking empty space closes.

### Command bar (press `/`)
440px, bottom-center 48px up. Background rgba(10,12,8,0.94), border 1px rgba(255,210,63,0.25), radius 6px, blur 12px. Yellow `/` prefix + transparent input (Plex Mono 13px, #f2f0e6). Placeholder: "search apple · motion slow · motion more · clear". Invalid input shows a yellow feedback line below. Enter runs the command; Escape closes.

## Firefly system (exact parameters)

### Data → visual mapping
Per item: `{ id, title, source, minutesAgo, rank }` (rank 1 = highest). Let `t = 1 − (rank−1)/(count−1)` (t=1 top, t=0 bottom):
- **Color**: lerp from `#ffd23f` (low) to `#ff4433` (high) by `t^1.4` (keeps most fireflies yellow, only true top ranks red).
- **Size**: sprite scale `0.28 + t·0.85` world units.
- **Depth**: z offset `+ t·9 − 3` so high ranks sit closer to camera (bigger + parallax).
- **Base opacity**: `0.55 + t·0.45`.

### Distribution
Spherical cloud: radius `8 + rand·8`, random direction; stretched ×1.5 in x, ×0.85 in y, ×0.5 in z (an oblate cloud fitting a landscape screen).

### Motion (per frame, t = elapsed seconds, m = motion factor)
- **Wander**: position = base + sums of slow sinusoids, amplitude `0.55·m` world units (x), 0.8× (y), 0.5× (z), each firefly with random frequencies 0.09–0.33 Hz-ish and random phases. Tiny local drift only — never crosses the screen.
- **Pulse** (the firefly flash): `s = sin(t·pulseFreq·(0.6+0.4m) + phase)`; brightness = `0.22 + 0.78·max(0,s)^2.2` (+ small secondary shimmer). The power curve makes a short bright flash and long dim tail. pulseFreq random 0.5–1.9 per firefly. opacity = baseOpacity·pulse; scale breathes ±15% with pulse.
- **Hover**: opacity ×1.6, scale ×1.7, cursor pointer, wander freezes.
- **Camera**: slow ambient drift (`sin(t·0.05)·1.5`, `cos(t·0.04)·1.0`) plus mouse parallax (±2.2 x, ±1.4 y), eased at 0.02 lerp; lookAt(0,0,2).
- **Motion factor m**: slow = 0.35, normal = 1, more = 2.4.

### Search filter
Non-matching fireflies ease to opacity ×0.05 (lerp 0.08/frame); matching stay full. Match = case-insensitive substring on title or source.

## Interactions & Behavior
- `/` anywhere (not in an input) opens command bar, autofocuses.
- Commands: `/search <term>` (filter), `/motion slow|normal|more`, `/clear` (reset filter+motion+card). Unknown → feedback line. Designed to grow (`/contactus` etc.).
- Escape closes command bar and card.
- Click firefly → card; click empty space → close card.

## State Management
`card` (selected item or null), `hover` ({title,x,y} or null), `cmdOpen`, `cmdText`, `cmdFeedback`, `filter` (string), `motion` ('slow'|'normal'|'more'). Firefly positions/pulse live outside React state in the animation loop (per-sprite userData) — do NOT put per-frame values in framework state.

## Data fetching
Prototype generates mock headlines in `makeNews(count)`. Replace with the backend feed; expected shape per item: `{ id, title, source, minutesAgo, rank }`. 100–200 items. On feed refresh, update sprite userData in place rather than rebuilding the scene, so positions don't jump.

## Design Tokens
- Colors: background #050604 / #0a0d07 / #020302; text #f2f0e6 (dims via rgba 0.85/0.5/0.45/0.4/0.25); top-rank red #ff4433; low-rank yellow #ffd23f; link hover #ffe27a; panel bg rgba(10,12,8,0.92–0.94); borders rgba(242,240,230,0.12–0.14) and rgba(255,210,63,0.25).
- Fonts: Space Grotesk (400/500/700) for display; IBM Plex Mono (400/500) for labels, tooltip, commands.
- Radius: 3px (tooltip), 6px (card, command bar). Shadows: `0 12px 40px rgba(0,0,0,0.6–0.7)`.

## Assets
None — glow texture is generated at runtime on a 128px canvas (radial gradient white→transparent, stops at 0/0.18/0.45/1). Fonts from Google Fonts.

## Files
- `Firefly News Portal.dc.html` — the full prototype. Template (markup between `<x-dc>` tags) = the DOM overlays; the `Component` class = all three.js scene, motion, and command logic. `initScene()`, `tick()`, `glowTexture()`, and `runCommand()` are the portable core.
