// toolbar.js — the Filter, Sort and Search controls in the top bar.
// All three write into store.view, which js/query.js reads; the views re-render
// on the resulting change event.

import { store, DEFAULT_VIEW } from './store.js';
import { counts, filterIsActive } from './query.js';
import { openMenu, checkboxRow, radioRow } from './ui.js';
import { t } from './i18n.js';
import { TYPES, URGENCIES, esc, debounce } from './util.js';

const RANGES = ['all', 'today', 'week', 'next7', 'month', 'overdue', 'nodate'];
const SORTS = [
  ['date', 'sort.date'], ['urgency', 'sort.urgency'], ['type', 'sort.type'],
  ['client', 'sort.client'], ['title', 'sort.title_field'], ['created', 'sort.created'],
];

// ---------- filter ----------

function filterMenu(anchor) {
  openMenu(anchor, () => {
    const v = store.view;
    const clients = store.config.clients.map(c => c.name);
    const authors = [...new Set(Object.values(store.cards).map(c => c.author).filter(Boolean))].sort();

    const el = document.createElement('div');
    el.className = 'filter-menu';
    el.innerHTML = `
      <div class="menu-group">
        <h4>${esc(t('filter.type'))}</h4>
        <div data-group="types">${TYPES.map(x => checkboxRow(x, t('type.' + x), v.types.includes(x))).join('')}</div>
      </div>
      <div class="menu-group">
        <h4>${esc(t('filter.urgency'))}</h4>
        <div data-group="urgencies">
          ${URGENCIES.map(x => checkboxRow(x, t('urgency.' + x), v.urgencies.includes(x))).join('')}
          ${checkboxRow('', t('urgency.none'), v.urgencies.includes(''))}
        </div>
      </div>
      ${clients.length ? `<div class="menu-group">
        <h4>${esc(t('filter.client'))}</h4>
        <div data-group="clients">
          ${clients.map(x => checkboxRow(x, x, v.clients.includes(x))).join('')}
          ${checkboxRow('', t('client.none'), v.clients.includes(''))}
        </div>
      </div>` : ''}
      ${authors.length ? `<div class="menu-group">
        <h4>${esc(t('filter.author'))}</h4>
        <div data-group="authors">${authors.map(x => checkboxRow(x, x, v.authors.includes(x))).join('')}</div>
      </div>` : ''}
      <div class="menu-group">
        <h4>${esc(t('filter.range'))}</h4>
        <div data-group="range">${RANGES.map(r => radioRow('kb-range', r, t('filter.range.' + r), v.range === r)).join('')}</div>
      </div>
      <div class="menu-group">
        ${checkboxRow('hideDone', t('filter.hide_done'), v.hideDone, 'wide')}
        ${checkboxRow('calAllTypes', t('filter.cal_all_types'), v.calAllTypes, 'wide')}
      </div>
      <button class="btn f-reset">${esc(t('filter.reset'))}</button>`;

    for (const group of ['types', 'urgencies', 'clients', 'authors']) {
      el.querySelector(`[data-group="${group}"]`)?.addEventListener('change', e => {
        const boxes = [...el.querySelectorAll(`[data-group="${group}"] input`)];
        store.setView({ [group]: boxes.filter(b => b.checked).map(b => b.value) });
      });
    }
    el.querySelector('[data-group="range"]').addEventListener('change', e => {
      store.setView({ range: e.target.value });
    });
    el.querySelectorAll('.menu-group .check.wide input').forEach(box => {
      box.addEventListener('change', () => store.setView({ [box.value]: box.checked }));
    });
    el.querySelector('.f-reset').addEventListener('click', () => {
      const { calMode, calAnchor, search, sort, sortDir } = store.view;
      store.setView({ ...DEFAULT_VIEW, calMode, calAnchor, search, sort, sortDir });
      el.querySelectorAll('input[type=checkbox]').forEach(b => { b.checked = false; });
      el.querySelector('[data-group="range"] input[value="all"]').checked = true;
    });
    return el;
  }, { className: 'wide-menu' });
}

// ---------- sort ----------

function sortMenu(anchor) {
  openMenu(anchor, () => {
    const v = store.view;
    const el = document.createElement('div');
    el.className = 'sort-menu';
    el.innerHTML = `
      <div class="menu-group">
        <h4>${esc(t('sort.title'))}</h4>
        <div data-group="sort">${SORTS.map(([id, k]) => radioRow('kb-sort', id, t(k), v.sort === id)).join('')}</div>
      </div>
      <div class="menu-group">
        <div data-group="dir">
          ${radioRow('kb-dir', 'asc', t('sort.dir.asc'), v.sortDir !== 'desc')}
          ${radioRow('kb-dir', 'desc', t('sort.dir.desc'), v.sortDir === 'desc')}
        </div>
      </div>
      <p class="hint">${esc(t('sort.note'))}</p>`;
    el.querySelector('[data-group="sort"]').addEventListener('change', e => store.setView({ sort: e.target.value }));
    el.querySelector('[data-group="dir"]').addEventListener('change', e => store.setView({ sortDir: e.target.value }));
    return el;
  });
}

// ---------- search ----------

let searchRow = null;

function toggleSearch() {
  if (!searchRow) return;
  const show = searchRow.hidden;
  searchRow.hidden = !show;
  if (show) searchRow.querySelector('input').focus();
  else if (store.view.search) store.setView({ search: '' });
}

function renderSearchCount() {
  if (!searchRow || searchRow.hidden) return;
  const { shown, total } = counts();
  searchRow.querySelector('.search-count').textContent =
    store.view.search ? t('search.results', { n: shown, total }) : '';
}

// ---------- wiring ----------

export function initToolbar() {
  const filterBtn = document.getElementById('filter-btn');
  const sortBtn = document.getElementById('sort-btn');
  const searchBtn = document.getElementById('search-btn');
  searchRow = document.getElementById('search-row');

  filterBtn.dataset.menuId = 'filter';
  sortBtn.dataset.menuId = 'sort';
  filterBtn.addEventListener('click', () => filterMenu(filterBtn));
  sortBtn.addEventListener('click', () => sortMenu(sortBtn));
  searchBtn.addEventListener('click', toggleSearch);

  const input = searchRow.querySelector('input');
  const apply = debounce(() => store.setView({ search: input.value }, 'search'), 180);
  input.addEventListener('input', apply);
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { input.value = ''; toggleSearch(); } });
  searchRow.querySelector('.search-clear').addEventListener('click', () => {
    input.value = '';
    store.setView({ search: '' });
    input.focus();
  });

  const sync = () => {
    filterBtn.classList.toggle('active', filterIsActive());
    searchBtn.classList.toggle('active', !!store.view.search);
    renderSearchCount();
  };
  store.on('change', sync);
  sync();
}
