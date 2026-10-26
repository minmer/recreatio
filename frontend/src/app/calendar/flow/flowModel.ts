/**
 * 2026-10-26 — DIE ABLÄUFE DES KALENDERS (React Flow), als Daten.
 *
 * Zwei Arten, ein Modell:
 *
 * <b>Plan</b> (`PlanDef.flow`): wird von einem Browser, der im Kalender
 * schreibt, auf einen gewählten Zeitraum angewandt und legt EINZELNE Termine an,
 * die danach nichts mehr mit dem Ablauf zu tun haben. Zwei Einstiege:
 * `day` — für jeden Tag einmal: das Kirchenjahr (`season`), die Feste
 * (`feasts`), Bedingungen und Werte, bis ein Knoten `slots` sagt, welche Messen
 * es an dem Tag gibt (oder `skip`: keine); `mass` — für jede dieser Messen:
 * Bedingungen, Titel und Werte (`set`), feste Einträge (`record`, z. B. „Za
 * parafian" am Sonntag 12:13), bis `end` (anlegen) oder `skip` (nicht).
 *
 * <b>Regel</b> (`RecordList.rule`): läuft, wenn ein Eintrag (eine Intention, eine
 * Anmeldung) dazukommen oder angenommen werden soll — `record-start`,
 * Bedingungen über Art, Zahl, wer einträgt, bis `allow` / `wait` / `refuse`.
 *
 * Das Wissen über das Kirchenjahr steht im Ablauf des Nutzers (Namen, Rang,
 * Farbe, welche Abendmesse eine Votivmesse ist). Die App rechnet nur, was sich
 * jedes Jahr verschiebt: Ostern und was daran hängt, den ersten Advent, die
 * Woche eines Abschnitts (`liturgy.ts`).
 */

/** Wochentag: 1 = Montag … 7 = Sonntag (wie überall im Kalender). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Die Abschnitte des Kirchenjahres, wie `liturgy.ts` sie rechnet. */
export const SEASONS = ['adwent', 'narodzenie', 'zwykly', 'post', 'triduum', 'wielkanoc'] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_LABEL: Record<Season, string> = {
  adwent: 'Adwent',
  narodzenie: 'Okres Narodzenia Pańskiego',
  zwykly: 'Okres zwykły',
  post: 'Wielki Post',
  triduum: 'Triduum Paschalne',
  wielkanoc: 'Okres wielkanocny'
};

/**
 * WANN — eine Regel für ein Datum, das sich (vielleicht) jedes Jahr verschiebt.
 *
 * <code>
 *   fixed            jedes Jahr am selben Tag (1 = Januar)
 *   easter           Tage ab dem Ostersonntag (−46 Popielec, +49 Zesłanie, +60 Boże Ciało)
 *   advent           Tage ab dem ersten Adventssonntag (−7 Chrystusa Króla)
 *   christmas-sunday Święta Rodzina: der Sonntag in der Oktav, sonst der 30. Dezember
 *   baptism          Chrzest Pański: der Sonntag nach dem 6. Januar
 *   nth-weekday      der n-te (−1: letzte) Wochentag eines Monats — ohne Monat: jeden Monat
 *   sunday-after     der erste Sonntag NACH einem Tag (nicht an ihm)
 * </code>
 */
export type DateRule =
  | { readonly r: 'fixed'; readonly month: number; readonly day: number }
  | { readonly r: 'easter'; readonly offset: number }
  | { readonly r: 'advent'; readonly offset: number }
  | { readonly r: 'christmas-sunday' }
  | { readonly r: 'baptism' }
  | { readonly r: 'nth-weekday'; readonly n: 1 | 2 | 3 | 4 | 5 | -1; readonly weekday: Weekday; readonly month?: number }
  | { readonly r: 'sunday-after'; readonly month: number; readonly day: number };

/** Ein Fest im Knoten `feasts`. Rang wie in der Tabelle der liturgischen Tage: 1 = höchster, 13 = Wochentag. */
export interface FeastRow {
  readonly name: string;
  readonly when: DateRule;
  readonly rank: number;
  readonly colour: string;
  /** Ein Tag mit den Gottesdiensten des Sonntags (gebotener Feiertag). */
  readonly festive?: boolean;
  /** Titel der Messe — fehlt er, der Name. */
  readonly title?: string;
  /** Verdrängt (der Tag hat einen höheren Rang): am nächsten Tag gefeiert. */
  readonly moveIfImpeded?: boolean;
}

/** Eine Messe im Knoten `slots`. */
export interface SlotRow {
  /** Bleibt — an ihm erkennt die Vorschau „schon geplant" (`plan_origin`). */
  readonly key: string;
  readonly label?: string;
  /** „HH:MM". */
  readonly time: string;
  readonly minutes: number;
  /** Nur in `weekdays`: an welchen Wochentagen (fehlt: Montag bis Samstag). */
  readonly days?: readonly Weekday[];
}

