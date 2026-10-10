// richtext.js — the formatting editor for card notes: a toolbar over an
// editable area.
//
// The area shows the note rendered from Markdown (markdown.js) and is turned
// back into Markdown when the card is saved — but only if the note was actually
// edited, so opening and saving a card never rewrites a note nobody touched.
// Formatting runs through the browser's built-in editing commands, which keep
// the native undo (Ctrl/Cmd+Z) and shortcuts (Ctrl/Cmd+B, I, U) working.

import { renderMarkdown, htmlToMarkdown, TEXT_COLORS, NO_COLOR, colorToHex } from './markdown.js';
import { openMenu, toast } from './ui.js';
import { t } from './i18n.js';
import { esc } from './util.js';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const key = k => (MAC ? `⌘${k}` : `Ctrl+${k}`);

const BLOCKS = [
  { tag: 'p', label: 'rte.paragraph' },
  { tag: 'h1', label: 'rte.h1' },
  { tag: 'h2', label: 'rte.h2' },
  { tag: 'h3', label: 'rte.h3' },
];

const button = (attrs, title, inner) =>
  `<button type="button" class="rte-btn" ${attrs} title="${esc(title)}" aria-label="${esc(title)}">${inner}</button>`;

function toolbarHtml() {
  return `
    <button type="button" class="rte-btn rte-wide rte-blockbtn" data-menu="block" aria-haspopup="true"
            title="${esc(t('rte.style'))}"><span class="rte-blocklabel">${esc(t('rte.paragraph'))}</span><span class="rte-caret">▾</span></button>
    <span class="rte-sep"></span>
    ${button('data-cmd="bold"', `${t('rte.bold')} (${key('B')})`, '<b>B</b>')}
    ${button('data-cmd="italic"', `${t('rte.italic')} (${key('I')})`, '<i>I</i>')}
    ${button('data-cmd="underline"', `${t('rte.underline')} (${key('U')})`, '<u>U</u>')}
    ${button('data-cmd="strikeThrough"', t('rte.strike'), '<s>S</s>')}
    <button type="button" class="rte-btn rte-colorbtn" data-menu="color" aria-haspopup="true"
            title="${esc(t('rte.color'))}" aria-label="${esc(t('rte.color'))}"><span class="rte-a">A</span><span class="rte-swatch"></span></button>
    <span class="rte-sep"></span>
    ${button('data-cmd="insertUnorderedList"', t('rte.ul'), '<span class="rte-ico">•≡</span>')}
    ${button('data-cmd="insertOrderedList"', t('rte.ol'), '<span class="rte-ico">1≡</span>')}
    ${button('data-action="quote"', t('rte.quote'), '<span class="rte-ico">❝</span>')}
    ${button('data-action="link"', `${t('rte.link')} (${key('K')})`, '<span class="rte-ico">🔗</span>')}
    ${button('data-cmd="insertHorizontalRule"', t('rte.hr'), '<span class="rte-ico">―</span>')}
    <span class="rte-sep"></span>
    ${button('data-action="clear"', t('rte.clear'), '<span class="rte-ico rte-clear">T</span>')}`;
}

