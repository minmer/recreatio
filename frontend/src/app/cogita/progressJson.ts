/**
 * 2026-10-29 — DIE EIGENEN ANTWORTEN ALS JSON ("recreatio/learn-progress", Fassung 1): was ich in EINER Baza
 * wiedzy beantwortet habe — Karte, Richtung, wie richtig, wann, wie lange, was ich gab —, zum Aufheben oder
 * damit ein Assistent es auswertet (COGITA.md §7).
 *
 * <b>Hinein nur in den eigenen Fortschritt.</b> Der Lernende ist immer der, der importiert (`holderOfMe`); ein
 * Dokument nennt keinen Halter und kann keinen wählen. Was hineingeht, wird ein neuer Stapel wie jeder andere
 * (`Learner.adopt` → `sealBatch`): versiegelt für mich und für die Annahme des Kurses, über die Ablage, wenn das
 * Netz fehlt. Antworten, deren Kennung schon da ist, bleiben draussen — derselbe Export zweimal ändert nichts.
 * Ohne Kennung gilt eine Antwort auf dieselbe Karte zur selben Millisekunde als dieselbe.
 *
 * Geändert und gelöscht wird nichts: eine Antwort ist geschehen, sie wird nicht nachträglich anders.
 */

import { describe, keyLines, pretty, type JsonNode } from '../core/jsonTree';
import { newId } from '../core/ids';
import { t } from '../core/i18n';
import { readParams, readSeed } from './cardBasics';
import type { AnswerRecord } from './learn';

export const PROGRESS_FORMAT = 'recreatio/learn-progress';
export const PROGRESS_VERSION = 1;

/** Höchstens so viele Antworten je Import — und so viele je Stapel (ein Stapel darf versiegelt 512 KB haben). */
export const MAX_ANSWERS = 5000;
export const PER_BATCH = 400;

/** Die Grenzen einer Antwort (`readAnswer` in `learn.ts` kürzt „given" ebenso). */
const MAX_GIVEN = 400;
const MAX_KEY = 400;
const MAX_MS = 24 * 3600_000;
/** Vor diesem Tag gab es keine Cogita — eine frühere Zeit ist ein Fehler im Dokument. */
const EARLIEST = Date.UTC(2020, 0, 1);

/* -- Die Sätze ----------------------------------------------------------------------------------------- */

/* 2026-11-05 — die Sätze werden erst beim Lesen geholt (in der Sprache der Anwendung): Getter statt Werte. */
const lazy = (said: Readonly<Record<string, () => string>>): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const [k, get] of Object.entries(said)) Object.defineProperty(out, k, { get, enumerable: true });
  return out;
};
const P = 'cogitaDataFormat.progress';

const TOP_KEYS: Readonly<Record<string, string>> = lazy({
  format: () => `"${PROGRESS_FORMAT}"`,
  version: () => t(`${P}.top.version`, { version: PROGRESS_VERSION }),
  library: () => t(`${P}.top.library`),
  answers: () => t(`${P}.top.answers`, { max: MAX_ANSWERS })
});

const LIBRARY_KEYS: Readonly<Record<string, string>> = lazy({
  id: () => t(`${P}.library.id`),
  name: () => t(`${P}.library.name`)
});

const ANSWER_KEYS: Readonly<Record<string, string>> = lazy({
  id: () => t(`${P}.answer.id`),
  key: () => t(`${P}.answer.key`, { max: MAX_KEY }),
  question: () => t(`${P}.answer.question`),
  direction: () => t(`${P}.answer.direction`),
  fingerprint: () => t(`${P}.answer.fingerprint`),
  at: () => t(`${P}.answer.at`),
  correctness: () => t(`${P}.answer.correctness`),
  ms: () => t(`${P}.answer.ms`),
  given: () => t(`${P}.answer.given`, { max: MAX_GIVEN }),
  via: () => t(`${P}.answer.via`),
  hints: () => t(`${P}.answer.hints`),
  params: () => t(`${P}.answer.params`),
  seed: () => t(`${P}.answer.seed`),
  text: () => t(`${P}.answer.text`)
});

/** Jeder Schlüssel als Pfad (`answers[].key`) mit seinem Satz — für die Prüfung. */
export const PROGRESS_KEYS: Readonly<Record<string, string>> = lazy({
  ...Object.fromEntries(Object.keys(TOP_KEYS).map((k) => [k, () => TOP_KEYS[k]!])),
  ...Object.fromEntries(Object.keys(LIBRARY_KEYS).map((k) => [`library.${k}`, () => LIBRARY_KEYS[k]!])),
  ...Object.fromEntries(Object.keys(ANSWER_KEYS).map((k) => [`answers[].${k}`, () => ANSWER_KEYS[k]!]))
});

