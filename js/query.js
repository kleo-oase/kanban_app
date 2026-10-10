// query.js — the one place that turns the working copy plus the current
// filter/sort/search settings into what the views render.
//
// Views do not render cards, they render *entries*: a card at a date. A one-off
// card is one entry. A repeating card is one entry per iteration — each with its
// own date and its own tick — while title, notes and comments stay shared by the
// whole series. Filters that are about time (date range, completed) therefore
// work per entry; filters about content (category, client, search…) per card.

import { store } from './store.js';
import {
  TYPES, URGENCIES,
  todayStr, addDays, startOfWeek, weekdayId, effectiveDate,
  occurrences, nextOccurrence, lastOccurrence, isOccurrence, isDoneOn, isDateStr,
} from './util.js';

const TYPE_ORDER = Object.fromEntries(TYPES.map((t, i) => [t, i]));
const URGENCY_ORDER = Object.fromEntries(URGENCIES.map((u, i) => [u, i]));

// The list a dateless card belongs to; cards pointing at a list that no longer
// exists fall back to the first custom list so they can never disappear.
export function listOf(card) {
  if (card.date) return null;
  const custom = store.customLists();
  if (!custom.length) return null;
  return custom.some(l => l.id === card.list) ? card.list : custom[0].id;
}

// The board shows the current calendar week, Monday to Sunday.
export function boardWeek(today = todayStr()) {
  const mon = startOfWeek(today);
  return [mon, addDays(mon, 6)];
}

// Which dates a card stands for on the board. A one-off card: its own date. A
// repeating card: every iteration in the current week, so a ticked one stays
// visible (struck through) and a missed one stays red until Sunday; on Monday
// the new week starts fresh. A series with no iteration this week (every two
// weeks, monthly, not started yet) shows its next one, and a series that has
// ended shows its last one — a card never silently vanishes from the board.
export function boardDates(card, [mon, sun] = boardWeek()) {
  if (!card.date) return [null];
  if (!card.repeat) return [card.date];
  const inWeek = occurrences(card, mon, sun);
  if (inWeek.length) return inWeek;
  const next = nextOccurrence(card, addDays(sun, 1));
  if (next) return [next];
  return [lastOccurrence(card, mon) || card.date];
}

const entry = (card, date, list) => ({ card, date, list, done: isDoneOn(card, date) });

export function boardEntriesOf(card) {
  return boardDates(card)
    .map(d => entry(card, d, d ? weekdayId(d) : listOf(card)))
    .filter(e => e.list);
}

// ---------- filtering ----------

export function matchesSearch(card, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return true;
  const hay = `${card.title || ''}\n${card.body || ''}`.toLowerCase();
  return needle.split(/\s+/).every(w => hay.includes(w));
}

// Content filters: everything that is the same for every iteration of a card.
export function cardPasses(card) {
  const v = store.view;
  if (v.types.length && !v.types.includes(card.type)) return false;
  if (v.urgencies.length && !v.urgencies.includes(card.urgency || '')) return false;
  if (v.clients.length && !v.clients.includes(card.client || '')) return false;
  if (v.authors.length && !v.authors.includes(card.author || '')) return false;
  return matchesSearch(card, v.search);
}

function monthRange(ds = todayStr()) {
  const first = ds.slice(0, 8) + '01';
  const [y, m] = first.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return [first, last];
}

// Time filters judge the entry's own date, so "today" keeps only today's
// iteration of a daily to-do instead of the whole series.
export function entryInRange(e, range) {
  const today = todayStr();
  const d = e.date;
  switch (range) {
    case 'nodate': return !d;
    case 'today': return d === today;
    case 'week': { const [a, b] = boardWeek(today); return !!d && d >= a && d <= b; }
    case 'next7': return !!d && d >= today && d <= addDays(today, 6);
    case 'month': { const [a, b] = monthRange(today); return !!d && d >= a && d <= b; }
    case 'overdue': return dueStatus(e) === 'overdue';
    default: return true;
  }
}

export function entryPasses(e) {
  if (!cardPasses(e.card)) return false;
  if (store.view.hideDone && e.done) return false;
  return entryInRange(e, store.view.range);
}

export const filterIsActive = () => {
  const v = store.view;
  return !!(v.types.length || v.urgencies.length || v.clients.length || v.authors.length
    || v.range !== 'all' || v.hideDone);
};

