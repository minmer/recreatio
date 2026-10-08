/**
 * 0083 — DO PODPISU: das Ausgefüllte als Blatt, das man ausdruckt und mit der
 * Hand unterschreibt.
 *
 * <b>Warum Papier.</b> Ein Häkchen auf einer Webseite ist keine Unterschrift
 * eines Elternteils: niemand kann zeigen, wer an der Tastatur sass — keine
 * Schule, keine Pfarrei, kein Versicherer nimmt es als solche. Für einen
 * Minderjährigen unterschreibt der gesetzliche Vertreter (k.c. Art. 17), und
 * das auf Papier. Das Formular sagt am Formular, WANN (`after.paper`: immer,
 * oder wenn eine bestimmte Zustimmung angekreuzt ist — etwa die der Eltern,
 * die nur Minderjährige sehen).
 *
 * <b>Gedruckt wird, was gespeichert ist</b> — die Antworten, die eben
 * hinausgingen, die aus dem eigenen Link, die der Kanzlei. Ein Blatt, das vom
 * gespeicherten Stand abwiche, wäre schlimmer als keines. Die Zustimmungen
 * stehen mit IHREM Wortlaut darauf (dem in der Antwort), nicht mit dem, den die
 * Frage heute hat.
 *
 * <b>Ein Blatt A4.</b> Daten in zwei Spalten, die Erklärungen je eine Zeile,
 * die Hinweise klein am Ende — wer zehn Kinder anmeldet, druckt keine dreissig
 * Seiten.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { areaReader, type AccountWay } from './areaRead';
import {
  consentGiven, consentText, isYes, loadForm, openFields, type AfterSend, type OpenField, type PublicForm
} from './form';
import { EMPTY_DESIGN, evaluate, layoutWith, openDesign, type FormDesign, type LayoutItem } from './formDesign';

/* -- Ein öffentliches Formular, aufgemacht ------------------------------------------ */

export interface OpenForm {
  readonly form: PublicForm;
  readonly fields: readonly OpenField[];
  readonly design: FormDesign | null;
  /** Wie das Konto beim Aufmachen mitwirkte (für die Erklärung, warum etwas zu bleibt). */
  readonly account: AccountWay | null;
}

/**
 * Das Formular, wie es draussen steht — die Fragen aufgemacht auf jedem Weg,
 * den dieser Browser hat (`areaReader`: offengelegt, aus einem Link, aus der
 * eigenen Zuteilung). Dieselbe Stelle für das Formular selbst (`FormCard`) und
 * für den Ausdruck.
 */
export async function openPublicForm(partId: string): Promise<OpenForm> {
  const form = await loadForm(partId);
  const reader = areaReader();
  const keys = new Map<string, Uint8Array>();

  for (const f of form.fields) {
    const areaId = f.labelAreaId ?? f.areaId;
    if (keys.has(areaId)) continue;
    const key = await reader.key(areaId, f.labelEpoch ?? f.epoch);
    if (key !== undefined) keys.set(areaId, key);
  }

  const fields = await openFields(form.fields, keys);
  const design = await openDesign(
    form.design ?? null,
    form.design == null ? undefined : await reader.key(form.design.areaId, form.design.epoch),
    partId);

  return { form, fields, design, account: reader.account() };
}

/** Kurz behalten — ein Portal mit drei Einsendungen fragt nicht dreimal. */
const opened = new Map<string, { at: number; form: Promise<OpenForm> }>();

export function openPublicFormKept(partId: string): Promise<OpenForm> {
  const was = opened.get(partId);
  if (was !== undefined && Date.now() - was.at < 120_000) return was.form;
  const form = openPublicForm(partId);
  opened.set(partId, { at: Date.now(), form });
  form.catch(() => { if (opened.get(partId)?.form === form) opened.delete(partId); });
  return form;
}

/* -- Wann auf Papier ----------------------------------------------------------------- */

/**
 * Muss DIESES Ausgefüllte auf Papier unterschrieben werden? `always` — immer;
 * die Kennung einer Frage — wenn sie angekreuzt ist (eine Zustimmung, ein
 * „Tak / nie"); sonst nicht.
 */
export function paperNeeded(after: AfterSend | null | undefined, valueOf: (fieldId: string) => string | undefined): boolean {
  const rule = after?.paper?.trim() ?? '';
  if (rule === '') return false;
  if (rule === 'always') return true;
  const value = valueOf(rule);
  return consentGiven(value) || isYes(value);
}

/* -- Das Blatt ------------------------------------------------------------------------ */

const plDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m === null ? iso : `${m[3]}.${m[2]}.${m[1]}`;
};

const plMoment = (iso: string | null): string => {
  if (iso === null) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
};

interface Row { readonly label: string; readonly value: string }
interface Block { readonly title: string; readonly rows: Row[] }
interface Statement { readonly label: string; readonly given: boolean; readonly text: string }

