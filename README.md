# Kanban (app)

A kanban board served by GitHub Pages. No backend, no build step, no database —
the cards are Markdown files in **your own git repository**, and every *Save* is
one commit there.

- **Lists** — seven built-in weekday columns (a card with a delivery date lands
  in the column of its weekday) plus your own lists for cards without a date.
  Columns are reordered by dragging; cards are moved by dragging.
- **Calendar** — month grid, seven weekday columns, one row per calendar week
  with the ISO week number. Appointments appear on every occurrence of a
  repetition, colored by client.

A card has a title, a delivery date (mandatory unless "no date" is ticked) with
optional time and repetition, three labels — category (*appointment / info /
to-do*), urgency (*must be today / can wait until tomorrow / no rush*) and
client — free Markdown text, the creation date, the employee who created it, and
comments. To-do cards can be ticked as completed.

Filter, sort and search are in the top bar; the interface is available in
**German and English**.

## Architecture

This repository is **public** and holds only the app: `index.html`, one
stylesheet and plain ES modules. GitHub Pages serves it.

The board **data lives in a separate, private repository** — one per board:

```
data/config.yml                       board name, employees, clients, lists
data/cards/<card-id>.md               one file per card
data/comments/<card-id>/<c-id>.md     one file per comment
```

The app talks to `api.github.com` directly with a **fine-grained personal access
token** (*Contents: Read and write*, scoped to that one repository) entered once
in the settings. The token is the login: without one the app shows an empty
shell, and GitHub itself enforces access.

Unsaved edits are kept in `localStorage` per board, so they survive reloads.
Saving pulls the newest state first and merges it three-way, field by field, so
several people or devices editing at once never overwrite each other.

## Getting started

Open the app. With no board configured, a welcome screen walks through the
setup: create a private data repository, create a fine-grained token, connect.
The full guide also lives in the app under **? → Your data**.

- **Several boards**: one browser can hold any number of them; the button in the
  top bar switches. Unsaved drafts are kept per board.
- **Inviting people**: Settings → *Copy invite link*. Opening that link adds the
  board — including the token — to the recipient's browser. Treat the link like
  the token itself.
- An empty data repository is bootstrapped on the first save.

## Deploying your own copy

```bash
git remote add origin https://github.com/<you>/kanban_app.git
git push -u origin main
```

Then in the repository: *Settings → Pages → Source* = **GitHub Actions**. The
workflow in `.github/workflows/pages.yml` publishes `main` to
`https://<you>.github.io/kanban_app/`. This repository must be **public** for
Pages on the free plan — that is fine, it contains no data.

## Local development

```bash
python3 -m http.server 4174
# http://localhost:4174/?demo=1   → bundled sample board, no GitHub connection
```

Plain ES modules need an HTTP server (they do not run from `file://`). No build
step means what is in the repository is exactly what runs.

## Release channels

`main` deploys to `/kanban_app/`, `beta` to `/kanban_app/beta/`; see
[docs/RELEASING.md](docs/RELEASING.md) and [CHANGELOG.md](CHANGELOG.md).