const SAMPLE_LIBRARY = '0190a0a0-0000-7000-8000-0000000000c1';
const SAMPLE_ENTRY = '0190a0a0-0000-7000-8000-0000000000c2';

const sample = () => ({
  format: PROGRESS_FORMAT,
  version: PROGRESS_VERSION,
  library: { id: SAMPLE_LIBRARY, name: t(`${P}.sample.library`) },
  answers: [
    {
      id: '0190a0a0-0000-7000-8000-0000000000d1', key: `daty:${SAMPLE_ENTRY}|a-b`, question: `daty:${SAMPLE_ENTRY}`, direction: 'a-b', fingerprint: 'f3a91c',
      at: '2026-10-27T18:03:11.000Z', correctness: 1, ms: 5300, given: '1410', via: 'revision:0190a0a0-0000-7000-8000-0000000000e1', text: t(`${P}.sample.text`)
    },
    { key: `daty:${SAMPLE_ENTRY}|b-a`, at: '2026-10-28T07:45:00.000Z', correctness: 0.5, ms: 9100, given: t(`${P}.sample.given`) }
  ]
});

/**
 * 2026-10-30 — WOZU DIE ANTWORTEN DIENEN, im ganzen System (neben jedem Import: wie die Daten gebraucht werden).
 * Nachgeprüft: `knowness.ts` (der Zustand je Karte), `knowing.ts` (Eintrag aus Karten), `revision.ts`, `learn.ts` (`reportDue`).
 */
const PROGRESS_USAGE_JSON: JsonNode = {
  key: 'learn-progress.usage',
  get title() { return t(`${P}.usage.title`); },
  text: () => t(`${P}.usage.text`)
};

export const PROGRESS_JSON: JsonNode = {
  key: 'learn-progress',
  get title() { return t(`${P}.title`, { format: PROGRESS_FORMAT, version: PROGRESS_VERSION }); },
  get short() { return t(`${P}.short`); },
  text: () => `${t(`${P}.text`, { perBatch: PER_BATCH })}

${t(`${P}.documentHead`)}
${keyLines(TOP_KEYS)}

${t(`${P}.libraryHead`)}
${keyLines(LIBRARY_KEYS)}

${t(`${P}.answerHead`)}
${keyLines(ANSWER_KEYS)}

${t(`${P}.exampleHead`)}
${pretty(sample())}`,
  inside: () => [PROGRESS_USAGE_JSON],
  samples: () => [{ get label() { return t(`${P}.sampleLabel`); }, doc: () => sample() }]
};

/** Die Beschreibung als Text — ohne Zusammenhang aufrufbar (MCP, `import-formats.mjs`). */
export const learnProgressDescription = (): string => describe(PROGRESS_JSON);

/* -- Export -------------------------------------------------------------------------------------------- */

export interface ProgressSource {
  readonly libraryId: string;
  readonly name: string;
  readonly answers: Iterable<AnswerRecord>;
  /** Was eine Karte fragt, in Worten — für die Auswertung; fehlt, wenn die Karte nicht mehr da ist. */
  readonly textOf?: (key: string) => string | undefined;
}

export function exportProgress(source: ProgressSource): Record<string, unknown> {
  return {
    format: PROGRESS_FORMAT,
    version: PROGRESS_VERSION,
    library: { id: source.libraryId, name: source.name },
    answers: [...source.answers].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).map((a) => {
      const text = source.textOf?.(a.key);
      return {
        id: a.id, key: a.key, question: a.question, direction: a.direction,
        ...(a.fingerprint === '' ? {} : { fingerprint: a.fingerprint }),
        at: new Date(a.at).toISOString(),
        correctness: a.correctness,
        ...(a.ms === undefined ? {} : { ms: a.ms }),
        ...(a.given === undefined ? {} : { given: a.given }),
        ...(a.via === undefined ? {} : { via: a.via }),
        ...(a.hints === undefined ? {} : { hints: a.hints }),
        ...(a.params === undefined ? {} : { params: a.params }),
        ...(a.seed === undefined ? {} : { seed: a.seed }),
        ...(text === undefined || text === '' ? {} : { text })
      };
    })
  };
}

/* -- Plan ---------------------------------------------------------------------------------------------- */

export interface ProgressContext {
  readonly libraryId: string;
  /** Was schon in den eigenen Fortschritten steht (auch was in der Ablage wartet). */
  readonly existing: ReadonlyMap<string, AnswerRecord>;
  /** Die Karten dieser Baza (`card.key`) — `null`: noch nicht gezählt, dann wird nicht gewarnt. */
  readonly cardKeys: ReadonlySet<string> | null;
  /** Zusammengeführte Einträge (`renamer`): eine Antwort auf den alten Namen zählt beim neuen. */
  readonly rename?: (key: string) => string;
  readonly now?: number;
  readonly makeId?: () => string;
}

