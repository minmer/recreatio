/**
 * DIE ERWEITERUNG EINES FORMULARS, AUS SICHT DER KANZLEI (0047).
 *
 * <b>Eine Zeile je Mensch des erweiterten Formulars</b> — nicht je Einsendung
 * der Erweiterung. Der Koordinator sucht „Kowalski" und schreibt dazu, was er
 * über ihn wissen muss; ob es dazu schon etwas gibt, sieht er an der Zeile.
 *
 * <code>
 *   ExtensionEntry   was EIN Mensch ergänzt hat — lesen, und wo erlaubt: schreiben
 *   ExtensionSheet   alle Menschen des Formulars, mit ihrer Ergänzung
 *   OfficeAdd        die Kanzlei trägt jemanden in ein Formular ein (0077)
 * </code>
 *
 * <b>Schreiben darf die Kanzlei nur, was sie selbst ausfüllt</b>
 * (`audience = office`). Was der Mensch ergänzt, liest sie; es für ihn zu
 * schreiben hiesse, ihm eine Angabe unterzuschieben, die er in seinem Portal
 * nie gesehen hat.
 *
 * <b>0077 — EINE ERWEITERUNG, DIE SICH WIEDERHOLT</b> (je Tag, Woche, Monat,
 * Jahr): dieselbe Liste, aber für einen ZEITRAUM, den man oben wechselt. Je
 * Mensch und Zeitraum eine Einsendung. Fragen der Art „Tak / nie" lassen sich
 * in der Zeile antippen — am Telefon, unterwegs: die Kranken, die jeden Monat
 * besucht werden (Komunia, Spowiedź, Namaszczenie), die Anwesenheit bei jedem
 * Treffen. Darunter der Verlauf eines Menschen, die Summen des Zeitraums und
 * des Jahres, eine Liste zum Drucken, eine Tabelle zum Herunterladen. Wovon
 * die Liste handelt, weiss sie nicht — das sagen ihre Fragen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  addOfficeEntry, fullNameOf, hideSubmission, isYes, removeSubmission, reviseAcrossAsOffice, YES,
  type Audience, type OpenField, type Submission
} from './form';
import { evaluate, layoutWith, missingIn, type FormDesign } from './formDesign';
import { FormFlow, isRequired } from './FormFlow';
import { readForm, type ReadForm } from './formRead';
import { loadPublicIntake } from './intake';
import { fromBase64Url } from './crypto';
import { saveBlob } from './platform';
import { useRemembered } from './prefs';
import { keysFor } from './ringOf';
import {
  repeatOf, roundAhead, roundLabel, roundOf, roundRange, roundsBetween, roundShort, shiftRound, type Repeat
} from './rounds';
import {
  addressOrder, byPerson, cellText, chipText, isBlank, quickFields, roundsCsv, tallyOf, tallyText,
  type RoundRecord
} from './roundSheet';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';

/** Wie ein Mensch in einer Liste heisst — sein voller Name, sonst die erste Antwort. */
export function nameIn(values: ReadonlyMap<string, string> | undefined, fields: readonly OpenField[]): string {
  if (values === undefined) return '— zapieczętowane —';

  const full = fullNameOf(fields, (fieldId) => values.get(fieldId));
  if (full !== null) return full;

  const first = fields.find((f) => f.kind === 'line' && (values.get(f.fieldId)?.trim() ?? '') !== '');
  return first === undefined ? '— bez imienia —' : values.get(first.fieldId)!.trim();
}

/* -- Was EIN Mensch ergänzt hat -------------------------------------------------- */

/**
 * @param entry Die Ergänzung dieses Menschen — oder `undefined`: noch keine.
 * @param editable Darf die Kanzlei hier schreiben? Nur bei einer Erweiterung,
 *   die sie selbst ausfüllt.
 * @param round 0077 — bei einer wiederkehrenden Erweiterung: für welchen Zeitraum.
 */
