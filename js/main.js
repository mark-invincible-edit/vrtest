import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Bots } from './bots.js';
import { Wrist } from './hud.js';

const enter = document.getElementById('enter'), status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.domElement.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0';
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 100);
const world = buildWorld(scene);
const player = new Player(renderer, scene, camera, world);
const wrist = new Wrist();
player.onLeft = g => wrist.attach(g);
const bots = new Bots(scene, world, player, 5, (involvesPlayer) => involvesPlayer && player.buzz());
const game = { streak: 0, best: 0 };

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (renderer.xr.isPresenting) {
    player.update(dt); bots.update(dt);
    if (player.actor.it) { game.best = Math.max(game.best, game.streak); game.streak = 0; } else game.streak += dt;
    wrist.update(dt, player.actor.it, game.streak, Math.max(game.best, game.streak));
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
