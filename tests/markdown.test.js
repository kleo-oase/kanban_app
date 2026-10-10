// The notes format: Markdown -> HTML (rendering) and HTML -> Markdown (saving
// what the editor shows). The guarantee that matters: whatever the renderer
// produces, the serializer turns back into the same Markdown.
import { describe, eq } from './lib.js';
import { parseHTML } from './minidom.js';
import { renderMarkdown, htmlToMarkdown, stripFormatting, colorToHex } from '../js/markdown.js';

const toMd = (html, opts) => htmlToMarkdown(parseHTML(html), opts);
const roundTrip = md => toMd(renderMarkdown(md));

describe('rendering: the formatting tags');
eq(renderMarkdown('<b>x</b> <i>y</i> <u>z</u> <s>w</s>'), '<p><b>x</b> <i>y</i> <u>z</u> <s>w</s></p>', 'b, i, u, s');
eq(renderMarkdown('<span style="color:#D64545">rot</span>'), '<p><span style="color:#d64545">rot</span></p>', 'colour span, normalised');
eq(renderMarkdown('<B>laut</B>'), '<p><b>laut</b></p>', 'tag names are case-insensitive');
eq(renderMarkdown('<b>*kursiv in fett*</b>'), '<p><b><em>kursiv in fett</em></b></p>', 'classic *italic* inside a tag');
eq(renderMarkdown('**fett** und *kursiv* und ~~weg~~'),
  '<p><strong>fett</strong> und <em>kursiv</em> und <del>weg</del></p>', 'classic Markdown emphasis still works');
eq(renderMarkdown('[<b>fett</b>](https://x.de)'),
  '<p><a href="https://x.de" target="_blank" rel="noopener"><b>fett</b></a></p>', 'formatting inside link text');
eq(renderMarkdown('https://x.de/?a=1&b=2'),
  '<p><a href="https://x.de/?a=1&amp;b=2" target="_blank" rel="noopener">https://x.de/?a=1&amp;b=2</a></p>',
  'an & in a bare URL is escaped once, not twice');

