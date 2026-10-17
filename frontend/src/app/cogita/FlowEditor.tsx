/**
 * COGITA — ABLÄUFE BAUEN (COGITA.md §8, §9, §11): Schritte als Graph, das
 * Aussehen, Platzhalter einer Erzählvorlage und ihre Verwendung, Ziele (eine
 * Aufgabe), Zeilen der Gestalten, und — für ein Spiel — Zonen, Werte und
 * Auslöser. Daneben: ausprobieren, veröffentlichen, Abhängigkeiten vorschlagen.
 */

import { useEffect, useMemo, useState } from 'react';

import { contentOfLibrary, FlowPlayer } from './FlowPlayer';
import { FLOW_PALETTE, LOOK_LABEL, LOOK_TYPES, proposedDependencies, readFlow, resolveFlow, type CharacterLine, type Flow, type Goal, type LookType, type Slot } from './flow';
import { GameRulesEditor } from './GamePanel';
import { readGame, type GameRules } from './game';
import { graphJson, type Graph } from './graph';
import { GraphEditor } from './GraphEditor';
import { FLOW_PRESETS } from './presets';
import { flowBundle, pageUrl, publishBundle, publishMedia, publishModule, unpublishBundle } from './publish';
import { FLOW_BUNDLE } from './published';
import { readCondition } from './logic';
import { ConditionEditor, EntityPicker, entityName, ForeignOnly, useAsync, useBusy, useCtx } from './ui';
import { askText } from '../ui/dialogs';

export function FlowEditor({ chosenId, onChoose }: { chosenId: string | null; onChoose: (id: string | null) => void }) {
  const { lib, writes } = useCtx();
  const flows = lib.docs('flow');
  const entry = chosenId === null ? undefined : flows.find((e) => e.id === chosenId);
  const { busy, failed, run } = useBusy();
  return (
    <div className="cg">
      <div className="cg-row-between">
        <select value={chosenId ?? ''} onChange={(e) => onChoose(e.target.value === '' ? null : e.target.value)} aria-label="Przebieg">
          <option value="">— przebiegi ({flows.length}) —</option>
          {flows.map((e) => <option key={e.id} value={e.id}>{typeof e.data.name === 'string' ? e.data.name : 'Przebieg'}{lib.isOwn(e.id) ? '' : ` · z: ${lib.origin(e.id)?.name ?? '?'}`}</option>)}
        </select>
        {writes && (
          <details className="cg-card">
            <summary>+ Nowy przebieg</summary>
            <div className="cg">
              {FLOW_PRESETS.map((p) => (
                <button key={p.id} type="button" className="cg-option" disabled={busy} onClick={() => void run(async () => { const made = await lib.saveDoc('flow', p.make()); onChoose(made.id); })}>
                  <span><strong>{p.label}</strong><br /><span className="cg-muted">{p.says}</span></span>
                </button>
              ))}
              <button type="button" className="cg-option" disabled={busy} onClick={() => void run(async () => { const made = await lib.saveDoc('flow', { name: 'Nowy przebieg', look: 'reading', graph: { nodes: [], edges: [] } }); onChoose(made.id); })}>Pusty</button>
              {failed !== null && <p className="wk-error">{failed}</p>}
            </div>
          </details>
        )}
      </div>
      {entry === undefined
        ? <p className="wk-hint">Przebieg mówi, jak coś opowiedzieć: kroki pokazują wiedzę, wpisy i pytania; nagłówki i podpisy wyborów są danymi przebiegu, a cała treść pochodzi z bazy wiedzy (i jej źródeł).</p>
        : <ForeignOnly id={entry.id} tab="przebiegi"><FlowForm key={entry.id} id={entry.id} /></ForeignOnly>}
    </div>
  );
}

