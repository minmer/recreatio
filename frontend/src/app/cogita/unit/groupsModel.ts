/**
 * 2026-11-24 (Eigentümer: „in Gruppen — jede und jeder auf dem eigenen Telefon, die Gruppe einigt sich auf EINE Antwort") —
 * GRUPPENARBEIT in einem Etap einer Einheit. Rein: Gruppen bilden (gemischt mit einem Samen je Etap, Nachzügler in die kleinste
 * Gruppe, ein Mitglied umsetzen), aus den Antworten der Mitglieder den Stand je Gruppe und Frage (denkt nach · uneinig · einig ·
 * vom Lehrer geschlossen), und die Zählung für die Konsole. Kein React, kein Netz — `scripts/app-groups-check.mjs`.
 *
 * <code>
 *   Etap        work: "together" | "alone" | "groups", groupSize 2–6 (Vorgabe 3)
 *   Lehrer      unit-groups  {stage, groups: [[teilnehmer…]…], seed, at}          wer in welcher Gruppe ist (letztes gilt)
 *               unit-gstate  {stage, item, at, groups: [GroupView]}             was jede Gruppe sieht (ohne Namen: Initialen)
 *               unit-gclose  {stage, item, q, group, at}                        „Zamknij": die Mehrheit gilt als Antwort der Gruppe
 *   Schüler     prompt       {participant, stage, item, group: {q, given, label}, at}   die eigene Antwort (nur der Lehrer liest sie)
 * </code>
 *
 * Wer was sieht: die Antworten gehen versiegelt an die Przyjęcia der Klasse — nur der Lehrer öffnet sie. Seine Konsole gibt je
 * Gruppe eine kurze Zusammenfassung zurück (Initialen und die gewählte Antwort als Wort), versiegelt mit dem Schlüssel der
 * Sitzung: ihn haben alle Teilnehmer, ein Telefon ZEIGT nur die eigene Gruppe. Der eigene Fortschritt zählt die eigene Antwort.
 */

export type StageWork = 'together' | 'alone' | 'groups';
export const GROUP_MIN = 2;
export const GROUP_MAX = 6;
export const GROUP_DEFAULT = 3;

export const clampGroupSize = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(GROUP_MIN, Math.min(GROUP_MAX, Math.round(n))) : GROUP_DEFAULT;

/* -- Gruppen bilden ---------------------------------------------------------------------------------------------------- */

/** Ein kleiner, fester Zufall aus einem Text (dieselbe Mischung für denselben Samen). */
function rngOf(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Gruppen zu höchstens `size` (gleich gross, so gut es geht: die Grössen unterscheiden sich um höchstens eins), gemischt mit dem
 * Samen. Wer allein bliebe, kommt in eine andere Gruppe (bei 1 Teilnehmer: eine Gruppe mit einem).
 */
export function formGroups(ids: readonly string[], size: number, seed: string): string[][] {
  const list = [...new Set(ids)].sort();
  const rng = rngOf(seed);
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  if (list.length === 0) return [];
  const count = Math.max(1, Math.ceil(list.length / clampGroupSize(size)));
  const groups: string[][] = Array.from({ length: count }, () => []);
  list.forEach((p, i) => groups[i % count]!.push(p));
  return groups;
}

/** Wer noch in keiner Gruppe ist (spät beigetreten), kommt in die kleinste — die Gruppen bleiben sonst, wie sie sind. */
export function withLate(groups: readonly (readonly string[])[], ids: readonly string[], size: number): string[][] {
  const out = groups.map((g) => [...g]);
  const placed = new Set(out.flat());
  for (const p of ids) {
    if (placed.has(p)) continue;
    placed.add(p);
    if (out.length === 0) { out.push([p]); continue; }
    let at = 0;
    for (let i = 1; i < out.length; i += 1) if (out[i]!.length < out[at]!.length) at = i;
    /* Ist selbst die kleinste schon voll, eine neue Gruppe. */
    if (out[at]!.length >= clampGroupSize(size)) out.push([p]);
    else out[at]!.push(p);
  }
  return out;
}

/** Ein Mitglied in eine andere Gruppe (`to` = Anzahl der Gruppen: eine neue); leere Gruppen fallen weg. */
export function moveMember(groups: readonly (readonly string[])[], p: string, to: number): string[][] {
  const out = groups.map((g) => g.filter((x) => x !== p));
  if (to >= out.length) out.push([p]);
  else if (to >= 0) out[to]!.push(p);
  return out.filter((g) => g.length > 0);
}

export const groupOf = (groups: readonly (readonly string[])[], p: string): number => groups.findIndex((g) => g.includes(p));

/** Initialen für die Ansicht der Gruppe („Anna Nowak" → „AN"; ohne Namen: „?"). */
export function initialsOf(name: string): string {
  const parts = name.replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter((w) => w !== '');
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0]!.slice(0, 2) : `${parts[0]![0]}${parts[parts.length - 1]![0]}`).toUpperCase();
}

