/**
 * Was ein Baustein IST — an einer Stelle.
 *
 * <b>Vorher stand eine Art an vier Stellen.</b> Ihre Felder im Katalog, ihr
 * Aussehen in einer Verzweigung nach `kind`, die drei Platz-Bausteine in einer
 * ZWEITEN Verzweigung darin, ihre Grösse wieder im Katalog. Wer einen
 * Feldnamen umbenannte, bekam keine Fehlermeldung — er bekam eine Kachel, die
 * leer blieb, und zwar auf jeder Seite, auf der sie stand.
 *
 * <b>Hier gehört eine Art sich selbst.</b> Eine Datei sagt, wie sie heisst,
 * wozu sie da ist, was sie trägt, wann sie etwas zu zeigen hat, wie sie
 * aussieht und wie man sie füllt. Eine neue Art hinzuzufügen heisst: eine Datei
 * schreiben und sie in `parts/registry.ts` eintragen. Die Seite, der Editor und
 * der Dienst bleiben, wie sie sind.
 *
 * <b>Die Idee ist aus dem Altbestand.</b> Die Ereignisseiten machen es seit
 * Langem so (`definePart` in `legacy/pages/events/parts/contracts.ts`), und
 * dort steht der Satz, um den es geht: „Adding a part means writing one file
 * and adding it here." Der Neubau hatte das verloren.
 *
 * <b>Was gespeichert wird, bleibt eine flache Zeichenkettentafel.</b> So liegt
 * es in `slug_part.config`, so liegt es auf den Seiten, die es schon gibt. Der
 * Baustein LIEST daraus seine eigene Gestalt — `days` wird eine Zahl, `editable`
 * ein Ja oder Nein —, und dieses Lesen geschieht einmal und nicht in dem Zweig,
 * der es gerade braucht.
 */

import { createElement, type ComponentType } from 'react';

/* -- Wie gross er ist — in Worten ------------------------------------------ */

/**
 * DIE GRÖSSE EINES BAUSTEINS, als das, was sie für den Inhalt bedeutet.
 *
 * <b>Eine grössere Kachel ist nicht dieselbe Ansicht, aufgeblasen — und eine
 * kleinere nicht dieselbe, abgeschnitten.</b> Jede Grösse ist eine eigene
 * Zusage: ein Streifen sagt EINE Sache, ein Block eine Übersicht, eine hohe
 * Kachel das Ganze. Jede Art entscheidet selbst, was das für sie heisst, und
 * sagt es dem Editor (`shows`), damit man beim Ziehen an der Kante sieht, was
 * man gerade wählt.
 *
 * Die Stufen folgen dem Raster (`layout.ts`): Breiten rasten auf 2, 3, 4, 6
 * Spalten, Höhen auf 1, 3, 5 Zeilen. Eine Spalte ist auf jedem Gerät ungefähr
 * gleich breit — sechs am Schreibtisch, zwei auf dem Telefon —, also heisst
 * „schmal" überall ungefähr dasselbe: eine Handbreit Text.
 *
 * <code>
 *   Breite   narrow 2 · medium 3 · wide 4 · full 6
 *   Höhe     strip 1 (eine Zeile) · block 3 (eine Übersicht) · tall 5 (alles)
 * </code>
 *
 * Auf der Seite ist die Höhe keine feste Pixelzahl: die Kachel wächst mit
 * ihrem Inhalt. Die Zeilenzahl ist die Frage „wie viel davon" — und genau
 * deshalb muss jede Art sie beantworten.
 */
export type PartWidth = 'narrow' | 'medium' | 'wide' | 'full';
export type PartHeight = 'strip' | 'block' | 'tall';

export interface PartSize {
  readonly colSpan: number;
  readonly rowSpan: number;
  readonly width: PartWidth;
  readonly height: PartHeight;
}

export function partSize(box: { readonly colSpan: number; readonly rowSpan: number }): PartSize {
  const colSpan = Math.max(1, Math.trunc(box.colSpan));
  const rowSpan = Math.max(1, Math.trunc(box.rowSpan));

  return {
    colSpan,
    rowSpan,
    width: colSpan <= 2 ? 'narrow' : colSpan === 3 ? 'medium' : colSpan === 4 ? 'wide' : 'full',
    height: rowSpan <= 1 ? 'strip' : rowSpan <= 3 ? 'block' : 'tall'
  };
}

