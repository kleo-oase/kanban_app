// tests/lib.js — a few lines of test harness instead of a dependency.
//
// The app modules expect a browser; the parts the tests touch only need
// localStorage and a clock, so both are faked here. Import this module before
// any app module.

const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.location = { search: '', pathname: '/', hash: '', href: '', reload() {} };
globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.navigator = { languages: ['en'] };

// A settable "now": `new Date()` and `Date.now()` follow setToday(), every
// other use of Date behaves normally.
const RealDate = Date;
let fixedNow = null;
class FakeDate extends RealDate {
  constructor(...args) {
    if (args.length === 0 && fixedNow !== null) super(fixedNow);
    else super(...args);
  }
  static now() { return fixedNow ?? RealDate.now(); }
}
globalThis.Date = FakeDate;

export function setToday(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  fixedNow = new RealDate(y, m - 1, d, 12, 0, 0).getTime();
}

// ---------- assertions ----------

export const tally = { pass: 0, fail: 0 };
let section = '';

export function describe(name) { section = name; }

export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { tally.pass++; return; }
  tally.fail++;
  console.log(`✗ ${section} › ${msg}\n    got      ${a}\n    expected ${b}`);
}

export const sorted = o => Object.fromEntries(Object.entries(o).sort());
