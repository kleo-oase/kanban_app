# Kanban (app)

A kanban board served by GitHub Pages. No backend, no build step, no database —
the cards are Markdown files in **your own git repository**, and every *Save* is
one commit there.

- **Lists** — seven built-in weekday columns (a card with a delivery date lands
  in the column of its weekday) plus your own lists for cards without a date.
  Columns are reordered by dragging and can carry a colour code; cards are moved
  by dragging. Overdue to-dos are red, to-dos due today yellow.
- **Calendar** — month, week or day. The month grid has seven weekday columns
  and one row per calendar week with the ISO week number. Appointments appear on
  every occurrence of a repetition, coloured by client.
- **Archive** — cards taken off the board, grouped by the month they were due.
  Reactivating restores a card exactly as it was; the archive can also be
  emptied in one go.

A card has a title, a delivery date (mandatory unless "no date" is ticked) with
an optional start and end time and an optional repetition, three labels —
category (*appointment / info / to-do*), urgency (*must be today / can wait
until tomorrow / no rush*) and client — notes with formatting (headings, bold,
italic, underline, strikethrough, text colours, lists, quotes, links), the
creation date, the employee who created it, and comments. To-do cards are ticked
off right on the card; a repeating to-do is ticked per iteration, while its notes
and comments are shared by the whole series. Info cards are notes: no date, no urgency, and they can be pinned to the
top of their list.

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

## Running your own copy (fork)

The app is the same for everyone and needs no code changes to run elsewhere:
fork the repository, switch on GitHub Pages, and connect your boards again.
There are no secrets, API keys or settings files in the app — everything that
belongs to a board lives in its data repository, everything personal in the
browser.

### 1. Fork and publish

1. Sign in to GitHub with the account or organisation that should own the copy,
   open <https://github.com/fewagner/kanban_app> and click **Fork**. Keep the
   name `kanban_app` (it becomes part of the address). *Copy the `main` branch
   only* can stay ticked.
   The fork is public like the original — fine, it contains only the app, never
   board data.
2. In the fork, open the **Actions** tab and click *I understand my workflows,
   go ahead and enable them*. GitHub switches workflows off in every new fork;
   without this step nothing gets published.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
4. **Actions → Deploy Pages (main + beta) → Run workflow** (branch `main`).
   About two minutes later the app is live at
   `https://<account>.github.io/kanban_app/` — the address is also shown on the
   finished run and under Settings → Pages. If the account has a user site with
   a custom domain, GitHub redirects there (e.g. `https://example.com/kanban_app/`);
   a project-specific domain can be set under Settings → Pages.

That is all the workflow (`.github/workflows/pages.yml`) needs: it builds
nothing, it copies the files. The beta channel (`/beta/`) is optional; to use
it, untick *Copy the `main` branch only* when forking and follow
[docs/RELEASING.md](docs/RELEASING.md).

### 2. Move everyone to the new address

A new address is a new website to the browser, and the browser keeps board
connections, the language and unsaved changes per website:

1. In the old app, **save** — unsaved changes stay behind otherwise.
2. Open the new address and add the board again (board button → *＋ Add
   board…*). Quicker: copy the invite link in the old app (⚙ Settings → *Copy
   invite link*) and replace everything in front of `#setup=` with the new
   address. Each person does this once per browser.
3. Update bookmarks and home-screen shortcuts.

Afterwards everyone on a board should use the same, current copy: an older copy
of the app does not know fields added later and can drop them from cards it
edits.

### 3. Optional: take the board data along

The fork makes the app independent. The board itself lives in its data
repository; if that belongs to someone else's account, the board still depends
on that account. To own it:

1. The current owner transfers the data repository to you: in that repository
   **Settings → General → Danger Zone → Transfer ownership**. History and
   content move along. (Alternatively, create a new private repository and copy
   everything: `git clone --mirror <old URL>`, then
   `git push --mirror <new URL>` from inside the cloned folder.)
2. Fine-grained tokens belong to the account that owns the repository, so
   everyone creates a **new token** under the new owner: GitHub → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens,
   *Repository access* = only the data repository, *Permissions → Contents:
   Read and write*.
