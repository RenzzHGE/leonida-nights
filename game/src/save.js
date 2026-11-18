// LEONIDA NIGHTS — save and load. One localStorage key holds cash, rep,
// owned cars, upgrades and lifetime stats. A corrupt save is ignored.

import { CFG } from './config.js';

export function defaultSave() {
  return {
    cash: 600,
    rep: 0,
    car: 'sedan',
    owned: ['sedan'],
    upgrades: { engine: 0, tires: 0, armor: 0 },
    jobsDone: 0,
    earned: 0,
    busts: 0,
    bestRank: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(CFG.saveKey);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const fresh = defaultSave();
    for (const k of Object.keys(fresh)) {
      if (data[k] !== undefined) fresh[k] = data[k];
    }
    if (!Array.isArray(fresh.owned) || fresh.owned.length === 0) fresh.owned = ['sedan'];
    if (!fresh.owned.includes(fresh.car)) fresh.car = fresh.owned[0];
    return fresh;
  } catch (err) {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(CFG.saveKey, JSON.stringify(save));
  } catch (err) {
    /* storage full or blocked: the night goes on unsaved */
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(CFG.saveKey);
  } catch (err) { /* ignore */ }
}
