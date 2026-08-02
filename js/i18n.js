// i18n.js — German/English strings and locale-aware date formatting.
//
// The language is a per-browser preference (not board data), so it lives in a
// global localStorage key. `t(key, vars)` falls back to English and finally to
// the key itself, so a missing translation is visible but never breaks the UI.

import { lsGet, lsSet, dateToUtc } from './util.js';

export const LANGS = ['de', 'en'];
const LANG_KEY = 'kb:lang';

const STRINGS = {
  en: {
    'app.name': 'Kanban',
    'nav.board': 'Lists',
    'nav.calendar': 'Calendar',

    'top.save': 'Save',
    'top.save_n': 'Save ({n})',
    'top.saving': 'Saving…',
    'top.settings': 'Settings',
    'top.help': 'Help',
    'top.filter': 'Filter',
    'top.sort': 'Sort',
    'top.search': 'Search',
    'top.language': 'Language',
    'top.switch_board': 'Switch board',
    'top.menu': 'Menu',

    'weekday.mon': 'Monday',
    'weekday.tue': 'Tuesday',
    'weekday.wed': 'Wednesday',
    'weekday.thu': 'Thursday',
    'weekday.fri': 'Friday',
    'weekday.sat': 'Saturday',
    'weekday.sun': 'Sunday',
    'weekday.short.mon': 'Mon',
    'weekday.short.tue': 'Tue',
    'weekday.short.wed': 'Wed',
    'weekday.short.thu': 'Thu',
    'weekday.short.fri': 'Fri',
    'weekday.short.sat': 'Sat',
    'weekday.short.sun': 'Sun',

    'type.label': 'Category',
    'type.date': 'Appointment',
    'type.info': 'Info',
    'type.todo': 'To-do',

    'urgency.label': 'Urgency',
    'urgency.none': 'no urgency',
    'urgency.today': 'must be today',
    'urgency.tomorrow': 'can wait until tomorrow',
    'urgency.later': 'no rush',
    'urgency.short.today': 'today',
    'urgency.short.tomorrow': 'tomorrow',
    'urgency.short.later': 'no rush',

    'client.label': 'Client',
    'client.none': 'no client',

    'repeat.label': 'Repeat',
    'repeat.none': 'does not repeat',
    'repeat.daily': 'every day',
    'repeat.weekdays': 'every weekday (Mon–Fri)',
    'repeat.weekly': 'every week',
    'repeat.biweekly': 'every two weeks',
    'repeat.monthly': 'every month',
    'repeat.yearly': 'every year',
    'repeat.until': 'until',
    'repeat.open_end': 'open ended',

    'card.new': 'New card',
    'card.edit': 'Card',
    'card.title': 'Title',
    'card.title_ph': 'What needs to happen?',
    'card.date': 'Delivery date',
    'card.time': 'Time',
    'card.nodate': 'No date',
    'card.list': 'List',
    'card.body': 'Notes',
    'card.body_ph': 'Free text — Markdown is supported.',
    'card.created': 'Created',
    'card.author': 'Created by',
    'card.done': 'Completed',
    'card.delete': 'Delete card',
    'card.delete_confirm': 'Delete “{title}” and all its comments?',
    'card.save': 'Save card',
    'card.add': 'Add card',
    'card.cancel': 'Cancel',
    'card.date_required': 'Pick a delivery date, or tick “No date”.',
    'card.title_required': 'The card needs a title.',
    'card.list_required': 'Pick a list for a card without a date.',
    'card.no_lists': 'There is no list for undated cards yet — create one on the board first.',
    'card.occurs_next': 'next on {date}',

    'comments.title': 'Comments',
    'comments.none': 'No comments yet.',
    'comments.placeholder': 'Write a comment…',
    'comments.add': 'Add comment',
    'comments.delete_confirm': 'Delete this comment?',

    'who.title': 'Who are you?',
    'who.hint_card': 'Pick your name — it is stored on the card.',
    'who.hint_comment': 'Pick your name — it is stored on the comment.',
    'who.empty': 'No employees are defined for this board yet.',
    'who.open_settings': 'Add employees in settings',

    'board.add_card': '＋ Card',
    'board.new_list': '＋ New list',
    'board.new_list_ph': 'List name',
    'board.rename_list': 'Rename list',
    'board.delete_list': 'Delete list',
    'board.delete_list_confirm': 'Delete the list “{name}”? Its {n} card(s) are kept and move to the first remaining list.',
    'board.delete_list_last': 'The last list for undated cards cannot be deleted.',
    'board.empty': 'no cards',
    'board.card_count': '{n}',
    'board.moved_to_day': 'Moved to {day} — the date is now {date}.',
    'board.moved_to_list': 'Date removed — the card is now in “{name}”.',
    'board.drag_hint': 'Drag a list header to reorder the columns.',

    'cal.today': 'Today',
    'cal.week_short': 'W',
    'cal.prev': 'Previous month',
    'cal.next': 'Next month',
    'cal.only_dates': 'Only appointments are shown. Change this in Filter.',
    'cal.more': '+{n} more',

    'filter.title': 'Filter',
    'filter.type': 'Category',
    'filter.urgency': 'Urgency',
    'filter.client': 'Client',
    'filter.author': 'Created by',
    'filter.range': 'Date range',
    'filter.range.all': 'all',
    'filter.range.today': 'today',
    'filter.range.week': 'this week',
    'filter.range.next7': 'next 7 days',
    'filter.range.month': 'this month',
    'filter.range.overdue': 'overdue',
    'filter.range.nodate': 'without a date',
    'filter.hide_done': 'Hide completed to-dos',
    'filter.cal_all_types': 'Show info and to-do cards in the calendar too',
    'filter.reset': 'Reset filter',
    'filter.active': 'Filter active',

    'sort.title': 'Sort cards by',
    'sort.date': 'date',
    'sort.urgency': 'urgency',
    'sort.type': 'category',
    'sort.client': 'client',
    'sort.title_field': 'title',
    'sort.created': 'creation date',
    'sort.dir.asc': 'ascending',
    'sort.dir.desc': 'descending',
    'sort.note': 'Sorting is automatic — cards cannot be reordered by hand.',

    'search.placeholder': 'Search title and text…',
    'search.results': '{n} of {total} cards match',
    'search.clear': 'Clear search',

    'settings.title': 'Settings',
    'settings.board': 'Board',
    'settings.board_name': 'Board name',
    'settings.board_name_hint': 'Stored in the data repository — everyone on this board sees it.',
    'settings.employees': 'Employees',
    'settings.employees_hint': 'Everyone who may create cards and comments on this board.',
    'settings.employee_ph': 'Name',
    'settings.clients': 'Clients',
    'settings.clients_hint': 'Each client has a color; it is shown next to the card title in the calendar.',
    'settings.client_ph': 'Client name',
    'settings.lists': 'Lists',
    'settings.lists_hint': 'The seven weekday columns are built in. Cards without a date live in the other lists.',
    'settings.data': 'Data source',
    'settings.data_hint': 'One data repository = one board.',
    'settings.add': 'Add',
    'settings.remove': 'Remove',
    'settings.rename': 'Rename',
    'settings.language': 'Language',
    'settings.about': 'About',
    'settings.version': 'Version {v}',
    'settings.changelog': "What's new",
    'settings.close': 'Close',
    'settings.in_use': '“{name}” is used by {n} card(s) — they keep the name until you change them.',
    'settings.duplicate': 'That name already exists.',

    'projects.title': 'Boards',
    'projects.add': '＋ Add board…',
    'projects.add_title': 'Add a board',
    'projects.name': 'Display name',
    'projects.name_ph': 'e.g. Office board',
    'projects.owner': 'GitHub user or organisation',
    'projects.repo': 'Repository',
    'projects.branch': 'Branch',
    'projects.token': 'Access token',
    'projects.token_hint': 'Fine-grained token, repository access = only this repo, permission Contents: Read and write.',
    'projects.check': 'Check and add',
    'projects.checking': 'Checking…',
    'projects.ok_read': 'Read access ✓',
    'projects.ok_write': 'Write access ✓',
    'projects.switch': 'Switch to',
    'projects.forget': 'Forget',
    'projects.forget_confirm': 'Forget “{name}” in this browser? The repository and its data stay untouched.',
    'projects.share': 'Copy invite link',
    'projects.share_done': 'Invite link copied — it contains the token, treat it like a password.',
    'projects.added': 'Board “{name}” added.',
    'projects.steps': 'Setting up a board takes three steps:',
    'projects.step1': 'Create a <b>private</b> repository for the data (it may be completely empty).',
    'projects.step2': 'Create a <b>fine-grained personal access token</b>: repository access = only that repository, permission <i>Contents: Read and write</i>.',
    'projects.step3': 'Enter owner, repository and token below.',
    'projects.link_repo': 'Create repository',
    'projects.link_token': 'Create token',

    'welcome.title': 'A kanban board on top of your own git repository',
    'welcome.lead': 'Cards are Markdown files in a repository you own. Every Save is one commit — full history, no server, no account with anyone but GitHub.',
    'welcome.connect': 'Connect your board',
    'welcome.demo': 'Try the demo',
    'welcome.share_note': 'If a colleague sent you an invite link, just open it — it sets everything up.',

    'help.title': 'Help',

    'toast.saved': 'Saved ✓ (commit {sha})',
    'toast.nothing': 'Nothing to save — the repository is already up to date.',
    'toast.save_failed': 'Save failed.',
    'toast.merged': 'Merged {n} change(s) from the repository into your unsaved work.',
    'toast.conflicts': 'Merged remote changes. Both sides edited: {list} — your version was kept.',
    'toast.updated': 'Updated to v{v} — tap to see what’s new.',
    'toast.demo_save': 'Demo mode: connect your own repository in settings to save.',
    'toast.copy_failed': 'Could not copy to the clipboard.',
    'toast.card_added': 'Card created.',
    'toast.card_deleted': 'Card deleted.',

    'banner.format_new': 'This board was saved by a newer version of the app. Reload to update — saving is paused until then.',
    'banner.reload': 'Reload now',
    'banner.no_repo': 'This board is missing its repository settings.',
    'banner.open_settings': 'Open settings',
    'banner.needs_token': 'This board’s data is in a private repository — an access token is needed to read it.',

    'err.network': 'No connection to GitHub (offline?).',
    'err.auth': 'GitHub rejected the access token. Check it in the settings.',
    'err.not-found': 'Repository or branch not found — check owner, repository, branch and the token’s access.',
    'err.raw': 'Could not read the file. A private repository needs an access token.',
    'err.rate-limit': 'GitHub’s API rate limit is reached. {at}',
    'err.forbidden': 'The token cannot access this repository. Check that owner/repository point at your data repository, and that the token is scoped to it with Contents: Read and write.',
    'err.conflict': 'GitHub kept rejecting the commit (very busy branch?). Try saving again.',
    'err.storage': 'The draft could not be stored in this browser (storage full?). Changes only live in this tab until you save.',
    'err.config': 'Configure the data repository in the settings first.',
    'err.no-token': 'Add an access token in the settings to be able to save.',
    'err.demo': 'Demo mode: connect your own repository in the settings to save.',
    'err.format': 'This board was saved by a newer version of the app — reload the page before saving.',
    'err.empty-repo': 'The repository has no commits yet.',

    'demo.badge': 'Demo',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.cancel': 'Cancel',
    'common.ok': 'OK',
    'common.none': '—',
    'common.unsaved': 'You have unsaved changes.',
  },

  de: {
    'app.name': 'Kanban',
    'nav.board': 'Listen',
    'nav.calendar': 'Kalender',

    'top.save': 'Speichern',
    'top.save_n': 'Speichern ({n})',
    'top.saving': 'Speichere…',
    'top.settings': 'Einstellungen',
    'top.help': 'Hilfe',
    'top.filter': 'Filter',
    'top.sort': 'Sortierung',
    'top.search': 'Suche',
    'top.language': 'Sprache',
    'top.switch_board': 'Board wechseln',
    'top.menu': 'Menü',

    'weekday.mon': 'Montag',
    'weekday.tue': 'Dienstag',
    'weekday.wed': 'Mittwoch',
    'weekday.thu': 'Donnerstag',
    'weekday.fri': 'Freitag',
    'weekday.sat': 'Samstag',
    'weekday.sun': 'Sonntag',
    'weekday.short.mon': 'Mo',
    'weekday.short.tue': 'Di',
    'weekday.short.wed': 'Mi',
    'weekday.short.thu': 'Do',
    'weekday.short.fri': 'Fr',
    'weekday.short.sat': 'Sa',
    'weekday.short.sun': 'So',

    'type.label': 'Kategorie',
    'type.date': 'Termin',
    'type.info': 'Info',
    'type.todo': 'To-do',

    'urgency.label': 'Dringlichkeit',
    'urgency.none': 'keine Angabe',
    'urgency.today': 'unbedingt heute',
    'urgency.tomorrow': 'notfalls morgen',
    'urgency.later': 'kein Stress',
    'urgency.short.today': 'heute',
    'urgency.short.tomorrow': 'morgen',
    'urgency.short.later': 'kein Stress',

    'client.label': 'Kunde',
    'client.none': 'kein Kunde',

    'repeat.label': 'Wiederholung',
    'repeat.none': 'keine Wiederholung',
    'repeat.daily': 'täglich',
    'repeat.weekdays': 'jeden Werktag (Mo–Fr)',
    'repeat.weekly': 'wöchentlich',
    'repeat.biweekly': 'alle zwei Wochen',
    'repeat.monthly': 'monatlich',
    'repeat.yearly': 'jährlich',
    'repeat.until': 'bis',
    'repeat.open_end': 'ohne Ende',

    'card.new': 'Neue Karte',
    'card.edit': 'Karte',
    'card.title': 'Titel',
    'card.title_ph': 'Was ist zu tun?',
    'card.date': 'Termindatum',
    'card.time': 'Uhrzeit',
    'card.nodate': 'Kein Datum',
    'card.list': 'Liste',
    'card.body': 'Notizen',
    'card.body_ph': 'Freitext — Markdown wird unterstützt.',
    'card.created': 'Erstellt',
    'card.author': 'Erstellt von',
    'card.done': 'Erledigt',
    'card.delete': 'Karte löschen',
    'card.delete_confirm': '„{title}“ und alle Kommentare löschen?',
    'card.save': 'Karte speichern',
    'card.add': 'Karte anlegen',
    'card.cancel': 'Abbrechen',
    'card.date_required': 'Bitte ein Datum wählen oder „Kein Datum“ ankreuzen.',
    'card.title_required': 'Die Karte braucht einen Titel.',
    'card.list_required': 'Bitte eine Liste für die Karte ohne Datum wählen.',
    'card.no_lists': 'Es gibt noch keine Liste für Karten ohne Datum — lege zuerst eine auf dem Board an.',
    'card.occurs_next': 'nächster Termin {date}',

    'comments.title': 'Kommentare',
    'comments.none': 'Noch keine Kommentare.',
    'comments.placeholder': 'Kommentar schreiben…',
    'comments.add': 'Kommentar hinzufügen',
    'comments.delete_confirm': 'Diesen Kommentar löschen?',

    'who.title': 'Wer bist du?',
    'who.hint_card': 'Wähle deinen Namen — er wird auf der Karte gespeichert.',
    'who.hint_comment': 'Wähle deinen Namen — er wird beim Kommentar gespeichert.',
    'who.empty': 'Für dieses Board sind noch keine Mitarbeiter definiert.',
    'who.open_settings': 'Mitarbeiter in den Einstellungen anlegen',

    'board.add_card': '＋ Karte',
    'board.new_list': '＋ Neue Liste',
    'board.new_list_ph': 'Name der Liste',
    'board.rename_list': 'Liste umbenennen',
    'board.delete_list': 'Liste löschen',
    'board.delete_list_confirm': 'Die Liste „{name}“ löschen? Ihre {n} Karte(n) bleiben erhalten und wandern in die erste verbleibende Liste.',
    'board.delete_list_last': 'Die letzte Liste für Karten ohne Datum kann nicht gelöscht werden.',
    'board.empty': 'keine Karten',
    'board.card_count': '{n}',
    'board.moved_to_day': 'Auf {day} verschoben — das Datum ist jetzt {date}.',
    'board.moved_to_list': 'Datum entfernt — die Karte liegt jetzt in „{name}“.',
    'board.drag_hint': 'Ziehe eine Listenüberschrift, um die Spalten neu anzuordnen.',

    'cal.today': 'Heute',
    'cal.week_short': 'KW',
    'cal.prev': 'Voriger Monat',
    'cal.next': 'Nächster Monat',
    'cal.only_dates': 'Es werden nur Termine angezeigt. Im Filter änderbar.',
    'cal.more': '+{n} weitere',

    'filter.title': 'Filter',
    'filter.type': 'Kategorie',
    'filter.urgency': 'Dringlichkeit',
    'filter.client': 'Kunde',
    'filter.author': 'Erstellt von',
    'filter.range': 'Zeitraum',
    'filter.range.all': 'alle',
    'filter.range.today': 'heute',
    'filter.range.week': 'diese Woche',
    'filter.range.next7': 'nächste 7 Tage',
    'filter.range.month': 'dieser Monat',
    'filter.range.overdue': 'überfällig',
    'filter.range.nodate': 'ohne Datum',
    'filter.hide_done': 'Erledigte To-dos ausblenden',
    'filter.cal_all_types': 'Info- und To-do-Karten auch im Kalender zeigen',
    'filter.reset': 'Filter zurücksetzen',
    'filter.active': 'Filter aktiv',

    'sort.title': 'Karten sortieren nach',
    'sort.date': 'Datum',
    'sort.urgency': 'Dringlichkeit',
    'sort.type': 'Kategorie',
    'sort.client': 'Kunde',
    'sort.title_field': 'Titel',
    'sort.created': 'Erstelldatum',
    'sort.dir.asc': 'aufsteigend',
    'sort.dir.desc': 'absteigend',
    'sort.note': 'Die Sortierung ist automatisch — Karten lassen sich nicht von Hand umsortieren.',

    'search.placeholder': 'Titel und Text durchsuchen…',
    'search.results': '{n} von {total} Karten passen',
    'search.clear': 'Suche zurücksetzen',

    'settings.title': 'Einstellungen',
    'settings.board': 'Board',
    'settings.board_name': 'Name des Boards',
    'settings.board_name_hint': 'Wird im Daten-Repository gespeichert — alle auf diesem Board sehen ihn.',
    'settings.employees': 'Mitarbeiter',
    'settings.employees_hint': 'Alle, die auf diesem Board Karten und Kommentare anlegen dürfen.',
    'settings.employee_ph': 'Name',
    'settings.clients': 'Kunden',
    'settings.clients_hint': 'Jeder Kunde hat eine Farbe; sie erscheint im Kalender neben dem Kartentitel.',
    'settings.client_ph': 'Name des Kunden',
    'settings.lists': 'Listen',
    'settings.lists_hint': 'Die sieben Wochentagsspalten sind fest eingebaut. Karten ohne Datum liegen in den übrigen Listen.',
    'settings.data': 'Datenquelle',
    'settings.data_hint': 'Ein Daten-Repository = ein Board.',
    'settings.add': 'Hinzufügen',
    'settings.remove': 'Entfernen',
    'settings.rename': 'Umbenennen',
    'settings.language': 'Sprache',
    'settings.about': 'Über',
    'settings.version': 'Version {v}',
    'settings.changelog': 'Was ist neu',
    'settings.close': 'Schließen',
    'settings.in_use': '„{name}“ wird von {n} Karte(n) benutzt — sie behalten den Namen, bis du sie änderst.',
    'settings.duplicate': 'Diesen Namen gibt es schon.',

    'projects.title': 'Boards',
    'projects.add': '＋ Board hinzufügen…',
    'projects.add_title': 'Board hinzufügen',
    'projects.name': 'Anzeigename',
    'projects.name_ph': 'z. B. Büro-Board',
    'projects.owner': 'GitHub-Benutzer oder -Organisation',
    'projects.repo': 'Repository',
    'projects.branch': 'Branch',
    'projects.token': 'Zugriffstoken',
    'projects.token_hint': 'Fine-grained Token, Repository-Zugriff = nur dieses Repo, Berechtigung Contents: Read and write.',
    'projects.check': 'Prüfen und hinzufügen',
    'projects.checking': 'Prüfe…',
    'projects.ok_read': 'Lesezugriff ✓',
    'projects.ok_write': 'Schreibzugriff ✓',
    'projects.switch': 'Wechseln zu',
    'projects.forget': 'Vergessen',
    'projects.forget_confirm': '„{name}“ in diesem Browser vergessen? Repository und Daten bleiben unangetastet.',
    'projects.share': 'Einladungslink kopieren',
    'projects.share_done': 'Einladungslink kopiert — er enthält das Token, behandle ihn wie ein Passwort.',
    'projects.added': 'Board „{name}“ hinzugefügt.',
    'projects.steps': 'Ein Board einzurichten dauert drei Schritte:',
    'projects.step1': 'Ein <b>privates</b> Repository für die Daten anlegen (darf völlig leer sein).',
    'projects.step2': 'Ein <b>fine-grained Personal Access Token</b> erstellen: Repository-Zugriff = nur dieses Repository, Berechtigung <i>Contents: Read and write</i>.',
    'projects.step3': 'Unten Benutzer, Repository und Token eintragen.',
    'projects.link_repo': 'Repository anlegen',
    'projects.link_token': 'Token erstellen',

    'welcome.title': 'Ein Kanban-Board auf deinem eigenen Git-Repository',
    'welcome.lead': 'Karten sind Markdown-Dateien in einem Repository, das dir gehört. Jedes Speichern ist ein Commit — volle Historie, kein Server, kein Konto außer bei GitHub.',
    'welcome.connect': 'Board verbinden',
    'welcome.demo': 'Demo ausprobieren',
    'welcome.share_note': 'Wenn dir jemand einen Einladungslink geschickt hat, öffne ihn einfach — er richtet alles ein.',

    'help.title': 'Hilfe',

    'toast.saved': 'Gespeichert ✓ (Commit {sha})',
    'toast.nothing': 'Nichts zu speichern — das Repository ist aktuell.',
    'toast.save_failed': 'Speichern fehlgeschlagen.',
    'toast.merged': '{n} Änderung(en) aus dem Repository in deine ungespeicherte Arbeit übernommen.',
    'toast.conflicts': 'Änderungen zusammengeführt. Beide Seiten haben geändert: {list} — deine Fassung wurde behalten.',
    'toast.updated': 'Auf v{v} aktualisiert — antippen für die Neuerungen.',
    'toast.demo_save': 'Demomodus: verbinde in den Einstellungen dein eigenes Repository zum Speichern.',
    'toast.copy_failed': 'Konnte nicht in die Zwischenablage kopieren.',
    'toast.card_added': 'Karte angelegt.',
    'toast.card_deleted': 'Karte gelöscht.',

    'banner.format_new': 'Dieses Board wurde von einer neueren Version der App gespeichert. Bitte neu laden — bis dahin ist das Speichern pausiert.',
    'banner.reload': 'Jetzt neu laden',
    'banner.no_repo': 'Diesem Board fehlen die Repository-Einstellungen.',
    'banner.open_settings': 'Einstellungen öffnen',
    'banner.needs_token': 'Die Daten dieses Boards liegen in einem privaten Repository — zum Lesen wird ein Token gebraucht.',

    'err.network': 'Keine Verbindung zu GitHub (offline?).',
    'err.auth': 'GitHub hat das Zugriffstoken abgelehnt. Bitte in den Einstellungen prüfen.',
    'err.not-found': 'Repository oder Branch nicht gefunden — Benutzer, Repository, Branch und Token-Zugriff prüfen.',
    'err.raw': 'Datei konnte nicht gelesen werden. Ein privates Repository braucht ein Zugriffstoken.',
    'err.rate-limit': 'Das API-Limit von GitHub ist erreicht. {at}',
    'err.forbidden': 'Das Token kann auf dieses Repository nicht zugreifen. Prüfe, ob Benutzer/Repository auf dein Daten-Repository zeigen und das Token dafür Contents: Read and write hat.',
    'err.conflict': 'GitHub hat den Commit wiederholt abgelehnt (sehr aktiver Branch?). Bitte noch einmal speichern.',
    'err.storage': 'Der Entwurf konnte nicht im Browser gespeichert werden (Speicher voll?). Die Änderungen leben nur in diesem Tab, bis du speicherst.',
    'err.config': 'Bitte zuerst das Daten-Repository in den Einstellungen eintragen.',
    'err.no-token': 'Zum Speichern in den Einstellungen ein Zugriffstoken hinterlegen.',
    'err.demo': 'Demomodus: verbinde in den Einstellungen dein eigenes Repository zum Speichern.',
    'err.format': 'Dieses Board wurde von einer neueren App-Version gespeichert — bitte die Seite neu laden, bevor du speicherst.',
    'err.empty-repo': 'Das Repository hat noch keine Commits.',

    'demo.badge': 'Demo',
    'common.yes': 'Ja',
    'common.no': 'Nein',
    'common.cancel': 'Abbrechen',
    'common.ok': 'OK',
    'common.none': '—',
    'common.unsaved': 'Es gibt ungespeicherte Änderungen.',
  },
};

