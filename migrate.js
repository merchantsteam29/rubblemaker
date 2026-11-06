// =====================================================================
//  One-time save migration: batch 6.3 turned the scenes into ACTS made of
//  Ultrakill-style LAYERS and renumbered the levels. Runs before anything
//  else reads the save (main.js imports it first).
// =====================================================================

export const ID_MAP = {
  '1-6': '2-1', '1-7': '2-2', '1-8': '2-3', '1-9': '2-4', '1-10': '2-5', '1-11': '3-1', '1-12': '3-2',
  '2-1': '4-1', '2-2': '4-2', '2-3': '4-3', '2-4': '4-4', '2-5': '4-5',
  '2-6': '5-1', '2-7': '5-2', '2-8': '5-3', '2-9': '5-4', '2-10': '5-5', '2-11': '6-1', '2-12': '6-2',
  '1-S': '2-S', '1-S2': '3-S', '2-S1': '4-S', '2-S2': '5-S', '2-S': '6-S', '1-P': '3-P', '2-P': '6-P',
};
// levels whose layout changed (new rooms), so old ghost runs no longer fit (new ids)
const CHANGED = new Set(['1-4', '1-5', '2-5', '4-5', '5-5']);
const FLAG = 'rubblemaker-idv';

const mapId = (k) => { const i = k.indexOf(':'); const id = i < 0 ? k : k.slice(0, i); const n = ID_MAP[id] || id; return i < 0 ? n : n + k.slice(i); };
const remapObj = (o) => { const out = {}; for (const k of Object.keys(o || {})) out[mapId(k)] = o[k]; return out; };

export function migrateSave(store = localStorage) {
  if (store.getItem(FLAG) === '2') return false;
  let did = false;
  const raw = store.getItem('rubblemaker-progress');
  if (raw) {
    const p = JSON.parse(raw);
    if (p.best) p.best = remapObj(p.best);
    if (p.skulls) p.skulls = remapObj(p.skulls);
    if (p.lore) p.lore = remapObj(p.lore);
    store.setItem('rubblemaker-progress', JSON.stringify(p));
    did = true;
  }
  const g = store.getItem('rubblemaker-ghosts');
  if (g) {
    const all = remapObj(JSON.parse(g));
    for (const k of Object.keys(all)) if (CHANGED.has(k.split(':')[0])) delete all[k];
    store.setItem('rubblemaker-ghosts', JSON.stringify(all));
    did = true;
  }
  store.setItem(FLAG, '2');
  return did;
}

try { migrateSave(); } catch (_) { /* a broken save should never stop the game loading */ }
