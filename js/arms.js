import * as THREE from 'three';
const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export function makeArm(mat) {
  const g = new THREE.CylinderGeometry(0.035, 0.05, 1, 8);
  g.translate(0, 0.5, 0);
  return new THREE.Mesh(g, mat);
}
// stretch a unit cylinder from world point a to world point b
export function stretch(arm, a, b) {
  _d.subVectors(b, a);
  const len = _d.length() || 1e-4;
  arm.position.copy(a);
  arm.scale.set(1, len, 1);
  arm.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
}
