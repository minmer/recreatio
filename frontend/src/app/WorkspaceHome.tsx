/**
 * DIE SEITE DES WARSZTAT (0094) — ein Widok: seine Teile, in seiner
 * Reihenfolge, jeder auf seinem Weg.
 *
 * <b>Oben der Widok selbst</b>: welcher (Auswahlfeld — „Mój widok", die
 * eigenen, einer je Obszar), „Dostosuj" und „Nowy widok". <b>Jeder Teil hat
 * an seinem Kopf sein eigenes Auswahlfeld</b> (Lista / 7 dni / Kalendarz …):
 * ein anderer Weg gilt sofort, und daneben steht „Zapisz w tym widoku" —
 * wer den erweiterten nur kurz ansieht, muss nichts zurückstellen.
 *
 * <b>Dostosuj</b>: Teile hinzufügen, verschieben, entfernen; der Name; bei
 * einem eigenen Widok die Bereiche; zurück auf die Vorgabe; der Widok als
 * JSON (hinaus und herein, `workspaceViews.ts`).
 */

import { useId, useMemo, useState, type ReactNode } from 'react';

import type { AreaRow } from './area';
import { useCrumbs } from './crumbTrail';
import type { Desk } from './desk';
import { newId } from './ids';
import { JsonPanel } from './JsonPanel';
import { useRemembered } from './prefs';
import { viewPath } from './routes';
import type { Who } from './session';
import { areasNow, useLoaded } from './viewData';
import { PART_VIEWS } from './ViewParts';
import {
  addable, addPart, allViews, exportView, MINE, movePart, newView, partDef, partMode, pick, planViewImport, readViewsState,
  removePart, removeView, resetView, saveView, scopeOf, setPartMode, viewDescription, viewsJson,
  type PartConfig, type PartKind, type ViewConfig, type ViewsState
} from './workspaceViews';

/** Die Widoki dieses Kontos — gelesen und geschrieben über den gemerkten Stand. */
export function useViews(): [ViewsState, (next: ViewsState) => void] {
  const [text, setText] = useRemembered('workspace.views', '');
  const state = useMemo(() => readViewsState(text), [text]);
  return [state, (next) => setText(viewsJson(next))];
}

export function WorkspaceHome({ who, desk, viewId, heading }: {
  who: Who;
  desk: Desk;
  /** Ein bestimmter Widok (aus der Adresse) — sonst der zuletzt offene. */
  viewId?: string;
  /** Was über dem Widok steht, wenn ihn jemand anderes einbettet (der Widok obszaru in „Obszary"). */
  heading?: ReactNode;
}) {
  const areas = useLoaded(() => areasNow(), []);
  const [state, setState] = useViews();
  const list = areas ?? [];
  const views = allViews(state, list);
  const view = views.find((one) => one.id === (viewId ?? state.current)) ?? views[0];
  const scope = scopeOf(view, list);
  const [editing, setEditing] = useState(false);
  const [making, setMaking] = useState(false);

  /* Ausprobierte Wege je Teil — nur für diesen Widok und diese Karte, bis „Zapisz". */
  const [tried, setTried] = useState<{ view: string; modes: Readonly<Record<number, string>> }>({ view: '', modes: {} });
  const trying = tried.view === view.id ? tried.modes : {};

  const store = (next: ViewConfig) => setState(saveView(state, next));

  const goTo = (id: string) => {
    setState(pick(state, id));
    if (viewId !== undefined) window.location.hash = viewPath('widok', id);
  };

  return (
    <div className="wk-view" data-view={view.id}>
      {/* Auf der eigenen Adresse (`#/workspace/widok/…`) steht der Name im Weg oben. */}
      {viewId !== undefined && heading === undefined && <ViewCrumb label={view.name} />}
      {heading}
      <div className="wk-view-head">
        {heading === undefined && <h1 className="wk-h1">{view.kind === 'mine' ? 'Warsztat' : view.name}</h1>}
        <ViewPicker views={views} current={view.id} onPick={goTo} onNew={() => setMaking(true)} />
        <button type="button" className={editing ? 'wk-btn wk-btn-small' : 'wk-btn wk-btn-quiet wk-btn-small'} aria-pressed={editing} data-view-edit=""
          onClick={() => setEditing(!editing)}>{editing ? 'Gotowe' : 'Dostosuj widok'}</button>
      </div>

      {making && (
        <NewViewForm views={views} current={view} onCancel={() => setMaking(false)} onMake={(name, from) => {
          const id = `own:${newId()}`;
          setState(newView(state, name, from, id));
          setMaking(false);
          setEditing(true);
          if (viewId !== undefined) window.location.hash = viewPath('widok', id);
        }} />
      )}

      {editing && (
        <ViewEditor key={view.id} view={view} areas={list} changed={state.changed[view.id] !== undefined}
          onChange={store}
          onReset={() => setState(resetView(state, view.id))}
          onRemove={() => { setState(removeView(state, view.id)); setEditing(false); if (viewId !== undefined) window.location.hash = viewPath('widok', MINE); }} />
      )}

      {view.parts.length === 0 && <p className="wk-empty">Ten widok jest pusty — „Dostosuj widok" → „Dodaj część".</p>}

      <div className="wk-view-parts">
        {view.parts.map((part, index) => {
          const shownMode = trying[index] ?? part.mode;
          const Body = PART_VIEWS[part.kind];
          return (
            <PartFrame key={`${part.kind}-${index}`} part={part} mode={shownMode} index={index} total={view.parts.length} editing={editing}
              onTry={(modeId) => setTried({ view: view.id, modes: { ...trying, [index]: modeId } })}
              onSave={() => { store(setPartMode(view, index, shownMode)); const next = { ...trying }; delete next[index]; setTried({ view: view.id, modes: next }); }}
              onBack={() => { const next = { ...trying }; delete next[index]; setTried({ view: view.id, modes: next }); }}
              onMove={(by) => { store(movePart(view, index, by)); setTried({ view: '', modes: {} }); }}
              onRemove={() => { store(removePart(view, index)); setTried({ view: '', modes: {} }); }}>
              <Body mode={shownMode} scope={scope} view={view} who={who} desk={desk} />
            </PartFrame>
          );
        })}
      </div>
    </div>
  );
}

