/**
 * 2026-11-09 — DIE WELTKARTE (documentation/world-map): Orte als freistehende Säulen, Erzählungen als Linien auf gemeinsamen
 * Gleisen. Hier die Formen, die alle reinen Module teilen — Eingang (`WorldInput`, reine Daten statt einer Bibliothek),
 * die gelesene Welt (`World`), die Linien (`Lines`) und die Meldungen für Autoren (`WmIssue`).
 *
 * Rein: kein DOM, kein React, keine Texte. Was ein Mensch liest, kommt über Schlüssel aus `locales/<lang>/cogitaWorld.json`.
 */

import type { Flow } from '../flow';

/** Der Startpunkt: flach auf dem Boden. Linien ohne Voraussetzungen beginnen hier. */
export const HOME = '~home';

/* -- Eingang ------------------------------------------------------------------------------------------------------------ */

/** Ein Verweis eines Eintrags mit der Rolle, die sein Feld im Schema erklärt. */
export interface WmRef {
  readonly field: string;
  readonly to: string;
  readonly prerequisite?: 'up' | 'down';
  /** `"part": "up"` — der Eintrag ist ein Teil des Blocks, auf den er zeigt (`down`: der Block nennt seine Teile). */
  readonly part?: 'up' | 'down';
  readonly structure?: 'up' | 'down';
}

export interface WmEntry {
  readonly id: string;
  readonly kinds: readonly string[];
  readonly label: string;
  readonly refs: readonly WmRef[];
}

/** Eine Karte, wie die Weltkarte sie braucht. `about`: die Einträge, die sie prüft (bei einer Vorlage: ihr Eintrag). */
export interface WmCardInput {
  readonly key: string;
  readonly question: string;
  readonly about: readonly string[];
  readonly explain?: readonly string[];
  /** Was davor kommt (Fragen oder Einträge) — nur für die Reihenfolge der Karten eines Ortes (Entscheidung 6). */
  readonly needs?: readonly string[];
  readonly core?: boolean;
  /** Aus einer Vorlage (sie prüft ihren Eintrag): zählt für den Ort, bestimmt aber nicht, welche Arten Orte sind. */
  readonly fromTemplate?: boolean;
}

export interface WorldInput {
  readonly entries: readonly WmEntry[];
  readonly cards: readonly WmCardInput[];
  /** Die Abläufe, aufgelöst (Vorlagen gefüllt; eine Präsentation als Graph, ihre Szenen mit `about`/`asks`). */
  readonly flows: readonly Flow[];
  /** Arten, die Fragen sind (Vorgabe: die eingebaute `question`). */
  readonly questionKinds?: readonly string[];
  /** Die Arten der Orte, wenn der Widok sie nennt (`source.kind`) — sonst abgeleitet (Entscheidung 1). */
  readonly placeKinds?: readonly string[];
  /** Weitere Voraussetzungen (die Kanten der Ustawienia). */
  readonly dependencies?: readonly { readonly parent: string; readonly child: string }[];
}

/* -- Meldungen für Autoren (§11) -------------------------------------------------------------------------------------- */