export type Compare = '<' | '<=' | '=' | '>=' | '>' | '!=';

/** Was ein Knoten `if` prüft. Die ersten gelten im Plan, die letzten vier in einer Regel. */
export type Test =
  | { readonly t: 'weekday'; readonly days: readonly Weekday[] }
  | { readonly t: 'slot'; readonly keys: readonly string[] }
  | { readonly t: 'time'; readonly from?: string; readonly to?: string }
  | { readonly t: 'season'; readonly seasons: readonly Season[] }
  | { readonly t: 'week'; readonly op: Compare; readonly n: number }
  | { readonly t: 'rank'; readonly op: Compare; readonly n: number }
  | { readonly t: 'celebration'; readonly is: 'any' | 'none' | 'name'; readonly name?: string }
  | { readonly t: 'festive' }
  | { readonly t: 'sunday' }
  | { readonly t: 'date'; readonly rule: DateRule }
  | { readonly t: 'between'; readonly from: string; readonly to: string }
  | { readonly t: 'var'; readonly name: string; readonly op: '=' | '!=' | 'contains'; readonly value: string }
  | { readonly t: 'mode'; readonly modes: readonly string[] }
  | {
      /* Wie viele Einträge dieser Liste — am Vorkommen oder in der Woche; `per: 'occurrence'`: an wie vielen Vorkommen der Woche (ohne dieses). */
      readonly t: 'count'; readonly scope: 'occurrence' | 'week'; readonly mode?: string;
      readonly status?: 'live' | 'all'; readonly per?: 'record' | 'occurrence'; readonly op: Compare; readonly n: number;
    }
  | { readonly t: 'actor'; readonly is: 'office' | 'outside' }
  | { readonly t: 'field'; readonly key: string; readonly op: 'set' | 'empty' | '='; readonly value?: string };

/** Was ein Knoten `if` prüfen kann — im Plan und in einer Regel (der Editor bietet sie so an, der JSON-Baum beschreibt sie so). */
export const PLAN_TESTS = ['weekday', 'slot', 'time', 'season', 'week', 'rank', 'celebration', 'festive', 'sunday', 'date', 'between', 'var'] as const satisfies readonly Test['t'][];
export const RULE_TESTS = ['mode', 'count', 'actor', 'field'] as const satisfies readonly Test['t'][];

/*
 * Die Daten der Knoten. Texte (`title`, `value`, `text`) dürfen Platzhalter
 * tragen: {celebration} {title} {season} {seasonName} {week} {weekRoman}
 * {sundayName} {colour} {date} {time} {slot} — und jede Variable aus `set`.
 */
export interface SeasonData {
  /** Die Farbe jedes Abschnitts — vom Nutzer, die Vorlage füllt sie. */
  readonly colours?: Partial<Record<Season, string>>;
  /** Besondere Tage: Gaudete, Laetare, Palmsonntag, Karfreitag, Pfingsten. */
  readonly special?: Partial<Record<'gaudete' | 'laetare' | 'palm' | 'goodFriday' | 'pentecost', string>>;
}
export interface FeastsData { readonly rows: readonly FeastRow[] }
export interface IfData { readonly test: Test }
export interface SetData {
  /** `title` — der Titel der Messe; `field` — ein Feld ihres Schemas; `var` — eine Variable (z. B. `colour`). */
  readonly target: 'title' | 'field' | 'var';
  readonly key?: string;
  readonly value: string;
}
export interface SlotsData {
  /** An Sonntagen und gebotenen Feiertagen. */
  readonly festive: readonly SlotRow[];
  /** An den übrigen Tagen (je Zeile: welche Wochentage). */
  readonly weekdays: readonly SlotRow[];
}
export interface RecordData {
  /** Die Liste des Schemas (`intencje`). */
  readonly list: string;
  readonly mode?: string;
  /** Der offene Text (die vorgelesene Intention). */
  readonly text: string;
}
export interface MessageData { readonly message?: string }

export const PLAN_NODES = ['day', 'mass', 'season', 'feasts', 'if', 'set', 'slots', 'record', 'skip', 'end'] as const;
export const RULE_NODES = ['record-start', 'if', 'allow', 'wait', 'refuse'] as const;
export type FlowNodeType = (typeof PLAN_NODES)[number] | (typeof RULE_NODES)[number];

/** Die Ausgänge eines Knotens: `out` — weiter; `yes` / `no` — nach einer Bedingung. */
export type FlowOut = 'out' | 'yes' | 'no';

export interface FlowNode {
  readonly id: string;
  readonly type: FlowNodeType;
  /** Wo er auf der Fläche steht. */
  readonly x: number;
  readonly y: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface FlowEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** Fehlt: `out`. */
  readonly out?: FlowOut;
}

export interface FlowDoc {
  readonly v: 1;
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
}

