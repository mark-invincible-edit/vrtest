import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Bots } from './bots.js';
import { Wrist } from './hud.js';

const MODES = [
  { id: 'classic', name: 'CLASSIC TAG', world: 'arena', time: 0, bots: 6 },
  { id: 'hunter', name: 'HUNTER MAZE', world: 'maze', time: 210, bots: 8 },
  { id: 'killer', name: 'KILLER LOOSE', world: 'maze', time: 240, bots: 8 },
];

const enter = document.getElementById('enter'), status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
renderer.domElement.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0';
document.body.append(renderer.domElement);

const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
const world = buildWorld(scene), player = new Player(renderer, scene, camera, world), wrist = new Wrist();
player.onLeft = gr => wrist.attach(gr);

// black sphere around the head for the death fade
const fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.BackSide }));
fadeMesh.renderOrder = 999; fadeMesh.visible = false; camera.add(fadeMesh);

const g = { mode: 0, sel: 0, state: 'play', time: 0, streak: 0, best: 0, it: false, alive: 0, total: 0, msg: '', won: false, fade: 0, fadeTarget: 0, deadT: 0 };
const bots = new Bots(scene, world, player, e => {
  if (e.type === 'kill') player.buzz();
  if (e.type === 'tag' && e.player) player.buzz();
  if (e.type === 'playerDead' && g.state === 'play') { g.state = 'dead'; g.deadT = 0; g.fadeTarget = 1; player.buzz(); }
});

function start(i, keepMap) {
  const M = MODES[i]; g.mode = i;
  if (!keepMap || world.type !== M.world) world.load(M.world);
  bots.reset(M.id, M.bots);
  player.setKiller(M.id !== 'classic'); player.respawn(world.spawn.x, world.spawn.z);
  Object.assign(g, { state: 'play', time: M.time, streak: 0, msg: '', total: bots.bots.length });
}

const prev = {};
function readInput() { // thumbstick flick picks a mode, face buttons or stick click start it
  for (const src of renderer.xr.getSession()?.inputSources ?? []) {
    const gp = src.gamepad; if (!gp) continue;
    const p = prev[src.handedness] ??= { flick: false, b: [] }, y = gp.axes[3] ?? gp.axes[1] ?? 0;
    if (Math.abs(y) > 0.7 && !p.flick) { p.flick = true; g.sel = (g.sel + (y > 0 ? 1 : -1) + MODES.length) % MODES.length; }
    else if (Math.abs(y) < 0.3) p.flick = false;
    for (const bi of [3, 4, 5]) { const dn = !!gp.buttons[bi]?.pressed; if (dn && !p.b[bi] && g.state !== 'dead') start(g.sel, false); p.b[bi] = dn; }
  }
}

start(0, true);
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (renderer.xr.isPresenting) {
    readInput(); player.update(dt);
    const M = MODES[g.mode];
    if (g.state === 'dead') {
      g.deadT += dt;
      if (g.deadT > 1.3) { start(g.mode, true); g.fadeTarget = 0; }       // new round, new killer
    } else {
      bots.update(dt); g.alive = bots.alive(); g.it = player.actor.it;
      if (g.state === 'play') {
        if (M.id === 'classic') { if (g.it) { g.best = Math.max(g.best, g.streak); g.streak = 0; } else g.streak += dt; g.best = Math.max(g.best, g.streak); }
        else {
          g.time -= dt;
          if (g.alive === 0) { g.state = 'over'; g.won = true; g.msg = 'YOU WIN'; }
          else if (g.time <= 0) { g.state = 'over'; g.won = false; g.msg = "TIME'S UP"; }
        }
      }
    }
    g.fade += Math.sign(g.fadeTarget - g.fade) * Math.min(Math.abs(g.fadeTarget - g.fade), dt * (g.fadeTarget ? 4 : 2.5));
    fadeMesh.visible = g.fade > 0; fadeMesh.material.opacity = g.fade;
    wrist.update(dt, g, MODES);
  }
  renderer.render(scene, camera);
});

if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    enter.disabled = !ok; enter.textContent = ok ? 'Enter VR' : 'VR unavailable';
    if (!ok) status.textContent = 'This browser has no immersive VR. Open the page in your headset.';
  });
} else { enter.textContent = 'VR unavailable'; status.textContent = 'WebXR needs https and a headset browser.'; }

enter.addEventListener('click', async () => {
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    await renderer.xr.setSession(session);
    document.body.classList.add('vr');
    session.addEventListener('end', () => document.body.classList.remove('vr'));
  } catch (e) { status.textContent = 'Could not start VR: ' + e.message; }
});
