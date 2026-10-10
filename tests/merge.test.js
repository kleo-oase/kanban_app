// The three-way merge that runs before every save (store._mergeIntoDraft).
import { describe, eq, setToday } from './lib.js';
import { reset, snapshot, store } from './fixtures.js';
import * as U from '../js/util.js';

setToday('2026-10-10');

describe('merge: cards');
reset({ a: { title: 'A' }, b: { title: 'B' } });
store.updateCard('a', { title: 'A local' });
let rep = store._mergeIntoDraft(snapshot('sha1', { a: { title: 'A' }, b: { title: 'B remote' } }));
eq([store.cards.a.title, store.cards.b.title, rep.conflicts], ['A local', 'B remote', []], 'independent edits both survive');

reset({ a: { title: 'A' } });
store.updateCard('a', { title: 'mine' });
rep = store._mergeIntoDraft(snapshot('sha1', { a: { title: 'theirs' } }));
eq([store.cards.a.title, rep.conflicts.length], ['mine', 1], 'same field: local wins and is reported');

reset({ a: { title: 'A', date: '2026-10-12', time: '09:00' } });
store.updateCard('a', { end: '10:00' });
store._mergeIntoDraft(snapshot('sha1', { a: { title: 'A', date: '2026-10-12', time: '09:00', client: 'Acme' } }));
eq([store.cards.a.end, store.cards.a.client], ['10:00', 'Acme'], 'a local end time and a remote client both survive');

reset({ a: { title: 'A' }, b: { title: 'B' } });
store.updateCard('b', { title: 'B edited' });
rep = store._mergeIntoDraft(snapshot('sha1', { a: { title: 'A' } }));
eq([store.cards.b.title, rep.conflicts.length], ['B edited', 1], 'an edited card survives a remote deletion');

reset({ a: { title: 'A' }, b: { title: 'B' } });
store.deleteCard('b');
store._mergeIntoDraft(snapshot('sha1', { a: { title: 'A' }, b: { title: 'B' } }));
eq(Object.keys(store.cards), ['a'], 'a local deletion survives an unrelated remote commit');

reset({ a: { title: 'A' } });
store.updateCard('a', { title: 'same' });
store._mergeIntoDraft(snapshot('sha1', { a: { title: 'same' } }));
eq([store.changes().length, store._hasDraft], [0, false], 'an identical outcome clears the draft');

describe('merge: ticks on a series');
const W = { title: 'Wochenplan', date: '2026-08-03', repeat: 'weekly' };
reset({ w: { ...W, doneOn: ['2026-09-28'] } });
store.toggleDone('w', '2026-10-05');                              // Anna ticks this week
rep = store._mergeIntoDraft(snapshot('sha1', { w: { ...W, doneOn: ['2026-09-21', '2026-09-28'] } }));   // Bea ticked an older one
eq([store.cards.w.doneOn, rep.conflicts], [['2026-09-21', '2026-09-28', '2026-10-05'], []],
  'two people ticking different days both keep their tick, no conflict');

reset({ w: { ...W, doneOn: ['2026-09-28', '2026-10-05'] } });
store.toggleDone('w', '2026-10-05');                              // unticked here
store._mergeIntoDraft(snapshot('sha1', { w: { ...W, doneOn: ['2026-09-21', '2026-09-28', '2026-10-05'] } }));
eq(store.cards.w.doneOn, ['2026-09-21', '2026-09-28'], 'an untick survives a remote tick of another day');

reset({ w: { ...W, doneOn: ['2026-10-05'] } });
store.toggleDone('w', '2026-09-28');
store._mergeIntoDraft(snapshot('sha1', { w: { ...W, doneOn: [] } }));   // unticked remotely
eq(store.cards.w.doneOn, ['2026-09-28'], 'a remote untick is adopted');

reset({ w: { ...W } });
store.toggleDone('w', '2026-10-05');
store._mergeIntoDraft(snapshot('sha1', { w: { ...W, doneOn: ['2026-10-05'] } }));
eq([store.cards.w.doneOn, store.changes().length], [['2026-10-05'], 0], 'both ticking the same day is one tick and nothing to save');

reset({ w: { ...W } });
store.toggleDone('w', '2026-10-05');
store._mergeIntoDraft(snapshot('sha1', { w: { ...W, repeat: null } }));   // remote turned it into a one-off
eq([store.cards.w.repeat, store.cards.w.doneOn, store.cards.w.done], [null, [], false],
  'a series turned into a one-off remotely does not keep stray ticks');

describe('merge: config');
reset({}, { employees: ['Anna', 'Bea'], clients: [{ name: 'Acme', color: '#111111' }] });
store.addEmployee('Chris');
store.setClientColor('Acme', '#222222');
store._mergeIntoDraft(snapshot('sha1', {}, {
  employees: ['Anna', 'Bea', 'Dana'],
  clients: [{ name: 'Acme', color: '#111111' }, { name: 'Globex', color: '#333333' }],
}));
eq(store.config.employees, ['Anna', 'Bea', 'Dana', 'Chris'], 'employee additions from both sides');
eq(store.config.clients.map(c => [c.name, c.color]), [['Acme', '#222222'], ['Globex', '#333333']], 'client colours merge');

reset({}, {});
const reordered = [...store.config.lists];
reordered.push(reordered.splice(0, 1)[0]);
store.config.lists = reordered;
store.touch();
store._mergeIntoDraft(snapshot('sha1', {}, {}));
eq(store.config.lists.map(l => l.id), ['tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'l-backlog', 'mon'], 'a local column order wins');

reset({}, { lists: U.defaultLists().map(l => (l.id === 'mon' ? { ...l, color: '#111111' } : l)) });
store.setListColor('mon', '#222222');
store._mergeIntoDraft(snapshot('sha1', {}, {
  lists: U.defaultLists().map(l => (l.id === 'mon' ? { ...l, color: '#111111' } : l.id === 'tue' ? { ...l, color: '#333333' } : l)),
}));
eq([store.listColor('mon'), store.listColor('tue')], ['#222222', '#333333'], 'list colours merge per list');