function detect() {
  const stored = lsGet(LANG_KEY);
  if (LANGS.includes(stored)) return stored;
  const nav = (navigator.languages || [navigator.language || 'en']).map(l => String(l).slice(0, 2));
  return nav.find(l => LANGS.includes(l)) || 'en';
}

let current = detect();

export const lang = () => current;

export function setLang(l) {
  if (!LANGS.includes(l)) return;
  current = l;
  lsSet(LANG_KEY, l);
  document.documentElement.lang = l;
  window.dispatchEvent(new CustomEvent('kb:lang'));
}

export function t(key, vars) {
  let s = STRINGS[current]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

// ---------- locale-aware date formatting ----------

const locale = () => (current === 'de' ? 'de-DE' : 'en-GB');

const fmtCache = new Map();
function fmt(opts) {
  const key = current + JSON.stringify(opts);
  if (!fmtCache.has(key)) {
    fmtCache.set(key, new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', ...opts }));
  }
  return fmtCache.get(key);
}
window.addEventListener('kb:lang', () => fmtCache.clear());

// "5 Aug" / "5. Aug." — the year is added only when it is not the current one.
export function fmtDate(ds, withYear = false) {
  if (!ds) return '';
  const showYear = withYear || ds.slice(0, 4) !== String(new Date().getFullYear());
  return fmt({ day: 'numeric', month: 'short', ...(showYear ? { year: 'numeric' } : {}) })
    .format(new Date(dateToUtc(ds)));
}

export function fmtDateLong(ds) {
  if (!ds) return '';
  return fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(dateToUtc(ds)));
}

export function fmtMonthYear(ds) {
  return fmt({ month: 'long', year: 'numeric' }).format(new Date(dateToUtc(ds)));
}

// ISO timestamp -> local date + time, e.g. "2 Aug 2026, 10:11"
export function fmtStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const key = current + 'stamp';
  if (!fmtCache.has(key)) {
    fmtCache.set(key, new Intl.DateTimeFormat(locale(), {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }));
  }
  return fmtCache.get(key).format(d);
}

export const weekdayName = id => t('weekday.' + id);
export const weekdayShort = id => t('weekday.short.' + id);
