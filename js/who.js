// who.js — "Who are you?" picker.
//
// Every card and every comment records who made it, and this board is meant to
// be used from a shared machine: the picker therefore opens every single time
// and never preselects anyone.

import { store } from './store.js';
import { openModal } from './ui.js';
import { esc } from './util.js';
import { t } from './i18n.js';

// kind: 'card' | 'comment'. Resolves to an employee name, or null if cancelled.
export function askWho(kind = 'card') {
  return new Promise(resolve => {
    const employees = store.config.employees || [];
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };

    const body = employees.length
      ? `<p class="who-hint">${esc(t(kind === 'comment' ? 'who.hint_comment' : 'who.hint_card'))}</p>
         <div class="who-grid">
           ${employees.map(e => `<button class="who-btn" data-name="${esc(e)}">${esc(e)}</button>`).join('')}
         </div>`
      : `<p class="who-hint">${esc(t('who.empty'))}</p>
         <button class="btn primary who-settings">${esc(t('who.open_settings'))}</button>`;

    const m = openModal({
      title: t('who.title'),
      size: 'narrow',
      body,
      onClose: () => finish(null),
    });

    m.body.querySelectorAll('.who-btn').forEach(b => {
      b.addEventListener('click', () => { finish(b.dataset.name); m.close(); });
    });
    m.body.querySelector('.who-settings')?.addEventListener('click', () => {
      finish(null);
      m.close();
      window.dispatchEvent(new CustomEvent('kb:open-settings', { detail: { section: 'employees' } }));
    });
  });
}
