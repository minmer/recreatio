/**
 * Ein Formular, wie es der Mensch sieht — mit seinem Aufbau und seiner Logik
 * (0043).
 *
 * <b>Rein zeichnend.</b> Was gezeigt wird, entscheidet `evaluate` in
 * `formDesign.ts`; hier wird nur gezeichnet, was dabei herauskam. So lässt
 * sich dieselbe Auswertung im Editor als Vorschau benutzen, ohne dass sie
 * zweimal geschrieben steht.
 *
 * <b>Seiten und Reiter entstehen aus Nachbarn.</b> Stehen mehrere Gruppen der
 * Art „page" hintereinander, sind sie ein Blätterwerk: eine nach der anderen,
 * und die nächste geht erst auf, wenn die sichtbaren Pflichtfragen der
 * vorigen beantwortet sind. Stehen mehrere „tab" hintereinander, sind sie
 * Reiter: alle zugleich erreichbar. Eine „group" ist eine Überschrift über
 * ihren Fragen. Alle drei liegen ineinander, so tief man will.
 */

import { useState } from 'react';

import { consentGiven, consentValue, isYes, YES, type OpenField } from './form';
import { missingIn, type GroupItem, type LayoutItem, type Outcome } from './formDesign';
import { peselDigits, peselValid } from './pesel';
import { Phones } from './Phones';
import { PostalInput } from './PostalInput';

export interface FlowProps {
  readonly items: readonly LayoutItem[];
  readonly fields: ReadonlyMap<string, OpenField>;
  readonly answers: Readonly<Record<string, string>>;
  readonly outcome: Outcome;
  readonly onAnswer: (fieldId: string, value: string) => void;
}

/** Ist diese Frage gerade Pflicht — von sich aus oder durch die Logik? */
export const isRequired = (fields: ReadonlyMap<string, OpenField>, outcome: Outcome) =>
  (fieldId: string): boolean => fields.get(fieldId)?.isRequired === true || outcome.required.has(fieldId);

export function FormFlow(props: FlowProps) {
  return <Items {...props} />;
}

/** Eine Liste — und darin die Läufe von Seiten und Reitern zusammengefasst. */
function Items(props: FlowProps) {
  const { items, outcome } = props;
  const visible = items.filter((item) => !outcome.hidden.has(item.id));

  const runs: (LayoutItem | { run: 'page' | 'tab'; groups: GroupItem[] })[] = [];
  for (const item of visible) {
    const last = runs[runs.length - 1];
    if (item.type === 'group' && (item.kind === 'page' || item.kind === 'tab')) {
      if (last !== undefined && 'run' in last && last.run === item.kind) last.groups.push(item);
      else runs.push({ run: item.kind, groups: [item] });
    } else {
      runs.push(item);
    }
  }

  return (
    <>
      {runs.map((one) => {
        if ('run' in one) {
          return one.run === 'page'
            ? <Pager key={`pages-${one.groups[0].id}`} {...props} pages={one.groups} />
            : <Tabs key={`tabs-${one.groups[0].id}`} {...props} tabs={one.groups} />;
        }

        if (one.type === 'field') return <FieldRow key={one.id} {...props} fieldId={one.id} />;

        if (one.type === 'text') {
          return one.text.trim() === '' ? null : (
            <p className="wk-form-text" key={one.id}>{one.text}</p>
          );
        }

        return (
          <fieldset className="wk-form-group" key={one.id}>
            {one.title.trim() !== '' && <legend>{one.title}</legend>}
            <Items {...props} items={one.items} />
          </fieldset>
        );
      })}
    </>
  );
}

/**
 * SEITEN: eine nach der anderen.
 *
 * <b>Zurück geht immer, vor nur mit erfüllter Seite.</b> „Erfüllt" heisst: jede
 * SICHTBARE Pflichtfrage darin hat eine Antwort — auch die, die erst die Logik
 * zur Pflicht gemacht hat. Was die Logik verborgen hat, hält niemanden auf.
 */
