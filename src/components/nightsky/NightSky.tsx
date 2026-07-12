'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import type { FireflyItem } from '@/lib/nightsky';

type Motion = 'slow' | 'normal' | 'more';
type SkyStyle = 'circle' | 'firefly' | 'icon';

interface CardState {
  title: string;
  source: string;
  time: string;
  rank: number;
  x: number;
  y: number;
  color: string;
  glow: string;
  url: string;
}

const HIGH = '#ff4433';
const LOW = '#ffd23f';

interface CmdInfo {
  name: string;
  usage: string;
  desc: string;
  fill?: boolean; // clicking fills the input (needs an argument) vs runs immediately
}
const COMMANDS: CmdInfo[] = [
  { name: 'search', usage: '/search <term>', desc: 'filter the sky by keyword', fill: true },
  { name: 'chronicle', usage: '/chronicle', desc: 'time-travel by month — scroll to move' },
  { name: 'style', usage: '/style firefly · circle · icon', desc: 'change the firefly look', fill: true },
  { name: 'motion', usage: '/motion slow · normal · more', desc: 'drift speed', fill: true },
  { name: 'list', usage: '/motion -l', desc: 'switch to the classic list view' },
  { name: 'clear', usage: '/clear', desc: 'reset filters & modes' },
];

function timeLabel(minutesAgo: number): string {
  return minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.round(minutesAgo / 60)}h ago`;
}

// month key = year*12 + monthIndex  (comparable / steppable)
function monthKeyOf(iso: string): number {
  const d = new Date(iso);
  return d.getFullYear() * 12 + d.getMonth();
}
function monthKeyLabel(mk: number): string {
  const y = Math.floor(mk / 12);
  const m = ((mk % 12) + 12) % 12;
  return new Date(y, m, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
}

export function NightSky({ items }: { items: FireflyItem[] }) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const cmdRef = useRef<HTMLInputElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const [card, setCard] = useState<CardState | null>(null);
  const [hoverTitle, setHoverTitle] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdText, setCmdText] = useState('');
  const [cmdFeedback, setCmdFeedback] = useState('');
  const [motion, setMotion] = useState<Motion>('normal');
  const [filter, setFilter] = useState('');
  const [style, setStyle] = useState<SkyStyle>('circle');
  const [chronicle, setChronicle] = useState(false);
  const [chronicleMK, setChronicleMK] = useState(0);

  // month range present in the data
  const { minMK, maxMK } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const it of items) {
      const mk = monthKeyOf(it.publishedAt);
      if (mk < mn) mn = mk;
      if (mk > mx) mx = mk;
    }
    return items.length ? { minMK: mn, maxMK: mx } : { minMK: 0, maxMK: 0 };
  }, [items]);

  // Mirrors for the imperative animation loop (never re-create the scene).
  const motionRef = useRef(motion);
  motionRef.current = motion;
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const cardOpenRef = useRef(!!card);
  cardOpenRef.current = !!card;
  const styleRef = useRef(style);
  styleRef.current = style;
  const chronicleRef = useRef(chronicle);
  chronicleRef.current = chronicle;
  const chronicleMKRef = useRef(chronicleMK);
  chronicleMKRef.current = chronicleMK;
  const boundsRef = useRef({ minMK, maxMK });
  boundsRef.current = { minMK, maxMK };

  // Scene handles for the style effect (swap sprite textures without rebuilding).
  const apiRef = useRef<{ flies: THREE.Sprite[]; tex: Record<SkyStyle, THREE.Texture> } | null>(null);

  const stepChronicle = useCallback((dir: number) => {
    setChronicleMK((prev) => {
      const { minMK: lo, maxMK: hi } = boundsRef.current;
      return Math.min(hi, Math.max(lo, prev + dir));
    });
  }, []);

  // ---------- three.js scene ----------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || items.length === 0) return;

    const count = items.length;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 0, 26);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const tex: Record<SkyStyle, THREE.Texture> = {
      circle: makeCircleTex(),
      firefly: makeFireflyTex(),
      icon: makeIconTex(),
    };
    const initialMap = tex[styleRef.current];

    const highC = new THREE.Color(HIGH);
    const lowC = new THREE.Color(LOW);

    // rank 1 => t=1 (red, big, near); last => t=0 (yellow, small, far)
    const flies = items.map((item) => {
      const t = count > 1 ? 1 - (item.rank - 1) / (count - 1) : 1;
      const color = lowC.clone().lerp(highC, Math.pow(t, 1.4));
      const mat = new THREE.SpriteMaterial({
        map: initialMap,
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      const r = 8 + Math.random() * 8;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      sp.position.set(
        r * Math.sin(ph) * Math.cos(th) * 1.5,
        r * Math.sin(ph) * Math.sin(th) * 0.85,
        r * Math.cos(ph) * 0.5 + t * 9 - 3
      );
      const size = 0.28 + t * 0.85;
      sp.scale.setScalar(size);
      sp.userData = {
        item,
        t,
        size,
        monthKey: monthKeyOf(item.publishedAt),
        base: sp.position.clone(),
        phase: Math.random() * Math.PI * 2,
        pulse: 0.5 + Math.random() * 1.4,
        wf: [0.13 + Math.random() * 0.2, 0.11 + Math.random() * 0.18, 0.09 + Math.random() * 0.15],
        wp: [Math.random() * 9, Math.random() * 9, Math.random() * 9],
        baseOpacity: 0.55 + t * 0.45,
        dim: 1,
      };
      scene.add(sp);
      return sp;
    });
    apiRef.current = { flies, tex };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-10, -10);
    const mouseNorm = { x: 0, y: 0 };
    let hovered: THREE.Sprite | null = null;

    const toScreen = (v3: THREE.Vector3) => {
      const v = v3.clone().project(camera);
      return { x: ((v.x + 1) / 2) * mount.clientWidth, y: ((1 - v.y) / 2) * mount.clientHeight };
    };

    const onMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseNorm.x = pointer.x;
      mouseNorm.y = pointer.y;
    };
    const onClick = () => {
      if (hovered) {
        const d = hovered.userData as { item: FireflyItem };
        const p = toScreen(hovered.position);
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        const hex = '#' + hovered.material.color.getHexString();
        setCard({
          title: d.item.title,
          source: d.item.source,
          time: timeLabel(d.item.minutesAgo),
          rank: d.item.rank,
          url: d.item.url,
          x: Math.min(Math.max(p.x + 18, 12), w - 320),
          y: Math.min(Math.max(p.y - 20, 12), h - 190),
          color: hex,
          glow: hex + '99',
        });
        setHoverTitle(null);
      } else if (cardOpenRef.current) {
        setCard(null);
      }
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('click', onClick);

    // scroll = time-travel through months (only in chronicle mode)
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      if (!chronicleRef.current) return;
      const now = performance.now();
      if (now - lastWheel < 220 || Math.abs(e.deltaY) < 6) return;
      lastWheel = now;
      stepChronicle(e.deltaY > 0 ? -1 : 1); // down => older
    };
    window.addEventListener('wheel', onWheel, { passive: true });

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    let disposed = false;

    const tick = () => {
      const t = clock.getElapsedTime();
      const m = motionFactor(motionRef.current);
      const filt = filterRef.current.toLowerCase();
      const chron = chronicleRef.current;
      const chronMK = chronicleMKRef.current;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(flies, false);
      let next: THREE.Sprite | null = null;
      for (const h of hits) {
        if (((h.object.userData as { dim: number }).dim ?? 1) > 0.15) {
          next = h.object as THREE.Sprite;
          break;
        }
      }
      if (next !== hovered) {
        hovered = next;
        renderer.domElement.style.cursor = next ? 'pointer' : 'default';
        setHoverTitle(next ? (next.userData as { item: FireflyItem }).item.title : null);
      }
      if (hovered && tipRef.current) {
        const p = toScreen(hovered.position);
        tipRef.current.style.left = `${p.x}px`;
        tipRef.current.style.top = `${p.y}px`;
      }

      for (const sp of flies) {
        const d = sp.userData as {
          base: THREE.Vector3; wf: number[]; wp: number[]; phase: number; pulse: number;
          baseOpacity: number; size: number; dim: number; item: FireflyItem; monthKey: number;
        };
        const isHover = sp === hovered;
        const inMonth = !chron || d.monthKey === chronMK;
        const matchesFilter = !filt || d.item.title.toLowerCase().includes(filt) || d.item.source.toLowerCase().includes(filt);
        const dimTarget = !inMonth ? 0 : matchesFilter ? 1 : 0.05;
        d.dim += (dimTarget - d.dim) * 0.08;

        if (!isHover) {
          const amp = 0.55 * m;
          sp.position.x = d.base.x + Math.sin(t * d.wf[0] * m + d.wp[0]) * amp + Math.sin(t * d.wf[1] * 2.7 * m + d.wp[2]) * amp * 0.3;
          sp.position.y = d.base.y + Math.sin(t * d.wf[1] * m + d.wp[1]) * amp * 0.8 + Math.cos(t * d.wf[2] * 3.1 * m + d.wp[0]) * amp * 0.25;
          sp.position.z = d.base.z + Math.sin(t * d.wf[2] * m + d.wp[2]) * amp * 0.5;
        }

        const s = Math.sin(t * d.pulse * (0.6 + 0.4 * m) + d.phase);
        const pulse = 0.22 + 0.78 * Math.pow(Math.max(0, s), 2.2) + 0.1 * Math.max(0, Math.sin(t * d.pulse * 3.7 + d.phase * 2)) * 0.5;
        sp.material.opacity = Math.min(1, d.baseOpacity * pulse * (isHover ? 1.6 : 1)) * d.dim;
        sp.scale.setScalar(d.size * (0.85 + 0.3 * pulse) * (isHover ? 1.7 : 1));
      }

      const px = mouseNorm.x * 2.2;
      const py = mouseNorm.y * 1.4;
      camera.position.x += (Math.sin(t * 0.05) * 1.5 + px - camera.position.x) * 0.02;
      camera.position.y += (Math.cos(t * 0.04) * 1.0 + py - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 2);
      renderer.render(scene, camera);

      if (!disposed) raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('click', onClick);
      apiRef.current = null;
      flies.forEach((sp) => sp.material.dispose());
      Object.values(tex).forEach((x) => x.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [items, stepChronicle]);

  // swap sprite textures when /style changes (no scene rebuild)
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const map = api.tex[style];
    for (const sp of api.flies) {
      sp.material.map = map;
      sp.material.needsUpdate = true;
    }
  }, [style]);

  // ---------- commands ----------
  const runCommand = useCallback(
    (raw: string) => {
      const txt = raw.trim().replace(/^\//, '');
      const [cmd, ...rest] = txt.split(/\s+/);
      const arg = rest.join(' ').trim().toLowerCase();
      const close = () => {
        setCmdOpen(false);
        setCmdText('');
      };
      if (cmd === 'search') {
        if (!arg) return setCmdFeedback('usage: /search <term> — /clear to reset');
        setFilter(arg);
        close();
      } else if (cmd === 'motion') {
        if (arg === '-l' || arg === 'list') return router.push('/list');
        if (arg === '-a' || arg === 'anim' || arg === 'animated' || arg === '') {
          setMotion('normal');
          setChronicle(false);
          close();
          return;
        }
        const map: Record<string, Motion> = { slow: 'slow', calm: 'slow', more: 'more', normal: 'normal', reset: 'normal' };
        if (map[arg]) {
          setMotion(map[arg]);
          close();
        } else {
          setCmdFeedback('usage: /motion slow | normal | more | -l (list) | -a (animated)');
        }
      } else if (cmd === 'style') {
        const order: SkyStyle[] = ['circle', 'firefly', 'icon'];
        if (arg === 'firefly' || arg === 'real') {
          setStyle('firefly');
          close();
        } else if (arg === 'circle' || arg === 'dot' || arg === 'glow') {
          setStyle('circle');
          close();
        } else if (arg === 'icon' || arg === 'star' || arg === '✦') {
          setStyle('icon');
          close();
        } else if (arg === '') {
          setStyle((s) => order[(order.indexOf(s) + 1) % order.length]); // cycle
          close();
        } else {
          setCmdFeedback('usage: /style firefly | circle | icon');
        }
      } else if (cmd === 'chronicle' || cmd === 'chron' || cmd === 'time') {
        if (arg === 'off') {
          setChronicle(false);
          close();
        } else {
          setChronicle((on) => {
            if (!on) setChronicleMK(boundsRef.current.maxMK);
            return !on;
          });
          close();
        }
      } else if (cmd === 'clear') {
        setFilter('');
        setMotion('normal');
        setChronicle(false);
        setCard(null);
        close();
      } else if (cmd === 'list') {
        router.push('/list');
      } else {
        setCmdFeedback('unknown — try: search, chronicle, style, motion, list, clear');
      }
    },
    [router]
  );

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !cmdOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setCmdOpen(true);
        setCmdText('');
        setCmdFeedback('');
        setTimeout(() => cmdRef.current?.focus(), 30);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setCard(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmdOpen]);

  // status line
  let statusLine = 'PRESS / FOR COMMANDS';
  if (chronicle) {
    statusLine = `CHRONICLE · ${monthKeyLabel(chronicleMK)} · SCROLL TO TIME-TRAVEL · /clear TO EXIT`;
  } else {
    const parts: string[] = [];
    if (filter) parts.push('FILTER: ' + filter.toUpperCase());
    if (motion !== 'normal') parts.push('MOTION: ' + motion.toUpperCase());
    if (style !== 'circle') parts.push('STYLE: ' + style.toUpperCase());
    if (parts.length) statusLine = parts.join('   ·   ') + '   ·   / TO CHANGE';
  }

  const mono = 'var(--font-plex), monospace';
  const display = 'var(--font-display), sans-serif';

  // command menu (vertical list), filtered by what's typed
  const typedCmd = cmdText.trim().replace(/^\//, '').split(/\s+/)[0].toLowerCase();
  const matches = typedCmd
    ? COMMANDS.filter((c) => c.name.startsWith(typedCmd) || c.usage.toLowerCase().includes(typedCmd))
    : COMMANDS;
  const shownCommands = matches.length ? matches : COMMANDS;
  const pickCommand = (c: CmdInfo) => {
    if (c.fill) {
      setCmdText(c.name + ' ');
      setCmdFeedback('');
      setTimeout(() => cmdRef.current?.focus(), 0);
    } else {
      runCommand(c.name);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 60%, #0a0d07 0%, #050604 55%, #020302 100%)',
        fontFamily: display,
        cursor: 'default',
        overflow: 'hidden',
      }}
    >
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Chronicle period label */}
      {chronicle && (
        <div style={{ position: 'absolute', top: 92, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', userSelect: 'none', textAlign: 'center' }}>
          <div style={{ color: 'rgba(242,240,230,0.92)', fontSize: 34, fontWeight: 700, letterSpacing: '0.12em', textShadow: '0 0 24px rgba(255,210,63,0.25)' }}>
            {monthKeyLabel(chronicleMK)}
          </div>
          <div style={{ marginTop: 6, color: 'rgba(242,240,230,0.35)', fontFamily: mono, fontSize: 10, letterSpacing: '0.22em' }}>
            {chronicleMK <= minMK ? 'OLDEST ON RECORD' : 'SCROLL ↓ FOR OLDER'}
          </div>
        </div>
      )}

      {/* Logo */}
      <div style={{ position: 'absolute', top: 28, left: 32, display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffd23f', boxShadow: '0 0 12px 3px rgba(255,210,63,0.7)', animation: 'blink 3.2s ease-in-out infinite' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ color: '#f2f0e6', fontSize: 17, fontWeight: 700, letterSpacing: '0.14em' }}>FIREFLY</div>
          <div style={{ color: 'rgba(242,240,230,0.4)', fontSize: 10, letterSpacing: '0.3em', fontWeight: 400 }}>AI NEWS</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', top: 34, right: 32, display: 'flex', alignItems: 'center', gap: 18, pointerEvents: 'none', userSelect: 'none', fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', color: 'rgba(242,240,230,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff4433', boxShadow: '0 0 8px 2px rgba(255,68,51,0.6)' }} />
          <span>TOP RANK</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffd23f', boxShadow: '0 0 8px 2px rgba(255,210,63,0.5)' }} />
          <span>LOW RANK</span>
        </div>
      </div>

      {/* Hover tooltip (positioned imperatively) */}
      {hoverTitle && !card && (
        <div
          ref={tipRef}
          style={{ position: 'absolute', transform: 'translate(-50%, -140%)', pointerEvents: 'none', fontFamily: mono, fontSize: 11, color: 'rgba(242,240,230,0.85)', background: 'rgba(5,6,4,0.72)', border: '1px solid rgba(242,240,230,0.12)', padding: '5px 10px', borderRadius: 3, whiteSpace: 'nowrap', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.02em' }}
        >
          {hoverTitle}
        </div>
      )}

      {/* News card */}
      {card && (
        <div style={{ position: 'absolute', left: card.x, top: card.y, width: 300, background: 'rgba(10,12,8,0.92)', border: '1px solid rgba(242,240,230,0.14)', borderRadius: 6, padding: '16px 18px', backdropFilter: 'blur(12px)', animation: 'cardIn 0.18s ease-out', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: card.color, boxShadow: `0 0 10px 2px ${card.glow}` }} />
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.15em', color: 'rgba(242,240,230,0.5)' }}>RANK #{card.rank}</span>
            </div>
            <button onClick={() => setCard(null)} aria-label="Close" style={{ cursor: 'pointer', color: 'rgba(242,240,230,0.4)', fontSize: 14, lineHeight: 1, padding: '2px 4px', background: 'none', border: 'none' }}>✕</button>
          </div>
          <div style={{ color: '#f2f0e6', fontSize: 15, fontWeight: 500, lineHeight: 1.4, marginBottom: 10 }}>{card.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'rgba(242,240,230,0.4)', letterSpacing: '0.08em' }}>{card.source} · {card.time}</span>
            <a href={card.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.05em', color: '#ffd23f', textDecoration: 'none' }}>read →</a>
          </div>
        </div>
      )}

      {/* Command bar + vertical menu */}
      {cmdOpen && (
        <div style={{ position: 'absolute', left: '50%', bottom: 48, transform: 'translateX(-50%)', width: 480, maxWidth: '92vw', background: 'rgba(10,12,8,0.95)', border: '1px solid rgba(255,210,63,0.25)', borderRadius: 8, padding: '8px 8px 10px', backdropFilter: 'blur(12px)', boxShadow: '0 16px 48px rgba(0,0,0,0.7)', animation: 'cardIn 0.15s ease-out' }}>
          {/* vertical command list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 6 }}>
            {shownCommands.map((c) => (
              <button
                key={c.name}
                onMouseDown={(e) => { e.preventDefault(); pickCommand(c); }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,210,63,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 5, padding: '7px 10px', cursor: 'pointer' }}
              >
                <span style={{ fontFamily: mono, fontSize: 12.5, color: '#ffd23f', letterSpacing: '0.02em' }}>{c.usage}</span>
                <span style={{ fontFamily: mono, fontSize: 10.5, color: 'rgba(242,240,230,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.desc}</span>
              </button>
            ))}
          </div>
          {/* input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid rgba(242,240,230,0.1)', paddingTop: 9 }}>
            <span style={{ color: '#ffd23f', fontFamily: mono, fontSize: 14, paddingLeft: 4 }}>/</span>
            <input
              ref={cmdRef}
              value={cmdText}
              onChange={(e) => { setCmdText(e.target.value); setCmdFeedback(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') runCommand(cmdText); e.stopPropagation(); }}
              placeholder="type a command, or pick one above"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f2f0e6', fontFamily: mono, fontSize: 13 }}
            />
          </div>
          {cmdFeedback && (
            <div style={{ marginTop: 8, marginLeft: 14, fontFamily: mono, fontSize: 10, color: 'rgba(255,210,63,0.7)', letterSpacing: '0.05em' }}>{cmdFeedback}</div>
          )}
        </div>
      )}

      {/* Status line */}
      <div style={{ position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)', pointerEvents: 'none', userSelect: 'none', fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', color: 'rgba(242,240,230,0.25)', whiteSpace: 'nowrap' }}>{statusLine}</div>

      {/* Empty / warming-up state */}
      {items.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
          <div style={{ color: '#ffd23f', fontSize: 30, textShadow: '0 0 18px rgba(255,210,63,0.5)' }}>✦</div>
          <div style={{ color: 'rgba(242,240,230,0.6)', fontFamily: mono, fontSize: 12, letterSpacing: '0.1em' }}>THE NIGHT SKY IS WARMING UP…</div>
        </div>
      )}
    </div>
  );
}

function motionFactor(m: Motion): number {
  return m === 'slow' ? 0.35 : m === 'more' ? 2.4 : 1;
}

// ---------- sprite textures (white on transparent; tinted by rank color, additively blended) ----------
function makeCircleTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeIconTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const bloom = g.createRadialGradient(64, 64, 0, 64, 64, 60);
  bloom.addColorStop(0, 'rgba(255,255,255,0.45)');
  bloom.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  bloom.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = bloom;
  g.fillRect(0, 0, 128, 128);
  g.save();
  g.translate(64, 64);
  g.fillStyle = 'rgba(255,255,255,1)';
  g.shadowColor = 'rgba(255,255,255,0.9)';
  g.shadowBlur = 8;
  const spikes = 4;
  const outer = 52;
  const inner = 13;
  const step = Math.PI / spikes;
  let rot = -Math.PI / 2;
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const x = Math.cos(rot) * rad;
    const y = Math.sin(rot) * rad;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    rot += step;
  }
  g.closePath();
  g.fill();
  g.restore();
  return new THREE.CanvasTexture(c);
}

function makeFireflyTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  // ambient glow
  let grad = g.createRadialGradient(64, 74, 4, 64, 74, 54);
  grad.addColorStop(0, 'rgba(255,255,255,0.8)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.2)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // faint wings
  g.fillStyle = 'rgba(255,255,255,0.13)';
  g.beginPath(); g.ellipse(48, 58, 11, 19, -0.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(80, 58, 11, 19, 0.5, 0, Math.PI * 2); g.fill();
  // body / head (upper, dim)
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath(); g.ellipse(64, 50, 8, 14, 0, 0, Math.PI * 2); g.fill();
  // bright abdomen (lower)
  grad = g.createRadialGradient(64, 84, 0, 64, 84, 22);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(64, 84, 15, 20, 0, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
}