export function ExtensionEntry({ extensionId, ext, baseRegistrationId, entry, editable, onSaved, round = '' }: {
  extensionId: string;
  ext: ReadForm;
  baseRegistrationId: string;
  entry: Submission | undefined;
  editable: boolean;
  onSaved: () => void;
  round?: string;
}) {
  const values = entry === undefined ? undefined : ext.opened.get(entry.registrationId);

  const [editing, setEditing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 0093 — was nur der Mensch schreibt, steht hier zum Lesen, nicht zum Schreiben. */
  const writable = useMemo(() => ext.fields.filter((f) => f.personOnly !== true), [ext.fields]);
  const byId = useMemo(() => new Map(writable.map((f) => [f.fieldId, f])), [writable]);
  const layout = useMemo(() => layoutWith(ext.design?.layout ?? [], writable.map((f) => f.fieldId)), [ext.design, writable]);
  const outcome = useMemo(
    () => evaluate({ version: 1, layout, nodes: ext.design?.nodes ?? [], edges: ext.design?.edges ?? [] }, answers),
    [layout, ext.design, answers]);

  const start = () => {
    const from: Record<string, string> = {};
    for (const f of writable) from[f.fieldId] = values?.get(f.fieldId) ?? '';
    setAnswers(from);
    setFailed(null);
    setEditing(true);
  };

  const missing = missingIn(layout, isRequired(byId, outcome), answers, outcome);

  const save = async () => {
    setBusy(true);
    setFailed(null);

    try {
      /* Nur, was zu sehen war — eine verborgene Frage schreibt nichts. */
      const shown = writable.filter((f) => !outcome.hidden.has(f.fieldId));
      const keys = { intakes: ext.intakes, areaOf: ext.areaOf, seatKey: null };

      if (entry === undefined) {
        await addOfficeEntry(extensionId, baseRegistrationId,
          shown.map((f) => ({ fieldId: f.fieldId, value: answers[f.fieldId] ?? '' })), keys, round);
      } else {
        const changed = shown.filter((f) => (answers[f.fieldId] ?? '') !== (values?.get(f.fieldId) ?? ''));
        if (changed.length > 0) {
          await reviseAcrossAsOffice(entry.registrationId,
            changed.map((f) => ({ fieldId: f.fieldId, value: answers[f.fieldId] ?? '' })), keys);
        }
      }

      setEditing(false);
      onSaved();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <FormFlow
          items={layout}
          fields={byId}
          answers={answers}
          outcome={outcome}
          onAnswer={(fieldId, value) => setAnswers((before) => ({ ...before, [fieldId]: value }))}
        />

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy || missing.length > 0}>
            {busy ? 'Zapisywanie…' : 'Zapisz'}
          </button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setEditing(false)}>
            Anuluj
          </button>
          {missing.length > 0 && (
            <span className="wk-blocker">
              Brakuje: {missing.map((id) => byId.get(id)?.label ?? 'zapieczętowane').join(', ')}
            </span>
          )}
        </div>
      </form>
    );
  }

  return (
    <>
      {entry === undefined ? (
        <p className="wk-empty">Jeszcze nic nie uzupełniono.</p>
      ) : values === undefined || values.size === 0 ? (
        <p className="wk-empty">Uzupełnione {new Date(entry.submittedAt).toLocaleDateString('pl-PL')} — tych odpowiedzi nie otworzysz tym kluczem.</p>
      ) : (
        <dl className="wk-card-lines">
          {ext.fields.filter((f) => values.has(f.fieldId)).map((f) => (
            <div key={f.fieldId}>
              <dt className="wk-row-side">{f.label ?? 'zapieczętowane pytanie'}</dt>
              <dd>{values.get(f.fieldId) === '' ? '—' : values.get(f.fieldId)}</dd>
            </div>
          ))}
        </dl>
      )}

      {editable && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={start} disabled={writable.length === 0}>
            {entry === undefined ? 'Uzupełnij' : 'Edytuj'}
          </button>
          {ext.fields.length === 0 && <span className="wk-hint">To rozszerzenie nie ma jeszcze pytań.</span>}
          {ext.fields.length > 0 && writable.length === 0 && <span className="wk-hint">Te odpowiedzi wpisuje i poprawia tylko sama osoba.</span>}
        </div>
      )}
    </>
  );
}

/* -- Die Kanzlei trägt jemanden ein (0077) ------------------------------------------- */

