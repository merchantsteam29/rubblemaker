import './migrate.js';
import * as THREE from 'three';
import { buildEnemyModel, buildBossModel, buildTrainerModel, buildForge, buildPortal, buildVariantModel, buildDuelistModel, animateEnemy, buildViewmodels, buildCatModel } from './models.js';
import { LEVELS, SCENES, DUELS, PRIMES, buildLevel } from './levels.js';
import { createMusic } from './music.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { settings, saveSettings, ACTIONS, DIFFS, keyLabel, initSettingsUI, padLabel } from './settings.js';

// =====================================================================
//  RUBBLEMAKER — boot
//  The game lives in js/*.js as plain scripts that share one global scope
//  (exactly as when it was a single file). This module loads the libraries,
//  hands them to that scope, then runs every part in order in one go.
//  To add a part: create js/NN-name.js and list it in PARTS.
// =====================================================================

Object.assign(window, { THREE, buildEnemyModel, buildBossModel, buildTrainerModel, buildForge, buildPortal, buildVariantModel, buildDuelistModel, animateEnemy, buildViewmodels, buildCatModel, LEVELS, SCENES, DUELS, PRIMES, buildLevel, createMusic, EffectComposer, RenderPass, ShaderPass, OutputPass, settings, saveSettings, ACTIONS, DIFFS, keyLabel, initSettingsUI, padLabel });

const PARTS = [
  '00-engine',
  '01-enemies',
  '02-combat',
  '03-player',
  '04-loop',
  '05-bosses',
  '06-campaign',
  '07-variants-trainers',
  '08-fx-title',
  '09-nailgun-arms',
  '10-duels',
  '11-kiln-secrets',
  '12-controls-practice',
  '13-launcher-duels2',
  '14-primes-pit',
  '15-stats-codex',
  '16-story',
  '17-sound',
  '18-flail-elites-ghosts',
  '19-race',
  '20-acts-minibosses',
  '21-aqueduct',
  '22-batch8',
];

let failed = null;
const onErr = (e) => { failed = failed || e; };
addEventListener('error', onErr);
const texts = await Promise.all(PARTS.map((p) => fetch(`js/${p}.js`, { cache: 'no-cache' }).then((r) => {
  if (!r.ok) throw new Error(`could not load js/${p}.js (${r.status})`);
  return r.text();
})));
// inline scripts run synchronously, so no frame or event can slip in between two parts
for (let i = 0; i < PARTS.length && !failed; i++) {
  const s = document.createElement('script');
  s.textContent = texts[i] + `\n//# sourceURL=${new URL(`js/${PARTS[i]}.js`, location.href)}`;
  document.head.appendChild(s);
}
removeEventListener('error', onErr);
if (failed) console.error('RUBBLEMAKER stopped loading:', failed.message || failed);
