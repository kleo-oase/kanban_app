// util.js — ids, dates & recurrence, a YAML subset (config + frontmatter), the
// card/comment file formats, a Markdown subset renderer and misc helpers.
//
// The YAML reader/writer intentionally supports only the shapes this tool
// writes: a flat frontmatter block, and a config file with scalar lists /
// lists of flat objects.

export const CARD_DIR = 'data/cards/';
export const COMMENT_DIR = 'data/comments/';
export const CONFIG_PATH = 'data/config.yml';

// ---------- vocabularies (the values that end up in the files) ----------

export const TYPES = ['date', 'info', 'todo'];
export const URGENCIES = ['today', 'tomorrow', 'later'];
export const REPEATS = ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly'];
export const WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const TYPE_COLORS = { date: '#5b8cff', info: '#8b8f9c', todo: '#f0a02a' };
export const URGENCY_COLORS = { today: '#e05252', tomorrow: '#e8a33d', later: '#3aa76d' };
export const NO_CLIENT_COLOR = '#8a93a6';

export const FALLBACK_CLIENT_COLORS = [
  '#4f8cff', '#8b5cf6', '#f59e0b', '#10b981',
  '#ef4444', '#06b6d4', '#e879a0', '#84cc16',
];

// ---------- tiny helpers ----------

export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const uid = () => Math.random().toString(36).slice(2, 8);

export const slugify = s => String(s || '').toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

export const lsGet = k => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
};
export const lsSet = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
};
export const lsDel = k => { try { localStorage.removeItem(k); } catch { } };

// ---------- dates ----------
// All date strings are `YYYY-MM-DD`, all math happens in UTC so that daylight
// saving can never shift a card by a day.

export const DAY_MS = 86400000;

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isDateStr = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
export const isTimeStr = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

export const dateToUtc = ds => {
  const [y, m, d] = String(ds).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export const utcToDate = ms => new Date(ms).toISOString().slice(0, 10);

export const addDays = (ds, n) => utcToDate(dateToUtc(ds) + n * DAY_MS);

export const addMonths = (ds, n) => {
  const [y, m, d] = String(ds).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  // clamp to the last day of the target month (31 Jan + 1 month = 28/29 Feb)
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return utcToDate(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, last)));
};

export const diffDays = (a, b) => Math.round((dateToUtc(b) - dateToUtc(a)) / DAY_MS);

// 0 = Monday … 6 = Sunday
export const weekdayIndex = ds => (new Date(dateToUtc(ds)).getUTCDay() + 6) % 7;
export const weekdayId = ds => WEEKDAY_IDS[weekdayIndex(ds)];

export const startOfWeek = ds => addDays(ds, -weekdayIndex(ds));

// ISO-8601 week number (weeks start on Monday, week 1 contains the first Thursday).
export function isoWeek(ds) {
  const d = new Date(dateToUtc(ds));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // Thursday of this week
  // Jan 4 is always in ISO week 1, so the Thursday of its week is week 1's Thursday.
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((d.getTime() - first.getTime()) / (7 * DAY_MS));
}

// ---------- recurrence ----------
// A card with `repeat` recurs from its `date` until `until` (or forever).
// `occurrences` lists the dates it falls on inside [from, to].

