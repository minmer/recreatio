/**
 * 2026-10-25 — DIE DURCHSICHT EINES IMPORTS (`importReview.ts`): unter dem Plan jede Änderung an dem,
 * was es schon gibt — Feld für Feld, vorher und nachher, anzunehmen oder nicht, und mit einem Wert, der
 * sich vor dem Speichern ändern lässt —, und das Neue, angenommen vorgeschlagen. Gespeichert wird nur,
 * was angenommen ist. Gleich, ob das Dokument von der eigenen KI kommt oder von Hand geschrieben ist.
 *
 * 2026-11-03 — EIN PLAN JE DOKUMENT (`importSession`): die Vorschau, die Durchsicht und das Speichern sehen dieselben
 * Kennungen für das Neue. Vorher plante das Speichern neu — mit neuen Kennungen —, die Annahmen trafen nichts mehr,
 * und alles Neue fiel still weg. Was den Zapis blockiert, steht hier, bevor jemand speichert.
 */

import { useRef, useState, type ReactNode } from 'react';

import { WorkspaceError } from '../core/session';
import { plural } from '../core/plural';
import type { JsonPreview } from '../ui/JsonPanel';
import { ImportBlocked, structurePreview, type ImportPlan } from './json';
import { changeSummary, defaultDecisions, editedValue, editText, importSession, type Decisions, type ImportChange, type ImportSession } from './importReview';
import type { CogitaLibrary } from './store';
import { TexText } from '../ui/tex/Tex';

/**
 * Die Durchsicht für ein JSON-Fach: `preview` sagt, was der Import tut (gezählt an dem, was sich wirklich ändert),
 * `options` zeichnet die Durchsicht unter den Plan, `decide` gibt beim Speichern DENSELBEN Plan mit nur dem
 * Angenommenen — oder sagt, was ihn blockiert. Was angenommen ist, gilt für genau dieses Dokument.
 */
export function useImportReview(lib: CogitaLibrary): {
  preview: (doc: unknown, extra?: boolean) => JsonPreview | { error: string };
  options: (doc: unknown) => ReactNode;
  decide: (doc: unknown) => ImportPlan;
} {
  const [review, setReview] = useState<{ doc: unknown; decisions: Decisions } | null>(null);
  const sessions = useRef<{ lib: CogitaLibrary; map: WeakMap<object, ImportSession> } | null>(null);
  const session = (doc: unknown): ImportSession => {
    if (typeof doc !== 'object' || doc === null) return importSession(lib, doc);
    if (sessions.current === null || sessions.current.lib !== lib) sessions.current = { lib, map: new WeakMap() };
    let one = sessions.current.map.get(doc);
    if (one === undefined) { one = importSession(lib, doc); sessions.current.map.set(doc, one); }
    return one;
  };
  const decisionsFor = (doc: unknown): Decisions | null => (review !== null && review.doc === doc ? review.decisions : null);
  const preview = (doc: unknown, extra = true): JsonPreview | { error: string } => {
    const one = session(doc);
    const plan = one.plan();
    if ('error' in plan) return plan;
    const changes = one.changes();
    const changed = new Set(changes.filter((c) => !c.isNew).map((c) => c.targetId));
    return { lines: [...changeSummary(changes), ...(extra && changes.length > 0 ? structurePreview(lib, plan, 80, changed) : [])], warnings: plan.warnings };
  };
  const options = (doc: unknown): ReactNode => (
    <ImportReview session={session(doc)} decisions={decisionsFor(doc)} onDecisions={(decisions) => setReview({ doc, decisions })} />
  );
  const decide = (doc: unknown): ImportPlan => {
    const decided = session(doc).decide(decisionsFor(doc));
    if ('error' in decided) throw new WorkspaceError(decided.error);
    if (decided.invalid.length > 0) throw new WorkspaceError(`Popraw zmienione wartości: ${decided.invalid.join('; ')}`);
    if (decided.blocked.length > 0) throw new ImportBlocked(decided.blocked);
    return { ...decided.plan, warnings: [...decided.plan.warnings, ...decided.kept] };
  };
  return { preview, options, decide };
}

const count = (n: number, one: string, few: string, many: string) => `${n} ${plural(n, one, few, many)}`;