// ---------- sorting ----------

const keyFor = (e, by) => {
  const c = e.card;
  switch (by) {
    case 'urgency': return URGENCY_ORDER[c.urgency] ?? 99;
    case 'type': return TYPE_ORDER[c.type] ?? 99;
    case 'client': return (c.client || '\uffff').toLowerCase();
    case 'title': return (c.title || '').toLowerCase();
    case 'created': return c.created || '';
    case 'date':
    default: return e.date || '9999-99-99';
  }
};

// Pinned info cards stay at the top and ticked to-dos sink to the bottom,
// whatever the sort key is.
export function sortEntries(entries, by = store.view.sort, dir = store.view.sortDir) {
  const sign = dir === 'desc' ? -1 : 1;
  return entries.slice().sort((a, b) => {
    const pa = a.card.pinned ? 0 : 1, pb = b.card.pinned ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const da = a.done ? 1 : 0, db = b.done ? 1 : 0;
    if (da !== db) return da - db;
    const ka = keyFor(a, by), kb = keyFor(b, by);
    if (ka < kb) return -sign;
    if (ka > kb) return sign;
    // stable, human-friendly tiebreakers
    const ta = `${a.date || '9999-99-99'}${a.card.time || '99:99'}`;
    const tb = `${b.date || '9999-99-99'}${b.card.time || '99:99'}`;
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (a.card.title || '').localeCompare(b.card.title || '');
  });
}

// ---------- what each view asks for ----------

// Everything outside the archive. The archive has its own view and is never
// mixed into the board, the calendar, the filter counts or the search.
export const allCards = () => Object.values(store.cards).filter(c => !c.archived);

export const visibleBoardEntries = () => allCards().flatMap(boardEntriesOf).filter(entryPasses);

// The board in one pass: list id -> sorted entries of that column.
export function boardColumns() {
  const cols = new Map();
  for (const e of visibleBoardEntries()) {
    if (!cols.has(e.list)) cols.set(e.list, []);
    cols.get(e.list).push(e);
  }
  for (const [id, list] of cols) cols.set(id, sortEntries(list));
  return cols;
}

// Entries shown on one calendar day. By default only appointments appear
// (`type: date`); the filter menu can widen that to every category.
export function entriesForDate(ds) {
  if (!isDateStr(ds)) return [];
  const all = store.view.calAllTypes;
  return allCards()
    .filter(c => (all || c.type === 'date') && isOccurrence(c, ds))
    .map(c => entry(c, ds, weekdayId(ds)))
    .filter(entryPasses)
    .sort((a, b) => {
      const ta = a.card.time || '99:99', tb = b.card.time || '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return (a.card.title || '').localeCompare(b.card.title || '');
    });
}

// Archived cards, grouped by the month they were due, newest first; cards
// without a date come last. That is what "nach Fälligkeit" asks for and it
// keeps a long archive scannable.
export function archiveGroups() {
  const cards = store.archivedCards().filter(c => matchesSearch(c, store.view.search));
  const groups = new Map();
  for (const c of cards) {
    const d = effectiveDate(c) || c.date;
    const key = d ? d.slice(0, 7) : '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const keys = [...groups.keys()].sort().reverse();
  if (groups.has('')) keys.splice(keys.indexOf(''), 1), keys.push('');   // undated last
  return keys.map(key => ({
    key,
    cards: groups.get(key).sort((a, b) => {
      const da = a.date || '', db = b.date || '';
      if (da !== db) return da < db ? 1 : -1;
      return (a.title || '').localeCompare(b.title || '');
    }),
  }));
}

// Colour code for a to-do entry in the list view: overdue is red, due today
// yellow — judged per iteration, so last Monday's missed tick does not colour
// next Monday. The board renders the result as the class `due-<status>`.
export function dueStatus(e) {
  const c = e.card;
  if (c.type !== 'todo' || e.done || c.archived || !e.date) return '';
  const today = todayStr();
  if (e.date < today) return 'overdue';
  if (e.date === today) return 'today';
  return '';
}

// For the search row: how many cards have at least one visible entry.
export function counts() {
  const shown = new Set(visibleBoardEntries().map(e => e.card.id));
  return { total: allCards().length, shown: shown.size };
}