export function occurrences(card, from, to) {
  const out = [];
  if (!card || !isDateStr(card.date)) return out;
  const start = card.date;
  const stop = card.until && isDateStr(card.until) && card.until < to ? card.until : to;
  if (!card.repeat || !REPEATS.includes(card.repeat)) {
    if (start >= from && start <= to) out.push(start);
    return out;
  }
  if (start > stop) return out;

  // Month/year steps are always computed from the anchor, never from the
  // previous occurrence: a repeat starting on the 31st must give back the 31st
  // in March, not stay on the 28th it was clamped to in February.
  const step = { daily: 1, weekdays: 1, weekly: 7, biweekly: 14 }[card.repeat] || 0;
  const monthStep = card.repeat === 'monthly' ? 1 : card.repeat === 'yearly' ? 12 : 0;
  const nth = n => (step ? addDays(start, n * step) : addMonths(start, n * monthStep));

  // jump straight to the window instead of walking there from the anchor
  let n = 0;
  if (start < from) {
    if (step) n = Math.max(0, Math.floor(diffDays(start, from) / step));
    else {
      const [fy, fm] = from.split('-').map(Number);
      const [sy, sm] = start.split('-').map(Number);
      n = Math.max(0, Math.floor(((fy - sy) * 12 + (fm - sm)) / monthStep) - 1);
    }
  }

  let guard = 0;
  let cur = nth(n);
  while (cur <= stop && guard++ < 2000) {
    if (cur >= from && !(card.repeat === 'weekdays' && weekdayIndex(cur) > 4)) out.push(cur);
    cur = nth(++n);
  }
  return out;
}

// The next occurrence on or after `from` (null if the recurrence has ended).
// Always goes through `occurrences`, so a "weekdays" series anchored on a
// Saturday correctly starts on the Monday after.
export function nextOccurrence(card, from = todayStr()) {
  if (!card || !isDateStr(card.date)) return null;
  const start = card.date > from ? card.date : from;
  const found = occurrences(card, start, addDays(start, 800));
  return found[0] || null;
}

// The last occurrence on or before `onOrBefore` (null if the series has not
// started yet). Looks at the last ~13 months first so a long daily series does
// not have to be walked from its very first day.
export function lastOccurrence(card, onOrBefore) {
  if (!card || !isDateStr(card.date) || card.date > onOrBefore) return null;
  const near = occurrences(card, addDays(onOrBefore, -400), onOrBefore);
  if (near.length) return near[near.length - 1];
  const all = occurrences(card, card.date, onOrBefore);
  return all.length ? all[all.length - 1] : null;
}

export const isOccurrence = (card, ds) => occurrences(card, ds, ds).length > 0;

// The date a card is "sorted by" — its next occurrence for repeating cards.
export const effectiveDate = card => (card.repeat ? nextOccurrence(card) : null) || card.date || null;

// ---------- YAML subset ----------

export function yamlScalar(v) {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  // dates and ISO timestamps stay unquoted — they read better in a diff and
  // round-trip unchanged through parseYamlScalar
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?Z)?$/.test(s)) return s;
  const plainOk = /^[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ _.,()\/'!?+&-]*$/.test(s)
    && !/\s$/.test(s)
    && !/^(true|false|null|yes|no|on|off)$/i.test(s)
    && !/^[+-]?[\d.]+$/.test(s);
  return plainOk ? s : JSON.stringify(s);
}

export function parseYamlScalar(raw) {
  let s = String(raw ?? '').trim();
  if (!s || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s[0] === '"' && s.endsWith('"') && s.length > 1) {
    try { return JSON.parse(s); } catch { return s.slice(1, -1); }
  }
  if (s[0] === "'" && s.endsWith("'") && s.length > 1) return s.slice(1, -1).replace(/''/g, "'");
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

// Parses the config shape: scalar top-level keys (`name: …`), `key: []`, or
// `key:` followed by `- scalar` / `- key: value` items with indented
// `key: value` continuation lines.
export function parseYamlBlocks(text) {
  const out = {};
  let key = null, obj = null;
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = rawLine.match(/^ */)[0].length;
    if (indent === 0) {
      const m = trimmed.match(/^([\w-]+):\s*(.*)$/);
      if (m) {
        obj = null;
        const val = m[2].trim();
        if (!val || val === '[]') { key = m[1]; out[key] ||= []; }
        else { key = null; out[m[1]] = parseYamlScalar(val); }
      }
      continue;
    }
    if (!key) continue;
    if (trimmed.startsWith('- ') || trimmed === '-') {
      const rest = trimmed.slice(1).trim();
      const m = rest.match(/^([\w-]+):\s*(.*)$/);
      if (m) { obj = { [m[1]]: parseYamlScalar(m[2]) }; out[key].push(obj); }
      else { obj = null; out[key].push(parseYamlScalar(rest)); }
    } else if (obj) {
      const m = trimmed.match(/^([\w-]+):\s*(.*)$/);
      if (m) obj[m[1]] = parseYamlScalar(m[2]);
    }
  }
  return out;
}

