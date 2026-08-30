# Changelog

All notable, user-visible changes. The app shows a one-time notice when the
version changes; the details live here.

## 0.2.0 — 2026-08-30

From the first round of client feedback.

- **Archive**: every card now has an *Archive* button. Archived cards leave the
  board and the calendar without being deleted, and gather on a new third page
  **Archive**, grouped by the month they were due (newest first, undated last).
  *Reactivate* brings a card back exactly as it was — date, labels and comments
  included — so nothing has to be re-created because it was archived by mistake.
  Single cards can be deleted permanently, and *Empty the archive* clears
  everything at once; both ask first.
- **Week and day views in the calendar**, next to the month grid. ‹ and › move
  by one month, week or day depending on the mode. Week and day give each date a
  tall column with room for the client name.
- **Colour codes for lists**: the ⋯ menu on a column header offers eight preset
  colours, a free colour picker and *No colour*. The colour shows as a bar above
  the heading and a light wash behind the column — the weekday columns can be
  coloured too.
- **Overdue to-dos are red, to-dos due today are yellow**, automatically.
  Completed to-dos and appointments are never coloured.
- **Info cards are notes now**: no delivery date and no urgency. Instead they
  can be **pinned**, which keeps them at the top of their list whatever the
  sorting says. An info card always lives in one of your own lists; switching a
  card to Info removes its date.

## 0.1.0 — 2026-08-02

First prototype.

- **Lists view**: seven built-in weekday columns — a card with a delivery date
  automatically sits in the column of its weekday — plus your own lists for
  cards without a date. Columns are reordered by dragging their header, cards
  are moved by dragging them to another column (dropping on a weekday keeps the
  card in its own week and only changes the day).
- **Calendar view**: month grid with seven weekday columns, one row per calendar
  week and the ISO week number in the gutter. Only appointments are shown by
  default; the filter can add info and to-do cards. Repeating cards appear on
  every occurrence.
- **Cards** with title, delivery date (mandatory unless *no date* is ticked),
  optional time, repetition (daily, weekdays, weekly, every two weeks, monthly,
  yearly, with an optional end date), the three labels *category* /
  *urgency* / *client*, free Markdown text, creation date and author.
  To-do cards can be marked completed; completed cards are struck through,
  sorted last and can be hidden in the filter.
- **Comments** per card, each its own file so concurrent commenting never
  conflicts.
- **Employees**: creating a card or a comment always asks who you are; the name
  is stored and shown. The list of employees is set in the settings.
- **Clients** with a color, shown next to the card title in the calendar.
- **Filter** (category, urgency, client, author, date range, hide completed),
  **sort** (date, urgency, category, client, title, creation date, ascending or
  descending) and **search** over title and free text.
- **German and English** interface, switchable in the top bar.
- **Data in your own git repository**: one repository per board, Markdown plus a
  small YAML config, connected with a fine-grained access token. Every save is
  one commit; saving pulls and merges three-way first. Several boards per
  browser, invite links, and a `?demo=1` mode with sample data.
