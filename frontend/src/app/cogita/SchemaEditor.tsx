/**
 * COGITA — DAS SCHEMA BEARBEITEN (COGITA.md §2.2): Rodzaje mit ihren Feldern,
 * dem Muster des Etiketts, dem unterscheidenden Feld; die eingebauten als
 * Anfang, die man umbenennen und erweitern kann [B1]; eigene, so viele man
 * will. Werte entfernter oder umgetypter Felder bleiben „poza schematem" [B13].
 *
 * Der Editor eines Rodzaj selbst steht seit 2026-10-23 in `KindForm.tsx` — das
 * Skryptorium beschreibt seine Rodzaje tekstów mit demselben.
 *
 * 2026-10-23 — KEINE FERTIGEN INHALTE MEHR im Menü (Temat, Wiedza, Pytanie,
 * „Gotowy schemat"): ein Rodzaj ist leer und eigen, oder er kommt als JSON —
 * die Vorlagen liegen als Dateien in `templates/cogita/*.json` (Komentarz,
 * Słownik, Psałterz) und werden hier unten importiert.
 */

import { useEffect, useMemo, useState } from 'react';

import { ask, toast } from '../ui/dialogs';
import { JsonPanel } from '../ui/JsonPanel';
import { WorkspaceError } from '../core/session';
import { nodeLabel, readAddForm } from './addForm';
import { NewFormMenu } from './AddFormEditor';
import { applyImport, courseDescription, exportSchema, planImport } from './json';
import { isBaseKind } from './kinds';
import { problemsOf, type KindDef } from './schema';
import { KindForm } from './KindForm';
import { OriginTag, useBusy, useCtx } from './ui';