function ImportReview({ session, decisions, onDecisions }: { session: ImportSession; decisions: Decisions | null; onDecisions: (d: Decisions) => void }) {
  const changes = session.changes();
  const now = decisions ?? defaultDecisions(changes);
  const fresh = changes.filter((c) => c.isNew);
  const edits = changes.filter((c) => !c.isNew && c.remove !== true);
  /* 2026-11-03 — die Löschungen des Dokuments: jede beim Namen, abwählbar. */
  const gone = changes.filter((c) => c.remove === true);
  /* 2026-11-03 — was den Zapis so, wie er jetzt angekreuzt ist, blockieren würde — bevor jemand auf „Zapisz" drückt. */
  const decided = session.decide(now);
  const blocked = 'error' in decided ? [] : decided.blocked;
  if (changes.length === 0) return null;

  const set = (ids: readonly string[], on: boolean) => {
    const accepted = new Set(now.accepted);
    for (const id of ids) if (on) accepted.add(id); else accepted.delete(id);
    onDecisions({ accepted, edited: now.edited });
  };
  const edit = (id: string, text: string | null) => {
    const edited = new Map(now.edited);
    if (text === null) edited.delete(id); else edited.set(id, text);
    const accepted = new Set(now.accepted);
    if (text !== null) accepted.add(id);
    onDecisions({ accepted, edited });
  };
  const freshOn = fresh.filter((c) => now.accepted.has(c.id)).length;
  const goneOn = gone.filter((c) => now.accepted.has(c.id)).length;
  const editsOn = edits.filter((c) => now.accepted.has(c.id)).length;

  /* Änderungen nach dem, was sie ändern. */
  const groups = new Map<string, ImportChange[]>();
  for (const c of edits) groups.set(`${c.target}:${c.targetId}`, [...(groups.get(`${c.target}:${c.targetId}`) ?? []), c]);

  return (
    <div className="cg-review" data-import-review="">
      <p className="wk-json-h">Przegląd przed zapisem</p>
      <p className="cg-muted" data-review-summary="">
        Zapisze się: {count(freshOn, 'nowy element', 'nowe elementy', 'nowych elementów')} z {fresh.length}
        {edits.length > 0 && <> i {count(editsOn, 'zmiana', 'zmiany', 'zmian')} z {edits.length} w tym, co już jest</>}
        {gone.length > 0 && <>; usunie się {goneOn} z {gone.length}</>}.
        {edits.length > 0 && ' Zmiany w tym, co już jest, zapisują się dopiero po przyjęciu — każdą można też poprawić.'}
        {' Wszystko zapisze się w jednym zapisie — albo nic.'}
      </p>
      {blocked.length > 0 && (
        <div className="wk-error" role="alert" data-review-blocked={blocked.length}>
          <p>Tak zaznaczone nie zapisze się — wskazywałoby na coś, czego nie będzie:</p>
          <ul>{blocked.slice(0, 20).map((line, i) => <li key={i}>{line}</li>)}{blocked.length > 20 && <li>… i {blocked.length - 20} innych</li>}</ul>
        </div>
      )}

      {edits.length > 0 && (
        <section className="cg-review-part" aria-label="Zmiany w tym, co już jest">
          <div className="cg-row">
            <strong>Zmiany w tym, co już jest ({edits.length})</strong>
            <button type="button" className="wk-link-btn" onClick={() => set(edits.map((c) => c.id), true)}>Przyjmij wszystkie</button>
            <button type="button" className="wk-link-btn" onClick={() => set(edits.map((c) => c.id), false)}>Odrzuć wszystkie</button>
          </div>
          {[...groups.values()].map((list) => (
            <div key={`${list[0]!.target}:${list[0]!.targetId}`} className="cg-review-item" data-review-target={list[0]!.targetId}>
              <p className="cg-review-title"><TexText text={list[0]!.title} /></p>
              <ul className="cg-review-fields">
                {list.map((c) => <ChangeRow key={c.id} change={c} on={now.accepted.has(c.id)} edited={now.edited.get(c.id)} onToggle={(on) => set([c.id], on)} onEdit={(text) => edit(c.id, text)} />)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {gone.length > 0 && (
        <section className="cg-review-part" aria-label="Do usunięcia" data-review-removals={gone.length}>
          <div className="cg-row">
            <strong>Do usunięcia ({gone.length})</strong>
            <button type="button" className="wk-link-btn" onClick={() => set(gone.map((c) => c.id), true)}>Wszystkie</button>
            <button type="button" className="wk-link-btn" onClick={() => set(gone.map((c) => c.id), false)}>Żadne</button>
          </div>
          <p className="cg-muted">Usunięte wpisy można przywrócić z historii wersji. Odpowiedzi uczących się zostają — liczą się znowu, gdy wpis wróci.</p>
          <ul className="cg-review-new">
            {gone.map((c) => (
              <li key={c.id}>
                <label className="pe-check">
                  <input type="checkbox" checked={now.accepted.has(c.id)} onChange={(e) => set([c.id], e.target.checked)} data-review-remove={c.targetId} />
                  <span><TexText text={c.title} /><span className="cg-muted"> — {c.afterText}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="cg-review-part" aria-label="Nowe">
          <div className="cg-row">
            <strong>Nowe ({fresh.length})</strong>
            <button type="button" className="wk-link-btn" onClick={() => set(fresh.map((c) => c.id), true)}>Wszystkie</button>
            <button type="button" className="wk-link-btn" onClick={() => set(fresh.map((c) => c.id), false)}>Żadne</button>
          </div>
          <details open={fresh.length <= 30 || undefined}>
            <summary>{count(freshOn, 'zaznaczony', 'zaznaczone', 'zaznaczonych')} z {fresh.length}</summary>
            <ul className="cg-review-new">
              {fresh.map((c) => (
                <li key={c.id}>
                  <label className="pe-check">
                    <input type="checkbox" checked={now.accepted.has(c.id)} onChange={(e) => set([c.id], e.target.checked)} data-review-new={c.targetId} />
                    <span><TexText text={c.title} />{c.afterText !== '' && <span className="cg-muted"> — {c.afterText}</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </div>
  );
}

/** Eine Änderung: annehmen oder nicht, vorher und nachher, und der vorgeschlagene Wert zum Ändern. */
function ChangeRow({ change, on, edited, onToggle, onEdit }: { change: ImportChange; on: boolean; edited: string | undefined; onToggle: (on: boolean) => void; onEdit: (text: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const problem = edited === undefined ? null : (() => { const read = editedValue(change, edited); return 'error' in read ? read.error : null; })();
  return (
    <li className="cg-review-field" data-review-change={change.id}>
      <label className="pe-check">
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} aria-label={`Przyjmij: ${change.fieldLabel ?? change.title}`} />
        <span><strong>{change.fieldLabel ?? 'Całość'}</strong>{change.target === 'kind' && change.afterText !== '' && <> — {change.afterText}</>}</span>
      </label>
      {change.target !== 'kind' && (
        <div className="cg-review-values">
          <p><span className="cg-muted">było: </span>{change.beforeText}</p>
          <p><span className="cg-muted">{edited === undefined ? 'będzie: ' : 'będzie (poprawione): '}</span>{edited === undefined ? change.afterText : edited}</p>
          {problem !== null && <p className="wk-error">{problem}</p>}
        </div>
      )}
      {change.edit !== null && !open && (
        <div className="cg-row">
          <button type="button" className="wk-link-btn" onClick={() => { setDraft(edited ?? editText(change)); setOpen(true); }}>Popraw propozycję</button>
          {edited !== undefined && <button type="button" className="wk-link-btn" onClick={() => onEdit(null)}>Wróć do propozycji</button>}
        </div>
      )}
      {open && (
        <div className="cg-review-edit">
          <textarea rows={change.edit === 'json' ? 6 : change.edit === 'blocks' ? 5 : 2} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`Poprawiona wartość: ${change.fieldLabel ?? ''}`} spellCheck={change.edit !== 'json'} />
          {change.edit === 'blocks' && <p className="wk-hint">Akapity oddziela pusta linia.</p>}
          <div className="cg-row">
            <button type="button" className="wk-btn wk-btn-line" onClick={() => { onEdit(draft); setOpen(false); }}>Gotowe</button>
            <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>Anuluj</button>
          </div>
        </div>
      )}
    </li>
  );
}
