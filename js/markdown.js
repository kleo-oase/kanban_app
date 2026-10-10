// markdown.js — the notes format, in both directions.
//
// Notes are stored as Markdown. Block structure uses plain Markdown syntax —
// headings (#), lists (- / 1.), quotes (>), rules (---), links, code. Inline
// formatting is written as a handful of HTML tags, which Markdown allows inline:
//
//   <b>bold</b>  <i>italic</i>  <u>underlined</u>  <s>struck</s>
//   <span style="color:#d64545">coloured</span>
//
// Tags nest without the ambiguity of stacked ** and * delimiters, and
// github.com renders most of them. Notes written by hand with **bold**,
// *italic* and ~~struck~~ keep rendering exactly as before.
//
// renderMarkdown() escapes everything first and only lets these exact tags back
// in, so a note can never inject markup. htmlToMarkdown() turns the editor's
// DOM (or pasted HTML) back into this format; it only needs nodeType, nodeName,
// nodeValue, childNodes and getAttribute, so it runs in Node too.

import { esc } from './util.js';

// The text colours the toolbar offers. Mid tones, legible on the light and the
// dark theme alike.
export const TEXT_COLORS = [
  { id: 'red', hex: '#d64545' },
  { id: 'orange', hex: '#b8661a' },
  { id: 'green', hex: '#27895a' },
  { id: 'blue', hex: '#3b71f3' },
  { id: 'purple', hex: '#8b5cf6' },
  { id: 'pink', hex: '#d6488a' },
  { id: 'grey', hex: '#7a8499' },
];

// "Default colour" in the editor is applied as this colour and then removed
// again at once; whatever is left of it is never stored.
export const NO_COLOR = '#010203';

// '#abc', '#aabbcc', 'rgb(1, 2, 3)', 'rgba(1, 2, 3, 1)' -> '#rrggbb' (else null)
export function colorToHex(value) {
  const v = String(value || '').trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return '#' + m[1].split('').map(c => c + c).join('');
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m && (m[4] === undefined || +m[4] > 0)) {
    return '#' + [m[1], m[2], m[3]].map(n => Math.min(255, +n).toString(16).padStart(2, '0')).join('');
  }
  return null;
}

// Plain text of a note, for searching: the formatting tags are not content.
export const stripFormatting = md => String(md || '')
  .replace(/<\/?(?:b|i|u|s)>/gi, '')
  .replace(/<span style="color:\s*#[0-9a-f]{6}\s*;?">|<\/span>/gi, '');

// ---------- Markdown -> HTML ----------
// Placeholders use private-use characters / so user text can't
// forge them (esc() has already run, and those characters never survive
// keyboard input).

const ESCAPE = /\\(&lt;|&gt;|&amp;|&quot;|&#39;|[\\`*_{}[\]()#+\-.!~|])|`([^`\n]+)`/g;

export function renderMarkdown(md) {
  if (!md || !String(md).trim()) return '';
  let text = esc(String(md).replace(/\r\n?/g, '\n'));
  const slots = [];
  const put = html => { slots.push(html); return `${slots.length - 1}`; };

  text = text.replace(/^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm, (_, code) => put(`<pre><code>${code}</code></pre>`));

  // the formatting tags the editor writes, then the classic Markdown emphasis
  const formatting = s => s
    .replace(/&lt;(\/?)(b|i|u|s)&gt;/gi, (_, slash, tag) => `<${slash}${tag.toLowerCase()}>`)
    .replace(/&lt;span style=&quot;color:\s*(#[0-9a-f]{6})\s*;?&quot;&gt;/gi,
      (_, hex) => `<span style="color:${hex.toLowerCase()}">`)
    .replace(/&lt;\/span&gt;/gi, '</span>')
    // emphasis must hug its text, as in CommonMark: "5 * 3 * 2" is not italic
    .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(>])\*(?=\S)([^*\n]*?\S)\*(?=[\s).,;:!?<]|$)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([^~\n]*?\S)~~/g, '<del>$1</del>');

  const inline = s => {
    // backslash escapes and code spans in one left-to-right pass, so `\``
    // never opens a code span and nothing inside a code span is unescaped
    s = s.replace(ESCAPE, (_, escaped, code) => put(escaped !== undefined ? escaped : `<code>${code}</code>`));
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const raw = href.replace(/&amp;/g, '&');
      const safe = /^(https?:|mailto:|tel:)/i.test(raw) ? raw : '#';
      return put(`<a href="${esc(safe)}" target="_blank" rel="noopener">${formatting(label)}</a>`);
    });
    s = formatting(s);
    s = s.replace(/(^|[\s(>])((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?])/g, (_, pre, url) => {
      const raw = url.replace(/&amp;/g, '&');
      return pre + put(`<a href="${esc(raw.startsWith('www.') ? 'https://' + raw : raw)}" target="_blank" rel="noopener">${url}</a>`);
    });
    return s;
  };

  const lines = text.split('\n');
  const out = [];
  const para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para.length = 0;
  };
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { flushPara(); i++; continue; }
    if (/^\d+$/.test(t)) { flushPara(); out.push(t); i++; continue; }
    let m;
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushPara(); out.push('<hr>'); i++; continue; }
    if (/^[-*]\s+/.test(t)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`); i++;
      }
      out.push(`<ul>${items.join('')}</ul>`); continue;
    }
    if (/^\d+[.)]\s+/.test(t)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^\d+[.)]\s+/, ''))}</li>`); i++;
      }
      out.push(`<ol>${items.join('')}</ol>`); continue;
    }
    if (/^&gt;\s?/.test(t)) {
      flushPara();
      const q = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i].trim())) {
        q.push(lines[i].trim().replace(/^&gt;\s?/, '')); i++;
      }
      out.push(`<blockquote>${q.map(inline).join('<br>')}</blockquote>`); continue;
    }
    para.push(t); i++;
  }
  flushPara();

  let html = out.join('\n');
  let guard = 0;
  while (//.test(html) && guard++ < 10) {
    html = html.replace(/(\d+)/g, (_, n) => slots[+n] ?? '');
  }
  return html;
}

