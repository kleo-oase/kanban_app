// query.js — the one place that turns the working copy plus the current
// filter/sort/search settings into the lists the two views render.

import { store } from './store.js';
import {
  WEEKDAY_IDS, TYPES, URGENCIES,
  todayStr, addDays, startOfWeek, weekdaysOf, effectiveDate, occurrences, isDateStr,
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

function monthRange(ds = todayStr()) {
  const first = ds.slice(0, 8) + '01';
  const [y, m] = first.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return [first, last];
}

// Does the card (including every repetition) fall inside [from, to]?
const hitsRange = (card, from, to) => occurrences(card, from, to).length > 0;

export function inRange(card, range) {
  const today = todayStr();
  switch (range) {
    case 'nodate': return !card.date;
    case 'today': return !!card.date && hitsRange(card, today, today);
    case 'week': {
      const mon = startOfWeek(today);
      return !!card.date && hitsRange(card, mon, addDays(mon, 6));
    }
    case 'next7': return !!card.date && hitsRange(card, today, addDays(today, 6));
    case 'month': {
      const [a, b] = monthRange(today);
      return !!card.date && hitsRange(card, a, b);
    }
    case 'overdue':
      return !!card.date && !card.done && (effectiveDate(card) || card.date) < today;
    default: return true;
  }
}

export function matchesSearch(card, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return true;
  const hay = `${card.title || ''}\n${card.body || ''}`.toLowerCase();
  return needle.split(/\s+/).every(w => hay.includes(w));
}

export function passesFilter(card) {
  const v = store.view;
  if (v.types.length && !v.types.includes(card.type)) return false;
  if (v.urgencies.length && !v.urgencies.includes(card.urgency || '')) return false;
  if (v.clients.length && !v.clients.includes(card.client || '')) return false;
  if (v.authors.length && !v.authors.includes(card.author || '')) return false;
  if (v.hideDone && card.type === 'todo' && card.done) return false;
  if (!inRange(card, v.range)) return false;
  if (!matchesSearch(card, v.search)) return false;
  return true;
}

export const filterIsActive = () => {
  const v = store.view;
  return !!(v.types.length || v.urgencies.length || v.clients.length || v.authors.length
    || v.range !== 'all' || v.hideDone);
};

// ---------- sorting ----------

const keyFor = (card, by) => {
  switch (by) {
    case 'urgency': return URGENCY_ORDER[card.urgency] ?? 99;
    case 'type': return TYPE_ORDER[card.type] ?? 99;
    case 'client': return (card.client || '￿').toLowerCase();
    case 'title': return (card.title || '').toLowerCase();
    case 'created': return card.created || '';
    case 'date':
    default: return effectiveDate(card) || '9999-99-99';
  }
};

// Pinned info cards stay at the top and completed to-dos sink to the bottom,
// whatever the sort key is.
export function sortCards(cards, by = store.view.sort, dir = store.view.sortDir) {
  const sign = dir === 'desc' ? -1 : 1;
  return cards.slice().sort((a, b) => {
    const pa = a.pinned ? 0 : 1, pb = b.pinned ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const da = a.type === 'todo' && a.done ? 1 : 0;
    const db = b.type === 'todo' && b.done ? 1 : 0;
    if (da !== db) return da - db;
    const ka = keyFor(a, by), kb = keyFor(b, by);
    if (ka < kb) return -sign;
    if (ka > kb) return sign;
    // stable, human-friendly tiebreakers
    const ta = `${effectiveDate(a) || '9999-99-99'}${a.time || '99:99'}`;
    const tb = `${effectiveDate(b) || '9999-99-99'}${b.time || '99:99'}`;
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (a.title || '').localeCompare(b.title || '');
  });
}

// ---------- what each view asks for ----------

// Everything outside the archive. The archive has its own view and is never
// mixed into the board, the calendar, the filter counts or the search.
export const allCards = () => Object.values(store.cards).filter(c => !c.archived);

export const visibleCards = () => allCards().filter(passesFilter);

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

// Colour code for a to-do in the list view: overdue is red, due today yellow.
// Completed and archived cards are never flagged. The board renders the result
// as the class `due-<status>`, so keep the values bare.
export function dueStatus(card) {
  if (card.type !== 'todo' || card.done || card.archived) return '';
  const d = effectiveDate(card);
  if (!d) return '';
  const today = todayStr();
  if (d < today) return 'overdue';
  if (d === today) return 'today';
  return '';
}

export function cardsForList(listId) {
  const wanted = visibleCards().filter(c => (
    WEEKDAY_IDS.includes(listId)
      ? !!c.date && weekdaysOf(c).includes(listId)
      : !c.date && listOf(c) === listId
  ));
  return sortCards(wanted);
}

// Cards shown on one calendar day. By default only appointments appear
// (`type: date`); the filter menu can widen that to every category.
export function cardsForDate(ds) {
  if (!isDateStr(ds)) return [];
  const all = store.view.calAllTypes;
  const hits = visibleCards().filter(c => (all || c.type === 'date') && occurrences(c, ds, ds).length);
  return hits.sort((a, b) => {
    const ta = a.time || '99:99', tb = b.time || '99:99';
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (a.title || '').localeCompare(b.title || '');
  });
}

export const counts = () => ({
  total: allCards().length,
  shown: visibleCards().length,
});
