// settings.js — everything configurable: board name, employees, clients, lists,
// the connected data repositories, and the app language.
//
// Board name / employees / clients / lists live in the data repository's
// config.yml (everyone on the board sees them). Language and the repository
// connections are per browser.

import { store } from './store.js';
import { openModal, confirmDialog, toast } from './ui.js';
import { openAddProject, copyInvite } from './projects.js';
import { t, LANGS, lang, setLang, weekdayName } from './i18n.js';
import { APP_VERSION, CHANGELOG_URL } from './version.js';
import { WEEKDAY_IDS, FALLBACK_CLIENT_COLORS, esc } from './util.js';

let modal = null;

function bodyHtml() {
  const cfg = store.config;
  const custom = store.customLists();
  return `
  <div class="settings">
    <section class="set-block">
      <h3>${esc(t('settings.board'))}</h3>
      <label class="field"><span>${esc(t('settings.board_name'))}</span>
        <input class="s-name" type="text" maxlength="80" value="${esc(cfg.name || '')}"></label>
      <small class="hint">${esc(t('settings.board_name_hint'))}</small>
    </section>

    <section class="set-block">
      <h3>${esc(t('settings.employees'))}</h3>
      <small class="hint">${esc(t('settings.employees_hint'))}</small>
      <ul class="chip-list s-employees">
        ${cfg.employees.map(e => `<li data-name="${esc(e)}">
          <input class="e-name" type="text" value="${esc(e)}" maxlength="60">
          <button class="icon-btn e-del" aria-label="${esc(t('settings.remove'))}">✕</button>
        </li>`).join('')}
      </ul>
      <form class="add-row s-add-employee">
        <input type="text" maxlength="60" placeholder="${esc(t('settings.employee_ph'))}">
        <button class="btn" type="submit">${esc(t('settings.add'))}</button>
      </form>
    </section>

    <section class="set-block">
      <h3>${esc(t('settings.clients'))}</h3>
      <small class="hint">${esc(t('settings.clients_hint'))}</small>
      <ul class="chip-list s-clients">
        ${cfg.clients.map((c, i) => `<li data-name="${esc(c.name)}">
          <input class="c-color" type="color" value="${esc(c.color || FALLBACK_CLIENT_COLORS[i % FALLBACK_CLIENT_COLORS.length])}">
          <input class="c-name" type="text" value="${esc(c.name)}" maxlength="60">
          <button class="icon-btn c-del" aria-label="${esc(t('settings.remove'))}">✕</button>
        </li>`).join('')}
      </ul>
      <form class="add-row s-add-client">
        <input type="text" maxlength="60" placeholder="${esc(t('settings.client_ph'))}">
        <button class="btn" type="submit">${esc(t('settings.add'))}</button>
      </form>
    </section>

    <section class="set-block">
      <h3>${esc(t('settings.lists'))}</h3>
      <small class="hint">${esc(t('settings.lists_hint'))}</small>
      <ul class="chip-list s-lists">
        ${WEEKDAY_IDS.map(id => `<li class="fixed"><span>${esc(weekdayName(id))}</span></li>`).join('')}
        ${custom.map(l => `<li data-id="${esc(l.id)}">
          <input class="l-name" type="text" value="${esc(l.name)}" maxlength="60">
          <button class="icon-btn l-del" aria-label="${esc(t('settings.remove'))}"${custom.length <= 1 ? ' disabled' : ''}>✕</button>
        </li>`).join('')}
      </ul>
    </section>

    <section class="set-block">
      <h3>${esc(t('settings.data'))}</h3>
      <small class="hint">${esc(t('settings.data_hint'))}</small>
      <ul class="project-list">
        ${store.projects.map(p => `<li data-id="${esc(p.id)}"${store.active && p.id === store.active.id ? ' class="on"' : ''}>
          <div>
            <b>${esc(p.name || `${p.owner}/${p.repo}`)}</b>
            <small>${esc(p.owner)}/${esc(p.repo)}#${esc(p.branch || 'main')}${p.token ? '' : ' · no token'}</small>
          </div>
          <div class="row">
            ${store.active && p.id === store.active.id
              ? `<button class="btn small p-share">${esc(t('projects.share'))}</button>`
              : `<button class="btn small p-switch">${esc(t('projects.switch'))}</button>`}
            <button class="btn small danger p-forget">${esc(t('projects.forget'))}</button>
          </div>
        </li>`).join('')}
      </ul>
      <button class="btn s-add-project">${esc(t('projects.add'))}</button>
    </section>

    <section class="set-block">
      <h3>${esc(t('settings.language'))}</h3>
      <div class="segmented s-lang">
        ${LANGS.map(l => `<button type="button" data-v="${l}" class="${lang() === l ? 'on' : ''}">${l === 'de' ? 'Deutsch' : 'English'}</button>`).join('')}
      </div>
    </section>

    <section class="set-block">
      <h3>${esc(t('settings.about'))}</h3>
      <p class="muted">${esc(t('settings.version', { v: APP_VERSION }))} ·
        <a href="${CHANGELOG_URL}" target="_blank" rel="noopener">${esc(t('settings.changelog'))} ↗</a></p>
    </section>
  </div>`;
}

