// tests/minidom.js — just enough of an HTML parser to feed htmlToMarkdown in
// Node: elements, attributes, text, entities, void tags, comments. It expects
// well-formed input (what the renderer and the tests produce); it is not a
// browser.

const VOID = new Set(['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK', 'WBR']);
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] !== '#') return NAMED[e.toLowerCase()] ?? m;
  return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
});

class Node {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.nodeValue = null;
    this.childNodes = [];
    this.attrs = {};
  }
  getAttribute(name) { return this.attrs[name.toLowerCase()] ?? null; }
}

export function parseHTML(html) {
  const root = new Node(1, 'BODY');
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      const name = m[1].toUpperCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].nodeName === name) { stack.length = i; break; }
    } else if (m[2]) {
      const el = new Node(1, m[2].toUpperCase());
      for (const a of m[3].matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        el.attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
      }
      top.childNodes.push(el);
      if (!VOID.has(el.nodeName) && !m[4]) stack.push(el);
    } else if (m[5]) {
      const text = new Node(3, '#text');
      text.nodeValue = decode(m[5]);
      top.childNodes.push(text);
    }
  }
  return root;
}
