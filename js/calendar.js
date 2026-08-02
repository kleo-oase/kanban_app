// calendar.js — month grid: seven weekday columns, one row per calendar week,
// ISO week numbers in the gutter. Repeating cards appear on every occurrence.

import { store } from './store.js';
import { cardsForDate } from './query.js';
import { openCard, createCard } from './card.js';
import { t, weekdayShort, fmtMonthYear } from './i18n.js';
import {
  WEEKDAY_IDS, esc, todayStr, addDays, startOfWeek, isoWeek, addMonths,
} from './util.js';

let root = null;

const monthAnchor = () => store.view.calMonth || (todayStr().slice(0, 8) + '01');

function weeksOf(anchor) {
  const [y, m] = anchor.split('-').map(Number);
  const first = anchor;
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

function entryHtml(card, ds) {
  const color = card.client ? store.clientColor(card.client) : '';
  const done = card.type === 'todo' && card.done;
  return `<button class="cal-entry t-${card.type}${done ? ' done' : ''}${card.urgency ? ' u-' + card.urgency : ''}"
      data-id="${esc(card.id)}" title="${esc(card.title || '')}${card.client ? ' — ' + esc(card.client) : ''}">
    <span class="dot" style="background:${esc(color || 'transparent')};${color ? '' : 'border-color:currentColor'}"></span>
    ${card.time ? `<time>${esc(card.time)}</time>` : ''}
    <span class="cal-title">${esc(card.title || '—')}</span>
  </button>`;
}

function render() {
  if (!root) return;
  const anchor = monthAnchor();
  const today = todayStr();
  const month = anchor.slice(0, 7);
  const weeks = weeksOf(anchor);

  root.innerHTML = `
    <div class="cal">
      <div class="cal-bar">
        <button class="icon-btn cal-prev" aria-label="${esc(t('cal.prev'))}">‹</button>
        <h2>${esc(fmtMonthYear(anchor))}</h2>
        <button class="icon-btn cal-next" aria-label="${esc(t('cal.next'))}">›</button>
        <button class="btn cal-today">${esc(t('cal.today'))}</button>
        ${store.view.calAllTypes ? '' : `<span class="cal-note">${esc(t('cal.only_dates'))}</span>`}
      </div>
      <div class="cal-grid">
        <div class="cal-head cal-gutter">${esc(t('cal.week_short'))}</div>
        ${WEEKDAY_IDS.map(id => `<div class="cal-head">${esc(weekdayShort(id))}</div>`).join('')}
        ${weeks.map(week => `
          <div class="cal-wk">${isoWeek(week[0])}</div>
          ${week.map(ds => {
            const cards = cardsForDate(ds);
            const out = ds.slice(0, 7) !== month;
            return `<div class="cal-day${out ? ' out' : ''}${ds === today ? ' today' : ''}" data-date="${ds}">
              <div class="cal-daynum">${Number(ds.slice(8, 10))}</div>
              <div class="cal-entries">${cards.map(c => entryHtml(c, ds)).join('')}</div>
            </div>`;
          }).join('')}`).join('')}
      </div>
    </div>`;

  root.querySelector('.cal-prev').addEventListener('click', () => {
    store.setView({ calMonth: addMonths(anchor, -1).slice(0, 8) + '01' });
  });
  root.querySelector('.cal-next').addEventListener('click', () => {
    store.setView({ calMonth: addMonths(anchor, 1).slice(0, 8) + '01' });
  });
  root.querySelector('.cal-today').addEventListener('click', () => {
    store.setView({ calMonth: today.slice(0, 8) + '01' });
  });

  root.querySelectorAll('.cal-entry').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); openCard(b.dataset.id); });
  });
  root.querySelectorAll('.cal-day').forEach(d => {
    d.addEventListener('dblclick', () => createCard({ date: d.dataset.date, type: 'date' }));
  });
}

export const calendar = {
  init(el) {
    root = el;
    store.on('change', () => { if (!root.hidden) render(); });
    window.addEventListener('kb:lang', () => { if (!root.hidden) render(); });
  },
  activate() { render(); },
};
