// card.js — the card editor: every property of a card, its comments, and the
// delete action. Opened from both views.

import { store } from './store.js';
import { openModal, confirmDialog, toast } from './ui.js';
import { askWho } from './who.js';
import { t, fmtStamp, fmtDateLong } from './i18n.js';
import {
  TYPES, URGENCIES, REPEATS, esc, renderMarkdown, todayStr, isDateStr, nextOccurrence,
} from './util.js';

const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;

function formHtml(card, isNew) {
  const custom = store.customLists();
  const info = card.type === 'info';
  const noDate = info || !card.date;
  return `
  <form class="card-form" novalidate>
    <label class="field">
      <span>${esc(t('card.title'))}</span>
      <input class="f-title" type="text" maxlength="200" autocomplete="off"
             placeholder="${esc(t('card.title_ph'))}" value="${esc(card.title || '')}">
    </label>

    <div class="field">
      <span>${esc(t('type.label'))}</span>
      <div class="segmented f-type">
        ${TYPES.map(x => `<button type="button" data-v="${x}" class="${card.type === x ? 'on' : ''}">${esc(t('type.' + x))}</button>`).join('')}
      </div>
    </div>

    <p class="hint info-hint"${info ? '' : ' hidden'}>${esc(t('card.info_hint'))}</p>

    <div class="field date-block"${info ? ' hidden' : ''}>
      <span>${esc(t('card.date'))}</span>
      <div class="row">
        <input class="f-date" type="date" value="${esc(card.date || '')}"${noDate ? ' disabled' : ''}>
        <input class="f-time" type="time" value="${esc(card.time || '')}"${noDate ? ' disabled' : ''}
               title="${esc(t('card.time'))}">
        <label class="check inline">
          <input class="f-nodate" type="checkbox"${noDate ? ' checked' : ''}>
          <span>${esc(t('card.nodate'))}</span>
        </label>
      </div>
    </div>

    <label class="field f-list-wrap"${noDate ? '' : ' hidden'}>
      <span>${esc(t('card.list'))}</span>
      <select class="f-list"${custom.length ? '' : ' disabled'}>
        ${custom.map(l => opt(l.id, l.name, card.list === l.id)).join('')}
      </select>
      ${custom.length ? '' : `<small class="hint warn">${esc(t('card.no_lists'))}</small>`}
    </label>

    <div class="field f-repeat-wrap"${noDate ? ' hidden' : ''}>
      <span>${esc(t('repeat.label'))}</span>
      <div class="row">
        <select class="f-repeat">
          ${opt('', t('repeat.none'), !card.repeat)}
          ${REPEATS.map(r => opt(r, t('repeat.' + r), card.repeat === r)).join('')}
        </select>
        <label class="until-wrap${card.repeat ? '' : ' hidden'}">
          <small>${esc(t('repeat.until'))}</small>
          <input class="f-until" type="date" value="${esc(card.until || '')}">
        </label>
      </div>
      <small class="hint f-next"></small>
    </div>

    <label class="check f-pin-wrap"${info ? '' : ' hidden'}>
      <input class="f-pin" type="checkbox"${card.pinned ? ' checked' : ''}>
      <span>${esc(t('card.pin'))}</span>
    </label>
    <small class="hint f-pin-hint"${info ? '' : ' hidden'}>${esc(t('card.pin_hint'))}</small>

    <div class="two-col${info ? ' one-col' : ''}">
      <label class="field f-urgency-wrap"${info ? ' hidden' : ''}>
        <span>${esc(t('urgency.label'))}</span>
        <select class="f-urgency">
          ${opt('', t('urgency.none'), !card.urgency)}
          ${URGENCIES.map(u => opt(u, t('urgency.' + u), card.urgency === u)).join('')}
        </select>
      </label>
      <label class="field">
        <span>${esc(t('client.label'))}</span>
        <select class="f-client">
          ${opt('', t('client.none'), !card.client)}
          ${store.config.clients.map(c => opt(c.name, c.name, card.client === c.name)).join('')}
          ${card.client && !store.config.clients.some(c => c.name === card.client)
            ? opt(card.client, card.client + ' (?)', true) : ''}
        </select>
      </label>
    </div>

    <label class="field">
      <span>${esc(t('card.body'))}</span>
      <textarea class="f-body" rows="5" placeholder="${esc(t('card.body_ph'))}">${esc(card.body || '')}</textarea>
    </label>

    <label class="check f-done-wrap${card.type === 'todo' ? '' : ' hidden'}">
      <input class="f-done" type="checkbox"${card.done ? ' checked' : ''}>
      <span>${esc(t('card.done'))}</span>
    </label>

    <p class="card-meta">
      ${card.author ? `${esc(t('card.author'))}: <b>${esc(card.author)}</b>` : ''}
      ${card.created ? ` · ${esc(t('card.created'))}: ${esc(fmtStamp(card.created))}` : ''}
      ${card.archived ? ` · ${esc(t('card.archived_on', { date: fmtStamp(card.archived) }))}` : ''}
    </p>
    <p class="form-error" hidden></p>
  </form>`;
}

