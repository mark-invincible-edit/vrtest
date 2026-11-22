import * as THREE from 'three';
// small canvas panel that rides on the left controller
export class Wrist {
  constructor() {
    this.cv = Object.assign(document.createElement('canvas'), { width: 320, height: 160 });
    this.ctx = this.cv.getContext('2d'); this.tex = new THREE.CanvasTexture(this.cv);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ map: this.tex }));
    this.mesh.position.set(0, 0.05, 0.03); this.mesh.rotation.x = -Math.PI / 2.4;  // nudge these if it sits wrong on your controller
    this.acc = 1;
  }
  attach(grip) { grip.add(this.mesh); }
  update(dt, it, streak, best) {
    if ((this.acc += dt) < 0.2) return; this.acc = 0;
    const c = this.ctx;
    c.fillStyle = '#1d1b19'; c.fillRect(0, 0, 320, 160);
    c.fillStyle = it ? '#e2674a' : '#ece6d6'; c.font = '900 64px Impact, sans-serif';
    c.fillText(it ? "YOU'RE IT" : 'FREE', 16, 74);
    c.fillStyle = '#ece6d6'; c.font = '700 26px "Courier New", monospace';
    c.fillText('streak ' + streak.toFixed(1) + 's', 16, 114); c.fillText('best   ' + best.toFixed(1) + 's', 16, 146);
    this.tex.needsUpdate = true;
  }
}
