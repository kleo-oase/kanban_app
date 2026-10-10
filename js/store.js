// store.js — single source of truth for the app.
//
// `base`  = the data as it exists in the data repository (or the local cache of
//           it). `cards`/`comments`/`config` = the working copy shown in the UI.
// Every mutation is written to localStorage immediately (the "draft"), so
// nothing is lost when switching views or reloading. "Save" turns the diff
// between working copy and base into one git commit.
//
// All per-board state is namespaced by `owner/repo#branch`, so holding several
// boards in one browser costs nothing: switching cannot lose unsaved work.

import { GitHubClient, GHError } from './github.js';
import { DEMO_FILES } from './demo.js';
import { FORMAT_VERSION } from './version.js';
import {
  CARD_DIR, COMMENT_DIR, CONFIG_PATH, WEEKDAY_IDS, COLOR_RE,
  FALLBACK_CLIENT_COLORS, NO_CLIENT_COLOR,
  parseCardFile, serializeCard, cardPath,
  parseCommentFile, serializeComment, commentPath, commentKey,
  parseConfig, serializeConfig, emptyConfig, emptyCard, normalizeCard, isDoneOn, isDateStr,
  slugify, uid, isoNow, lsGet, lsSet, lsDel, debounce,
} from './util.js';

const PREFIX = 'kb:';                    // NOT the planning tool's `pt:` — same origin, separate storage
const PROJECTS_KEY = PREFIX + 'projects';
const ACTIVE_KEY = PREFIX + 'active';

const clone = o => JSON.parse(JSON.stringify(o));

export const DEFAULT_VIEW = {
  sort: 'date',
  sortDir: 'asc',
  search: '',
  types: [],          // empty = all
  urgencies: [],
  clients: [],
  authors: [],
  range: 'all',
  hideDone: false,
  calAllTypes: false,
  calMode: 'month',   // month | week | day
  calAnchor: null,    // any date inside the shown period; null = today
};

// Returns the board list. Exported so the invite-link import (which runs before
// the store boots) sees the same list instead of clobbering it.
export function loadProjects() {
  const projects = lsGet(PROJECTS_KEY);
  if (!Array.isArray(projects)) {
    lsSet(PROJECTS_KEY, []);
    return [];
  }
  return projects.filter(p => p && p.id && p.owner && p.repo);
}

