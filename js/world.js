import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const C = { sky: 0xcfc7ad, moss: 0x4a5238, stoneA: 0x77735f, stoneB: 0x655f52, bark: 0x5b4130, wall: 0x2f2c28, maze: 0x6a6354, ink: 0x1d1b19 };
const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function genMaze(N, r) { // depth-first maze, then knock out some walls so it has loops
  const E = new Uint8Array(N * N), S = new Uint8Array(N * N), seen = new Uint8Array(N * N), st = [0]; seen[0] = 1;
  while (st.length) {
    const c = st[st.length - 1], i = c % N, j = (c / N) | 0, nb = [];
    if (i < N - 1 && !seen[c + 1]) nb.push([c + 1, 0]); if (i > 0 && !seen[c - 1]) nb.push([c - 1, 1]);
    if (j < N - 1 && !seen[c + N]) nb.push([c + N, 2]); if (j > 0 && !seen[c - N]) nb.push([c - N, 3]);
    if (!nb.length) { st.pop(); continue; }
    const [n, d] = nb[Math.floor(r() * nb.length)];
    if (d === 0) E[c] = 1; else if (d === 1) E[n] = 1; else if (d === 2) S[c] = 1; else S[n] = 1;
    seen[n] = 1; st.push(n);
  }
  for (let c = 0; c < N * N; c++) { if (r() < 0.12 && c % N < N - 1) E[c] = 1; if (r() < 0.12 && ((c / N) | 0) < N - 1) S[c] = 1; }
  return { N, C: 6, o: -N * 3, E, S };
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.sky, 22, 70);
  scene.add(new THREE.HemisphereLight(0xfff4d6, C.moss, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(6, 12, 4); scene.add(sun);

  const root = new THREE.Group(); scene.add(root);
  const boxes = [], lineMat = new THREE.LineBasicMaterial({ color: C.ink }), c3 = new THREE.Vector3();
  let geos, lgeos;
  const add = (cx, y0, cz, w, h, d, col) => {
    const g = new THREE.BoxGeometry(w, h, d).translate(cx, y0 + h / 2, cz);
    (geos[col] ??= []).push(g); (lgeos[col] ??= []).push(new THREE.EdgesGeometry(g));
    boxes.push(new THREE.Box3(new THREE.Vector3(cx - w / 2, y0, cz - d / 2), new THREE.Vector3(cx + w / 2, y0 + h, cz + d / 2)));
  };
  const flush = () => { // one mesh + one line set per colour keeps draw calls tiny, which matters in a headset
    for (const col in geos) {
      root.add(new THREE.Mesh(mergeGeometries(geos[col]), new THREE.MeshLambertMaterial({ color: +col })));
      root.add(new THREE.LineSegments(mergeGeometries(lgeos[col]), lineMat));
    }
  };

  const api = {
    boxes, obstacles: [], half: 55, maze: null, type: '', spawn: { x: 0, z: 0 },
    collide(p, rad, n) { // sphere vs boxes: deepest penetration (0 = none), push-out normal in n
      let best = 0;
      for (const b of boxes) {
        c3.copy(p).clamp(b.min, b.max);
        const dx = p.x - c3.x, dy = p.y - c3.y, dz = p.z - c3.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= rad * rad) continue;
        const d = Math.sqrt(d2);
        if (d > 1e-6) { if (rad - d > best) { best = rad - d; n.set(dx / d, dy / d, dz / d); } }
        else if (rad + b.max.y - p.y > best) { best = rad + b.max.y - p.y; n.set(0, 1, 0); }
      }
      return best;
    },
    load(type) {
      root.traverse(o => { o.geometry?.dispose(); }); root.clear(); boxes.length = 0; geos = {}; lgeos = {}; this.type = type; this.maze = null;
      const r = type === 'maze' ? Math.random : rng(7);
      if (type === 'arena') {
        this.half = 55;
        add(0, -1, 0, 112, 1, 112, C.moss);
        add(0, 0, -55, 112, 8, 1, C.wall); add(0, 0, 55, 112, 8, 1, C.wall); add(-55, 0, 0, 1, 8, 112, C.wall); add(55, 0, 0, 1, 8, 112, C.wall);
        for (let i = 0; i < 30; i++) { let x = (r() - .5) * 98, z = (r() - .5) * 98; if (Math.hypot(x, z) < 5) x += 8;
          add(x, 0, z, 1 + r() * 2.5, .6 + r() * 2.2, 1 + r() * 2.5, i % 2 ? C.stoneA : C.stoneB); }
        for (let i = 0; i < 16; i++) { let x = (r() - .5) * 100, z = (r() - .5) * 100; if (Math.hypot(x, z) < 5) z -= 8; add(x, 0, z, .9, 3.5 + r() * 1.5, .9, C.bark); }
        for (const [sx, sz] of [[14, -10], [-24, 20]]) for (let i = 0; i < 4; i++) add(sx, 0, sz + i * 2.6, 3, .8 * (4 - i), 2.6, C.stoneA);
        for (const [px, pz] of [[-20, -18], [30, 26]]) { add(px, 3, pz, 6, .4, 6, C.stoneB); for (const [ox, oz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) add(px + ox, 0, pz + oz, .6, 3, .6, C.bark); }
        this.obstacles = boxes.slice(5); this.spawn = { x: 0, z: 0 };
      } else {
        const m = this.maze = genMaze(17, r), { N, C: cs, o } = m, T = 0.8, H = 4.5, W = N * cs; this.half = W / 2;
        add(0, -1, 0, W + 8, 1, W + 8, C.moss);
        add(0, 0, o - T / 2, W + T * 2, H, T, C.wall); add(0, 0, -o + T / 2, W + T * 2, H, T, C.wall);
        add(o - T / 2, 0, 0, T, H, W, C.wall); add(-o + T / 2, 0, 0, T, H, W, C.wall);
        const cover = [];
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const c = i + j * N, cx = o + (i + .5) * cs, cz = o + (j + .5) * cs;
          if (i < N - 1 && !m.E[c]) add(cx + cs / 2, 0, cz, T, H, cs + T, C.maze);
          if (j < N - 1 && !m.S[c]) add(cx, 0, cz + cs / 2, cs + T, H, T, C.maze);
          if ((i || j) && r() < 0.35) { const ox = (r() - .5) * 1.6, oz = (r() - .5) * 1.6;      // something to hide behind
            if (r() < .5) add(cx + ox, 0, cz + oz, 1.6, 1.2, 1.6, C.stoneA); else add(cx + ox, 0, cz + oz, .9, 3.2, .9, C.bark); }
        }
        this.obstacles = []; this.spawn = this.center(0, 0, true);
      }
      flush();
    },
    // ---- maze navigation (cells, BFS distance fields) ----
    cellOf(x, z) { const m = this.maze, f = v => Math.min(m.N - 1, Math.max(0, Math.floor((v - m.o) / m.C))); return [f(x), f(z)]; },
    center(i, j, obj) { const m = this.maze ?? { o: -51, C: 6 }, x = m.o + (i + .5) * m.C, z = m.o + (j + .5) * m.C; return obj ? { x, z } : [x, z]; },
    nbrs(i, j) {
      const m = this.maze, N = m.N, c = i + j * N, o = [];
      if (i < N - 1 && m.E[c]) o.push([i + 1, j]); if (i > 0 && m.E[c - 1]) o.push([i - 1, j]);
      if (j < N - 1 && m.S[c]) o.push([i, j + 1]); if (j > 0 && m.S[c - N]) o.push([i, j - 1]);
      return o;
    },
    _fc: new Map(), _ft: 0,
    field(i, j) {
      const N = this.maze.N, now = performance.now();
      if (now - this._ft > 400) { this._fc.clear(); this._ft = now; }
      const key = i + j * N; let F = this._fc.get(key); if (F) return F;
      F = new Int16Array(N * N).fill(9999); F[key] = 0; const q = [[i, j]];
      for (let h = 0; h < q.length; h++) { const [a, b] = q[h]; for (const [x, y] of this.nbrs(a, b)) if (F[x + y * N] === 9999) { F[x + y * N] = F[a + b * N] + 1; q.push([x, y]); } }
      this._fc.set(key, F); return F;
    },
    next(x, z, gx, gz) { // unit direction along the shortest path to the goal point
      const N = this.maze.N, [i, j] = this.cellOf(x, z), [gi, gj] = this.cellOf(gx, gz);
      if (i === gi && j === gj) { const dx = gx - x, dz = gz - z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; }
      const F = this.field(gi, gj); let best = null, bv = 1e9;
      for (const n of this.nbrs(i, j)) { const v = F[n[0] + n[1] * N]; if (v < bv) { bv = v; best = n; } }
      const [cx, cz] = this.center(i, j), [nx, nz] = this.center(best[0], best[1]), ax = Math.sign(nx - cx), az = Math.sign(nz - cz);
      const ox = x - cx, oz = z - cz, al = ox * ax + oz * az, px = ox - al * ax, pz = oz - al * az;   // pull toward the cell centre line first
      const dx = ax - px * 0.5, dz = az - pz * 0.5, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l];
    },
    points(n) { // spawn points for bots
      if (!this.maze) return Array.from({ length: n }, (_, i) => new THREE.Vector3(Math.cos(i / n * 6.283) * 30, 1, Math.sin(i / n * 6.283) * 30));
      const N = this.maze.N, F = this.field(0, 0), cand = []; for (let c = 1; c < N * N; c++) if (F[c] >= 9) cand.push(c);
      const out = []; while (out.length < n && cand.length) { const c = cand.splice(Math.floor(Math.random() * cand.length), 1)[0], [x, z] = this.center(c % N, (c / N) | 0); out.push(new THREE.Vector3(x, 1, z)); }
      return out;
    }
  };
  api.load('arena');
  return api;
}
