// app.js — boot, view routing, the top bar (save / language / banner) and the
// invite-link import.

import { store, loadProjects, PROJECTS_KEY, ACTIVE_KEY } from './store.js';
import { board } from './board.js';
import { calendar } from './calendar.js';
import { archive } from './archive.js';
import { initToolbar } from './toolbar.js';
import { initSettings, openSettings } from './settings.js';
import { initHelp } from './help.js';
import { initProjects } from './projects.js';
import { toast } from './ui.js';
import { t, lang, setLang, LANGS } from './i18n.js';
import { APP_VERSION, CHANGELOG_URL } from './version.js';
import { b64DecodeUtf8, lsGet, lsSet, uid, esc } from './util.js';

const views = { board, calendar, archive };
let active = 'board';

// ---------- invite link (#setup=…) — adds a board, before the store boots ----------

function importSetupHash() {
  const m = location.hash.match(/[#&]setup=([A-Za-z0-9\-_]+)/);
  if (!m) return;
  try {
    const json = JSON.parse(b64DecodeUtf8(m[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof json.owner !== 'string' || typeof json.repo !== 'string' || !json.owner || !json.repo) {
      throw new Error('missing owner/repo');
    }
    const projects = loadProjects();
    const branch = (typeof json.branch === 'string' && json.branch) || 'main';
    // upsert, never replace — the recipient may already have other boards
    let p = projects.find(q => q.owner === json.owner && q.repo === json.repo && (q.branch || 'main') === branch);
    if (p) {
      if (typeof json.token === 'string' && json.token) p.token = json.token;
      if (typeof json.name === 'string' && json.name) p.name = json.name;
    } else {
      p = {
        id: 'p-' + uid(),
        name: typeof json.name === 'string' ? json.name : '',
        owner: json.owner, repo: json.repo, branch,
        token: typeof json.token === 'string' ? json.token : '',
      };
      projects.push(p);
    }
    lsSet(PROJECTS_KEY, projects);
    lsSet(ACTIVE_KEY, p.id);
    setTimeout(() => toast(t('projects.added', { name: p.name || `${p.owner}/${p.repo}` }), 'ok'), 300);
  } catch {
    setTimeout(() => toast(t('toast.save_failed'), 'err'), 300);
  }
  history.replaceState(null, '', location.pathname + location.search + '#board');
}

// ---------- views ----------

function switchView(name, updateHash = true) {
  if (!views[name]) name = 'board';
  active = name;
  for (const n of Object.keys(views)) document.getElementById('view-' + n).hidden = n !== name;
  for (const b of document.querySelectorAll('.tab')) b.classList.toggle('active', b.dataset.view === name);
  if (updateHash && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  views[name].activate();
}

// ---------- top bar ----------

function errMessage(e) {
  const key = 'err.' + (e && e.code ? e.code : 'api');
  const msg = t(key, { at: e && e.resetAt ? e.resetAt : '' });
  return msg === key ? (e && e.message ? e.message : String(e)) : msg.trim();
}

function updateChrome() {
  const saveBtn = document.getElementById('save-btn');
  const n = store.changes().length;
  if (store.saving) {
    saveBtn.textContent = t('top.saving');
    saveBtn.disabled = true;
  } else {
    saveBtn.textContent = n ? t('top.save_n', { n }) : t('top.save');
    saveBtn.disabled = n === 0;
  }
  saveBtn.classList.toggle('attention', n > 0 && !store.saving);
  document.getElementById('sync-dot').hidden = !store.syncing;
  updateBanner();
}

function updateBanner() {
  const banner = document.getElementById('banner');
  const needsToken = !store.demo && store.configured() && !store.settings.token
    && store.lastError && ['not-found', 'auth', 'raw', 'forbidden'].includes(store.lastError.code);
  const show = (html, action) => {
    banner.hidden = false;
    banner.innerHTML = html;
    const b = banner.querySelector('button');
    if (b) b.addEventListener('click', action);
  };
  if (store.formatTooNew()) {
    show(`<span>${esc(t('banner.format_new'))}</span><button class="btn">${esc(t('banner.reload'))}</button>`,
      () => location.reload());
  } else if (!store.demo && !store.configured() && store.projects.length > 0) {
    show(`<span>${esc(t('banner.no_repo'))}</span><button class="btn">${esc(t('banner.open_settings'))}</button>`,
      () => openSettings('data'));
  } else if (needsToken) {
    show(`<span>${esc(t('banner.needs_token'))}</span><button class="btn">${esc(t('banner.open_settings'))}</button>`,
      () => openSettings('data'));
  } else {
    banner.hidden = true;
    banner.innerHTML = '';
  }
}

function relabel() {
  document.querySelector('.tab[data-view="board"]').textContent = t('nav.board');
  document.querySelector('.tab[data-view="calendar"]').textContent = t('nav.calendar');
  document.querySelector('.tab[data-view="archive"]').textContent = t('nav.archive');
  const set = (id, key) => {
    const el = document.getElementById(id);
    el.title = t(key);
    el.setAttribute('aria-label', t(key));
  };
  set('filter-btn', 'top.filter');
  set('sort-btn', 'top.sort');
  set('search-btn', 'top.search');
  set('help-btn', 'top.help');
  set('settings-btn', 'top.settings');
  const langBtn = document.getElementById('lang-btn');
  langBtn.textContent = lang().toUpperCase();
  langBtn.title = t('top.language');
  document.querySelector('#search-row input').placeholder = t('search.placeholder');
  document.querySelector('#search-row .search-clear').title = t('search.clear');
  document.getElementById('demo-badge').hidden = !store.demo;
  document.getElementById('demo-badge').textContent = t('demo.badge');
  updateChrome();
}

// ---------- save ----------

async function doSave() {
  try {
    const r = await store.save();
    toast(r.nothing ? t('toast.nothing') : t('toast.saved', { sha: r.sha.slice(0, 7) }), 'ok');
  } catch (e) {
    if (['no-token', 'config', 'demo'].includes(e.code)) {
      toast(errMessage(e), 'err');
      if (e.code !== 'demo') openSettings('data');
    } else {
      toast(errMessage(e) || t('toast.save_failed'), 'err');
    }
  }
}

// ---------- boot ----------

function boot() {
  importSetupHash();
  document.documentElement.lang = lang();

  initSettings();
  initHelp();
  initToolbar();
  board.init(document.getElementById('view-board'));
  calendar.init(document.getElementById('view-calendar'));
  archive.init(document.getElementById('view-archive'));
  initProjects();

  document.getElementById('tabs').addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (b) switchView(b.dataset.view);
  });
  window.addEventListener('hashchange', () => switchView(location.hash.slice(1), false));

  document.getElementById('save-btn').addEventListener('click', doSave);
  document.getElementById('lang-btn').addEventListener('click', () => {
    setLang(LANGS[(LANGS.indexOf(lang()) + 1) % LANGS.length]);
  });
  window.addEventListener('kb:lang', relabel);

  store.on('change', updateChrome);
  store.on('error', e => toast(errMessage(e), 'err', 6000));
  store.on('merged', rep => {
    if (rep.conflicts.length) {
      const list = rep.conflicts.slice(0, 3).join(' · ') + (rep.conflicts.length > 3 ? ' …' : '');
      toast(t('toast.conflicts', { list }), 'info', 9000);
    } else if (rep.pulled) {
      toast(t('toast.merged', { n: rep.pulled }), 'info');
    }
  });

  // the draft write is debounced — make sure the last edit survives a quick close
  window.addEventListener('pagehide', () => { if (store._hasDraft) store._persistDraftNow(); });

  // keep long-lived tabs fresh
  const maybeRefresh = () => {
    if (!document.hidden && Date.now() - (store.lastSync || 0) > 15000) store.refresh();
  };
  window.addEventListener('focus', maybeRefresh);
  document.addEventListener('visibilitychange', maybeRefresh);

  // a second tab of this browser wrote to localStorage — adopt it while hidden
  window.addEventListener('storage', e => {
    if (!e.key) return;
    if ((e.key === store.key('draft') || e.key === store.key('cache')) && document.hidden) store.adoptExternal();
  });

  store.init();
  switchView(location.hash.slice(1) || 'board');
  relabel();

  // one-time "what's new" notice after an app update (not on a first visit)
  const last = lsGet('kb:version');
  if (last && last !== APP_VERSION) {
    setTimeout(() => toast(t('toast.updated', { v: APP_VERSION }), 'info', 9000, CHANGELOG_URL), 800);
  }
  lsSet('kb:version', APP_VERSION);

  window.KB = { store };   // console access while developing
}

boot();
