import * as THREE from 'three';
import { Arm } from './arms.js';
import { Hand } from './hand.js';

const R = 0.28, G = 9.8, HR = 0.07, RUST = 0xc2482b, KILL = 0x5a1410;
const FUR = [0xece6d6, 0xcdb892, 0xa9b39a, 0xd8c3a0, 0xb7b0a3, 0xc9b6a8, 0xb9c2b0, 0xe0d2b4];
const EMOTES = { wave: 2.4, chest: 2.0, point: 1.8, cheer: 1.8 }, NAMES = Object.keys(EMOTES);
// running styles: how far the body passes the planted hand before the push (stride), how long the push pose is held (hold),
// swing time, swing height, hop on push, and whether both hands move together
const STYLES = {
  sprinter: { stride: 0.6, hold: 0.12, swing: 0.17, arc: 0.18, bounce: 1.6, sync: false },
  bounder: { stride: 0.5, hold: 0.16, swing: 0.24, arc: 0.30, bounce: 3.2, sync: true },
  scrambler: { stride: 0.34, hold: 0.08, swing: 0.12, arc: 0.10, bounce: 1.2, sync: false },
  heavy: { stride: 0.46, hold: 0.20, swing: 0.22, arc: 0.22, bounce: 2.4, sync: false },
}, SNAMES = Object.keys(STYLES);
const V = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const _n = V(), _f = V(), _r = V(), _t = V(), _s = V(), _pole = V(), _fd = V(), _od = V(), _op = V(), _bp = V(), _bf = V(), _bd = V();
const rnd = (a, b) => a + Math.random() * (b - a), cl = t => Math.min(1, Math.max(0, t)), sm = t => t * t * (3 - 2 * t);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export class Bots {
  constructor(scene, world, player, onEvent = () => {}) {
    this.scene = scene; this.world = world; this.pa = player.actor; this.onEvent = onEvent; this.t = 0;
    this.bots = []; this.actors = [this.pa]; this.snaps = []; this.mode = 'classic'; this.last = -1;
    this.armMat = new THREE.MeshLambertMaterial({ color: 0x3a342d }); this.dark = new THREE.MeshLambertMaterial({ color: 0x1d1b19 });
  }

  alive() { return this.bots.filter(b => !b.dead).length; }

  clear() {
    for (const b of this.bots) { this.scene.remove(b.g); b.hands.forEach(h => this.scene.remove(h.hd.group)); b.arms.forEach(a => a.dispose(this.scene)); }
    this.bots = [];
  }

  reset(mode, count) {
    this.clear(); this.mode = mode; this.snaps.length = 0;
    const pts = this.world.points(count); let kIdx = -1;
    if (mode === 'killer') { do { kIdx = Math.floor(Math.random() * pts.length); } while (kIdx === this.last && pts.length > 1); this.last = kIdx; }
    this.bots = pts.map((p, i) => this.make(p, i === kIdx));
    this.actors = [this.pa, ...this.bots]; this.actors.forEach((a, i) => { a.i = i; });
    this.pa.dead = false; this.pa.cool = 0;
    if (mode === 'classic') this.setIt(this.bots[0]);
    else { this.actors.forEach(a => { a.it = false; }); this.pa.it = true; if (kIdx >= 0) this.bots[kIdx].it = true; this.recolor(); }
  }

  make(p, killer) {
    const skill = killer ? 0.95 : rnd(0.25, 1), s = killer ? 1.5 : rnd(0.93, 1.07), fur = FUR[Math.floor(Math.random() * FUR.length)];
    const mat = new THREE.MeshLambertMaterial({ color: fur }), g = new THREE.Group(); g.scale.setScalar(s); this.scene.add(g);
    const part = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    part(new THREE.SphereGeometry(R, 16, 12), mat, 0, 0, 0).scale.set(1.1, 1.05, 0.9);
    part(new THREE.SphereGeometry(0.13, 12, 10), mat, 0, 0.22, 0.15);
    part(new THREE.BoxGeometry(0.14, 0.08, 0.05), this.dark, 0, 0.2, 0.26);
    part(new THREE.BoxGeometry(0.18, 0.03, 0.06), this.dark, 0, 0.28, 0.24);
    const pos = p.clone(); pos.y = R * s;
    const hands = [0, 1].map(k => { const hd = new Hand(); hd.setSide(k ? 1 : -1); hd.group.scale.setScalar(s); this.scene.add(hd.group);
      return { hd, pos: new THREE.Vector3(pos.x + (k ? -0.2 : 0.2) * s, HR * s, pos.z + (k ? -0.25 : 0.1) * s), from: V(), to: V(), vel: V(), state: 'plant', t: 0 }; });
    const arms = [0, 1].map(() => { const a = new Arm(this.scene, this.armMat); a.len = 0.34 * s; return a; });
    return { pos, vel: V(), g, mat, fur, s, skill, hands, arms, killer, style: STYLES[killer ? 'heavy' : SNAMES[Math.floor(Math.random() * SNAMES.length)]],
      react: killer ? 0.12 : 0.6 - 0.5 * skill + rnd(0, 0.08), sm: (0.78 + 0.4 * skill) * (killer ? 1.12 : 1),
      yaw: rnd(0, 6.28), it: false, cool: 0, grounded: false, dead: false, av: V(), stumble: 0,
      hide: pos.clone(), hideT: 0, jukeT: 0, jukeS: 1, jukeBad: false, jukeCd: rnd(0, 2), emote: null, emoteCd: 0, seen: false, wallCd: 0, wallT: 0, wn: V() };
  }

  recolor() { this.bots.forEach(b => b.mat.color.setHex(b.it ? (this.mode === 'classic' ? RUST : KILL) : b.fur)); }
  setIt(a) { this.actors.forEach(x => { x.it = x === a; }); this.recolor(); }

  // bots perceive the world `react` seconds late: they read an old snapshot of everyone's position
  record() {
    const a = new Float32Array(this.actors.length * 4);
    this.actors.forEach((x, i) => { a[i * 4] = x.pos.x; a[i * 4 + 1] = x.pos.z; a[i * 4 + 2] = x.vel.x; a[i * 4 + 3] = x.vel.z; });
    this.snaps.push({ t: this.t, a }); while (this.snaps.length > 2 && this.snaps[0].t < this.t - 1.5) this.snaps.shift();
  }
  snap(delay) { const T = this.t - delay; for (let i = this.snaps.length - 1; i >= 0; i--) if (this.snaps[i].t <= T) return this.snaps[i].a; return this.snaps[0].a; }

  toward(b, tx, tz) {
    if (this.world.maze) return this.world.next(b.pos.x, b.pos.z, tx, tz);
    const dx = tx - b.pos.x, dz = tz - b.pos.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l];
  }

  juke(b, dist, range) {
    if (b.jukeT > 0 || b.jukeCd > 0 || dist > range) return;
    b.jukeT = 0.45; b.jukeS = Math.random() < 0.5 ? -1 : 1; b.jukeBad = Math.random() < (1 - b.skill) * 0.5;   // low skill: the juke gets fumbled
    b.jukeCd = 3.2 - 1.8 * b.skill + rnd(0, 1.2);
  }

  pickHide(b, tx, tz) {
    const w = this.world, others = this.bots.filter(q => q !== b && !q.it && !q.dead), noise = (1 - b.skill) * 8;
    if (w.maze) {
      const N = w.maze.N, FM = w.field(...w.cellOf(b.pos.x, b.pos.z)), FT = w.field(...w.cellOf(tx, tz)), oc = others.map(q => w.cellOf(q.hide.x, q.hide.z));
      let best = 1e9, bc = 0;
      for (let c = 0; c < N * N; c++) {
        let cost = FM[c] - 0.9 * FT[c] + Math.random() * noise; const i = c % N, j = (c / N) | 0;
        for (const [qi, qj] of oc) if (Math.abs(i - qi) + Math.abs(j - qj) < 4) cost += 10;
        if (cost < best) { best = cost; bc = c; }
      }
      const [x, z] = w.center(bc % N, (bc / N) | 0); b.hide.set(x, 0, z); return;
    }
    let best = 1e9; const lim = w.half - 3;
    for (const o of w.obstacles) {
      o.getCenter(_t); const rad = Math.hypot(o.max.x - o.min.x, o.max.z - o.min.z) / 2 + 0.9;
      const dx = _t.x - tx, dz = _t.z - tz, l = Math.hypot(dx, dz) || 1;
      const x = THREE.MathUtils.clamp(_t.x + dx / l * rad, -lim, lim), z = THREE.MathUtils.clamp(_t.z + dz / l * rad, -lim, lim);
      let cost = Math.hypot(x - b.pos.x, z - b.pos.z) - 0.5 * Math.hypot(x - tx, z - tz) + Math.random() * (3 + noise);
      for (const q of others) if (Math.hypot(x - q.hide.x, z - q.hide.z) < 6) cost += 12;
      if (cost < best) { best = cost; b.hide.set(x, 0, z); }
    }
  }

  startEmote(b, th) { b.emote = { name: NAMES[Math.floor(Math.random() * NAMES.length)], t: 0, a: 0, b: 0, it: th }; b.hands.forEach(h => { h.state = 'plant'; }); }

  update(dt) {
    this.t += dt; this.record();
    const { world, pa: P, mode } = this, maze = !!world.maze, threats = this.actors.filter(a => a.it && !a.dead);
    for (const b of this.bots) {
      if (b.dead) { this.rag(b, dt); continue; }
      b.hideT -= dt; b.jukeCd -= dt; b.wallCd -= dt; b.emoteCd -= dt; b.wallT -= dt; b.cool = Math.max(0, b.cool - dt);
      const S = this.snap(b.react), X = a => S[a.i * 4], Z = a => S[a.i * 4 + 1], VX = a => S[a.i * 4 + 2], VZ = a => S[a.i * 4 + 3];
      const k = b.skill, jr = 3.5 + 2 * k, dP = Math.hypot(X(P) - b.pos.x, Z(P) - b.pos.z);
      let dx = 0, dz = 0, spd = 0, look = null;

      if (b.emote) {
        look = P; b.emote.t += dt;
        if (b.emote.t > EMOTES[b.emote.name] + 0.35) { b.emote = null; b.emoteCd = 6; }
      } else if (b.it) {
        let tg = P;
        if (mode === 'classic') { let best = 1e9; for (const a of this.actors) { if (a === b || a.dead) continue; const d = Math.hypot(X(a) - b.pos.x, Z(a) - b.pos.z); if (d < best) { best = d; tg = a; } } }
        const lead = 0.15 + 0.45 * k, tx = X(tg) + VX(tg) * lead, tz = Z(tg) + VZ(tg) * lead;
        [dx, dz] = this.toward(b, tx, tz); spd = b.cool > 0 ? 2 : 5.4 * b.sm;
        this.juke(b, Math.hypot(tx - b.pos.x, tz - b.pos.z), jr);
      } else {
        let th = null, dIt = 1e9;
        for (const a of threats) { const d = Math.hypot(X(a) - b.pos.x, Z(a) - b.pos.z); if (d < dIt) { dIt = d; th = a; } }
        if (dP > 9) b.seen = false;
        if (!th) look = P;
        else if (mode === 'classic' && !P.it && dIt > 9 && dP < 5) {   // free player walked up: turn to face them, maybe do something
          look = P; if (!b.seen) { b.seen = true; if (b.emoteCd <= 0 && Math.random() < 0.7) this.startEmote(b, th); }
        } else {
          const alarm = dIt < (maze ? 16 : 7);
          if (b.hideT <= 0) { this.pickHide(b, X(th), Z(th)); b.hideT = alarm ? 1.2 : 2.5; }
          const dh = Math.hypot(b.hide.x - b.pos.x, b.hide.z - b.pos.z);
          if (alarm || dh > 1) {
            [dx, dz] = this.toward(b, b.hide.x, b.hide.z); spd = (alarm ? 5 : 4.2) * b.sm;
            if (alarm && !maze) { const ax = b.pos.x - X(th), az = b.pos.z - Z(th), al = Math.hypot(ax, az) || 1; dx += ax / al * 0.8; dz += az / al * 0.8; }
            if (alarm) this.juke(b, dIt, jr);
          } else look = th;
          if (spd > 0) for (const q of this.bots) if (q !== b && !q.it && !q.dead) {   // don't clump
            const sx = b.pos.x - q.pos.x, sz = b.pos.z - q.pos.z, sl = Math.hypot(sx, sz);
            if (sl < 4 && sl > 0.01) { dx += sx / sl * 0.8; dz += sz / sl * 0.8; }
          }
        }
      }

      if (spd > 0 && !maze) { const lim = world.half - 4; if (Math.abs(b.pos.x) > lim) dx -= Math.sign(b.pos.x) * 0.8; if (Math.abs(b.pos.z) > lim) dz -= Math.sign(b.pos.z) * 0.8; }
      const l = Math.hypot(dx, dz);
      if (spd > 0 && l > 1e-3) { dx /= l; dz /= l; } else { spd = 0; dx = Math.sin(b.yaw); dz = Math.cos(b.yaw); }
      if (b.jukeT > 0 && spd > 0) {
        b.jukeT -= dt; const a = (b.jukeBad ? 0.3 : 0.9 + 0.6 * k) * b.jukeS, c = Math.cos(a), sn = Math.sin(a);
        [dx, dz] = [dx * c - dz * sn, dx * sn + dz * c]; spd *= b.jukeBad ? 0.6 : 1.15;
      }
      if (spd > 0 && b.stumble <= 0 && Math.random() < dt * (1 - k) * 0.12) b.stumble = 0.7;   // low skill bots trip
      if (b.stumble > 0) { b.stumble -= dt; spd *= 0.35; }

      this.move(b, dx, dz, spd, dt);
      let ty = b.yaw;
      if (spd > 0 && Math.hypot(b.vel.x, b.vel.z) > 0.5) ty = Math.atan2(b.vel.x, b.vel.z);
      else if (look) ty = Math.atan2(look.pos.x - b.pos.x, look.pos.z - b.pos.z);
      b.yaw += angDiff(b.yaw, ty) * Math.min(1, dt * 8);
      this.pose(b, dt);
    }
    for (const a of this.actors) a.cool = Math.max(0, a.cool - dt);

    if (mode === 'classic') {
      const it = this.actors.find(a => a.it); if (!it || it.cool > 0) return;
      for (const o of this.actors) {
        if (o === it) continue;
        let d = it.pos.distanceTo(o.pos) - (it.player || o.player ? 0.1 : 0);
        if (it.player) d = Math.min(d, ...it.hands.map(h => h.distanceTo(o.pos) + 0.1));
        if (d < 0.7) { this.setIt(o); o.cool = 2.5; this.onEvent({ type: 'tag', player: it.player || o.player }); break; }
      }
    } else {
      for (const kb of this.bots) if (kb.killer && !kb.dead && kb.pos.distanceTo(P.pos) < 0.7 * kb.s + 0.45) { this.onEvent({ type: 'playerDead' }); return; }
      for (const o of this.bots) {
        if (o.dead) continue;
        const d = Math.min(P.pos.distanceTo(o.pos), ...P.hands.map(h => h.distanceTo(o.pos) + 0.1)) - (o.s - 1) * 0.3;
        if (d < 0.7 * P.size) { this.kill(o); this.onEvent({ type: 'kill' }); }
      }
    }
  }

  kill(b) {
    b.dead = true; b.it = false; b.emote = null;
    b.vel.addScaledVector(this.pa.vel, 0.7); b.vel.y += 3; b.av.set(rnd(-6, 6), 0, rnd(-6, 6));
    b.hands.forEach(h => { h.state = 'dead'; h.vel.copy(b.vel).add(_t.set(rnd(-2, 2), rnd(0, 2), rnd(-2, 2))); h.hd.set(0.4, 0.4); });
  }

  // ragdoll: tumbling torso, hands dangle on a leash
  rag(b, dt) {
    const s = b.s, hit = (p, r) => { const h = this.world.collide(p, r, _n); if (h > 0) p.addScaledVector(_n, h); return h > 0; };
    b.vel.y -= G * dt; b.pos.addScaledVector(b.vel, dt);
    if (hit(b.pos, R * s)) { const vn = b.vel.dot(_n); if (vn < 0) b.vel.addScaledVector(_n, -vn * 1.3); const f = 1 - Math.min(1, dt * 3); b.vel.x *= f; b.vel.z *= f; b.av.multiplyScalar(0.9); }
    b.g.position.copy(b.pos); b.g.rotation.x += b.av.x * dt; b.g.rotation.z += b.av.z * dt; b.av.multiplyScalar(1 - dt);
    for (let i = 0; i < 2; i++) {
      const H = b.hands[i], side = i ? 1 : -1; H.vel.y -= G * dt; H.pos.addScaledVector(H.vel, dt);
      if (hit(H.pos, HR * s)) { const vn = H.vel.dot(_n); if (vn < 0) H.vel.addScaledVector(_n, -vn * 1.2); H.vel.x *= 0.9; H.vel.z *= 0.9; }
      _s.set(b.pos.x + side * 0.24 * s, b.pos.y + 0.08 * s, b.pos.z);
      _t.subVectors(H.pos, _s); const l = _t.length(), max = 0.66 * s;
      if (l > max) { _t.multiplyScalar(max / l); H.pos.copy(_s).add(_t); H.vel.addScaledVector(_t, -2 * dt); H.vel.add(b.vel.clone().multiplyScalar(0.1)); }
      H.hd.group.position.copy(H.pos); H.hd.orient(DOWN, _f.set(side, 0, 0), side); H.hd.update(dt);
      b.arms[i].solve(_s, H.pos, _pole.set(side * 0.6, -0.7, -0.3));
    }
  }

  // locomotion: speed only comes from planted hands. plant, body passes over, hold a push pose, release, swing forward.
  move(b, dx, dz, spd, dt) {
    const st = b.style, s = b.s, want = spd > 0; let planted = 0, thrust = false;
    for (let i = 0; i < 2; i++) {
      const H = b.hands[i], O = b.hands[1 - i], side = i ? 1 : -1, rel = () => { H.state = 'swing'; H.t = 0; H.from.copy(H.pos); planted--; };
      if (H.state === 'plant') {
        planted++;
        const behind = (b.pos.x - H.pos.x) * dx + (b.pos.z - H.pos.z) * dz;
        if (want && behind > st.stride * s && (st.sync ? O.state === 'plant' : (O.state !== 'swing' || O.t > 0.5))) {
          H.state = 'push'; H.t = 0; if (st.sync && O.state === 'plant') { O.state = 'push'; O.t = 0; }
          if (b.grounded) b.vel.y = Math.max(b.vel.y, st.bounce);
        } else if (b.pos.distanceTo(H.pos) > 0.85 * s) rel();
      } else if (H.state === 'push') {
        planted++; thrust = true; H.t += dt;
        if (H.t > st.hold || b.pos.distanceTo(H.pos) > 0.95 * s) rel();
      } else {
        H.t += dt / st.swing;
        H.to.set(b.pos.x + dx * 0.55 * s - dz * side * 0.18 * s, HR * s, b.pos.z + dz * 0.55 * s + dx * side * 0.18 * s);
        const k = this.world.collide(H.to, HR * s, _n); if (k > 0) H.to.addScaledVector(_n, k);
        const e = Math.min(H.t, 1); H.pos.lerpVectors(H.from, H.to, sm(e)); H.pos.y += Math.sin(Math.PI * e) * st.arc * s;
        if (H.t >= 1) { H.state = 'plant'; H.pos.copy(H.to); planted++; }
      }
    }
    if (want && thrust) { const k = Math.min(1, dt * 14); b.vel.x += (dx * spd * 1.25 - b.vel.x) * k; b.vel.z += (dz * spd * 1.25 - b.vel.z) * k; }
    else if (want && planted > 0) { const k = Math.min(1, dt * 2.5); b.vel.x += (dx * spd * 0.9 - b.vel.x) * k; b.vel.z += (dz * spd * 0.9 - b.vel.z) * k; }
    else if (b.grounded) { const k = 1 - Math.min(1, dt * 6); b.vel.x *= k; b.vel.z *= k; }
    if (want && planted > 0 && b.pos.y < 0.55 * s) b.vel.y += (0.55 * s - b.pos.y) * 40 * dt;   // body rides up on the arms

    const e = b.emote;
    if (e?.name === 'cheer' && b.grounded) { if (e.t > 0.1 && !e.a) { e.a = 1; b.vel.y = 3.4; } if (e.t > 0.9 && !e.b) { e.b = 1; b.vel.y = 3.4; } }

    b.vel.y -= G * dt; b.pos.addScaledVector(b.vel, dt); b.grounded = false;
    const hit = this.world.collide(b.pos, R * s, _n);
    if (hit > 0) {
      b.pos.addScaledVector(_n, hit); const v = b.vel.dot(_n); if (v < 0) b.vel.addScaledVector(_n, -v);
      if (_n.y > 0.6) b.grounded = true;
      else if (Math.abs(_n.y) < 0.35 && want && b.wallCd <= 0) {   // wall kick: good bots land it, bad bots try and flop
        b.wallCd = 0.9; b.wallT = 0.25; b.wn.copy(_n);
        if (Math.random() < 0.35 + 0.65 * b.skill) b.vel.set(_n.x * 2.4 + dx * spd * 0.6, 4.6, _n.z * 2.4 + dz * spd * 0.6);
        else { b.vel.set(_n.x * 1.2, 1.6, _n.z * 1.2); b.stumble = 0.6; }
      }
    }
  }

  pose(b, dt) {
    const s = b.s, f = _f.set(Math.sin(b.yaw), 0, Math.cos(b.yaw)), r = _r.set(-f.z, 0, f.x), e = b.emote;
    b.g.position.copy(b.pos); b.g.rotation.set(0, b.yaw, 0);
    let w = 0;   // gesture blend weight: eases in and out so gestures never snap
    if (e) w = sm(cl(e.t / 0.35)) * sm(cl((EMOTES[e.name] + 0.35 - e.t) / 0.35));
    else if (b.wallT > 0) w = sm(cl(b.wallT / 0.1)) * sm(cl((0.25 - b.wallT) / 0.06));
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, H = b.hands[i];
      const bp = _bp.copy(H.pos), bf = _bf.copy(f), bd = _bd.copy(DOWN); let ci = 1, cg = 1;
      if (w > 0) {
        let has = false, oci = 1, ocg = 1, ofd = f, opd = DOWN;
        if (e) switch (e.name) {
          case 'wave': if (i === 1) { _t.copy(b.pos).addScaledVector(r, (0.35 + 0.1 * Math.sin(e.t * 11)) * s).addScaledVector(f, 0.12 * s); _t.y += 0.62 * s; has = true; ofd = UP; opd = f; oci = ocg = 0; } break;
          case 'chest': _t.copy(b.pos).addScaledVector(f, (0.3 + 0.05 * Math.max(0, Math.sin(e.t * 13 + i * Math.PI))) * s).addScaledVector(r, side * 0.13 * s); has = true; break;
          case 'point': if (i === 1) { const tg = e.it || this.pa; _od.set(tg.pos.x - b.pos.x, 0, tg.pos.z - b.pos.z).normalize(); _t.copy(b.pos).addScaledVector(_od, 0.62 * s); _t.y += 0.15 * s; has = true; ofd = _od; oci = 0; } break;
          case 'cheer': _t.copy(b.pos).addScaledVector(r, side * 0.32 * s); _t.y += (0.55 + 0.05 * Math.sin(e.t * 14)) * s; has = true; ofd = UP; opd = f; oci = ocg = 0; break;
        } else { _t.copy(b.pos).addScaledVector(b.wn, -(R + 0.07) * s).addScaledVector(r, side * 0.15 * s); _t.y += (0.1 + 0.15 * i) * s; has = true; ofd = UP; opd = b.wn; oci = ocg = 0; }
        if (has) { bp.lerp(_t, w); bf.lerp(ofd, w).normalize(); bd.lerp(opd, w).normalize(); ci += (oci - 1) * w; cg += (ocg - 1) * w; }
      }
      H.hd.group.position.copy(bp); H.hd.orient(bf, bd, side); H.hd.set(ci, cg); H.hd.update(dt);
      _s.copy(b.pos).addScaledVector(r, side * 0.24 * s); _s.y += 0.08 * s;
      _pole.copy(r).multiplyScalar(side * 0.6).addScaledVector(DOWN, 0.7).addScaledVector(f, -0.5);
      b.arms[i].solve(_s, bp, _pole);
    }
  }
}
