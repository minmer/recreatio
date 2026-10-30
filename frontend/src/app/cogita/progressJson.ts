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

import { describe, keyLines, pretty, textNode, type JsonNode } from '../core/jsonTree';
import { newId } from '../core/ids';
import { plural } from '../core/plural';
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

const TOP_KEYS: Readonly<Record<string, string>> = {
  format: `"${PROGRESS_FORMAT}"`,
  version: `${PROGRESS_VERSION} — wersja formatu`,
  library: 'baza wiedzy, z której są odpowiedzi: {"id", "name"} — import do innej bazy odmawia; pominięte — import do bazy otwartej tutaj',
  answers: `odpowiedzi (niżej), najwyżej ${MAX_ANSWERS} w jednym imporcie`
};

const LIBRARY_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator bazy wiedzy',
  name: 'nazwa bazy wiedzy (tylko informacja)'
};

const ANSWER_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator odpowiedzi z eksportu — odpowiedź, która już jest w Twoich postępach, jest pomijana; bez "id" odpowiedź jest nowa (chyba że jest już odpowiedź na tę samą kartę "key" w tej samej chwili "at")',
  key: `karta: pytanie i kierunek ("pytanie|kierunek" albo samo pytanie) — wymagane, do ${MAX_KEY} znaków; tylko taka karta tej bazy liczy odpowiedź`,
  question: 'pytanie karty (część "key" przed "|"); pominięte — z "key"',
  direction: 'kierunek karty (część "key" po "|", np. "a-b"); pominięty — z "key"',
  fingerprint: 'odcisk tego, co było wtedy poprawną odpowiedzią — gdy treść karty się zmieni, stare odpowiedzi przestają się liczyć; pominięty — odpowiedź liczy się zawsze',
  at: 'kiedy: data i czas ISO ("2026-10-28T18:03:11Z") albo milisekundy od 1970 — od 2020 roku do dziś',
  correctness: 'jak dobrze: liczba od 0 (źle) do 1 (dobrze), części dla odpowiedzi częściowo dobrych; true/false też',
  ms: 'ile trwała odpowiedź, w milisekundach (najwyżej doba)',
  given: `co zostało podane, krótko (do ${MAX_GIVEN} znaków — dłuższe jest ucinane)`,
  via: 'skąd: powtórka, sesja albo przebieg (np. "revision:<id>") — tylko informacja przy analizie',
  text: 'tylko informacja z eksportu: o co pytała karta, słowami — import tego nie czyta'
};

/** Jeder Schlüssel als Pfad (`answers[].key`) mit seinem Satz — für die Prüfung. */
export const PROGRESS_KEYS: Readonly<Record<string, string>> = {
  ...TOP_KEYS,
  ...Object.fromEntries(Object.entries(LIBRARY_KEYS).map(([k, v]) => [`library.${k}`, v])),
  ...Object.fromEntries(Object.entries(ANSWER_KEYS).map(([k, v]) => [`answers[].${k}`, v]))
};

const SAMPLE_LIBRARY = '0190a0a0-0000-7000-8000-0000000000c1';
const SAMPLE_ENTRY = '0190a0a0-0000-7000-8000-0000000000c2';

const SAMPLE = {
  format: PROGRESS_FORMAT,
  version: PROGRESS_VERSION,
  library: { id: SAMPLE_LIBRARY, name: 'Historia Polski' },
  answers: [
    {
      id: '0190a0a0-0000-7000-8000-0000000000d1', key: `daty:${SAMPLE_ENTRY}|a-b`, question: `daty:${SAMPLE_ENTRY}`, direction: 'a-b', fingerprint: 'f3a91c',
      at: '2026-10-27T18:03:11.000Z', correctness: 1, ms: 5300, given: '1410', via: 'revision:0190a0a0-0000-7000-8000-0000000000e1', text: 'Bitwa pod Grunwaldem — rok?'
    },
    { key: `daty:${SAMPLE_ENTRY}|b-a`, at: '2026-10-28T07:45:00.000Z', correctness: 0.5, ms: 9100, given: 'bitwa pod Grunwaldem (?)' }
  ]
};