export const defaultLists = () => [
  ...WEEKDAY_IDS.map(id => ({ id, name: '', color: '' })),
  { id: 'l-backlog', name: 'Backlog', color: '' },
];

export const COLOR_RE = /^#[0-9a-f]{6}$/i;

export const emptyConfig = () => ({
  format: 1, name: '', employees: [], clients: [], lists: defaultLists(),
});

export function parseConfig(text) {
  const raw = parseYamlBlocks(text);
  const cfg = emptyConfig();
  if (typeof raw.format === 'number' && raw.format >= 1) cfg.format = raw.format;
  if (typeof raw.name === 'string') cfg.name = raw.name;
  cfg.employees = (Array.isArray(raw.employees) ? raw.employees : [])
    .filter(p => typeof p === 'string' && p.trim())
    .map(p => p.trim());
  cfg.clients = (Array.isArray(raw.clients) ? raw.clients : [])
    .map(c => (typeof c === 'string' ? { name: c, color: '' } : c))
    .filter(c => c && typeof c === 'object' && c.name)
    .map(c => ({ name: String(c.name), color: c.color ? String(c.color) : '' }));

  const lists = (Array.isArray(raw.lists) ? raw.lists : [])
    .map(l => (typeof l === 'string' ? { id: l, name: '' } : l))
    .filter(l => l && typeof l === 'object' && l.id)
    .map(l => ({
      id: String(l.id),
      name: WEEKDAY_IDS.includes(String(l.id)) ? '' : String(l.name || l.id),
      color: COLOR_RE.test(String(l.color || '')) ? String(l.color).toLowerCase() : '',
    }));
  // the seven weekday columns always exist; a config that omits them gets them back
  const have = new Set(lists.map(l => l.id));
  const missing = WEEKDAY_IDS.filter(id => !have.has(id)).map(id => ({ id, name: '', color: '' }));
  cfg.lists = missing.length && !lists.length ? defaultLists() : [...missing, ...lists];
  // de-duplicate ids, keep first occurrence
  const seen = new Set();
  cfg.lists = cfg.lists.filter(l => (seen.has(l.id) ? false : (seen.add(l.id), true)));
  return cfg;
}

export function serializeConfig(cfg) {
  const L = [
    '# Kanban board configuration.',
    '# Managed by the board\'s settings menu — safe to edit by hand too.',
    '',
    `format: ${cfg.format || 1}`,
    '',
  ];
  if (cfg.name) { L.push(`name: ${yamlScalar(cfg.name)}`); L.push(''); }
  L.push(cfg.employees.length ? 'employees:' : 'employees: []');
  for (const p of cfg.employees) L.push(`  - ${yamlScalar(p)}`);
  L.push('');
  L.push(cfg.clients.length ? 'clients:' : 'clients: []');
  for (const c of cfg.clients) {
    L.push(`  - name: ${yamlScalar(c.name)}`);
    if (c.color) L.push(`    color: ${JSON.stringify(c.color)}`);
  }
  L.push('');
  L.push(cfg.lists.length ? 'lists:' : 'lists: []');
  for (const l of cfg.lists) {
    L.push(`  - id: ${yamlScalar(l.id)}`);
    if (!WEEKDAY_IDS.includes(l.id) && l.name) L.push(`    name: ${yamlScalar(l.name)}`);
    if (l.color) L.push(`    color: ${JSON.stringify(l.color)}`);
  }
  return L.join('\n') + '\n';
}

