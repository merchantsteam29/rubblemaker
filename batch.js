// batch.js — automatic static batching (shared across the games; same file in each).
//
// Drawing 1000 little meshes costs 1000 draw calls a frame, twice with shadows, and that CPU
// work is what makes levels lag on slower PCs. This merges meshes that sit still into one mesh
// per material per chunk of space, so the GPU draws the same picture in a few dozen calls.
//
// It needs no help from the game code:
//  - A mesh is only batched after it has stayed put (same place, material, visibility, parent)
//    for `settle` seconds.
//  - The original meshes stay where they are, moved onto a layer the cameras don't draw, so
//    raycasts, collision lists and anything else holding on to them work exactly as before
//    (every Raycaster gets that layer too).
//  - If the game later moves, hides, removes, recolours (swaps material), reshapes or re-parents
//    a batched mesh, it's taken out of its batch for good and drawn on its own again.
//
//   const batcher = createBatcher(root);   // root: the level group (or the scene)
//   every frame:  batcher.update(dt);
//   batcher.dispose()                      // when the level is thrown away (or just drop it)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LAYER = 31, BIT = 1 << LAYER;
// Hidden originals live on LAYER only; let every raycast see them.
if (!THREE.Raycaster.prototype.__batchPatched) {
  const P = THREE.Raycaster.prototype;
  for (const fn of ['intersectObject', 'intersectObjects']) {
    const orig = P[fn];
    P[fn] = function (...a) {
      const had = this.layers.mask & BIT;
      if (!had) this.layers.mask |= BIT;
      try { return orig.apply(this, a); } finally { if (!had) this.layers.mask &= ~BIT; }
    };
  }
  P.__batchPatched = true;
}

const noRaycast = () => {};
const sig = (g) => Object.keys(g.attributes).sort().map((k) => k + g.attributes[k].itemSize).join(',') + (g.index ? '|i' : '|n');

export function createBatcher(root, { settle = 1.0, cell = 18, rescan = 1.5, min = 2, skip = () => false } = {}) {
  const holder = new THREE.Group(); holder.name = '__batch';
  holder.raycast = noRaycast;
  root.add(holder);
  const banned = new WeakSet();          // evicted once: never batched again
  let seen = new Map();                  // candidate mesh -> { t, s: snapshot } (rebuilt every scan)
  const live = new Map();                // batched source mesh -> { batch, m, mask, pv }
  const batches = new Map();             // key -> { key, mat, list:[src], mesh, dirty }
  let scanT = 0, checkT = 0, dead = false;
  const tmp = new THREE.Matrix4(), rootInv = new THREE.Matrix4();

  const visibleTo = (o) => { for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return false; return true; };
  const attached = (o) => { for (let p = o.parent; p; p = p.parent) if (p === root) return true; return false; };
  const eligible = (o) => o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !banned.has(o) && o.parent !== holder &&
    !Array.isArray(o.material) && o.material && !o.material.transparent && o.geometry && o.geometry.attributes.position &&
    !o.geometry.morphAttributes.position && o.matrixWorld.determinant() > 0 &&
    o.onBeforeRender === THREE.Object3D.prototype.onBeforeRender && o.frustumCulled && !skip(o);
  const same = (a, b) => { for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return false; return true; };
  const keyOf = (o) => {
    const e = o.matrixWorld.elements;
    return `${o.material.uuid}|${sig(o.geometry)}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}|${Math.floor(e[12] / cell)},${Math.floor(e[14] / cell)}`;
  };
  const state = (o) => ({ mat: o.material, geo: o.geometry, pv: o.geometry.attributes.position.version, cs: o.castShadow, rs: o.receiveShadow, m: o.matrixWorld.elements.slice() });
  const unchanged = (o, s) => o.material === s.mat && o.geometry === s.geo && o.geometry.attributes.position.version === s.pv &&
    o.castShadow === s.cs && o.receiveShadow === s.rs && same(o.matrixWorld.elements, s.m);

  function rebuild(b) {
    b.dirty = false;
    if (b.mesh) { holder.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh = null; }
    if (b.list.length < min) { for (const s of b.list) release(s, false); b.list.length = 0; batches.delete(b.key); return; }
    rootInv.copy(root.matrixWorld).invert();
    const geos = b.list.map((s) => s.geometry.clone().applyMatrix4(tmp.multiplyMatrices(rootInv, s.matrixWorld)));
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) { for (const s of b.list) { release(s, true); } b.list.length = 0; batches.delete(b.key); return; }
    const s0 = b.list[0];
    const mesh = new THREE.Mesh(merged, s0.material);
    mesh.castShadow = s0.castShadow; mesh.receiveShadow = s0.receiveShadow; mesh.renderOrder = s0.renderOrder;
    mesh.raycast = noRaycast; mesh.matrixAutoUpdate = false; mesh.name = '__batched';
    holder.add(mesh); b.mesh = mesh;
  }
  function release(src, ban) { // draw this mesh on its own again
    const L = live.get(src);
    if (!L) return;
    live.delete(src);
    src.layers.mask = L.mask;
    if (ban) banned.add(src);
  }
  function evict(src) {
    const L = live.get(src); if (!L) return;
    const b = L.batch, i = b.list.indexOf(src);
    if (i >= 0) b.list.splice(i, 1);
    release(src, true);
    b.dirty = true;
  }

  function scan() {
    const now = performance.now() / 1000;
    const touched = new Set(), next = new Map();
    root.traverse((o) => {
      if (o === holder || live.has(o) || !eligible(o) || !visibleTo(o)) return;
      const s = seen.get(o);
      if (!s || !unchanged(o, s.s)) { next.set(o, { t: now, s: state(o) }); return; }
      if (now - s.t < settle) { next.set(o, s); return; }
      const key = keyOf(o);
      let b = batches.get(key);
      if (!b) { b = { key, list: [], mesh: null, dirty: false }; batches.set(key, b); }
      b.list.push(o); touched.add(b);
      live.set(o, { batch: b, s: state(o), mask: o.layers.mask });
      o.layers.mask = BIT;
    });
    seen = next;
    for (const b of touched) b.dirty = true;
  }
  function check() {
    for (const [src, L] of live) {
      if (!attached(src) || !visibleTo(src) || !unchanged(src, L.s)) evict(src);
    }
  }

  return {
    root,
    get stats() { let n = 0; for (const b of batches.values()) if (b.mesh) n++; return { batched: live.size, batches: n }; },
    update(dt = 1 / 60) {
      if (dead) return;
      if (!root.parent && root.type !== 'Scene') { this.dispose(); return; }
      checkT -= dt; scanT -= dt;
      if (checkT <= 0) { checkT = 0.1; check(); }
      if (scanT <= 0) { scanT = rescan; scan(); }
      for (const b of batches.values()) if (b.dirty) rebuild(b);
    },
    // Take everything out of batches (e.g. before the game edits the level in bulk).
    flush() { for (const src of [...live.keys()]) { release(src, false); } for (const b of batches.values()) { if (b.mesh) { holder.remove(b.mesh); b.mesh.geometry.dispose(); } } batches.clear(); seen.clear(); },
    dispose() { if (dead) return; this.flush(); root.remove(holder); dead = true; },
  };
}