/**
 * 2026-10-30 — WOZU DIE ANTWORTEN DIENEN, im ganzen System (neben jedem Import: wie die Daten gebraucht werden).
 * Nachgeprüft: `knowness.ts` (der Zustand je Karte), `knowing.ts` (Eintrag aus Karten), `revision.ts`, `learn.ts` (`reportDue`).
 */
const PROGRESS_USAGE_JSON: JsonNode = textNode('learn-progress.usage', 'Jak aplikacja używa tych danych', () => `Z odpowiedzi aplikacja liczy, jak dobrze umiesz — w przeglądarce, tak samo wszędzie:
- każda karta: kiedy ostatnio, ile czasu naprawdę minęło przed odpowiedzią, odstęp do następnego razu (dobrze: ten czas × 3; częściowo: jedna trzecia, co najmniej dzień, jeśli minęły dni; źle: 5 minut; dobrze zaraz po błędzie: 0,4 × najlepszy odstęp sprzed błędu) i jej znajomość, która z czasem spada;
- każdy wpis: średnia znajomości jego kart z odpowiedzią, ważona tym, jak mocno każda go sprawdza (szablon w schemacie), plus to, co na nim buduje;
- z tego: które karty powtórka da teraz i dlaczego (przy każdej karcie widać powód), co pokazują widoki i powtórki z „Filtrem znajomości” (np. szczegóły okresu dopiero, gdy okres jest znany), „Ścieżka”, „Postępy” i przypomnienie o następnej powtórce — serwis widzi tylko, kiedy ona i ile kart czeka;
- odpowiedzi zostają wszystkie: gdy zmieni się sposób liczenia, wszystko da się policzyć od nowa; karta, której poprawna odpowiedź się zmieniła, liczy tylko odpowiedzi od tej zmiany.
Import dopisuje odpowiedzi tylko do Twoich postępów; prowadzący kursu widzi je tak jak odpowiedzi z nauki.`);

