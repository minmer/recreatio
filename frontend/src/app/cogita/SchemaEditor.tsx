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
 *
 * 2026-10-24 — „Rodzaje wpisów", eine der drei Kategorien der Schematy (Wiedza): nur
 * die Rodzaje. Sposoby dodawania und Sposoby wyświetlania stehen daneben, eigenständig.
 *
 * 2026-10-27 — PYTANIE STEHT IMMER IN DER LISTE: das eine Schema jeder Frage, mit seinen
 * Rodzaje pytań und den Feldern je Art (`questionTypes.ts`) — auch bevor es Fragen gibt.
 */

import { useEffect, useMemo, useState } from 'react';

import { ask, toast } from '../ui/dialogs';
import { JsonPanel } from '../ui/JsonPanel';
import { applyImport, courseDescription, exportSchema, planImport } from './json';
import { isBaseKind, QUESTION } from './kinds';
import { QUESTION_SHARED, QUESTION_TYPES } from './questionTypes';
import { problemsOf, type KindDef } from './schema';
import { KindForm } from './KindForm';
import { useImportReview } from './ImportReviewPanel';
import { OriginTag, useBusy, useCtx } from './ui';

export function SchemaEditor({ chosenId, onChoose }: { chosenId: string | null; onChoose: (id: string | null) => void }) {
  const { lib, writes, name } = useCtx();
  const chosen = chosenId === null ? undefined : lib.kind(chosenId);
  /* 2026-10-27 — Pytanie immer: ein Schema, das jede Baza hat (Dodaj bietet es ohnehin an). */
  const listed = lib.kinds.some((k) => k.id === 'question') ? lib.kinds : [...lib.kinds, lib.kind('question') ?? QUESTION];
  const [draft, setDraft] = useState<KindDef | null>(null);
  const { busy, failed, run } = useBusy();

  useEffect(() => { setDraft(chosen === undefined ? null : chosen); }, [chosenId, chosen === undefined ? '' : JSON.stringify(chosen)]);

  const create = () => {
    const id = lib.newId();
    setDraft({ id, name: 'Nowy rodzaj', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line', multi: false, uncertain: false }] });
    onChoose(null);
  };
  const [removing, setRemoving] = useState<string | null>(null);
  /* 2026-10-25 — was ein Schema an Bestehendem ändert, wird einzeln angenommen. */
  const review = useImportReview(lib);
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
            options={review.options}
            importLabel="Zapisz przyjęte"
            onImport={async (doc, stage) => applyImport(lib, review.decide(doc), stage)}
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
        {lib.kinds.length === 0 && <p className="cg-muted">Ta baza wiedzy nie ma jeszcze własnych rodzajów. Dodaj własny — albo zaimportuj schemat jako JSON (np. gotowy Komentarz z <code>templates/cogita/komentarz.json</code>, pojęcia z kolejnością nauki z <code>templates/cogita/podstawy.json</code>).</p>}
        <ul className="lib-list">
          {listed.map((k) => (
            <li key={k.id}>
              <button type="button" className={`lib-row cg-card${chosenId === k.id ? ' is-on' : ''}`} onClick={() => onChoose(k.id)}>
                <span className="lib-row-title">{k.name} {k.system !== undefined && <span className="cg-tag">system</span>} {isBaseKind(k.id) && k.system === undefined && <span className="cg-tag">wbudowany</span>} {!isBaseKind(k.id) && <OriginTag id={k.id} />}</span>
                <span className="lib-row-meta">{lib.ofKind(k.id).length} wpisów · {k.fields.length} pól</span>
              </button>
            </li>
          ))}
        </ul>
        {/* 2026-10-24 — die Formularze dodawania stehen jetzt unter „Sposoby dodawania" (eigene Kategorie der Schematy, `KnowledgeParts.tsx`). */}
      </aside>
    </div>
  );
}

/** Der Editor eines Rodzaj dieser Baza: was `KindForm` wissen muss, aus ihr. */
function BaseKindForm({ draft, writes, busy, onChange, onSave, onRemove }: { draft: KindDef; writes: boolean; busy: boolean; onChange: (k: KindDef) => void; onSave: () => void; onRemove?: () => void }) {
  const { lib } = useCtx();
  const base = isBaseKind(draft.id);
  const question = draft.id === 'question';
  /* 2026-10-27 — die Felder des Pytanie gehören der Maschine (Prüfen, Karten): nur Namen und Erklärungen sind frei. */
  const fixedKeys = useMemo(() => new Set(question ? QUESTION.fields.map((f) => f.key) : base ? (lib.kind(draft.id)?.fields ?? []).filter((f) => f.role === f.key).map((f) => f.key) : []), [base, question, draft.id, lib]);
  return (
    <KindForm draft={draft} writes={writes} busy={busy} targets={lib.refKinds} fixedKeys={fixedKeys} base={base} problems={problemsOf(draft, lib.look)}
      extra={question ? <QuestionTypes kind={draft} /> : undefined}
      onChange={onChange} onSave={onSave} onRemove={onRemove}
    />
  );
}

/**
 * 2026-10-27 — DAS SCHEMA DER FRAGE IN WORTEN: jeder Rodzaj pytania, was der Lernende tut, welche
 * Felder er braucht — und was alle gemeinsam haben. Eine neue Art ist eine neue Zeile hier
 * (`questionTypes.ts`), kein neuer Rodzaj.
 */
function QuestionTypes({ kind }: { kind: KindDef }) {
  const label = (key: string) => kind.fields.find((f) => f.key === key)?.label ?? key;
  return (
    <section className="cg-card cg-qtypes" data-question-types="">
      <h3>Rodzaje pytań — jeden schemat</h3>
      <p className="cg-muted">Każde pytanie ma: {QUESTION_SHARED.map(label).join(', ')}. „{label('form')}” decyduje, które pola dochodzą — edytor pytania pokazuje tylko je.</p>
      <div className="cg-fields-wrap">
        <table className="cg-table">
          <thead><tr><th>Rodzaj pytania</th><th>Co robi uczący się</th><th>Pola</th></tr></thead>
          <tbody>
            {QUESTION_TYPES.map((t) => (
              <tr key={t.form} data-question-type={t.form}>
                <td><strong>{t.label}</strong> <code>{t.form}</code></td>
                <td>{t.says}</td>
                <td>{[t.prompt, ...t.fields.map(label)].join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