/**
 * JEMANDEN AUF DIE LISTE SETZEN — ohne dass er sich selbst einträgt: wer am
 * Telefon zusagt, auf einem Zettel steht, oder gar nicht selbst handelt (ein
 * Kranker, den der Priester besucht). Die Antworten gehen versiegelt unter die
 * Annahme ihres Bereichs wie jede Einsendung; einen Link hat er dann nicht.
 *
 * <b>Pflichtfragen halten die Kanzlei nicht auf</b> — sie weiss oft erst den
 * Namen und die Adresse, und trägt den Rest nach. Nur ganz leer geht nicht.
 */
export function OfficeAdd({ formId, fields: allFields, design, onAdded, label = 'Dodaj osobę' }: {
  formId: string;
  fields: readonly OpenField[];
  design: FormDesign | null;
  onAdded: () => Promise<void> | void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  /* 0093 — was nur der Mensch schreibt, trägt die Kanzlei nicht für ihn ein. */
  const fields = useMemo(() => allFields.filter((f) => f.personOnly !== true), [allFields]);
  const byId = useMemo(() => new Map(fields.map((f) => [f.fieldId, f])), [fields]);
  const layout = useMemo(() => layoutWith(design?.layout ?? [], fields.map((f) => f.fieldId)), [design, fields]);
  const outcome = useMemo(
    () => evaluate({ version: 1, layout, nodes: design?.nodes ?? [], edges: design?.edges ?? [] }, answers),
    [layout, design, answers]);

  const readable = fields.some((f) => f.label !== null);
  const given = fields
    .filter((f) => !outcome.hidden.has(f.fieldId))
    .map((f) => ({ fieldId: f.fieldId, value: answers[f.fieldId] ?? '' }))
    .filter((a) => a.value.trim() !== '');
  const missing = missingIn(layout, isRequired(byId, outcome), answers, outcome);

  const save = async () => {
    setBusy(true);
    setFailed(null);

    try {
      /* Die öffentliche Annahmehälfte je Antwortbereich — unter ihr geht jede Antwort hinaus. */
      const intakes = new Map<string, Uint8Array>();
      for (const areaId of new Set(fields.map((f) => f.areaId))) {
        intakes.set(areaId, fromBase64Url((await loadPublicIntake(areaId)).publicKey));
      }

      await addOfficeEntry(formId, null, given,
        { intakes, areaOf: new Map(fields.map((f) => [f.fieldId, f.areaId])), seatKey: null });

      setAnswers({});
      setDone((n) => n + 1);
      await onAdded();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się dopisać osoby.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={!readable} onClick={() => { setOpen(true); setFailed(null); }}>
          {label}
        </button>
        {!readable && <span className="wk-hint">Bez klucza formularza nie da się nikogo dopisać.</span>}
      </div>
    );
  }

  return (
    <form className="wk-form wk-office-add" onSubmit={(e) => { e.preventDefault(); if (given.length > 0) void save(); }}>
      <h4 className="wk-h3">{label}</h4>
      <p className="wk-hint">
        Wpisujesz osobę, która nie zapisuje się sama (zgłosiła się telefonicznie, na kartce, albo ktoś ją zgłosił).
        Odpowiedzi są zapieczętowane jak każde zgłoszenie. Taka osoba nie ma własnego linku.
      </p>

      <FormFlow
        items={layout}
        fields={byId}
        answers={answers}
        outcome={outcome}
        onAnswer={(fieldId, value) => setAnswers((before) => ({ ...before, [fieldId]: value }))}
      />

      {failed !== null && <p className="wk-error">{failed}</p>}
      {done > 0 && failed === null && <p className="wk-done">Dopisano ({done}). Możesz wpisać następną osobę.</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || given.length === 0}>
          {busy ? 'Zapisywanie…' : 'Dopisz do listy'}
        </button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => { setOpen(false); setDone(0); }}>
          Zamknij
        </button>
        {missing.length > 0 && given.length > 0 && (
          <span className="wk-hint">
            Do uzupełnienia później: {missing.map((id) => byId.get(id)?.label ?? 'zapieczętowane').join(', ')}
          </span>
        )}
      </div>
    </form>
  );
}

/* -- Alle Menschen, mit ihrer Ergänzung -------------------------------------------- */

const html = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

