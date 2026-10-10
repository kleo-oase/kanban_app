// Seeded fuzzing of the notes format. Random notes — nested formatting, line
// breaks, links, code and every character the format treats specially — go
// through "serialize, render, serialize". The Markdown must come out the same
// (nothing drifts on repeated saves), and every visible character must keep its
// formatting (nothing is lost or changed in the round trip).
import { describe, eq } from './lib.js';
import { parseHTML } from './minidom.js';
import { renderMarkdown, htmlToMarkdown } from '../js/markdown.js';

let seed = 20261010;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];

const WORDS = ['Wort', 'Text', 'ä', 'ß', '5', ' ', ' ', '  ', '*', '**', '~', '~~', '`', '[', ']', '(', ')', '](',
  '<', '>', '<b>', '</span>', '#', '- ', '1.', '\\', '\\*', '&', '&amp;', '"', "'", '_', '.', '!', '|', 'x*y', '3 * 4'];
const COLORS = ['#d64545', '#27895a', '#3b71f3', '#7a8499'];
const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// (links never contain links: browsers split nested anchors while parsing)
function inline(depth, inLink = false) {
  let out = '';
  const n = 1 + Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) {
    const r = rnd();
    if (depth < 3 && r < 0.45) {
      const kind = pick(inLink ? ['b', 'i', 'u', 's', 'color', 'strong', 'em'] : ['b', 'i', 'u', 's', 'color', 'link', 'strong', 'em']);
      const body = inline(depth + 1, inLink || kind === 'link');
      if (kind === 'color') out += `<span style="color:${pick(COLORS)}">${body}</span>`;
      else if (kind === 'link') out += `<a href="https://example.org/${Math.floor(rnd() * 9)}">${body}</a>`;
      else out += `<${kind}>${body}</${kind}>`;
    } else if (r < 0.52) {
      out += `<code>${escHtml(pick(['a*b', 'x', '<b>', 'c d']))}</code>`;
    } else if (r < 0.58 && depth === 0) {
      out += '<br>';
    } else {
      out += escHtml(pick(WORDS) + pick(WORDS));
    }
  }
  return out;
}

function note() {
  const blocks = [];
  const n = 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const r = rnd();
    if (r < 0.6) blocks.push(`<p>${inline(0)}</p>`);
    else if (r < 0.7) blocks.push(`<h${1 + Math.floor(rnd() * 3)}>${inline(1)}</h2>`.replace(/<\/h2>$/, m => m));
    else if (r < 0.85) blocks.push(`<ul>${[0, 1].map(() => `<li>${inline(1)}</li>`).join('')}</ul>`);
    else blocks.push(`<blockquote>${inline(0)}</blockquote>`);
  }
  // headings were opened as h1-h3 above; close them with the matching tag
  return blocks.map(b => b.replace(/^<h(\d)>([\s\S]*)<\/h2>$/, (_, d, body) => `<h${d}>${body}</h${d}>`)).join('');
}

// visible characters with the formatting they carry, ignoring whitespace
function signature(root) {
  const out = [];
  const walk = (node, marks) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        for (const ch of n.nodeValue) if (!/\s/.test(ch)) out.push(ch + '|' + [...marks].sort().join(','));
        continue;
      }
      if (n.nodeType !== 1) continue;
      const m = new Set(marks);
      const tag = n.nodeName;
      if (tag === 'B' || tag === 'STRONG') m.add('b');
      if (tag === 'I' || tag === 'EM') m.add('i');
      if (tag === 'U') m.add('u');
      if (tag === 'S' || tag === 'DEL') m.add('s');
      if (tag === 'CODE') m.add('code');
      if (tag === 'A') m.add('a=' + n.getAttribute('href'));
      if (tag === 'SPAN') { for (const x of [...m]) if (x.startsWith('c=')) m.delete(x); m.add('c=' + (n.getAttribute('style') || '').replace(/^color:/, '')); }
      if (/^H\d$/.test(tag)) m.add(tag.toLowerCase());
      if (tag === 'LI') m.add('li');
      if (tag === 'BLOCKQUOTE') m.add('quote');
      walk(n, m);
    }
  };
  walk(root, new Set());
  return out.join(' ');
}

describe('fuzz: random notes survive save and reload');
let drift = 0, lost = 0;
const CASES = 600;
for (let c = 0; c < CASES; c++) {
  const html = note();
  const md1 = htmlToMarkdown(parseHTML(html));
  const html2 = renderMarkdown(md1);
  const md2 = htmlToMarkdown(parseHTML(html2));
  if (md2 !== md1) {
    if (drift++ < 3) console.log(`  drift #${c}\n    html ${html}\n    md1  ${JSON.stringify(md1)}\n    md2  ${JSON.stringify(md2)}`);
  }
  const a = signature(parseHTML(html)).split(' '), b = signature(parseHTML(html2)).split(' ');
  const at = a.findIndex((x, k) => x !== b[k]);
  if (at !== -1 || a.length !== b.length) {
    const k = at === -1 ? Math.min(a.length, b.length) : at;
    if (lost++ < 4) console.log(`  changed #${c} at char ${k}\n    md    ${JSON.stringify(md1)}\n    html2 ${JSON.stringify(html2)}\n    want  ${a.slice(Math.max(0, k - 3), k + 4).join('  ')}\n    got   ${b.slice(Math.max(0, k - 3), k + 4).join('  ')}`);
  }
}
eq(drift, 0, `Markdown is stable on re-save (${CASES} random notes)`);
eq(lost, 0, `every character keeps its formatting (${CASES} random notes)`);