function wire(m) {
  const $ = s => m.body.querySelector(s);

  $('.s-name').addEventListener('change', e => store.setConfig({ name: e.target.value.trim() }, 'settings'));

  // --- employees ---
  m.body.querySelectorAll('.s-employees li').forEach(li => {
    const old = li.dataset.name;
    li.querySelector('.e-name').addEventListener('change', e => {
      const v = e.target.value.trim();
      if (!v || v === old) { e.target.value = old; return; }
      if (store.config.employees.includes(v)) { toast(t('settings.duplicate'), 'err'); e.target.value = old; return; }
      store.renameEmployee(old, v);
      rerender();
    });
    li.querySelector('.e-del').addEventListener('click', async () => {
      const n = Object.values(store.cards).filter(c => c.author === old).length;
      if (n && !await confirmDialog(t('settings.in_use', { name: old, n }), { okLabel: t('settings.remove') })) return;
      store.removeEmployee(old);
      rerender();
    });
  });
  $('.s-add-employee').addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const v = input.value.trim();
    if (!v) return;
    if (store.config.employees.includes(v)) { toast(t('settings.duplicate'), 'err'); return; }
    store.addEmployee(v);
    input.value = '';
    rerender();
  });

  // --- clients ---
  m.body.querySelectorAll('.s-clients li').forEach(li => {
    const old = li.dataset.name;
    li.querySelector('.c-name').addEventListener('change', e => {
      const v = e.target.value.trim();
      if (!v || v === old) { e.target.value = old; return; }
      if (store.config.clients.some(c => c.name === v)) { toast(t('settings.duplicate'), 'err'); e.target.value = old; return; }
      store.renameClient(old, v);
      rerender();
    });
    li.querySelector('.c-color').addEventListener('change', e => store.setClientColor(old, e.target.value));
    li.querySelector('.c-del').addEventListener('click', async () => {
      const n = Object.values(store.cards).filter(c => c.client === old).length;
      if (n && !await confirmDialog(t('settings.in_use', { name: old, n }), { okLabel: t('settings.remove') })) return;
      store.removeClient(old);
      rerender();
    });
  });
  $('.s-add-client').addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const v = input.value.trim();
    if (!v) return;
    if (store.config.clients.some(c => c.name === v)) { toast(t('settings.duplicate'), 'err'); return; }
    store.addClient(v);
    input.value = '';
    rerender();
  });

  // --- lists ---
  m.body.querySelectorAll('.s-lists li[data-id]').forEach(li => {
    const id = li.dataset.id;
    li.querySelector('.l-name').addEventListener('change', e => store.renameList(id, e.target.value));
    li.querySelector('.l-del').addEventListener('click', async () => {
      const n = Object.values(store.cards).filter(c => !c.date && c.list === id).length;
      const ok = await confirmDialog(t('board.delete_list_confirm', { name: store.listName(id), n }));
      if (ok) { store.deleteList(id); rerender(); }
    });
  });

  // --- boards ---
  m.body.querySelectorAll('.project-list li').forEach(li => {
    const p = store.projects.find(x => x.id === li.dataset.id);
    if (!p) return;
    li.querySelector('.p-switch')?.addEventListener('click', () => store.switchProject(p.id));
    li.querySelector('.p-share')?.addEventListener('click', () => copyInvite(p));
    li.querySelector('.p-forget').addEventListener('click', async () => {
      const ok = await confirmDialog(t('projects.forget_confirm', { name: p.name || `${p.owner}/${p.repo}` }));
      if (!ok) return;
      store.removeProject(p.id);
      location.reload();
    });
  });
  $('.s-add-project').addEventListener('click', () => openAddProject());

  // --- language ---
  m.body.querySelectorAll('.s-lang button').forEach(b => {
    b.addEventListener('click', () => { setLang(b.dataset.v); rerender(); });
  });
}

function rerender() {
  if (!modal) return;
  const scroll = modal.body.scrollTop;
  modal.body.innerHTML = bodyHtml();
  modal.el.querySelector('.modal-head h2').textContent = t('settings.title');
  wire(modal);
  modal.body.scrollTop = scroll;
}

export function openSettings(section) {
  if (modal) { rerender(); return modal; }
  modal = openModal({
    title: t('settings.title'),
    size: 'wide',
    body: bodyHtml(),
    onClose: () => { modal = null; },
  });
  wire(modal);
  if (section) {
    const map = { employees: '.s-employees', clients: '.s-clients', data: '.project-list' };
    modal.body.querySelector(map[section] || '')?.scrollIntoView({ block: 'center' });
  }
  return modal;
}

export function initSettings() {
  document.getElementById('settings-btn').addEventListener('click', () => openSettings());
  window.addEventListener('kb:open-settings', e => openSettings(e.detail?.section));
  store.on('change', src => { if (modal && src && src.source === 'merge') rerender(); });
}
