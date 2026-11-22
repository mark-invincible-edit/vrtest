import * as THREE from 'three';
// wrist panel on the left controller: mode picker, timer, kills, streak
export class Wrist {
  constructor() {
    this.cv = Object.assign(document.createElement('canvas'), { width: 512, height: 384 });
    this.ctx = this.cv.getContext('2d'); this.tex = new THREE.CanvasTexture(this.cv);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), new THREE.MeshBasicMaterial({ map: this.tex }));
    this.mesh.position.set(0, 0.18, 0.02); this.mesh.rotation.x = -Math.PI / 2.4;  // nudge if it sits wrong on your controller
    this.acc = 1;
  }
  attach(grip) { grip.add(this.mesh); }
  update(dt, g, modes) {
    if ((this.acc += dt) < 0.1) return; this.acc = 0;
    const c = this.ctx, INK = '#1d1b19', BONE = '#ece6d6', RUST = '#e2674a';
    c.fillStyle = INK; c.fillRect(0, 0, 512, 384);
    const M = modes[g.mode], mmss = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    c.fillStyle = BONE; c.font = '700 22px "Courier New", monospace'; c.fillText(M.name, 20, 36);
    c.font = '900 76px Impact, sans-serif';
    if (g.state === 'over') { c.fillStyle = g.won ? BONE : RUST; c.fillText(g.msg, 20, 120); }
    else if (g.state === 'dead') { c.fillStyle = RUST; c.fillText('YOU DIED', 20, 120); }
    else if (M.id === 'classic') { c.fillStyle = g.it ? RUST : BONE; c.fillText(g.it ? "YOU'RE IT" : 'FREE', 20, 120); }
    else { c.fillStyle = g.time < 30 ? RUST : BONE; c.fillText(mmss(Math.max(0, g.time)), 20, 120); }
    c.fillStyle = BONE; c.font = '700 30px "Courier New", monospace';
    c.fillText(M.id === 'classic' ? 'streak ' + g.streak.toFixed(1) + 's  best ' + g.best.toFixed(1) + 's' : 'left ' + g.alive + ' / ' + g.total, 20, 166);
    modes.forEach((m, i) => {
      const y = 190 + i * 50;
      if (i === g.sel) { c.fillStyle = RUST; c.fillRect(12, y, 488, 42); }
      c.fillStyle = i === g.sel ? INK : BONE; c.font = '700 26px "Courier New", monospace'; c.fillText((i === g.sel ? '> ' : '  ') + m.name, 24, y + 30);
    });
    c.fillStyle = BONE; c.font = '18px "Courier New", monospace'; c.fillText('stick up/down = pick    A / X / B / Y = start', 20, 368);
    this.tex.needsUpdate = true;
  }
}