// ---------- frontmatter ----------

function splitFrontmatter(text) {
  let body = String(text || '');
  const fields = {};
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(body);
  if (m) {
    body = body.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const km = line.match(/^([\w-]+):\s*(.*)$/);
      if (km) fields[km[1]] = km[2];
    }
  }
  return { fields, body: body.replace(/^\s*\n/, '').replace(/\s+$/, '') };
}

const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
export { isoNow };

// ---------- card files ----------

export function emptyCard(id = '') {
  return {
    id, title: '', type: 'todo', date: null, time: null, end: null, list: null,
    urgency: null, client: null, repeat: null, until: null, done: false, doneOn: [],
    pinned: false, archived: null, created: null, author: '', body: '',
  };
}

// `info` cards are notes, not scheduled work: they never carry a date, a time,
// a repetition or an urgency, and they can be pinned to the top of their list
// instead. Enforced in one place so hand-written files, the editor and the
// merge all agree.
//
// A to-do is ticked in one of two ways: a one-off card with `done`, a repeating
// one per iteration with `doneOn` (the dates that were ticked), so ticking this
// Monday leaves next Monday open. Only the field that fits the card survives.
// Also fills fields that drafts written by older app versions do not have.
export function normalizeCard(c) {
  if (!Array.isArray(c.doneOn)) c.doneOn = [];
  if (c.end === undefined) c.end = null;
  if (c.type === 'info') {
    c.date = c.time = c.end = c.repeat = c.until = c.urgency = null;
  } else {
    c.pinned = false;
    if (c.date) c.list = null;
    else c.time = c.end = c.repeat = c.until = null;
  }
  if (!c.time || !c.end || c.end <= c.time) c.end = null;
  if (!c.repeat) c.until = null;
  if (c.type !== 'todo') { c.done = false; c.doneOn = []; }
  else if (c.repeat) c.done = false;
  else c.doneOn = [];
  return c;
}

// Is this card ticked for the given date? One-off to-dos ignore the date.
export function isDoneOn(card, date) {
  if (!card || card.type !== 'todo') return false;
  if (card.repeat) return !!date && (card.doneOn || []).includes(date);
  return !!card.done;
}

// "09:30" or "09:30–10:15"
export const timeRange = card => (card.time ? (card.end ? `${card.time}–${card.end}` : card.time) : '');

// `[2026-10-05, 2026-10-12]` (or a single bare date) -> sorted unique dates
function parseDateList(raw) {
  let str = String(raw ?? '').trim();
  if (str.startsWith('[') && str.endsWith(']')) str = str.slice(1, -1);
  const out = str.split(',').map(x => parseYamlScalar(x)).filter(isDateStr).map(String);
  return [...new Set(out)].sort();
}

export function parseCardFile(path, text) {
  const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  const { fields, body } = splitFrontmatter(text);
  const c = emptyCard(id);
  const v = k => parseYamlScalar(fields[k]);

  c.title = fields.title != null ? String(v('title') ?? '') : '';
  const type = String(v('type') ?? '').toLowerCase();
  c.type = TYPES.includes(type) ? type : 'todo';
  const date = v('date');
  c.date = isDateStr(date) ? String(date) : null;
  const time = v('time');
  c.time = c.date && isTimeStr(time) ? String(time) : null;
  const end = v('end');
  c.end = c.time && isTimeStr(end) ? String(end) : null;
  const urgency = String(v('urgency') ?? '').toLowerCase();
  c.urgency = URGENCIES.includes(urgency) ? urgency : null;
  const client = v('client');
  c.client = client == null ? null : String(client);
  const list = v('list');
  // read it unconditionally — normalizeCard below decides whether a card is
  // allowed to keep both a list and a date, and an info card keeps the list
  c.list = list == null ? null : String(list);
  const repeat = String(v('repeat') ?? '').toLowerCase();
  c.repeat = c.date && REPEATS.includes(repeat) ? repeat : null;
  const until = v('until');
  c.until = c.repeat && isDateStr(until) ? String(until) : null;
  c.done = c.type === 'todo' && v('done') === true;
  c.doneOn = parseDateList(fields.done_on);
  c.pinned = v('pinned') === true;
  const archived = v('archived');
  c.archived = archived ? String(archived) : null;
  const created = v('created');
  c.created = created ? String(created) : null;
  const author = v('author');
  c.author = author == null ? '' : String(author);
  c.body = body;
  return normalizeCard(c);
}