// ---------- HTML -> Markdown ----------

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CENTER', 'DD', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5',
  'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE',
  'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
]);
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'META', 'LINK', 'TEMPLATE', 'NOSCRIPT',
  'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA',
]);
const isBlock = n => n.nodeType === 1 && BLOCK_TAGS.has(n.nodeName);
const isList = n => n.nodeType === 1 && (n.nodeName === 'UL' || n.nodeName === 'OL');

// `paste: true` is for HTML from the clipboard: colours other than the
// toolbar's are dropped (web pages are full of near-black text that would be
// unreadable on the dark theme).
export function htmlToMarkdown(root, { paste = false } = {}) {
  const out = [];
  blockChildren(root, out, { paste }, {});
  return out.join('\n\n');
}

const hasBlockInside = el => [...(el.childNodes || [])].some(n => isBlock(n) || (n.nodeType === 1 && hasBlockInside(n)));

// `marks` is formatting inherited from inline wrappers around blocks — Google
// Docs, for one, wraps a whole pasted selection in <b style="font-weight:normal">.
function blockChildren(node, out, ctx, marks) {
  let run = [];
  const flush = () => {
    if (run.length) pushParagraph(out, inlineLines(run, ctx, true, marks));
    run = [];
  };
  for (const n of node.childNodes || []) {
    if (n.nodeType === 1 && SKIP_TAGS.has(n.nodeName)) continue;
    if (isBlock(n)) { flush(); block(n, out, ctx, marks); }
    else if (n.nodeType === 1 && hasBlockInside(n)) { flush(); blockChildren(n, out, ctx, marksOf(n, marks, ctx)); }
    else run.push(n);
  }
  flush();
}

function pushParagraph(out, lines) {
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length) out.push(lines.join('\n'));
}

function block(el, out, ctx, marks) {
  const tag = el.nodeName;
  const own = marksOf(el, marks, ctx);   // e.g. <p style="font-weight:bold">
  if (/^H[1-6]$/.test(tag)) {
    const text = joinLines(inlineLines(el.childNodes, ctx, false, own));
    if (text) out.push('#'.repeat(+tag[1]) + ' ' + text);
  } else if (isList(el)) {
    const items = listItems(el, ctx, own);
    if (items.length) out.push(items.map((x, i) => (tag === 'OL' ? `${i + 1}. ` : '- ') + x).join('\n'));
  } else if (tag === 'LI') {
    const text = joinLines(inlineLines(el.childNodes, ctx, false, own));
    if (text) out.push('- ' + text);
  } else if (tag === 'BLOCKQUOTE') {
    const lines = inlineLines(el.childNodes, ctx, false, own);
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (lines.length) out.push(lines.map(l => (l.trim() ? '> ' + l : '>')).join('\n'));
  } else if (tag === 'PRE') {
    out.push('```\n' + textOf(el).replace(/\n$/, '') + '\n```');
  } else if (tag === 'HR') {
    out.push('---');
  } else if (hasBlockInside(el)) {
    blockChildren(el, out, ctx, own);   // a container of blocks
  } else {
    pushParagraph(out, inlineLines(el.childNodes, ctx, true, own));
  }
}

const joinLines = lines => lines.map(l => l.trim()).filter(Boolean).join(' ');

