/**
 * DER EDITOR EINES RODZAJ — seine Felder, ihr Typ, wohin ein Verweis zeigt
 * (COGITA.md §2.2). 2026-10-23 aus `SchemaEditor.tsx` herausgelöst: DERSELBE
 * Editor beschreibt die Rodzaje einer Baza wiedzy und die Rodzaje tekstów des
 * Skryptorium (`scriptorium/TextTypeEditor.tsx`) — es gibt keinen zweiten.
 * Was er kennen muss (Ziele eines Verweises, feste Felder, Probleme), bekommt
 * er gesagt; er liest keine Baza selbst.
 */

import { Fragment, useState, type ReactNode } from 'react';

import { QUANTITY_OPTIONS } from './nodeFields';
import { findUnit, guessKind, kindById, kindsText, measures } from '../core/quantities';
import {
  FIELD_KEY, FIELD_ROLES, FIELD_TYPE_LABEL, FIELD_TYPES, MEDIA_TYPES, patternKeys, RANGE_OF, readKind,
  type FieldDef, type FieldType, type KindDef
} from './schema';

/*
  2026-10-17 — EIN VERWEIS AUF EINEN RODZAJ IST EIN TYP FÜR SICH. „Język ←
  Słowo ← Tłumaczenie" ist das Häufigste, was man baut; hinter „Odwołanie" und
  dann „Więcej" war das Ziel versteckt. Jetzt steht jeder Rodzaj als eigener
  Eintrag in der Liste der Typen (`ref:<id>`); mehrere Ziele bleiben in „Więcej".
*/
const REF_TO = 'ref:';
const typeValue = (f: FieldDef): string => (f.type === 'ref' && f.to?.length === 1 ? `${REF_TO}${f.to[0]}` : f.type);

const blankField = (n: number): FieldDef => ({ key: `pole${n}`, label: `Pole ${n}`, type: 'line', multi: false, uncertain: false });

/*
  2026-10-17 — DIE ZEILE EINES FELDES BRAUCHT EINE FESTE KENNUNG. Ein Feld hat
  keine eigene; sein Schlüssel ist genau das, was man gerade tippt. Als
  Schlüssel der Zeile stellte jeder Buchstabe sie neu auf, und das Eingabefeld
  verlor nach jedem Zeichen den Fokus. Die Nummer hängt am Feld und wandert mit,
  wenn es sich ändert (`setField`), verschoben oder gelöscht wird.
*/
const rowKeys = new WeakMap<FieldDef, number>();
let rowSeq = 0;
const rowKey = (field: FieldDef): number => {
  let key = rowKeys.get(field);
  if (key === undefined) { key = ++rowSeq; rowKeys.set(field, key); }
  return key;
};

/** Ein Ziel eines Verweises: ein Rodzaj, mit dem Namen, unter dem er in der Liste steht. */
export interface KindTarget {
  readonly id: string;
  readonly name: string;
}

/** Was dieser Editor anbietet — die Vorgaben sind die einer Baza wiedzy. */
export interface KindFormOptions {
  /** Welche Typen zur Wahl stehen. */
  readonly types?: readonly FieldType[];
  /** „Niepewne": Stand, Quelle und Notiz je Wert. */
  readonly uncertain?: boolean;
  /** Muster des Etiketts und „Co odróżnia imienników" (ein Rodzaj tekstu hat seinen Titel). */
  readonly pattern?: boolean;
  /** 2026-10-31 — der Wzór tekstu do czytania (mit `pattern`; nicht bei der Frage: sie liest sich als ihr Titel). */
  readonly reading?: boolean;
  /** Schlüssel, die schon belegt sind — mit dem Grund (die festen Felder eines Textes). */
  readonly reserved?: ReadonlyMap<string, string>;
  readonly nameLabel?: string;
  readonly saveLabel?: string;
  /** Die Rolle eines Feldes für die eingebauten Werkzeuge (nur Nauka). */
  readonly roles?: boolean;
  /** Ein Satz unter dem Namen. */
  readonly hint?: ReactNode;
}