export function serializeCard(card) {
  const L = ['---', `title: ${yamlScalar(card.title || 'Untitled')}`];
  L.push(`type: ${TYPES.includes(card.type) ? card.type : 'todo'}`);
  if (card.date && card.type !== 'info') {
    L.push(`date: ${card.date}`);
    if (card.time) L.push(`time: ${JSON.stringify(card.time)}`);
    if (card.time && card.end) L.push(`end: ${JSON.stringify(card.end)}`);
    if (card.repeat && REPEATS.includes(card.repeat)) {
      L.push(`repeat: ${card.repeat}`);
      if (card.until) L.push(`until: ${card.until}`);
    }
  } else if (card.list) {
    L.push(`list: ${yamlScalar(card.list)}`);
  }
  if (card.type !== 'info' && card.urgency && URGENCIES.includes(card.urgency)) {
    L.push(`urgency: ${card.urgency}`);
  }
  if (card.client) L.push(`client: ${yamlScalar(card.client)}`);
  if (card.type === 'todo') {
    const ticked = [...new Set(card.doneOn || [])].filter(isDateStr).sort();
    if (card.repeat && card.date) { if (ticked.length) L.push(`done_on: [${ticked.join(', ')}]`); }
    else if (card.done) L.push('done: true');
  }
  if (card.type === 'info' && card.pinned) L.push('pinned: true');
  if (card.archived) L.push(`archived: ${yamlScalar(card.archived)}`);
  if (card.created) L.push(`created: ${yamlScalar(card.created)}`);
  if (card.author) L.push(`author: ${yamlScalar(card.author)}`);
  L.push('---');
  const body = String(card.body || '').trim();
  return L.join('\n') + '\n' + (body ? '\n' + body + '\n' : '');
}

export const cardPath = id => `${CARD_DIR}${id}.md`;

// ---------- comment files ----------

export const commentPath = (cardId, id) => `${COMMENT_DIR}${cardId}/${id}.md`;
export const commentKey = (cardId, id) => `${cardId}/${id}`;

export function parseCommentFile(path, text) {
  const rest = path.slice(COMMENT_DIR.length).replace(/\.md$/, '');
  const slash = rest.indexOf('/');
  if (slash < 1) return null;
  const cardId = rest.slice(0, slash);
  const id = rest.slice(slash + 1);
  if (!id || id.includes('/')) return null;
  const { fields, body } = splitFrontmatter(text);
  const author = parseYamlScalar(fields.author);
  const created = parseYamlScalar(fields.created);
  return {
    id, cardId,
    author: author == null ? '' : String(author),
    created: created ? String(created) : '',
    text: body,
  };
}

export function serializeComment(c) {
  const L = ['---'];
  if (c.author) L.push(`author: ${yamlScalar(c.author)}`);
  if (c.created) L.push(`created: ${yamlScalar(c.created)}`);
  L.push('---');
  const body = String(c.text || '').trim();
  return L.join('\n') + '\n' + (body ? '\n' + body + '\n' : '');
}

// ---------- misc ----------

export function contrastOn(hex) {
  const m = String(hex || '').match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return '#fff';
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1b2430' : '#fff';
}

export function b64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function b64DecodeUtf8(b64) {
  const bin = atob(String(b64 || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