function FlowForm({ id }: { id: string }) {
  const { lib, writes, me } = useCtx();
  const entry = lib.docs('flow').find((e) => e.id === id)!;
  const [flow, setFlow] = useState<Flow>(() => readFlow(entry.id, entry.data));
  const [game, setGame] = useState<GameRules>(() => readGame(entry.data.game));
  const [dirty, setDirty] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { busy, failed, run } = useBusy();
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => { if (!dirty) { setFlow(readFlow(entry.id, entry.data)); setGame(readGame(entry.data.game)); } }, [entry.version, dirty, entry.id, entry.data]);
  const set = (patch: Partial<Flow>) => { setFlow((f) => ({ ...f, ...patch })); setDirty(true); };
  const cards = useAsync(() => lib.cards('flow').then((r) => r.cards), [lib.revision]);
  const find = (x: string) => { const e = lib.docs('flow').find((one) => one.id === x); return e === undefined ? undefined : readFlow(e.id, e.data); };
  const resolved = useMemo(() => resolveFlow(flow, find), [flow, lib.revision]);

  const save = () => run(async () => {
    const doc: Record<string, unknown> = {
      ...entry.data, name: flow.name, look: flow.look, lookId: flow.lookId, start: flow.start, graph: graphJson(flow.graph),
      slots: flow.slots, template: flow.template, fill: flow.fill, overrides: flow.overrides, goals: flow.goals, lines: flow.lines,
      ...(game.zones.length + game.triggers.length + game.values.length > 0 ? { game } : { game: undefined })
    };
    await lib.saveDoc('flow', doc, id);
    setDirty(false);
  });

  if (playing && cards !== undefined) {
    return <FlowPlayer flow={resolved} content={contentOfLibrary(lib, cards ?? [])} learner={null} onClose={() => setPlaying(false)} />;
  }

  const templates = lib.docs('flow').filter((e) => e.id !== id && Array.isArray(e.data.slots) && e.data.slots.length > 0);
  const steps = flow.graph.nodes.map((n) => ({ id: n.id, label: `${typeof n.config.title === 'string' && n.config.title !== '' ? n.config.title : n.type} ${n.id.slice(-3)}` }));

  return (
    <div className="cg">
      <div className="cg-row">
        <label className="wk-field"><span>Nazwa</span><input value={flow.name} disabled={!writes} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="wk-field"><span>Wygląd</span>
          <select value={flow.look} disabled={!writes} onChange={(e) => set({ look: e.target.value as LookType })}>{LOOK_TYPES.map((l) => <option key={l} value={l}>{LOOK_LABEL[l]}</option>)}</select>
        </label>
        <button type="button" className="wk-btn" onClick={() => setPlaying(true)}>Wypróbuj</button>
      </div>

      <details open={flow.template !== undefined}>
        <summary>Szablon opowieści {flow.template !== undefined ? `(użyty: ${templates.find((t) => t.id === flow.template)?.data.name ?? '?'})` : ''}</summary>
        <div className="cg">
          <label className="wk-field"><span>Ten przebieg jest użyciem szablonu</span>
            <select value={flow.template ?? ''} disabled={!writes} onChange={(e) => set({ template: e.target.value === '' ? undefined : e.target.value })}>
              <option value="">— nie —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{String(t.data.name ?? 'Szablon')}</option>)}
            </select>
          </label>
          {flow.template !== undefined && (find(flow.template)?.slots ?? []).map((slot) => (
            <div key={slot.id} className="cg-row">
              <span>{slot.label}:</span>
              <EntityPicker lib={lib} kinds={slot.kind === undefined ? undefined : [slot.kind]} value={flow.fill[slot.id] ?? null} onPick={(v) => set({ fill: { ...flow.fill, ...(v === null ? {} : { [slot.id]: v }) } })} />
            </div>
          ))}
          {flow.template === undefined && <SlotsEditor slots={flow.slots} writes={writes} onChange={(slots) => set({ slots })} />}
          <p className="wk-hint">W kroku szablonu pole może wskazywać miejsce: w JSON kroku {'{"of": {"slot": "osoba"}}'}. Zmiana szablonu dociera do każdego użycia.</p>
        </div>
      </details>

      {flow.template === undefined && (
        <GraphEditor graph={flow.graph} palette={FLOW_PALETTE} cycles readOnly={!writes} start={flow.start}
          onStart={(s) => set({ start: s })} onChange={(g: Graph) => set({ graph: g, start: flow.start ?? g.nodes[0]?.id ?? null })} />
      )}

      <details>
        <summary>Cele (zadanie) i postacie</summary>
        <GoalsEditor goals={flow.goals} writes={writes} onChange={(goals) => set({ goals })} />
        <LinesEditor lines={flow.lines} writes={writes} onChange={(lines) => set({ lines })} />
      </details>

      <details>
        <summary>Gra w terenie {game.zones.length > 0 ? `(${game.zones.length} stref)` : ''}</summary>
        <GameRulesEditor rules={game} steps={steps} writes={writes} onChange={(g) => { setGame(g); setDirty(true); }} />
      </details>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {said !== null && <p className="wk-hint">{said}</p>}
      {writes && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Zapisywanie…' : 'Zapisz przebieg'}</button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(async () => {
            const proposed = proposedDependencies(resolved);
            const settings = lib.settings();
            const have = new Set(settings.dependencies.map((d) => `${d.parent}>${d.child}`));
            const fresh = proposed.filter((p) => !have.has(`${p.parent}>${p.child}`)).map((p) => ({ ...p, kind: 'prerequisite', impact: 0.5, proposed: true }));
            if (fresh.length > 0) await lib.saveSettings({ dependencies: [...settings.dependencies, ...fresh] });
            setSaid(fresh.length === 0 ? 'Brak nowych zależności do zaproponowania.' : `Zaproponowano ${fresh.length} zależności — potwierdź je w Ustawieniach.`);
          })}>Zaproponuj zależności z tego przebiegu</button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={async () => { if (await askText('Usunąć przebieg?')) void run(() => lib.remove(id)); }}>Usuń</button>
        </div>
      )}
      {writes && me !== null && <PublishFlow id={id} name={flow.name} onSaid={setSaid} />}
    </div>
  );
}