export function SchemaEditor({ chosenId, onChoose, onForm }: { chosenId: string | null; onChoose: (id: string | null) => void; onForm: (id: string) => void }) {
  const { lib, writes, name } = useCtx();
  const chosen = chosenId === null ? undefined : lib.kind(chosenId);
  const [draft, setDraft] = useState<KindDef | null>(null);
  const { busy, failed, run } = useBusy();

  useEffect(() => { setDraft(chosen === undefined ? null : chosen); }, [chosenId, chosen === undefined ? '' : JSON.stringify(chosen)]);

  const create = () => {
    const id = lib.newId();
    setDraft({ id, name: 'Nowy rodzaj', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line', multi: false, uncertain: false }] });
    onChoose(null);
  };
  const [removing, setRemoving] = useState<string | null>(null);
  /*
    2026-10-18 — JEDEN RODZAJ USUNĄĆ, auch einen eingebauten: erst ausrechnen,
    was alles mitgeht (Einträge, Verweise, Felder, Szablony, Formularze, Zbiory
    — `kindRemoval.ts`), das sagen, dann tun.
  */
  const removeKind = (id: string) => void run(async () => {
    const plan = lib.planKindRemoval(id);
    if (plan === null) return;
    if (plan.blocked !== null) throw new Error(plan.blocked);
    const yes = await ask({ title: `Usunąć rodzaj „${plan.kind.name}”?`, body: 'Tego nie da się cofnąć. Razem z nim:', list: plan.lines, confirm: 'Usuń rodzaj', danger: true });
    if (!yes) return;
    await lib.removeKind(plan, setRemoving);
    setRemoving(null);
    toast(`Usunięto rodzaj „${plan.kind.name}”.`);
    setDraft(null);
    onChoose(null);
  }).finally(() => setRemoving(null));

  return (
    <div className="cg-split">
      <div className="cg">
        {draft === null ? (
          <p className="wk-hint">Wybierz rodzaj z listy{writes ? ' albo dodaj nowy' : ''}. Rodzaj mówi, jakie pola ma wpis, jak się nazywa (wzór etykiety) i czym różnią się wpisy o tej samej nazwie.</p>
        ) : (
          <BaseKindForm key={draft.id} draft={draft} writes={writes && (isBaseKind(draft.id) || lib.isOwn(draft.id) || lib.origin(draft.id) === undefined)} busy={busy}
            onChange={setDraft}
            onSave={() => void run(async () => { await lib.saveKind(draft); onChoose(draft.id); })}
            onRemove={writes && lib.kind(draft.id) !== undefined && (isBaseKind(draft.id) || lib.isOwn(draft.id)) ? () => removeKind(draft.id) : undefined}
          />
        )}
        {removing !== null && <p className="cg-muted">{removing}</p>}
        {failed !== null && <p className="wk-error">{failed}</p>}
        {writes && (
          <JsonPanel
            summary="Schemat jako JSON — kopia do innej bazy wiedzy"
            lead={<>Rodzaje z ich szablonami kart i formularzami dodawania jako jeden dokument. Import tworzy niezależną kopię: zmiany tutaj nie zmieniają bazy, z której przyszła [B12]. Żeby korzystać z rodzajów innej bazy bez kopiowania, dodaj ją w Ustawieniach jako źródło. Gotowe schematy (Komentarz, Słownik, Psałterz) to pliki <code>templates/cogita/*.json</code> w repozytorium — importuje się je tutaj.</>}
            fileName={`schemat-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`}
            exportDoc={() => exportSchema(lib, name, lib.kinds.filter((k) => (!isBaseKind(k.id) && lib.isOwn(k.id)) || lib.docs('kind').some((e) => e.data.builtin === k.id)))}
            description={() => courseDescription(lib)}
            preview={(doc) => { const p = planImport(lib, doc); return 'error' in p ? p : { lines: p.lines, warnings: p.warnings }; }}
            importLabel="Importuj schemat"
            onImport={async (doc, stage) => {
              const p = planImport(lib, doc);
              if ('error' in p) throw new WorkspaceError(p.error);
              return applyImport(lib, p, stage);
            }}
          />
        )}
      </div>
      <aside className="cg">
        <div className="cg-row-between">
          <h3>Rodzaje</h3>
          {writes && (
            <button type="button" className="wk-btn" onClick={create}>+ Rodzaj</button>
          )}
        </div>
        {lib.kinds.length === 0 && <p className="cg-muted">Ta baza wiedzy nie ma jeszcze rodzajów. Dodaj własny — albo zaimportuj schemat jako JSON (np. gotowy Komentarz z <code>templates/cogita/komentarz.json</code>).</p>}
        <ul className="lib-list">
          {lib.kinds.map((k) => (
            <li key={k.id}>
              <button type="button" className={`lib-row cg-card${chosenId === k.id ? ' is-on' : ''}`} onClick={() => onChoose(k.id)}>
                <span className="lib-row-title">{k.name} {k.system !== undefined && <span className="cg-tag">system</span>} {isBaseKind(k.id) && k.system === undefined && <span className="cg-tag">wbudowany</span>} {!isBaseKind(k.id) && <OriginTag id={k.id} />}</span>
                <span className="lib-row-meta">{lib.ofKind(k.id).length} wpisów · {k.fields.length} pól</span>
              </button>
            </li>
          ))}
        </ul>
        {/* 2026-10-17 — wie man die Einträge dieser Rodzaje anlegt, viele auf einmal: Formularze dodawania (`addForm.ts`). */}
        <div className="cg-row-between">
          <h3>Formularze dodawania</h3>
          {writes && <NewFormMenu onMade={onForm} />}
        </div>
        {lib.docs('addform').length === 0 ? (
          <p className="cg-muted">Formularz dodaje wiele wpisów naraz, wiersz po wierszu — np. słowo, jego tłumaczenie i temat. Zacznij od rodzaju, który chcesz dodawać.</p>
        ) : (
          <ul className="lib-list">
            {lib.docs('addform').map((e) => {
              const form = readAddForm(e.id, e.data);
              const made = form.graph.nodes.filter((n) => n.type === 'entry').map((n) => nodeLabel(n, lib.look));
              return (
                <li key={e.id}>
                  <button type="button" className="lib-row cg-card" onClick={() => onForm(e.id)}>
                    <span className="lib-row-title">{form.name} {!lib.isOwn(e.id) && <OriginTag id={e.id} />}</span>
                    <span className="lib-row-meta">{made.join(' · ') || 'pusty'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}

/** Der Editor eines Rodzaj dieser Baza: was `KindForm` wissen muss, aus ihr. */
function BaseKindForm({ draft, writes, busy, onChange, onSave, onRemove }: { draft: KindDef; writes: boolean; busy: boolean; onChange: (k: KindDef) => void; onSave: () => void; onRemove?: () => void }) {
  const { lib } = useCtx();
  const base = isBaseKind(draft.id);
  const fixedKeys = useMemo(() => new Set(base ? (lib.kind(draft.id)?.fields ?? []).filter((f) => f.role === f.key).map((f) => f.key) : []), [base, draft.id, lib]);
  return (
    <KindForm draft={draft} writes={writes} busy={busy} targets={lib.refKinds} fixedKeys={fixedKeys} base={base} problems={problemsOf(draft, lib.look)}
      onChange={onChange} onSave={onSave} onRemove={onRemove}
    />
  );
}