function ViewCrumb({ label }: { label: string }) {
  useCrumbs([{ label, href: null }]);
  return null;
}

/* -- Welcher Widok ---------------------------------------------------------------------- */

const NEW_VIEW = '__new__';

function ViewPicker({ views, current, onPick, onNew }: {
  views: readonly ViewConfig[];
  current: string;
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  const id = useId();
  const mine = views.filter((one) => one.kind !== 'area');
  const areas = views.filter((one) => one.kind === 'area');
  return (
    <label className="wk-view-pick" htmlFor={id}>
      <span>Widok</span>
      <select id={id} value={current} data-view-pick="" onChange={(e) => { if (e.target.value === NEW_VIEW) onNew(); else onPick(e.target.value); }}>
        <optgroup label="Twoje">
          {mine.map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}
        </optgroup>
        {areas.length > 0 && (
          <optgroup label="Obszary">
            {areas.map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}
          </optgroup>
        )}
        <option value={NEW_VIEW}>＋ Nowy widok…</option>
      </select>
    </label>
  );
}

function NewViewForm({ views, current, onMake, onCancel }: {
  views: readonly ViewConfig[];
  current: ViewConfig;
  onMake: (name: string, from: ViewConfig) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState(current.id);
  const empty: ViewConfig = { id: '', name: '', kind: 'own', areaIds: [], parts: [] };
  return (
    <form className="wk-form wk-view-new" onSubmit={(e) => {
      e.preventDefault();
      onMake(name, from === '' ? empty : views.find((one) => one.id === from) ?? empty);
    }}>
      <h2 className="wk-h2">Nowy widok</h2>
      <label className="wk-field">
        <span>Nazwa</span>
        <input value={name} placeholder="np. Bierzmowanie na co dzień" autoComplete="off" data-view-name="" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="wk-field">
        <span>Zacznij od</span>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">pustego widoku</option>
          {views.map((one) => <option key={one.id} value={one.id}>{one.kind === 'area' ? `widoku obszaru: ${one.name}` : one.name}</option>)}
        </select>
      </label>
      <div className="wk-actions">
        <button type="submit" className="wk-btn">Utwórz widok</button>
        <button type="button" className="wk-link-btn" onClick={onCancel}>Anuluj</button>
      </div>
    </form>
  );
}

/* -- Ein Teil ------------------------------------------------------------------------------ */

function PartFrame({ part, mode, index, total, editing, onTry, onSave, onBack, onMove, onRemove, children }: {
  part: PartConfig;
  mode: string;
  index: number;
  total: number;
  editing: boolean;
  onTry: (modeId: string) => void;
  onSave: () => void;
  onBack: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const def = partDef(part.kind);
  const shown = partMode(part.kind, mode);
  const id = useId();
  const changed = shown.id !== partMode(part.kind, part.mode).id;
  const wide = part.kind === 'tiles' || part.kind === 'starters' || shown.extended;

  return (
    <section className={wide ? 'wk-part is-wide' : 'wk-part'} data-part={part.kind} aria-labelledby={id}>
      <header className="wk-part-head">
        <h2 id={id} className="wk-part-title">{def.label}</h2>
        {def.modes.length > 1 && (
          <select className="wk-part-mode" aria-label={`${def.label}: sposób wyświetlania`} value={shown.id} data-part-mode={part.kind}
            onChange={(e) => onTry(e.target.value)}>
            {def.modes.map((one) => <option key={one.id} value={one.id}>{one.label}{one.extended ? ' (rozszerzony)' : ''}</option>)}
          </select>
        )}
        {changed && (
          <span className="wk-part-save">
            <button type="button" className="wk-btn wk-btn-small" data-part-save={part.kind} onClick={onSave}>Zapisz w tym widoku</button>
            <button type="button" className="wk-link-btn" onClick={onBack}>Wróć</button>
          </span>
        )}
        {editing && (
          <span className="wk-part-move">
            <button type="button" className="wk-icon-btn" aria-label={`${def.label}: wyżej`} disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
            <button type="button" className="wk-icon-btn" aria-label={`${def.label}: niżej`} disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>
            <button type="button" className="wk-icon-btn" aria-label={`${def.label}: usuń z widoku`} onClick={onRemove}>✕</button>
          </span>
        )}
      </header>
      <div className="wk-part-body">{children}</div>
    </section>
  );
}

/* -- Dostosuj -------------------------------------------------------------------------------- */

function ViewEditor({ view, areas, changed, onChange, onReset, onRemove }: {
  view: ViewConfig;
  areas: readonly AreaRow[];
  changed: boolean;
  onChange: (next: ViewConfig) => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(view.name);
  const [adding, setAdding] = useState('');
  const options = addable(view);

  return (
    <section className="wk-view-editor" aria-label="Dostosuj widok">
      <div className="wk-view-editor-row">
        <label className="wk-field">
          <span>Nazwa widoku</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() !== '' && name !== view.name) onChange({ ...view, name: name.trim().slice(0, 80) }); }} />
        </label>
        <label className="wk-field">
          <span>Dodaj część</span>
          <select value={adding} data-view-add="" onChange={(e) => {
            const kind = e.target.value as PartKind;
            setAdding('');
            if (kind !== ('' as PartKind)) onChange(addPart(view, kind));
          }}>
            <option value="">— wybierz —</option>
            {options.map((def) => <option key={def.kind} value={def.kind}>{def.label} — {def.says}</option>)}
          </select>
        </label>
      </div>

      {view.kind === 'own' && (
        <fieldset className="wk-field wk-view-areas">
          <legend>Obszary w tym widoku (żaden — wszystkie)</legend>
          {areas.filter((a) => a.personal !== true).map((a) => (
            <label key={a.areaId} className="wk-check">
              <input type="checkbox" checked={view.areaIds.includes(a.areaId)} onChange={(e) => onChange({
                ...view,
                areaIds: e.target.checked ? [...view.areaIds, a.areaId] : view.areaIds.filter((id) => id !== a.areaId),
                parts: e.target.checked || view.areaIds.length > 1 ? view.parts : view.parts.filter((p) => partDef(p.kind).areaOnly !== true)
              })} />
              <span>{a.name}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="wk-actions">
        {view.kind !== 'own' && changed && <button type="button" className="wk-link-btn" onClick={onReset}>Przywróć domyślny</button>}
        {view.kind === 'own' && <button type="button" className="wk-link-btn wk-danger-link" onClick={onRemove}>Usuń ten widok</button>}
      </div>

      <JsonPanel
        summary="JSON widoku — eksport i import"
        lead={<>Ten widok jako JSON: części, ich sposoby wyświetlania{view.kind === 'own' ? ', nazwa i obszary' : ''}. Import zmienia ten widok.</>}
        fileName={`widok-${view.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.json`}
        exportDoc={() => exportView(view, areas)}
        description={viewDescription}
        preview={(doc) => {
          const plan = planViewImport(doc, view, areas);
          if ('error' in plan) return plan;
          return { lines: [`Części: ${plan.view.parts.map((p) => partDef(p.kind).label).join(', ') || 'żadnych'}.`], warnings: plan.warnings };
        }}
        importLabel="Importuj do tego widoku"
        onImport={async (doc) => {
          const plan = planViewImport(doc, view, areas);
          if ('error' in plan) throw new Error(plan.error);
          onChange(plan.view);
          return { lines: ['Widok zapisany.'], warnings: plan.warnings };
        }}
      />
    </section>
  );
}

export default WorkspaceHome;