function Pager(props: FlowProps & { pages: readonly GroupItem[] }) {
  const { pages, fields, answers, outcome } = props;
  const [at, setAt] = useState(0);

  const need = isRequired(fields, outcome);
  const open = pages.map((page) => missingIn(page.items, need, answers, outcome));
  const now = Math.min(at, pages.length - 1);
  const page = pages[now];

  /* Eine Seite ist erreichbar, wenn alle davor erfüllt sind. */
  const reachable = (i: number) => open.slice(0, i).every((m) => m.length === 0);

  return (
    <section className="wk-form-pages">
      <ol className="wk-form-steps">
        {pages.map((one, i) => (
          <li key={one.id}>
            <button
              type="button"
              className={i === now ? 'wk-form-step wk-form-step-on' : 'wk-form-step'}
              aria-current={i === now ? 'step' : undefined}
              disabled={i !== now && !reachable(i)}
              onClick={() => setAt(i)}
            >
              {one.title.trim() === '' ? `Strona ${i + 1}` : one.title}
            </button>
          </li>
        ))}
      </ol>

      <Items {...props} items={page.items} />

      <div className="wk-actions">
        {now > 0 && (
          <button type="button" className="wk-link-btn" onClick={() => setAt(now - 1)}>Wstecz</button>
        )}
        {now < pages.length - 1 && (
          <button
            type="button" className="wk-btn"
            disabled={open[now].length > 0}
            onClick={() => setAt(now + 1)}
          >
            Dalej
          </button>
        )}
        {open[now].length > 0 && now < pages.length - 1 && (
          <span className="wk-blocker">
            Najpierw: {open[now].map((id) => outcome.labels.get(id) ?? fields.get(id)?.label ?? 'pole').join(', ')}
          </span>
        )}
      </div>
    </section>
  );
}

/** REITER: alle zugleich — wer will, springt; ein Punkt zeigt, wo noch etwas fehlt. */
function Tabs(props: FlowProps & { tabs: readonly GroupItem[] }) {
  const { tabs, fields, answers, outcome } = props;
  const [at, setAt] = useState(0);
  const now = Math.min(at, tabs.length - 1);
  const need = isRequired(fields, outcome);

  return (
    <section className="wk-form-tabs">
      <div className="wk-tabs" role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={i === now}
            className={i === now ? 'wk-tab wk-tab-on' : 'wk-tab'}
            onClick={() => setAt(i)}
          >
            {tab.title.trim() === '' ? `Zakładka ${i + 1}` : tab.title}
            {missingIn(tab.items, need, answers, outcome).length > 0 && <span className="wk-form-dot" aria-label="brakuje odpowiedzi"> •</span>}
          </button>
        ))}
      </div>

      <Items {...props} items={tabs[now].items} />
    </section>
  );
}

