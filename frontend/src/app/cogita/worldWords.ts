/**
 * 2026-11-05 (Prompt 24) — DIE WORTE DER VERBINDUNGEN ZWISCHEN BAZY („Inne światy", `worlds.ts`, `WorldLinks.tsx`) in den drei
 * Sprachen von `lang.ts`; die Baza sagt welche.
 */

import type { Lang } from './lang';

export function worldWords(lang: Lang) {
  const L = <T>(pl: T, de: T, en: T): T => (lang === 'de' ? de : lang === 'en' ? en : pl);
  return {
    lang,
    section: L('W innych światach', 'In anderen Welten', 'In other worlds'),
    sectionNote: L('Propozycje z innych baz wiedzy — nic tu nie blokują i nie liczą się do postępu tutaj.', 'Angebote aus anderen Wissensbasen — sie sperren hier nichts und zählen hier nicht zum Fortschritt.', 'Offers from other knowledge bases — they lock nothing here and do not count for progress here.'),
    inWorld: (name: string) => L(`Świat: ${name}`, `Welt: ${name}`, `World: ${name}`),
    deeper: (name: string) => L(`Zagłębienie w innym świecie: ${name}`, `Vertiefung in einer anderen Welt: ${name}`, `Going deeper in another world: ${name}`),
    open: L('Otwórz', 'Öffnen', 'Open'),
    openIn: (name: string) => L(`Otwórz w świecie „${name}”`, `In der Welt „${name}“ öffnen`, `Open in the world “${name}”`),
    enter: L('Wejdź', 'Hinein', 'Enter'),
    story: L('Opowieść', 'Geschichte', 'Story'),
    entry: L('Temat', 'Thema', 'Topic'),
    view: L('Widok', 'Ansicht', 'View'),
    stateNew: L('jeszcze nie zaczęte', 'noch nicht begonnen', 'not started yet'),
    stateStarted: L('zaczęte', 'begonnen', 'started'),
    stateDone: L('ukończone', 'abgeschlossen', 'finished'),
    stateKnown: (pct: number) => L(`znasz w ${pct}%`, `zu ${pct} % gekonnt`, `${pct}% known`),
    stateKnownAll: L('opanowane', 'gekonnt', 'known'),
    stateThere: L('postęp liczy się w tamtym świecie', 'der Fortschritt zählt in jener Welt', 'progress counts in that world'),
    loading: L('Otwieranie świata…', 'Welt wird geöffnet…', 'Opening the world…'),
    unavailable: L('niedostępne', 'nicht verfügbar', 'not available'),
    unavailableNote: L('Tego świata nie możesz czytać. Kto nie ma do niego dostępu, nie zobaczy tego linku — Ty widzisz go jako autor.', 'Diese Welt kannst du nicht lesen. Wer keinen Zugang hat, sieht diesen Verweis nicht — du siehst ihn als Autor.', 'You cannot read this world. Learners without access do not see this link — you see it as the author.'),
    broken: L('zerwany link', 'Verweis ins Leere', 'broken link'),
    brokenNote: (ref: string, world: string) => L(`W świecie „${world}” nie ma już „${ref}”.`, `In der Welt „${world}“ gibt es „${ref}“ nicht mehr.`, `“${ref}” no longer exists in the world “${world}”.`),
    unknownWorld: (handle: string) => L(`Nieznany świat „@${handle}” — dodaj go w Ustawieniach (Inne światy).`, `Unbekannte Welt „@${handle}“ — in den Einstellungen (Andere Welten) hinzufügen.`, `Unknown world “@${handle}” — add it in the Settings (Other worlds).`),
    back: (name: string) => L(`‹ Wróć do: ${name}`, `‹ Zurück zu: ${name}`, `‹ Back to: ${name}`),
    returnNote: L('Wrócisz do następnego kroku tutaj.', 'Danach geht es hier beim nächsten Schritt weiter.', 'You will come back to the next step here.'),
    skip: L('Dalej bez tego', 'Weiter ohne', 'Continue without'),
    next: L('Dalej', 'Weiter', 'Continue'),
    again: L('Przypomnij', 'Wiederholen', 'Revisit'),
    known: L('Już to znasz w tamtym świecie.', 'Das kennst du in jener Welt schon.', 'You already know this in that world.'),
    portals: (n: number) => L(`Portale do innych światów (${n})`, `Portale in andere Welten (${n})`, `Portals to other worlds (${n})`),
    portal: L('Portal do innego świata', 'Portal in eine andere Welt', 'Portal to another world'),
    /* Editor */
    pick: L('Link do innego świata…', 'Verweis in eine andere Welt…', 'Link to another world…'),
    pickTitle: L('Link do innego świata', 'Verweis in eine andere Welt', 'Link to another world'),
    pickBase: L('Świat (baza wiedzy)', 'Welt (Wissensbasis)', 'World (knowledge base)'),
    pickSearch: L('Szukaj tematu lub opowieści', 'Thema oder Geschichte suchen', 'Search a topic or story'),
    pickNone: L('Nic nie znaleziono.', 'Nichts gefunden.', 'Nothing found.'),
    pickNoBases: L('Nie masz dostępu do innych baz wiedzy.', 'Du hast keinen Zugang zu anderen Wissensbasen.', 'You have no access to other knowledge bases.'),
    pickUse: L('Wstaw link', 'Verweis einsetzen', 'Insert the link'),
    pickCancel: L('Anuluj', 'Abbrechen', 'Cancel'),
    pickOffer: L('To tylko propozycja: nigdy nie jest warunkiem ani nie liczy się do postępu tutaj.', 'Nur ein Angebot: nie eine Voraussetzung, zählt hier nicht zum Fortschritt.', 'Only an offer: never a prerequisite, never counts for progress here.'),
    pickCopy: L('Kopiuj jako link w tekście', 'Als Verweis im Text kopieren', 'Copy as a link in text'),
    copied: L('Skopiowano', 'Kopiert', 'Copied'),
    /* Ustawienia */
    settingsTitle: L('Inne światy', 'Andere Welten', 'Other worlds'),
    settingsHandle: L('Trwała nazwa tej bazy (dla linków z innych światów)', 'Bleibender Name dieser Basis (für Verweise aus anderen Welten)', 'Lasting name of this base (for links from other worlds)'),
    settingsHandleNote: L('Małe litery, cyfry i „-”; nie zmienia się przy zmianie nazwy bazy. Linki: @@nazwa:@temat.', 'Kleinbuchstaben, Ziffern und „-“; bleibt beim Umbenennen. Verweise: @@name:@thema.', 'Lower-case letters, digits and “-”; stays when the base is renamed. Links: @@name:@topic.'),
    settingsWorlds: L('Światy, do których prowadzą linki stąd', 'Welten, auf die von hier verwiesen wird', 'Worlds linked from here'),
    settingsNoWorlds: L('Jeszcze żadnych — dodaj je przez „Link do innego świata” albo import.', 'Noch keine — über „Verweis in eine andere Welt“ oder einen Import.', 'None yet — add them with “Link to another world” or an import.'),
    settingsRemove: L('Usuń', 'Entfernen', 'Remove'),
    settingsSave: L('Zapisz', 'Speichern', 'Save'),
    /* Do zrobienia */
    todoTitle: (n: number) => L(`Linki do innych światów do naprawy (${n})`, `Verweise in andere Welten zu reparieren (${n})`, `Links to other worlds to fix (${n})`),
    todoIn: L('w', 'in', 'in'),
    todoUnreadable: (world: string) => L(`świat „${world}” jest niedostępny`, `die Welt „${world}“ ist nicht lesbar`, `the world “${world}” is not readable`),
    todoChecking: L('Sprawdzanie linków do innych światów…', 'Verweise in andere Welten werden geprüft…', 'Checking links to other worlds…')
  };
}

export type WorldWords = ReturnType<typeof worldWords>;