/** Wie die Grösse im Editor heisst — „wąski blok", „pełna szerokość · pasek". */
export const SIZE_WORD: { readonly width: Record<PartWidth, string>; readonly height: Record<PartHeight, string> } = {
  width: { narrow: 'wąski', medium: 'średni', wide: 'szeroki', full: 'na całą szerokość' },
  height: { strip: 'pasek', block: 'blok', tall: 'wysoki' }
};

/* -- Was ein Baustein über seine Umgebung wissen darf ----------------------- */

/**
 * Bewusst KLEIN.
 *
 * Was hier steht, kann ein Baustein nicht selbst herausfinden; alles andere
 * holt er sich (den Platz über `useSeat`, die Bildschirmgrösse über sein
 * eigenes Mass). Die Adresse der Seite steht ABSICHTLICH nicht darin: ein
 * Baustein ist dasselbe, gleich wo er hängt.
 */
export interface PartContext {
  /**
   * DER BAUSTEIN, nicht die Stelle, an der er steht.
   *
   * <b>Daran hängen die Fragen eines Bogens und die Antworten darauf.</b>
   * Bis eben war es dieselbe Kennung wie die der Stelle, und deshalb fiel
   * nicht auf, dass hier die falsche stand. Sobald derselbe Bogen auf einer
   * zweiten Seite liegt, sind es zwei Kennungen — und die der Stelle führt
   * zu einem Bogen ohne Fragen.
   */
  readonly moduleId: string;

  /** Wie gross er ist — und damit, WAS er zeigt, nicht nur wie gross. */
  readonly size: PartSize;

  /**
   * 0058 — IM VOLLBILD. Dieselbe Grösse wie eine 6×5-Kachel, aber mehr als
   * sie: hier darf ein Baustein mehr anbieten — der Kalender etwa das
   * Eintragen für die, die ihn führen.
   */
  readonly whole?: boolean;
}

/* -- Die Felder, mit denen man ihn füllt ------------------------------------ */

/**
 * `resource` ist ein Ding aus den Rezerwacje, gewählt statt getippt: seine
 * Kennung ist eine UUID, und wer eine abtippen soll, schreibt stattdessen,
 * wie er das Ding nennt.
 */
/**
 * Wie ein Feld eingegeben wird.
 *
 * `form` wählt ein Formular (einen Baustein der Art `form`); `questions`
 * wählt dessen Fragen — welches Formular, steht im Feld, das `of` nennt.
 * Gespeichert wird `*` (alle, auch später hinzugefügte) oder die Kennungen,
 * durch Kommas getrennt.
 *
 * `chat` wählt eine Rozmowa einer Gruppe — dieselbe Überlegung wie bei
 * `calendar`: eine Kennung tippt niemand ab, also steht dort der Name der
 * Gruppe. Gewählt wird im Editor UND im Bausteinverwalter; beide zeichnen
 * dieselben Felder, und eine Art, die nur einer von beiden kennt, ist ein
 * Feld, das an der anderen Stelle zum Textkasten wird.
 */
export type FieldKind = 'line' | 'text' | 'resource' | 'form' | 'questions' | 'calendar' | 'calendars' | 'chat';

export interface FieldDef {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;

  /** Ein Beispiel, kein Vorgabewert — es wird nicht gespeichert. */
  readonly hint?: string;

  /** Bei `questions`: der Schlüssel des Feldes, das das Formular nennt. */
  readonly of?: string;
}

/* -- Ein Baustein, so wie ihn das Verzeichnis hält -------------------------- */

/** Die flache Tafel, wie sie gespeichert liegt. */
export type RawConfig = Record<string, string>;

export interface PartModule {
  readonly kind: string;
  readonly label: string;

  /**
   * WOZU er da ist, in einer Zeile.
   *
   * Der Editor zeigte bisher nur den Namen. „Formularz" sagt, was es ist, und
   * nicht, wann man es nimmt — und wer zwölf Namen nebeneinander sieht, rät.
   */
  readonly use: string;

  /** Vorgabegrösse im Raster. Abgelesen, nicht geraten: ein Text ist breit, ein Hinweis flach. */
  readonly box: { readonly colSpan: number; readonly rowSpan: number };

