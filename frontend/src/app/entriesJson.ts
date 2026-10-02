/**
 * 0077 — DIE LISTE EINES FORMULARS ALS JSON, hin und zurück.
 *
 * Die Menschen eines Formulars (ihre Antworten) und, was die Erweiterungen zu
 * ihnen tragen — bei einer wiederkehrenden je Zeitraum. Der Export macht alles
 * HIER auf, mit den Schlüsseln dieses Browsers; der Import versiegelt hier,
 * bevor etwas hinausgeht. Der Dienst liest davon nichts.
 *
 * <b>Wozu.</b> Eine Liste, die es schon gibt — auf Papier, in einer Tabelle —,
 * kommt in einem Zug herein: wer sie (mit einem Sprachmodell, ausserhalb der
 * App) in dieses JSON bringt, trägt nicht dreissig Menschen einzeln ein. Die
 * Beschreibung daneben wird aus den FRAGEN DIESES FORMULARS erzeugt: sie nennt
 * genau die Schlüssel, die hier gelten.
 *
 * <b>Die Schlüssel sind die Fragen</b> — in Worten („Imię", „Adres"), wo die
 * Frage lesbar und eindeutig ist, sonst ihre Kennung. Eine Erweiterung heisst
 * wie ihr Name; ein Zeitraum wie sein Schlüssel (`rounds.ts`), eine einmalige
 * „once".
 *
 * <b>Was der Import tut — und was nicht.</b> Ein Eintrag mit der `id` aus dem
 * Export wird GEÄNDERT; einer ohne wird neu angelegt (oder dem einen Menschen
 * zugeordnet, der genau so heisst). Was im Dokument nicht steht, bleibt, wie es
 * ist; gelöscht wird nichts. Antworten eines Menschen mit eigenem Link ändert
 * der Import nicht — sie gehören ihm; und in Erweiterungen, die der Mensch
 * selbst ausfüllt, schreibt er nicht.
 *
 * Rein — ohne Dienst; geprüft in `app-json-check.mjs`. Ausgeführt wird der
 * Plan in `ListJsonPanel.tsx`.
 */

import { fullNameOf, isYes, KIND_LABEL, YES, type Answer, type OpenField } from './form';
import { REPEAT_LABEL, roundAhead, roundOf, roundValid, type Repeat } from './rounds';

export const ENTRIES_FORMAT = 'recreatio/entries';

/** Wie eine einmalige Erweiterung im Dokument heisst — sie hat keinen Zeitraum. */
export const ONCE_KEY = 'once';

export interface EntriesExtension {
  readonly moduleId: string;
  readonly name: string;
  readonly audience: 'person' | 'office';
  readonly repeat: Repeat;
  readonly fields: readonly OpenField[];
}

export interface ExistingRecord {
  readonly registrationId: string;
  readonly values: ReadonlyMap<string, string>;
}

export interface ExistingEntry {
  readonly registrationId: string;
  /** Hat der Mensch einen eigenen Link? Dann gehören seine Antworten ihm. */
  readonly hasSeat: boolean;
  readonly answers: ReadonlyMap<string, string>;
  /** Erweiterung → Zeitraum (`''` bei einer einmaligen) → Einsendung. */
  readonly records: ReadonlyMap<string, ReadonlyMap<string, ExistingRecord>>;
}

export interface EntriesContext {
  readonly formId: string;
  readonly formName: string;
  readonly fields: readonly OpenField[];
  readonly extensions: readonly EntriesExtension[];
  readonly existing: readonly ExistingEntry[];
}

/* -- Die Schlüssel ------------------------------------------------------------------ */

const fold = (text: string): string => text.trim().toLowerCase();

/** Frage → ihr Schlüssel im Dokument: die Beschriftung, wo sie lesbar und eindeutig ist, sonst die Kennung. */
export function answerKeys(fields: readonly OpenField[]): Map<string, string> {
  const seen = new Map<string, number>();
  for (const f of fields) if (f.label !== null) seen.set(fold(f.label), (seen.get(fold(f.label)) ?? 0) + 1);

  return new Map(fields.map((f) => [
    f.fieldId,
    f.label !== null && f.label.trim() !== '' && seen.get(fold(f.label)) === 1 ? f.label.trim() : f.fieldId
  ]));
}