3. In the app, save, then add the board with its new owner and token
   (⚙ Settings → Data source → *＋ Add board…*) and *Forget* the old entry.

### 4. Getting updates from the original

The original keeps receiving updates (see [CHANGELOG.md](CHANGELOG.md)). A fork
does not update itself, but pulling updates in takes a minute:

- **On github.com (recommended):** open your fork. When the original has news,
  GitHub shows *This branch is N commits behind fewagner/kanban_app:main*.
  Click **Sync fork → Update branch**. That starts the deploy workflow; about two
  minutes later the update is live, and users see *Updated to vX.Y — what's
  new* on their next visit. If no new run appears in the Actions tab, run
  *Deploy Pages* by hand as in step 1.4.
- **Do not edit files in the fork.** Then every sync is a plain fast-forward,
  without conflicts. Nothing needs per-installation edits — not even the
  *What's new* link in `js/version.js`: it points at the original changelog on
  purpose, because that is the one describing the updates you sync.
- **Hearing about updates:** GitHub sends no notifications for new commits,
  but every repository has a feed — add
  `https://github.com/fewagner/kanban_app/commits/main.atom` to a feed reader
  (or e-mail/Teams/Slack feed integration), or simply check your fork's page
  now and then.
- **From the command line:**

  ```bash
  git clone https://github.com/<account>/kanban_app.git
  cd kanban_app
  git remote add upstream https://github.com/fewagner/kanban_app.git
  # whenever you want the latest version:
  git pull upstream main
  git push origin main
  ```

- **Automatically (optional):** add this file to your fork as
  `.github/workflows/sync-upstream.yml` to pull updates once a day:

  ```yaml
  name: Sync from upstream
  on:
    schedule:
      - cron: '23 4 * * *'      # daily at 04:23 UTC
    workflow_dispatch:
  permissions:
    contents: write
    actions: write
  jobs:
    sync:
      runs-on: ubuntu-latest
      steps:
        - name: Merge the original's main branch
          id: sync
          env:
            GH_TOKEN: ${{ github.token }}
          run: |
            type=$(gh api -X POST "repos/${{ github.repository }}/merge-upstream" -f branch=main --jq .merge_type)
            echo "merge_type=$type" >> "$GITHUB_OUTPUT"
        - name: Publish the update
          if: steps.sync.outputs.merge_type != 'none'
          env:
            GH_TOKEN: ${{ github.token }}
          run: gh workflow run pages.yml --repo "${{ github.repository }}" --ref main
  ```

  Things to know: updates then go live without you choosing when. A sync made
  by a workflow does not start other workflows by itself, hence the explicit
  second step. The workflow token may not change workflow files — when an
  update touches `.github/workflows/`, the run fails and you press *Sync fork*
  once by hand. GitHub pauses scheduled workflows in repositories without
  activity for 60 days; re-enable it in the Actions tab if that happens. And
  with this file your fork has a commit of its own, so *Sync fork* merges
  instead of fast-forwarding — still without conflicts.

**Prefer a private copy of the app?** Forks of public repositories are always
public. A private copy needs a duplicate instead of a fork (create an empty
private repository, then `git clone --bare` the original and `git push --mirror`
into it), a paid GitHub plan for Pages on private repositories, and updates via
the command line above — there is no *Sync fork* button without a fork.

## Local development

```bash
python3 -m http.server 4174
# http://localhost:4174/?demo=1   → bundled sample board, no GitHub connection
```

Plain ES modules need an HTTP server (they do not run from `file://`). No build
step means what is in the repository is exactly what runs.
Eigene Kopie der KanBan-App.

```bash
npm test        # or: node tests/run.js — Node 18+, no packages to install
```

The tests cover the file formats, the date and recurrence maths, the three-way
merge and what the board and calendar show; they run against a fixed clock.
`package.json` exists only to mark the modules as ES modules for Node — there
are no dependencies. Neither it nor `tests/` is deployed.

## Release channels

`main` deploys to `/kanban_app/`, `beta` to `/kanban_app/beta/`; see
[docs/RELEASING.md](docs/RELEASING.md) and [CHANGELOG.md](CHANGELOG.md).
