import * as THREE from 'three';
import { makeArm, stretch } from './arms.js';

const HAND_R = 0.07, SKIN = 0.02, BODY_R = 0.4, G = 9.8, MAX_V = 10, BOOST = 1.2;

export class Player {
  constructor(renderer, scene, camera, world) {
    this.renderer = renderer; this.camera = camera; this.world = world;
    this.rig = new THREE.Group(); scene.add(this.rig); this.rig.add(camera);
    this.vel = new THREE.Vector3(); this.onLeft = null;
    this.touch = [false, false]; this.last = [new THREE.Vector3(), new THREE.Vector3()];
    this.actor = { pos: new THREE.Vector3(), hands: [new THREE.Vector3(), new THREE.Vector3()], it: false, cool: 0, player: true };
    this._n = new THREE.Vector3(); this._w = new THREE.Vector3(); this._p = new THREE.Vector3();
    this._d = new THREE.Vector3(); this._r = new THREE.Vector3(); this._s = new THREE.Vector3();

    const skin = new THREE.MeshLambertMaterial({ color: 0x1d1b19 }), armMat = new THREE.MeshLambertMaterial({ color: 0x3a342d });
    this.arms = [makeArm(armMat), makeArm(armMat)]; this.arms.forEach(a => scene.add(a));
    this.grips = [0, 1].map(i => {
      const g = renderer.xr.getControllerGrip(i), ray = renderer.xr.getController(i);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(HAND_R, 14, 10), skin));
      this.rig.add(g, ray);
      ray.addEventListener('connected', e => { if (e.data.handedness === 'left') this.onLeft?.(g); });
      return g;
    });
  }

  buzz() {
    for (const s of this.renderer.xr.getSession()?.inputSources ?? [])
      s.gamepad?.hapticActuators?.[0]?.pulse(0.8, 150);
  }

  update(dt) {
    const rig = this.rig, n = this._n, w = this._w, push = this._p.set(0, 0, 0);
    let touching = false;

    for (let i = 0; i < 2; i++) {
      const p = this.grips[i].position;                      // hand position, local to the rig
      w.copy(p).add(rig.position);
      if (this.world.collide(w, HAND_R + SKIN, n) > 0) {
        if (this.touch[i]) {                                 // hand moved while planted: move the body the opposite way
          this._d.subVectors(p, this.last[i]);
          rig.position.sub(this._d); push.addScaledVector(this._d, -1 / dt);
          w.copy(p).add(rig.position);
        }
        const depth = this.world.collide(w, HAND_R + SKIN, n) - SKIN;
        if (depth > 0) rig.position.addScaledVector(n, depth);
        this.touch[i] = touching = true;
      } else this.touch[i] = false;
      this.last[i].copy(p);
    }

    if (touching) { push.multiplyScalar(BOOST); if (push.length() > MAX_V) push.setLength(MAX_V); this.vel.lerp(push, 0.6); }
    else { this.vel.y -= G * dt; this.vel.multiplyScalar(1 - 0.1 * dt); rig.position.addScaledVector(this.vel, dt); }

    // body is a big sphere at head height, which is also what keeps you "standing" above the ground
    w.copy(this.camera.position).add(rig.position);
    const hit = this.world.collide(w, BODY_R, n);
    if (hit > 0) { rig.position.addScaledVector(n, hit); const v = this.vel.dot(n); if (v < 0) this.vel.addScaledVector(n, -v); }

    // publish positions for bots and draw the arms
    this.camera.getWorldPosition(this.actor.pos);
    const q = this.camera.getWorldQuaternion(new THREE.Quaternion());
    const right = this._r.set(1, 0, 0).applyQuaternion(q); right.y = 0; right.normalize();
    for (let i = 0; i < 2; i++) {
      this.grips[i].getWorldPosition(this.actor.hands[i]);
      const side = this.actor.hands[i].clone().sub(this.actor.pos).dot(right) < 0 ? -1 : 1;
      this._s.copy(this.actor.pos).addScaledVector(right, side * 0.2); this._s.y -= 0.2;
      stretch(this.arms[i], this._s, this.actor.hands[i]);
    }
    this.actor.cool = Math.max(0, this.actor.cool - dt);
  }
}
