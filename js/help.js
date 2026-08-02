// help.js — the "?" modal in the top bar. Usage instructions plus the complete
// setup guide for the data repository (GitHub-hosted or worked on locally).
// Keep in sync with README.md when features move.

import { openModal } from './ui.js';
import { lang, t } from './i18n.js';
import { APP_VERSION, CHANGELOG_URL } from './version.js';

const EN = `
<section>
  <h3>What is this?</h3>
  <p>A kanban board whose cards are plain Markdown files in <b>your own git
  repository</b>. There is no server and no database: the page you are looking
  at is static, it talks to GitHub directly, and every <b>Save</b> is one commit
  in your data repository. The complete history of the board is therefore in
  <code>git log</code>, and you can read or edit the files without this app.</p>
  <p>One data repository = one board. The board button in the top bar switches
  between the boards you have connected.</p>
</section>

<section>
  <h3>The two views</h3>
  <ul>
    <li><b>Lists</b> — the main view. The seven weekday columns are built in:
      a card with a delivery date automatically sits in the column of that
      weekday, whatever week the date is in. The columns to the right are your
      own lists and hold the cards <i>without</i> a date.</li>
    <li><b>Calendar</b> — a month grid, seven weekday columns and one row per
      calendar week (the ISO week number is in the left gutter). By default only
      <i>appointments</i> appear here; the Filter menu can add info and to-do
      cards. Repeating cards show up on every occurrence. Double-click a day to
      create a card on it.</li>
  </ul>
</section>

<section>
  <h3>Cards</h3>
  <ul>
    <li><b>＋ Card</b> at the bottom of a column creates one. Because a board is
      usually shared, the app first asks <i>who you are</i> — that name is
      stored on the card and shown on it.</li>
    <li><b>Delivery date</b> is mandatory unless you tick <b>No date</b>. Only
      then can you pick one of your own lists from the dropdown.</li>
    <li>A dated card can also carry a <b>time</b> and a <b>repetition</b>
      (daily, weekdays, weekly, every two weeks, monthly, yearly), optionally
      with an end date.</li>
    <li>Three labels: the <b>category</b> (appointment / info / to-do — only
      appointments appear in the calendar), the <b>urgency</b> (must be today /
      can wait until tomorrow / no rush) and the <b>client</b>. Clients are
      defined in the settings and each has a color; that color is what you see
      next to the card title in the calendar.</li>
    <li>Cards of category <b>to-do</b> can be ticked <b>Completed</b>. They stay
      where they are, struck through and sorted last; the Filter menu can hide
      them.</li>
    <li>Drag a card to another column to move it. Dropping it on a weekday keeps
      it in its own week and only changes the weekday; dropping it on one of
      your own lists removes the date.</li>
    <li>Drag a column header sideways to reorder the columns.</li>
  </ul>
</section>

<section>
  <h3>Comments</h3>
  <p>Open a card and write at the bottom. As with new cards the app asks who you
  are, and the name plus the time is shown on the comment. Every comment is its
  own small file, so two people commenting at the same time never conflict.</p>
</section>

<section>
  <h3>Filter, Sort, Search</h3>
  <ul>
    <li><b>Filter</b> — show only certain categories, urgencies, clients or
      authors, or only cards in a date range (today, this week, the next seven
      days, this month, overdue, without a date). Also hides completed to-dos
      and adds non-appointments to the calendar.</li>
    <li><b>Sort</b> — how the cards inside every column are ordered (by date,
      urgency, category, client, title or creation date). Sorting is automatic:
      cards cannot be dragged into a hand-made order.</li>
    <li><b>Search</b> — matches the title and the free text of a card; several
      words all have to appear.</li>
  </ul>
</section>

<section>
  <h3>Saving</h3>
  <p>Edits are kept in this browser as a draft — they survive reloads and closed
  tabs. <b>Save</b> writes all of them as one commit into the data repository.
  Before committing, the app pulls the newest state and merges it field by
  field, so two people (or two devices) working at the same time never overwrite
  each other. If both sides changed the same field, your version wins and a
  notice tells you which fields collided; the other value is still in the git
  history.</p>
</section>

<section>
  <h3 id="data">Your data — setting up the repository</h3>
  <p>The board needs a git repository it can reach over the network. A static
  web page cannot read a folder on your hard disk, so the repository has to be
  hosted — GitHub is what the app speaks.</p>
  <ol>
    <li>Create a repository for the data, e.g. <code>kanban_data</code>, and make
      it <b>private</b>. It may be completely empty — the first save initialises
      it.</li>
    <li>Create a <b>fine-grained personal access token</b>
      (GitHub → Settings → Developer settings → Personal access tokens →
      Fine-grained tokens): <i>Repository access</i> = only that one repository,
      <i>Permissions → Contents: Read and write</i>. Give it an expiry you are
      happy with; when it expires, paste a new one in the settings.</li>
    <li>In this app: board button → <b>＋ Add board…</b>, enter owner,
      repository and token. The connection is verified before it is added.</li>
  </ol>
  <p>The token is the login. Anyone who has it can read and write the whole
  board, so treat the <b>invite link</b> (settings → copy invite link, it
  contains the token) exactly like a password.</p>

  <h4>Working on the data locally as well</h4>
  <p>Nothing stops you from cloning the same repository onto your machine:</p>
  <pre><code>git clone git@github.com:&lt;you&gt;/kanban_data.git
cd kanban_data
# edit the Markdown files, then
git add -A &amp;&amp; git commit -m "notes" &amp;&amp; git push</code></pre>
  <p>The app pulls before every save and merges three-way, so hand-edits and app
  edits live together. The layout is <code>data/config.yml</code>,
  <code>data/cards/&lt;id&gt;.md</code> and
  <code>data/comments/&lt;card-id&gt;/&lt;id&gt;.md</code>; the data repository's
  own README documents every field.</p>

  <h4>Keeping the data entirely off GitHub</h4>
  <p>If the board must never leave your machines, you have two honest options:</p>
  <ul>
    <li>Host the repository on a server you control and teach the app to reach
      it. Today it speaks only <code>api.github.com</code>: a <b>GitHub
      Enterprise</b> instance needs one line changed (the API base URL in
      <code>js/github.js</code>), GitLab or Gitea need a small adapter.</li>
    <li>Use the repository purely by hand: keep it local (or on a NAS / a USB
      stick / your own git server), edit the Markdown files in an editor and
      synchronise with <code>git pull</code> / <code>git push</code>. You lose
      this interface, but the data format is designed to be read and written
      without it.</li>
  </ul>
  <p>A private GitHub repository is not public: only your token (and whoever you
  invite to the repository) can read it.</p>
</section>

<section>
  <h3>Several boards, several people</h3>
  <ul>
    <li>Add as many boards as you like — each is one data repository with its
      own token. Unsaved drafts are kept separately per board.</li>
    <li>To bring a colleague in, either add them as a collaborator on the data
      repository (they then make their own token), or send them the
      <b>invite link</b> from the settings, which sets everything up in their
      browser with one click.</li>
    <li>Everybody who may create cards must be listed under
      <b>Employees</b> in the settings — that is the list the "who are you?"
      popup offers.</li>
  </ul>
</section>
`;

