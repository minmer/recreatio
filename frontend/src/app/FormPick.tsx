/**
 * EIN FORMULAR WÄHLEN — und von ihm die Fragen, deren Antworten sichtbar sind.
 *
 * <b>Wozu:</b> ein Baustein, der eigene Einsendungen zeigt („Zgłoszenie
 * osoby"), muss sagen, AUS WELCHEM Formular und WELCHE Antworten. Vorher stand
 * er ohne jede Einstellung da und zeigte alles, was je über diesen Platz
 * eingegangen war — zwei Formulare in einer Liste, ohne dass jemand es
 * entschieden hatte.
 *
 * <b>Gewählt wird aus Namen, nicht aus Kennungen</b> — wie bei `PickResource`.
 * Was drinsteht und nicht mehr zu finden ist, wird gezeigt, nicht verschwiegen.
 *
 * <b>Die Fragen sind versiegelt.</b> Um sie beim Namen zu nennen, braucht es
 * den Schlüssel des Formularbereichs: erst den veröffentlichten, sonst den
 * eigenen (die Kanzlei hält ihn). Bleibt eine zu, steht sie als „pytanie N"
 * da — wählbar ist sie trotzdem.
 */

import { useEffect, useState } from 'react';

import { loadPublicKey, myEpochKeys } from './area';
import { fromBase64Url } from './crypto';
import { asked, loadFields, loadForm, openFields, type OpenField, type SealedField } from './form';
import { loadModules, type ModuleRow } from './module';
import type { PartModule } from './part';
import { keysFor } from './ringOf';
import { viewPath } from './routes';
import { whoIsThere } from './session';

/**
 * Was sich ändert, wenn ein anderes Formular gewählt wird: das Formular — und
 * die Auswahl seiner Fragen, die sich auf dieses Feld bezieht. Kennungen des
 * alten Formulars bedeuten im neuen nichts; die Vorgabe ist dann „alle".
 */
export function pickedForm(def: PartModule, key: string, formId: string): Record<string, string> {
  const patch: Record<string, string> = { [key]: formId };

  for (const field of def.fields) {
    if (field.kind === 'questions' && field.of === key) patch[field.key] = formId === '' ? '' : '*';
  }

  return patch;
}

