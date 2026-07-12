'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import type { FireflyItem } from '@/lib/nightsky';

type Motion = 'slow' | 'normal' | 'more';

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

function timeLabel(minutesAgo: number): string {
  return minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.round(minutesAgo / 60)}h ago`;
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

  // Mirrors for the imperative animation loop (never re-create the scene).
  const motionRef = useRef(motion);
  motionRef.current = motion;
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const cardOpenRef = useRef(!!card);
  cardOpenRef.current = !!card;

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

    // shared radial-gradient glow texture
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g2 = c.getContext('2d')!;
    const grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);

    const highC = new THREE.Color(HIGH);
    const lowC = new THREE.Color(LOW);

    // rank 1 => t=1 (red, big, near); last => t=0 (yellow, small, far)
    const flies = items.map((item) => {
      const t = count > 1 ? 1 - (item.rank - 1) / (count - 1) : 1;
      const color = lowC.clone().lerp(highC, Math.pow(t, 1.4));
      const mat = new THREE.SpriteMaterial({
        map: tex,
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

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(flies, false);
      const next = (hits.length ? hits[0].object : null) as THREE.Sprite | null;
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
          baseOpacity: number; size: number; dim: number; item: FireflyItem;
        };
        const isHover = sp === hovered;
        const matched =
          !filt ||
          d.item.title.toLowerCase().includes(filt) ||
          d.item.source.toLowerCase().includes(filt);
        d.dim += ((matched ? 1 : 0.05) - d.dim) * 0.08;

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
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('click', onClick);
      flies.forEach((sp) => sp.material.dispose());
      tex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [items]);

  // ---------- commands ----------
  const runCommand = useCallback(
    (raw: string) => {
      const txt = raw.trim().replace(/^\//, '');
      const [cmd, ...rest] = txt.split(/\s+/);
      const arg = rest.join(' ').trim();
      if (cmd === 'search') {
        if (!arg) return setCmdFeedback('usage: /search <term> — /clear to reset');
        setFilter(arg);
        setCmdOpen(false);
        setCmdText('');
      } else if (cmd === 'motion') {
        if (arg === '-l' || arg === 'list') return router.push('/list');
        if (arg === '-a' || arg === 'anim' || arg === 'animated' || arg === '') {
          setMotion('normal');
          setCmdOpen(false);
          setCmdText('');
          return;
        }
        const map: Record<string, Motion> = { slow: 'slow', calm: 'slow', more: 'more', normal: 'normal', reset: 'normal' };
        if (map[arg]) {
          setMotion(map[arg]);
          setCmdOpen(false);
          setCmdText('');
        } else {
          setCmdFeedback('usage: /motion slow | normal | more | -l (list) | -a (animated)');
        }
      } else if (cmd === 'clear') {
        setFilter('');
        setMotion('normal');
        setCard(null);
        setCmdOpen(false);
        setCmdText('');
      } else if (cmd === 'list') {
        router.push('/list');
      } else {
        setCmdFeedback('unknown command — try: search, motion, list, clear');
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
  const parts: string[] = [];
  if (filter) parts.push('FILTER: ' + filter.toUpperCase());
  if (motion !== 'normal') parts.push('MOTION: ' + motion.toUpperCase());
  const statusLine = parts.length ? parts.join('   ·   ') + '   ·   / TO CHANGE' : 'PRESS / FOR COMMANDS';

  const mono = 'var(--font-plex), monospace';
  const display = 'var(--font-display), sans-serif';

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

      {/* Command bar */}
      {cmdOpen && (
        <div style={{ position: 'absolute', left: '50%', bottom: 48, transform: 'translateX(-50%)', width: 440, maxWidth: '90vw', background: 'rgba(10,12,8,0.94)', border: '1px solid rgba(255,210,63,0.25)', borderRadius: 6, padding: '12px 16px', backdropFilter: 'blur(12px)', boxShadow: '0 12px 40px rgba(0,0,0,0.7)', animation: 'cardIn 0.15s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#ffd23f', fontFamily: mono, fontSize: 14 }}>/</span>
            <input
              ref={cmdRef}
              value={cmdText}
              onChange={(e) => { setCmdText(e.target.value); setCmdFeedback(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') runCommand(cmdText); e.stopPropagation(); }}
              placeholder="search apple · motion slow · motion -l (list) · clear"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f2f0e6', fontFamily: mono, fontSize: 13 }}
            />
          </div>
          {cmdFeedback && (
            <div style={{ marginTop: 8, fontFamily: mono, fontSize: 10, color: 'rgba(255,210,63,0.7)', letterSpacing: '0.05em' }}>{cmdFeedback}</div>
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