/* -- Antworten und Einigung ----------------------------------------------------------------------------------------------- */

export interface GroupAnswer {
  readonly participant: string;
  readonly stage: string;
  readonly item: string;
  /** Die Frage (Schlüssel der Karte). */
  readonly q: string;
  readonly given: unknown;
  /** Die Antwort als Wort (was die Gruppe sieht). */
  readonly label: string;
  readonly at: number;
}

/** Gleiche Antwort? — unabhängig von der Reihenfolge bei Mehrfachwahl. */
export function answerKey(given: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return [...v.map(norm)].sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
    if (typeof v === 'string') return v.trim().toLowerCase().replace(/\s+/g, ' ');
    if (typeof v === 'object' && v !== null) return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, norm(x)]));
    return v;
  };
  return JSON.stringify(norm(given) ?? null);
}

/** Die Antworten der Gruppen aus den Meldungen `prompt` (nur die mit `group`). */
export function groupAnswersOf(bodies: readonly unknown[]): GroupAnswer[] {
  const out: GroupAnswer[] = [];
  for (const b of bodies) {
    if (typeof b !== 'object' || b === null) continue;
    const o = b as Record<string, unknown>;
    const g = o.group;
    if (typeof o.participant !== 'string' || typeof o.stage !== 'string' || typeof o.item !== 'string' || typeof g !== 'object' || g === null) continue;
    const gg = g as Record<string, unknown>;
    if (typeof gg.q !== 'string') continue;
    out.push({ participant: o.participant, stage: o.stage, item: o.item, q: gg.q, given: gg.given, label: typeof gg.label === 'string' ? gg.label.slice(0, 120) : '', at: typeof o.at === 'number' ? o.at : 0 });
  }
  return out;
}

export type GroupStatus = 'thinking' | 'disagree' | 'agreed' | 'closed';

export interface GroupQuestion {
  readonly status: GroupStatus;
  /** Je Mitglied die letzte Antwort (Wort) — `undefined`: noch keine. */
  readonly answers: Readonly<Record<string, string>>;
  /** Die Antwort der Gruppe (einig oder vom Lehrer geschlossen). */
  readonly given?: unknown;
  readonly label?: string;
  readonly key?: string;
}

/**
 * DER STAND EINER GRUPPE BEI EINER FRAGE: einig, wenn alle Mitglieder dasselbe geantwortet haben; uneinig, wenn alle geantwortet
 * haben, aber nicht dasselbe; sonst denkt sie nach. Hat der Lehrer geschlossen: die häufigste Antwort (bei Gleichstand die zuerst
 * gegebene) — `closed`.
 */
export function groupQuestion(members: readonly string[], answers: readonly GroupAnswer[], closed = false): GroupQuestion {
  const latest = new Map<string, GroupAnswer>();
  for (const a of [...answers].sort((x, y) => x.at - y.at)) if (members.includes(a.participant)) latest.set(a.participant, a);
  const shown: Record<string, string> = {};
  for (const [p, a] of latest) shown[p] = a.label;
  const given = [...latest.values()];
  if (closed && given.length > 0) {
    const counts = new Map<string, { n: number; first: number; a: GroupAnswer }>();
    for (const a of given) {
      const k = answerKey(a.given);
      const c = counts.get(k);
      counts.set(k, c === undefined ? { n: 1, first: a.at, a } : { ...c, n: c.n + 1 });
    }
    const best = [...counts.entries()].sort((x, y) => y[1].n - x[1].n || x[1].first - y[1].first)[0]!;
    return { status: 'closed', answers: shown, given: best[1].a.given, label: best[1].a.label, key: best[0] };
  }
  if (given.length < members.length || members.length === 0) return { status: 'thinking', answers: shown };
  const keys = new Set(given.map((a) => answerKey(a.given)));
  if (keys.size > 1) return { status: 'disagree', answers: shown };
  return { status: 'agreed', answers: shown, given: given[0]!.given, label: given[0]!.label, key: [...keys][0]! };
}

