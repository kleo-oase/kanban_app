# Releasing

Two channels come out of one workflow (`.github/workflows/pages.yml`):

```
main branch  ->  https://<host>/kanban_app/          production
beta branch  ->  https://<host>/kanban_app/beta/     test channel
```

Both redeploy on every push to either branch, always from the current branch
heads.

## One-time setup

1. *Settings → Pages → Source* = **GitHub Actions** (not "Deploy from a
   branch"), otherwise the deploy step fails while the legacy branch deploy
   keeps running.
2. Create the `beta` branch, then *Settings → Environments → github-pages →
   Deployment branches and tags* → add **`beta`**. The auto-created environment
   only permits the default branch; beta-triggered runs otherwise fail with a
   deploy job that has no steps at all.
3. Ordering trap until (2) is done: pushing `beta` right after `main` cancels
   the main-triggered run (concurrency) and then fails itself, so nothing
   deploys. Recover with an empty commit on `main`.

## Flow

1. Develop on a feature branch, or on `beta` directly for small things.
2. Run `npm test`, push to `beta`, test at `/beta/` against a real board, run
   the smoke checklist below.
3. Bump `APP_VERSION` in `js/version.js` and add a `CHANGELOG.md` section.
4. Merge/push to `main`, tag `vX.Y.Z`.
5. Hotfixes: fix on `main` first, then sync beta with `git push origin main:beta`
   (mind the ordering trap above).

## Versioning

`js/version.js` holds both numbers:

- `APP_VERSION` — bump every release. At boot the app compares it with
  `kb:version` in localStorage and shows a one-time "what's new" toast linking
  to the changelog. No toast on a first-ever visit.
- `FORMAT_VERSION` — the on-disk data format, mirrored into `config.yml` as
  `format:`. Bump **only** on a breaking change to how files are read or
  written. An app that meets a board with a newer format shows a banner and
  refuses to save, so a stale cached client can never downgrade newer data.
  Keep it at 1 as long as humanly possible — additive changes do not need a
  bump.

## Compatibility contract

The files in user repositories are the public API.

- Only add **optional** keys; ignore unknown keys when parsing.
- Keep `serialize(parse(file))` byte-identical for files older versions wrote,
  otherwise every file looks modified and commits get noisy.
- Teach the three-way merge (`_mergeIntoDraft` in `js/store.js`) every new field
  the moment it is introduced, and add it to the `FIELDS` list. A field that
  holds a set (like `done_on`) must merge as a set — see `mergeTicks` — or two
  people adding to it at once will overwrite each other.
- Never rename a card file: the filename is the card's stable id.

## Shared-origin caveat

`/kanban_app/` and `/kanban_app/beta/` share one origin and therefore one
`localStorage`. That is a feature — testers run beta against their real boards —
but every storage-shape change ships with a migration, and production must
tolerate whatever beta wrote. Additive only, validate on read.

The prefix `kb:` must stay unique among all apps served from the same Pages
domain (the planning tool uses `pt:`); two apps sharing a prefix corrupt each
other's state.

## Smoke checklist

Run against a real board (not only `?demo=1`):

- [ ] Lists view: cards appear in the right weekday columns; a repeating
      weekly card appears once, a daily one in all seven.
- [ ] Create a card from a weekday column and from a custom list — the
      "who are you?" popup appears both times and the author is stored.
- [ ] Date required: saving a card without a date and without "no date" is
      refused; ticking "no date" enables the list dropdown.
- [ ] Drag a card between two weekday columns (date shifts within its week) and
      onto a custom list (date is removed).
- [ ] Drag a column header — the new order survives a reload after saving.
- [ ] Tick a to-do as completed: struck through, sorted last, hidden by the
      filter switch.
- [ ] Add a comment (popup appears), delete a comment.
- [ ] Calendar: month navigation, today highlight, ISO week numbers, client
      colors, only appointments unless the filter says otherwise.
- [ ] Filter / sort / search each change the board, and survive a reload
      (except the search term, which is intentionally not restored).
- [ ] Language switch relabels both views and the menus.
- [ ] Save: one commit, correct message; edit the same card from a second
      browser and save both — the merge notice appears and nothing is lost.
- [ ] Reload with unsaved changes: the draft is still there.
- [ ] Settings: rename an employee/client (references on cards follow), delete
      a list (its cards move to the first remaining one).
- [ ] Welcome screen with no board configured; invite link adds a board.
- [ ] Archive: archive a card from its editor (it leaves board *and* calendar),
      reactivate it from the Archive page (date, labels and comments intact),
      delete one permanently, empty the archive — the deletions show up as
      pending changes and commit correctly.
- [ ] Calendar: month / week / day switch, ‹ › steps by the right unit in each
      mode, "Today" returns, ISO week numbers stay correct across a year
      boundary.
- [ ] List colours: pick a swatch and a custom colour on both a weekday column
      and a custom list, clear it again; the colour survives save + reload.
- [ ] An overdue to-do is red, one due today is yellow; a completed one and an
      appointment are neither.
- [ ] Info card: date, time, repetition and urgency are gone, the list dropdown
      and *Pin to the top* are there; a pinned card sorts first in both sort
      directions. Switching a dated card to Info drops the date and shows the
      list dropdown; switching back offers the date fields again.
- [ ] End time: a card with *from 09:30 to 10:15* shows the span on the board
      and in week/day view, only the start in the month grid; an end before
      the start is refused; clearing the start clears the end.
- [ ] Repeating to-do: a daily one shows seven chips with seven different
      dates; ticking one ☐ ticks only that day (the editor does not open);
      next week's iterations start open. Open an iteration from the calendar —
      the note names that date and "Done on …" refers to it.
- [ ] Comments added from one iteration appear on every other iteration.
- [ ] Two browsers tick different days of the same series and both save —
      both ticks survive, no conflict notice.
- [ ] Dragging a weekly series to another weekday moves the series; dropping
      any series on a custom list is refused with a message.
- [ ] Notes: bold / italic / underline / strike / colour / heading / lists /
      quote / link / line via the bar (with the mouse — the selection must
      survive the click); "default colour" removes a colour; "clear formatting"
      removes bold & co. Save, reopen: identical. Open and save a card without
      touching the notes: no change to save.
- [ ] Paste from a web page and from Google Docs: lists and bold survive,
      fonts/sizes/foreign colours do not; pasted `**` and `<b>` stay text.
- [ ] Console clean.
