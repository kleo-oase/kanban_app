// board.js — the list (kanban) view: seven built-in weekday columns plus the
// custom lists for cards without a date, a "＋ New list" column at the right
// end, drag-to-reorder columns and drag-to-move cards.
//
// Cards inside a column are always sorted automatically (see js/query.js) —
// they cannot be reordered by hand, by design.

import { store } from './store.js';
import { cardsForList, listOf } from './query.js';
import { openCard, createCard } from './card.js';
import { openMenu, confirmDialog, draggable, toast, closeMenu } from './ui.js';
import { t, weekdayName, fmtDate } from './i18n.js';
import {
  WEEKDAY_IDS, esc, todayStr, weekdayId, weekdayIndex, addDays, weekdaysOf,
  effectiveDate, isOverdue,
} from './util.js';

let root = null;
let dragging = false;
let dragEndedAt = 0;   // a pointerup that ended a drag must not open the card

// ---------- card chip ----------

export function cardChipHtml(card) {
  const cls = [
    'kcard', 't-' + card.type,
    card.urgency ? 'u-' + card.urgency : '',
    card.type === 'todo' && card.done ? 'done' : '',
  ].filter(Boolean).join(' ');

  const d = effectiveDate(card);
  const meta = [];
  if (d) {
    meta.push(`<span class="chip chip-date${isOverdue(d) && !card.done ? ' overdue' : ''}">${
      esc(fmtDate(d))}${card.time ? ' · ' + esc(card.time) : ''}${card.repeat ? ' ↻' : ''}</span>`);
  }
  meta.push(`<span class="chip chip-type">${esc(t('type.' + card.type))}</span>`);
  if (card.urgency) {
    meta.push(`<span class="chip chip-urg u-${card.urgency}">${esc(t('urgency.short.' + card.urgency))}</span>`);
  }
  if (card.client) {
    meta.push(`<span class="chip chip-client" style="--c:${esc(store.clientColor(card.client))}">${esc(card.client)}</span>`);
  }

  return `<article class="${cls}" data-id="${esc(card.id)}" tabindex="0"
            style="--c:${esc(card.client ? store.clientColor(card.client) : 'transparent')}">
    <div class="kcard-title">${card.type === 'todo' ? `<span class="tick">${card.done ? '☑' : '☐'}</span>` : ''}${esc(card.title || '—')}</div>
    <div class="kcard-meta">${meta.join('')}</div>
  </article>`;
}

// ---------- rendering ----------

function columnHtml(list) {
  const isWeekday = WEEKDAY_IDS.includes(list.id);
  const cards = cardsForList(list.id);
  const isToday = isWeekday && list.id === weekdayId(todayStr());
  return `
  <section class="col${isWeekday ? ' col-weekday' : ' col-custom'}${isToday ? ' col-today' : ''}" data-id="${esc(list.id)}">
    <header class="col-head">
      <h2>${esc(isWeekday ? weekdayName(list.id) : list.name)}</h2>
      <span class="count">${cards.length}</span>
      ${isWeekday ? '' : '<button class="icon-btn col-menu" aria-label="⋯">⋯</button>'}
    </header>
    <div class="col-cards">
      ${cards.length ? cards.map(cardChipHtml).join('') : `<p class="col-empty">${esc(t('board.empty'))}</p>`}
    </div>
    <button class="add-card">${esc(t('board.add_card'))}</button>
  </section>`;
}

function render() {
  if (!root || dragging) return;
  const scroll = root.querySelector('.board')?.scrollLeft || 0;
  root.innerHTML = `
    <div class="board">
      ${store.config.lists.map(columnHtml).join('')}
      <section class="col col-new">
        <form class="new-list">
          <input type="text" maxlength="60" placeholder="${esc(t('board.new_list_ph'))}" autocomplete="off">
          <button type="submit" class="btn">${esc(t('board.new_list'))}</button>
        </form>
        <p class="hint">${esc(t('board.drag_hint'))}</p>
      </section>
    </div>`;
  const boardEl = root.querySelector('.board');
  boardEl.scrollLeft = scroll;
  wire(boardEl);
}

// ---------- interactions ----------

function wire(boardEl) {
  boardEl.querySelectorAll('.kcard').forEach(el => {
    el.addEventListener('click', () => {
      if (dragging || Date.now() - dragEndedAt < 250) return;
      openCard(el.dataset.id);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(el.dataset.id); }
    });
    const card = store.cards[el.dataset.id];
    if (card && weekdaysOf(card).length <= 1) wireCardDrag(el, boardEl);
  });

  boardEl.querySelectorAll('.add-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.col').dataset.id;
      createCard(prefillFor(id));
    });
  });

  boardEl.querySelectorAll('.col-menu').forEach(btn => {
    btn.dataset.menuId = 'col-' + btn.closest('.col').dataset.id;
    btn.addEventListener('click', () => openColMenu(btn));
  });

  boardEl.querySelectorAll('.col-weekday .col-head, .col-custom .col-head')
    .forEach(head => wireColumnDrag(head, boardEl));

  const form = boardEl.querySelector('.new-list');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector('input');
    const name = input.value.trim();
    if (!name) return;
    store.addList(name);
    input.value = '';
  });
}

// A new card started from a column inherits that column's meaning: a weekday
// column gives it that weekday's date in the current week (next week if that
// day is already past), a custom list gives it that list and no date.
function prefillFor(listId) {
  if (!WEEKDAY_IDS.includes(listId)) return { list: listId, date: null };
  const today = todayStr();
  const target = addDays(today, WEEKDAY_IDS.indexOf(listId) - weekdayIndex(today));
  return { date: target < today ? addDays(target, 7) : target };
}