const DE = `
<section>
  <h3>Was ist das?</h3>
  <p>Ein Kanban-Board, dessen Karten schlichte Markdown-Dateien in <b>deinem
  eigenen Git-Repository</b> sind. Es gibt keinen Server und keine Datenbank:
  diese Seite ist statisch, sie spricht direkt mit GitHub, und jedes
  <b>Speichern</b> ist ein Commit in deinem Daten-Repository. Die vollständige
  Historie des Boards steht damit im <code>git log</code>, und du kannst die
  Dateien auch ohne diese App lesen und bearbeiten.</p>
  <p>Ein Daten-Repository = ein Board. Über die Schaltfläche oben links
  wechselst du zwischen den verbundenen Boards.</p>
</section>

<section>
  <h3>Die zwei Ansichten</h3>
  <ul>
    <li><b>Listen</b> — die Hauptansicht. Die sieben Wochentagsspalten sind fest
      eingebaut: eine Karte mit Termindatum landet automatisch in der Spalte
      ihres Wochentags, egal in welcher Woche das Datum liegt. Die Spalten
      rechts davon sind deine eigenen Listen und enthalten die Karten
      <i>ohne</i> Datum.</li>
    <li><b>Kalender</b> — ein Monatsraster mit sieben Wochentagsspalten und
      einer Zeile pro Kalenderwoche (die KW steht links). Standardmäßig werden
      hier nur <i>Termine</i> angezeigt; im Filter kannst du Info- und
      To-do-Karten dazunehmen. Wiederkehrende Karten erscheinen an jedem ihrer
      Termine. Doppelklick auf einen Tag legt dort eine Karte an.</li>
  </ul>
</section>

<section>
  <h3>Karten</h3>
  <ul>
    <li><b>＋ Karte</b> unten in einer Spalte legt eine an. Weil ein Board
      meistens geteilt wird, fragt die App zuerst, <i>wer du bist</i> — dieser
      Name wird auf der Karte gespeichert und dort angezeigt.</li>
    <li>Das <b>Termindatum</b> ist Pflicht, außer du kreuzt <b>Kein Datum</b>
      an. Nur dann kannst du im Auswahlmenü eine deiner eigenen Listen
      wählen.</li>
    <li>Eine Karte mit Datum kann zusätzlich eine <b>Uhrzeit</b> und eine
      <b>Wiederholung</b> haben (täglich, werktags, wöchentlich, alle zwei
      Wochen, monatlich, jährlich), wahlweise mit Enddatum.</li>
    <li>Drei Labels: die <b>Kategorie</b> (Termin / Info / To-do — nur Termine
      erscheinen im Kalender), die <b>Dringlichkeit</b> (unbedingt heute /
      notfalls morgen / kein Stress) und der <b>Kunde</b>. Kunden werden in den
      Einstellungen angelegt und haben je eine Farbe; genau diese Farbe steht im
      Kalender neben dem Kartentitel.</li>
    <li>Karten der Kategorie <b>To-do</b> lassen sich als <b>erledigt</b>
      abhaken. Sie bleiben, wo sie sind, werden durchgestrichen und nach hinten
      sortiert; im Filter kannst du sie ausblenden.</li>
    <li>Ziehe eine Karte in eine andere Spalte, um sie zu verschieben. Auf einem
      Wochentag abgelegt bleibt sie in ihrer Woche und wechselt nur den Tag; auf
      einer deiner eigenen Listen abgelegt verliert sie das Datum.</li>
    <li>Ziehe eine Spaltenüberschrift zur Seite, um die Spalten umzuordnen.</li>
  </ul>
</section>

<section>
  <h3>Kommentare</h3>
  <p>Öffne eine Karte und schreibe unten. Wie beim Anlegen fragt die App, wer du
  bist; Name und Zeitpunkt stehen dann am Kommentar. Jeder Kommentar ist eine
  eigene kleine Datei — zwei Leute können also gleichzeitig kommentieren, ohne
  sich in die Quere zu kommen.</p>
</section>

<section>
  <h3>Filter, Sortierung, Suche</h3>
  <ul>
    <li><b>Filter</b> — nur bestimmte Kategorien, Dringlichkeiten, Kunden oder
      Ersteller zeigen, oder nur Karten in einem Zeitraum (heute, diese Woche,
      nächste sieben Tage, dieser Monat, überfällig, ohne Datum). Blendet
      außerdem erledigte To-dos aus und nimmt Nicht-Termine in den Kalender
      auf.</li>
    <li><b>Sortierung</b> — wie die Karten innerhalb jeder Spalte geordnet sind
      (nach Datum, Dringlichkeit, Kategorie, Kunde, Titel oder Erstelldatum).
      Die Sortierung ist automatisch: Karten lassen sich nicht in eine
      Wunschreihenfolge ziehen.</li>
    <li><b>Suche</b> — durchsucht Titel und Freitext einer Karte; mehrere Wörter
      müssen alle vorkommen.</li>
  </ul>
</section>

<section>
  <h3>Speichern</h3>
  <p>Änderungen liegen als Entwurf in diesem Browser — sie überleben Neuladen
  und geschlossene Tabs. <b>Speichern</b> schreibt sie alle als einen Commit ins
  Daten-Repository. Vorher holt die App den neuesten Stand und führt ihn Feld
  für Feld zusammen, damit zwei Personen (oder zwei Geräte) sich nicht
  gegenseitig überschreiben. Haben beide Seiten dasselbe Feld geändert, gewinnt
  deine Fassung, und ein Hinweis nennt die betroffenen Felder; der andere Wert
  steht weiterhin in der Git-Historie.</p>
</section>

<section>
  <h3 id="data">Deine Daten — das Repository einrichten</h3>
  <p>Das Board braucht ein Git-Repository, das es über das Netz erreichen kann.
  Eine statische Webseite kann keinen Ordner auf deiner Festplatte lesen, das
  Repository muss also gehostet sein — die App spricht GitHub.</p>
  <ol>
    <li>Ein Repository für die Daten anlegen, z. B. <code>kanban_data</code>, und
      auf <b>privat</b> stellen. Es darf völlig leer sein — der erste
      Speichervorgang richtet es ein.</li>
    <li>Ein <b>fine-grained Personal Access Token</b> erstellen
      (GitHub → Settings → Developer settings → Personal access tokens →
      Fine-grained tokens): <i>Repository access</i> = nur dieses eine
      Repository, <i>Permissions → Contents: Read and write</i>. Läuft es ab,
      trägst du in den Einstellungen einfach ein neues ein.</li>
    <li>In dieser App: Board-Schaltfläche → <b>＋ Board hinzufügen…</b>,
      Benutzer, Repository und Token eintragen. Die Verbindung wird geprüft,
      bevor sie gespeichert wird.</li>
  </ol>
  <p>Das Token ist die Anmeldung. Wer es hat, kann das ganze Board lesen und
  schreiben — behandle deshalb auch den <b>Einladungslink</b> (Einstellungen →
  Einladungslink kopieren, er enthält das Token) wie ein Passwort.</p>

  <h4>Zusätzlich lokal mit den Daten arbeiten</h4>
  <p>Nichts hindert dich daran, dasselbe Repository lokal zu klonen:</p>
  <pre><code>git clone git@github.com:&lt;du&gt;/kanban_data.git
cd kanban_data
# Markdown-Dateien bearbeiten, dann
git add -A &amp;&amp; git commit -m "Notizen" &amp;&amp; git push</code></pre>
  <p>Die App holt vor jedem Speichern den aktuellen Stand und führt ihn
  dreifach zusammen, Handarbeit und App-Änderungen vertragen sich also. Der
  Aufbau ist <code>data/config.yml</code>,
  <code>data/cards/&lt;id&gt;.md</code> und
  <code>data/comments/&lt;karten-id&gt;/&lt;id&gt;.md</code>; die README des
  Daten-Repositories beschreibt jedes Feld.</p>

  <h4>Die Daten ganz von GitHub fernhalten</h4>
  <p>Wenn das Board deine Rechner nie verlassen soll, gibt es zwei ehrliche
  Möglichkeiten:</p>
  <ul>
    <li>Das Repository auf einem eigenen Server hosten und der App beibringen,
      ihn zu erreichen. Zurzeit spricht sie nur <code>api.github.com</code>:
      für eine <b>GitHub-Enterprise</b>-Instanz ist eine Zeile zu ändern (die
      API-Adresse in <code>js/github.js</code>), GitLab oder Gitea brauchen
      einen kleinen Adapter.</li>
    <li>Das Repository rein von Hand benutzen: lokal halten (oder auf einem NAS,
      einem USB-Stick, einem eigenen Git-Server), die Markdown-Dateien im Editor
      bearbeiten und mit <code>git pull</code> / <code>git push</code>
      abgleichen. Diese Oberfläche entfällt dann, aber das Datenformat ist
      genau dafür gemacht, auch ohne sie lesbar zu sein.</li>
  </ul>
  <p>Ein privates GitHub-Repository ist nicht öffentlich: nur dein Token (und
  wen du im Repository einlädst) kann es lesen.</p>
</section>

<section>
  <h3>Mehrere Boards, mehrere Personen</h3>
  <ul>
    <li>Du kannst beliebig viele Boards hinzufügen — jedes ist ein
      Daten-Repository mit eigenem Token. Ungespeicherte Entwürfe werden pro
      Board getrennt aufbewahrt.</li>
    <li>Um jemanden dazuzuholen: entweder als Collaborator im Daten-Repository
      eintragen (die Person erstellt dann ihr eigenes Token), oder ihr den
      <b>Einladungslink</b> aus den Einstellungen schicken, der alles mit einem
      Klick einrichtet.</li>
    <li>Alle, die Karten anlegen dürfen, müssen in den Einstellungen unter
      <b>Mitarbeiter</b> stehen — das ist die Liste, die das „Wer bist du?“-
      Fenster anbietet.</li>
  </ul>
</section>
`;

export function openHelp() {
  return openModal({
    title: t('help.title'),
    size: 'wide',
    body: `<div class="help">
      ${lang() === 'de' ? DE : EN}
      <p class="muted help-version">v${APP_VERSION} ·
        <a href="${CHANGELOG_URL}" target="_blank" rel="noopener">${t('settings.changelog')} ↗</a></p>
    </div>`,
  });
}

export function initHelp() {
  document.getElementById('help-btn').addEventListener('click', () => openHelp());
}
