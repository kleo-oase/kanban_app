// Store actions: ticking, archive, pinning, list colours, old drafts.
import { describe, eq, setToday } from './lib.js';
import { reset, store } from './fixtures.js';
import * as Q from '../js/query.js';
import * as U from '../js/util.js';

setToday('2026-10-10');

describe('ticking a one-off to-do');
reset({ a: { title: 'A', date: '2026-10-09' } });
store.toggleDone('a', '2026-10-09');
eq([store.cards.a.done, store.cards.a.doneOn], [true, []], 'toggle sets done');
store.toggleDone('a', null);
eq(store.cards.a.done, false, 'and back — the date does not matter for a one-off');

describe('ticking one iteration of a series');
reset({ w: { title: 'Wochenplan', date: '2026-08-03', repeat: 'weekly' } });
store.toggleDone('w', '2026-10-05');
eq(store.cards.w.doneOn, ['2026-10-05'], 'only that date is ticked');
eq([U.isDoneOn(store.cards.w, '2026-10-05'), U.isDoneOn(store.cards.w, '2026-10-12')], [true, false],
  'next week stays open');
store.toggleDone('w', '2026-09-28');
store.toggleDone('w', '2026-10-05');
eq(store.cards.w.doneOn, ['2026-09-28'], 'unticking removes just that date');
eq(store.cards.w.done, false, 'a series never uses the single done flag');
store.setDone('w', null, true);
eq(store.cards.w.doneOn, ['2026-09-28'], 'ticking a series without a date does nothing');
eq(store.changes().map(c => c.path), ['data/cards/w.md'], 'a tick is an ordinary change to save');

describe('turning a series into a one-off and back');
reset({ w: { title: 'W', date: '2026-10-05', repeat: 'weekly', doneOn: ['2026-10-05'] } });
store.updateCard('w', { repeat: null, done: true });
eq([store.cards.w.done, store.cards.w.doneOn], [true, []], 'one-off keeps a plain done flag');
store.updateCard('w', { type: 'date' });
eq([store.cards.w.done, store.cards.w.doneOn], [false, []], 'an appointment carries no tick at all');

describe('drafts from the previous app version');
reset({ a: { title: 'A', date: '2026-10-05', repeat: 'weekly' } });
const oldDraft = {
  baseSha: 'sha0',
  cards: { a: { id: 'a', title: 'A', type: 'todo', date: '2026-10-05', time: null, list: null, urgency: null,
    client: null, repeat: 'weekly', until: null, done: true, pinned: false, archived: null,
    created: null, author: '', body: '' } },
  comments: {},
  config: store.config,
};
store._adopt(oldDraft);
eq([store.cards.a.doneOn, store.cards.a.end, store.cards.a.done], [[], null, false],
  'missing fields are filled and the old series-wide tick is dropped');

describe('archive');
reset({ a: { title: 'A', date: '2026-10-05' }, b: { title: 'B', date: '2026-10-13' } });
store.archiveCard('a');
eq(Q.allCards().map(c => c.id), ['b'], 'archived cards leave the board');
eq(Q.entriesForDate('2026-10-05').length, 0, 'and the calendar');
store.unarchiveCard('a');
eq([store.cards.a.archived, store.cards.a.date], [null, '2026-10-05'], 'reactivation restores the card unchanged');
reset({ a: { title: 'A' }, b: { title: 'B' }, c: { title: 'C' } });
store.addComment('a', 'x', 'Anna');
store.archiveCard('a');
store.archiveCard('c');
eq([store.emptyArchive(), Object.keys(store.cards), Object.keys(store.comments).length], [2, ['b'], 0],
  'emptying the archive deletes exactly the archived cards and their comments');

describe('pinning and list colours');
reset({}, {});
store.newCard({ title: 'Oben', type: 'info', list: 'l-backlog', pinned: true });
store.newCard({ title: 'Aaa', type: 'info', list: 'l-backlog' });
store.setView({ sort: 'title', sortDir: 'desc' });
eq(Q.boardColumns().get('l-backlog').map(e => e.card.title), ['Oben', 'Aaa'], 'a pinned card sorts first in any direction');
store.setListColor('mon', '#E05252');
eq(store.listColor('mon'), '#e05252', 'list colour normalised');
store.setListColor('mon', 'nope');
eq(store.listColor('mon'), '', 'an invalid colour clears it');
