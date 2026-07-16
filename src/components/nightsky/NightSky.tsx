'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import type { Category, Region } from '@/lib/types';
import type { FireflyItem } from '@/lib/nightsky';

type Motion = 'slow' | 'normal' | 'more';
type SkyStyle = 'circle' | 'firefly' | 'icon';
type Language = 'all' | 'english' | 'chinese';

interface CardState {
  id: string;
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
const READ = '#4ade80'; // a read firefly turns green (so you skip it next time)
const READ_COLOR = new THREE.Color(READ);
const FRESH_COLOR = new THREE.Color('#f2f0e6'); // < 24h old → white (read me first)
const READ_KEY = 'firefly-read';

// Terse command list (menu shows only the token; /help explains them).
interface CmdInfo { name: string; token: string; desc: string; fill?: boolean }
const COMMANDS: CmdInfo[] = [
  { name: 'search', token: '/search', desc: 'filter the sky by keyword', fill: true },
  { name: 'category', token: '/category', desc: 'topic: model · funding · regulation · research · infra · product · opinion', fill: true },
  { name: 'region', token: '/region', desc: 'source origin: us · cn — the sky defaults to us', fill: true },
  { name: 'language', token: '/language', desc: 'english · chinese · all', fill: true },
  { name: 'style', token: '/style', desc: 'firefly · circle · icon', fill: true },
  { name: 'motion', token: '/motion', desc: 'drift speed: slow · normal · more', fill: true },
  { name: 'chronicle', token: '/chronicle', desc: 'time-travel by month' },
  { name: 'list', token: '/motion -l', desc: 'switch to the classic list' },
  { name: 'clear', token: '/clear', desc: 'reset filters & modes' },
  { name: 'help', token: '/help', desc: 'show all commands with descriptions' },
];

const REGION_ALIAS: Record<string, Region> = {
  us: 'US', usa: 'US', america: 'US', default: 'US', home: 'US',
  cn: 'CN', china: 'CN', chinese: 'CN', prc: 'CN', 中国: 'CN',
};

const CAT_ALIAS: Record<string, Category> = {
  model: 'Model Release', release: 'Model Release', models: 'Model Release',
  funding: 'Funding', money: 'Funding', raise: 'Funding',
  regulation: 'Regulation', policy: 'Regulation', law: 'Regulation', legal: 'Regulation',
  research: 'Research', ml: 'Research', paper: 'Research', papers: 'Research', data: 'Research', science: 'Research',
  infra: 'Infrastructure', infrastructure: 'Infrastructure', chips: 'Infrastructure', datacenter: 'Infrastructure', hardware: 'Infrastructure', compute: 'Infrastructure', power: 'Infrastructure',
  product: 'Product', products: 'Product',
  opinion: 'Opinion', analysis: 'Opinion',
};

function timeLabel(minutesAgo: number): string {
  return minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.round(minutesAgo / 60)}h ago`;
}
function monthKeyOf(iso: string): number {
  const d = new Date(iso);
  return d.getFullYear() * 12 + d.getMonth();
}
function mkShort(mk: number): string {
  const y = Math.floor(mk / 12);
  const m = ((mk % 12) + 12) % 12;
  return `${String(m + 1).padStart(2, '0')}.${String(y % 100).padStart(2, '0')}`;
}
const hasCJK = (s: string) => /[㐀-鿿豈-﫿]/.test(s);

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [motion, setMotion] = useState<Motion>('normal');
  const [filter, setFilter] = useState('');
  const [style, setStyle] = useState<SkyStyle>('circle');
  const [language, setLanguage] = useState<Language>('all');
  const [category, setCategory] = useState<Category | null>(null);
  // Default sky is US only; /region cn switches to the China sources.
  const [region, setRegion] = useState<Region>('US');
  const [chronicle, setChronicle] = useState(false);
  const [chronicleMK, setChronicleMK] = useState(0);
  const [reelScale, setReelScale] = useState(1);
  const [reelHover, setReelHover] = useState(false);
  const reelBarRef = useRef<HTMLDivElement>(null);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [isTouch, setIsTouch] = useState(false);

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

  // Mirrors for the imperative loop.
  const motionRef = useRef(motion); motionRef.current = motion;
  const filterRef = useRef(filter); filterRef.current = filter;
  const cardOpenRef = useRef(!!card); cardOpenRef.current = !!card;
  const readSetRef = useRef(read); readSetRef.current = read;
  const styleRef = useRef(style); styleRef.current = style;
  const langRef = useRef(language); langRef.current = language;
  const catRef = useRef(category); catRef.current = category;
  const regionRef = useRef(region); regionRef.current = region;
  const chronicleRef = useRef(chronicle); chronicleRef.current = chronicle;
  const chronicleMKRef = useRef(chronicleMK); chronicleMKRef.current = chronicleMK;
  const boundsRef = useRef({ minMK, maxMK }); boundsRef.current = { minMK, maxMK };
  const apiRef = useRef<{ flies: THREE.Sprite[]; tex: Record<SkyStyle, THREE.Texture> } | null>(null);

  const stepChronicle = useCallback((dir: number) => {
    setChronicleMK((prev) => {
      const { minMK: lo, maxMK: hi } = boundsRef.current;
      return Math.min(hi, Math.max(lo, prev + dir));
    });
  }, []);
  const selectMonth = useCallback((mk: number) => {
    const { minMK: lo, maxMK: hi } = boundsRef.current;
    if (mk < lo || mk > hi) return;
    setChronicle(true);
    setChronicleMK(mk);
  }, []);
  const markRead = useCallback((id: string) => {
    setRead((prev) => {
      if (prev.has(id)) return prev;
      const n = new Set(prev);
      n.add(id);
      try { localStorage.setItem(READ_KEY, JSON.stringify([...n])); } catch {}
      return n;
    });
  }, []);

  // client-only: touch detection + restore read markers
  useEffect(() => {
    setIsTouch(typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);
    try {
      const s = localStorage.getItem(READ_KEY);
      if (s) setRead(new Set(JSON.parse(s) as string[]));
    } catch {}
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

    const flies = items.map((item) => {
      const t = count > 1 ? 1 - (item.rank - 1) / (count - 1) : 1;
      const color = lowC.clone().lerp(highC, Math.pow(t, 1.4));
      const mat = new THREE.SpriteMaterial({ map: initialMap, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
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
        item, t, size,
        baseColor: color.clone(),
        monthKey: monthKeyOf(item.publishedAt),
        isChinese: hasCJK(item.title),
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
    const onClick = (e: MouseEvent) => {
      // Fresh raycast at the exact click/tap point so a first tap (no prior
      // hover, e.g. on touch) reliably selects the firefly under the finger.
      const rect = renderer.domElement.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const cy = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(cx, cy), camera);
      const hits = raycaster.intersectObjects(flies, false);
      let target: THREE.Sprite | null = null;
      for (const hHit of hits) {
        if (((hHit.object.userData as { dim: number }).dim ?? 1) > 0.15) { target = hHit.object as THREE.Sprite; break; }
      }
      if (target) {
        const d = target.userData as { item: FireflyItem };
        const p = toScreen(target.position);
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        const hex = '#' + target.material.color.getHexString(); // current display color (white if fresh)
        setCard({
          id: d.item.id,
          title: d.item.title, source: d.item.source, time: timeLabel(d.item.minutesAgo),
          rank: d.item.rank, url: d.item.url,
          x: Math.min(Math.max(p.x + 18, 12), w - 320),
          y: Math.min(Math.max(p.y - 20, 12), h - 190),
          color: hex, glow: hex + '99',
        });
        setHoverTitle(null);
      } else if (cardOpenRef.current) {
        setCard(null);
      }
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('click', onClick);

    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      if (!chronicleRef.current) return;
      const now = performance.now();
      if (now - lastWheel < 220 || Math.abs(e.deltaY) < 6) return;
      lastWheel = now;
      stepChronicle(e.deltaY > 0 ? -1 : 1);
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
      const lang = langRef.current;
      const cat = catRef.current;
      const reg = regionRef.current;
      const readSet = readSetRef.current;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(flies, false);
      let next: THREE.Sprite | null = null;
      for (const hHit of hits) {
        if (((hHit.object.userData as { dim: number }).dim ?? 1) > 0.15) { next = hHit.object as THREE.Sprite; break; }
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
          baseOpacity: number; size: number; dim: number; item: FireflyItem; monthKey: number; isChinese: boolean; baseColor: THREE.Color;
        };
        const isHover = sp === hovered;
        // read → green · fresh (<24h) → white · else rank color
        sp.material.color.copy(
          readSet.has(d.item.id) ? READ_COLOR : d.item.minutesAgo < 1440 ? FRESH_COLOR : d.baseColor
        );
        const inMonth = !chron || d.monthKey === chronMK;
        const langOK = lang === 'all' || (lang === 'chinese' ? d.isChinese : !d.isChinese);
        const catOK = !cat || d.item.category === cat;
        const regionOK = d.item.region === reg;
        const searchOK = !filt || d.item.title.toLowerCase().includes(filt) || d.item.source.toLowerCase().includes(filt);
        let dimTarget = 1;
        if (!inMonth || !langOK || !catOK || !regionOK) dimTarget = 0;
        else if (!searchOK) dimTarget = 0.05;
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

  // swap textures on /style
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const map = api.tex[style];
    for (const sp of api.flies) { sp.material.map = map; sp.material.needsUpdate = true; }
  }, [style]);

  // ---------- commands ----------
  const openCmd = useCallback((focus: boolean) => {
    setHelpOpen(false);
    setCmdOpen(true);
    setCmdText('');
    setCmdFeedback('');
    if (focus) setTimeout(() => cmdRef.current?.focus(), 30);
  }, []);

  const runCommand = useCallback(
    (raw: string) => {
      const txt = raw.trim().replace(/^\//, '');
      const [cmd, ...rest] = txt.split(/\s+/);
      const arg = rest.join(' ').trim().toLowerCase();
      const close = () => { setCmdOpen(false); setCmdText(''); };
      if (cmd === 'search') {
        if (!arg) return setCmdFeedback('usage: /search <term>');
        setFilter(arg); close();
      } else if (cmd === 'category' || cmd === 'topic' || cmd === 'cat') {
        if (arg === 'off' || arg === 'all' || arg === 'clear') { setCategory(null); close(); }
        else if (CAT_ALIAS[arg]) { setCategory(CAT_ALIAS[arg]); close(); }
        else setCmdFeedback('topics: model · funding · regulation · research · infra · product · opinion · all');
      } else if (cmd === 'region' || cmd === 'origin') {
        if (REGION_ALIAS[arg]) { setRegion(REGION_ALIAS[arg]); close(); }
        else setCmdFeedback('usage: /region us · cn');
      } else if (cmd === 'language' || cmd === 'lang') {
        if (arg === 'en' || arg === 'english') { setLanguage('english'); close(); }
        else if (arg === 'cn' || arg === 'zh' || arg === 'chinese' || arg === '中文') { setLanguage('chinese'); close(); }
        else if (arg === 'all' || arg === '') { setLanguage('all'); close(); }
        else setCmdFeedback('usage: /language english · chinese · all');
      } else if (cmd === 'motion') {
        if (arg === '-l' || arg === 'list') return router.push('/list');
        if (arg === '-a' || arg === 'anim' || arg === 'animated' || arg === '') { setMotion('normal'); setChronicle(false); close(); return; }
        const map: Record<string, Motion> = { slow: 'slow', calm: 'slow', more: 'more', normal: 'normal', reset: 'normal' };
        if (map[arg]) { setMotion(map[arg]); close(); }
        else setCmdFeedback('usage: /motion slow · normal · more · -l (list)');
      } else if (cmd === 'style') {
        const order: SkyStyle[] = ['circle', 'firefly', 'icon'];
        if (arg === 'firefly' || arg === 'real') { setStyle('firefly'); close(); }
        else if (arg === 'circle' || arg === 'dot' || arg === 'glow') { setStyle('circle'); close(); }
        else if (arg === 'icon' || arg === 'star') { setStyle('icon'); close(); }
        else if (arg === '') { setStyle((s) => order[(order.indexOf(s) + 1) % order.length]); close(); }
        else setCmdFeedback('usage: /style firefly · circle · icon');
      } else if (cmd === 'chronicle' || cmd === 'chron' || cmd === 'time') {
        if (arg === 'off') { setChronicle(false); close(); }
        else { setChronicle((on) => { if (!on) setChronicleMK(boundsRef.current.maxMK); return !on; }); close(); }
      } else if (cmd === 'help' || cmd === '?') {
        setHelpOpen(true); close();
      } else if (cmd === 'clear') {
        setFilter(''); setMotion('normal'); setChronicle(false); setLanguage('all'); setCategory(null); setRegion('US'); setCard(null); close();
      } else if (cmd === 'list') {
        router.push('/list');
      } else {
        setCmdFeedback('unknown — /help for the full list');
      }
    },
    [router]
  );

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !cmdOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        openCmd(true);
      } else if (e.key === 'Escape') {
        setCmdOpen(false); setCard(null); setHelpOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmdOpen, openCmd]);

  // status line
  let statusLine = '';
  if (chronicle) statusLine = `CHRONICLE · ${mkShort(chronicleMK)} · TAP A MONTH OR SCROLL · /clear TO EXIT`;
  else {
    const parts: string[] = [];
    if (region !== 'US') parts.push('REGION: ' + region); // default sky is US — only flag the switch
    if (filter) parts.push('SEARCH: ' + filter.toUpperCase());
    if (category) parts.push('TOPIC: ' + category.toUpperCase());
    if (language !== 'all') parts.push('LANG: ' + language.toUpperCase());
    if (motion !== 'normal') parts.push('MOTION: ' + motion.toUpperCase());
    if (style !== 'circle') parts.push('STYLE: ' + style.toUpperCase());
    statusLine = parts.length ? parts.join('   ·   ') : '';
  }

  const mono = 'var(--font-plex), monospace';
  const display = 'var(--font-display), sans-serif';

  const typedCmd = cmdText.trim().replace(/^\//, '').split(/\s+/)[0].toLowerCase();
  const matches = typedCmd ? COMMANDS.filter((c) => c.name.startsWith(typedCmd) || c.token.toLowerCase().includes(typedCmd)) : COMMANDS;
  const shownCommands = matches.length ? matches : COMMANDS;
  const pickCommand = (c: CmdInfo) => {
    if (c.fill) { setCmdText(c.name + ' '); setCmdFeedback(''); setTimeout(() => cmdRef.current?.focus(), 0); }
    else runCommand(c.name);
  };

  const focusMK = chronicle ? chronicleMK : maxMK;
  const reelMonths = items.length ? [-2, -1, 0, 1, 2].map((o) => focusMK + o) : [];

  // vertical bar → adjust the reel font size (0.6×–1.8×)
  const startReelResize = (e: { clientY: number }) => {
    const apply = (clientY: number) => {
      const track = reelBarRef.current;
      if (!track) return;
      const r = track.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height));
      setReelScale(0.6 + frac * 1.2);
    };
    apply(e.clientY);
    const move = (ev: PointerEvent) => apply(ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 60%, #0a0d07 0%, #050604 55%, #020302 100%)', fontFamily: display, cursor: 'default', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Logo */}
      <div style={{ position: 'absolute', top: 28, left: 32, display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffd23f', boxShadow: '0 0 12px 3px rgba(255,210,63,0.7)', animation: 'blink 3.2s ease-in-out infinite' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ color: '#f2f0e6', fontSize: 17, fontWeight: 700, letterSpacing: '0.14em' }}>FIREFLY</div>
          <div style={{ color: 'rgba(242,240,230,0.4)', fontSize: 10, letterSpacing: '0.3em', fontWeight: 400 }}>AI NEWS</div>
        </div>
      </div>

      {/* Slot-machine month reel (top-right) — tap a month to time-travel; hover → drag the bar to resize */}
      {reelMonths.length > 0 && (
        <div
          onMouseEnter={() => setReelHover(true)}
          onMouseLeave={() => setReelHover(false)}
          style={{ position: 'absolute', top: 20, right: 30, display: 'flex', alignItems: 'flex-start', gap: 12 }}
        >
          {/* font-size bar */}
          <div
            ref={reelBarRef}
            onPointerDown={startReelResize}
            aria-label="Resize date font"
            style={{ width: 12, height: 150, marginTop: 10, position: 'relative', cursor: 'ns-resize', opacity: reelHover ? 1 : 0, transition: 'opacity 0.2s', display: 'flex', justifyContent: 'center', touchAction: 'none' }}
          >
            <div style={{ width: 1, height: '100%', background: 'rgba(242,240,230,0.22)' }} />
            <div style={{ position: 'absolute', left: '50%', top: `${(1 - (reelScale - 0.6) / 1.2) * 100}%`, transform: 'translate(-50%,-50%)', width: 9, height: 9, borderRadius: '50%', background: '#ffd23f', boxShadow: '0 0 8px rgba(255,210,63,0.55)' }} />
          </div>
          {/* month numbers (thin, tall, ambient) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', userSelect: 'none', fontFamily: 'var(--font-reel), var(--font-display), sans-serif' }}>
            {reelMonths.map((mk) => {
              const dist = Math.abs(mk - focusMK);
              const isFocus = dist === 0;
              const inRange = mk >= minMK && mk <= maxMK;
              return (
                <div
                  key={mk}
                  onClick={() => selectMonth(mk)}
                  style={{
                    cursor: inRange ? 'pointer' : 'default',
                    fontSize: (isFocus ? 40 : 34 - dist * 4) * reelScale,
                    fontWeight: isFocus ? 300 : 200,
                    lineHeight: 1.0,
                    letterSpacing: '0.16em',
                    color: `rgba(242,240,230,${Math.max(0.1, 0.34 - dist * 0.07)})`,
                    textShadow: isFocus && chronicle ? '0 0 20px rgba(255,210,63,0.28)' : 'none',
                    transition: 'color 0.25s',
                  }}
                >
                  {mkShort(mk)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hover tooltip (desktop) */}
      {hoverTitle && !card && (
        <div ref={tipRef} style={{ position: 'absolute', transform: 'translate(-50%, -140%)', pointerEvents: 'none', fontFamily: mono, fontSize: 11, color: 'rgba(242,240,230,0.85)', background: 'rgba(5,6,4,0.72)', border: '1px solid rgba(242,240,230,0.12)', padding: '5px 10px', borderRadius: 3, whiteSpace: 'nowrap', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.02em' }}>
          {hoverTitle}
        </div>
      )}

      {/* News card */}
      {card && (
        <div style={{ position: 'absolute', left: card.x, top: card.y, width: 300, background: 'rgba(10,12,8,0.92)', border: '1px solid rgba(242,240,230,0.14)', borderRadius: 6, padding: '16px 18px', backdropFilter: 'blur(12px)', animation: 'cardIn 0.18s ease-out', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: read.has(card.id) ? READ : card.color, boxShadow: `0 0 10px 2px ${read.has(card.id) ? READ + '99' : card.glow}` }} />
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.15em', color: 'rgba(242,240,230,0.5)' }}>RANK #{card.rank}</span>
            </div>
            <button onClick={() => setCard(null)} aria-label="Close" style={{ cursor: 'pointer', color: 'rgba(242,240,230,0.4)', fontSize: 14, lineHeight: 1, padding: '2px 4px', background: 'none', border: 'none' }}>✕</button>
          </div>
          <div style={{ color: '#f2f0e6', fontSize: 15, fontWeight: 500, lineHeight: 1.4, marginBottom: 10 }}>{card.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'rgba(242,240,230,0.4)', letterSpacing: '0.08em' }}>{card.source} · {card.time}</span>
            <a href={card.url} target="_blank" rel="noopener noreferrer" onClick={() => markRead(card.id)} style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.05em', color: read.has(card.id) ? READ : '#ffd23f', textDecoration: 'none' }}>{read.has(card.id) ? 'read ✓' : 'read →'}</a>
          </div>
        </div>
      )}

      {/* Command menu (terse) */}
      {cmdOpen && (
        <div style={{ position: 'absolute', left: '50%', bottom: 68, transform: 'translateX(-50%)', width: 320, maxWidth: '92vw', background: 'rgba(10,12,8,0.95)', border: '1px solid rgba(255,210,63,0.25)', borderRadius: 8, padding: '6px 6px 8px', backdropFilter: 'blur(12px)', boxShadow: '0 16px 48px rgba(0,0,0,0.7)', animation: 'cardIn 0.15s ease-out' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
            {shownCommands.map((c) => (
              <button
                key={c.name}
                onMouseDown={(e) => { e.preventDefault(); pickCommand(c); }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,210,63,0.09)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{ textAlign: 'left', width: '100%', background: 'transparent', border: 'none', borderRadius: 5, padding: '9px 12px', cursor: 'pointer', fontFamily: mono, fontSize: 13, color: '#ffd23f', letterSpacing: '0.03em' }}
              >
                {c.token}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid rgba(242,240,230,0.1)', paddingTop: 8 }}>
            <span style={{ color: '#ffd23f', fontFamily: mono, fontSize: 14, paddingLeft: 6 }}>/</span>
            <input
              ref={cmdRef}
              value={cmdText}
              onChange={(e) => { setCmdText(e.target.value); setCmdFeedback(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') runCommand(cmdText); e.stopPropagation(); }}
              placeholder="type or tap · /help"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f2f0e6', fontFamily: mono, fontSize: 13 }}
            />
          </div>
          {cmdFeedback && <div style={{ marginTop: 7, marginLeft: 12, fontFamily: mono, fontSize: 10, color: 'rgba(255,210,63,0.7)', letterSpacing: '0.04em' }}>{cmdFeedback}</div>}
        </div>
      )}

      {/* / launcher button — touch devices only (desktop uses the / key) */}
      {isTouch && (
        <button
          onClick={() => (cmdOpen ? setCmdOpen(false) : openCmd(false))}
          aria-label="Commands"
          style={{ position: 'absolute', left: 24, bottom: 18, width: 40, height: 40, borderRadius: 9, background: 'rgba(10,12,8,0.9)', border: `1px solid ${cmdOpen ? 'rgba(255,210,63,0.5)' : 'rgba(255,210,63,0.28)'}`, color: '#ffd23f', fontFamily: mono, fontSize: 17, cursor: 'pointer', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
        >
          /
        </button>
      )}

      {/* Help overlay */}
      {helpOpen && (
        <div onClick={() => setHelpOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(2,3,2,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'cardIn 0.15s ease-out', zIndex: 5 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92vw', background: 'rgba(10,12,8,0.96)', border: '1px solid rgba(255,210,63,0.25)', borderRadius: 10, padding: '18px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={{ color: '#f2f0e6', fontSize: 15, fontWeight: 600, letterSpacing: '0.06em' }}>COMMANDS</span>
              <button onClick={() => setHelpOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: 'rgba(242,240,230,0.5)', cursor: 'pointer', fontSize: 15 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {COMMANDS.map((c) => (
                <div key={c.name} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: mono, fontSize: 12.5, color: '#ffd23f', minWidth: 92 }}>{c.token}</span>
                  <span style={{ fontFamily: mono, fontSize: 11.5, color: 'rgba(242,240,230,0.55)' }}>{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status line / desktop hint (stacked above the footer) */}
      {(statusLine || (!isTouch && !cmdOpen)) && (
        <div style={{ position: 'absolute', left: '50%', bottom: 42, transform: 'translateX(-50%)', pointerEvents: 'none', userSelect: 'none', fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', color: 'rgba(242,240,230,0.28)', whiteSpace: 'nowrap', maxWidth: '80vw', overflow: 'hidden', textOverflow: 'ellipsis' }}>{statusLine || 'PRESS / FOR COMMANDS'}</div>
      )}

      {/* Footer credit */}
      <div style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', pointerEvents: 'none', userSelect: 'none', fontFamily: mono, fontSize: 9.5, letterSpacing: '0.14em', color: 'rgba(242,240,230,0.22)', whiteSpace: 'nowrap' }}>
        DESIGNED &amp; CREATED BY CHRIS LEE · © 2026
      </div>

      {/* Empty state */}
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

// ---------- sprite textures ----------
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
  let grad = g.createRadialGradient(64, 74, 4, 64, 74, 54);
  grad.addColorStop(0, 'rgba(255,255,255,0.8)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.2)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.13)';
  g.beginPath(); g.ellipse(48, 58, 11, 19, -0.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(80, 58, 11, 19, 0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath(); g.ellipse(64, 50, 8, 14, 0, 0, Math.PI * 2); g.fill();
  grad = g.createRadialGradient(64, 84, 0, 64, 84, 22);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(64, 84, 15, 20, 0, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
}
