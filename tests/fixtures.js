// tests/fixtures.js — build repository states for the store, the way
// store._fetchBase would after reading them from GitHub.
import './lib.js';
import * as U from '../js/util.js';
import { store, DEFAULT_VIEW } from '../js/store.js';

// `cards` is { id: partial card }; type defaults to todo.
export function snapshot(sha, cards = {}, cfg = null) {
  const files = {};
  for (const [id, c] of Object.entries(cards)) {
    files[`data/cards/${id}.md`] = { sha: `s-${id}-${JSON.stringify(c)}`, text: U.serializeCard({ type: 'todo', ...c }) };
  }
  if (cfg) {
    files['data/config.yml'] = { sha: `s-cfg-${JSON.stringify(cfg)}`, text: U.serializeConfig({ ...U.emptyConfig(), ...cfg }) };
  }
  const out = { sha, files, cards: {}, comments: {}, config: U.emptyConfig(), configText: null };
  for (const [path, f] of Object.entries(files)) {
    if (path === 'data/config.yml') { out.config = U.parseConfig(f.text); out.configText = f.text; }
    else { const c = U.parseCardFile(path, f.text); out.cards[c.id] = c; }
  }
  return out;
}

// A clean store whose repository holds `cards` (and `cfg`).
export function reset(cards = {}, cfg = null) {
  localStorage.clear();
  store.demo = false;
  store.settings = { owner: 'o', repo: 'r', branch: 'main', token: 't' };
  store.base = snapshot('sha0', cards, cfg);
  store.resetToBase();
  store.view = { ...DEFAULT_VIEW };
}

export { store };