  /** Nimmt er Einsendungen an? Dann muss dastehen, wem sie gehören (0038). */
  readonly takes: boolean;

  readonly fields: readonly FieldDef[];

  /**
   * HAT ER ETWAS ZU ZEIGEN?
   *
   * <b>Das löst `live` ab.</b> Vorher galt: eine Kachel mit leerem `config`
   * verschwindet — ausser die Art trug das Merkmal `live`, dann nicht. Das war
   * eine Ausnahme von einer Regel, und beide standen woanders als die Art, für
   * die sie galten.
   *
   * Jetzt antwortet jede Art selbst. Ein Text hat etwas zu zeigen, wenn Text
   * dasteht; ein Messplan immer, weil sein Inhalt anderswo liegt. Dieselbe
   * Frage, und die Antwort steht bei dem, der sie geben kann.
   */
  readonly hasContent: (raw: RawConfig) => boolean;

  /**
   * WAS NOCH FEHLT, in Worten — oder `null`.
   *
   * `hasContent` fragt, ob die Kachel etwas zu zeigen hat; das hier, ob sie
   * vollständig eingestellt ist. Nicht dasselbe: ein Portalbaustein zeigt
   * immer etwas, muss aber sagen, AUS WELCHEM Formular. Der Editor schreibt
   * es an die Kachel („do uzupełnienia") und darüber, was zu tun ist.
   */
  readonly missing: (raw: RawConfig) => string | null;

  readonly View: ComponentType<{ readonly raw: RawConfig; readonly ctx: PartContext }>;

  /**
   * WAS ER IN DIESER GRÖSSE ZEIGT, in einem Satz — für den Editor, der ihn an
   * die Kachel schreibt. Wer an der Kante zieht, soll sehen, was er wählt, und
   * nicht erst auf der fertigen Seite.
   */
  readonly shows: (raw: RawConfig, size: PartSize) => string;

  /**
   * IN EINEN STREIFEN PASST ER NICHT — ein Formular, eine Buchung, eine
   * Rozmowa. Dann steht dort seine Überschrift und ein Knopf, der ihn an Ort
   * und Stelle aufklappt; `null`: er hat für den Streifen eine eigene Gestalt.
   */
  readonly strip: { readonly title: string; readonly open: string } | null;

  /**
   * 0054 — KANN ER DAS GANZE FENSTER BRAUCHEN? Ein Messplan mit Kalender,
   * eine Buchung, ein langes Formular, eine Rozmowa, ein langer Text: an der
   * Kachel steht dann ein Knopf, und im ganzen Fenster zeigt er sich in seiner
   * grössten Gestalt — gleich, wie klein er auf der Seite steht.
   */
  readonly fullscreen: boolean;

  /**
   * Der duldsame Leser allein, Tafel hinein und Gestalt heraus.
   *
   * Er steht hier, damit sich prüfen lässt, was ein halb ausgefüllter Baustein
   * ergibt — ohne Browser. Genau dort verschwand im Altbestand einmal ein
   * frisch angelegter Eintrag, und der Knopf sah aus, als täte er nichts.
   */
  readonly read: (raw: RawConfig) => unknown;
}

/**
 * Eine Art beschreiben — getippt innen, austauschbar aussen.
 *
 * Der Blick und die Gestalt `C` bleiben im Baustein; das Verzeichnis sieht nur
 * die Tafel. Deshalb können zwölf Arten mit zwölf verschiedenen Gestalten
 * nebeneinander in einer Liste liegen.
 */