function commitMessage(base, changes) {
  const n = { add: 0, update: 0, remove: 0 };
  for (const c of changes) {
    if (c.delete) n.remove++;
    else if (base.files[c.path]) n.update++;
    else n.add++;
  }
  const parts = Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`);
  return `kanban: ${parts.join(', ') || 'update'}`;
}

function parseFiles(sha, files) {
  const cards = {};
  const comments = {};
  let config = emptyConfig();
  let configText = null;
  for (const [path, f] of Object.entries(files)) {
    if (path === CONFIG_PATH) {
      config = parseConfig(f.text);
      configText = f.text;
    } else if (path.startsWith(CARD_DIR) && path.endsWith('.md')) {
      const c = parseCardFile(path, f.text);
      if (c.id) cards[c.id] = c;
    } else if (path.startsWith(COMMENT_DIR) && path.endsWith('.md')) {
      const c = parseCommentFile(path, f.text);
      if (c) comments[commentKey(c.cardId, c.id)] = c;
    }
  }
  return { sha, files, cards, comments, config, configText };
}

// ---------- three-way merge of an ordered, keyed list ----------
// Used for employees (plain names), clients (name + color) and lists
// (id + name, order matters because it is the column order).
function mergeKeyedList(fork, local, remote, keyOf, fields, onConflict) {
  const norm = a => (Array.isArray(a) ? a : []);
  const fm = new Map(norm(fork).map(x => [keyOf(x), x]));
  const lm = new Map(norm(local).map(x => [keyOf(x), x]));
  const rm = new Map(norm(remote).map(x => [keyOf(x), x]));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const keep = k => {
    const f = fm.get(k), l = lm.get(k), r = rm.get(k);
    if (l && r) return true;
    // present on one side only: no fork entry means it was just created there;
    // a fork entry means the other side removed it, which only loses to an edit
    if (l && !r) return !f || !same(l, f);
    if (!l && r) return !f || !same(r, f);
    return false;
  };

  // Did this browser really *reorder*, or only add/remove? Compare just the
  // keys both sides still have, so an append does not count as a reorder and
  // needlessly override someone else's ordering.
  const common = new Set([...fm.keys()].filter(k => lm.has(k)));
  const seq = list => norm(list).map(keyOf).filter(k => common.has(k)).join(' ');
  const reorderedHere = seq(local) !== seq(fork);

  const order = reorderedHere
    ? [...lm.keys(), ...norm(remote).map(keyOf)]
    : [...norm(remote).map(keyOf), ...norm(local).map(keyOf)];
  const seen = new Set();
  const keys = order.filter(k => (seen.has(k) || !keep(k) ? false : (seen.add(k), true)));

  return keys.map(k => {
    const f = fm.get(k), l = lm.get(k), r = rm.get(k);
    if (!fields.length) return l ?? r;              // plain values (employee names)
    if (!l) return clone(r);
    if (!r) return clone(l);
    const out = { ...l };
    for (const key of fields) {
      if ((l[key] ?? null) === (r[key] ?? null)) continue;
      if (f && (l[key] ?? null) === (f[key] ?? null)) out[key] = r[key];
      else if (f && (r[key] ?? null) === (f[key] ?? null)) { /* keep local */ }
      else onConflict?.(k, key);
    }
    return out;
  });
}

export const store = {
  settings: { owner: '', repo: '', branch: 'main', token: '' },
  base: parseFiles(null, {}),
  cards: {},
  comments: {},
  config: emptyConfig(),
  projects: [],
  active: null,
  view: { ...DEFAULT_VIEW },
  demo: false,
  syncing: false,
  saving: false,
  lastSync: 0,
  lastError: null,
  _hasDraft: false,
  _draftBaseSha: null,   // commit the draft forked from
  _fork: null,           // snapshot at that commit (the merge ancestor)
  _subs: {},

  on(evt, fn) { (this._subs[evt] ||= []).push(fn); },
  emit(evt, data) {
    for (const fn of this._subs[evt] || []) {
      try { fn(data); } catch (e) { console.error(e); }
    }
  },

  configured() { return !!(this.settings.owner && this.settings.repo); },
  client() { return new GitHubClient(this.settings); },

  formatTooNew() {
    return (this.base.config.format || 1) > FORMAT_VERSION
      || (this.config.format || 1) > FORMAT_VERSION;
  },

  repoKey() {
    return this.demo ? 'demo' : `${this.settings.owner}/${this.settings.repo}#${this.settings.branch}`;
  },
  key(name) { return `${PREFIX}${this.repoKey()}:${name}`; },

  // ----- boards (a.k.a. projects) -----

  loadSettings() {
    this.projects = loadProjects();
    const activeId = lsGet(ACTIVE_KEY);
    this.active = this.projects.find(p => p.id === activeId) || this.projects[0] || null;
    if (this.active) {
      lsSet(ACTIVE_KEY, this.active.id);
      this.active.branch ||= 'main';
      this.settings = this.active;   // alias: all repo-keyed storage is per board for free
    } else {
      this.settings = { owner: '', repo: '', branch: 'main', token: '' };
    }
  },

  saveSettings(patch) {
    Object.assign(this.settings, patch);
    if (this.active) lsSet(PROJECTS_KEY, this.projects);
    this.emit('change', { source: 'settings' });
  },

  boardName() {
    if (this.demo) return 'Demo';
    if (this.config && this.config.name) return this.config.name;
    if (this.active && this.active.name) return this.active.name;
    return this.configured() ? `${this.settings.owner}/${this.settings.repo}` : '';
  },

  addProject({ name = '', owner, repo, branch = 'main', token = '' }) {
    let p = this.projects.find(q => q.owner === owner && q.repo === repo && (q.branch || 'main') === branch);
    if (p) {
      if (token) p.token = token;
      if (name) p.name = name;
    } else {
      p = { id: 'p-' + uid(), name, owner, repo, branch, token };
      this.projects.push(p);
    }
    lsSet(PROJECTS_KEY, this.projects);
    lsSet(ACTIVE_KEY, p.id);
    return p;
  },

  removeProject(id) {
    this.projects = this.projects.filter(p => p.id !== id);
    lsSet(PROJECTS_KEY, this.projects);
    if (this.active && this.active.id === id) lsSet(ACTIVE_KEY, this.projects[0]?.id || '');
  },

  // Switching = set the active pointer and reboot; every board's draft/cache
  // lives under its own storage keys, so nothing is lost.
  switchProject(id) {
    lsSet(ACTIVE_KEY, id);
    if (location.search) location.href = location.pathname + location.hash;  // also leaves ?demo=1
    else location.reload();
  },

  // ----- view state (filter / sort / search / calendar month) -----

  loadView() {
    const v = lsGet(this.key('view'));
    this.view = { ...DEFAULT_VIEW, ...(v && typeof v === 'object' ? v : {}) };
    this.view.search = '';   // a search is never restored across reloads
  },

  setView(patch, source) {
    Object.assign(this.view, patch);
    const { search, ...persisted } = this.view;
    lsSet(this.key('view'), persisted);
    this.emit('change', { source: source || 'view' });
  },

  // ----- boot -----

  async init() {
    this.demo = new URLSearchParams(location.search).has('demo');
    this.loadSettings();
    this.loadView();

    if (this.demo) {
      const files = Object.fromEntries(
        Object.entries(DEMO_FILES).map(([p, text]) => [p, { sha: 'demo:' + p, text }]));
      this.base = parseFiles('demo', files);
    } else {
      const cache = lsGet(this.key('cache'));
      if (cache && cache.files) this.base = parseFiles(cache.sha, cache.files);
    }

    const draft = lsGet(this.key('draft'));
    if (draft && draft.cards) {
      this._adopt(draft);
      if (this._draftBaseSha !== this.base.sha) {
        // the cache moved ahead of this draft (another tab synced) — merge now
        const report = this._mergeIntoDraft(this.base);
        if (report.pulled || report.conflicts.length) this.emit('merged', report);
      }
    } else {
      this.resetToBase();
    }
    this.emit('change');
    if (!this.demo && this.configured()) this.refresh();
  },

  _adopt(draft) {
    this.cards = draft.cards || {};
    this.comments = draft.comments || {};
    this.config = draft.config || emptyConfig();
    this._draftBaseSha = draft.baseSha ?? null;
    this._fork = draft.fork || {
      cards: clone(this.base.cards), comments: clone(this.base.comments), config: clone(this.base.config),
    };
    // a draft written by an older app version lacks the newer card fields
    for (const c of Object.values(this.cards)) normalizeCard(c);
    for (const c of Object.values(this._fork.cards || {})) normalizeCard(c);
    this._hasDraft = true;
  },

  resetToBase() {
    this.cards = clone(this.base.cards);
    this.comments = clone(this.base.comments);
    this.config = clone(this.base.config);
    this._hasDraft = false;
    this._draftBaseSha = this.base.sha;
    this._fork = null;
  },

  // ----- draft persistence -----

  _persistDraft: null,   // debounced, wired up at the bottom of this file

  _persistDraftNow() {
    const ok = lsSet(this.key('draft'), {
      baseSha: this._draftBaseSha,
      cards: this.cards,
      comments: this.comments,
      config: this.config,
      fork: this._fork,
      ts: Date.now(),
    });
    if (!ok) this.emit('error', new GHError('Draft could not be stored.', 'storage'));
  },

  touch(source) {
    if (!this._hasDraft) {
      this._hasDraft = true;
      this._draftBaseSha = this.base.sha;
      this._fork = {
        cards: clone(this.base.cards), comments: clone(this.base.comments), config: clone(this.base.config),
      };
    }
    this._persistDraft();
    this.emit('change', { source });
  },

  // ----- mutations -----

  newCard(props = {}) {
    const title = (props.title || '').trim() || 'Untitled';
    const mk = () => `${slugify(title) || 'card'}-${uid().slice(0, 4)}`;
    let id = mk();
    while (this.cards[id] || this.base.cards[id]) id = mk();
    const card = normalizeCard({ ...emptyCard(id), created: isoNow(), ...props, id });
    this.cards[id] = card;
    this.touch();
    return card;
  },

  updateCard(id, patch, source) {
    const c = this.cards[id];
    if (!c) return;
    Object.assign(c, patch);
    normalizeCard(c);
    this.touch(source);
  },

  deleteCard(id) {
    delete this.cards[id];
    for (const k of Object.keys(this.comments)) {
      if (this.comments[k].cardId === id) delete this.comments[k];
    }
    this.touch();
  },

  // ----- ticking to-dos -----
  // `date` is the iteration being ticked; it only matters for repeating cards,
  // where every iteration has its own tick (see normalizeCard).

  setDone(id, date, done) {
    const c = this.cards[id];
    if (!c || c.type !== 'todo') return;
    if (c.repeat) {
      if (!isDateStr(date)) return;
      const ticked = new Set(c.doneOn || []);
      if (done) ticked.add(date); else ticked.delete(date);
      c.doneOn = [...ticked].sort();
    } else {
      c.done = !!done;
    }
    this.touch('tick');
  },

  toggleDone(id, date) {
    const c = this.cards[id];
    if (c) this.setDone(id, date, !isDoneOn(c, date));
  },

  // ----- archive -----
  // Archiving only sets a timestamp: the file stays where it is, so bringing a
  // card back is exact and costs no history. Emptying the archive is the one
  // operation that actually deletes files.

  archiveCard(id) {
    const c = this.cards[id];
    if (!c || c.archived) return;
    c.archived = isoNow();
    this.touch();
  },

  unarchiveCard(id) {
    const c = this.cards[id];
    if (!c || !c.archived) return;
    c.archived = null;
    normalizeCard(c);
    // a card that lost its list while it was archived must land somewhere
    if (!c.date && !this.config.lists.some(l => l.id === c.list)) {
      c.list = this.customLists()[0]?.id || null;
    }
    this.touch();
  },

  archivedCards() {
    return Object.values(this.cards).filter(c => c.archived);
  },

  emptyArchive() {
    const gone = this.archivedCards().map(c => c.id);
    for (const id of gone) {
      delete this.cards[id];
      for (const k of Object.keys(this.comments)) {
        if (this.comments[k].cardId === id) delete this.comments[k];
      }
    }
    if (gone.length) this.touch();
    return gone.length;
  },

  addComment(cardId, text, author) {
    let id = 'c-' + uid();
    while (this.comments[commentKey(cardId, id)]) id = 'c-' + uid();
    const c = { id, cardId, author: author || '', created: isoNow(), text: String(text || '').trim() };
    this.comments[commentKey(cardId, id)] = c;
    this.touch();
    return c;
  },

  deleteComment(cardId, id) {
    delete this.comments[commentKey(cardId, id)];
    this.touch();
  },

  commentsOf(cardId) {
    return Object.values(this.comments)
      .filter(c => c.cardId === cardId)
      .sort((a, b) => String(a.created).localeCompare(String(b.created)));
  },

  setConfig(patch, source) {
    Object.assign(this.config, patch);
    this.touch(source);
  },

  // ----- employees & clients -----
  // Renaming rewrites the references on existing cards/comments, so a typo fix
  // does not silently orphan half the board.

  addEmployee(name) {
    const v = String(name || '').trim();
    if (!v || this.config.employees.includes(v)) return;
    this.config.employees.push(v);
    this.touch();
  },

  renameEmployee(oldName, newName) {
    const v = String(newName || '').trim();
    const i = this.config.employees.indexOf(oldName);
    if (!v || i === -1 || this.config.employees.includes(v)) return;
    this.config.employees[i] = v;
    for (const c of Object.values(this.cards)) if (c.author === oldName) c.author = v;
    for (const c of Object.values(this.comments)) if (c.author === oldName) c.author = v;
    this.touch();
  },

  removeEmployee(name) {
    this.config.employees = this.config.employees.filter(e => e !== name);
    this.touch();
  },

  addClient(name, color = '') {
    const v = String(name || '').trim();
    if (!v || this.config.clients.some(c => c.name === v)) return;
    const i = this.config.clients.length;
    this.config.clients.push({ name: v, color: color || FALLBACK_CLIENT_COLORS[i % FALLBACK_CLIENT_COLORS.length] });
    this.touch();
  },

  renameClient(oldName, newName) {
    const v = String(newName || '').trim();
    const c = this.config.clients.find(x => x.name === oldName);
    if (!v || !c || this.config.clients.some(x => x.name === v)) return;
    c.name = v;
    for (const card of Object.values(this.cards)) if (card.client === oldName) card.client = v;
    this.touch();
  },

  setClientColor(name, color) {
    const c = this.config.clients.find(x => x.name === name);
    if (!c) return;
    c.color = color;
    this.touch();
  },

  removeClient(name) {
    this.config.clients = this.config.clients.filter(c => c.name !== name);
    for (const card of Object.values(this.cards)) if (card.client === name) card.client = null;
    this.touch();
  },

  // ----- lists (board columns) -----

  addList(name) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    let id = 'l-' + (slugify(clean) || uid());
    while (this.config.lists.some(l => l.id === id)) id = 'l-' + slugify(clean) + '-' + uid().slice(0, 3);
    const list = { id, name: clean };
    this.config.lists.push(list);
    this.touch();
    return list;
  },

  renameList(id, name) {
    const l = this.config.lists.find(x => x.id === id);
    if (!l || WEEKDAY_IDS.includes(id)) return;
    l.name = String(name || '').trim() || l.name;
    this.touch();
  },

  // Colour codes work for the weekday columns too, so this one is not
  // restricted to custom lists. An empty string clears the colour.
  setListColor(id, color) {
    const l = this.config.lists.find(x => x.id === id);
    if (!l) return;
    l.color = COLOR_RE.test(String(color || '')) ? String(color).toLowerCase() : '';
    this.touch();
  },

  listColor(id) { return this.config.lists.find(l => l.id === id)?.color || ''; },

  // Cards in a deleted list are never lost — they move to the first remaining
  // custom list (there is always at least one, the UI refuses otherwise).
  deleteList(id) {
    if (WEEKDAY_IDS.includes(id)) return;
    const rest = this.customLists().filter(l => l.id !== id);
    if (!rest.length) return;
    this.config.lists = this.config.lists.filter(l => l.id !== id);
    for (const c of Object.values(this.cards)) if (!c.date && c.list === id) c.list = rest[0].id;
    this.touch();
  },

  moveList(id, toIndex) {
    const from = this.config.lists.findIndex(l => l.id === id);
    if (from === -1) return;
    const [l] = this.config.lists.splice(from, 1);
    this.config.lists.splice(Math.max(0, Math.min(toIndex, this.config.lists.length)), 0, l);
    this.touch();
  },

  customLists() { return this.config.lists.filter(l => !WEEKDAY_IDS.includes(l.id)); },
  listName(id) { return this.config.lists.find(l => l.id === id)?.name || id; },

  // ----- derived -----

  clientColor(name) {
    if (!name) return NO_CLIENT_COLOR;
    const i = this.config.clients.findIndex(c => c.name === name);
    if (i === -1) return NO_CLIENT_COLOR;
    return this.config.clients[i].color || FALLBACK_CLIENT_COLORS[i % FALLBACK_CLIENT_COLORS.length];
  },

  // ----- diff against the repository -----

  changes() {
    const list = [];
    for (const c of Object.values(this.cards)) {
      const path = cardPath(c.id);
      const text = serializeCard(c);
      const b = this.base.cards[c.id];
      if (!b || serializeCard(b) !== text) list.push({ path, text });
    }
    for (const id of Object.keys(this.base.cards)) {
      if (!this.cards[id]) list.push({ path: cardPath(id), delete: true });
    }
    for (const [k, c] of Object.entries(this.comments)) {
      const path = commentPath(c.cardId, c.id);
      const text = serializeComment(c);
      const b = this.base.comments[k];
      if (!b || serializeComment(b) !== text) list.push({ path, text });
    }
    for (const [k, c] of Object.entries(this.base.comments)) {
      if (!this.comments[k]) list.push({ path: commentPath(c.cardId, c.id), delete: true });
    }
    const cfgText = serializeConfig(this.config);
    const baseCfgText = this.base.configText != null
      ? serializeConfig(this.base.config)
      : serializeConfig(emptyConfig());
    if (cfgText !== baseCfgText) list.push({ path: CONFIG_PATH, text: cfgText });
    return list;
  },

  isDirty() { return this.changes().length > 0; },

  // ----- remote sync -----

  async _fetchBase(gh, head) {
    const tree = await gh.getTree(head.treeSha);
    const wanted = tree.filter(f => f.type === 'blob' && (
      f.path === CONFIG_PATH
      || (f.path.startsWith(CARD_DIR) && f.path.endsWith('.md'))
      || (f.path.startsWith(COMMENT_DIR) && f.path.endsWith('.md'))
    ));
    const files = {};
    for (const f of wanted) {
      const prev = this.base.files[f.path];
      files[f.path] = prev && prev.sha === f.sha
        ? prev
        : { sha: f.sha, text: this.settings.token ? await gh.getBlobText(f.sha) : await gh.getRawText(head.sha, f.path) };
    }
    return parseFiles(head.sha, files);
  },

  _setBase(newBase) {
    this.base = newBase;
    lsSet(this.key('cache'), { sha: newBase.sha, files: newBase.files });
  },

  // Three-way merge of remote changes into the local draft, with the draft's
  // fork point as common ancestor. Card fields merge independently; when both
  // sides changed the same field the local value wins and the conflict is
  // reported (nothing is lost — the other value is still in git history).
  _mergeIntoDraft(newBase) {
    const fork = this._fork || { cards: this.base.cards, comments: this.base.comments, config: this.base.config };
    const report = { pulled: 0, conflicts: [] };
    const eq = (a, b) => (a ?? null) === (b ?? null);
    const sameCard = (a, b) => serializeCard(a) === serializeCard(b);
    const FIELDS = ['title', 'type', 'date', 'time', 'end', 'list', 'urgency', 'client',
      'repeat', 'until', 'done', 'pinned', 'archived', 'created', 'author', 'body'];

    // Ticks on a repeating to-do merge as a set, never as one value: two people
    // ticking different days of the same series must both keep their tick. A
    // date stays ticked unless one side unticked it and the other did not
    // tick it again.
    const mergeTicks = (f, l, r) => {
      const F = new Set((f && f.doneOn) || []), L = new Set(l.doneOn || []), R = new Set(r.doneOn || []);
      return [...new Set([...L, ...R])]
        .filter(d => (L.has(d) && R.has(d)) || (L.has(d) && !F.has(d)) || (R.has(d) && !F.has(d)))
        .sort();
    };

    const mergedCards = {};
    const ids = new Set([
      ...Object.keys(fork.cards || {}), ...Object.keys(this.cards), ...Object.keys(newBase.cards),
    ]);
    for (const id of ids) {
      const f = (fork.cards || {})[id] || null;
      const l = this.cards[id] || null;
      const r = newBase.cards[id] || null;
      if (l && r) {
        const out = { ...l };
        let pulled = false;
        for (const k of FIELDS) {
          if (eq(l[k], r[k])) continue;
          if (f && eq(l[k], f[k])) { out[k] = r[k]; pulled = true; }        // only remote changed
          else if (f && eq(r[k], f[k])) { /* only local changed — keep */ }
          else report.conflicts.push(`"${l.title || id}": ${k}`);           // both changed — local wins
        }
        const ticks = mergeTicks(f, l, r);
        if (ticks.join() !== (l.doneOn || []).join()) pulled = true;
        out.doneOn = ticks;
        normalizeCard(out);   // e.g. remote dropped the repetition while we ticked a day
        if (pulled) report.pulled++;
        mergedCards[id] = out;
      } else if (l && !r) {
        if (!f) mergedCards[id] = l;                    // created here — keep
        else if (sameCard(l, f)) report.pulled++;       // deleted remotely, untouched here — accept
        else {
          mergedCards[id] = l;
          report.conflicts.push(`"${l.title || id}": deleted remotely but edited here — kept`);
        }
      } else if (!l && r) {
        if (!f) { mergedCards[id] = clone(r); report.pulled++; }   // created remotely — adopt
        else if (sameCard(r, f)) { /* deleted here, unchanged remotely — stays deleted */ }
        else {
          mergedCards[id] = clone(r);
          report.conflicts.push(`"${r.title || id}": deleted here but edited remotely — restored`);
        }
      }
    }

    // Comments are whole-file records; one file per comment means concurrent
    // commenting is a plain union.
    const mergedComments = {};
    const ckeys = new Set([
      ...Object.keys(fork.comments || {}), ...Object.keys(this.comments), ...Object.keys(newBase.comments),
    ]);
    for (const k of ckeys) {
      const f = (fork.comments || {})[k] || null;
      const l = this.comments[k] || null;
      const r = newBase.comments[k] || null;
      const same = (a, b) => a && b && serializeComment(a) === serializeComment(b);
      if (l && r) {
        if (same(l, r)) mergedComments[k] = l;
        else if (f && same(l, f)) { mergedComments[k] = clone(r); report.pulled++; }
        else mergedComments[k] = l;
      } else if (l && !r) {
        if (!f) mergedComments[k] = l;
        else report.pulled++;                            // deleted remotely — accept
      } else if (!l && r) {
        if (!f) { mergedComments[k] = clone(r); report.pulled++; }
        // deleted here — stays deleted
      }
    }
    // a comment whose card is gone on both sides goes with it
    for (const k of Object.keys(mergedComments)) {
      if (!mergedCards[mergedComments[k].cardId]) delete mergedComments[k];
    }

    const fc = fork.config || emptyConfig();
    const conflict = (key, field) => report.conflicts.push(`${key}: ${field}`);
    const employees = mergeKeyedList(fc.employees, this.config.employees, newBase.config.employees,
      x => x, [], conflict).map(x => (typeof x === 'string' ? x : String(x)));
    const clients = mergeKeyedList(fc.clients, this.config.clients, newBase.config.clients,
      c => c.name, ['color'], conflict);
    const lists = mergeKeyedList(fc.lists, this.config.lists, newBase.config.lists,
      l => l.id, ['name', 'color'], conflict);

    let name = this.config.name || '';
    const rn = newBase.config.name || '', fn = fc.name || '';
    if (name !== rn) {
      if (name === fn) name = rn;
      else if (rn !== fn) report.conflicts.push('board name');
    }
    const format = Math.max(this.config.format || 1, newBase.config.format || 1);
    const nextConfig = { format, name, employees, clients, lists };
    if (serializeConfig(nextConfig) !== serializeConfig(this.config)) report.pulled++;

    this.cards = mergedCards;
    this.comments = mergedComments;
    this.config = nextConfig;
    this._setBase(newBase);
    this._draftBaseSha = newBase.sha;
    this._fork = {
      cards: clone(newBase.cards), comments: clone(newBase.comments), config: clone(newBase.config),
    };
    if (!this.changes().length) {
      lsDel(this.key('draft'));
      this.resetToBase();
    } else {
      this._persistDraftNow();
    }
    this.emit('change', { source: 'merge' });
    return report;
  },

  async refresh() {
    if (this.demo || !this.configured() || this.syncing) return;
    this.syncing = true;
    this.lastError = null;
    this.emit('change', { source: 'sync' });
    try {
      const gh = this.client();
      const head = await gh.getHead();
      if (!head) {
        this.base = parseFiles(null, {});          // repo exists, branch has no commits yet
        lsDel(this.key('cache'));
        if (!this._hasDraft) this.resetToBase();
      } else if (head.sha !== this.base.sha) {
        const newBase = await this._fetchBase(gh, head);
        if (this._hasDraft) {
          const report = this._mergeIntoDraft(newBase);
          if (report.pulled || report.conflicts.length) this.emit('merged', report);
        } else {
          this._setBase(newBase);
          this.resetToBase();
        }
      }
      this.lastSync = Date.now();
    } catch (e) {
      this.lastError = e;
      this.emit('error', e);
    } finally {
      this.syncing = false;
      this.emit('change', { source: 'sync' });
    }
  },

  // Another tab wrote a newer draft/cache — adopt it (callers only do this
  // while the tab is hidden, so typing in progress is never clobbered).
  adoptExternal() {
    if (this.saving || this.syncing) return;
    const cache = this.demo ? null : lsGet(this.key('cache'));
    if (cache && cache.files && cache.sha !== this.base.sha) this.base = parseFiles(cache.sha, cache.files);
    const draft = lsGet(this.key('draft'));
    if (draft && draft.cards) this._adopt(draft);
    else this.resetToBase();
    this.emit('change', { source: 'external' });
  },

  // ----- save -----

  // Save = pull + merge + commit. Remote commits made since the draft forked
  // are merged in first, so a save never reverts someone else's work; if a
  // commit lands in the tiny window between our pull and our ref update, GitHub
  // rejects the fast-forward and we pull/merge/retry once.
  async save() {
    if (this.demo) throw new GHError('Demo mode.', 'demo');
    if (!this.configured()) throw new GHError('Not configured.', 'config');
    if (!this.settings.token) throw new GHError('No token.', 'no-token');
    if (this.formatTooNew()) throw new GHError('Newer format.', 'format');
    if (!this.changes().length) return { nothing: true };

    this.saving = true;
    this.emit('change', { source: 'save' });
    try {
      const gh = this.client();
      const pullMerge = async () => {
        const head = await gh.getHead();
        if (head && head.sha !== this._draftBaseSha) {
          const report = this._mergeIntoDraft(await this._fetchBase(gh, head));
          if (report.pulled || report.conflicts.length) this.emit('merged', report);
        }
        return head;
      };

      let head = await pullMerge();
      let changes = this.changes();
      if (!changes.length) return { nothing: true };   // the repo already contained our edits

      let res;
      try {
        res = await gh.commitFiles({ message: commitMessage(this.base, changes), parent: head, changes });
      } catch (e) {
        if (e.code !== 'conflict') throw e;
        head = await pullMerge();
        changes = this.changes();
        if (!changes.length) return { nothing: true };
        res = await gh.commitFiles({ message: commitMessage(this.base, changes), parent: head, changes });
      }

      const files = { ...this.base.files };
      for (const c of changes) {
        if (c.delete) delete files[c.path];
        else if (c.text != null) files[c.path] = { sha: 'local:' + res.sha, text: c.text };
      }
      this.base = parseFiles(res.sha, files);
      this._hasDraft = false;
      this._draftBaseSha = res.sha;
      this._fork = null;
      lsSet(this.key('cache'), { sha: res.sha, files });
      lsDel(this.key('draft'));
      return { sha: res.sha, count: changes.length };
    } finally {
      this.saving = false;
      this.emit('change', { source: 'save' });
    }
  },

  discardDraft() {
    lsDel(this.key('draft'));
    this.resetToBase();
    this.emit('change');
  },
};

store._persistDraft = debounce(() => store._persistDraftNow(), 250);

export { PREFIX, PROJECTS_KEY, ACTIVE_KEY };