export const EMPTY_FLOW: FlowDoc = { v: 1, nodes: [], edges: [] };

/** Wie ein Knoten heisst, welche Ausgänge er hat, und ob er ein Ende ist. */
export const NODE_INFO: Record<FlowNodeType, { readonly label: string; readonly outs: readonly FlowOut[]; readonly entry?: boolean; readonly says: string }> = {
  day: { label: 'Dzień', outs: ['out'], entry: true, says: 'Początek dla każdego dnia zakresu.' },
  mass: { label: 'Msza', outs: ['out'], entry: true, says: 'Początek dla każdej mszy dnia (z węzła „Godziny”).' },
  season: { label: 'Okres liturgiczny', outs: ['out'], says: 'Liczy okres, tydzień, rangę dnia i kolor okresu.' },
  feasts: { label: 'Kalendarz świąt', outs: ['out'], says: 'Wybiera obchód dnia z tabeli (najwyższa ranga wygrywa).' },
  if: { label: 'Warunek', outs: ['yes', 'no'], says: 'Sprawdza dzień, mszę albo wpis — dalej „tak” albo „nie”.' },
  set: { label: 'Ustaw', outs: ['out'], says: 'Ustawia tytuł, pole schematu albo zmienną.' },
  slots: { label: 'Godziny mszy', outs: [], says: 'Mówi, jakie msze są tego dnia (niedziele i święta / dni powszednie).' },
  record: { label: 'Dodaj wpis', outs: ['out'], says: 'Dodaje do mszy stały wpis, np. intencję „Za parafian”.' },
  skip: { label: 'Bez mszy', outs: [], says: 'Tego dnia (tej godziny) nie ma mszy.' },
  end: { label: 'Utwórz', outs: [], says: 'Mszę tworzy się z tym, co ustawiono po drodze.' },
  'record-start': { label: 'Nowy wpis', outs: ['out'], entry: true, says: 'Początek: ktoś dodaje albo przyjmuje wpis.' },
  allow: { label: 'Przyjmij', outs: [], says: 'Wpis zostaje przyjęty.' },
  wait: { label: 'Czeka', outs: [], says: 'Wpis czeka, aż przyjmie go kancelaria.' },
  refuse: { label: 'Odmów', outs: [], says: 'Wpisu nie da się dodać — z tym komunikatem.' }
};

/** Die Tage eines geplanten Zeitraums und die Messen, wie der Plan sie anlegen würde. */
export interface PlanCtx {
  /** „YYYY-MM-DD", Ortszeit. */
  readonly date: string;
  readonly weekday: Weekday;
  readonly sunday: boolean;
  readonly season: Season;
  readonly week: number;
  /** Der Rang des Tages selbst (Sonntag im Advent 2, gewöhnlicher Sonntag 6, Wochentag 13 …). */
  readonly dayRank: number;
  readonly seasonName: string;
  /** „III Niedziela Adwentu" — an Sonntagen. */
  readonly sundayName: string;
  readonly colour: string;
  readonly celebration: { readonly name: string; readonly rank: number; readonly colour: string; readonly festive: boolean; readonly title: string } | null;
  readonly festive: boolean;
  readonly vars: Readonly<Record<string, string>>;
}

export interface PlannedMass {
  readonly date: string;
  readonly slot: SlotRow;
  readonly title: string;
  /** Feld des Schemas → Text. */
  readonly values: Readonly<Record<string, string>>;
  readonly records: readonly { readonly list: string; readonly mode?: string; readonly text: string }[];
  /** Die Knoten, durch die es ging — für die Vorschau. */
  readonly trace: readonly string[];
}

export interface PlannedDay {
  readonly date: string;
  readonly ctx: PlanCtx;
  readonly masses: readonly PlannedMass[];
  /** Was nicht ging (ein Knoten ohne Ausgang, eine Schleife) — für die Vorschau. */
  readonly problems: readonly string[];
}

export type RuleVerdict = 'allow' | 'wait' | 'refuse';

export interface RuleCtx {
  readonly actor: 'office' | 'outside';
  readonly date: string;
  readonly weekday: Weekday;
  readonly record: { readonly mode?: string; readonly values: Readonly<Record<string, string>> };
  /** Die Einträge DIESER Liste am selben Vorkommen (ohne den neuen). */
  readonly occurrence: readonly { readonly mode?: string; readonly status: string }[];
  /** Die Einträge dieser Liste an allen Vorkommen derselben Woche (Montag bis Sonntag) im selben Kalender — mit ihrem Vorkommen (Termin + Beginn). */
  readonly week: readonly { readonly mode?: string; readonly status: string; readonly occurrence: string }[];
  /** Das Vorkommen dieses Eintrags (Termin + Beginn), wie in `week`. */
  readonly here: string;
}

export interface RuleResult {
  readonly verdict: RuleVerdict;
  readonly message?: string;
}
