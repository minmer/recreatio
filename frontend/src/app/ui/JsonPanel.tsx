/**
 * 0064 — EIN JSON-FACH: Export, Import und daneben die Beschreibung.
 *
 * Dieselbe Gestalt überall — an der Seite, an einem Baustein im Editor, an
 * einem Modul im Bausteinverwalter. Wer eines kennt, kennt alle.
 *
 * <b>Die Beschreibung steht NEBEN dem Import</b>, nicht hinter einem Link: wer
 * ein Dokument einfügt, sieht im selben Blick, wie es aussehen muss und was der
 * Import damit tut. Sie wird aus den Bausteinen erzeugt (`pageJson.ts`) und
 * lässt sich für ein Sprachmodell kopieren.
 *
 * <b>Erst der Plan, dann der Knopf.</b> Was eingefügt ist, wird sofort gelesen
 * und als Liste der Änderungen gezeigt — mit Warnungen. Ausgeführt wird erst
 * auf „Importuj".
 *
 * <b>2026-10-24 — ein Format als Baum</b> (`format`, `core/jsonTree.ts`): über
 * der Beschreibung steht, welche Formate darin stecken (ein Klick springt zum
 * Abschnitt), und ganze Beispiele lassen sich in den Import einsetzen.
 */

import { Fragment, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { parseDocument } from '../pages/pageJson';
import { WorkspaceError } from '../core/session';
import { samplesOf, sectionsOf, sectionText, type JsonNode, type JsonSection } from '../core/jsonTree';
import { plural } from '../core/plural';

export interface JsonPreview {
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * 2026-10-24 — WAS IN DIESEM FORMAT STECKT, als Baum (`core/jsonTree.ts`):
 * ein Klick springt zu seinem Abschnitt der Beschreibung. Blätter einer Ebene
 * stehen nebeneinander, damit vierzig Bausteinarten keine vierzig Zeilen sind.
 */
function FormatTree({ sections, onJump }: { sections: readonly JsonSection[]; onJump: (key: string) => void }) {
  const below = new Map<string | null, JsonSection[]>();
  for (const s of sections) below.set(s.parent, [...(below.get(s.parent) ?? []), s]);
  const jump = (s: JsonSection) => (
    <button type="button" className="wk-link-btn" onClick={() => onJump(s.node.key)}>{s.node.short ?? s.node.title}</button>
  );
  const leaves = (row: readonly JsonSection[]) => row.map((s, i) => <Fragment key={s.node.key}>{i > 0 && <span aria-hidden="true"> · </span>}{jump(s)}</Fragment>);
  const level = (parent: string | null): ReactNode => {
    const list = below.get(parent) ?? [];
    const rows: (JsonSection | JsonSection[])[] = [];
    for (const s of list) {
      const leaf = (below.get(s.node.key) ?? []).length === 0;
      const last = rows[rows.length - 1];
      if (leaf && Array.isArray(last)) last.push(s);
      else rows.push(leaf ? [s] : s);
    }
    return (
      <ul className="wk-json-tree-list">
        {rows.map((row) => Array.isArray(row) ? (
          <li key={row[0].node.key} className="wk-json-tree-leaves">
            {/* Viele auf einer Ebene (die Arten der Module): zugeklappt, damit der Baum ein Baum bleibt. */}
            {row.length > 12 ? (
              <details className="wk-json-tree-more">
                <summary>{row.length} {plural(row.length, 'pozycja', 'pozycje', 'pozycji')}</summary>
                {leaves(row)}
              </details>
            ) : leaves(row)}
          </li>
        ) : (
          <li key={row.node.key}>{jump(row)}{level(row.node.key)}</li>
        ))}
      </ul>
    );
  };
  return (
    <nav className="wk-json-tree" aria-label="Co zawiera ten format">
      {level(null)}
    </nav>
  );
}

export function JsonPanel({
  summary, lead, fileName, exportDoc, description, format, preview, options, importLabel, onImport, note, busy = false, open = false
}: {
  /** Die Überschrift des Fachs. */
  summary: string;
  /** Ein Satz: was hier exportiert und importiert wird. */
  lead: ReactNode;
  fileName: string;
  exportDoc: () => Promise<unknown> | unknown;
  /** Die Beschreibung als Text — oder, statt dessen, das Format als Baum (`format`). */
  description?: () => string;
  /** 2026-10-24 — das Format als Knoten des Baums: Beschreibung, was darin steckt, ganze Beispiele zum Einsetzen. */
  format?: JsonNode;
  /** Was ein Dokument ändern würde — oder warum es nicht geht. */
  preview: (doc: unknown) => JsonPreview | { error: string };
  /** Einstellungen des Imports, je nach Dokument. */
  options?: (doc: unknown) => ReactNode;
  importLabel: string;
  onImport: (doc: unknown, stage: (what: string) => void) => Promise<JsonPreview>;
  /** Ein Hinweis direkt über dem Knopf — etwa, dass ungespeicherte Änderungen mitgehen. */
  note?: ReactNode;
  busy?: boolean;
  /** Gleich offen — etwa in einem Dialog, der nur dafür da ist. */
  open?: boolean;
}) {
  const [exported, setExported] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [text, setText] = useState('');
  const [stage, setStage] = useState<string | null>(null);
  const [done, setDone] = useState<JsonPreview | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [copied, setCopied] = useState<'export' | 'doc' | null>(null);
  const [showDoc, setShowDoc] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  const docBox = useRef<HTMLDivElement>(null);
  const anchor = useId();

  const parsed = useMemo(() => parseDocument(text), [text]);
  const plan = parsed !== null && 'value' in parsed ? preview(parsed.value) : null;
  /* Der Baum einmal gelesen — nicht bei jedem Tastendruck im Import. Der Text zum Kopieren ist derselbe (`describe`). */
  const sections = useMemo(() => (format === undefined ? [] : sectionsOf(format)), [format]);
  const texts = useMemo(() => sections.map(sectionText), [sections]);
  const doc = useMemo(() => (format !== undefined ? `${texts.join('\n\n')}\n` : description?.() ?? ''), [format, texts, description]);
  const samples = useMemo(() => (format === undefined ? [] : samplesOf(format)), [format]);
  const sectionId = (key: string) => `${anchor}-${key.replace(/[^a-z0-9_-]/gi, '_')}`;

  /* Zum Abschnitt springen — im Kasten der Beschreibung, nicht im ganzen Fenster. */
  const jumpTo = (key: string) => {
    const box = docBox.current;
    const at = box?.querySelector<HTMLElement>(`[id="${sectionId(key)}"]`);
    if (box === null || box === undefined || at === null || at === undefined) return;
    box.scrollTo({ top: box.scrollTop + at.getBoundingClientRect().top - box.getBoundingClientRect().top, behavior: 'smooth' });
  };

  const copy = (what: 'export' | 'doc', value: string) => {
    void navigator.clipboard.writeText(value).then(() => setCopied(what), () => setCopied(null));
  };

  const makeExport = async () => {
    setExporting(true);
    setFailed(null);
    try {
      const value = await exportDoc();
      setExported(JSON.stringify(value, null, 2));
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przygotować eksportu.');
    } finally {
      setExporting(false);
    }
  };

  const download = () => {
    if (exported === null) return;
    const url = URL.createObjectURL(new Blob([exported], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const run = async () => {
    if (parsed === null || !('value' in parsed)) return;
    setFailed(null);
    setDone(null);
    setStage('Importowanie…');
    try {
      const result = await onImport(parsed.value, setStage);
      setDone(result);
      setText('');
      setExported(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : e instanceof Error ? e.message : 'Import się nie udał.');
    } finally {
      setStage(null);
    }
  };

  const working = busy || stage !== null;

  return (
    <details className="wk-fold wk-json" open={open || undefined}>
      <summary>{summary}</summary>
      <div className="wk-json-body">
        <p className="wk-hint">{lead}</p>

        <div className={`wk-json-grid${showDoc ? '' : ' is-narrow'}`}>
          <div className="wk-json-io">
            <section className="wk-json-part" aria-label="Eksport">
              <h4 className="wk-json-h">Eksport</h4>
              <div className="wk-actions">
                <button type="button" className="wk-btn wk-btn-line" disabled={exporting || working} onClick={() => void makeExport()}>
                  {exporting ? 'Przygotowywanie…' : exported === null ? 'Pokaż JSON' : 'Odśwież'}
                </button>
                {exported !== null && (
                  <>
                    <button type="button" className="wk-link-btn" onClick={() => copy('export', exported)}>{copied === 'export' ? 'Skopiowano' : 'Kopiuj'}</button>
                    <button type="button" className="wk-link-btn" onClick={download}>Pobierz plik .json</button>
                    <button type="button" className="wk-link-btn" onClick={() => { setText(exported); setDone(null); }}>Edytuj w imporcie</button>
                  </>
                )}
              </div>
              {exported !== null && (
                <textarea className="wk-json-text" readOnly rows={10} value={exported} spellCheck={false} aria-label="Eksport JSON" />
              )}
            </section>

            <section className="wk-json-part" aria-label="Import">
              <h4 className="wk-json-h">Import</h4>
              <textarea
                className="wk-json-text" rows={10} spellCheck={false} value={text} disabled={working}
                placeholder="Wklej JSON — z eksportu albo napisany według opisu formatu."
                aria-label="Import JSON"
                onChange={(e) => { setText(e.target.value); setDone(null); setFailed(null); }}
              />
              {/* 2026-10-24 — ganze Dokumente zum Einsetzen: was das Format kann, an einem Beispiel, das sich importieren lässt. */}
              {samples.length > 0 && (
                <div className="wk-json-samples">
                  <span className="wk-json-h">Wstaw przykład</span>
                  <ul>
                    {samples.map((one) => (
                      <li key={one.label}>
                        <button type="button" className="wk-link-btn" disabled={working}
                          onClick={() => { setText(JSON.stringify(one.doc(), null, 2)); setDone(null); setFailed(null); }}>
                          {one.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="wk-actions">
                <button type="button" className="wk-link-btn" disabled={working} onClick={() => file.current?.click()}>Wczytaj plik…</button>
                {text !== '' && <button type="button" className="wk-link-btn" disabled={working} onClick={() => setText('')}>Wyczyść</button>}
                <input
                  ref={file} type="file" accept=".json,application/json" hidden
                  onChange={(e) => {
                    const one = e.target.files?.[0];
                    e.target.value = '';
                    if (one !== undefined) void one.text().then((value) => { setText(value); setDone(null); });
                  }}
                />
              </div>

              {parsed !== null && 'error' in parsed && <p className="wk-error">Nieprawidłowy JSON: {parsed.error}</p>}
              {plan !== null && 'error' in plan && <p className="wk-error">{plan.error}</p>}

              {plan !== null && !('error' in plan) && parsed !== null && 'value' in parsed && (
                <div className="wk-json-plan" role="status">
                  <p className="wk-json-h">Co się zmieni</p>
                  <ul>{plan.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
                  {plan.warnings.length > 0 && (
                    <ul className="wk-json-warn">{plan.warnings.map((line, i) => <li key={i}>{line}</li>)}</ul>
                  )}
                  {options?.(parsed.value)}
                  {note !== undefined && note !== null && <p className="wk-hint">{note}</p>}
                  <div className="wk-actions">
                    <button type="button" className="wk-btn" disabled={working} onClick={() => void run()}>
                      {stage ?? importLabel}
                    </button>
                  </div>
                </div>
              )}

              {failed !== null && <p className="wk-error">{failed}</p>}
              {done !== null && (
                <div role="status" className="wk-json-plan">
                  <p className="wk-done">Zaimportowano.</p>
                  <ul>{done.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
                  {done.warnings.length > 0 && <ul className="wk-json-warn">{done.warnings.map((line, i) => <li key={i}>{line}</li>)}</ul>}
                </div>
              )}
            </section>
          </div>

          <aside className="wk-json-doc" aria-label="Opis formatu">
            <div className="wk-json-doc-head">
              <h4 className="wk-json-h">Opis formatu</h4>
              <button type="button" className="wk-link-btn" onClick={() => copy('doc', doc)}>{copied === 'doc' ? 'Skopiowano opis' : 'Kopiuj opis (dla AI)'}</button>
              <button type="button" className="wk-link-btn" aria-expanded={showDoc} onClick={() => setShowDoc(!showDoc)}>{showDoc ? 'Zwiń' : 'Pokaż'}</button>
            </div>
            {showDoc && sections.length > 1 && <FormatTree sections={sections} onJump={jumpTo} />}
            {showDoc && (sections.length === 0 ? <pre className="wk-json-pre">{doc}</pre> : (
              <div className="wk-json-pre" ref={docBox}>
                {sections.map((s, i) => (
                  <Fragment key={s.node.key}>{i > 0 ? '\n\n' : ''}<span id={sectionId(s.node.key)} className="wk-json-sec">{texts[i]}</span></Fragment>
                ))}
              </div>
            ))}
          </aside>
        </div>
      </div>
    </details>
  );
}
