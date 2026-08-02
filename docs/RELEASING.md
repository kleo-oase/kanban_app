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
2. Push to `beta`, test at `/beta/` against a real board, run the smoke
   checklist below.
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
  the moment it is introduced, and add it to the `FIELDS` list.
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
- [ ] Console clean.