/* -- Was die Gruppen sehen (vom Lehrer zurückgegeben) ---------------------------------------------------------------------- */

export interface GroupView {
  /** Die Nummer der Gruppe (1…). */
  readonly n: number;
  readonly members: readonly { readonly p: string; readonly ini: string }[];
  /** Je Frage: Stand, je Mitglied die Antwort (Wort), die Antwort der Gruppe, richtig? */
  readonly qs: Readonly<Record<string, { readonly status: GroupStatus; readonly answers: Readonly<Record<string, string>>; readonly label?: string; readonly correct?: boolean }>>;
}

export interface GroupStateEvent { readonly stage: string; readonly item: string; readonly at: number; readonly groups: readonly GroupView[] }
export interface GroupsEvent { readonly stage: string; readonly groups: readonly (readonly string[])[]; readonly seed: string; readonly at: number }
export interface GroupCloseEvent { readonly stage: string; readonly item: string; readonly q: string; readonly group: number; readonly at: number }

/** Die Ansicht aller Gruppen für ein Item (Fragen in ihrer Reihenfolge), mit `correct` aus der Rechnung des Lehrers. */
export function groupViews(
  groups: readonly (readonly string[])[], questions: readonly string[], answers: readonly GroupAnswer[], closes: readonly GroupCloseEvent[],
  item: string, initials: (p: string) => string, correct: (q: string, given: unknown) => boolean | undefined
): GroupView[] {
  return groups.map((members, i) => {
    const qs: Record<string, GroupView['qs'][string]> = {};
    for (const q of questions) {
      const mine = answers.filter((a) => a.item === item && a.q === q);
      const closed = closes.some((c) => c.item === item && c.q === q && c.group === i + 1);
      const st = groupQuestion(members, mine, closed);
      if (st.status === 'thinking' && Object.keys(st.answers).length === 0) continue;
      const ok = st.status === 'agreed' || st.status === 'closed' ? correct(q, st.given) : undefined;
      qs[q] = { status: st.status, answers: st.answers, ...(st.label === undefined ? {} : { label: st.label }), ...(ok === undefined ? {} : { correct: ok }) };
    }
    return { n: i + 1, members: members.map((p) => ({ p, ini: initials(p) })), qs };
  });
}

/** Für die Konsole und die Leinwand: je Gruppe beantwortet / einig / richtig und der Stand der zuletzt bearbeiteten Frage. */
export function groupTally(view: GroupView, questions: readonly string[]): { readonly answered: number; readonly agreed: number; readonly correct: number; readonly status: GroupStatus | 'idle'; readonly q: string | null } {
  let answered = 0;
  let agreed = 0;
  let correct = 0;
  let last: { q: string; status: GroupStatus } | null = null;
  for (const q of questions) {
    const s = view.qs[q];
    if (s === undefined) continue;
    answered += 1;
    if (s.status === 'agreed' || s.status === 'closed') { agreed += 1; if (s.correct === true) correct += 1; }
    last = { q, status: s.status };
  }
  /* Die Frage, an der die Gruppe gerade ist: die erste noch nicht einige — sonst die letzte. */
  const open = questions.find((q) => { const s = view.qs[q]; return s !== undefined && s.status !== 'agreed' && s.status !== 'closed'; });
  const cur = open === undefined ? last : { q: open, status: view.qs[open]!.status };
  return { answered, agreed, correct, status: cur === null ? 'idle' : cur.status, q: cur?.q ?? null };
}

/** Wie oft jede Antwort der Gruppen bei einer Frage (für die Verteilung). */
export function groupDistribution(views: readonly GroupView[], q: string): { label: string; count: number; correct: boolean | undefined }[] {
  const m = new Map<string, { label: string; count: number; correct: boolean | undefined }>();
  for (const v of views) {
    const s = v.qs[q];
    if (s === undefined || s.label === undefined || (s.status !== 'agreed' && s.status !== 'closed')) continue;
    const c = m.get(s.label);
    m.set(s.label, c === undefined ? { label: s.label, count: 1, correct: s.correct } : { ...c, count: c.count + 1 });
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

/** Ein Fingerabdruck der Ansicht — nur bei einer Änderung schickt die Konsole sie neu. */
export const viewsSignature = (views: readonly GroupView[]): string => JSON.stringify(views);
