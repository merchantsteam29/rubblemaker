'use strict';
// ================================================================ POST FX (chromatic shake, flashes, kill-cam grade)
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
const mainPass = new RenderPass(scene, camera);
const vmPass = new RenderPass(vmScene, vmCam);
vmPass.clear = false; vmPass.clearDepth = true;
const FXPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uShift: { value: 0 }, uFlash: { value: new THREE.Vector4(1, 1, 1, 0) }, uDesat: { value: 0 }, uVig: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uShift, uDesat, uVig; uniform vec4 uFlash; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5; vec2 off = d * uShift;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c = min(c, vec3(1.15));
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, vec3(l) * vec3(1.05, 0.95, 0.85), uDesat);
      c *= 1.0 - uVig * smoothstep(0.2, 0.75, length(d));
      c = mix(c, uFlash.rgb, uFlash.a);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(mainPass); composer.addPass(vmPass); composer.addPass(FXPass); composer.addPass(new OutputPass());
const FXS = { shift: 0, flash: new THREE.Vector4(1, 1, 1, 0), desat: 0, vig: 0 };
function resizeFX() { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
resizeFX();
function fxShift(v) { if (settings.effects) FXS.shift = Math.max(FXS.shift, v); }
function fxFlash(hex, a) {
  if (!settings.effects) return;
  const c = new THREE.Color(hex);
  if (a >= FXS.flash.w) FXS.flash.set(c.r, c.g, c.b, a);
}
function renderFrame(dt) {
  FXS.shift *= Math.exp(-dt * 9);
  FXS.flash.w *= Math.exp(-dt * 9);
  const slow = G.slow.t > 0;
  FXS.desat += ((slow ? 0.6 : 0) - FXS.desat) * (1 - Math.exp(-dt * 10));
  FXS.vig += ((slow ? 0.7 : P.hp < 30 && G.state === 'play' ? 0.35 : 0.15) - FXS.vig) * (1 - Math.exp(-dt * 6));
  const showVM = !menuish() && G.state !== 'cutscene' && G.state !== 'vsSpectate' && G.state !== 'vsready';
  if (!settings.effects || settings.quality === 'low') {
    renderer.clear();
    renderer.render(scene, camera);
    if (showVM) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
    return;
  }
  vmPass.enabled = showVM;
  FXPass.uniforms.uShift.value = FXS.shift;
  FXPass.uniforms.uFlash.value.copy(FXS.flash);
  FXPass.uniforms.uDesat.value = FXS.desat;
  FXPass.uniforms.uVig.value = FXS.vig;
  composer.render();
}
function killCam(t, scale) {
  if (!settings.killcam) return;
  G.slow = { t, scale };
  fxFlash(0xffffff, 0.22);
}
function updateFov(dt) {
  const target = settings.fov + (P.dashT > 0 ? 10 : 0) + (P.sliding ? 6 : 0) + (G.slow.t > 0 ? -10 : 0);
  const nf = camera.fov + (target - camera.fov) * (1 - Math.exp(-dt * 10));
  if (Math.abs(nf - camera.fov) > 0.01) { camera.fov = nf; camera.updateProjectionMatrix(); }
}

// ================================================================ GORE, RUBBLE & DECALS
function splatTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (kind === 'hole') {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(20,16,14,.9)'); gr.addColorStop(1, 'rgba(20,16,14,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  } else {
    g.fillStyle = 'rgba(90,6,6,0.95)';
    g.beginPath(); g.arc(64, 64, 26 + Math.random() * 10, 0, 7); g.fill();
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 7, d = 20 + Math.random() * 38, r = 3 + Math.random() * 9;
      g.fillStyle = `rgba(${70 + Math.random() * 40},4,4,${0.7 + Math.random() * 0.3})`;
      g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const decalGeo = new THREE.PlaneGeometry(1, 1);
const mkDecal = (tex) => new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.4, metalness: 0.1 });
const bloodMats = [0, 1, 2].map(() => mkDecal(splatTexture('blood')));
const holeMat = mkDecal(splatTexture('hole'));
const decals = [];
function decal(point, normal, size, mat) {
  const m = new THREE.Mesh(decalGeo, mat);
  m.position.copy(point).addScaledVector(normal, 0.02 + decals.length * 0.00005);
  m.lookAt(tmpV.copy(point).add(normal));
  m.rotateZ(Math.random() * 6.28);
  m.scale.setScalar(size);
  m.receiveShadow = true;
  scene.add(m);
  decals.push(m);
  while (decals.length > QCAP(60, 140, 220)) scene.remove(decals.shift());
}
function bloodSpray(point, from) {
  const dir = point.clone().sub(from || camera.position).normalize();
  ray.set(point.clone().addScaledVector(dir, 0.3), dir); ray.far = 5;
  const h = ray.intersectObjects(worldMeshes, false)[0];
  if (h && h.face) decal(h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld), rand(0.5, 1.2), bloodMats[(Math.random() * 3) | 0]);
}
function bloodPool(center, n, size) {
  for (let i = 0; i < n; i++) {
    const p = center.clone().add(new V3(rand(-1.2, 1.2), 0.5, rand(-1.2, 1.2)));
    ray.set(p, new V3(0, -1, 0)); ray.far = 12;
    const h = ray.intersectObjects(worldMeshes, false)[0];
    if (h) decal(h.point, UP, size * rand(0.6, 1.3), bloodMats[(Math.random() * 3) | 0]);
  }
}

