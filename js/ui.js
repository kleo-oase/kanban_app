// ui.js — shared UI primitives: toasts, a small modal stack, anchored menus,
// a translated confirm dialog and a pointer-based drag helper (pointer events
// instead of HTML5 drag & drop, so everything works on touch too).

import { esc, clamp } from './util.js';
import { t } from './i18n.js';

// ---------- toasts ----------

export function toast(msg, type = 'info', ms = 3800, href = null) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement(href ? 'a' : 'div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  if (href) {
    el.href = href;
    el.target = '_blank';
    el.rel = 'noopener';
  }
  el.addEventListener('click', () => el.remove());
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// ---------- modal stack ----------

const stack = [];

export function openModal({ title = '', body = '', footer = '', size = '', onClose = null, closeOnScrim = true }) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <header class="modal-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn m-close" aria-label="${esc(t('settings.close'))}">✕</button>
      </header>
      <div class="modal-body"></div>
      ${footer ? '<footer class="modal-foot"></footer>' : ''}
    </div>`;
  const panel = scrim.querySelector('.modal');
  const bodyEl = scrim.querySelector('.modal-body');
  if (body instanceof Node) bodyEl.appendChild(body);
  else bodyEl.innerHTML = body;
  const footEl = scrim.querySelector('.modal-foot');
  if (footEl) {
    if (footer instanceof Node) footEl.appendChild(footer);
    else footEl.innerHTML = footer;
  }

  const api = {
    el: panel, body: bodyEl, foot: footEl, scrim,
    close() {
      const i = stack.indexOf(api);
      if (i === -1) return;
      stack.splice(i, 1);
      scrim.remove();
      if (!stack.length) document.body.classList.remove('modal-open');
      onClose?.();
    },
  };

  scrim.querySelector('.m-close').addEventListener('click', () => api.close());
  if (closeOnScrim) {
    scrim.addEventListener('pointerdown', e => { if (e.target === scrim) api.close(); });
  }

  document.body.appendChild(scrim);
  document.body.classList.add('modal-open');
  stack.push(api);
  setTimeout(() => {
    const focusable = panel.querySelector('input:not([type=hidden]), textarea, select, button:not(.m-close)');
    focusable?.focus();
  }, 30);
  return api;
}

export const topModal = () => stack[stack.length - 1] || null;

window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (menuEl) { closeMenu(); e.stopPropagation(); return; }
  const top = stack[stack.length - 1];
  if (top) { top.close(); e.stopPropagation(); }
}, true);

// ---------- confirm ----------

export function confirmDialog(message, { danger = true, okLabel } = {}) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const m = openModal({
      title: '',
      size: 'narrow',
      body: `<p class="confirm-text">${esc(message)}</p>`,
      footer: `
        <button class="btn c-no">${esc(t('common.cancel'))}</button>
        <button class="btn ${danger ? 'danger' : 'primary'} c-yes">${esc(okLabel || t('common.yes'))}</button>`,
      onClose: () => finish(false),
    });
    m.foot.querySelector('.c-no').addEventListener('click', () => { finish(false); m.close(); });
    m.foot.querySelector('.c-yes').addEventListener('click', () => { finish(true); m.close(); });
  });
}

// ---------- anchored menu / popover ----------

let menuEl = null;
let menuCloser = null;

export function closeMenu() {
  if (menuEl) menuEl.remove();
  menuEl = null;
  if (menuCloser) {
    window.removeEventListener('pointerdown', menuCloser, true);
    menuCloser = null;
  }
  document.querySelectorAll('.menu-open').forEach(b => b.classList.remove('menu-open'));
}

export const isMenuOpen = () => !!menuEl;

// `render(close)` returns an element or HTML for the menu body.
export function openMenu(anchor, render, { className = '', align = 'left' } = {}) {
  const wasFor = menuEl && menuEl.dataset.for;
  closeMenu();
  if (wasFor && anchor.dataset.menuId && wasFor === anchor.dataset.menuId) return null;

  menuEl = document.createElement('div');
  menuEl.className = `menu ${className}`;
  if (anchor.dataset.menuId) menuEl.dataset.for = anchor.dataset.menuId;
  const content = render(closeMenu);
  if (content instanceof Node) menuEl.appendChild(content);
  else menuEl.innerHTML = content;
  menuEl.addEventListener('pointerdown', e => e.stopPropagation());
  document.body.appendChild(menuEl);

  const a = anchor.getBoundingClientRect();
  const m = menuEl.getBoundingClientRect();
  const left = align === 'right' ? a.right - m.width : a.left;
  menuEl.style.left = clamp(left, 8, Math.max(8, window.innerWidth - m.width - 8)) + 'px';
  const below = a.bottom + 6;
  menuEl.style.top = (below + m.height > window.innerHeight - 8
    ? Math.max(8, a.top - m.height - 6)
    : below) + 'px';

  anchor.classList.add('menu-open');
  menuCloser = e => {
    if (menuEl && !menuEl.contains(e.target) && !anchor.contains(e.target)) closeMenu();
  };
  setTimeout(() => { if (menuCloser) window.addEventListener('pointerdown', menuCloser, true); }, 0);
  return menuEl;
}

// ---------- drag helper ----------
// Starts after a small movement threshold so plain clicks still work.

export function draggable(handle, { onStart, onMove, onEnd, threshold = 6 }) {
  handle.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button, input, textarea, select, a')) return;
    const sx = e.clientX, sy = e.clientY;
    let started = false;

    const move = ev => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < threshold) return;
        started = true;
        try { handle.setPointerCapture(ev.pointerId); } catch { }
        onStart?.(ev);
      }
      ev.preventDefault();
      onMove?.(ev);
    };
    const up = ev => {
      cleanup();
      if (started) onEnd?.(ev, true);
    };
    const cancel = ev => {
      cleanup();
      if (started) onEnd?.(ev, false);
    };
    function cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    }
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  });
}

// ---------- small builders ----------

export const optionHtml = (value, label, selected) =>
  `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;

export function checkboxRow(id, label, checked, extraClass = '') {
  return `<label class="check ${extraClass}">
    <input type="checkbox" value="${esc(id)}"${checked ? ' checked' : ''}>
    <span>${esc(label)}</span>
  </label>`;
}

export function radioRow(name, id, label, checked) {
  return `<label class="check">
    <input type="radio" name="${esc(name)}" value="${esc(id)}"${checked ? ' checked' : ''}>
    <span>${esc(label)}</span>
  </label>`;
}
