// tests/run.js — `npm test` (or `node tests/run.js`). Node 18+, no packages.
import { tally } from './lib.js';

const files = ['format.test.js', 'markdown.test.js', 'fuzz.test.js', 'store.test.js', 'merge.test.js', 'board.test.js'];
for (const f of files) await import(`./${f}`);

console.log(`\n${tally.pass} passed, ${tally.fail} failed`);
process.exit(tally.fail ? 1 : 0);