function commentsHtml(cardId) {
  const list = store.commentsOf(cardId);
  return `
    <section class="comments">
      <h3>${esc(t('comments.title'))} ${list.length ? `<span class="count">${list.length}</span>` : ''}</h3>
      <div class="comment-list">
        ${list.length ? list.map(c => `
          <article class="comment" data-id="${esc(c.id)}">
            <header><b>${esc(c.author || '—')}</b><time>${esc(fmtStamp(c.created))}</time>
              <button class="icon-btn c-del" title="${esc(t('card.delete'))}">✕</button>
            </header>
            <div class="comment-body">${renderMarkdown(c.text)}</div>
          </article>`).join('')
          : `<p class="muted">${esc(t('comments.none'))}</p>`}
      </div>
      <div class="comment-new">
        <textarea class="c-text" rows="2" placeholder="${esc(t('comments.placeholder'))}"></textarea>
        <button class="btn c-add">${esc(t('comments.add'))}</button>
      </div>
    </section>`;
}

// ---------- the editor ----------

function openEditor(card, { isNew = false } = {}) {
  const draft = { ...card };
  const m = openModal({
    title: isNew ? t('card.new') : t('card.edit'),
    size: 'wide',
    body: formHtml(draft, isNew) + (isNew ? '' : commentsHtml(draft.id)),
    footer: `
      ${isNew ? '' : `<button class="btn danger f-delete">${esc(t('card.delete'))}</button>`}
      ${isNew ? '' : (draft.archived
        ? `<button class="btn f-unarchive">${esc(t('archive.restore'))}</button>`
        : `<button class="btn f-archive">${esc(t('card.archive'))}</button>`)}
      <span class="spacer"></span>
      <button class="btn f-cancel">${esc(t('card.cancel'))}</button>
      <button class="btn primary f-save">${esc(isNew ? t('card.add') : t('card.save'))}</button>`,
    closeOnScrim: false,
  });

  const $ = s => m.body.querySelector(s);
  const err = $('.form-error');
  const showErr = msg => {
    err.textContent = msg;
    err.hidden = !msg;
  };

  // --- type segmented control ---
  // Info cards are notes: no date, no repetition, no urgency — but they can be
  // pinned to the top of their list instead.
  const syncType = () => {
    const info = draft.type === 'info';
    $('.info-hint').hidden = !info;
    $('.date-block').hidden = info;
    $('.f-pin-wrap').hidden = !info;
    $('.f-pin-hint').hidden = !info;
    $('.f-urgency-wrap').hidden = info;
    $('.two-col').classList.toggle('one-col', info);
    $('.f-done-wrap').classList.toggle('hidden', draft.type !== 'todo');
    if (draft.type !== 'todo') $('.f-done').checked = false;
    if (!info) $('.f-pin').checked = false;
    if (info) { $('.f-nodate').checked = true; $('.f-urgency').value = ''; }
    syncDate();
  };
  m.body.querySelectorAll('.f-type button').forEach(b => {
    b.addEventListener('click', () => {
      draft.type = b.dataset.v;
      m.body.querySelectorAll('.f-type button').forEach(x => x.classList.toggle('on', x === b));
      syncType();
    });
  });

  // --- date / no-date ---
  const syncDate = () => {
    const noDate = $('.f-nodate').checked;
    $('.f-date').disabled = noDate;
    $('.f-time').disabled = noDate;
    $('.f-list-wrap').hidden = !noDate;
    $('.f-repeat-wrap').hidden = noDate;
    if (noDate) { $('.f-date').value = ''; $('.f-time').value = ''; }
    else if (!$('.f-date').value) $('.f-date').value = todayStr();
    syncNext();
  };
  const syncNext = () => {
    const rep = $('.f-repeat').value;
    m.body.querySelector('.until-wrap').classList.toggle('hidden', !rep);
    const d = $('.f-date').value;
    const hint = $('.f-next');
    if (rep && isDateStr(d)) {
      const n = nextOccurrence({ date: d, repeat: rep, until: $('.f-until').value || null });
      hint.textContent = n ? t('card.occurs_next', { date: fmtDateLong(n) }) : '—';
    } else hint.textContent = '';
  };
  $('.f-nodate').addEventListener('change', syncDate);
  $('.f-repeat').addEventListener('change', syncNext);
  $('.f-date').addEventListener('change', syncNext);
  $('.f-until').addEventListener('change', syncNext);
  syncNext();

  // --- comments ---
  const wireComments = () => {
    m.body.querySelector('.c-add')?.addEventListener('click', async () => {
      const box = m.body.querySelector('.c-text');
      const text = box.value.trim();
      if (!text) return;
      const who = await askWho('comment');
      if (!who) return;
      store.addComment(draft.id, text, who);
      const host = m.body.querySelector('.comments');
      host.outerHTML = commentsHtml(draft.id);
      wireComments();
    });
    m.body.querySelectorAll('.comment .c-del').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.closest('.comment').dataset.id;
        if (!await confirmDialog(t('comments.delete_confirm'))) return;
        store.deleteComment(draft.id, id);
        const host = m.body.querySelector('.comments');
        host.outerHTML = commentsHtml(draft.id);
        wireComments();
      });
    });
  };
  if (!isNew) wireComments();

  // --- collect + validate ---
  const collect = () => {
    const info = draft.type === 'info';
    const noDate = info || $('.f-nodate').checked;
    const out = {
      title: $('.f-title').value.trim(),
      type: draft.type,
      pinned: info && $('.f-pin').checked,
      date: noDate ? null : ($('.f-date').value || null),
      time: noDate ? null : ($('.f-time').value || null),
      list: noDate ? ($('.f-list').value || null) : null,
      repeat: noDate ? null : ($('.f-repeat').value || null),
      until: noDate ? null : ($('.f-until').value || null),
      urgency: info ? null : ($('.f-urgency').value || null),
      client: $('.f-client').value || null,
      body: $('.f-body').value,
      done: draft.type === 'todo' && $('.f-done').checked,
    };
    if (!out.repeat) out.until = null;
    if (!out.title) return { error: t('card.title_required') };
    if (!noDate && !isDateStr(out.date)) return { error: t('card.date_required') };
    if (noDate && !out.list) return { error: t('card.list_required') };
    return { value: out };
  };

  m.foot.querySelector('.f-cancel').addEventListener('click', () => m.close());
  m.foot.querySelector('.f-save').addEventListener('click', () => {
    const r = collect();
    if (r.error) { showErr(r.error); return; }
    if (isNew) {
      store.newCard({ ...r.value, created: draft.created, author: draft.author });
      toast(t('toast.card_added'), 'ok', 2000);
    } else {
      store.updateCard(draft.id, r.value);
    }
    m.close();
  });
  m.foot.querySelector('.f-archive')?.addEventListener('click', () => {
    const r = collect();
    if (!r.error) store.updateCard(draft.id, r.value);   // keep edits made in this session
    store.archiveCard(draft.id);
    toast(t('toast.card_archived', { title: draft.title || '—' }), 'ok');
    m.close();
  });
  m.foot.querySelector('.f-unarchive')?.addEventListener('click', () => {
    store.unarchiveCard(draft.id);
    toast(t('toast.card_restored', { title: draft.title || '—' }), 'ok');
    m.close();
  });
  m.foot.querySelector('.f-delete')?.addEventListener('click', async () => {
    if (!await confirmDialog(t('card.delete_confirm', { title: draft.title || '—' }))) return;
    store.deleteCard(draft.id);
    toast(t('toast.card_deleted'), 'ok', 2000);
    m.close();
  });

  m.body.querySelector('.card-form').addEventListener('submit', e => e.preventDefault());
  m.body.querySelector('.f-title').addEventListener('input', () => showErr(''));
  return m;
}

export function openCard(id) {
  const card = store.cards[id];
  if (!card) return;
  openEditor(card);
}

// New card: the "who are you?" popup comes first, then the editor with the
// author already filled in.
export async function createCard(prefill = {}) {
  const who = await askWho('card');
  if (!who) return;
  const base = {
    title: '', type: 'todo', date: null, time: null, list: null,
    urgency: null, client: null, repeat: null, until: null, done: false,
    created: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    author: who, body: '', ...prefill,
  };
  openEditor(base, { isNew: true });
}

