import * as THREE from 'three';
import { Arm } from './arms.js';
import { Hand } from './hand.js';

const R = 0.28, G = 9.8, HR = 0.07, RUST = 0xc2482b;
const FUR = [0xece6d6, 0xcdb892, 0xa9b39a, 0xd8c3a0, 0xb7b0a3];
const EMOTES = { wave: 2.4, chest: 2.0, point: 1.8, cheer: 1.8 }, NAMES = Object.keys(EMOTES);
const V = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const _n = V(), _f = V(), _r = V(), _t = V(), _s = V(), _pole = V(), _fd = V(), _c = V();
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export class Bots {
  constructor(scene, world, player, count = 5, onTag = () => {}) {
    this.world = world; this.player = player.actor; this.onTag = onTag; this.t = 0;
    const armMat = new THREE.MeshLambertMaterial({ color: 0x3a342d }), dark = new THREE.MeshLambertMaterial({ color: 0x1d1b19 });
    this.bots = Array.from({ length: count }, (_, i) => {
      const a = i / count * Math.PI * 2, mat = new THREE.MeshLambertMaterial({ color: FUR[i % 5] }), g = new THREE.Group(); scene.add(g);
      const part = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
      part(new THREE.SphereGeometry(R, 16, 12), mat, 0, 0, 0).scale.set(1.1, 1.05, 0.9);   // torso
      part(new THREE.SphereGeometry(0.13, 12, 10), mat, 0, 0.22, 0.15);                    // head
      part(new THREE.BoxGeometry(0.14, 0.08, 0.05), dark, 0, 0.2, 0.26);                   // face
      part(new THREE.BoxGeometry(0.18, 0.03, 0.06), dark, 0, 0.28, 0.24);                  // brow
      const pos = new THREE.Vector3(Math.cos(a) * 14, R, Math.sin(a) * 14);
      const hands = [0, 1].map(k => { const hd = new Hand(); hd.setSide(k ? 1 : -1); scene.add(hd.group);
        return { hd, pos: new THREE.Vector3(pos.x + (k ? -0.2 : 0.2), HR, pos.z + (k ? -0.25 : 0.1)), from: V(), to: V(), state: 'plant', t: 0 }; });
      return { pos, vel: V(), g, mat, fur: FUR[i % 5], hands, arms: [new Arm(scene, armMat), new Arm(scene, armMat)], yaw: 0, it: false, cool: 0,
               grounded: false, hide: V(), hideT: 0, jukeT: 0, jukeS: 1, jukeCd: 1, emote: null, emoteCd: 0, seen: false, wallCd: 0, wallT: 0, wn: V() };
    });
    this.actors = [this.player, ...this.bots];
    this.setIt(this.bots[0]);
  }

  setIt(a) { this.actors.forEach(x => { x.it = x === a; x.mat?.color.setHex(x.it ? RUST : x.fur); }); }

  pickHide(b, it) { // far side of an obstacle from whoever is it, away from the other hiders
    let best = 1e9;
    for (const o of this.world.obstacles) {
      o.getCenter(_c); const rad = Math.hypot(o.max.x - o.min.x, o.max.z - o.min.z) / 2 + 0.9;
      let dx = _c.x - it.pos.x, dz = _c.z - it.pos.z; const l = Math.hypot(dx, dz) || 1;
      const x = THREE.MathUtils.clamp(_c.x + dx / l * rad, -27, 27), z = THREE.MathUtils.clamp(_c.z + dz / l * rad, -27, 27);
      let cost = Math.hypot(x - b.pos.x, z - b.pos.z) - 0.5 * Math.hypot(x - it.pos.x, z - it.pos.z) + Math.random() * 3;
      for (const q of this.bots) if (q !== b && !q.it && Math.hypot(x - q.hide.x, z - q.hide.z) < 6) cost += 12;
      if (cost < best) { best = cost; b.hide.set(x, 0, z); }
    }
  }

  startEmote(b, it) {
    b.emote = { name: NAMES[Math.floor(Math.random() * NAMES.length)], t: 0, a: 0, b: 0, it };
    b.hands.forEach(h => { h.state = 'plant'; });
  }

  update(dt) {
    this.t += dt;
    const it = this.actors.find(a => a.it), P = this.player;
    for (const b of this.bots) {
      b.hideT -= dt; b.jukeCd -= dt; b.wallCd -= dt; b.emoteCd -= dt; b.wallT -= dt;
      const dP = Math.hypot(P.pos.x - b.pos.x, P.pos.z - b.pos.z);
      let dx = 0, dz = 0, spd = 0, look = null;

      if (b.emote) {
        look = P; b.emote.t += dt;
        if (b.emote.t > EMOTES[b.emote.name]) { b.emote = null; b.emoteCd = 6; }
      } else if (b.it) {
        let best = 1e9, tg = null;
        for (const a of this.actors) { if (a === b) continue; const d = b.pos.distanceToSquared(a.pos); if (d < best) { best = d; tg = a; } }
        dx = tg.pos.x + tg.vel.x * 0.3 - b.pos.x; dz = tg.pos.z + tg.vel.z * 0.3 - b.pos.z; spd = b.cool > 0 ? 2 : 5.4;
        if (Math.sqrt(best) < 4.5 && b.jukeT <= 0 && b.jukeCd <= 0) { b.jukeT = 0.45; b.jukeS = Math.random() < 0.5 ? -1 : 1; b.jukeCd = 1.5 + Math.random() * 1.5; }
      } else {
        const dIt = Math.hypot(it.pos.x - b.pos.x, it.pos.z - b.pos.z);
        if (dP > 9) b.seen = false;
        if (dIt > 9 && !P.it && dP < 5) {                      // free player walked up: turn and maybe do something
          look = P;
          if (!b.seen) { b.seen = true; if (b.emoteCd <= 0 && Math.random() < 0.7) this.startEmote(b, it); }
        } else if (dIt < 7) {                                   // it is close: run, break line of sight
          if (b.hideT <= 0 || dIt < 4) { this.pickHide(b, it); b.hideT = 1.2; }
          let ax = b.pos.x - it.pos.x, az = b.pos.z - it.pos.z; const al = Math.hypot(ax, az) || 1;
          let hx = b.hide.x - b.pos.x, hz = b.hide.z - b.pos.z; const hl = Math.hypot(hx, hz) || 1;
          dx = ax / al + hx / hl * 1.2; dz = az / al + hz / hl * 1.2; spd = 5;
          if (dIt < 4 && b.jukeT <= 0 && b.jukeCd <= 0) { b.jukeT = 0.45; b.jukeS = Math.random() < 0.5 ? -1 : 1; b.jukeCd = 1.5 + Math.random() * 1.5; }
        } else {                                                // safe: go sit behind something, away from the other hiders
          if (b.hideT <= 0) { this.pickHide(b, it); b.hideT = 2; }
          dx = b.hide.x - b.pos.x; dz = b.hide.z - b.pos.z;
          if (Math.hypot(dx, dz) > 1) spd = 4.2; else look = it;
        }
        if (spd > 0) for (const q of this.bots) if (q !== b && !q.it) {  // don't clump
          const sx = b.pos.x - q.pos.x, sz = b.pos.z - q.pos.z, sl = Math.hypot(sx, sz);
          if (sl < 4 && sl > 0.01) { dx += sx / sl * 0.8; dz += sz / sl * 0.8; }
        }
      }

      const l = Math.hypot(dx, dz);
      if (spd > 0 && l > 1e-3) { dx /= l; dz /= l; } else { spd = 0; dx = Math.sin(b.yaw); dz = Math.cos(b.yaw); }
      if (b.jukeT > 0 && spd > 0) { b.jukeT -= dt; const c = Math.cos(1.1 * b.jukeS), s = Math.sin(1.1 * b.jukeS); [dx, dz] = [dx * c - dz * s, dx * s + dz * c]; spd *= 1.15; }
      const rr = Math.hypot(b.pos.x, b.pos.z);
      if (spd > 0 && rr > 26) { dx -= b.pos.x / rr * 0.6; dz -= b.pos.z / rr * 0.6; const k = Math.hypot(dx, dz); dx /= k; dz /= k; }

      this.move(b, dx, dz, spd, dt);

      let ty = b.yaw;
      if (spd > 0 && Math.hypot(b.vel.x, b.vel.z) > 0.5) ty = Math.atan2(b.vel.x, b.vel.z);
      else if (look) ty = Math.atan2(look.pos.x - b.pos.x, look.pos.z - b.pos.z);
      b.yaw += angDiff(b.yaw, ty) * Math.min(1, dt * 8);
      this.pose(b, dt);
    }
    for (const a of this.actors) a.cool = Math.max(0, a.cool - dt);

    if (it.cool > 0) return;
    for (const o of this.actors) {
      if (o === it) continue;
      let d = it.pos.distanceTo(o.pos) - (it.player || o.player ? 0.1 : 0);
      if (it.player) d = Math.min(d, ...it.hands.map(h => h.distanceTo(o.pos) + 0.1));
      if (d < 0.7) { this.setIt(o); o.cool = 2.5; this.onTag(it.player || o.player, o.player); break; }
    }
  }

  // locomotion: speed only comes from planted hands pushing. hands alternate: plant, push the body past them, release, swing forward, plant.
  move(b, dx, dz, spd, dt) {
    const want = spd > 0; let planted = 0;
    for (let i = 0; i < 2; i++) {
      const H = b.hands[i], O = b.hands[1 - i], side = i ? 1 : -1;
      if (H.state === 'plant') {
        planted++;
        const behind = (b.pos.x - H.pos.x) * dx + (b.pos.z - H.pos.z) * dz;
        if ((want && behind > 0.48 && (O.state === 'plant' || O.t > 0.5)) || b.pos.distanceTo(H.pos) > 0.85) { H.state = 'swing'; H.t = 0; H.from.copy(H.pos); planted--; }
      } else {
        H.t += dt / 0.2;
        H.to.set(b.pos.x + dx * 0.5 - dz * side * 0.2, HR, b.pos.z + dz * 0.5 + dx * side * 0.2);
        const k = this.world.collide(H.to, HR, _n); if (k > 0) H.to.addScaledVector(_n, k);   // lands on rock tops / wall faces
        const e = Math.min(H.t, 1); H.pos.lerpVectors(H.from, H.to, e * e * (3 - 2 * e)); H.pos.y += Math.sin(Math.PI * e) * 0.22;
        if (H.t >= 1) { H.state = 'plant'; H.pos.copy(H.to); planted++; if (b.grounded && want) b.vel.y = Math.max(b.vel.y, 2.2); }
      }
    }
    if (planted > 0 && want) { const k = Math.min(1, dt * 6); b.vel.x += (dx * spd * 1.15 - b.vel.x) * k; b.vel.z += (dz * spd * 1.15 - b.vel.z) * k; }
    else if (b.grounded) { const k = 1 - Math.min(1, dt * 6); b.vel.x *= k; b.vel.z *= k; }

    const e = b.emote;
    if (e?.name === 'cheer' && b.grounded) { if (e.t > 0.1 && !e.a) { e.a = 1; b.vel.y = 3.4; } if (e.t > 0.9 && !e.b) { e.b = 1; b.vel.y = 3.4; } }

    b.vel.y -= G * dt; b.pos.addScaledVector(b.vel, dt); b.grounded = false;
    const hit = this.world.collide(b.pos, R, _n);
    if (hit > 0) {
      b.pos.addScaledVector(_n, hit); const v = b.vel.dot(_n); if (v < 0) b.vel.addScaledVector(_n, -v);
      if (_n.y > 0.6) b.grounded = true;
      else if (Math.abs(_n.y) < 0.35 && want && b.wallCd <= 0) {   // kick off the wall
        b.wallCd = 0.9; b.wallT = 0.25; b.wn.copy(_n);
        b.vel.set(_n.x * 2.4 + dx * spd * 0.6, 4.6, _n.z * 2.4 + dz * spd * 0.6);
      }
    }
  }

  pose(b, dt) {
    const f = _f.set(Math.sin(b.yaw), 0, Math.cos(b.yaw)), r = _r.set(-f.z, 0, f.x), e = b.emote;
    b.g.position.copy(b.pos); b.g.rotation.y = b.yaw;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, H = b.hands[i];
      let pos = H.pos, fd = f, pd = DOWN, ci = 1, cg = 1;
      if (e) {
        switch (e.name) {
          case 'wave': if (i === 1) { _t.copy(b.pos).addScaledVector(r, 0.35 + 0.1 * Math.sin(e.t * 11)).addScaledVector(f, 0.12); _t.y += 0.62; pos = _t; fd = UP; pd = f; ci = cg = 0; } break;
          case 'chest': _t.copy(b.pos).addScaledVector(f, 0.3 + 0.05 * Math.max(0, Math.sin(e.t * 13 + i * Math.PI))).addScaledVector(r, side * 0.13); pos = _t; break;
          case 'point': if (i === 1) { _fd.set(e.it.pos.x - b.pos.x, 0, e.it.pos.z - b.pos.z).normalize(); _t.copy(b.pos).addScaledVector(_fd, 0.62); _t.y += 0.15; pos = _t; fd = _fd; ci = 0; } break;
          case 'cheer': _t.copy(b.pos).addScaledVector(r, side * 0.32); _t.y += 0.55 + 0.05 * Math.sin(e.t * 14); pos = _t; fd = UP; pd = f; ci = cg = 0; break;
        }
      } else if (b.wallT > 0) {
        _t.copy(b.pos).addScaledVector(b.wn, -(R + 0.07)).addScaledVector(r, side * 0.15); _t.y += 0.1 + 0.15 * i;
        pos = _t; fd = UP; pd = b.wn; ci = cg = 0;
      }
      H.hd.group.position.copy(pos); H.hd.orient(fd, pd, side); H.hd.set(ci, cg); H.hd.update(dt);
      _s.copy(b.pos).addScaledVector(r, side * 0.24); _s.y += 0.08;
      _pole.copy(r).multiplyScalar(side * 0.6).addScaledVector(DOWN, 0.7).addScaledVector(f, -0.5);
      b.arms[i].solve(_s, pos, _pole);
    }
  }
}
