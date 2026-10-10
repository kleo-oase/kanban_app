// archive.js — the third page. Cards moved out of the way live here, grouped by
// the month they were due (newest first, undated last) so that nothing has to be
// re-created by hand: every card can be reactivated exactly as it was.
//
// Archiving never deletes anything. Emptying the archive is the one destructive
// action in the app, and it asks first.

import { store } from './store.js';
import { archiveGroups } from './query.js';
import { openCard } from './card.js';
import { confirmDialog, toast } from './ui.js';
import { t, fmtDate, fmtMonthYear, fmtStamp } from './i18n.js';
import { esc, effectiveDate, timeRange } from './util.js';

let root = null;

function rowHtml(card) {
  const d = effectiveDate(card) || card.date;
  const meta = [];
  if (d) meta.push(`<span class="chip chip-date">${esc(fmtDate(d, true))}${card.time ? ' · ' + esc(timeRange(card)) : ''}${card.repeat ? ' ↻' : ''}</span>`);
  meta.push(`<span class="chip chip-type">${esc(t('type.' + card.type))}</span>`);
  if (card.urgency) meta.push(`<span class="chip chip-urg u-${card.urgency}">${esc(t('urgency.short.' + card.urgency))}</span>`);
  if (card.client) {
    meta.push(`<span class="chip chip-client" style="--c:${esc(store.clientColor(card.client))}">${esc(card.client)}</span>`);
  }
  if (card.author) meta.push(`<span class="chip">${esc(card.author)}</span>`);

  return `<li class="arc-row${card.done ? ' done' : ''}" data-id="${esc(card.id)}">
    <div class="arc-main">
      <div class="arc-title">${esc(card.title || '—')}</div>
      <div class="kcard-meta">${meta.join('')}</div>
      <div class="arc-when">${esc(t('card.archived_on', { date: fmtStamp(card.archived) }))}</div>
    </div>
    <div class="arc-actions">
      <button class="btn small a-restore">${esc(t('archive.restore'))}</button>
      <button class="btn small danger a-delete">${esc(t('archive.delete'))}</button>
    </div>
  </li>`;
}

function render() {
  if (!root) return;
  const groups = archiveGroups();
  const total = store.archivedCards().length;

  root.innerHTML = `
    <div class="archive">
      <header class="arc-head">
        <div>
          <h2>${esc(t('archive.title'))} ${total ? `<span class="count">${total}</span>` : ''}</h2>
          <p class="hint">${esc(t('archive.lead'))}</p>
        </div>
        ${total ? `<button class="btn danger a-clear">${esc(t('archive.clear'))}</button>` : ''}
      </header>
      ${groups.length ? groups.map(g => `
        <section class="arc-group">
          <h3>${esc(g.key ? fmtMonthYear(g.key + '-01') : t('archive.nodate'))}
            <span class="count">${g.cards.length}</span></h3>
          <ul>${g.cards.map(rowHtml).join('')}</ul>
        </section>`).join('')
        : `<p class="arc-empty">${esc(t('archive.empty'))}</p>`}
    </div>`;

  root.querySelectorAll('.arc-row').forEach(li => {
    const id = li.dataset.id;
    li.querySelector('.arc-main').addEventListener('click', () => openCard(id));
    li.querySelector('.a-restore').addEventListener('click', () => {
      const title = store.cards[id]?.title || '—';
      store.unarchiveCard(id);
      toast(t('toast.card_restored', { title }), 'ok');
    });
    li.querySelector('.a-delete').addEventListener('click', async () => {
      const title = store.cards[id]?.title || '—';
      if (!await confirmDialog(t('archive.delete_confirm', { title }))) return;
      store.deleteCard(id);
      toast(t('toast.card_deleted'), 'ok');
    });
  });

  root.querySelector('.a-clear')?.addEventListener('click', async () => {
    if (!await confirmDialog(t('archive.clear_confirm', { n: total }), { okLabel: t('archive.clear') })) return;
    const n = store.emptyArchive();
    toast(t('toast.archive_cleared', { n }), 'ok');
  });
}

export const archive = {
  init(el) {
    root = el;
    store.on('change', () => { if (!root.hidden) render(); });
    window.addEventListener('kb:lang', () => { if (!root.hidden) render(); });
  },
  activate() { render(); },
};