// `host` becomes the editor. Returns { getMarkdown(), isDirty() }.
export function createRichEditor(host, markdown = '', { placeholder = '' } = {}) {
  host.classList.add('rte');
  host.innerHTML = `
    <div class="rte-bar" role="toolbar" aria-label="${esc(t('rte.toolbar'))}">${toolbarHtml()}</div>
    <div class="rte-area md" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true"
         aria-label="${esc(placeholder)}" data-placeholder="${esc(placeholder)}"></div>`;
  const bar = host.querySelector('.rte-bar');
  const area = host.querySelector('.rte-area');
  area.innerHTML = renderMarkdown(markdown);

  let dirty = false;
  let saved = null;   // the last selection inside the area

  const inArea = node => !!node && (node === area || area.contains(node));
  const selection = () => document.getSelection();

  const syncEmpty = () => area.classList.toggle('is-empty',
    !area.textContent.trim() && !area.querySelector('hr, li, img'));

  const changed = () => { dirty = true; syncEmpty(); syncBar(); };

  // The toolbar must not take the selection away from the text: buttons
  // swallow mousedown, so the live selection normally stays in the area. Only
  // when something else had focus (a menu, the link prompt) is the remembered
  // selection put back.
  const restore = () => {
    const sel = selection();
    const live = sel && sel.rangeCount && inArea(sel.anchorNode);
    area.focus({ preventScroll: true });
    if (!live && saved && sel) { sel.removeAllRanges(); sel.addRange(saved); }
  };
  // (an omitted value, not null: Chrome would write `id="null"` on a rule)
  const exec = (cmd, value) => {
    restore();
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { }
    document.execCommand(cmd, false, value);
    remember();
    changed();
  };
  const remember = () => {
    const sel = selection();
    if (sel && sel.rangeCount && inArea(sel.anchorNode)) saved = sel.getRangeAt(0).cloneRange();
  };

  const currentBlock = () => {
    let n = selection()?.anchorNode;
    while (n && n !== area) {
      if (n.nodeType === 1 && /^(H[1-6]|BLOCKQUOTE)$/.test(n.nodeName)) return n.nodeName.toLowerCase();
      n = n.parentNode;
    }
    return 'p';
  };
  const currentLink = () => {
    let n = selection()?.anchorNode;
    while (n && n !== area) {
      if (n.nodeType === 1 && n.nodeName === 'A') return n;
      n = n.parentNode;
    }
    return null;
  };

  function syncBar() {
    if (!inArea(selection()?.anchorNode)) return;
    for (const b of bar.querySelectorAll('[data-cmd]')) {
      if (b.dataset.cmd === 'insertHorizontalRule') continue;
      let on = false;
      try { on = document.queryCommandState(b.dataset.cmd); } catch { }
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    const block = currentBlock();
    const label = BLOCKS.find(x => x.tag === block)?.label || (block === 'blockquote' ? 'rte.quote' : 'rte.paragraph');
    bar.querySelector('.rte-blocklabel').textContent = t(label);
    bar.querySelector('[data-action="quote"]').classList.toggle('on', block === 'blockquote');
    let color = null;
    try { color = colorToHex(document.queryCommandValue('foreColor')); } catch { }
    const known = TEXT_COLORS.find(c => c.hex === color);
    bar.querySelector('.rte-swatch').style.background = known ? known.hex : 'currentColor';
  }

  // "Default colour": apply a marker colour, then unwrap whatever carries it,
  // so the text simply has no colour of its own any more.
  const clearColor = () => {
    exec('foreColor', NO_COLOR);
    for (const el of [...area.querySelectorAll('font[color], span[style]')]) {
      const c = el.nodeName === 'FONT' ? el.getAttribute('color') : el.style.color;
      if (colorToHex(c) === NO_COLOR) el.replaceWith(...el.childNodes);
    }
    changed();
  };

  const link = () => {
    remember();
    const current = currentLink();
    const answer = prompt(t('rte.link_prompt'), current ? current.getAttribute('href') : 'https://');
    if (answer === null) { restore(); return; }
    const raw = answer.trim();
    if (!raw || raw === 'https://') { if (current) exec('unlink'); else restore(); return; }
    const href = /^(https?:|mailto:|tel:)/i.test(raw) ? raw
      : /^www\./i.test(raw) ? 'https://' + raw
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? 'mailto:' + raw : null;
    if (!href) { toast(t('rte.link_invalid'), 'err'); restore(); return; }
    restore();
    const sel = selection();
    if (sel && sel.isCollapsed && !current) exec('insertHTML', `<a href="${esc(href)}">${esc(raw)}</a>`);
    else exec('createLink', href);
  };

  const blockMenu = anchor => openMenu(anchor, close => {
    const el = document.createElement('div');
    el.className = 'rte-menu md';
    el.innerHTML = BLOCKS.map(b => `<button type="button" class="menu-item rte-style-${b.tag}" data-block="${b.tag}">${esc(t(b.label))}</button>`).join('');
    el.addEventListener('mousedown', e => e.preventDefault());
    el.querySelectorAll('[data-block]').forEach(b => b.addEventListener('click', () => {
      close();
      exec('formatBlock', `<${b.dataset.block}>`);
    }));
    return el;
  });

  const colorMenu = anchor => openMenu(anchor, close => {
    const el = document.createElement('div');
    el.className = 'rte-menu';
    el.innerHTML = `
      <div class="swatches">
        ${TEXT_COLORS.map(c => `<button type="button" class="swatch" data-color="${c.hex}" style="background:${c.hex}"
            title="${esc(t('rte.c.' + c.id))}" aria-label="${esc(t('rte.c.' + c.id))}"></button>`).join('')}
      </div>
      <button type="button" class="menu-item" data-color="">${esc(t('rte.color_default'))}</button>`;
    el.addEventListener('mousedown', e => e.preventDefault());
    el.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
      close();
      if (b.dataset.color) exec('foreColor', b.dataset.color);
      else clearColor();
    }));
    return el;
  });

  bar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cmd) exec(b.dataset.cmd);
    else if (b.dataset.menu === 'block') { remember(); b.dataset.menuId = 'rte-block'; blockMenu(b); }
    else if (b.dataset.menu === 'color') { remember(); b.dataset.menuId = 'rte-color'; colorMenu(b); }
    else if (b.dataset.action === 'quote') exec('formatBlock', currentBlock() === 'blockquote' ? '<p>' : '<blockquote>');
    else if (b.dataset.action === 'link') link();
    else if (b.dataset.action === 'clear') {
      exec('removeFormat');
      if (currentBlock() !== 'p') exec('formatBlock', '<p>');
    }
  });

  area.addEventListener('input', changed);
  area.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); link(); }
  });
  area.addEventListener('focus', () => {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { }
  });

  // Pasted content is normalised to exactly what will be saved, so the editor
  // never shows formatting (fonts, sizes, foreign colours) that would silently
  // vanish on save.
  area.addEventListener('paste', e => {
    const data = e.clipboardData;
    if (!data) return;
    e.preventDefault();
    const html = data.getData('text/html');
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      let out = renderMarkdown(htmlToMarkdown(doc.body, { paste: true }));
      const single = out.match(/^<p>([\s\S]*)<\/p>$/);   // one paragraph joins the current line
      if (single && !single[1].includes('</p>')) out = single[1];
      if (out) document.execCommand('insertHTML', false, out);
    } else {
      const text = data.getData('text/plain');
      if (text) document.execCommand('insertText', false, text);
    }
    changed();
  });

  // follow the selection; the listener removes itself once the editor is gone
  const onSelection = () => {
    if (!area.isConnected) { document.removeEventListener('selectionchange', onSelection); return; }
    if (inArea(selection()?.anchorNode)) { remember(); syncBar(); }
  };
  document.addEventListener('selectionchange', onSelection);

  syncEmpty();
  return {
    getMarkdown: () => (dirty ? htmlToMarkdown(area) : markdown),
    isDirty: () => dirty,
    area,
  };
}

