import * as THREE from 'three';
import { Arm } from './arms.js';
import { Hand } from './hand.js';

const HAND_R = 0.07, SKIN = 0.012, BODY_R = 0.4, G = 9.8, MAX_V = 10, BOOST = 1.3, FRICTION = 0.8;
const DOWN = new THREE.Vector3(0, -1, 0);

export class Player {
  constructor(renderer, scene, camera, world) {
    this.renderer = renderer; this.camera = camera; this.world = world;
    this.rig = new THREE.Group(); scene.add(this.rig); this.rig.add(camera);
    this.vel = new THREE.Vector3(); this.onLeft = null; this.src = [null, null];
    this.touch = [false, false]; this.last = [new THREE.Vector3(), new THREE.Vector3()];
    this.hist = []; this.wasTouching = false;
    this.actor = { pos: new THREE.Vector3(), hands: [new THREE.Vector3(), new THREE.Vector3()], it: false, cool: 0, player: true, vel: this.vel };
    for (const k of ['_n', '_w', '_p', '_d', '_t', '_r', '_s', '_f', '_a']) this[k] = new THREE.Vector3();
    this._q = new THREE.Quaternion();

    const armMat = new THREE.MeshLambertMaterial({ color: 0x3a342d });
    this.arms = [new Arm(scene, armMat), new Arm(scene, armMat)];
    this.torso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), armMat); this.torso.scale.set(1.15, 1.35, 0.75); scene.add(this.torso);
    this.hands = []; this.side = [-1, 1];
    this.grips = [0, 1].map(i => {
      const g = renderer.xr.getControllerGrip(i), ray = renderer.xr.getController(i), hand = new Hand();
      g.add(hand.group); this.hands.push(hand); this.rig.add(g, ray);
      ray.addEventListener('connected', e => {
        this.src[i] = e.data; const left = e.data.handedness === 'left';
        hand.setSide(left ? -1 : 1); this.side[i] = left ? -1 : 1; if (left) this.onLeft?.(g);
      });
      ray.addEventListener('disconnected', () => { this.src[i] = null; });
      return g;
    });
  }

  buzz() {
    for (const s of this.renderer.xr.getSession()?.inputSources ?? []) s.gamepad?.hapticActuators?.[0]?.pulse(0.8, 150);
  }

  _avg(k) { // mean of the last k contact pushes: this is the launch velocity on release
    const h = this.hist.slice(-k), v = this._a.set(0, 0, 0);
    for (const p of h) v.add(p);
    if (h.length) v.divideScalar(h.length);
    return v.length() > MAX_V ? v.setLength(MAX_V) : v;
  }

  update(dt) {
    const rig = this.rig, n = this._n, w = this._w, push = this._p.set(0, 0, 0), d = this._d, tan = this._t;
    let touching = false;

    for (let i = 0; i < 2; i++) {
      const p = this.grips[i].position;                        // hand, local to rig
      w.copy(p).add(rig.position);
      if (this.world.collide(w, HAND_R + SKIN, n) > 0) {
        if (this.touch[i]) {
          d.subVectors(p, this.last[i]);
          const dn = d.dot(n);                                  // only motion INTO the surface counts, so lifting off never tugs you down
          tan.copy(d).addScaledVector(n, -dn).multiplyScalar(FRICTION).addScaledVector(n, Math.min(dn, 0));
          rig.position.sub(tan); push.addScaledVector(tan, -1 / dt);
          w.copy(p).add(rig.position);
        }
        const depth = this.world.collide(w, HAND_R + SKIN, n) - SKIN;
        if (depth > 0) rig.position.addScaledVector(n, depth);
        this.touch[i] = touching = true;
      } else this.touch[i] = false;
      this.last[i].copy(p);
    }

    if (touching) {
      push.multiplyScalar(BOOST); this.hist.push(push.clone()); if (this.hist.length > 5) this.hist.shift();
      this.vel.copy(this._avg(3));
    } else {
      if (this.wasTouching) this.vel.copy(this._avg(4));
      this.hist.length = 0;
      this.vel.y -= G * dt; this.vel.multiplyScalar(1 - 0.1 * dt); rig.position.addScaledVector(this.vel, dt);
    }
    this.wasTouching = touching;

    w.copy(this.camera.position).add(rig.position);             // body = big sphere at head height
    const hit = this.world.collide(w, BODY_R, n);
    if (hit > 0) { rig.position.addScaledVector(n, hit); const v = this.vel.dot(n); if (v < 0) this.vel.addScaledVector(n, -v); }

    const head = this.camera.getWorldPosition(this.actor.pos), q = this.camera.getWorldQuaternion(this._q);
    const fwd = this._f.set(0, 0, -1).applyQuaternion(q), yaw = Math.atan2(fwd.x, fwd.z);
    fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const right = this._r.set(-fwd.z, 0, fwd.x);
    this.torso.position.copy(head); this.torso.position.y -= 0.5; this.torso.rotation.y = yaw;

    for (let i = 0; i < 2; i++) {
      const hw = this.grips[i].getWorldPosition(this.actor.hands[i]);
      const side = this.src[i] ? this.side[i] : (hw.clone().sub(head).dot(right) < 0 ? -1 : 1);
      this._s.copy(head).addScaledVector(right, side * 0.2); this._s.y -= 0.2;
      this._d.copy(right).multiplyScalar(side * 0.6).addScaledVector(DOWN, 0.7).addScaledVector(fwd, -0.4);
      this.arms[i].solve(this._s, hw, this._d);

      const gp = this.src[i]?.gamepad;                          // trigger curls the index, grip curls the rest + thumb
      this.hands[i].set(gp?.buttons[0]?.value ?? 0, gp?.buttons[1]?.value ?? 0); this.hands[i].update(dt);
    }
    this.actor.cool = Math.max(0, this.actor.cool - dt);
  }
}