describe('rendering: nothing else gets through');
for (const evil of [
  '<b onclick="alert(1)">x</b>',
  '<span style="color:red">x</span>',
  '<span style="color:#d64545;background:url(javascript:alert(1))">x</span>',
  '<span style="color:#d64545" onmouseover="alert(1)">x</span>',
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '<a href="javascript:alert(1)">x</a>',
]) {
  const html = renderMarkdown(evil);
  eq(/<(?!\/?(p|b|i|u|s|span|a|code|br)\b)|on\w+=|javascript:|url\(/i.test(html.replace(/&lt;[^]*?&gt;/g, '')), false,
    `inert: ${evil}`);
}
eq(/javascript:/i.test(renderMarkdown('[l](JaVaScRiPt:alert(1))')), false, 'no javascript: links');
eq(renderMarkdown('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>', 'script stays text');

describe('rendering: backslash escapes');
eq(renderMarkdown('\\*\\*nicht fett\\*\\*'), '<p>**nicht fett**</p>', 'escaped asterisks');
eq(renderMarkdown('5 * 3 * 2 und ** x **'), '<p>5 * 3 * 2 und ** x **</p>', 'stars with spaces inside are not emphasis');
eq(renderMarkdown('\\<b> getippt'), '<p>&lt;b&gt; getippt</p>', 'an escaped tag stays text');
eq(renderMarkdown('\\# kein Titel'), '<p># kein Titel</p>', 'escaped heading marker');
eq(renderMarkdown('1\\. kein Punkt'), '<p>1. kein Punkt</p>', 'escaped list number');
eq(renderMarkdown('\\`kein Code\\`'), '<p>`kein Code`</p>', 'escaped backticks open no code span');
eq(renderMarkdown('`a\\*b`'), '<p><code>a\\*b</code></p>', 'no unescaping inside code');

describe('round trip: render, then serialize, gives the same Markdown');
const docs = {
  'formatting':
    'Ein <b>fetter</b> und <i>kursiver</i> Satz mit <u>Strich</u>, <s>alt</s> und <span style="color:#d64545">Rot</span>.',
  'nesting': '<span style="color:#3b71f3"><b>blau fett <i>und kursiv</i></b></span> danach',
  'headings, lists, quote, rule':
    '# Titel\n\n## Unter\n\n### Klein\n\n- eins\n- <b>zwei</b>\n\n1. a\n2. b\n\n> Zitat\n> zweite Zeile\n\n---\n\nEnde',
  'quote with a gap': '> a\n>\n> b',
  'links': '[Link](https://example.org) und https://example.org/x und www.example.org',
  'link with formatting': '[<b>fett</b> verlinkt](mailto:a@b.de)',
  'lines in a paragraph': 'Zeile 1\nZeile 2\n\nNeuer Absatz',
  'code': 'Mit `x*y` drin\n\n```\ncode *raw* <b>\n  eingerückt\n```',
  'escapes': 'Stern\\*chen, \\<b> getippt, \\` und 5 * 3\n\n\\- kein Punkt\n\n1\\. keine Liste\n\n\\# kein Titel\n\n\\> kein Zitat\n\n\\---',
  'legacy note': 'Angebote:\n\n- Modell A — 480 €\n- Modell B — 620 €, mit Wartungsvertrag',
};
for (const [name, md] of Object.entries(docs)) eq(roundTrip(md), md, name);

describe('serializing what a browser editor produces');
eq(toMd('<div>Hallo <b>Welt</b></div><div><br></div><div>neu</div>'), 'Hallo <b>Welt</b>\n\nneu', 'div paragraphs, empty ones dropped');
eq(toMd('Text direkt<br>zweite Zeile'), 'Text direkt\nzweite Zeile', 'loose text at the top level');
eq(toMd('<p>a&nbsp; &nbsp;b&nbsp;</p>'), 'a b', 'non-breaking spaces become one space, as HTML shows them');
eq(toMd('<p><span style="font-weight: bold;">x</span> <span style="font-style:italic">y</span></p>'), '<b>x</b> <i>y</i>', 'CSS bold and italic');
eq(toMd('<b style="font-weight:normal;" id="docs-internal-guid-1"><span style="font-weight:700;">fett</span><span style="font-weight:400;"> normal</span></b>'),
  '<b>fett</b> normal', 'Google Docs wrapper with font-weight:normal');
eq(toMd('<p><span style="text-decoration: underline line-through;">x</span></p>'), '<u><s>x</s></u>', 'CSS decorations');
eq(toMd('<u><span style="text-decoration:none">x</span></u>'), '<u>x</u>', 'a decoration cannot be switched off by a child');
eq(toMd('<i style="font-style:normal">x</i>'), 'x', 'font-style:normal cancels italic');
eq(toMd('<font color="#d64545">rot</font> <span style="color: rgb(214, 69, 69);">auch</span>'),
  '<span style="color:#d64545">rot</span> <span style="color:#d64545">auch</span>', 'font colour and rgb() colour are the same colour');
eq(toMd('<font color="#d64545">a<font color="#010203">b</font>c</font>'),
  '<span style="color:#d64545">a</span>b<span style="color:#d64545">c</span>', '"default colour" ends the colour');
eq(toMd('<span style="color:#222222">x</span>'), '<span style="color:#222222">x</span>', 'any colour the note already had is kept');
eq(toMd('<span style="color: rgb(34, 34, 34)">schwarz</span> <span style="color:#27895a">grün</span>', { paste: true }),
  'schwarz <span style="color:#27895a">grün</span>', 'pasted colours outside the palette are dropped');
eq(toMd('<h2>Titel<br></h2><ul><li>a<ul><li>b</li></ul></li><li><p>c</p></li></ul>'), '## Titel\n\n- a\n- b\n- c', 'heading, nested lists flattened');
eq(toMd('<blockquote><p>a</p><p>b</p></blockquote>'), '> a\n>\n> b', 'quote with paragraphs');
eq(toMd('<b style="font-weight:normal;"><p><span style="font-weight:700">Wichtig:</span> Text</p><ul><li>A</li><li>B</li></ul></b>', { paste: true }),
  '<b>Wichtig:</b> Text\n\n- A\n- B', 'blocks inside an inline wrapper (Google Docs) keep their structure');
eq(toMd('<span style="color:#d64545"><p>rot</p><ul><li>auch rot</li></ul></span>'),
  '<span style="color:#d64545">rot</span>\n\n- <span style="color:#d64545">auch rot</span>', 'a wrapper passes its formatting down');
eq(toMd('<p style="font-weight:bold">ganz fett</p>'), '<b>ganz fett</b>', 'formatting on the block itself');
eq(toMd('<p><code>x*y</code></p><pre><code>a\n  b\n</code></pre>'), '`x*y`\n\n```\na\n  b\n```', 'code');
eq(toMd('<a href="javascript:alert(1)">x</a> <a href="/relativ">y</a>'), 'x y', 'unsafe or relative links lose the link, keep the text');
eq(toMd('<a href="https://a.b/?x=1&amp;y=2">hier</a>'), '[hier](https://a.b/?x=1&y=2)', 'link with a query string');
eq(toMd('siehe:<a href="https://x.de">https://x.de</a>'), 'siehe:[https://x.de](https://x.de)', 'a URL glued to text keeps its link syntax');
eq(toMd('<script>alert(1)</script><style>p{}</style><p>ok</p>'), 'ok', 'scripts and styles are dropped');
eq(toMd('<table><tr><td>a</td><td>b</td></tr></table>'), 'a\n\nb', 'table cells become paragraphs');
eq(toMd('<p>**nicht fett** und &lt;b&gt;</p>'), '\\*\\*nicht fett\\*\\* und \\<b>', 'typed markup characters are escaped');
eq(renderMarkdown(toMd('<p>**nicht fett** und &lt;b&gt;</p>')), '<p>**nicht fett** und &lt;b&gt;</p>', '…and render as typed');
eq(toMd('<p>- kein Punkt</p><p>1. keine Liste</p><p># kein Titel</p>'), '\\- kein Punkt\n\n1\\. keine Liste\n\n\\# kein Titel',
  'text that looks like block syntax');
eq(toMd('<p><b>- fett</b></p>'), '<b>- fett</b>', 'no escape needed behind a tag');

describe('helpers');
eq([colorToHex('#ABC'), colorToHex('rgb(214, 69, 69)'), colorToHex('rgba(0,0,0,0)'), colorToHex('red')],
  ['#aabbcc', '#d64545', null, null], 'colorToHex');
eq(stripFormatting('<b>Fett</b> <span style="color:#d64545">rot</span>'), 'Fett rot', 'search sees the words, not the tags');