export function definePart<C>(spec: {
  kind: string;
  label: string;
  use: string;
  box: { colSpan: number; rowSpan: number };
  takes?: boolean;
  fields: readonly FieldDef[];
  read: (raw: RawConfig) => C;
  hasContent: (config: C) => boolean;
  missing?: (config: C) => string | null;
  View: ComponentType<{ config: C; ctx: PartContext }>;
  shows: (config: C, size: PartSize) => string;
  strip?: { title: string; open: string };
  fullscreen?: boolean;
}): PartModule {
  /*
   * Als echtes Bauteil eingehängt und nicht als Funktion aufgerufen: sonst
   * dürfte kein Baustein einen Haken benutzen, und drei von ihnen holen sich
   * den Platz über einen.
   */
  const View: PartModule['View'] = ({ raw, ctx }) =>
    createElement(spec.View, { config: spec.read(raw), ctx });

  View.displayName = `Part(${spec.kind})`;

  return {
    kind: spec.kind,
    label: spec.label,
    use: spec.use,
    box: spec.box,
    takes: spec.takes ?? false,
    fields: spec.fields,
    hasContent: (raw) => spec.hasContent(spec.read(raw)),
    missing: (raw) => spec.missing?.(spec.read(raw)) ?? null,
    View,
    shows: (raw, size) => spec.shows(spec.read(raw), size),
    strip: spec.strip ?? null,
    fullscreen: spec.fullscreen ?? false,
    read: spec.read
  };
}

/* -- Duldsame Leser --------------------------------------------------------- */

/*
 * Was hier ankommt, hat der Dienst als Zeichenkette durchgereicht: er liest es
 * nicht und prüft es nicht. Jeder Leser gibt deshalb einen brauchbaren Wert
 * zurück, statt zu werfen — ein kaputtes Feld darf nie eine Seite leeren.
 */

export const text = (raw: RawConfig, key: string): string => (raw[key] ?? '').trim();

/** Zeilen eines mehrzeiligen Feldes, ohne die leeren dazwischen. */
export const lines = (raw: RawConfig, key: string): readonly string[] =>
  text(raw, key).split('\n').map((one) => one.trim()).filter((one) => one !== '');

/**
 * Eine Zahl — oder `null`, wenn keine dasteht.
 *
 * <b>Kein Vorgabewert, und das ist der Punkt.</b> Wer hier eine Sieben
 * einsetzte, könnte nicht mehr unterscheiden zwischen „sieben Tage" und
 * „such dir aus, was passt" — und der Messplan macht daraus zwei verschiedene
 * Kacheln.
 */
export function maybeNumber(raw: RawConfig, key: string): number | null {
  const said = text(raw, key);
  if (said === '') return null;

  const parsed = Number.parseInt(said, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Eine Auswahl von Kennungen (`questions`).
 *
 * `null` — nichts gewählt; `'all'` — alle, auch später hinzugefügte (`*`);
 * sonst die genannten. Leere Teile fallen weg: ein Komma zu viel ist kein
 * zusätzliches Feld.
 */
export function picked(raw: RawConfig, key: string): 'all' | ReadonlySet<string> | null {
  const said = text(raw, key);
  if (said === '') return null;
  if (said === '*') return 'all';

  const ids = said.split(',').map((one) => one.trim()).filter((one) => one !== '');
  return ids.length === 0 ? null : new Set(ids);
}

/**
 * Ja oder Nein aus einem Textfeld.
 *
 * <b>Die Vorgabe zählt, und sie ist ein Argument.</b> „Darf man das berichtigen"
 * ist mit JA vorbelegt: die Angabe gehört dem Menschen, und wer sie festnageln
 * will, soll das ausdrücklich tun. Ein leeres Feld heisst deshalb nicht
 * „nein", sondern „wie vorgesehen".
 */
export function flag(raw: RawConfig, key: string, fallback: boolean): boolean {
  const said = text(raw, key).toLowerCase();
  if (said === '') return fallback;

  if (['tak', 'yes', 'true', '1'].includes(said)) return true;
  if (['nie', 'no', 'false', '0'].includes(said)) return false;

  return fallback;
}

/**
 * Eine Zeile „Beschriftung — pfad".
 *
 * Beide Striche gelten: der lange, den ein Textprogramm daraus macht, und der
 * kurze mit Leerzeichen, den man tippt. Wer sie unterscheidet, bestraft das
 * Abtippen.
 */
export function readLink(line: string): { label: string; path: string } | null {
  const text = line.trim();
  if (text === '') return null;

  const at = text.indexOf('—') >= 0 ? text.indexOf('—') : text.indexOf(' - ');
  if (at < 0) return { label: text, path: text };

  const label = text.slice(0, at).trim();
  const path = text.slice(at + (text[at] === '—' ? 1 : 3)).trim().replace(/^\/+/, '');

  return path === '' ? null : { label: label === '' ? path : label, path };
}