export const PROGRESS_JSON: JsonNode = {
  key: 'learn-progress',
  title: `Moje postępy jako JSON ("${PROGRESS_FORMAT}", wersja ${PROGRESS_VERSION})`,
  short: 'Moje postępy',
  text: () => `Twoje odpowiedzi w jednej bazie wiedzy: na którą kartę, jak dobrze, kiedy, jak długo i co podano — do zachowania albo do analizy (np. przez AI: co sprawia trudność, jak zmienia się czas odpowiedzi). W aplikacji: Nauka → baza wiedzy → „Postępy” → „Moje postępy jako JSON”, #/workspace/learn/<baza>/postepy.
Co robi import:
- Najpierw pokazuje plan; zapisuje dopiero po „Importuj”.
- Dopisuje odpowiedzi tylko do TWOICH postępów w bazie otwartej tutaj — nigdy do cudzych (dokument nie wskazuje, czyje są: zawsze są to postępy osoby, która importuje). Dokument z innej bazy ("library.id") odrzuca.
- Odpowiedź, której "id" już jest w Twoich postępach, pomija — ten sam eksport zaimportowany drugi raz niczego nie zmienia. Odpowiedź bez "id" jest nowa (chyba że na tę samą kartę jest już odpowiedź z tą samą chwilą "at").
- Niczego nie zmienia ani nie usuwa: odpowiedź się zdarzyła.
- Nowe odpowiedzi zapisuje jako nowe pakiety po ${PER_BATCH}, zapieczętowane w przeglądarce dla Ciebie (i dla przyjęć obszaru kursu, jeśli baza ją wskazuje — prowadzący widzą je w „Postępach uczących się”), jak każdą odpowiedź z nauki. Bez internetu czekają na tym urządzeniu.
- Odpowiedź na kartę, której w tej bazie nie ma, zapisuje z ostrzeżeniem — liczy się dopiero, gdy taka karta jest. Odpowiedź w złym kształcie — ostrzeżenie, pominięta.
Zwróć JEDEN obiekt JSON, bez komentarzy.

Dokument:
${keyLines(TOP_KEYS)}

Baza wiedzy ("library"):
${keyLines(LIBRARY_KEYS)}

Odpowiedź (wpis w "answers"):
${keyLines(ANSWER_KEYS)}

Przykład:
${pretty(SAMPLE)}`,
  inside: () => [PROGRESS_USAGE_JSON],
  samples: () => [{ label: 'Dwie odpowiedzi', doc: () => SAMPLE }]
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
const clip = (text: string, n: number) => (text.length <= n ? text : `${text.slice(0, n - 1)}…`);

/**
 * Tausende Antworten, und jede könnte dasselbe falsch haben: die Warnungen werden GEZÄHLT, nicht wiederholt —
 * „Antworten ohne "key": 37 (np. 4, 9, 12) — pominięte" statt 37 Zeilen.
 */
class Tally {
  private readonly said = new Map<string, number[]>();
  add(text: string, at: number): void { this.said.set(text, [...(this.said.get(text) ?? []), at]); }
  lines(): string[] {
    return [...this.said.entries()].map(([text, at]) =>
      at.length === 1 ? `Odpowiedź ${at[0]}: ${text}` : `${at.length} odpowiedzi (np. ${at.slice(0, 3).join(', ')}): ${text}`);
  }
}

/** Ein Zeitpunkt aus dem Dokument — ISO oder Millisekunden — zwischen 2020 und morgen. */
function momentOf(raw: unknown, now: number): number | null {
  const at = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(at) && at >= EARLIEST && at <= now + 86_400_000 ? Math.round(at) : null;
}

export function planProgress(doc: unknown, ctx: ProgressContext): ProgressPlan | { error: string } {
  if (!isObject(doc)) return { error: 'To nie jest dokument postępów (oczekiwano obiektu JSON).' };
  if (doc.format !== undefined && doc.format !== PROGRESS_FORMAT) return { error: `Inny format: "${String(doc.format)}" — oczekiwano "${PROGRESS_FORMAT}".` };
  if (isObject(doc.library) && typeof doc.library.id === 'string' && doc.library.id !== ctx.libraryId) {
    const name = typeof doc.library.name === 'string' && doc.library.name !== '' ? ` („${doc.library.name}”)` : '';
    return { error: `To postępy z innej bazy wiedzy${name} — zaimportuj je tam, w jej „Postępach”.` };
  }
  if (!Array.isArray(doc.answers)) return { error: 'Brakuje listy "answers".' };

  const now = ctx.now ?? Date.now();
  const makeId = ctx.makeId ?? (() => newId());
  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== PROGRESS_VERSION) warnings.push(`Wersja ${String(doc.version)} — znam wersję ${PROGRESS_VERSION}; czytam to, co rozpoznaję.`);
  for (const key of Object.keys(doc)) if (!described(TOP_KEYS, key)) warnings.push(`Nieznany klucz "${key}" — pominięty.`);
  if (doc.library !== undefined && !isObject(doc.library)) warnings.push('"library" to nie obiekt — pominięte.');
  if (doc.answers.length > MAX_ANSWERS) warnings.push(`${doc.answers.length} odpowiedzi — w jednym imporcie biorę pierwsze ${MAX_ANSWERS}; resztę zaimportuj osobno.`);

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
    if (!isObject(raw)) { tally.add('to nie obiekt — pominięta.', n); return; }
    for (const key of Object.keys(raw)) if (!described(ANSWER_KEYS, key)) tally.add(`nieznany klucz "${key}" — pominięty.`, n);
    const key = typeof raw.key === 'string' ? raw.key.trim() : '';
    if (key === '' || key.length > MAX_KEY) { tally.add(key === '' ? 'bez "key" — pominięta.' : `"key" dłuższy niż ${MAX_KEY} znaków — pominięta.`, n); return; }
    const at = momentOf(raw.at, now);
    if (at === null) { tally.add('"at" to nie chwila od 2020 roku do dziś — pominięta.', n); return; }
    const right = typeof raw.correctness === 'boolean' ? (raw.correctness ? 1 : 0) : typeof raw.correctness === 'number' && Number.isFinite(raw.correctness) ? raw.correctness : null;
    if (right === null) { tally.add('"correctness" to nie liczba od 0 do 1 — pominięta.', n); return; }
    if (right < 0 || right > 1) tally.add('"correctness" poza 0–1 — przycięte.', n);

    const given = typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id.trim().slice(0, 100) : null;
    const moment = `${key}@${at}`;
    if (given !== null && ctx.existing.has(given)) { known += 1; return; }
    if (given === null && hadMoments.has(moment)) { known += 1; return; }
    if (given !== null && seen.has(given)) { tally.add('to samo "id" drugi raz w dokumencie — pominięta.', n); return; }
    if (given === null && docMoments.has(moment)) { tally.add('bez "id", ta sama karta i chwila "at" drugi raz w dokumencie — pominięta.', n); return; }
    if (given !== null) seen.add(given);
    docMoments.add(moment);

    const bar = key.indexOf('|');
    const question = typeof raw.question === 'string' && raw.question.trim() !== '' ? raw.question.trim() : bar < 0 ? key : key.slice(0, bar);
    const direction = typeof raw.direction === 'string' ? raw.direction.trim() : bar < 0 ? '' : key.slice(bar + 1);
    let ms: number | undefined;
    if (raw.ms !== undefined && raw.ms !== null) {
      if (typeof raw.ms === 'number' && Number.isFinite(raw.ms) && raw.ms >= 0 && raw.ms <= MAX_MS) ms = Math.round(raw.ms);
      else tally.add('"ms" to nie czas od 0 do doby — pominięty.', n);
    }
    if (raw.given !== undefined && raw.given !== null && typeof raw.given !== 'string') tally.add('"given" to nie tekst — pominięte.', n);
    if (raw.via !== undefined && raw.via !== null && typeof raw.via !== 'string') tally.add('"via" to nie tekst — pominięte.', n);

    const answer: AnswerRecord = {
      id: given ?? makeId(), key, question, direction,
      fingerprint: typeof raw.fingerprint === 'string' ? raw.fingerprint.trim().slice(0, 200) : '',
      at, correctness: Math.max(0, Math.min(1, right)),
      ...(typeof raw.given === 'string' ? { given: clip(raw.given, MAX_GIVEN) } : {}),
      ...(ms === undefined ? {} : { ms }),
      ...(typeof raw.via === 'string' && raw.via.trim() !== '' ? { via: raw.via.trim().slice(0, 200) } : {})
    };
    if (ctx.cardKeys !== null && !ctx.cardKeys.has(ctx.rename?.(key) ?? key)) strange += 1;
    out.push(answer);
  });

  warnings.push(...tally.lines());
  if (strange > 0) {
    warnings.push(`${strange} ${plural(strange, 'odpowiedź nie pasuje', 'odpowiedzi nie pasują', 'odpowiedzi nie pasuje')} do żadnej karty tej bazy (karta usunięta, zmieniona albo z innej bazy) — ${plural(strange, 'zapisze', 'zapiszą', 'zapisze')} się, ale nie ${plural(strange, 'liczy', 'liczą', 'liczy')} się, dopóki takiej karty nie ma.`);
  }

  const lines: string[] = [];
  if (out.length > 0) {
    const batches = Math.ceil(out.length / PER_BATCH);
    const cards = new Set(out.map((a) => a.key)).size;
    lines.push(`Nowe odpowiedzi: ${out.length} (na ${cards} ${plural(cards, 'kartę', 'karty', 'kart')}) — ${batches} ${plural(batches, 'nowy pakiet', 'nowe pakiety', 'nowych pakietów')}, zapieczętowane dla Ciebie`);
  }
  if (known > 0) lines.push(`Już są w Twoich postępach: ${known} — pominięte`);
  if (out.length === 0) lines.push('Nic nowego — wszystkie odpowiedzi już są.');
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
    stage(`Pieczętowanie pakietu ${n} z ${batches}…`);
    await learner.adopt(plan.answers.slice(at, at + PER_BATCH));
  }
  const lines = [`Dopisane odpowiedzi: ${plan.answers.length}`];
  const warnings = learner.waiting > 0 ? [`${learner.waiting} ${plural(learner.waiting, 'pakiet czeka', 'pakiety czekają', 'pakietów czeka')} na internet — wyjdą same, gdy wróci połączenie.`] : [];
  return { lines, warnings };
}