/** Was auf dem Blatt steht — in der Reihenfolge des Formulars, nur was sichtbar war. */
export function sheetOf(open: OpenForm, values: ReadonlyMap<string, string>): {
  blocks: Block[]; statements: Statement[]; notes: string[];
} {
  const byId = new Map(open.fields.map((f) => [f.fieldId, f]));
  const sorted = [...open.fields].sort((a, b) => a.position - b.position);
  const layout = layoutWith(open.design?.layout ?? [], sorted.map((f) => f.fieldId));
  const answers: Record<string, string> = Object.fromEntries(values);
  const outcome = evaluate({ ...(open.design ?? EMPTY_DESIGN), layout }, answers);

  const blocks: Block[] = [{ title: '', rows: [] }];
  const statements: Statement[] = [];
  const notes: string[] = [];

  const walk = (items: readonly LayoutItem[], block: Block) => {
    for (const item of items) {
      if (outcome.hidden.has(item.id)) continue;
      if (item.type === 'text') { if (item.text.trim() !== '') notes.push(item.text.trim()); continue; }
      if (item.type === 'group') {
        const inner: Block = { title: item.title.trim(), rows: [] };
        blocks.push(inner);
        walk(item.items, inner);
        continue;
      }
      const f = byId.get(item.id);
      if (f === undefined) continue;
      const value = values.get(f.fieldId) ?? '';
      const label = outcome.labels.get(f.fieldId) ?? f.label ?? 'pytanie';

      if (f.kind === 'consent') {
        const given = consentGiven(value);
        statements.push({ label, given, text: given ? consentText(value) || (f.help ?? label) : (f.help ?? label) });
        continue;
      }
      if (value.trim() === '') continue;
      block.rows.push({
        label,
        value: f.kind === 'checkbox' ? (isYes(value) ? 'TAK' : value)
          : f.kind === 'date' || f.identityRole === 'born' ? plDate(value)
          : value
      });
    }
  };
  walk(layout, blocks[0]);

  return { blocks: blocks.filter((b) => b.rows.length > 0), statements, notes };
}

function Sheet({ open, values, submittedAt }: { open: OpenForm; values: ReadonlyMap<string, string>; submittedAt: string | null }) {
  const { blocks, statements, notes } = useMemo(() => sheetOf(open, values), [open, values]);
  const c = open.form.controller;

  return (
    <div className="wk-print-sheet">
      <header>
        <h1>{open.form.title ?? 'Formularz'}</h1>
        {c !== null && (
          <p className="wk-print-org">
            Administrator danych: {c.name}{c.address !== null ? `, ${c.address}` : ''}{c.email !== null ? ` (${c.email})` : ''}
          </p>
        )}
      </header>

      <div className="wk-print-body">
        {blocks.map((b, i) => (
          <section key={i}>
            {b.title !== '' && <h2>{b.title}</h2>}
            <dl>
              {b.rows.map((r, j) => (
                <div key={j}><dt>{r.label}</dt><dd>{r.value}</dd></div>
              ))}
            </dl>
          </section>
        ))}

        {statements.length > 0 && (
          <section>
            <h2>Oświadczenia i zgody</h2>
            <ul>
              {statements.map((s, i) => (
                <li key={i}><b>{s.given ? 'TAK' : 'NIE'}</b> <strong>{s.label}:</strong> {s.text}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {notes.length > 0 && (
        <section className="wk-print-notes">
          {notes.map((n, i) => <p key={i}>{n}</p>)}
        </section>
      )}

      <footer>
        <p className="wk-print-trace">
          Wypełniono elektronicznie{submittedAt !== null ? ` ${plMoment(submittedAt)}` : ''}. Podpis odręczny poniżej jest
          wymagany — podpisany wydruk oddaje się organizatorowi.
        </p>
        <div className="wk-print-sign">
          <span>miejscowość i data</span>
          <span>{open.form.after?.signer ?? 'czytelny podpis'}</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * „DRUKUJ DO PODPISU" — der Knopf und das Blatt dahinter.
 *
 * @param when `needed`: nur, wenn das Formular für DIESE Antworten Papier
 *   verlangt (der Mensch); `ruled`: wenn das Formular überhaupt eine Regel für
 *   Papier hat (die Kanzlei druckt auch für den, der sein Blatt vergessen hat).
 */
export function SignSheetButton({ formId, values, submittedAt, when = 'needed', className = 'wk-btn' }: {
  formId: string;
  values: ReadonlyMap<string, string>;
  submittedAt: string | null;
  when?: 'needed' | 'ruled';
  className?: string;
}) {
  const [open, setOpen] = useState<OpenForm | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let alive = true;
    openPublicFormKept(formId).then((one) => { if (alive) setOpen(one); }).catch(() => undefined);
    return () => { alive = false; };
  }, [formId]);

  useEffect(() => {
    if (!printing) return undefined;
    document.body.classList.add('wk-printing');
    const done = () => { document.body.classList.remove('wk-printing'); setPrinting(false); };
    window.addEventListener('afterprint', done, { once: true });
    /* Erst zeichnen lassen, dann drucken. */
    const timer = window.setTimeout(() => { window.print(); }, 50);
    return () => { window.clearTimeout(timer); window.removeEventListener('afterprint', done); document.body.classList.remove('wk-printing'); };
  }, [printing]);

  if (open === null) return null;
  const after = open.form.after ?? null;
  const show = when === 'ruled' ? (after?.paper ?? '') !== '' : paperNeeded(after, (id) => values.get(id));
  if (!show) return null;

  return (
    <>
      <button type="button" className={className} onClick={() => setPrinting(true)}>Drukuj do podpisu</button>
      {printing && createPortal(<Sheet open={open} values={values} submittedAt={submittedAt} />, document.body)}
    </>
  );
}
