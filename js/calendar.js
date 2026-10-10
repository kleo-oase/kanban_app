// calendar.js — three modes over the same day cells:
//   month  seven weekday columns, one row per calendar week, ISO week numbers
//   week   seven tall columns for one week
//   day    a single column for one day
// Repeating cards appear on every occurrence, each with its own tick; week and
// day view show the full time span ("09:30–10:15"), the month grid only the
// start to save room.

import { store } from './store.js';
import { entriesForDate } from './query.js';
import { openCard, createCard } from './card.js';
import { t, weekdayShort, fmtMonthYear, fmtDate, fmtDateLong, fmtDayShort } from './i18n.js';
import {
  WEEKDAY_IDS, esc, todayStr, addDays, addMonths, startOfWeek, isoWeek, timeRange,
} from './util.js';

const MODES = ['month', 'week', 'day'];

let root = null;

const anchor = () => store.view.calAnchor || todayStr();
const mode = () => (MODES.includes(store.view.calMode) ? store.view.calMode : 'month');

// How far one click of ‹ / › moves, per mode.
function shift(by) {
  const a = anchor();
  const next = mode() === 'month' ? addMonths(a, by)
    : mode() === 'week' ? addDays(a, by * 7)
      : addDays(a, by);
  store.setView({ calAnchor: next });
}

function weeksOfMonth(a) {
  const first = a.slice(0, 8) + '01';
  const [y, m] = first.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const out = [];
  let cur = startOfWeek(first);
  const stop = startOfWeek(last);
  while (cur <= stop) {
    out.push(Array.from({ length: 7 }, (_, i) => addDays(cur, i)));
    cur = addDays(cur, 7);
  }
  return out;
}

function title() {
  const a = anchor();
  if (mode() === 'month') return fmtMonthYear(a);
  if (mode() === 'day') return fmtDateLong(a);
  const mon = startOfWeek(a);
  return `${t('cal.week_of', { n: isoWeek(mon) })} · ${fmtDate(mon)} – ${fmtDate(addDays(mon, 6), true)}`;
}

// ---------- entries ----------

function entryHtml(e, big = false) {
  const card = e.card;
  const color = card.client ? store.clientColor(card.client) : '';
  const time = big ? timeRange(card) : card.time;
  return `<button class="cal-entry${big ? ' big' : ''} t-${card.type}${e.done ? ' done' : ''}${card.urgency ? ' u-' + card.urgency : ''}"
      data-id="${esc(card.id)}" data-date="${esc(e.date)}"
      title="${esc(timeRange(card) ? timeRange(card) + ' ' : '')}${esc(card.title || '')}${card.client ? ' — ' + esc(card.client) : ''}">
    <span class="dot" style="background:${esc(color || 'transparent')};${color ? '' : 'border-color:currentColor'}"></span>
    ${time ? `<time>${esc(time)}</time>` : ''}
    <span class="cal-title">${esc(card.title || '—')}</span>
    ${big && card.client ? `<span class="cal-client">${esc(card.client)}</span>` : ''}
  </button>`;
}

const dayCell = (ds, monthKey, today) => {
  const cards = entriesForDate(ds);
  const out = monthKey && ds.slice(0, 7) !== monthKey;
  return `<div class="cal-day${out ? ' out' : ''}${ds === today ? ' today' : ''}" data-date="${ds}">
    <div class="cal-daynum">${Number(ds.slice(8, 10))}</div>
    <div class="cal-entries">${cards.map(c => entryHtml(c)).join('')}</div>
  </div>`;
};

// ---------- the three grids ----------

function monthGrid(a, today) {
  const monthKey = a.slice(0, 7);
  return `<div class="cal-grid">
    <div class="cal-head cal-gutter">${esc(t('cal.week_short'))}</div>
    ${WEEKDAY_IDS.map(id => `<div class="cal-head">${esc(weekdayShort(id))}</div>`).join('')}
    ${weeksOfMonth(a).map(week => `
      <div class="cal-wk">${isoWeek(week[0])}</div>
      ${week.map(ds => dayCell(ds, monthKey, today)).join('')}`).join('')}
  </div>`;
}

function weekGrid(a, today) {
  const mon = startOfWeek(a);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return `<div class="cal-week">
    ${days.map(ds => {
      const cards = entriesForDate(ds);
      return `<section class="cal-col${ds === today ? ' today' : ''}" data-date="${ds}">
        <header>${esc(fmtDayShort(ds))}</header>
        <div class="cal-entries">
          ${cards.length ? cards.map(c => entryHtml(c, true)).join('')
            : `<p class="cal-none">${esc(t('cal.no_entries'))}</p>`}
        </div>
      </section>`;
    }).join('')}
  </div>`;
}

function dayGrid(a, today) {
  const cards = entriesForDate(a);
  return `<div class="cal-single">
    <section class="cal-col${a === today ? ' today' : ''}" data-date="${a}">
      <div class="cal-entries">
        ${cards.length ? cards.map(c => entryHtml(c, true)).join('')
          : `<p class="cal-none">${esc(t('cal.no_entries'))}</p>`}
      </div>
      <button class="add-card cal-add">${esc(t('board.add_card'))}</button>
    </section>
  </div>`;
}

// ---------- render ----------

function render() {
  if (!root) return;
  const a = anchor();
  const today = todayStr();
  const m = mode();

  root.innerHTML = `
    <div class="cal">
      <div class="cal-bar">
        <button class="icon-btn cal-prev" aria-label="${esc(t('cal.prev'))}">‹</button>
        <h2>${esc(title())}</h2>
        <button class="icon-btn cal-next" aria-label="${esc(t('cal.next'))}">›</button>
        <button class="btn cal-today">${esc(t('cal.today'))}</button>
        <div class="segmented cal-mode">
          ${MODES.map(x => `<button type="button" data-v="${x}" class="${m === x ? 'on' : ''}">${esc(t('cal.mode.' + x))}</button>`).join('')}
        </div>
        ${store.view.calAllTypes ? '' : `<span class="cal-note">${esc(t('cal.only_dates'))}</span>`}
      </div>
      ${m === 'month' ? monthGrid(a, today) : m === 'week' ? weekGrid(a, today) : dayGrid(a, today)}
    </div>`;

  root.querySelector('.cal-prev').addEventListener('click', () => shift(-1));
  root.querySelector('.cal-next').addEventListener('click', () => shift(1));
  root.querySelector('.cal-today').addEventListener('click', () => store.setView({ calAnchor: today }));
  root.querySelectorAll('.cal-mode button').forEach(b => {
    b.addEventListener('click', () => store.setView({ calMode: b.dataset.v }));
  });

  root.querySelectorAll('.cal-entry').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); openCard(b.dataset.id, b.dataset.date); });
  });
  root.querySelectorAll('.cal-day, .cal-col').forEach(d => {
    d.addEventListener('dblclick', () => createCard({ date: d.dataset.date, type: 'date' }));
  });
  root.querySelector('.cal-add')?.addEventListener('click', () => createCard({ date: a, type: 'date' }));
}

export const calendar = {
  init(el) {
    root = el;
    store.on('change', () => { if (!root.hidden) render(); });
    window.addEventListener('kb:lang', () => { if (!root.hidden) render(); });
  },
  activate() { render(); },
};