// physics debris: detached enemy limbs, toppling bodies, and rubble chunks that stay on the floor
const debris = [];
const rubbleGeo = new THREE.DodecahedronGeometry(1, 0);
const rubbleMats = [0x6a625a, 0x7a3424, 0x4a4440].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
function floorAt(x, z, y) {
  let fy = -50;
  for (const s of solids) {
    if (!s.active) continue;
    if (x > s.min.x && x < s.max.x && z > s.min.z && z < s.max.z && s.max.y <= y + 0.4) fy = Math.max(fy, s.max.y);
  }
  return fy;
}
function addDebris(obj, vel, spin, owner, kind = 'piece', rad = 0.15) {
  scene.attach(obj);
  debris.push({ obj, vel, spin, owner, kind, rad, rest: false, tip: 0, tipDir: Math.random() < 0.5 ? -1 : 1 });
  if (owner) owner.refs++;
  while (debris.length > QCAP(30, 60, 90)) removeDebris(debris[0]);
}
function removeDebris(d) {
  const i = debris.indexOf(d);
  if (i >= 0) debris.splice(i, 1);
  scene.remove(d.obj);
  if (d.owner && --d.owner.refs <= 0) for (const mt of d.owner.mats) mt.dispose();
}
function updateDebris(dt) {
  for (const d of debris) {
    if (d.rest) continue;
    const o = d.obj;
    if (d.kind === 'body') {
      // a corpse: slides with its knockback and topples over around its feet
      d.vel.y -= 25 * dt;
      o.position.addScaledVector(d.vel, dt);
      const fy = floorAt(o.position.x, o.position.z, o.position.y);
      if (o.position.y <= fy) { o.position.y = fy; d.vel.y = 0; d.vel.x *= Math.exp(-dt * 5); d.vel.z *= Math.exp(-dt * 5); }
      d.tip = Math.min(1, d.tip + dt * (1.2 + d.tip * 3));
      o.rotation.x = d.baseX + d.tipDir * d.tip * Math.PI / 2;
      if (d.tip >= 1 && Math.hypot(d.vel.x, d.vel.z) < 0.3) { d.rest = true; burst(o.position.clone().setY(o.position.y + 0.2), 6, 0x6a625a, 3, 0.12, 0.6); }
      continue;
    }
    d.vel.y -= 25 * dt;
    o.position.addScaledVector(d.vel, dt);
    o.rotation.x += d.spin.x * dt; o.rotation.y += d.spin.y * dt; o.rotation.z += d.spin.z * dt;
    const p = o.position;
    if (overlapBox(p.x - 0.05, p.y + 0.05, p.z - 0.05, p.x + 0.05, p.y + 0.2, p.z + 0.05)) { d.vel.x *= -0.3; d.vel.z *= -0.3; }
    const fy = floorAt(p.x, p.z, p.y) + d.rad;
    if (p.y < fy) {
      p.y = fy;
      d.vel.y *= -0.3; d.vel.x *= 0.6; d.vel.z *= 0.6; d.spin.multiplyScalar(0.6);
      if (Math.abs(d.vel.y) < 1 && Math.hypot(d.vel.x, d.vel.z) < 0.4) d.rest = true;
    }
    if (p.y < -30) removeDebris(d);
  }
}
function rubble(pos, n, spread = 6) {
  if (!settings.gore) return;
  for (let i = 0; i < n; i++) {
    const s = rand(0.08, 0.26);
    const m = new THREE.Mesh(rubbleGeo, rubbleMats[(Math.random() * 3) | 0]);
    m.scale.setScalar(s);
    m.castShadow = true;
    m.position.copy(pos).add(new V3(rand(-0.6, 0.6), rand(0.2, 0.8), rand(-0.6, 0.6)));
    scene.add(m);
    addDebris(m, new V3(rand(-1, 1) * spread, rand(3, 9), rand(-1, 1) * spread), new V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), null, 'piece', s * 0.7);
  }
}
function gibEnemy(e, info) {
  const owner = { mats: [...e.mats, ...e.extraMats], refs: 0 };
  for (const mt of e.mats) { mt.emissiveIntensity = 0.05; mt.color.multiplyScalar(0.6); }
  const knock = info && info.knock ? info.knock.clone() : new V3();
  const kd = knock.lengthSq() > 0 ? knock.normalize() : new V3();
  e.mesh.updateMatrixWorld(true);
  const r = e.rig;
  const pieces = ['head', 'elL', 'elR', 'kneeL', 'kneeR', 'w2L', 'w2R', 'tail2'].map((k) => r[k]).filter((p) => p && p.parent);
  const violent = info && (info.combo || info.weapon === 'shotgun' || info.weapon === 'slam' || e.hp < -e.def.hp * 0.5);
  const sc = e.baseScale || 1;
  for (const p of pieces) {
    if (!violent && Math.random() < 0.5 && p !== r.head) continue;
    const v = kd.clone().multiplyScalar(rand(3, 8)).add(new V3(rand(-3, 3), rand(4, 9), rand(-3, 3)));
    addDebris(p, v, new V3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), owner, 'piece', 0.12 * sc);
  }
  const body = e.mesh;
  addDebris(body, kd.clone().multiplyScalar(4).setY(e.def.fly ? 0 : 2), new V3(), owner, 'body');
  const d = debris[debris.length - 1];
  d.baseX = body.rotation.x;
  if (e.def.fly) d.vel.y = 0;
  const c = body.position.clone(); c.y += e.def.h * 0.5;
  bloodPool(c, 3 + (violent ? 3 : 0), e.def.boss ? 3 : 1.4);
  for (let i = 0; i < 4; i++) bloodSpray(c, c.clone().add(new V3(rand(-1, 1), rand(-0.5, 0.5), rand(-1, 1))));
}
function clearGore() {
  for (const d of debris.slice()) removeDebris(d);
  for (const m of decals) scene.remove(m);
  decals.length = 0;
}