function SlotsEditor({ slots, writes, onChange }: { slots: readonly Slot[]; writes: boolean; onChange: (s: Slot[]) => void }) {
  const { lib } = useCtx();
  return (
    <div className="cg">
      <span className="cg-muted">Miejsca do wypełnienia (ten przebieg jako szablon):</span>
      {slots.map((s, i) => (
        <div key={i} className="cg-row">
          <input value={s.id} placeholder="klucz" disabled={!writes} onChange={(e) => onChange(slots.map((x, j) => (j === i ? { ...x, id: e.target.value.replace(/[^a-z0-9_]/gi, '') } : x)))} />
          <input value={s.label} placeholder="nazwa" disabled={!writes} onChange={(e) => onChange(slots.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <select value={s.kind ?? ''} disabled={!writes} onChange={(e) => onChange(slots.map((x, j) => (j === i ? { ...x, kind: e.target.value || undefined } : x)))}>
            <option value="">dowolny rodzaj</option>
            {lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          {writes && <button type="button" className="wk-link-btn" onClick={() => onChange(slots.filter((_, j) => j !== i))}>×</button>}
        </div>
      ))}
      {writes && <button type="button" className="wk-link-btn" onClick={() => onChange([...slots, { id: `miejsce${slots.length + 1}`, label: 'Miejsce' }])}>+ miejsce</button>}
    </div>
  );
}

function GoalsEditor({ goals, writes, onChange }: { goals: readonly Goal[]; writes: boolean; onChange: (g: Goal[]) => void }) {
  return (
    <div className="cg">
      <span className="cg-muted">Cele — przebieg z celami to zadanie (quest):</span>
      {goals.map((g, i) => (
        <div key={g.id} className="cg-card">
          <div className="cg-row">
            <input value={g.title} disabled={!writes} onChange={(e) => onChange(goals.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            {writes && <button type="button" className="wk-link-btn" onClick={() => onChange(goals.filter((_, j) => j !== i))}>×</button>}
          </div>
          <ConditionEditor value={g.condition} onChange={(c) => onChange(goals.map((x, j) => (j === i ? { ...x, condition: c } : x)))} />
        </div>
      ))}
      {writes && <button type="button" className="wk-link-btn" onClick={() => onChange([...goals, { id: `cel${goals.length + 1}`, title: 'Nowy cel', condition: readCondition({ type: 'visited' }) }])}>+ cel</button>}
    </div>
  );
}

/*
  2026-10-17 — SPRECHEN DARF JEDER EINTRAG. Früher nur einer, dessen Rodzaj
  „Postać — może mówić" trug; das Häkchen ist fort. Eine neue Zeile entsteht,
  sobald beide gewählt sind: wer spricht und was (ein Satz Wissen).
*/
function LinesEditor({ lines, writes, onChange }: { lines: readonly CharacterLine[]; writes: boolean; onChange: (l: CharacterLine[]) => void }) {
  const { lib } = useCtx();
  const [who, setWho] = useState<string | null>(null);
  const [what, setWhat] = useState<string | null>(null);
  const add = (character: string | null, of: string | null) => {
    setWho(character);
    setWhat(of);
    if (character === null || of === null) return;
    onChange([...lines, { character, of, condition: null, once: true }]);
    setWho(null);
    setWhat(null);
  };
  return (
    <div className="cg">
      <span className="cg-muted">Zdania postaci, które padają same, gdy warunek jest spełniony (wartości, znajomość, odwiedzone kroki). Mówić może każdy wpis.</span>
      {lines.map((l, i) => (
        <div key={i} className="cg-card">
          <div className="cg-row">
            <EntityPicker lib={lib} value={l.character} onPick={(v) => v !== null && onChange(lines.map((x, j) => (j === i ? { ...x, character: v } : x)))} allowClear={false} placeholder="kto mówi" />
            <EntityPicker lib={lib} kinds={['knowledge']} value={l.of} onPick={(v) => v !== null && onChange(lines.map((x, j) => (j === i ? { ...x, of: v } : x)))} allowClear={false} placeholder="co mówi (wiedza)" />
            <label className="pe-check"><input type="checkbox" checked={l.once} disabled={!writes} onChange={(e) => onChange(lines.map((x, j) => (j === i ? { ...x, once: e.target.checked } : x)))} /><span>raz</span></label>
            {writes && <button type="button" className="wk-link-btn" onClick={() => onChange(lines.filter((_, j) => j !== i))}>×</button>}
          </div>
          <ConditionEditor value={l.condition} onChange={(c) => onChange(lines.map((x, j) => (j === i ? { ...x, condition: c } : x)))} name={(x) => entityName(lib, x)} />
        </div>
      ))}
      {writes && (
        <div className="cg-row">
          <span className="cg-muted">Nowe zdanie:</span>
          <EntityPicker lib={lib} value={who} onPick={(v) => add(v, what)} placeholder="kto mówi" />
          <EntityPicker lib={lib} kinds={['knowledge']} value={what} onPick={(v) => add(who, v)} placeholder="co mówi (wiedza)" />
        </div>
      )}
    </div>
  );
}

function PublishFlow({ id, name, onSaid }: { id: string; name: string; onSaid: (s: string) => void }) {
  const { lib, me, keyIn } = useCtx();
  const entry = lib.entry(id);
  const { busy, failed, run } = useBusy();
  const [role, setRole] = useState(me?.person.id ?? '');
  const published = entry?.publishedAs != null;
  if (me === null) return null;
  return (
    <section className="cg-card">
      <h3>Opublikuj kurs</h3>
      <p className="wk-hint">Wychodzi przebieg z tym, co pokazuje (wpisy, wiedza, pytania, pliki) — bez reszty bazy wiedzy i bez postępów. Pliki stają się publiczne.</p>
      <div className="cg-row">
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => {
          const bundle = await flowBundle(lib, id);
          if ('error' in bundle) throw new Error(bundle.error);
          /* Die Dateien, die der Kurs zeigt, gehen offen daneben — nur Bilder, Ton, Film und PDF. */
          await publishMedia(lib, bundle.files, keyIn);
          await publishBundle(lib, id, { ...bundle, format: FLOW_BUNDLE });
          onSaid(`Opublikowano (${Object.keys(bundle.entities).length} wpisów, ${bundle.files.length} plików).`);
        })}>{published ? 'Zaktualizuj publikację' : 'Opublikuj'}</button>
        {published && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => unpublishBundle(lib, id))}>Wycofaj</button>}
      </div>
      {published && (
        <div className="cg-row">
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Czyja strona">{me.roles.filter((r) => r.kind !== 'account').map((r) => <option key={r.id} value={r.id}>{me.names.get(r.id) ?? 'rola'}</option>)}</select>
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => {
            const path = await publishModule({ roleId: role, title: name, parts: [{ kind: 'cogita-flow', config: { library: lib.libraryId, flow: id } }] });
            await navigator.clipboard?.writeText(pageUrl(path)).catch(() => undefined);
            onSaid(`Strona kursu: ${pageUrl(path)} (skopiowano).`);
          })}>Utwórz stronę z tym kursem</button>
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
