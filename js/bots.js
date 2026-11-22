import * as THREE from 'three';
import { makeArm, stretch } from './arms.js';

const R = 0.28, G = 9.8, BONE = 0xece6d6, RUST = 0xc2482b;
const _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Bots {
  constructor(scene, world, player, count = 5, onTag = () => {}) {
    this.world = world; this.player = player.actor; this.onTag = onTag; this.t = 0;
    const armMat = new THREE.MeshLambertMaterial({ color: 0x3a342d }), fist = new THREE.SphereGeometry(0.07, 10, 8);
    this.bots = Array.from({ length: count }, (_, i) => {
      const ang = i / count * Math.PI * 2, mat = new THREE.MeshLambertMaterial({ color: BONE });
      const body = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 12), mat);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.12), new THREE.MeshLambertMaterial({ color: 0x1d1b19 }));
      snout.position.set(0, -0.02, R - 0.02); body.add(snout);
      const hands = [0, 1].map(() => new THREE.Mesh(fist, armMat)), arms = [makeArm(armMat), makeArm(armMat)];
      scene.add(body, ...hands, ...arms);
      return { pos: new THREE.Vector3(Math.cos(ang) * 14, 1, Math.sin(ang) * 14), vel: new THREE.Vector3(), body, mat, hands, arms,
               it: false, cool: 0, leap: Math.random(), gait: 0, yaw: 0, phase: Math.random() * 6 };
    });
    this.actors = [this.player, ...this.bots];
    this.setIt(this.bots[0]);
  }

  setIt(a) { this.actors.forEach(x => { x.it = x === a; if (x.mat) x.mat.color.set(x.it ? RUST : BONE); }); }

  update(dt) {
    this.t += dt;
    const it = this.actors.find(a => a.it);
    for (const b of this.bots) {
      let tx = 0, tz = 0, spd = 5;
      if (b.it) {
        let best = 1e9, tgt = null;
        for (const a of this.actors) { const d = a !== b && b.pos.distanceToSquared(a.pos); if (d && d < best) { best = d; tgt = a; } }
        tx = tgt.pos.x - b.pos.x; tz = tgt.pos.z - b.pos.z; spd = b.cool > 0 ? 2 : 5.4;
      } else { tx = b.pos.x - it.pos.x; tz = b.pos.z - it.pos.z; }
      let l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const turn = Math.sin(this.t * 1.3 + b.phase) * 0.6, c = Math.cos(turn), s = Math.sin(turn);
      [tx, tz] = [tx * c - tz * s, tx * s + tz * c];
      const rr = Math.hypot(b.pos.x, b.pos.z);
      if (rr > 22) { tx -= b.pos.x / rr * (rr - 22) * 0.5; tz -= b.pos.z / rr * (rr - 22) * 0.5; l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; }

      b.vel.y -= G * dt;
      if (b.grounded) {
        b.vel.x *= 0.85; b.vel.z *= 0.85; b.leap -= dt;
        if (b.leap <= 0) { b.vel.set(tx * spd * 1.1, 3.2 + Math.random(), tz * spd * 1.1); b.leap = 0.4 + Math.random() * 0.15; }
      } else { b.vel.x += (tx * spd - b.vel.x) * dt * 1.5; b.vel.z += (tz * spd - b.vel.z) * dt * 1.5; }
      b.pos.addScaledVector(b.vel, dt);
      b.grounded = false;
      const hit = this.world.collide(b.pos, R, _n);
      if (hit > 0) { b.pos.addScaledVector(_n, hit); const v = b.vel.dot(_n); if (v < 0) b.vel.addScaledVector(_n, -v); if (_n.y > 0.6) b.grounded = true; }

      if (Math.hypot(b.vel.x, b.vel.z) > 0.5) b.yaw = Math.atan2(b.vel.x, b.vel.z);
      b.body.position.copy(b.pos); b.body.rotation.y = b.yaw;
      b.gait += dt * 9;
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1, ph = b.gait + (i ? Math.PI : 0), sw = Math.sin(ph), h = b.hands[i];
        h.position.set(b.pos.x + fz * side * 0.32 + fx * (0.15 + 0.3 * sw), Math.max(0.07, b.pos.y - 0.4 + 0.18 * Math.max(0, Math.cos(ph))), b.pos.z - fx * side * 0.32 + fz * (0.15 + 0.3 * sw));
        _a.set(b.pos.x + fz * side * 0.25, b.pos.y - 0.05, b.pos.z - fx * side * 0.25);
        stretch(b.arms[i], _a, h.position);
      }
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
}