// ================================================================ BOSS INTRO CARDS
const EPITHETS = {
  boss1: ['ACT I BOSS', 'WARDEN OF THE CELLAR'],
  boss2: ['ACT II BOSS', 'ARCHITECT OF RUIN'],
  bulwark: ['TRAINER', 'LESSON I · THE PARRY'],
  sweeper: ['TRAINER', 'LESSON II · THE DASH'],
  roost: ['TRAINER', 'LESSON III · THE AIR'],
  kiln: ['TRAINER', 'LESSON IV · THE RETURN TO SENDER'],
};
let introT = 0;
function showIntro(type) {
  const def = DEFS[type];
  const [kind, epi] = EPITHETS[type] || ['', ''];
  const el = $('intro');
  el.querySelector('.kind').textContent = kind;
  el.querySelector('.name').textContent = def.short;
  el.querySelector('.epi').textContent = epi;
  el.classList.remove('hidden', 'play');
  void el.offsetWidth;
  el.classList.add('play');
  G.slow = { t: 2.0, scale: 0.15 };
  clearTimeout(introT);
  introT = setTimeout(() => el.classList.add('hidden'), 2600);
}

// ================================================================ TITLE SCREEN: logo + live attract scene
function buildLogo() {
  const h = document.querySelector('#menu h1');
  const text = h.textContent;
  h.innerHTML = [...text].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
  h.classList.add('logo');
}
const menuCrowd = [];
function clearMenuCrowd() {
  for (const c of menuCrowd) { scene.remove(c.mesh); for (const mt of c.mats) mt.dispose(); }
  menuCrowd.length = 0;
}
function spawnMenuCrowd() {
  clearMenuCrowd();
  ['grunt', 'grunt', 'shooter', 'heavy', 'flyer', 'flyer', 'grunt', 'shooter'].forEach((t, i) => {
    const md = buildEnemyModel(t, DEFS[t].color);
    const a = (i / 8) * Math.PI * 2;
    md.root.position.set(Math.cos(a) * 15, t === 'flyer' ? 5 : 0, Math.sin(a) * 15);
    scene.add(md.root);
    menuCrowd.push({ type: t, def: DEFS[t], mesh: md.root, rig: md.rig, mats: md.mats, orb: md.orb, walk: rand(0, 6), state: 'chase', t: rand(0, 2), wt: 0, target: new V3(rand(-20, 20), 0, rand(-20, 20)), animType: null, alt: rand(4, 7) });
  });
}
function updateMenuScene(dt, t) {
  camera.position.set(Math.sin(t * 0.06) * 25, 6 + Math.sin(t * 0.2) * 1.2, Math.cos(t * 0.06) * 25);
  camera.lookAt(Math.sin(t * 0.05) * 5, 2.4, Math.cos(t * 0.04) * 3);
  for (const c of menuCrowd) {
    c.t -= dt;
    if (c.t <= 0) {
      c.target.set(rand(-26, 26), 0, rand(-26, 26));
      c.t = rand(3, 7);
      if (Math.random() < 0.35) { c.state = 'windup'; c.wt = 0.8; }
    }
    let w = 0, moving = false;
    if (c.state === 'windup') { c.wt -= dt; w = 1 - c.wt / 0.8; if (c.wt <= 0) { c.state = 'recover'; c.wt = 0.5; } }
    else if (c.state === 'recover') { c.wt -= dt; if (c.wt <= 0) c.state = 'chase'; }
    else {
      const p = c.mesh.position;
      const dx = c.target.x - p.x, dz = c.target.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.5) {
        const sp = c.def.speed * 0.35;
        p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt;
        c.mesh.rotation.y = Math.atan2(dx, dz);
        moving = true;
      }
      if (c.def.fly) p.y = c.alt + Math.sin(t * 1.5 + c.walk) * 0.5;
    }
    c.walk += dt * c.def.speed * (moving ? 1.6 : 0.2);
    if (c.orb) c.orb.scale.setScalar(0.08 + w * 0.2);
    animateEnemy(c, dt, moving, w, t);
  }
}

buildLogo();
spawnMenuCrowd();
