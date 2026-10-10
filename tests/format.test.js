// The file formats and the date maths — everything in js/util.js.
import { describe, eq, sorted, setToday } from './lib.js';
import * as U from '../js/util.js';

setToday('2026-10-10');

describe('dates');
eq(U.weekdayIndex('2026-08-03'), 0, 'Monday is 0');
eq(U.startOfWeek('2026-10-11'), '2026-10-05', 'start of week from a Sunday');
eq(U.addMonths('2026-01-31', 1), '2026-02-28', 'addMonths clamps to the month end');
eq(U.addMonths('2024-01-31', 1), '2024-02-29', 'addMonths knows leap years');
eq([U.isoWeek('2026-01-01'), U.isoWeek('2021-01-01'), U.isoWeek('2026-12-31')], [1, 53, 53], 'ISO week numbers');
eq(U.todayStr(), '2026-10-10', 'the test clock works');

describe('recurrence');
const weekly = { date: '2026-08-03', repeat: 'weekly' };
eq(U.occurrences(weekly, '2026-09-01', '2026-09-30'),
  ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'], 'weekly, fast-forwarded into the window');
eq(U.occurrences({ date: '2026-01-31', repeat: 'monthly' }, '2026-05-01', '2026-07-31'),
  ['2026-05-31', '2026-06-30', '2026-07-31'], 'monthly keeps the anchor day');
eq(U.occurrences({ date: '2026-10-05', repeat: 'weekdays' }, '2026-10-05', '2026-10-11'),
  ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'], 'weekdays skip the weekend');
eq(U.nextOccurrence({ date: '2026-10-10', repeat: 'weekdays' }, '2026-10-10'), '2026-10-12',
  'a weekdays series anchored on a Saturday starts on Monday');
eq(U.nextOccurrence({ ...weekly, until: '2026-10-01' }, '2026-10-10'), null, 'an ended series has no next date');
eq(U.lastOccurrence({ ...weekly, until: '2026-10-01' }, '2026-10-10'), '2026-09-28', 'last iteration of an ended series');
eq(U.lastOccurrence({ date: '2026-11-01', repeat: 'daily' }, '2026-10-10'), null, 'a series that has not started has no last one');
eq([U.isOccurrence(weekly, '2026-10-05'), U.isOccurrence(weekly, '2026-10-06')], [true, false], 'isOccurrence');

describe('end time');
const appt = U.parseCardFile('data/cards/a.md',
  '---\ntitle: Arzt\ntype: date\ndate: 2026-10-12\ntime: "09:30"\nend: "10:15"\n---\n');
eq([appt.time, appt.end], ['09:30', '10:15'], 'start and end parsed');
eq(U.serializeCard(appt), '---\ntitle: Arzt\ntype: date\ndate: 2026-10-12\ntime: "09:30"\nend: "10:15"\n---\n',
  'end time round-trips right after the start');
eq(U.timeRange(appt), '09:30–10:15', 'timeRange shows the span');
eq(U.timeRange({ time: '09:30', end: null }), '09:30', 'timeRange without an end');
eq(U.parseCardFile('a/b.md', '---\ntitle: X\ntype: date\ndate: 2026-10-12\nend: "10:15"\n---\n').end, null,
  'an end without a start is dropped');
eq(U.parseCardFile('a/b.md', '---\ntitle: X\ntype: date\ndate: 2026-10-12\ntime: "10:00"\nend: "09:00"\n---\n').end, null,
  'an end before the start is dropped');
eq(U.normalizeCard({ type: 'info', date: '2026-10-12', time: '09:00', end: '10:00', list: 'l-x' }).end, null,
  'info cards have no end time either');

describe('per-iteration ticks');
const series = U.parseCardFile('data/cards/w.md',
  '---\ntitle: Wochenplan\ntype: todo\ndate: 2026-08-03\nrepeat: weekly\n'
  + 'done_on: [2026-10-05, "2026-09-28", 2026-10-05, nonsense]\n---\n');
eq(series.doneOn, ['2026-09-28', '2026-10-05'], 'done_on parsed sorted, unique, valid dates only');
eq([U.isDoneOn(series, '2026-10-05'), U.isDoneOn(series, '2026-10-12')], [true, false],
  'ticking one iteration leaves the next one open');
eq(U.serializeCard(series),
  '---\ntitle: Wochenplan\ntype: todo\ndate: 2026-08-03\nrepeat: weekly\ndone_on: [2026-09-28, 2026-10-05]\n---\n',
  'done_on is written as one sorted list');
eq(U.serializeCard(U.parseCardFile('a/b.md', U.serializeCard(series))), U.serializeCard(series),
  'a ticked series round-trips byte-identically');

const legacy = U.parseCardFile('a/b.md', '---\ntitle: X\ntype: todo\ndate: 2026-08-03\nrepeat: weekly\ndone: true\n---\n');
eq([legacy.done, legacy.doneOn], [false, []], 'the old all-or-nothing `done: true` on a series is not carried over');
const single = U.parseCardFile('a/b.md', '---\ntitle: X\ntype: todo\ndate: 2026-10-05\ndone: true\ndone_on: [2026-10-05]\n---\n');
eq([single.done, single.doneOn], [true, []], 'a one-off to-do keeps `done` and ignores done_on');
eq(U.isDoneOn(single, '2099-01-01'), true, 'a one-off to-do is done whatever date is asked');
eq(U.isDoneOn({ type: 'date', repeat: 'weekly', doneOn: ['2026-10-05'] }, '2026-10-05'), false,
  'only to-dos can be ticked');
eq(U.serializeCard({ title: 'T', type: 'todo', date: '2026-10-05', repeat: 'weekly', doneOn: [] }).includes('done'), false,
  'an unticked series writes no done key at all');

describe('info cards');
const info = U.parseCardFile('data/cards/n.md',
  '---\ntitle: Notiz\ntype: info\ndate: 2026-08-05\ntime: "09:30"\nurgency: today\nrepeat: weekly\nlist: l-backlog\npinned: true\n---\n');
eq([info.date, info.time, info.urgency, info.repeat, info.list, info.pinned],
  [null, null, null, null, 'l-backlog', true], 'no schedule, keeps list and pin');
eq(sorted(U.normalizeCard({ type: 'todo', date: '2026-08-05', list: 'l-x', pinned: true, done: true })),
  sorted({ type: 'todo', date: '2026-08-05', list: null, pinned: false, done: true, until: null, doneOn: [], end: null }),
  'a dated to-do drops its list and cannot be pinned');

describe('archive, colours, config');
const arc = '---\ntitle: Alt\ntype: todo\ndate: 2026-05-01\narchived: 2026-06-02T09:20:00Z\ncreated: 2026-04-01T08:00:00Z\nauthor: Anna\n---\n';
eq(U.serializeCard(U.parseCardFile('data/cards/x.md', arc)), arc, 'archived card round-trips byte-identically');
const cfg = U.parseConfig('lists:\n  - id: mon\n    color: "#E05252"\n  - id: l-backlog\n    name: Backlog\n  - id: l-bad\n    name: Bad\n    color: nope\n');
eq([cfg.lists.find(l => l.id === 'mon').color, cfg.lists.find(l => l.id === 'l-bad').color], ['#e05252', ''],
  'list colours: valid ones lowercased, invalid ignored');
eq(cfg.lists.length, 9, 'missing weekday columns are restored');
eq(U.parseConfig(U.serializeConfig(cfg)), cfg, 'config round-trips');

describe('unchanged guarantees');
const full = `---
title: "Angebot: Müller"
type: todo
date: 2026-08-05
time: "09:30"
end: "11:00"
urgency: today
client: Schmidt & Co.
done: true
created: 2026-08-02T08:11:00Z
author: Anna
---

Free **text** here.
`;
eq(U.serializeCard(U.parseCardFile('a/b.md', full)), full, 'a full one-off card round-trips byte-identically');
eq(U.slugify('Müller & Co. — Angebot!'), 'muller-co-angebot', 'slugify');