/** Eine Frage — mit dem Namen, den die Logik ihr gibt, und den Hinweisen darunter. */
function FieldRow({ fieldId, fields, answers, outcome, onAnswer }: FlowProps & { fieldId: string }) {
  const f = fields.get(fieldId);
  if (f === undefined) return null;

  const value = answers[fieldId] ?? '';
  const label = outcome.labels.get(fieldId) ?? f.label ?? 'zapieczętowane';
  const required = f.isRequired || outcome.required.has(fieldId);
  const set = (next: string) => onAnswer(fieldId, next);

  /*
   * 0071 — EINE ADRESSE in Teilen, mit Vorschlägen. Gespeichert wird die
   * Zeile wie bisher; die Teile machen sie vergleichbar (Kolęda, Verzeichnis).
   */
  if (f.identityRole === 'address' && f.label !== null && f.kind !== 'text' && f.kind !== 'choice') {
    return (
      <div className={f.isHalfWidth ? 'wk-field wk-field-half' : 'wk-field'}>
        <span>{label}{required && ' *'}</span>
        <PostalInput value={value} onChange={set} />
        {f.help !== null && <span className="wk-hint">{f.help}</span>}
        {(outcome.messages.get(fieldId) ?? []).map((text, i) => <span className="wk-form-msg" key={i}>{text}</span>)}
      </div>
    );
  }

  /*
   * 0083 — EINE ZUSTIMMUNG: das Kästchen, der Name fett, darunter der GANZE
   * Wortlaut (die Podpowiedź der Frage) — gelesen wird, bevor angekreuzt wird.
   * Angekreuzt trägt die Antwort genau diesen Wortlaut (`consentValue`): ändert
   * die Kanzlei später den Text, bleibt nachweisbar, wozu DIESER Mensch ja sagte.
   * „Wymagane" heisst: ohne sie geht das Formular nicht ab.
   */
  if (f.kind === 'consent' && f.label !== null) {
    const statement = f.help ?? f.label;
    return (
      <div className={f.isHalfWidth ? 'wk-field wk-field-half wk-consent' : 'wk-field wk-consent'}>
        <label className="wk-check wk-consent-row">
          <input type="checkbox" checked={consentGiven(value)} onChange={(e) => set(e.target.checked ? consentValue(statement) : '')} />
          <span>
            <strong>{label}{required && ' *'}</strong>
            {f.help !== null && <span className="wk-consent-text">{f.help}</span>}
          </span>
        </label>
        {(outcome.messages.get(fieldId) ?? []).map((text, i) => <span className="wk-form-msg" key={i}>{text}</span>)}
      </div>
    );
  }

  /*
   * 0077 — „TAK / NIE" IST EIN KÄSTCHEN. Bis hierher war diese Frage ein
   * Textfeld: man tippte „tak" — oder „Tak", „x", „jest". Angekreuzt trägt sie
   * `YES`, sonst nichts; was früher getippt wurde, liest `isYes` duldsam.
   * „Wymagane" heisst hier: muss angekreuzt sein (eine Zustimmung).
   */
  if (f.kind === 'checkbox' && f.label !== null) {
    return (
      <div className={f.isHalfWidth ? 'wk-field wk-field-half' : 'wk-field'}>
        <label className="wk-check">
          <input type="checkbox" checked={isYes(value)} onChange={(e) => set(e.target.checked ? YES : '')} />
          <span>{label}{required && ' *'}</span>
        </label>
        {f.help !== null && <span className="wk-hint">{f.help}</span>}
        {(outcome.messages.get(fieldId) ?? []).map((text, i) => <span className="wk-form-msg" key={i}>{text}</span>)}
      </div>
    );
  }

  return (
    <label className={f.isHalfWidth ? 'wk-field wk-field-half' : 'wk-field'}>
      <span>{label}{required && ' *'}</span>

      {f.label === null ? (
        <p className="wk-card-muted">Tego pytania nie da się odczytać.</p>
      ) : f.kind === 'text' ? (
        <textarea rows={4} value={value} onChange={(e) => set(e.target.value)} />
      ) : f.kind === 'choice' ? (
        <select value={value} onChange={(e) => set(e.target.value)}>
          <option value="">—</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.kind === 'pesel' ? (
        /*
         * 0083 — ELF ZIFFERN, mit Prüfziffer. Gesagt wird es, sobald elf
         * dastehen (oder mehr) — nicht beim Tippen der dritten.
         */
        <>
          <input
            inputMode="numeric" autoComplete="off" maxLength={13} value={value}
            onChange={(e) => set(peselDigits(e.target.value))}
          />
          {value.length >= 11 && !peselValid(value) && (
            <span className="wk-form-msg">To nie jest poprawny PESEL — sprawdź cyfry.</span>
          )}
        </>
      ) : f.kind === 'phone' ? (
        /*
         * Eine Nummer wird zum Plättchen, sobald sie fertig ist — und das `+48`
         * schreibt die Maschine. Mehrere Nummern in einem Feld sind der
         * Normalfall, nicht die Ausnahme: Mutter, Vater, Kind.
         */
        <Phones value={value} onChange={set} />
      ) : (
        <input
          type={f.kind === 'date' ? 'date' : f.kind === 'number' ? 'number' : f.kind === 'email' ? 'email' : 'text'}
          value={value}
          onChange={(e) => set(e.target.value)}
        />
      )}

      {f.help !== null && <span className="wk-hint">{f.help}</span>}

      {(outcome.messages.get(fieldId) ?? []).map((text, i) => (
        <span className="wk-form-msg" key={i}>{text}</span>
      ))}
    </label>
  );
}

export default FormFlow;