// Nested lists are flattened: the notes format has one level.
function listItems(list, ctx, marks) {
  const items = [];
  for (const li of list.childNodes || []) {
    if (li.nodeType !== 1) continue;
    const m = marksOf(li, marks, ctx);
    if (isList(li)) { items.push(...listItems(li, ctx, m)); continue; }
    const own = [], nested = [];
    for (const n of li.childNodes || []) (isList(n) ? nested : own).push(n);
    const text = joinLines(inlineLines(own, ctx, false, m));
    if (text) items.push(text);
    for (const sub of nested) items.push(...listItems(sub, ctx, m));
  }
  return items;
}

function textOf(node) {
  if (node.nodeType === 3) return node.nodeValue || '';
  if (node.nodeType !== 1) return '';
  if (node.nodeName === 'BR') return '\n';
  return [...(node.childNodes || [])].map(textOf).join('');
}

// ---------- inline content ----------
// Inline content becomes "segments" — text with a set of marks — split into
// lines at <br>. Each line is then written with a stack of open marks in a fixed
// order (link, colour, b, i, u, s), so the tags always nest correctly.

const ORDER = ['a', 'c', 'b', 'i', 'u', 's'];
const OPEN = { a: () => '[', c: v => `<span style="color:${v}">`, b: () => '<b>', i: () => '<i>', u: () => '<u>', s: () => '<s>' };
const CLOSE = { a: v => `](${v})`, c: () => '</span>', b: () => '</b>', i: () => '</i>', u: () => '</u>', s: () => '</s>' };

function parseStyle(style) {
  const out = {};
  for (const decl of String(style || '').split(';')) {
    const k = decl.indexOf(':');
    if (k > 0) out[decl.slice(0, k).trim().toLowerCase()] = decl.slice(k + 1).trim().toLowerCase();
  }
  return out;
}

function safeHref(href) {
  const h = String(href || '').trim();
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  if (/^www\./i.test(h)) return 'https://' + h;
  return null;
}

// undefined = "no opinion" (keep the parent's colour); null = default colour
function pickColor(value, ctx) {
  const hex = colorToHex(value);
  if (!hex) return undefined;
  if (hex === NO_COLOR) return null;
  if (ctx.paste && !TEXT_COLORS.some(c => c.hex === hex)) return undefined;
  return hex;
}

function marksOf(el, parent, ctx) {
  const m = { ...parent };
  const tag = el.nodeName;
  if (tag === 'B' || tag === 'STRONG') m.b = true;
  if (tag === 'I' || tag === 'EM' || tag === 'CITE' || tag === 'DFN' || tag === 'VAR') m.i = true;
  if (tag === 'U' || tag === 'INS') m.u = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') m.s = true;
  if (tag === 'A') { const href = safeHref(el.getAttribute('href')); if (href) m.a = href; }
  if (tag === 'FONT') { const c = pickColor(el.getAttribute('color'), ctx); if (c !== undefined) m.c = c; }
  const style = parseStyle(el.getAttribute('style'));
  if ('font-weight' in style) m.b = /^(bold|bolder|[6-9]00)$/.test(style['font-weight']);
  if ('font-style' in style) m.i = /^(italic|oblique)/.test(style['font-style']);
  // decorations propagate to descendants and cannot be switched off by them
  const deco = `${style['text-decoration'] || ''} ${style['text-decoration-line'] || ''}`;
  if (/underline/.test(deco)) m.u = true;
  if (/line-through/.test(deco)) m.s = true;
  if ('color' in style) { const c = pickColor(style.color, ctx); if (c !== undefined) m.c = c; }
  return m;
}

function collect(nodes, marks, segs, ctx) {
  for (const n of nodes || []) {
    if (n.nodeType === 3) {
      const text = (n.nodeValue || '').replace(/[\t\n\r ]+/g, ' ').replace(/ /g, ' ');
      if (text) segs.push({ text, marks });
      continue;
    }
    if (n.nodeType !== 1 || SKIP_TAGS.has(n.nodeName)) continue;
    if (n.nodeName === 'BR') { segs.push({ br: true }); continue; }
    if (n.nodeName === 'IMG') {
      const alt = n.getAttribute('alt');
      if (alt) segs.push({ text: alt, marks });
      continue;
    }
    if (isBlock(n)) {   // a block inside inline context: its own lines
      segs.push({ br: true });
      collect(n.childNodes, marks, segs, ctx);
      segs.push({ br: true });
      continue;
    }
    if (n.nodeName === 'CODE' || n.nodeName === 'KBD' || n.nodeName === 'SAMP') {
      const code = textOf(n).replace(/\n/g, ' ');
      if (code) segs.push({ code, marks });
      continue;
    }
    collect(n.childNodes, marksOf(n, marks, ctx), segs, ctx);
  }
}

const sameMarks = (a, b) => ORDER.every(k => (a[k] ?? null) === (b[k] ?? null));
// the edge of a run borders a tag or a code span, never a space
const isSpace = ch => ch !== undefined && /\s/.test(ch);