/** Schlüssel im Dokument → Frage (nach Beschriftung, ohne Gross und Klein — oder nach Kennung). */
function fieldsByKey(fields: readonly OpenField[]): Map<string, OpenField> {
  const out = new Map<string, OpenField>();
  const keys = answerKeys(fields);
  for (const f of fields) {
    out.set(fold(keys.get(f.fieldId) ?? f.fieldId), f);
    out.set(fold(f.fieldId), f);
  }
  return out;
}

const jsonValue = (field: OpenField, value: string): string | boolean =>
  (field.kind === 'checkbox' ? isYes(value) : value);

/** Was im Dokument steht → was in der Antwort stehen soll. `null`: nicht lesbar. */
function valueFor(field: OpenField, raw: unknown): string | null {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'boolean') return raw ? YES : '';
  if (typeof raw === 'number' && Number.isFinite(raw)) return field.kind === 'checkbox' ? (raw !== 0 ? YES : '') : String(raw);
  if (typeof raw !== 'string') return null;

  const text = raw.trim();
  if (field.kind === 'checkbox') return isYes(text) ? YES : '';
  return text;
}

/** Dasselbe? Bei „Tak / nie" zählt, ob angekreuzt — nicht, wie es geschrieben steht. */
const same = (field: OpenField, a: string, b: string): boolean =>
  (field.kind === 'checkbox' ? isYes(a) === isYes(b) : a.trim() === b.trim());

const asRecord = (value: unknown): Record<string, unknown> | null =>
  (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null);

/* -- Export --------------------------------------------------------------------------- */

export function exportEntries(ctx: EntriesContext): Record<string, unknown> {
  const keys = answerKeys(ctx.fields);

  return {
    format: ENTRIES_FORMAT,
    version: 1,
    form: ctx.formId,
    name: ctx.formName,
    entries: ctx.existing.map((one) => {
      const answers: Record<string, string | boolean> = {};
      for (const f of ctx.fields) {
        const value = one.answers.get(f.fieldId) ?? '';
        if (value.trim() !== '') answers[keys.get(f.fieldId) ?? f.fieldId] = jsonValue(f, value);
      }

      const records: Record<string, Record<string, Record<string, string | boolean>>> = {};
      for (const ext of ctx.extensions) {
        const mine = one.records.get(ext.moduleId);
        if (mine === undefined || mine.size === 0) continue;

        const extKeys = answerKeys(ext.fields);
        const rounds: Record<string, Record<string, string | boolean>> = {};
        for (const [round, record] of [...mine].sort(([a], [b]) => a.localeCompare(b))) {
          const values: Record<string, string | boolean> = {};
          for (const f of ext.fields) {
            const value = record.values.get(f.fieldId) ?? '';
            if (value.trim() !== '') values[extKeys.get(f.fieldId) ?? f.fieldId] = jsonValue(f, value);
          }
          rounds[round === '' ? ONCE_KEY : round] = values;
        }
        records[ext.name] = rounds;
      }

      return { id: one.registrationId, answers, ...(Object.keys(records).length === 0 ? {} : { records }) };
    })
  };
}

/* -- Der Plan --------------------------------------------------------------------------- */

/** Wem eine Einsendung einer Erweiterung gilt: einem Menschen, den es gibt — oder einem, der eben angelegt wird. */
export type BaseRef = { readonly registrationId: string } | { readonly ref: number };

