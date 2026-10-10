// What the board and the calendar show: one entry per card *and date*.
// The clock is fixed to Saturday 10 Oct 2026, so "this week" is Mon 5 – Sun 11.
import { describe, eq, setToday } from './lib.js';
import { reset, store } from './fixtures.js';
import * as Q from '../js/query.js';

setToday('2026-10-10');

const entries = id => Q.boardEntriesOf(store.cards[id]).map(e => [e.list, e.date, e.done]);
const column = id => (Q.boardColumns().get(id) || []).map(e => `${e.card.id}@${e.date}${e.done ? '✓' : ''}`);

// The live board's real weekly to-do, ticked by nobody yet.
const WOCHENPLAN = {
  title: 'Wochenpläne neu erstellen/aufhängen', date: '2026-08-03', repeat: 'weekly',
  until: '2027-03-08', urgency: 'today',
};

describe('a weekly to-do shows this week’s iteration with its own date');
reset({ w: WOCHENPLAN });
eq(entries('w'), [['mon', '2026-10-05', false]], 'Monday column, dated 5 Oct — not the first iteration (3 Aug)');
eq(Q.dueStatus(Q.boardEntriesOf(store.cards.w)[0]), 'overdue', 'missed this Monday: red');
store.toggleDone('w', '2026-10-05');
eq(entries('w'), [['mon', '2026-10-05', true]], 'ticked: stays visible, struck through, until Sunday');
eq(Q.dueStatus(Q.boardEntriesOf(store.cards.w)[0]), '', 'a ticked iteration is never coloured');
setToday('2026-10-12');
eq(entries('w'), [['mon', '2026-10-12', false]], 'next Monday: a fresh, open iteration');
eq(Q.dueStatus(Q.boardEntriesOf(store.cards.w)[0]), 'today', 'due today: yellow');
setToday('2026-10-10');

describe('a daily to-do is seven iterations, ticked one by one');
reset({ d: { title: 'Medikamente stellen', date: '2026-09-01', repeat: 'daily' } });
eq(entries('d').map(e => e[0]), ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 'one chip per weekday');
eq(entries('d').map(e => e[1]), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'],
  'each chip carries its own date');
store.toggleDone('d', '2026-10-07');
eq(entries('d').filter(e => e[2]).map(e => e[0]), ['wed'], 'ticking Wednesday ticks only Wednesday');
eq(Q.boardEntriesOf(store.cards.d).map(Q.dueStatus),
  ['overdue', 'overdue', '', 'overdue', 'overdue', 'today', ''], 'colours per iteration');

describe('repetitions without an iteration this week');
reset({
  s: { title: 'Supervision', type: 'date', date: '2026-08-11', repeat: 'biweekly', until: '2026-12-22' },
  m: { title: 'Miete', date: '2026-09-15', repeat: 'monthly' },
  e: { title: 'Vorbei', date: '2026-08-03', repeat: 'weekly', until: '2026-09-20' },
  f: { title: 'Ab November', date: '2026-11-02', repeat: 'weekly' },
  k: { title: 'Weekdays', date: '2026-09-01', repeat: 'weekdays' },
});
eq(entries('s'), [['tue', '2026-10-06', false]], 'fortnightly, on this week: this week’s');
setToday('2026-10-14');
eq(entries('s'), [['tue', '2026-10-20', false]], 'fortnightly, off week: the next one');
setToday('2026-10-10');
eq(entries('m'), [['thu', '2026-10-15', false]], 'monthly: the next iteration, in its weekday');
eq(entries('e'), [['mon', '2026-09-14', false]], 'ended series: its last iteration, so it does not vanish');
eq(entries('f'), [['mon', '2026-11-02', false]], 'not started yet: its first iteration');
eq(entries('k').map(e => e[0]), ['mon', 'tue', 'wed', 'thu', 'fri'], 'weekdays: Monday to Friday');

describe('one-off and undated cards are unchanged');
reset({
  x: { title: 'Weihnachten', date: '2026-12-24' },
  u: { title: 'Irgendwann', list: 'l-backlog' },
});
eq(entries('x'), [['thu', '2026-12-24', false]], 'a one-off card sits in its weekday, whatever the week');
eq(entries('u'), [['l-backlog', null, false]], 'an undated card sits in its list');

describe('filters work per iteration');
reset({
  d: { title: 'Täglich', date: '2026-09-01', repeat: 'daily', doneOn: ['2026-10-07'] },
  t: { title: 'Termin gestern', type: 'date', date: '2026-10-09' },
});
store.setView({ range: 'today' });
eq(Q.visibleBoardEntries().map(e => `${e.card.id}@${e.date}`), ['d@2026-10-10'], '"today" keeps only today’s iteration');
store.setView({ range: 'all', hideDone: true });
eq(column('wed'), [], '"hide completed" hides the ticked Wednesday only');
eq(column('thu'), ['d@2026-10-08'], '…and keeps Thursday');
store.setView({ hideDone: false, range: 'overdue' });
eq(Q.visibleBoardEntries().map(e => e.date), ['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'],
  '"overdue" = past, unticked to-do iterations; appointments never count');
store.setView({ range: 'all' });
eq(Q.counts(), { total: 2, shown: 2 }, 'the search count counts cards, not chips');

describe('sorting and the calendar');
reset({
  a: { title: 'A', date: '2026-10-05' },
  w: { title: 'W', date: '2026-08-03', repeat: 'weekly', doneOn: ['2026-10-05'] },
});
eq(column('mon'), ['a@2026-10-05', 'w@2026-10-05✓'], 'a ticked iteration sinks below open ones');
store.setView({ calAllTypes: true });
eq(Q.entriesForDate('2026-10-05').map(e => [e.card.id, e.done]), [['a', false], ['w', true]], 'calendar: ticked on 5 Oct');
eq(Q.entriesForDate('2026-10-12').map(e => [e.card.id, e.done]), [['w', false]], 'calendar: open on 12 Oct');
eq(Q.entriesForDate('2026-10-06').length, 0, 'calendar: nothing on a day without an iteration');