function openColMenu(btn) {
  const col = btn.closest('.col');
  const id = col.dataset.id;
  openMenu(btn, close => {
    const el = document.createElement('div');
    el.innerHTML = `
      <button class="menu-item m-rename">${esc(t('board.rename_list'))}</button>
      <button class="menu-item danger m-delete">${esc(t('board.delete_list'))}</button>`;
    el.querySelector('.m-rename').addEventListener('click', () => {
      close();
      startRename(col, id);
    });
    el.querySelector('.m-delete').addEventListener('click', async () => {
      close();
      if (store.customLists().length <= 1) { toast(t('board.delete_list_last'), 'err'); return; }
      const n = Object.values(store.cards).filter(c => !c.date && listOf(c) === id).length;
      const ok = await confirmDialog(t('board.delete_list_confirm', { name: store.listName(id), n }));
      if (ok) store.deleteList(id);
    });
    return el;
  }, { align: 'right' });
}

function startRename(col, id) {
  const h2 = col.querySelector('.col-head h2');
  const input = document.createElement('input');
  input.className = 'rename-input';
  input.value = store.listName(id);
  input.maxLength = 60;
  h2.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    const v = input.value.trim();
    if (v) store.renameList(id, v);
    else render();
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') render();
  });
  input.addEventListener('blur', commit);
}

// ---------- drag: reorder columns ----------

function wireColumnDrag(head, boardEl) {
  const col = head.closest('.col');
  draggable(head, {
    onStart() {
      dragging = true;
      closeMenu();
      col.classList.add('col-dragging');
    },
    onMove(ev) {
      const cols = [...boardEl.querySelectorAll('.col:not(.col-new)')];
      for (const other of cols) {
        if (other === col) continue;
        const r = other.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right) continue;
        const before = ev.clientX < r.left + r.width / 2;
        boardEl.insertBefore(col, before ? other : other.nextSibling);
        break;
      }
      // never past the "＋ New list" column
      const last = boardEl.querySelector('.col-new');
      if (last && col.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_PRECEDING) {
        boardEl.insertBefore(col, last);
      }
    },
    onEnd() {
      col.classList.remove('col-dragging');
      dragging = false;
      const order = [...boardEl.querySelectorAll('.col:not(.col-new)')].map(c => c.dataset.id);
      const byId = Object.fromEntries(store.config.lists.map(l => [l.id, l]));
      const next = order.map(id => byId[id]).filter(Boolean);
      if (next.length === store.config.lists.length) {
        store.config.lists = next;
        store.touch('lists');
      }
      render();
    },
  });
}

// ---------- drag: move a card to another column ----------

function wireCardDrag(el, boardEl) {
  let ghost = null;
  let target = null;
  draggable(el, {
    threshold: 8,
    onStart(ev) {
      dragging = true;
      const r = el.getBoundingClientRect();
      ghost = el.cloneNode(true);
      ghost.classList.add('kcard-ghost');
      ghost.style.width = r.width + 'px';
      document.body.appendChild(ghost);
      el.classList.add('kcard-source');
      moveGhost(ev);
    },
    onMove(ev) {
      moveGhost(ev);
      const el2 = document.elementFromPoint(ev.clientX, ev.clientY);
      const col = el2 && el2.closest ? el2.closest('.col:not(.col-new)') : null;
      if (col !== target) {
        target?.classList.remove('col-drop');
        target = col;
        target?.classList.add('col-drop');
      }
    },
    onEnd(ev, ok) {
      ghost?.remove();
      ghost = null;
      el.classList.remove('kcard-source');
      target?.classList.remove('col-drop');
      const to = target?.dataset.id;
      target = null;
      dragging = false;
      dragEndedAt = Date.now();
      if (ok && to) dropCard(el.dataset.id, to);
      render();
    },
  });

  function moveGhost(ev) {
    if (!ghost) return;
    ghost.style.left = (ev.clientX - 40) + 'px';
    ghost.style.top = (ev.clientY - 18) + 'px';
  }
}

function dropCard(cardId, listId) {
  const card = store.cards[cardId];
  if (!card) return;
  const from = card.date ? weekdayId(card.date) : listOf(card);
  if (from === listId) return;

  if (WEEKDAY_IDS.includes(listId)) {
    const wanted = WEEKDAY_IDS.indexOf(listId);
    let date;
    if (card.date) {
      // keep the card in its own week — only shift the weekday
      date = addDays(card.date, wanted - weekdayIndex(card.date));
    } else {
      const today = todayStr();
      date = addDays(today, wanted - weekdayIndex(today));
      if (date < today) date = addDays(date, 7);
    }
    store.updateCard(cardId, { date, list: null });
    toast(t('board.moved_to_day', { day: weekdayName(listId), date: fmtDate(date, true) }), 'info', 3000);
  } else {
    store.updateCard(cardId, { date: null, time: null, repeat: null, until: null, list: listId });
    toast(t('board.moved_to_list', { name: store.listName(listId) }), 'info', 3000);
  }
}

// ---------- view API ----------

export const board = {
  init(el) {
    root = el;
    store.on('change', () => { if (!root.hidden) render(); });
    window.addEventListener('kb:lang', () => { if (!root.hidden) render(); });
  },
  activate() { render(); },
};