export function PickForm({ value, busy, onPick }: {
  value: string;
  busy: boolean;
  onPick: (moduleId: string) => void;
}) {
  const [rows, setRows] = useState<readonly ModuleRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadModules()
      .then(({ modules }) => { if (alive) setRows(modules.filter((m) => m.kind === 'form')); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <p className="wk-hint">Wczytywanie formularzy…</p>;

  const known = value === '' || rows.some((r) => r.moduleId === value);

  return (
    <>
      <select value={known ? value : ''} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">— wybierz formularz —</option>
        {rows.map((r) => (
          <option key={r.moduleId} value={r.moduleId}>
            {r.name}{r.fields > 0 ? ` · ${r.fields} pyt.` : ''}
            {r.extendsId !== null ? (r.audience === 'office' ? ' · rozszerzenie (koordynator)' : ' · rozszerzenie (osoba)') : ''}
          </option>
        ))}
      </select>

      {!known && (
        <span className="wk-blocker">
          Wybrany formularz nie jest już dostępny — usunięto go albo nie masz do niego dostępu.
        </span>
      )}

      {value !== '' && known && (
        <a className="wk-link-btn" href={viewPath('modules', 'form', value)}>
          Otwórz ten formularz
        </a>
      )}

      {rows.length === 0 && <span className="wk-hint">Nie ma jeszcze żadnego formularza.</span>}
    </>
  );
}

/**
 * Die Fragen eines Formulars, lesbar gemacht — so weit es geht.
 *
 * Erst der Weg der Kanzlei (alle Fragen, auch aus einem geschlossenen
 * Formular), sonst der öffentliche. Die Schlüssel: veröffentlicht, sonst die
 * eigenen.
 */
export async function questionsOf(formId: string): Promise<readonly OpenField[]> {
  let sealed: readonly SealedField[];

  try {
    /* 0086 — nur, was das Formular fragt. */
    sealed = asked((await loadFields(formId)).fields);
  } catch {
    sealed = (await loadForm(formId)).fields;
  }

  const keys = new Map<string, Uint8Array>();
  const areas = [...new Set(sealed.map((f) => f.labelAreaId ?? f.areaId))];

  for (const areaId of areas) {
    try { keys.set(areaId, fromBase64Url((await loadPublicKey(areaId)).key)); } catch { /* nicht offen */ }
  }

  const closed = areas.filter((areaId) => !keys.has(areaId));

  if (closed.length > 0) {
    try {
      const who = await whoIsThere();
      const ring = who === null ? null : (await keysFor(who)).ring;

      if (ring !== null) {
        for (const areaId of closed) {
          const epoch = sealed.find((f) => (f.labelAreaId ?? f.areaId) === areaId)?.labelEpoch;
          try {
            const key = epoch === undefined ? undefined : (await myEpochKeys(ring, areaId)).get(epoch);
            if (key !== undefined) keys.set(areaId, key);
          } catch { /* keine Zuteilung */ }
        }
      }
    } catch {
      // Ohne Schlüsselbund bleiben sie „pytanie N" — wählbar sind sie trotzdem.
    }
  }

  return openFields(sealed, keys);
}

export function PickQuestions({ formId, value, busy, onPick, subforms = false }: {
  /** Das Formular, dessen Fragen gewählt werden — leer heisst: erst eines wählen. */
  formId: string;
  value: string;
  busy: boolean;
  onPick: (value: string) => void;

  /**
   * 0104 — AUCH DIE FRAGEN SEINER UNTERFORMULARE, je unter ihrem Namen: die
   * Spalten der „Lista osób" (was die Person in „Cele" schrieb, die Notatka
   * des Koordinators). „Wszystkie" nimmt sie dann mit.
   */
  subforms?: boolean;
}) {
  const [fields, setFields] = useState<readonly OpenField[] | null>(null);
  const [groups, setGroups] = useState<readonly { readonly moduleId: string; readonly name: string; readonly fields: readonly OpenField[] }[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (formId === '') { setFields([]); setGroups([]); return; }

    let alive = true;
    setFields(null);
    setFailed(false);

    const load = async () => {
      const main = await questionsOf(formId);
      if (!subforms) return { main, subs: [] };
      const modules = await loadModules().then((r) => r.modules).catch(() => [] as readonly ModuleRow[]);
      const subs = await Promise.all(modules
        .filter((m) => m.kind === 'form' && m.extendsId === formId)
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
        .map(async (m) => ({ moduleId: m.moduleId, name: m.name, fields: await questionsOf(m.moduleId).catch(() => [] as readonly OpenField[]) })));
      return { main, subs: subs.filter((g) => g.fields.length > 0) };
    };

    load()
      .then(({ main, subs }) => { if (alive) { setFields(main); setGroups(subs); } })
      .catch(() => { if (alive) { setFields([]); setGroups([]); setFailed(true); } });

    return () => { alive = false; };
  }, [formId, subforms]);

  if (formId === '') return <span className="wk-hint">Najpierw wybierz formularz.</span>;
  if (fields === null) return <p className="wk-hint">Wczytywanie pytań…</p>;
  if (failed) return <span className="wk-blocker">Nie udało się wczytać pytań tego formularza.</span>;

  const every = [...fields, ...groups.flatMap((g) => g.fields)];
  const all = value.trim() === '*';
  const chosen = new Set(all ? every.map((f) => f.fieldId)
    : value.split(',').map((one) => one.trim()).filter((one) => one !== ''));

  /* Was gewählt ist und nicht mehr existiert — gelöschte Fragen fallen still heraus. */
  const toggle = (fieldId: string, on: boolean) => {
    const next = every.map((f) => f.fieldId).filter((id) => (id === fieldId ? on : chosen.has(id)));
    onPick(next.join(','));
  };

  const name = (f: OpenField, at: number) => f.label ?? `pytanie ${at + 1} (zapieczętowane)`;
  const row = (f: OpenField, at: number) => (
    <li key={f.fieldId}>
      <label className="wk-check">
        <input
          type="checkbox"
          checked={chosen.has(f.fieldId)}
          disabled={busy || all}
          onChange={(e) => toggle(f.fieldId, e.target.checked)}
        />
        <span>{name(f, at)}</span>
      </label>
      {/* Ob er sie ändern darf, sagt die Frage (0044) — hier nur zur Auskunft (bei Spalten unwichtig). */}
      {!subforms && (
        <span className="wk-row-side">
          {f.selfEdit ? 'może poprawić' : 'tylko do odczytu'}
        </span>
      )}
    </li>
  );

  return (
    <div className="wk-pick-questions">
      <div className="wk-seg" role="group" aria-label="Które odpowiedzi">
        <button
          type="button"
          aria-pressed={all}
          className={all ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
          disabled={busy || all}
          onClick={() => onPick('*')}
        >
          Wszystkie
        </button>
        <button
          type="button"
          aria-pressed={!all}
          className={!all ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
          disabled={busy || !all}
          onClick={() => onPick(every.map((f) => f.fieldId).join(','))}
        >
          Tylko wybrane
        </button>
      </div>

      <span className="wk-hint">
        {all
          ? subforms ? 'Także pytania podformularzy i pytania, które dopiszesz później.' : 'Także odpowiedzi na pytania, które dopiszesz później.'
          : 'Pytanie dopisane później pojawi się tu dopiero, gdy je zaznaczysz.'}
      </span>

      {every.length === 0 ? (
        <span className="wk-hint">Ten formularz nie ma jeszcze pytań.</span>
      ) : (
        <ul className="wk-pick-list">
          {fields.map(row)}
          {groups.map((g) => [
            <li key={`g:${g.moduleId}`} className="wk-pick-group" data-pick-subform={g.moduleId}>Podformularz „{g.name}"</li>,
            ...g.fields.map(row)
          ])}
        </ul>
      )}

      {!all && chosen.size === 0 && (
        <span className="wk-blocker">
          {subforms ? 'Nic nie zaznaczono — lista pokaże tylko osoby i telefony.' : 'Nic nie zaznaczono — ta osoba nie zobaczy żadnej odpowiedzi.'}
        </span>
      )}

      {!subforms && (
        <span className="wk-hint">
          Czy odpowiedź można poprawić, ustawia się przy pytaniu w formularzu (zakładka „Pytania").
        </span>
      )}
    </div>
  );
}
