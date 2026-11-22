import * as THREE from 'three';
const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _p = new THREE.Vector3();

function seg(mat, r) {
  const g = new THREE.CylinderGeometry(r * 0.8, r, 1, 8); g.translate(0, 0.5, 0);
  return new THREE.Mesh(g, mat);
}
function stretch(m, a, b) {
  _d.subVectors(b, a); const l = _d.length() || 1e-4;
  m.position.copy(a); m.scale.set(1, l, 1); m.quaternion.setFromUnitVectors(UP, _d.divideScalar(l));
}

// two-bone arm with a bending elbow. equal segments, pole vector says where the elbow points.
export class Arm {
  constructor(scene, mat, len = 0.34) {
    this.len = len; this.elbow = new THREE.Vector3();
    this.up = seg(mat, 0.05); this.lo = seg(mat, 0.042);
    this.joint = new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 6), mat);
    scene.add(this.up, this.lo, this.joint);
  }
  dispose(scene) { scene.remove(this.up, this.lo, this.joint); }
  solve(shoulder, hand, pole) {
    _d.subVectors(hand, shoulder);
    const L = Math.min(Math.max(_d.length(), 0.08), this.len * 2 - 0.001); _d.normalize();
    const x = L / 2, h = Math.sqrt(Math.max(this.len * this.len - x * x, 0));
    _p.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize();
    this.elbow.copy(shoulder).addScaledVector(_d, x).addScaledVector(_p, h);
    this.joint.position.copy(this.elbow);
    stretch(this.up, shoulder, this.elbow); stretch(this.lo, this.elbow, hand);
  }
}