export interface ProgressPlan {
  readonly answers: readonly AnswerRecord[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const described = (keys: Readonly<Record<string, string>>, key: string): boolean => Object.prototype.hasOwnProperty.call(keys, key);
const clip = (text: string, n: number) => (text.length <= n ? text : `${text.slice(0, n - 1)}…`); // i18n-ignore

/**
 * Tausende Antworten, und jede könnte dasselbe falsch haben: die Warnungen werden GEZÄHLT, nicht wiederholt —
 * „Antworten ohne "key": 37 (np. 4, 9, 12) — pominięte" statt 37 Zeilen.
 */
class Tally {
  private readonly said = new Map<string, number[]>();
  add(text: string, at: number): void { this.said.set(text, [...(this.said.get(text) ?? []), at]); }
  lines(): string[] {
    return [...this.said.entries()].map(([text, at]) =>
      at.length === 1 ? t('cogitaData.progress.tallyOne', { n: at[0]!, text }) : t('cogitaData.progress.tallyMany', { count: at.length, list: at.slice(0, 3).join(', '), text }));
  }
}

/** Ein Zeitpunkt aus dem Dokument — ISO oder Millisekunden — zwischen 2020 und morgen. */
function momentOf(raw: unknown, now: number): number | null {
  const at = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(at) && at >= EARLIEST && at <= now + 86_400_000 ? Math.round(at) : null;
}

export function planProgress(doc: unknown, ctx: ProgressContext): ProgressPlan | { error: string } {
  if (!isObject(doc)) return { error: t('cogitaData.progress.notProgress') };
  if (doc.format !== undefined && doc.format !== PROGRESS_FORMAT) return { error: t('cogitaData.progress.otherFormat', { format: String(doc.format), expected: PROGRESS_FORMAT }) };
  if (isObject(doc.library) && typeof doc.library.id === 'string' && doc.library.id !== ctx.libraryId) {
    return { error: typeof doc.library.name === 'string' && doc.library.name !== '' ? t('cogitaData.progress.otherBaseNamed', { name: doc.library.name }) : t('cogitaData.progress.otherBase') };
  }
  if (!Array.isArray(doc.answers)) return { error: t('cogitaData.progress.noAnswers') };

  const now = ctx.now ?? Date.now();
  const makeId = ctx.makeId ?? (() => newId());
  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== PROGRESS_VERSION) warnings.push(t('cogitaData.progress.version', { version: String(doc.version), known: PROGRESS_VERSION }));
  for (const key of Object.keys(doc)) if (!described(TOP_KEYS, key)) warnings.push(t('cogitaData.progress.unknownTopKey', { key }));
  if (doc.library !== undefined && !isObject(doc.library)) warnings.push(t('cogitaData.progress.libraryNotObject'));
  if (doc.answers.length > MAX_ANSWERS) warnings.push(t('cogitaData.progress.tooMany', { count: doc.answers.length, max: MAX_ANSWERS }));

  /* Was schon da ist: nach Kennung, und ohne Kennung nach Karte und Augenblick — im Fortschritt und im Dokument. */
  const hadMoments = new Set([...ctx.existing.values()].map((a) => `${a.key}@${a.at}`));
  const docMoments = new Set<string>();
  const tally = new Tally();
  const out: AnswerRecord[] = [];
  const seen = new Set<string>();
  let known = 0;
  let strange = 0;

  doc.answers.slice(0, MAX_ANSWERS).forEach((raw, i) => {
    const n = i + 1;
    if (!isObject(raw)) { tally.add(t('cogitaData.progress.answer.notObject'), n); return; }
    for (const key of Object.keys(raw)) if (!described(ANSWER_KEYS, key)) tally.add(t('cogitaData.progress.answer.unknownKey', { key }), n);
    const key = typeof raw.key === 'string' ? raw.key.trim() : '';
    if (key === '' || key.length > MAX_KEY) { tally.add(key === '' ? t('cogitaData.progress.answer.noKey') : t('cogitaData.progress.answer.keyTooLong', { max: MAX_KEY }), n); return; }
    const at = momentOf(raw.at, now);
    if (at === null) { tally.add(t('cogitaData.progress.answer.badAt'), n); return; }
    const right = typeof raw.correctness === 'boolean' ? (raw.correctness ? 1 : 0) : typeof raw.correctness === 'number' && Number.isFinite(raw.correctness) ? raw.correctness : null;
    if (right === null) { tally.add(t('cogitaData.progress.answer.badCorrectness'), n); return; }
    if (right < 0 || right > 1) tally.add(t('cogitaData.progress.answer.clipped'), n);

    const given = typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id.trim().slice(0, 100) : null;
    const moment = `${key}@${at}`;
    if (given !== null && ctx.existing.has(given)) { known += 1; return; }
    if (given === null && hadMoments.has(moment)) { known += 1; return; }
    if (given !== null && seen.has(given)) { tally.add(t('cogitaData.progress.answer.idTwice'), n); return; }
    if (given === null && docMoments.has(moment)) { tally.add(t('cogitaData.progress.answer.momentTwice'), n); return; }
    if (given !== null) seen.add(given);
    docMoments.add(moment);

    const bar = key.indexOf('|');
    const question = typeof raw.question === 'string' && raw.question.trim() !== '' ? raw.question.trim() : bar < 0 ? key : key.slice(0, bar);
    const direction = typeof raw.direction === 'string' ? raw.direction.trim() : bar < 0 ? '' : key.slice(bar + 1);
    let ms: number | undefined;
    if (raw.ms !== undefined && raw.ms !== null) {
      if (typeof raw.ms === 'number' && Number.isFinite(raw.ms) && raw.ms >= 0 && raw.ms <= MAX_MS) ms = Math.round(raw.ms);
      else tally.add(t('cogitaData.progress.answer.badMs'), n);
    }
    if (raw.given !== undefined && raw.given !== null && typeof raw.given !== 'string') tally.add(t('cogitaData.progress.answer.badGiven'), n);
    if (raw.via !== undefined && raw.via !== null && typeof raw.via !== 'string') tally.add(t('cogitaData.progress.answer.badVia'), n);

    const answer: AnswerRecord = {
      id: given ?? makeId(), key, question, direction,
      fingerprint: typeof raw.fingerprint === 'string' ? raw.fingerprint.trim().slice(0, 200) : '',
      at, correctness: Math.max(0, Math.min(1, right)),
      ...(typeof raw.given === 'string' ? { given: clip(raw.given, MAX_GIVEN) } : {}),
      ...(ms === undefined ? {} : { ms }),
      ...(typeof raw.via === 'string' && raw.via.trim() !== '' ? { via: raw.via.trim().slice(0, 200) } : {}),
      ...(typeof raw.hints === 'number' && Number.isFinite(raw.hints) && raw.hints >= 1 ? { hints: Math.min(20, Math.floor(raw.hints)) } : {}),
      ...(readParams(raw.params) === undefined ? {} : { params: readParams(raw.params)! }),
      ...(readSeed(raw.seed) === undefined ? {} : { seed: readSeed(raw.seed)! })
    };
    if (ctx.cardKeys !== null && !ctx.cardKeys.has(ctx.rename?.(key) ?? key)) strange += 1;
    out.push(answer);
  });

  warnings.push(...tally.lines());
  if (strange > 0) {
    warnings.push(t('cogitaData.progress.strange', { count: strange }));
  }

  const lines: string[] = [];
  if (out.length > 0) {
    const batches = Math.ceil(out.length / PER_BATCH);
    const cards = new Set(out.map((a) => a.key)).size;
    lines.push(t('cogitaData.progress.newAnswers', { count: out.length, cards: t('cogitaData.progress.cards', { count: cards }), batches: t('cogitaData.progress.batches', { count: batches }) }));
  }
  if (known > 0) lines.push(t('cogitaData.progress.known', { count: known }));
  if (out.length === 0) lines.push(t('cogitaData.progress.nothingNew'));
  return { answers: out, lines, warnings };
}

/* -- Ausführen ------------------------------------------------------------------------------------------ */

/** Der Lernende, wie `applyProgress` ihn braucht (`Learner` in `learn.ts`). */
export interface Adopter {
  adopt(answers: readonly AnswerRecord[]): Promise<void>;
  readonly waiting: number;
}

export async function applyProgress(plan: ProgressPlan, learner: Adopter, stage: (what: string) => void): Promise<{ lines: string[]; warnings: string[] }> {
  const batches = Math.ceil(plan.answers.length / PER_BATCH);
  for (let at = 0, n = 1; at < plan.answers.length; at += PER_BATCH, n += 1) {
    stage(t('cogitaData.progress.sealing', { n, total: batches }));
    await learner.adopt(plan.answers.slice(at, at + PER_BATCH));
  }
  const lines = [t('cogitaData.progress.added', { count: plan.answers.length })];
  const warnings = learner.waiting > 0 ? [t('cogitaData.progress.waiting', { count: learner.waiting })] : [];
  return { lines, warnings };
}