export const ISSUE_CODES = [
  'cycle', 'dangling', 'partAndPrerequisite', 'partOfSeveral', 'flowNoPlaces', 'unknownCondition', 'unreachableSteps',
  'flowStartsLate', 'membersNotDetoured', 'requiresSiblingPrerequisite', 'placesWithoutLine', 'cardsWithoutSlide',
  'lineStartsMid', 'noRoute', 'mislabelledRegion', 'unitMissing'
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

export interface WmIssue {
  readonly code: IssueCode;
  readonly level: 'error' | 'warning' | 'info';
  /** Die betroffenen Einträge, Abläufe oder Schritte — der erste ist der wichtigste. */
  readonly ids: readonly string[];
  readonly data?: Readonly<Record<string, string | number>>;
}

/* -- Die gelesene Welt -------------------------------------------------------------------------------------------------- */

export interface Place {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  /** Ihre Karten: zuerst, was andere Karten des Ortes brauchen (`needs`), sonst in der Reihenfolge des Eingangs. */
  readonly cards: readonly string[];
  /** Der Block, dessen Teil der Ort ist. */
  readonly block?: string;
  /** Was direkt davor kommt (Orte) — bereinigt: ohne Kreise innerhalb einer Gruppe, ohne baumelnde Verweise. */
  readonly needs: readonly string[];
  readonly builds: readonly string[];
  /** Die Gruppe eines Kreises (Index in `World.groups`). */
  readonly group?: number;
  /** 0: nichts davor; sonst eins mehr als die höchste Stufe davor (eine Gruppe als ein Knoten). */
  readonly depth: number;
}

/** Ein Block mit Teilen (nur, wo die Daten es sagen: `"part": "up"`, Entscheidung 3). */
export interface Block {
  readonly id: string;
  readonly label: string;
  readonly parts: readonly string[];
  /** Der Block hat eigene Karten — er ist dann selbst einer seiner Teile. */
  readonly own: boolean;
}

export interface World {
  readonly places: ReadonlyMap<string, Place>;
  /** Die Orte, die Grundlagen zuerst (Stufe, dann Name). */
  readonly order: readonly string[];
  readonly blocks: ReadonlyMap<string, Block>;
  readonly cards: ReadonlyMap<string, WmCardInput>;
  /** Je Karte die Orte, zu denen sie gehört. */
  readonly cardPlaces: ReadonlyMap<string, readonly string[]>;
  /** Je Frage (Kennung) ihre Karten. */
  readonly questionCards: ReadonlyMap<string, readonly string[]>;
  /** Je Eintrag, worüber Karten fragen („about"), diese Karten — auch für Einträge, die keine Orte sind. */
  readonly aboutCards: ReadonlyMap<string, readonly string[]>;
  readonly groups: readonly (readonly string[])[];
  readonly entries: ReadonlyMap<string, WmEntry>;
  readonly placeKinds: ReadonlySet<string>;
  readonly unitKinds: ReadonlySet<string>;
  /** Was ein Eintrag verlangt (Verweise mit „prerequisite", beide Richtungen, und die Ustawienia) — roh, für Einheiten. */
  readonly requires: (id: string) => readonly string[];
  /** Alles, was vor einem Ort kommt (transitive Hülle, ohne ihn selbst; die Mitglieder seiner Gruppe gehören dazu). */
  readonly base: (place: string) => ReadonlySet<string>;
  /** Dieselbe Hülle als Bitmenge über `bitOrder` (für Summen über viele Orte). */
  readonly baseBits: (place: string) => Uint32Array | undefined;
  readonly bitOrder: readonly string[];
  readonly issues: readonly WmIssue[];
}

/* -- Linien --------------------------------------------------------------------------------------------------------------- */

/** Woher ein Teil der Fahrkarte stammt (§5 des Berichts): (a) „Wymaga" der Einheit, (b) die Bedingung einer Möglichkeit, (c) ein Tor. */
export type TicketSource = 'unit' | 'option' | 'gate';

/** Eine Bedingung der Fahrkarte — dieselbe Sprache wie in den Abläufen (`logic.ts`), dazu die Typen der Weltkarte. */
export interface WmCondition {
  readonly type: string;
  readonly items?: readonly WmCondition[];
  readonly [field: string]: unknown;
}

export interface TicketPart {
  readonly source: TicketSource;
  /** Der Schritt, an dem sie steht (eine Wahl, ein Tor). */
  readonly step?: string;
  readonly condition: WmCondition;
}

export type SectionKind = 'entry' | 'main' | 'return';

export interface Section {
  readonly id: string;
  /** Die Linie (die Kennung ihres Ablaufs). */
  readonly line: string;
  /** Der Zweig (die Linie selbst für den Stamm). */
  readonly branch: string;
  /** Ein Ort oder `HOME`. Gleich `to`: Inhalt an einem Ort ohne Weg (kein Gleis). */
  readonly from: string;
  readonly to: string;
  readonly kind: SectionKind;
  /** Die Schritte (Kennungen im Ablauf der Linie; ein eingebetteter Abschnitt als `<subflow>>…`). */
  readonly steps: readonly string[];
  /** Step 3 · 4 — die Schritte, die eine Karte fragen: sind alle besucht, ist der Abschnitt befahren (auch ohne seinen letzten). */
  readonly questions: readonly string[];
  readonly slides: number;
  /** Die Karten, die hier zuerst gefragt werden (geborgte eingeschlossen). */
  readonly introduces: readonly string[];
  readonly ticket: readonly TicketPart[];
  /** Wo der Spieler den Abschnitt öffnet: ein Schritt, bei einem Zweig die Wahl und ihr Ausgang. */
  readonly start?: { readonly step: string; readonly exit?: string };
  /** Bei Ein- und Rückfahrt eines Abstechers: die rufenden Linien. */
  readonly callers?: readonly string[];
}

export interface LineBranch {
  readonly id: string;
  readonly line: string;
  readonly parent: string | null;
  /** Die Wahl, an der er beginnt, und ihr Ausgang (null: der Stamm). */
  readonly fork: { readonly step: string; readonly exit: string; readonly label: string } | null;
  readonly sections: readonly string[];
}

export interface Line {
  readonly id: string;
  readonly name: string;
  readonly unit?: string;
  /** Ein Abstecher-Ziel (eine Vertiefung): ruft ihn eine andere Linie, beginnt und endet er bei ihr (R4). */
  readonly deepening: boolean;
  /** Wer ihn wie oft ruft (Linie → Zahl der Abstecher-Schritte). */
  readonly calledBy: ReadonlyMap<string, number>;
  /** Die Halte des Stammes, in Reihenfolge. */
  readonly stops: readonly string[];
  readonly branches: readonly LineBranch[];
  readonly sections: readonly string[];
  /** Der Ort, an dem der Stamm beginnt (R3): ein Ort, den die Einheit verlangt, sonst `HOME`; bei einer Vertiefung null. */
  readonly start: string | null;
}

/** Ein Umsteigeort: hier halten mehrere Linien, ein Zweig beginnt oder endet, ein Abstecher fährt ab (§4.5). */
export interface Station {
  readonly place: string;
  readonly lines: readonly string[];
  /** Die Abschnitte, die hier abfahren. */
  readonly out: readonly string[];
  /** Wahlen, die hier zwischen Zweigen entscheiden: Ablauf, Schritt, Ausgänge → Zweig. */
  readonly forks: readonly { readonly line: string; readonly step: string; readonly branches: readonly string[] }[];
}

export interface Lines {
  readonly lines: ReadonlyMap<string, Line>;
  readonly sections: ReadonlyMap<string, Section>;
  readonly stations: ReadonlyMap<string, Station>;
  /** Je Karte die Abschnitte, die sie einführen. */
  readonly introducedBy: ReadonlyMap<string, readonly string[]>;
  /** Eingebettete Schritte (`<subflow>>…`): der Ablauf, dem sie gehören. */
  readonly stepFlow: ReadonlyMap<string, string>;
  readonly issues: readonly WmIssue[];
}
