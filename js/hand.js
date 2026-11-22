import * as THREE from 'three';
// Hand model, built as a RIGHT hand in controller grip space:
// fingers point -Z, thumb points +Y, palm faces -X. Left hand = mirrored on x.
// If the hand sits rotated on your controller, change HAND_ROT below.
export const HAND_ROT = new THREE.Euler(0, 0, 0);

const SEG = [0.034, 0.028, 0.022], MAXC = [1.3, 1.5, 1.1], THUMB_MAX = [0.8, 1.0];
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

export class Hand {
  constructor(color = 0x2a2622) {
    this.group = new THREE.Group(); this.model = new THREE.Group();
    this.model.rotation.copy(HAND_ROT); this.group.add(this.model);
    const mat = new THREE.MeshLambertMaterial({ color });
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), mat); palm.scale.set(0.6, 0.95, 1); this.model.add(palm);
    const bone = (len, r = 0.011) => { const g = new THREE.CapsuleGeometry(r, len, 2, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, -len / 2); return new THREE.Mesh(g, mat); };
    const chain = (parent, x, y, z, lens, k) => lens.map((l, s) => {
      const j = new THREE.Group(); j.position.set(s ? 0 : x, s ? 0 : y, s ? -lens[s - 1] * k : z);
      parent.add(j); j.add(bone(l * k)); parent = j; return j;
    });
    this.fingers = [[0.027, 1], [0.009, 1.12], [-0.009, 1.04], [-0.027, 0.84]].map(([y, k]) => chain(this.model, 0, y, -0.045, SEG, k));
    const tg = new THREE.Group(); tg.position.set(0, 0.035, -0.01); tg.rotation.x = 0.8; this.model.add(tg);
    this.thumb = chain(tg, 0, 0, 0, [0.03, 0.025], 1);
    this.c = [0, 0]; this.t = [0, 0];
  }
  setSide(s) { this.model.scale.x = s; }
  set(index, grip) { this.t[0] = index; this.t[1] = grip; }
  update(dt) {
    const k = Math.min(1, dt * 18);
    this.c[0] += (this.t[0] - this.c[0]) * k; this.c[1] += (this.t[1] - this.c[1]) * k;
    this.fingers.forEach((js, f) => js.forEach((j, s) => { j.rotation.y = (f ? this.c[1] : this.c[0]) * MAXC[s]; }));
    this.thumb.forEach((j, s) => { j.rotation.y = this.c[1] * THUMB_MAX[s]; });
  }
  // for world-space hands (bots): fingers along fingerDir, palm toward palmDir. side +1 right, -1 left
  orient(fingerDir, palmDir, side) {
    _z.copy(fingerDir).negate();
    _x.copy(palmDir).addScaledVector(fingerDir, -palmDir.dot(fingerDir)).normalize();
    if (side > 0) _x.negate();
    _y.crossVectors(_z, _x); _m.makeBasis(_x, _y, _z);
    this.group.quaternion.setFromRotationMatrix(_m);
  }
}
