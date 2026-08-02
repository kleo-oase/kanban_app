// demo.js — sample board for `?demo=1`: the app is fully usable (except
// saving) with zero configuration, which is also how it is developed locally.
//
// The dates are generated relative to today so the demo always looks current.

import { todayStr, addDays, startOfWeek } from './util.js';

const mon = startOfWeek(todayStr());
const d = n => addDays(mon, n);
const stamp = n => `${addDays(todayStr(), -n)}T09:12:00Z`;

const card = (fm, body = '') => `---\n${fm.filter(Boolean).join('\n')}\n---\n${body ? '\n' + body + '\n' : ''}`;

export const DEMO_FILES = {
  'data/config.yml': `# Kanban board configuration.
format: 1

name: Demo board

employees:
  - Anna
  - Bea
  - Chris

clients:
  - name: Müller GmbH
    color: "#4f8cff"
  - name: Schmidt & Co.
    color: "#10b981"
  - name: Stadtwerke
    color: "#f59e0b"

lists:
  - id: mon
  - id: tue
  - id: wed
  - id: thu
  - id: fri
  - id: sat
  - id: sun
  - id: l-backlog
    name: Backlog
  - id: l-ideen
    name: Ideen
`,

  'data/cards/zahnarzt-frau-berger-a1b2.md': card([
    'title: Zahnarzt Frau Berger',
    'type: date',
    `date: ${d(0)}`,
    'time: "09:30"',
    'urgency: today',
    'client: Müller GmbH',
    `created: ${stamp(6)}`,
    'author: Anna',
  ], 'Unterlagen vom letzten Mal **mitnehmen**.'),

  'data/cards/angebot-schicken-c3d4.md': card([
    'title: Angebot schicken',
    'type: todo',
    `date: ${d(1)}`,
    'urgency: tomorrow',
    'client: Schmidt & Co.',
    `created: ${stamp(5)}`,
    'author: Bea',
  ], 'Positionen aus der letzten Anfrage übernehmen, Rabatt 5 %.'),

  'data/cards/team-jour-fixe-e5f6.md': card([
    'title: Team-Jour-fixe',
    'type: date',
    `date: ${d(2)}`,
    'time: "10:00"',
    'repeat: weekly',
    `created: ${stamp(30)}`,
    'author: Chris',
  ], 'Jede Woche, 30 Minuten. Agenda in der Kommentarspalte.'),

  'data/cards/rechnungen-prufen-g7h8.md': card([
    'title: Rechnungen prüfen',
    'type: todo',
    `date: ${d(3)}`,
    'urgency: later',
    `created: ${stamp(4)}`,
    'author: Anna',
  ]),

  'data/cards/lieferung-annehmen-i9j0.md': card([
    'title: Lieferung annehmen',
    'type: date',
    `date: ${d(4)}`,
    'time: "14:00"',
    'client: Stadtwerke',
    `created: ${stamp(3)}`,
    'author: Bea',
  ]),

  'data/cards/inventur-vorbereiten-k1l2.md': card([
    'title: Inventur vorbereiten',
    'type: info',
    `date: ${d(5)}`,
    `created: ${stamp(9)}`,
    'author: Chris',
  ], 'Listen liegen im Lager, Etiketten sind bestellt.'),

  'data/cards/monatsabschluss-m3n4.md': card([
    'title: Monatsabschluss',
    'type: todo',
    `date: ${todayStr().slice(0, 8)}01`,
    'repeat: monthly',
    'urgency: later',
    `created: ${stamp(60)}`,
    'author: Anna',
  ]),

  'data/cards/altpapier-rausbringen-o5p6.md': card([
    'title: Altpapier rausbringen',
    'type: todo',
    `date: ${d(0)}`,
    'done: true',
    `created: ${stamp(7)}`,
    'author: Chris',
  ]),

  'data/cards/website-texte-uberarbeiten-q7r8.md': card([
    'title: Website-Texte überarbeiten',
    'type: todo',
    'list: l-backlog',
    'urgency: later',
    'client: Müller GmbH',
    `created: ${stamp(20)}`,
    'author: Bea',
  ], 'Vor allem die Seite *Leistungen* — klingt zu technisch.'),

  'data/cards/kaffeemaschine-s9t0.md': card([
    'title: Neue Kaffeemaschine',
    'type: info',
    'list: l-backlog',
    `created: ${stamp(14)}`,
    'author: Anna',
  ], 'Angebote:\n\n- Modell A — 480 €\n- Modell B — 620 €, mit Wartungsvertrag'),

  'data/cards/kundenevent-im-herbst-u1v2.md': card([
    'title: Kundenevent im Herbst',
    'type: info',
    'list: l-ideen',
    `created: ${stamp(45)}`,
    'author: Chris',
  ], 'Idee: kleine Hausmesse mit den drei wichtigsten Kunden.'),

  'data/comments/team-jour-fixe-e5f6/c-aa11.md':
    `---\nauthor: Anna\ncreated: ${stamp(2)}\n---\n\nDiese Woche bitte das Thema Urlaubsplanung aufnehmen.\n`,

  'data/comments/team-jour-fixe-e5f6/c-bb22.md':
    `---\nauthor: Bea\ncreated: ${stamp(1)}\n---\n\nIch bin ab 11 Uhr unterwegs, kann also nur die erste halbe Stunde.\n`,

  'data/comments/angebot-schicken-c3d4/c-cc33.md':
    `---\nauthor: Chris\ncreated: ${stamp(1)}\n---\n\nKunde hat angerufen — Angebot bitte an die neue Adresse schicken.\n`,
};