export function KindForm({ draft, writes, busy, targets, fixedKeys = new Set(), base = false, problems = [], extra, readingPreview, options = {}, onChange, onSave, onRemove }: {
  draft: KindDef;
  writes: boolean;
  busy: boolean;
  /** Wohin ein Verweis zeigen kann (dieser Rodzaj selbst steht schon da). */
  targets: readonly KindTarget[];
  /** Felder, deren Gestalt feststeht (die eines eingebauten Rodzaj). */
  fixedKeys?: ReadonlySet<string>;
  /** Ein eingebauter Rodzaj: Felder bleiben, nur Namen ändern sich. */
  base?: boolean;
  problems?: readonly string[];
  /** Unter dem Kopf — z. B. „+ Pola nauki" am Thema. */
  extra?: ReactNode;
  /** 2026-10-31 — unter dem Wzór tekstu: ein Eintrag dieses Rodzaju, wie ihn der Lernende damit sieht (die Baza zeichnet ihn). */
  readingPreview?: ReactNode;
  options?: KindFormOptions;
  onChange: (k: KindDef) => void;
  onSave: () => void;
  onRemove?: () => void;
}) {
  const types = options.types ?? FIELD_TYPES;
  const uncertain = options.uncertain !== false;
  const pattern = options.pattern !== false;
  const reserved = options.reserved ?? new Map<string, string>();
  const keys = new Set<string>();
  const dupes = draft.fields.filter((f) => { const d = keys.has(f.key); keys.add(f.key); return d; }).map((f) => f.key);
  const bad = draft.fields.filter((f) => !FIELD_KEY.test(f.key)).map((f) => f.key);
  const taken = draft.fields.filter((f) => reserved.has(f.key)).map((f) => f.key);
  const set = (patch: Partial<KindDef>) => onChange({ ...draft, ...patch });
  /* Wohin ein Verweis zeigen kann: dieser Rodzaj selbst (auch ungespeichert — Synonym, Übersetzung), dann alle anderen. */
  const allTargets = [{ id: draft.id, name: `${draft.name} (ten rodzaj)` }, ...targets.filter((k) => k.id !== draft.id)];
  /* Ein neuer Typ räumt auf, was nur zum alten passte (Optionen, Ziele, Einheit) — sonst bleibt das Feld, wie es ist. */
  const setField = (i: number, patch: Partial<FieldDef>) => set({
    fields: draft.fields.map((f, j) => {
      if (j !== i) return f;
      const merged = { ...f, ...patch };
      const next = patch.type === undefined || patch.type === f.type ? merged : readKind(draft.id, { fields: [merged] }).fields[0] ?? merged;
      rowKeys.set(next, rowKey(f));
      return next;
    })
  });
  /* Welche Felder ihre Einstellungen zeigen — nach der Nummer der Zeile, damit es beim Verschieben mitgeht. */
  const [opened, setOpened] = useState<ReadonlySet<number>>(new Set());
  const toggle = (key: number) => setOpened((was) => {
    const next = new Set(was);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const move = (i: number, by: -1 | 1) => {
    const fields = [...draft.fields];
    const to = i + by;
    if (to < 0 || to >= fields.length) return;
    [fields[i], fields[to]] = [fields[to], fields[i]];
    set({ fields });
  };
  const columns = uncertain ? 7 : 6;

  return (
    <form className="wk-form cg cg-kind-form" onSubmit={(e) => { e.preventDefault(); if (writes) onSave(); }}>
      <div className="cg-row">
        <label className="wk-field"><span>{options.nameLabel ?? 'Nazwa rodzaju'}</span><input value={draft.name} disabled={!writes} onChange={(e) => set({ name: e.target.value })} /></label>
        {pattern && <label className="wk-field"><span>Wzór etykiety</span><input value={draft.label} disabled={!writes} placeholder="{givenNames} {surname}" onChange={(e) => set({ label: e.target.value })} /></label>}
        {pattern && (
          <label className="wk-field"><span>Co odróżnia imienników</span>
            <select value={draft.tells ?? ''} disabled={!writes} onChange={(e) => set({ tells: e.target.value === '' ? undefined : e.target.value })}>
              <option value="">—</option>
              {draft.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
        )}
      </div>
      {options.hint}
      {pattern && <p className="wk-hint">W etykiecie: {draft.fields.map((f) => `{${f.key}}`).join(' ')} {patternKeys(draft.label).length === 0 && '— wzór nie używa jeszcze żadnego pola.'}</p>}
      {base && <p className="wk-hint">Pola wbudowanego rodzaju zostają (korzystają z nich wbudowane narzędzia: przypisy, karty, sprawdzanie odpowiedzi) — można zmienić ich nazwy i dodać własne.</p>}
      {/* 2026-10-31 — wie ein Eintrag zum Lesen aussieht („Nowy temat", die Erklärung): ein Zapis mit Feldern in Klammern (`reading.ts`). */}
      {pattern && options.reading !== false && (
        <div className="cg-kind-reading" data-kind-reading="">
          <label className="wk-field"><span>Tekst do czytania — wzór</span>
            <textarea rows={4} value={draft.reading ?? ''} disabled={!writes} placeholder={'{streszczenie}\n\n{opis}\n\n**Wydarzenia**\n{wydarzenia}'}
              onChange={(e) => set({ reading: e.target.value === '' ? undefined : e.target.value })} />
          </label>
          <p className="cg-muted">
            Tak uczący się widzi wpis tego rodzaju: „Nowy temat” przed pierwszym pytaniem i wyjaśnienie po odpowiedzi. Pola w klamrach, zapis jak w tekście
            (**pogrubienie**, *kursywa*, ## śródtytuł, przypis [@dzieło, s. 12]). Pierwszy akapit to zapowiedź, reszta po „Czytaj dalej”; lista sama w linii pod
            pogrubionym śródtytułem jest zwinięta; część do pustej linii, w której wszystkie pola są puste, znika. Puste pole wzoru: streszczenie albo pierwszy
            akapit, potem pola z tekstem.
          </p>
          {readingPreview}
        </div>
      )}
      {extra}

      {/*
        2026-10-17 — DIE EINSTELLUNGEN EINES FELDES STEHEN UNTER SEINER ZEILE, über
        die ganze Breite. In einer Spalte der Tabelle bekamen sie, was übrig
        blieb: die Liste der Rodzaje stand Wort für Wort untereinander, und das
        Formular (schmal wie alle `wk-form`) schob die Tabelle nach rechts aus
        dem Bild. Schmal steht jedes Feld als kleiner Block mit Beschriftungen.
      */}
      <div className="cg-fields-wrap">
        <table className="cg-table cg-fields">
          <thead><tr><th>Klucz</th><th>Nazwa</th><th>Typ</th><th>Kilka</th>{uncertain && <th>Niepewne</th>}<th>Więcej</th><th /></tr></thead>
          <tbody>
            {draft.fields.map((f, i) => {
              const fixed = fixedKeys.has(f.key);
              const key = rowKey(f);
              const open = opened.has(key);
              return (
                <Fragment key={key}>
                  <tr className={`cg-field-row${open ? ' is-open' : ''}`}>
                    <td className="cg-field-key" data-label="Klucz"><input value={f.key} disabled={!writes || fixed} onChange={(e) => setField(i, { key: e.target.value })} aria-label="Klucz pola" /></td>
                    <td className="cg-field-label" data-label="Nazwa"><input value={f.label} disabled={!writes} onChange={(e) => setField(i, { label: e.target.value })} aria-label="Nazwa pola" /></td>
                    <td className="cg-field-type" data-label="Typ">
                      <select value={typeValue(f)} disabled={!writes || fixed} aria-label="Typ pola"
                        onChange={(e) => setField(i, e.target.value.startsWith(REF_TO) ? { type: 'ref', to: [e.target.value.slice(REF_TO.length)] } : { type: e.target.value as FieldType, ...(e.target.value === 'ref' ? { to: [] } : {}) })}>
                        {[...types, ...(f.type === 'outline' && !types.includes('outline') ? ['outline' as const] : [])].map((t) => <option key={t} value={t}>{t === 'ref' ? ((f.to ?? []).length > 1 ? 'Odwołanie do kilku rodzajów' : 'Odwołanie do dowolnego rodzaju') : FIELD_TYPE_LABEL[t]}</option>)}
                        {types.includes('ref') && (
                          <optgroup label="Odwołanie do rodzaju">
                            {allTargets.map((k) => <option key={k.id} value={`${REF_TO}${k.id}`}>→ {k.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                    </td>
                    <td className="cg-field-flag cg-field-multi" data-label="Kilka"><input type="checkbox" checked={f.multi} disabled={!writes || fixed} onChange={(e) => setField(i, { multi: e.target.checked })} aria-label="Kilka wartości" /></td>
                    {uncertain && <td className="cg-field-flag cg-field-uncertain" data-label="Niepewne"><input type="checkbox" checked={f.uncertain} disabled={!writes || fixed} onChange={(e) => setField(i, { uncertain: e.target.checked })} aria-label="Wartości niepewne" /></td>}
                    <td className="cg-field-more-cell">
                      <button type="button" className="cg-field-toggle" aria-expanded={open} title={f.says} onClick={() => toggle(key)}>
                        <span>{f.says ?? 'ustawienia'}</span>
                      </button>
                    </td>
                    <td className="cg-field-tools">
                      {writes && <button type="button" className="wk-link-btn" aria-label="Wyżej" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>}
                      {writes && <button type="button" className="wk-link-btn" aria-label="Niżej" disabled={i === draft.fields.length - 1} onClick={() => move(i, 1)}>↓</button>}
                      {writes && !fixed && <button type="button" className="wk-link-btn" aria-label="Usuń pole" onClick={() => set({ fields: draft.fields.filter((_, j) => j !== i) })}>×</button>}
                    </td>
                  </tr>
                  {open && (
                    <tr className="cg-field-more">
                      <td colSpan={columns}><FieldMore field={f} targets={allTargets} choices={draft.fields.filter((x) => x.type === 'choice' && x.key !== f.key)} disabled={!writes || fixed} own={!base && options.roles !== false} onSet={(patch) => setField(i, patch)} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {writes && <button type="button" className="wk-link-btn" onClick={() => set({ fields: [...draft.fields, blankField(draft.fields.length + 1)] })}>+ pole</button>}
      {[...problems, ...dupes.map((k) => `Dwa pola o kluczu „${k}".`), ...bad.map((k) => `Klucz „${k}": litery, cyfry i _, zaczyna się literą.`), ...taken.map((k) => `Klucz „${k}" jest zajęty: ${reserved.get(k) ?? 'stałe pole'}.`)].map((p, i) => <p key={i} className="wk-warn">{p}</p>)}
      <p className="wk-hint">Gdy usuniesz pole albo zmienisz jego typ, wartości wpisów zostają jako „poza schematem", dopóki ktoś o nich nie zdecyduje.</p>
      {writes && (
        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy || dupes.length > 0 || bad.length > 0 || taken.length > 0}>{busy ? 'Zapisywanie…' : options.saveLabel ?? 'Zapisz rodzaj'}</button>
          {onRemove !== undefined && <button type="button" className="wk-link-btn" disabled={busy} onClick={onRemove}>Usuń rodzaj…</button>}
        </div>
      )}
    </form>
  );
}

/** 2026-10-23 (Schritt 13) — die Grösse eines Zahlenfeldes, und ob seine Einheit zu ihr passt. */
function QuantityPick({ field, disabled, onSet }: { field: FieldDef; disabled: boolean; onSet: (patch: Partial<FieldDef>) => void }) {
  const unit = findUnit(field.unit);
  const guessed = field.quantity === undefined ? guessKind(field.unit) : undefined;
  const say = field.quantity !== undefined && unit !== undefined && !measures(unit, field.quantity)
    ? `„${unit.symbol}” nie mierzy wielkości: ${kindById(field.quantity)?.label ?? field.quantity}.`
    : field.quantity === undefined && unit !== undefined && unit.kinds.length > 1
      ? `„${unit.symbol}” może znaczyć: ${kindsText(unit.kinds)} — wybierz.`
      : guessed !== undefined ? `Z jednostki: ${kindById(guessed)?.label ?? guessed}.` : null;
  return (
    <label className="wk-field"><span>Wielkość</span>
      <select value={field.quantity ?? ''} disabled={disabled} onChange={(e) => onSet({ quantity: e.target.value || undefined })}>
        {QUANTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {say !== null && <span className="cg-muted">{say}</span>}
    </label>
  );
}

/**
 * 2026-10-27 — „POKAŻ, GDY": ein Feld gehört nur zu einigen Werten eines Wahlfeldes desselben Rodzaj
 * (ein „Rodzaj pytania", ein „Typ") — EIN Schema mit Typen statt eines je Typ. Der Editor eines
 * Eintrags zeigt es nur dann; ein Wert, der schon dasteht, bleibt, wenn der Typ wechselt.
 */
function WhenPick({ field, choices, disabled, onSet }: { field: FieldDef; choices: readonly FieldDef[]; disabled: boolean; onSet: (patch: Partial<FieldDef>) => void }) {
  const by = field.when === undefined ? undefined : choices.find((c) => c.key === field.when!.field);
  return (
    <div className="cg" data-field-when={field.key}>
      <label className="wk-field"><span>Pokaż to pole tylko, gdy</span>
        <select value={field.when?.field ?? ''} disabled={disabled} onChange={(e) => {
          const next = choices.find((c) => c.key === e.target.value);
          onSet({ when: next === undefined ? undefined : { field: next.key, values: (next.options ?? []).slice(0, 1).map((o) => o.value) } });
        }}>
          <option value="">— zawsze —</option>
          {choices.map((c) => <option key={c.key} value={c.key}>„{c.label}” ma wartość…</option>)}
        </select>
      </label>
      {by !== undefined && field.when !== undefined && (
        <fieldset className="cg-row"><legend>…jedną z tych</legend>
          {(by.options ?? []).map((o) => (
            <label key={o.value} className="pe-check">
              <input type="checkbox" checked={field.when!.values.includes(o.value)} disabled={disabled} onChange={(e) => {
                const values = e.target.checked ? [...field.when!.values, o.value] : field.when!.values.filter((v) => v !== o.value);
                onSet({ when: values.length === 0 ? undefined : { field: by.key, values } });
              }} />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

/** Die Einstellungen eines Feldes — unter seiner Zeile, über die ganze Breite. */
function FieldMore({ field, targets, choices, disabled, own, onSet }: { field: FieldDef; targets: readonly KindTarget[]; choices: readonly FieldDef[]; disabled: boolean; own: boolean; onSet: (patch: Partial<FieldDef>) => void }) {
  return (
    <div className="cg-field-settings">
      <label className="wk-field"><span>Co znaczy (dla JSON i AI)</span><input value={field.says ?? ''} disabled={disabled && !own} onChange={(e) => onSet({ says: e.target.value || undefined })} /></label>
      {field.type === 'number' && <label className="wk-field"><span>Jednostka</span><input value={field.unit ?? ''} disabled={disabled} onChange={(e) => onSet({ unit: e.target.value || undefined })} /></label>}
      {/* 2026-10-23 (Schritt 13) — welche Grösse: dann wird in jeder Einheit dieser Grösse eingegeben und dazu in SI gespeichert. */}
      {field.type === 'number' && <QuantityPick field={field} disabled={disabled} onSet={onSet} />}
      {field.type === 'choice' && (
        <label className="wk-field"><span>Do wyboru (wartość=nazwa w wierszu)</span>
          <textarea rows={3} disabled={disabled} value={(field.options ?? []).map((o) => (o.value === o.label ? o.value : `${o.value}=${o.label}`)).join('\n')}
            onChange={(e) => onSet({ options: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [v, ...rest] = l.split('='); return { value: v.trim(), label: (rest.join('=') || v).trim() }; }) })} />
        </label>
      )}
      {field.type === 'ref' && (
        <>
          <fieldset className="cg-row"><legend>Do jakich rodzajów (puste — dowolnych; także z bibliotek, do których ta baza się odwołuje)</legend>
            {targets.map((k) => (
              <label key={k.id} className="pe-check">
                <input type="checkbox" checked={(field.to ?? []).includes(k.id)} disabled={disabled} onChange={(e) => onSet({ to: e.target.checked ? [...(field.to ?? []), k.id] : (field.to ?? []).filter((t) => t !== k.id) })} />
                <span>{k.name}</span>
              </label>
            ))}
          </fieldset>
          <label className="wk-field"><span>Nazwa po drugiej stronie</span><input value={field.inverse ?? ''} disabled={disabled} placeholder="np. napisane przez" onChange={(e) => onSet({ inverse: e.target.value || undefined })} /></label>
          <label className="pe-check"><input type="checkbox" checked={field.symmetric === true} disabled={disabled} onChange={(e) => onSet({ symmetric: e.target.checked || undefined })} /><span>w obie strony (zapisane raz)</span></label>
          {/* 2026-10-22 (Schritt 11) — ein Verweis mit Stelle: Psalm = Biblia + „Ps 110". */}
          <label className="pe-check"><input type="checkbox" checked={field.locator === true} disabled={disabled} onChange={(e) => onSet({ locator: e.target.checked || undefined })} /><span>z miejscem (rozdział, werset, strona)</span></label>
          {/* 2026-10-25 (Wywód) — ein Strukturfeld: die Struktura folgt ihm in die Tiefe; für Informacja / Interpretacja zählt es nicht. */}
          <label className="wk-field"><span>Połączenie w strukturze</span>
            <select value={field.structure ?? ''} disabled={disabled} onChange={(e) => onSet({ structure: e.target.value === 'up' || e.target.value === 'down' ? e.target.value : undefined })}>
              <option value="">— zwykłe odwołanie —</option>
              <option value="up">↑ wskazuje wpis wyżej (ten wpis leży pod nim)</option>
              <option value="down">↓ wskazuje wpisy niżej (leżą pod tym wpisem)</option>
            </select>
          </label>
          {/* 2026-10-27 — die Reihenfolge des Lernens (`prerequisites.ts`): was zuerst sitzen muss. Etwas anderes als die Struktur. */}
          <label className="wk-field"><span>Kolejność nauki</span>
            <select value={field.prerequisite ?? ''} disabled={disabled} onChange={(e) => onSet({ prerequisite: e.target.value === 'up' || e.target.value === 'down' ? e.target.value : undefined })}>
              <option value="">— nie zmienia kolejności —</option>
              <option value="up">↑ najpierw trzeba znać to, na co wskazuje (np. „Wymaga”)</option>
              <option value="down">↓ to, na co wskazuje, buduje na tym wpisie (np. „Prowadzi do”)</option>
            </select>
          </label>
        </>
      )}
      {choices.length > 0 && <WhenPick field={field} choices={choices} disabled={disabled} onSet={onSet} />}
      {field.type === 'media' && (
        <fieldset className="cg-row"><legend>Jakie pliki</legend>
          {MEDIA_TYPES.map((m) => (
            <label key={m} className="pe-check">
              <input type="checkbox" checked={(field.media ?? MEDIA_TYPES).includes(m)} disabled={disabled} onChange={(e) => {
                const now = new Set(field.media ?? MEDIA_TYPES);
                if (e.target.checked) now.add(m); else now.delete(m);
                onSet({ media: [...now] });
              }} />
              <span>{{ image: 'obraz', audio: 'dźwięk', video: 'film', document: 'dokument' }[m]}</span>
            </label>
          ))}
        </fieldset>
      )}
      {field.type === 'range' && (
        <label className="wk-field"><span>Zakres czego</span>
          <select value={field.rangeOf ?? 'number'} disabled={disabled} onChange={(e) => onSet({ rangeOf: e.target.value as FieldDef['rangeOf'] })}>
            {RANGE_OF.map((r) => <option key={r} value={r}>{{ number: 'liczb', date: 'dat', text: 'tekstów' }[r]}</option>)}
          </select>
        </label>
      )}
      {own && (
        <label className="wk-field"><span>Rola (dla wbudowanych narzędzi)</span>
          <select value={field.role ?? ''} disabled={disabled} onChange={(e) => onSet({ role: e.target.value || undefined })}>
            <option value="">—</option>
            {FIELD_ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
