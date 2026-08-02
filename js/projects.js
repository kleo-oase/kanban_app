// projects.js — several boards in one browser: the switcher in the top bar, the
// "add board" modal with a real connection check, the welcome screen shown when
// nothing is configured, and invite links.

import { store } from './store.js';
import { GitHubClient } from './github.js';
import { openMenu, openModal, toast } from './ui.js';
import { t } from './i18n.js';
import { esc, b64EncodeUtf8 } from './util.js';

const NEW_REPO_URL = 'https://github.com/new?visibility=private';
const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export function inviteLink(p) {
  const payload = b64EncodeUtf8(JSON.stringify({
    owner: p.owner, repo: p.repo, branch: p.branch || 'main', token: p.token || '', name: p.name || '',
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${location.origin}${location.pathname}#setup=${payload}`;
}

export async function copyInvite(p) {
  const link = inviteLink(p);
  try {
    await navigator.clipboard.writeText(link);
    toast(t('projects.share_done'), 'ok', 6000);
  } catch {
    toast(t('toast.copy_failed'), 'err');
    prompt(t('projects.share'), link);
  }
}

// ---------- add-board modal ----------

export function openAddProject() {
  const m = openModal({
    title: t('projects.add_title'),
    size: 'narrow',
    body: `
      <ol class="steps">
        <li>${t('projects.step1')} <a href="${NEW_REPO_URL}" target="_blank" rel="noopener">${esc(t('projects.link_repo'))} ↗</a></li>
        <li>${t('projects.step2')} <a href="${NEW_TOKEN_URL}" target="_blank" rel="noopener">${esc(t('projects.link_token'))} ↗</a></li>
        <li>${t('projects.step3')}</li>
      </ol>
      <form class="add-form">
        <label class="field"><span>${esc(t('projects.name'))}</span>
          <input class="a-name" type="text" placeholder="${esc(t('projects.name_ph'))}" autocomplete="off"></label>
        <div class="two-col">
          <label class="field"><span>${esc(t('projects.owner'))}</span>
            <input class="a-owner" type="text" autocomplete="off" spellcheck="false" placeholder="octocat"></label>
          <label class="field"><span>${esc(t('projects.repo'))}</span>
            <input class="a-repo" type="text" autocomplete="off" spellcheck="false" placeholder="kanban_data"></label>
        </div>
        <div class="two-col">
          <label class="field"><span>${esc(t('projects.branch'))}</span>
            <input class="a-branch" type="text" value="main" autocomplete="off" spellcheck="false"></label>
          <label class="field"><span>${esc(t('projects.token'))}</span>
            <input class="a-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
        </div>
        <small class="hint">${esc(t('projects.token_hint'))}</small>
        <p class="form-error" hidden></p>
        <p class="form-ok" hidden></p>
      </form>`,
    footer: `<span class="spacer"></span><button class="btn primary a-check">${esc(t('projects.check'))}</button>`,
  });

  const $ = s => m.body.querySelector(s);
  const err = $('.form-error'), ok = $('.form-ok');
  const btn = m.foot.querySelector('.a-check');

  btn.addEventListener('click', async () => {
    const cfg = {
      name: $('.a-name').value.trim(),
      owner: $('.a-owner').value.trim().replace(/^@/, ''),
      repo: $('.a-repo').value.trim().replace(/\.git$/, ''),
      branch: $('.a-branch').value.trim() || 'main',
      token: $('.a-token').value.trim(),
    };
    err.hidden = true; ok.hidden = true;
    if (!cfg.owner || !cfg.repo) { err.textContent = t('projects.owner') + ' / ' + t('projects.repo'); err.hidden = false; return; }
    btn.disabled = true;
    btn.textContent = t('projects.checking');
    try {
      const probe = await new GitHubClient(cfg).probe();
      ok.textContent = [probe.read ? t('projects.ok_read') : '', probe.write ? t('projects.ok_write') : ''].filter(Boolean).join(' · ');
      ok.hidden = false;
      const p = store.addProject(cfg);
      toast(t('projects.added', { name: p.name || `${p.owner}/${p.repo}` }), 'ok');
      setTimeout(() => store.switchProject(p.id), 400);
    } catch (e) {
      const key = 'err.' + (e.code || 'api');
      const msg = t(key);
      err.textContent = msg === key ? (e.message || String(e)) : msg;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = t('projects.check');
    }
  });
  return m;
}

// ---------- switcher ----------

function boardMenu(anchor) {
  openMenu(anchor, close => {
    const el = document.createElement('div');
    el.innerHTML = `
      ${store.projects.map(p => `
        <button class="menu-item p-switch${store.active && p.id === store.active.id ? ' on' : ''}" data-id="${esc(p.id)}">
          <span>${esc(p.name || `${p.owner}/${p.repo}`)}</span>
          <small>${esc(`${p.owner}/${p.repo}`)}</small>
        </button>`).join('')}
      ${store.projects.length ? '<hr>' : ''}
      <button class="menu-item p-add">${esc(t('projects.add'))}</button>`;
    el.querySelectorAll('.p-switch').forEach(b => {
      b.addEventListener('click', () => {
        close();
        if (!store.active || b.dataset.id !== store.active.id) store.switchProject(b.dataset.id);
      });
    });
    el.querySelector('.p-add').addEventListener('click', () => { close(); openAddProject(); });
    return el;
  });
}

// ---------- welcome screen ----------

function renderWelcome() {
  const host = document.getElementById('welcome');
  const show = !store.demo && store.projects.length === 0;
  host.hidden = !show;
  document.getElementById('main').hidden = show;
  if (!show) { host.innerHTML = ''; return; }
  host.innerHTML = `
    <div class="welcome-card">
      <h1>${esc(t('welcome.title'))}</h1>
      <p class="lead">${esc(t('welcome.lead'))}</p>
      <div class="welcome-actions">
        <button class="btn primary w-connect">${esc(t('welcome.connect'))}</button>
        <a class="btn" href="?demo=1">${esc(t('welcome.demo'))}</a>
      </div>
      <ol class="steps">
        <li>${t('projects.step1')}</li>
        <li>${t('projects.step2')}</li>
        <li>${t('projects.step3')}</li>
      </ol>
      <p class="hint">${esc(t('welcome.share_note'))}</p>
    </div>`;
  host.querySelector('.w-connect').addEventListener('click', openAddProject);
}

// ---------- top-bar button ----------

export function initProjects() {
  const btn = document.getElementById('board-btn');
  btn.dataset.menuId = 'boards';
  btn.addEventListener('click', () => boardMenu(btn));

  const sync = () => {
    const name = store.boardName();
    btn.innerHTML = `<span>${esc(name || t('projects.title'))}</span><i>▾</i>`;
    btn.title = t('top.switch_board');
    document.title = name ? `${name} · ${t('app.name')}` : t('app.name');
    renderWelcome();
  };
  store.on('change', sync);
  window.addEventListener('kb:lang', sync);
  sync();
}