interface Row {
  readonly r: Submission;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly record: RoundRecord | undefined;
}

/**
 * DIE LISTE ZUM DRUCKEN — der Weg des Tages auf Papier: wer, wo, Telefon, und
 * je „Tak / nie"-Frage ein Kästchen (angekreuzt, wo schon eingetragen). In
 * einem eigenen Fenster; `false`, wenn der Browser keines gab.
 */
function printSheet(title: string, rows: readonly Row[], quick: readonly OpenField[], withAddress: boolean, withPhone: boolean): boolean {
  const opened = globalThis.open('about:blank', '_blank');
  if (opened === null) return false;

  const head = ['Lp.', 'Osoba', ...(withAddress ? ['Adres'] : []), ...(withPhone ? ['Telefon'] : []),
    ...quick.map((f) => chipText(f.label ?? '')), 'Uwagi'];

  const body = rows.map((row, i) => `<tr>
    <td class="n">${i + 1}</td>
    <td>${html(row.name)}</td>
    ${withAddress ? `<td>${html(row.address)}</td>` : ''}
    ${withPhone ? `<td class="t">${html(row.phone)}</td>` : ''}
    ${quick.map((f) => `<td class="b">${isYes(row.record?.values.get(f.fieldId)) ? '☑' : '☐'}</td>`).join('')}
    <td class="u"></td>
  </tr>`).join('');

  opened.document.open();
  opened.document.write(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${html(title)}</title>
<style>
  body { font: 11pt/1.35 Georgia, 'Times New Roman', serif; color: #000; margin: 1.2cm; }
  h1 { font-size: 14pt; margin: 0 0 0.5cm; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #555; padding: 0.12cm 0.18cm; text-align: left; vertical-align: top; }
  th { font-size: 9pt; background: #eee; }
  td.n { width: 0.8cm; text-align: right; }
  td.b { width: 1.1cm; text-align: center; font-size: 14pt; }
  td.t { white-space: nowrap; }
  td.u { width: 4.5cm; }
  tr { break-inside: avoid; }
  @media print { body { margin: 0.8cm; } }
</style></head><body>
<h1>${html(title)}</h1>
<table><thead><tr>${head.map((h) => `<th>${html(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
<script>window.addEventListener('load', function () { window.print(); });</script>
</body></html>`);
  opened.document.close();
  return true;
}

/**
 * Die Liste des Koordinators — auf der Seite, auf der das Formular steht, und
 * im Reiter „Osoby" der Erweiterung selbst.
 *
 * @param repeat 0077 — wie oft die Erweiterung ausgefüllt wird; fehlt es: einmal.
 * @param name Wie die Erweiterung heisst — für die Überschrift des Drucks und den Namen der Datei.
 */
export function ExtensionSheet({ extensionId, baseId, audience, who, repeat: given, name }: {
  extensionId: string;
  baseId: string;
  audience: Audience;
  who: Who;
  repeat?: Repeat;
  name?: string;
}) {
  const repeat = repeatOf(given);
  const repeating = repeat !== 'once';

  const [round, setRound] = useState(() => roundOf(repeat));
  const range = useMemo(() => (repeating ? roundRange(repeat, round) : null), [repeating, repeat, round]);
  const rangeFrom = range?.from ?? '';
  const rangeTo = range?.to ?? '';

  const [base, setBase] = useState<ReadForm | null>(null);
  const [ext, setExt] = useState<ReadForm | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [only, setOnly] = useState<'all' | 'missing'>('all');
  const [sort, setSort] = useRemembered(`ext.sort.${extensionId}`, 'name');

  /*
   * Die Einsendungen der Erweiterung, aufgemacht — als eigener Stand, damit ein
   * Antippen SOFORT zu sehen ist und nicht erst nach dem nächsten Laden. `latest`
   * ist derselbe Stand für die Aufträge, die nacheinander laufen.
   */
  const [records, setRecords] = useState<readonly RoundRecord[]>([]);
  const latest = useRef<readonly RoundRecord[]>([]);
  const apply = useCallback((next: readonly RoundRecord[]) => {
    latest.current = next;
    setRecords(next);

    /*
     * Und dasselbe in `ext` — dort liest die aufgeklappte Zeile (`ExtensionEntry`).
     * Sonst stünde nach einem Antippen darin noch „Jeszcze nic nie uzupełniono",
     * und „Uzupełnij" legte eine zweite Einsendung für denselben Zeitraum an.
     */
    setExt((was) => {
      if (was === null) return was;
      const known = new Map(was.registrations.map((r) => [r.registrationId, r]));
      return {
        ...was,
        registrations: next.map((r) => known.get(r.registrationId) ?? {
          registrationId: r.registrationId, seatId: null, submittedAt: new Date().toISOString(), withdrawnAt: null,
          hidden: false, values: [], checks: [], confirmedAt: null, baseId: r.baseId, round: r.round, byOffice: true,
          extensions: [], marks: []
        }),
        opened: new Map(next.map((r) => [r.registrationId, r.values]))
      };
    });
  }, []);

  /* Was angetippt und noch unterwegs ist: „Mensch|Frage" → wie oft. */
  const [pending, setPending] = useState<ReadonlyMap<string, number>>(new Map());
  const queue = useRef(new Map<string, Promise<void>>());

  const look = useCallback(async (withBase = true) => {
    try {
      const { ring } = await keysFor(who);
      if (ring === null) throw new WorkspaceError('Bez hasła w tej karcie nie da się otworzyć zgłoszeń.');

      const options = rangeFrom === '' ? {} : { range: { from: rangeFrom, to: rangeTo } };
      const [b, e] = await Promise.all([
        withBase ? readForm(baseId, ring) : Promise.resolve(null),
        readForm(extensionId, ring, options)
      ]);

      if (b !== null) setBase(b);
      setExt(e);
      apply(e.registrations.filter((r) => r.baseId !== null).map((r) => ({
        registrationId: r.registrationId, baseId: r.baseId!, round: r.round ?? '',
        values: e.opened.get(r.registrationId) ?? new Map<string, string>()
      })));
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć zgłoszeń.');
    }
  }, [who, baseId, extensionId, rangeFrom, rangeTo, apply]);

  useEffect(() => { void look(); }, [look]);

  const quick = useMemo(() => (ext === null || audience !== 'office' ? [] : quickFields(ext.fields)), [ext, audience]);
  const shownQuick = useMemo(() => (ext === null ? [] : quickFields(ext.fields)), [ext]);
  const mine = useMemo(() => byPerson(records), [records]);

  if (failed !== null && (base === null || ext === null)) return <p className="wk-error">{failed}</p>;
  if (base === null || ext === null) return <p className="wk-card-text">Otwieranie…</p>;

  const addressField = base.fields.find((f) => f.identityRole === 'address');
  const phoneField = base.fields.find((f) => f.identityRole === 'phone') ?? base.fields.find((f) => f.kind === 'phone');
  const entryOf = (registrationId: string) =>
    ext.registrations.find((r) => r.baseId === registrationId && (r.round ?? '') === round);

  const people: Row[] = base.registrations
    .filter((r) => r.withdrawnAt === null)
    .map((r) => {
      const values = base.opened.get(r.registrationId);
      return {
        r,
        name: nameIn(values, base.fields),
        address: addressField === undefined ? '' : (values?.get(addressField.fieldId) ?? '').trim(),
        phone: phoneField === undefined ? '' : (values?.get(phoneField.fieldId) ?? '').trim(),
        record: mine.get(r.registrationId)?.get(round)
      };
    });

  const filled = (row: Row) => row.record !== undefined && !isBlank(row.record.values);
  const byAddress = sort === 'address' && addressField !== undefined;

  const rows = people
    .filter((row) => only === 'all' || !filled(row))
    .sort((a, b) => (byAddress ? addressOrder(a.address, b.address) : 0) || a.name.localeCompare(b.name, 'pl'));

  const missingCount = people.filter((row) => !filled(row)).length;
  const here = records.filter((r) => r.round === round);
  const title = `${name ?? 'Lista'}${repeating ? ` — ${roundLabel(repeat, round)}` : ''}`;

  /**
   * EINE FRAGE ANTIPPEN. Je Mensch nacheinander (zwei schnelle Tipps dürfen
   * sich nicht überholen): gibt es für den Zeitraum noch nichts, entsteht die
   * Einsendung; sonst wird die eine Antwort berichtigt. Bleibt nichts mehr
   * angekreuzt und nichts geschrieben, geht die Einsendung wieder — „brak"
   * heisst dann wieder „brak", nicht „leer besucht".
   */
  const toggle = (baseRegistrationId: string, field: OpenField) => {
    const slot = `${baseRegistrationId}|${field.fieldId}`;
    setPending((was) => new Map(was).set(slot, (was.get(slot) ?? 0) + 1));
    setNote(null);

    const run = async () => {
      const now = latest.current;
      const record = now.find((r) => r.baseId === baseRegistrationId && r.round === round);
      const next = isYes(record?.values.get(field.fieldId)) ? '' : YES;
      const keys = { intakes: ext.intakes, areaOf: ext.areaOf, seatKey: null };

      if (record === undefined) {
        const made = await addOfficeEntry(extensionId, baseRegistrationId, [{ fieldId: field.fieldId, value: next }], keys, round);
        apply([...latest.current, { registrationId: made.registrationId, baseId: baseRegistrationId, round, values: new Map([[field.fieldId, next]]) }]);
        return;
      }

      const values = new Map(record.values).set(field.fieldId, next);

      if (isBlank(values)) {
        await removeSubmission(record.registrationId);
        apply(latest.current.filter((r) => r.registrationId !== record.registrationId));
      } else {
        await reviseAcrossAsOffice(record.registrationId, [{ fieldId: field.fieldId, value: next }], keys);
        apply(latest.current.map((r) => (r.registrationId === record.registrationId ? { ...r, values } : r)));
      }
    };

    const before = queue.current.get(baseRegistrationId) ?? Promise.resolve();
    const after = before.then(run)
      .catch((e: unknown) => { setNote(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać — spróbuj ponownie.'); })
      .finally(() => {
        setPending((was) => {
          const next = new Map(was);
          const left = (next.get(slot) ?? 1) - 1;
          if (left <= 0) next.delete(slot); else next.set(slot, left);
          return next;
        });
      });
    queue.current.set(baseRegistrationId, after);
  };

  const drop = async (row: Row) => {
    if (!window.confirm(`Zdjąć z listy: ${row.name}? Wcześniejsze wpisy zostają; osobę można przywrócić w formularzu głównym („Pokaż też ukryte").`)) return;
    try {
      await hideSubmission(row.r.registrationId, true);
      setOpenId(null);
      await look();
    } catch (e) {
      setNote(e instanceof WorkspaceError ? e.message : 'Nie udało się zdjąć z listy.');
    }
  };

  const next = repeating ? shiftRound(repeat, round, 1) : round;
  const current = roundOf(repeat);

  return (
    <section className="wk-panel">
      <div className="wk-sms-bar">
        <h3 className="wk-h2">Osoby ({people.length})</h3>
        <label className="wk-inline">
          <span className="wk-hint">Pokaż:</span>
          <select value={only} onChange={(e) => setOnly(e.target.value === 'missing' ? 'missing' : 'all')}>
            <option value="all">wszystkie osoby</option>
            <option value="missing">{repeating ? 'bez wpisu w tym okresie' : 'bez uzupełnienia'} ({missingCount})</option>
          </select>
        </label>
        {addressField !== undefined && (
          <label className="wk-inline">
            <span className="wk-hint">Kolejność:</span>
            <select value={byAddress ? 'address' : 'name'} onChange={(e) => setSort(e.target.value)}>
              <option value="name">według nazwiska</option>
              <option value="address">według adresu (trasa)</option>
            </select>
          </label>
        )}
      </div>

      {repeating && (
        <div className="wk-round-bar" role="group" aria-label="Okres">
          <button type="button" className="wk-btn wk-btn-quiet" aria-label="Poprzedni okres" onClick={() => { setOpenId(null); setRound(shiftRound(repeat, round, -1)); }}>‹</button>
          <strong className="wk-round-now" aria-live="polite">{roundLabel(repeat, round)}</strong>
          <button type="button" className="wk-btn wk-btn-quiet" aria-label="Następny okres" disabled={roundAhead(repeat, next)} onClick={() => { setOpenId(null); setRound(next); }}>›</button>
          {round !== current && (
            <button type="button" className="wk-link-btn" onClick={() => { setOpenId(null); setRound(current); }}>bieżący okres</button>
          )}
        </div>
      )}

      <p className="wk-hint">
        {audience === 'office'
          ? 'To wypełnia tylko koordynator — osoba nie widzi ani pytań, ani odpowiedzi.'
          : 'To uzupełnia osoba przez swój link. Tutaj widzisz, co wpisała.'}
        {quick.length > 0 && ' Pytania „tak / nie” zaznaczasz jednym dotknięciem w wierszu.'}
      </p>

      {note !== null && <p className="wk-error" role="alert">{note}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}

      {rows.length === 0 ? (
        <p className="wk-empty">
          {people.length === 0 ? 'Na liście nie ma jeszcze nikogo.' : repeating ? 'W tym okresie wszyscy mają wpis.' : 'Wszyscy mają uzupełnione.'}
        </p>
      ) : (
        <ul className="wk-entry-list">
          {rows.map((row) => {
            const { r, record } = row;
            const open = openId === r.registrationId;
            const entry = entryOf(r.registrationId);
            const has = filled(row);
            const words = record === undefined ? '' : ext.fields
              .filter((f) => f.kind !== 'checkbox' && (record.values.get(f.fieldId) ?? '').trim() !== '')
              .map((f) => (record.values.get(f.fieldId) ?? '').trim()).join(' · ');

            return (
              <li key={r.registrationId} className="wk-entry">
                <div className="wk-entry-head">
                  <div className="wk-entry-who">
                    <strong className="wk-entry-name">{row.name}</strong>
                    {(row.address !== '' || row.phone !== '') && (
                      <span className="wk-entry-sub">
                        {row.address}
                        {row.address !== '' && row.phone !== '' && ' · '}
                        {row.phone !== '' && <a className="wk-entry-phone" href={`tel:${row.phone.split(/[,;]/)[0].replace(/[^\d+]/g, '')}`}>{row.phone}</a>}
                      </span>
                    )}
                    {words !== '' && <span className="wk-entry-sub wk-entry-words">{clip(words, 90)}</span>}
                  </div>

                  {quick.length > 0 ? (
                    <span className="wk-round-chips" role="group" aria-label={`${row.name} — ${roundLabel(repeat, round) || 'wpis'}`}>
                      {quick.map((f) => {
                        const waiting = (pending.get(`${r.registrationId}|${f.fieldId}`) ?? 0) % 2 === 1;
                        const on = isYes(record?.values.get(f.fieldId)) !== waiting;
                        return (
                          <button
                            key={f.fieldId} type="button" aria-pressed={on} title={f.label ?? ''}
                            className={`wk-round-chip${on ? ' is-on' : ''}${pending.has(`${r.registrationId}|${f.fieldId}`) ? ' is-waiting' : ''}`}
                            onClick={() => toggle(r.registrationId, f)}
                          >
                            {chipText(f.label ?? '')}
                          </button>
                        );
                      })}
                    </span>
                  ) : (
                    <span className="wk-tags">
                      {has
                        ? <span className="wk-tag wk-tag-open">{shownQuick.length > 0 && cellText(shownQuick, record) !== '•' ? cellText(shownQuick, record) : 'uzupełnione'}</span>
                        : <span className="wk-tag">brak</span>}
                    </span>
                  )}

                  <button
                    type="button" className="wk-link-btn wk-entry-more" aria-expanded={open}
                    onClick={() => setOpenId(open ? null : r.registrationId)}
                  >
                    {open ? 'Mniej' : audience === 'office' && !has && quick.length === 0 ? 'Uzupełnij' : 'Więcej'}
                  </button>
                </div>

                {open && (
                  <div className="wk-entry-body">
                    <ExtensionEntry
                      extensionId={extensionId}
                      ext={ext}
                      baseRegistrationId={r.registrationId}
                      entry={entry}
                      editable={audience === 'office'}
                      round={round}
                      onSaved={() => void look(false)}
                    />

                    {repeating && range !== null && (
                      <History
                        repeat={repeat} from={range.from} to={range.to} label={range.label} round={round}
                        quick={shownQuick} mine={mine.get(r.registrationId)} onPick={setRound}
                      />
                    )}

                    <div className="wk-actions">
                      <a className="wk-link-btn" href={viewPath('modules', 'form', baseId)}>Dane osoby w formularzu głównym</a>
                      {audience === 'office' && (
                        <button type="button" className="wk-link-btn" onClick={() => void drop(row)}>Zdejmij z listy</button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {repeating && range !== null && (
        <div className="wk-round-totals">
          <p>
            <strong>{roundLabel(repeat, round)}</strong>: wpisy {tallyOf(ext.fields, here).records} z {people.length}
            {tallyText(ext.fields, tallyOf(ext.fields, here)) !== '' && ` · ${tallyText(ext.fields, tallyOf(ext.fields, here))}`}
          </p>
          <p className="wk-hint">
            Razem {range.label}: wpisy {tallyOf(ext.fields, records).records}
            {tallyText(ext.fields, tallyOf(ext.fields, records)) !== '' && ` · ${tallyText(ext.fields, tallyOf(ext.fields, records))}`}
          </p>
        </div>
      )}

      <div className="wk-actions">
        <button type="button" className="wk-link-btn" disabled={rows.length === 0} onClick={() => {
          if (!printSheet(title, rows, shownQuick, addressField !== undefined, phoneField !== undefined)) {
            setNote('Przeglądarka zablokowała nowe okno — pozwól na wyskakujące okna dla tej strony.');
          }
        }}>Drukuj listę</button>
        {repeating && range !== null && (
          <button type="button" className="wk-link-btn" disabled={records.length === 0} onClick={() => {
            const csv = roundsCsv(repeat, ext.fields, people.map((p) => ({ baseId: p.r.registrationId, name: p.name })), records);
            void saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${(name ?? 'wpisy').replace(/[^\p{L}\p{N}]+/gu, '-')}-${range.label}.csv`);
          }}>Pobierz CSV ({range.label})</button>
        )}
      </div>

      {audience === 'office' && (
        <OfficeAdd formId={baseId} fields={base.fields} design={base.design} onAdded={() => look()} />
      )}
    </section>
  );
}

/**
 * DER VERLAUF EINES MENSCHEN — ein Kästchen je Zeitraum des Abschnitts (bei
 * Monaten und Jahren alle, bei Tagen und Wochen nur die mit einem Eintrag),
 * darin die Anfangsbuchstaben des Angekreuzten. Darunter, wann jede Frage
 * zuletzt angekreuzt war — „Namaszczenie: marzec 2026".
 */
function History({ repeat, from, to, label, round, quick, mine, onPick }: {
  repeat: Repeat;
  from: string;
  to: string;
  label: string;
  round: string;
  quick: readonly OpenField[];
  mine: ReadonlyMap<string, RoundRecord> | undefined;
  onPick: (round: string) => void;
}) {
  const now = roundOf(repeat);
  const all = roundsBetween(repeat, from, to < now ? to : now);
  const shown = repeat === 'month' || repeat === 'year' ? all : all.filter((key) => mine?.has(key) === true || key === round);

  const last = quick.map((f) => {
    const key = [...all].reverse().find((k) => isYes(mine?.get(k)?.values.get(f.fieldId)));
    return key === undefined ? null : `${f.label}: ${roundLabel(repeat, key)}`;
  }).filter((line): line is string => line !== null);

  return (
    <div className="wk-round-past">
      <h4 className="wk-h3">Historia — {label}</h4>
      <div className="wk-round-history" role="group" aria-label={`Historia — ${label}`}>
        {shown.map((key) => {
          const text = cellText(quick, mine?.get(key));
          return (
            <button
              key={key} type="button" title={roundLabel(repeat, key)}
              className={`wk-round-cell${key === round ? ' is-on' : ''}${text !== '' ? ' has' : ''}`}
              onClick={() => onPick(key)}
            >
              <span>{roundShort(repeat, key)}</span>
              <strong>{text === '' ? '—' : text}</strong>
            </button>
          );
        })}
      </div>
      {last.length > 0 && <p className="wk-hint">Ostatnio — {last.join(' · ')}</p>}
    </div>
  );
}
