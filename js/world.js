import * as THREE from 'three';
const C = { sky: 0xcfc7ad, moss: 0x4a5238, stoneA: 0x77735f, stoneB: 0x655f52, bark: 0x5b4130, wall: 0x2f2c28, ink: 0x1d1b19 };

function rng(seed) { // mulberry32, same arena every run
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.sky, 22, 62);
  scene.add(new THREE.HemisphereLight(0xfff4d6, C.moss, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(6, 12, 4); scene.add(sun);

  const boxes = [], line = new THREE.LineBasicMaterial({ color: C.ink });
  const add = (cx, y0, cz, w, h, d, col, outline = true) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col }));
    m.position.set(cx, y0 + h / 2, cz); scene.add(m);
    if (outline) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), line));
    boxes.push(new THREE.Box3().setFromObject(m));
  };

  add(0, -1, 0, 62, 1, 62, C.moss, false);                 // ground, top at y=0
  add(0, 0, -31, 62, 8, 1, C.wall); add(0, 0, 31, 62, 8, 1, C.wall);
  add(-31, 0, 0, 1, 8, 62, C.wall); add(31, 0, 0, 1, 8, 62, C.wall);

  const r = rng(7);
  for (let i = 0; i < 16; i++) {
    let x = (r() - .5) * 48, z = (r() - .5) * 48;
    if (Math.hypot(x, z) < 5) x += 7;
    add(x, 0, z, 1 + r() * 2.5, .6 + r() * 2.2, 1 + r() * 2.5, i % 2 ? C.stoneA : C.stoneB);
  }
  for (let i = 0; i < 8; i++) {
    let x = (r() - .5) * 50, z = (r() - .5) * 50;
    if (Math.hypot(x, z) < 5) z -= 7;
    add(x, 0, z, .9, 3.5 + r() * 1.5, .9, C.bark);
  }
  for (let i = 0; i < 4; i++) add(10, 0, -8 + i * 2.6, 3, .8 * (4 - i), 2.6, C.stoneA); // stepped rocks

  const c = new THREE.Vector3();
  return {
    boxes,
    // sphere vs all boxes: returns deepest penetration (0 = none), writes push-out normal to n
    collide(p, rad, n) {
      let best = 0;
      for (const b of boxes) {
        c.copy(p).clamp(b.min, b.max);
        const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= rad * rad) continue;
        const d = Math.sqrt(d2);
        if (d > 1e-6) { if (rad - d > best) { best = rad - d; n.set(dx / d, dy / d, dz / d); } }
        else if (rad + b.max.y - p.y > best) { best = rad + b.max.y - p.y; n.set(0, 1, 0); }
      }
      return best;
    }
  };
}
