/* ═══════════════════════════════════════════════════════════
   Live 2D LiDAR simulation.

   A sensor sits in the hero and sweeps a beam through 360°.
   Every frame we cast rays across the arc the beam just crossed,
   intersect them against the scene geometry, and keep the hit
   points around for a few seconds while they fade.

   Two of the obstacles move: one drifts on a slow Lissajous so the
   scene is never dead, and one tracks your cursor. Points that land
   on a moving obstacle get tagged, clustered, and boxed — which is,
   in miniature, the thing I do for a living.
   ═══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const canvas = document.getElementById('lidar');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── tunables ──────────────────────────────────────────── */
  const PERIOD    = 3600;    // ms for one full revolution
  const LIFE      = 2900;    // ms a hit point stays visible
  const ANG_RES   = 0.0038;  // rad between rays (~0.22°)
  const MAX_RAYS  = 26;      // per frame, guards against tab-restore spikes
  const DOT       = 1.9;     // px

  /* ── state ─────────────────────────────────────────────── */
  let W = 0, H = 0, dpr = 1;
  let ox = 0, oy = 0;
  let R = 100;                      // room scale + range-ring spacing unit
  let RANGE = 200;                  // how far the sensor actually sees
  const RINGS = 5;                  // one ring per metre, so RANGE = 5 m
  let segs = [];                    // static walls   [{x1,y1,x2,y2}]
  let cursor  = { x: 0, y: 0, r: 30, live: false, tag: 'cursor' };
  let orbiter = { x: 0, y: 0, r: 22, live: true,  tag: 'orbit'  };

  let pts = [];                     // {x, y, born, tag}
  let sweep = -Math.PI / 2;         // current beam angle
  let last = 0, elapsed = 0;
  let running = true, visible = true;
  let mouse = null;                 // null until the pointer arrives

  let COL = {};

  /* ── theme-aware colours, read from CSS ────────────────── */
  function readColours() {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    COL = {
      accent: v('--accent'),
      ink:    v('--ink'),
      mute:   v('--ink-mute'),
      line:   v('--line')
    };
  }

  /* ── geometry ──────────────────────────────────────────── */
  function layout() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const narrow = W < 860;
    ox = narrow ? W * 0.50 : W * 0.70;
    oy = narrow ? H * 0.60 : H * 0.50;
    // Sized so the room below stays inside the canvas on both axes.
    R  = narrow ? Math.min(W * 0.58, H * 0.34) : Math.min(W * 0.36, H * 0.60);

    // The far corners of the room sit at ~1.88 R. Range has to clear them,
    // otherwise the walls return nothing and the scan looks empty.
    RANGE = R * 2.0;

    cursor.r  = R * 0.10;
    orbiter.r = R * 0.07;

    // The room, in units of R relative to the sensor. Vertical extent is
    // held to ±0.62R so the walls clear the scrim's top and bottom fades —
    // push them further out and they vanish into the background. The left
    // side runs off behind the headline on purpose.
    const S = [
      [-1.70, -0.62,  0.44, -0.62],   // back wall
      [ 0.44, -0.62,  0.82, -0.30],   // upper chamfer
      [ 0.82, -0.30,  0.82,  0.32],   // right wall
      [ 0.82,  0.32,  0.44,  0.62],   // lower chamfer
      [ 0.44,  0.62, -1.70,  0.62],   // near wall

      [ 0.06, -0.46,  0.30, -0.50],   // pillar, 4 faces
      [ 0.30, -0.50,  0.34, -0.24],
      [ 0.34, -0.24,  0.10, -0.20],
      [ 0.10, -0.20,  0.06, -0.46],

      [ 0.40,  0.30,  0.58,  0.25],   // crate, 4 faces
      [ 0.58,  0.25,  0.62,  0.44],
      [ 0.62,  0.44,  0.44,  0.49],
      [ 0.44,  0.49,  0.40,  0.30]
    ];
    segs = S.map(([a, b, c, d]) => ({
      x1: ox + a * R, y1: oy + b * R,
      x2: ox + c * R, y2: oy + d * R
    }));

    if (!mouse) { cursor.x = ox + R * 0.30; cursor.y = oy + R * 0.42; }
  }

  /* ── intersections ─────────────────────────────────────── */
  function raySeg(dx, dy, s) {
    const ex = s.x2 - s.x1, ey = s.y2 - s.y1;
    const D = dx * ey - ex * dy;
    if (Math.abs(D) < 1e-9) return Infinity;
    const px = s.x1 - ox, py = s.y1 - oy;
    const t = (px * ey - ex * py) / D;
    const u = (dy * px - dx * py) / D;
    return (t > 0 && u >= 0 && u <= 1) ? t : Infinity;
  }

  function rayCircle(dx, dy, c) {
    const fx = ox - c.x, fy = oy - c.y;
    const b = 2 * (fx * dx + fy * dy);
    const k = fx * fx + fy * fy - c.r * c.r;
    const disc = b * b - 4 * k;
    if (disc < 0) return Infinity;
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / 2;
    if (t1 > 0) return t1;
    const t2 = (-b + sq) / 2;
    return t2 > 0 ? t2 : Infinity;
  }

  function cast(angle) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let best = RANGE, tag = null;

    for (let i = 0; i < segs.length; i++) {
      const t = raySeg(dx, dy, segs[i]);
      if (t < best) { best = t; tag = 'wall'; }
    }
    for (const c of [cursor, orbiter]) {
      if (!c.live) continue;
      const t = rayCircle(dx, dy, c);
      if (t < best) { best = t; tag = c.tag; }
    }
    if (tag === null) return null;                 // nothing in range
    return { x: ox + dx * best, y: oy + dy * best, tag };
  }

  /* ── frame ─────────────────────────────────────────────── */
  function step(now) {
    if (!running) { last = now; requestAnimationFrame(step); return; }

    const dt = Math.min(now - last, 64);           // clamp after tab switch
    last = now;
    elapsed += dt;

    /* move the obstacles — both stay clear of the pillar and the crate */
    const T = elapsed / 1000;
    orbiter.x = ox + (-0.28 + Math.cos(T * 0.34) * 0.32) * R;
    orbiter.y = oy + ( 0.15 + Math.sin(T * 0.47) * 0.34) * R;

    cursor.live = true;
    if (mouse) {
      cursor.x += (mouse.x - cursor.x) * 0.12;     // lag behind the pointer
      cursor.y += (mouse.y - cursor.y) * 0.12;
    } else {
      cursor.x = ox + (0.15 + Math.cos(T * 0.21 + 2.1) * 0.45) * R;
      cursor.y = oy + (0.05 + Math.sin(T * 0.29 + 0.7) * 0.50) * R;
    }

    /* advance the beam, casting across the arc it crossed */
    const dAng = (dt / PERIOD) * Math.PI * 2;
    const n = Math.min(Math.ceil(dAng / ANG_RES), MAX_RAYS);
    for (let i = 0; i < n; i++) {
      const a = sweep + (dAng * i) / n;
      const hit = cast(a);
      if (hit) { hit.born = now; pts.push(hit); }
    }
    sweep = (sweep + dAng) % (Math.PI * 2);

    /* retire old points */
    const cut = now - LIFE;
    let w = 0;
    for (let i = 0; i < pts.length; i++) if (pts[i].born > cut) pts[w++] = pts[i];
    pts.length = w;

    draw(now);
    requestAnimationFrame(step);
  }

  /* ── render ────────────────────────────────────────────── */
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    /* range rings — one per metre — plus the sensor crosshair */
    ctx.strokeStyle = COL.mute;
    ctx.lineWidth = 1;
    for (let i = 1; i <= RINGS; i++) {
      ctx.globalAlpha = 0.155 - i * 0.019;
      ctx.beginPath();
      ctx.arc(ox, oy, (RANGE / RINGS) * i, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(ox - 7, oy); ctx.lineTo(ox + 7, oy);
    ctx.moveTo(ox, oy - 7); ctx.lineTo(ox, oy + 7);
    ctx.stroke();

    /* sweep wedge */
    const TRAIL = 0.5;                                    // rad
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, RANGE);
    g.addColorStop(0,    withAlpha(COL.accent, 0.20));
    g.addColorStop(0.55, withAlpha(COL.accent, 0.06));
    g.addColorStop(1,    withAlpha(COL.accent, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, RANGE, sweep - TRAIL, sweep);
    ctx.closePath();
    ctx.fill();

    /* leading edge of the beam */
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = COL.accent;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(sweep) * RANGE, oy + Math.sin(sweep) * RANGE);
    ctx.stroke();

    /* the point cloud */
    let live = 0;
    const box = { minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9, n: 0 };
    const tags = new Set();

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const age = (now - p.born) / LIFE;
      if (age > 1) continue;
      live++;
      tags.add(p.tag);

      const fade = 1 - age * age;                         // hold, then drop
      const onCursor = p.tag === 'cursor';

      ctx.globalAlpha = fade * (onCursor ? 1 : 0.72);
      ctx.fillStyle = onCursor ? COL.accent : COL.mute;
      const d = onCursor ? DOT + 0.9 : DOT;
      ctx.fillRect(p.x - d / 2, p.y - d / 2, d, d);

      if (onCursor && age < 0.55) {                       // only fresh returns
        if (p.x < box.minX) box.minX = p.x;
        if (p.y < box.minY) box.minY = p.y;
        if (p.x > box.maxX) box.maxX = p.x;
        if (p.y > box.maxY) box.maxY = p.y;
        box.n++;
      }
    }

    /* cluster bounding box — the perception money shot */
    if (box.n > 6) {
      const pad = 9;
      const x = box.minX - pad, y = box.minY - pad;
      const w = box.maxX - box.minX + pad * 2;
      const h = box.maxY - box.minY + pad * 2;

      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = COL.accent;
      ctx.lineWidth = 1;
      corners(x, y, w, h, Math.min(11, w / 3, h / 3));

      ctx.globalAlpha = 0.75;
      ctx.fillStyle = COL.accent;
      ctx.font = `500 10px ${mono()}`;
      ctx.textBaseline = 'bottom';
      const dist = Math.hypot(cursor.x - ox, cursor.y - oy) / RANGE * RINGS;
      ctx.fillText(`obstacle · ${dist.toFixed(2)} m`, x, y - 5);
    }

    ctx.globalAlpha = 1;
    readout(live, tags.size);
  }

  /* corner-bracket box, the way RViz draws them */
  function corners(x, y, w, h, c) {
    ctx.beginPath();
    ctx.moveTo(x, y + c);         ctx.lineTo(x, y);          ctx.lineTo(x + c, y);
    ctx.moveTo(x + w - c, y);     ctx.lineTo(x + w, y);      ctx.lineTo(x + w, y + c);
    ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w, y + h);  ctx.lineTo(x + w - c, y + h);
    ctx.moveTo(x + c, y + h);     ctx.lineTo(x, y + h);      ctx.lineTo(x, y + h - c);
    ctx.stroke();
  }

  /* ── the little telemetry panel ────────────────────────── */
  const elPts = document.getElementById('roPoints');
  const elCls = document.getElementById('roClusters');
  let tick = 0;
  function readout(n, clusters) {
    if (tick++ % 6) return;                               // 10 Hz is plenty
    if (elPts) elPts.textContent = String(n).padStart(4, '0');
    if (elCls) elCls.textContent = String(clusters);
  }

  /* ── helpers ───────────────────────────────────────────── */
  function mono() {
    return getComputedStyle(document.documentElement).getPropertyValue('--mono') || 'monospace';
  }

  /* Accepts hex from CSS custom properties and returns rgba().
     Anything that is not hex is handed back untouched — an opaque
     gradient stop beats a thrown exception. */
  function withAlpha(col, a) {
    if (!col || col[0] !== '#') return col || 'transparent';
    const h = col.slice(1);
    const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(f, 16);
    if (Number.isNaN(num)) return col;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${a})`;
  }

  /* ── static render for reduced-motion users ────────────── */
  function still() {
    layout(); readColours();
    cursor.live = orbiter.live = true;
    orbiter.x = ox + R * 0.52; orbiter.y = oy - R * 0.1;
    cursor.x  = ox - R * 0.4;  cursor.y  = oy + R * 0.3;
    const now = performance.now();
    for (let a = 0; a < Math.PI * 2; a += ANG_RES * 2) {
      const hit = cast(a);
      if (hit) { hit.born = now; pts.push(hit); }
    }
    sweep = -Math.PI / 2;
    draw(now);
  }

  /* ── wiring ────────────────────────────────────────────── */
  readColours();
  layout();

  addEventListener('resize', () => {
    const had = pts.length;
    layout();
    if (had) pts.length = 0;                              // scene moved, cloud is stale
    if (reduce) still();
  }, { passive: true });

  document.addEventListener('themechange', () => {
    readColours();
    if (reduce) draw(performance.now());
  });

  const hero = canvas.closest('.hero');
  addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    if (e.clientY > r.bottom) return;                     // scrolled past
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  }, { passive: true });

  addEventListener('pointerleave', () => { mouse = null; }, { passive: true });

  /* stop burning frames when nobody is looking */
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; running = visible && !document.hidden; },
      { threshold: 0 }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => { running = visible && !document.hidden; });

  if (reduce) {
    still();
  } else {
    last = performance.now();
    requestAnimationFrame(step);
  }
})();