// Escape what the renderer would otherwise read as formatting. A backslash at
// the end of a run is escaped too: whatever follows it — a tag, a code span —
// must not be swallowed by it. On a line that contains a link every bracket is
// escaped, so a literal "[" or "]" cannot shift where the link starts or ends.
function escapeText(s, linkLine = false) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], prev = s[i - 1], next = s[i + 1];
    if (c === '\\' && (next === undefined || '\\`*_{}[]()#+-.!~|<>&"\''.includes(next))) out += '\\\\';
    else if (linkLine && (c === '[' || c === ']')) out += '\\' + c;
    else if (c === '`') out += '\\`';
    else if (c === '*' && !(isSpace(prev) && isSpace(next))) out += '\\*';
    else if (c === '~' && (prev === '~' || next === '~')) out += '\\~';
    else if (c === '<' && /^\/?(b|i|u|s|span)\b/i.test(s.slice(i + 1))) out += '\\<';
    else if (c === ']' && next === '(') out += '\\]';
    else out += c;
  }
  return out;
}

// Text at the very start of a paragraph line must not look like a heading, a
// list item, a quote or a rule.
function escapeLineStart(s) {
  if (/^#{1,6}(\s|$)/.test(s) || /^>/.test(s) || /^[-+*]\s/.test(s)) return '\\' + s;
  if (/^(-{3,}|_{3,})\s*$/.test(s)) return '\\' + s;
  const m = s.match(/^(\d+)([.)])(\s)/);
  if (m) return `${m[1]}\\${s.slice(m[1].length)}`;
  return s;
}

function inlineLines(nodes, ctx, paragraph = false, marks = {}) {
  const segs = [];
  collect(nodes, marks, segs, ctx);
  const lines = [[]];
  for (const s of segs) {
    if (s.br) lines.push([]);
    else lines[lines.length - 1].push(s);
  }
  return lines.map(line => writeLine(line, paragraph));
}

function writeLine(segs, paragraph) {
  // merge neighbours with the same marks; trim the line's outer whitespace
  const merged = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && s.text !== undefined && last.text !== undefined && sameMarks(last.marks, s.marks)) last.text += s.text;
    else merged.push({ ...s });
  }
  // as HTML does: a run of spaces is one space, however many elements it came from
  for (const s of merged) if (s.text !== undefined) s.text = s.text.replace(/ {2,}/g, ' ');
  while (merged.length && merged[0].text !== undefined && !(merged[0].text = merged[0].text.replace(/^\s+/, ''))) merged.shift();
  while (merged.length) {
    const last = merged[merged.length - 1];
    if (last.text === undefined || (last.text = last.text.replace(/\s+$/, ''))) break;
    merged.pop();
  }

  let out = '';
  let open = [];
  const linkLine = merged.some(s => s.marks.a);
  // which tags to close and open to get from the current stack to `marks`
  const plan = marks => {
    const want = ORDER.filter(k => marks[k]).map(k => ({ k, v: marks[k] }));
    let keep = 0;
    while (keep < open.length && keep < want.length && open[keep].k === want[keep].k && open[keep].v === want[keep].v) keep++;
    let pre = '';
    for (let x = open.length - 1; x >= keep; x--) pre += CLOSE[open[x].k](open[x].v);
    for (const w of want.slice(keep)) pre += OPEN[w.k](w.v);
    return { pre, stack: [...open.slice(0, keep), ...want.slice(keep)] };
  };

  merged.forEach((s, idx) => {
    let step = plan(s.marks);
    // A link whose text is its own address is written as the bare address,
    // which the renderer links again — but only where it will: on its own,
    // after a space, "(" or a tag, and not running straight into more text.
    let bare = false;
    const href = s.marks.a;
    if (href && s.text !== undefined
      && (s.text === href || (/^www\./i.test(s.text) && 'https://' + s.text === href))
      && merged[idx - 1]?.marks?.a !== href && merged[idx + 1]?.marks?.a !== href) {
      const next = merged[idx + 1];
      const without = { ...s.marks, a: undefined };
      const glued = next && next.text !== undefined && sameMarks(next.marks, without) && /^\S/.test(next.text);
      const alt = plan(without);
      if (!glued && /(^|[\s(>])$/.test(out + alt.pre)) { step = alt; bare = true; }
    }
    out += step.pre;
    open = step.stack;

    let piece;
    if (s.code !== undefined) piece = s.code.includes('`') ? escapeText(s.code, linkLine) : '`' + s.code + '`';
    else piece = bare ? s.text : escapeText(s.text, linkLine);
    if (idx === 0 && paragraph && !open.length && s.text !== undefined) piece = escapeLineStart(piece);
    out += piece;
  });
  for (let x = open.length - 1; x >= 0; x--) out += CLOSE[open[x].k](open[x].v);
  return out;
}