export interface EntriesPlan {
  readonly add: readonly { readonly ref: number; readonly name: string; readonly answers: readonly Answer[] }[];
  readonly change: readonly { readonly registrationId: string; readonly answers: readonly Answer[] }[];
  readonly recordsNew: readonly { readonly extensionId: string; readonly base: BaseRef; readonly round: string; readonly answers: readonly Answer[] }[];
  readonly recordsChange: readonly { readonly extensionId: string; readonly registrationId: string; readonly answers: readonly Answer[] }[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

const count = (n: number, one: string, few: string, many: string): string => {
  const tens = n % 100;
  const last = n % 10;
  return `${n} ${n === 1 ? one : last >= 2 && last <= 4 && (tens < 12 || tens > 14) ? few : many}`;
};

/**
 * WAS EIN DOKUMENT ÄNDERN WÜRDE — ohne etwas zu tun. Jede Zeile, die nicht
 * passt, wird gesagt (`warnings`) und übergangen; der Rest gilt.
 */
export function planEntries(doc: unknown, ctx: EntriesContext, now: Date = new Date()): EntriesPlan | { error: string } {
  const root = asRecord(doc);
  if (root === null) return { error: 'To nie jest dokument JSON z listą osób.' };
  if (root.format !== undefined && root.format !== ENTRIES_FORMAT) {
    return { error: `To dokument „${String(root.format)}”, a tutaj importuje się „${ENTRIES_FORMAT}”.` };
  }
  if (!Array.isArray(root.entries)) return { error: 'Brakuje listy "entries".' };

  const warnings: string[] = [];
  if (typeof root.form === 'string' && root.form !== '' && root.form !== ctx.formId) {
    warnings.push('Dokument pochodzi z innego formularza — osoby z "id" stamtąd zostaną potraktowane jak nowe.');
  }

  const byKey = fieldsByKey(ctx.fields);
  const byId = new Map(ctx.existing.map((e) => [e.registrationId, e]));
  const nameOf = (answers: (fieldId: string) => string | undefined) => fullNameOf(ctx.fields, answers);
  const byName = new Map<string, ExistingEntry[]>();
  for (const e of ctx.existing) {
    const name = nameOf((id) => e.answers.get(id));
    if (name !== null) byName.set(fold(name), [...(byName.get(fold(name)) ?? []), e]);
  }

  const extByKey = new Map<string, EntriesExtension>();
  for (const ext of ctx.extensions) {
    extByKey.set(fold(ext.name), ext);
    extByKey.set(fold(ext.moduleId), ext);
  }

  const add: { ref: number; name: string; answers: Answer[] }[] = [];
  const change: { registrationId: string; answers: Answer[] }[] = [];
  const recordsNew: { extensionId: string; base: BaseRef; round: string; answers: Answer[] }[] = [];
  const recordsChange: { extensionId: string; registrationId: string; answers: Answer[] }[] = [];
  let matchedByName = 0;
  let skippedSeat = 0;

  root.entries.forEach((raw, index) => {
    const entry = asRecord(raw);
    const where = `Osoba ${index + 1}`;
    if (entry === null) { warnings.push(`${where}: to nie jest obiekt — pominięta.`); return; }

    /* Die Antworten, soweit sie zu einer Frage gehören. */
    const given = new Map<string, string>();
    const answersIn = entry.answers === undefined ? {} : asRecord(entry.answers);
    if (answersIn === null) { warnings.push(`${where}: "answers" to nie jest obiekt — pominięta.`); return; }

    for (const [key, value] of Object.entries(answersIn)) {
      const field = byKey.get(fold(key));
      if (field === undefined) { warnings.push(`${where}: nie ma pytania „${key}” — pominięte.`); continue; }
      const text = valueFor(field, value);
      if (text === null) { warnings.push(`${where}: odpowiedź na „${key}” to nie tekst, liczba ani true/false — pominięta.`); continue; }
      given.set(field.fieldId, text);
    }

    /* Wer ist es: der mit dieser Kennung, der eine, der genau so heisst — oder ein neuer. */
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    let existing = id === '' ? undefined : byId.get(id);
    const name = nameOf((fieldId) => given.get(fieldId) ?? existing?.answers.get(fieldId));

    if (existing === undefined && name !== null) {
      const alike = byName.get(fold(name)) ?? [];
      if (alike.length === 1) { existing = alike[0]; matchedByName += 1; }
      else if (alike.length > 1) warnings.push(`${where} („${name}”): na liście jest kilka osób o tym imieniu i nazwisku — powstanie nowy wpis. Podaj "id" z eksportu, żeby zmienić istniejącą.`);
    }

    let base: BaseRef;

    if (existing === undefined) {
      const answers = [...given].filter(([, value]) => value !== '').map(([fieldId, value]) => ({ fieldId, value }));
      if (answers.length === 0) { warnings.push(`${where}: bez żadnej odpowiedzi — pominięta.`); return; }
      const ref = add.length;
      add.push({ ref, name: name ?? `osoba ${index + 1}`, answers });
      base = { ref };
    } else {
      const found = existing;
      const changed = [...given]
        .filter(([fieldId, value]) => {
          const field = ctx.fields.find((f) => f.fieldId === fieldId)!;
          return !same(field, value, found.answers.get(fieldId) ?? '');
        })
        .map(([fieldId, value]) => ({ fieldId, value }));

      if (changed.length > 0) {
        if (found.hasSeat) skippedSeat += 1;
        else change.push({ registrationId: found.registrationId, answers: changed });
      }
      base = { registrationId: found.registrationId };
    }

    /* Was die Erweiterungen zu ihm tragen. */
    if (entry.records === undefined) return;
    const recordsIn = asRecord(entry.records);
    if (recordsIn === null) { warnings.push(`${where}: "records" to nie jest obiekt — pominięte.`); return; }

    for (const [extKey, roundsRaw] of Object.entries(recordsIn)) {
      const ext = extByKey.get(fold(extKey));
      if (ext === undefined) { warnings.push(`${where}: nie ma rozszerzenia „${extKey}” — pominięte.`); continue; }
      if (ext.audience !== 'office') { warnings.push(`${where}: „${ext.name}” wypełnia osoba przez swój link — import w nim nie pisze.`); continue; }

      const rounds = asRecord(roundsRaw);
      if (rounds === null) { warnings.push(`${where}: wpisy „${ext.name}” to nie obiekt — pominięte.`); continue; }

      const extFields = fieldsByKey(ext.fields);

      for (const [roundKey, valuesRaw] of Object.entries(rounds)) {
        const round = ext.repeat === 'once' && (roundKey === ONCE_KEY || roundKey === '') ? '' : roundKey.trim();
        if (!roundValid(ext.repeat, round)) {
          warnings.push(`${where}: „${roundKey}” to nie jest okres rozszerzenia „${ext.name}” (${ext.repeat === 'once' ? `"${ONCE_KEY}"` : `np. "${roundOf(ext.repeat, now)}"`}) — pominięty.`);
          continue;
        }
        if (roundAhead(ext.repeat, round, now)) { warnings.push(`${where}: okres ${round} jeszcze się nie zaczął — pominięty.`); continue; }

        const values = asRecord(valuesRaw);
        if (values === null) { warnings.push(`${where}: wpis ${roundKey} („${ext.name}”) to nie obiekt — pominięty.`); continue; }

        const wanted = new Map<string, string>();
        for (const [key, value] of Object.entries(values)) {
          const field = extFields.get(fold(key));
          if (field === undefined) { warnings.push(`${where}: „${ext.name}” nie ma pytania „${key}” — pominięte.`); continue; }
          const text = valueFor(field, value);
          if (text === null) { warnings.push(`${where}: odpowiedź na „${key}” to nie tekst, liczba ani true/false — pominięta.`); continue; }
          wanted.set(field.fieldId, text);
        }

        const record = existing?.records.get(ext.moduleId)?.get(round);

        if (record === undefined) {
          const answers = [...wanted].filter(([, value]) => value !== '').map(([fieldId, value]) => ({ fieldId, value }));
          if (answers.length > 0) recordsNew.push({ extensionId: ext.moduleId, base, round, answers });
        } else {
          const changed = [...wanted]
            .filter(([fieldId, value]) => !same(ext.fields.find((f) => f.fieldId === fieldId)!, value, record.values.get(fieldId) ?? ''))
            .map(([fieldId, value]) => ({ fieldId, value }));
          if (changed.length > 0) recordsChange.push({ extensionId: ext.moduleId, registrationId: record.registrationId, answers: changed });
        }
      }
    }
  });

  if (matchedByName > 0) warnings.push(`${count(matchedByName, 'osoba bez "id" została dopasowana', 'osoby bez "id" zostały dopasowane', 'osób bez "id" zostało dopasowanych')} po imieniu i nazwisku do osób już wpisanych.`);
  if (skippedSeat > 0) warnings.push(`${count(skippedSeat, 'osoba ma', 'osoby mają', 'osób ma')} własny link — ich odpowiedzi import nie zmienia (popraw je w zakładce „Osoby”).`);

  const lines: string[] = [];
  if (add.length > 0) lines.push(`Nowe osoby: ${add.length}.`);
  if (change.length > 0) lines.push(`Zmienione dane: ${count(change.length, 'osoba', 'osoby', 'osób')} (${count(change.reduce((n, c) => n + c.answers.length, 0), 'odpowiedź', 'odpowiedzi', 'odpowiedzi')}).`);
  if (recordsNew.length > 0) lines.push(`Nowe wpisy w rozszerzeniach: ${recordsNew.length}.`);
  if (recordsChange.length > 0) lines.push(`Zmienione wpisy w rozszerzeniach: ${recordsChange.length}.`);
  if (lines.length === 0) lines.push('Nic do zmiany.');

  return { add, change, recordsNew, recordsChange, lines, warnings };
}

/* -- Die Beschreibung, aus den Fragen DIESES Formulars -------------------------------------- */

export const ENTRIES_KEYS: Readonly<Record<string, string>> = {
  format: `"${ENTRIES_FORMAT}"`,
  version: '1',
  form: 'Identyfikator formularza (tylko informacja — import zawsze dotyczy otwartego formularza)',
  name: 'Nazwa formularza (tylko informacja)',
  entries: 'Osoby na liście — każda to jeden obiekt',
  'entries[].id': 'Identyfikator osoby z eksportu — wtedy jej dane są ZMIENIANE. Pominięty: powstaje nowa osoba (albo dopasowanie po imieniu i nazwisku, jeśli na liście jest dokładnie jedna taka)',
  'entries[].answers': 'Odpowiedzi osoby: { "pytanie": wartość }. Kluczem jest treść pytania (albo jego identyfikator). Pytanie „tak / nie”: true albo false. Czego nie ma, zostaje bez zmian; pusta wartość "" czyści odpowiedź',
  'entries[].records': 'Wpisy w rozszerzeniach wypełnianych przez koordynatora: { "nazwa rozszerzenia": { "okres": { "pytanie": wartość } } }. Okres: klucz okresu (niżej), a w rozszerzeniu jednorazowym "once"'
};

const kindWords = (f: OpenField): string =>
  (f.kind === 'checkbox' ? 'tak / nie — true albo false'
    : f.kind === 'choice' ? `jedna z: ${f.options.map((o) => `"${o}"`).join(', ') || '(brak opcji)'}`
    : f.kind === 'date' ? 'data, "RRRR-MM-DD"'
    : f.kind === 'number' ? 'liczba'
    : f.kind === 'phone' ? 'telefon, np. "+48 600 700 800" (kilka: po przecinku)'
    : KIND_LABEL[f.kind].toLowerCase());

const ROUND_WORDS: Record<Repeat, string> = {
  once: `jednorazowe — okres "${ONCE_KEY}"`,
  day: 'co dzień — okres "RRRR-MM-DD", np. "2026-10-02"',
  week: 'co tydzień — okres "RRRR-Wnn" (tydzień ISO, od poniedziałku), np. "2026-W40"',
  month: 'co miesiąc — okres "RRRR-MM", np. "2026-10"',
  year: 'co rok — okres "RRRR", np. "2026"'
};

const exampleValue = (f: OpenField, sample: number): string | boolean =>
  (f.kind === 'checkbox' ? true
    : f.kind === 'choice' ? (f.options[0] ?? '')
    : f.kind === 'date' ? '1948-03-12'
    : f.kind === 'number' ? '1'
    : f.kind === 'phone' ? '+48 600 700 800'
    : f.kind === 'email' ? 'jan@example.org'
    : f.identityRole === 'given_name' ? ['Jan', 'Maria'][sample % 2]
    : f.identityRole === 'surname' ? ['Kowalski', 'Nowak'][sample % 2]
    : f.identityRole === 'address' ? ['ul. Długa 5/3, 34-600 Limanowa', 'ul. Krótka 12, 34-600 Limanowa'][sample % 2]
    : '…');

/**
 * Die Beschreibung NEBEN dem Import — mit den Fragen und Erweiterungen dieses
 * Formulars: wer sie einem Sprachmodell gibt, bekommt ein Dokument zurück, das
 * hier passt.
 */
export function entriesDescription(ctx: Pick<EntriesContext, 'formName' | 'fields' | 'extensions'>, now: Date = new Date()): string {
  const keys = answerKeys(ctx.fields);
  const readable = ctx.fields.filter((f) => f.label !== null);
  const office = ctx.extensions.filter((e) => e.audience === 'office');

  const sampleAnswers = (sample: number) => Object.fromEntries(readable.slice(0, 5).map((f) => [keys.get(f.fieldId) ?? f.fieldId, exampleValue(f, sample)]));
  const sampleRecords = office.length === 0 ? undefined : Object.fromEntries(office.slice(0, 1).map((ext) => {
    const extKeys = answerKeys(ext.fields);
    const round = ext.repeat === 'once' ? ONCE_KEY : roundOf(ext.repeat, now);
    return [ext.name, { [round]: Object.fromEntries(ext.fields.filter((f) => f.label !== null).slice(0, 4).map((f) => [extKeys.get(f.fieldId) ?? f.fieldId, exampleValue(f, 0)])) }];
  }));

  const example = {
    format: ENTRIES_FORMAT,
    version: 1,
    entries: [
      { answers: sampleAnswers(0), ...(sampleRecords === undefined ? {} : { records: sampleRecords }) },
      { answers: sampleAnswers(1) }
    ]
  };

  return `# Lista osób formularza „${ctx.formName}” jako JSON ("${ENTRIES_FORMAT}", wersja 1)

Co robi import tutaj: DOPISUJE osoby do listy tego formularza i ZMIENIA dane osób już wpisanych; w rozszerzeniach, które wypełnia koordynator, dopisuje i zmienia wpisy (osobno dla każdego okresu). Niczego nie usuwa. Wszystko jest pieczętowane w tej przeglądarce, zanim trafi do usługi.
- Osoba z "id" z eksportu jest zmieniana. Osoba bez "id" powstaje jako nowa — chyba że na liście jest dokładnie jedna osoba o tym samym imieniu i nazwisku: wtedy to ona.
- Zmieniane są tylko odpowiedzi, które są w dokumencie; reszta zostaje.
- Odpowiedzi osoby, która zapisała się sama i ma własny link, import nie zmienia.
- Dopisana osoba nie ma własnego linku — prowadzi ją koordynator.

${Object.entries(ENTRIES_KEYS).map(([key, says]) => `  "${key}" — ${says}`).join('\n')}

## Pytania tego formularza — klucze w "answers"
${readable.length === 0 ? '  (nie da się ich odczytać Twoimi kluczami)' : readable.map((f) => `  "${keys.get(f.fieldId) ?? f.fieldId}" — ${kindWords(f)}`).join('\n')}

## Rozszerzenia — klucze w "records"
${office.length === 0 ? '  (ten formularz nie ma rozszerzeń wypełnianych przez koordynatora)' : office.map((ext) => {
    const extKeys = answerKeys(ext.fields);
    return `  "${ext.name}" — ${ROUND_WORDS[ext.repeat]}${ext.repeat === 'once' ? '' : ` (${REPEAT_LABEL[ext.repeat]}; okresu z przyszłości import nie przyjmie)`}\n${ext.fields.filter((f) => f.label !== null).map((f) => `      "${extKeys.get(f.fieldId) ?? f.fieldId}" — ${kindWords(f)}`).join('\n')}`;
  }).join('\n')}

Przykład:
${JSON.stringify(example, null, 2)}
`;
}
