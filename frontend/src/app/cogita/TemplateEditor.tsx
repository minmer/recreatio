/**
 * COGITA — KARTENVORLAGEN (COGITA.md §5, [D1, D2, D8]): je Art ein Graph aus
 * Bausteinen, der für jeden Eintrag (oder jeden seiner Werte) eine Karte
 * macht. Daneben die Vorschau an einem echten Eintrag — mit dem Fehler am
 * Knoten, der scheiterte.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { answerText } from './CardFace';
import { cardsOf, readTemplate, templateProblems, type Template } from './cards';
import { TEMPLATE_PALETTE } from './cardPalette';
import { evaluate, graphJson, type Graph } from './graph';
import { GraphEditor } from './GraphEditor';
import { TEMPLATE_PRESETS } from './presets';
import { EntityPicker, ForeignOnly, useAsync, useBusy, useCtx } from './ui';
import { askText } from '../ui/dialogs';

export function TemplateEditor({ chosenId, onChoose }: { chosenId: string | null; onChoose: (id: string | null) => void }) {
  const { lib, writes } = useCtx();
  const templates = lib.templates();
  const entry = chosenId === null ? undefined : lib.docs('template').find((e) => e.id === chosenId);

  return (
    <div className="cg">
      <div className="cg-row-between">
        <div className="cg-row">
          <select value={chosenId ?? ''} onChange={(e) => onChoose(e.target.value === '' ? null : e.target.value)} aria-label="Szablon">
            <option value="">— szablony kart ({templates.length}) —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.kinds.map((k) => lib.kind(k)?.name ?? k).join(', ')}{lib.isOwn(t.id) ? '' : ` · z: ${lib.origin(t.id)?.name ?? '?'}`}</option>)}
          </select>
        </div>
        {writes && <NewTemplate onMade={onChoose} />}
      </div>
      {entry === undefined
        ? <p className="wk-hint">Szablon mówi, jak z wpisów jednego rodzaju powstają karty — np. „Kto napisał {'{tytuł}'}?" z polem autorów jako odpowiedzią. Zacznij od gotowego początku albo od pustego grafu.</p>
        : <ForeignOnly id={entry.id} tab="karty"><TemplateForm key={entry.id} template={readTemplate(entry.id, entry.data)} /></ForeignOnly>}
    </div>
  );
}

function NewTemplate({ onMade }: { onMade: (id: string) => void }) {
  const { lib } = useCtx();
  const [kind, setKind] = useState(lib.kinds.find((k) => !['person', 'work', 'quote', 'topic', 'text', 'project'].includes(k.id))?.id ?? 'person');
  const [preset, setPreset] = useState('ask');
  const fields = lib.kind(kind)?.fields ?? [];
  const [field, setField] = useState('');
  const [second, setSecond] = useState('');
  const { busy, failed, run } = useBusy();
  const box = useRef<HTMLDetailsElement>(null);
  const p = TEMPLATE_PRESETS.find((x) => x.id === preset);
  /* „Przez odwołanie": erst ein Feld, das auf Einträge verweist (die Wörter), dann eines von deren Feldern (ihre Sprache). */
  const through = p?.needs.includes('through') === true;
  const choices = through ? fields.filter((x) => x.type === 'ref') : fields;
  const f = choices.find((x) => x.key === field) ?? choices[0];
  const target = through && f?.to !== undefined && f.to.length > 0 ? lib.kind(f.to[0]) : undefined;
  const inner = target?.fields ?? [];
  const s = through
    ? inner.find((x) => x.key === second) ?? inner.find((x) => x.type === 'ref') ?? inner[0]
    : fields.find((x) => x.key === second) ?? fields[1] ?? fields[0];
  return (
    <details className="cg-card" ref={box}>
      <summary>+ Nowy szablon</summary>
      <div className="cg">
        <label className="wk-field"><span>Dla rodzaju</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setField(''); setSecond(''); }}>{lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
        </label>
        <label className="wk-field"><span>Początek</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {TEMPLATE_PRESETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            <option value="empty">Pusty graf</option>
          </select>
        </label>
        {p !== undefined && <p className="wk-hint">{p.says}</p>}
        {p !== undefined && choices.length > 0 && (
          <label className="wk-field"><span>{through ? 'Pole ze słowami (odwołanie)' : 'Pole'}</span>
            <select value={f?.key ?? ''} onChange={(e) => { setField(e.target.value); if (through) setSecond(''); }}>{choices.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
          </label>
        )}
        {through && choices.length === 0 && <p className="wk-warn">Ten rodzaj nie ma pola, które odwołuje się do innych wpisów (np. do słów).</p>}
        {through && f !== undefined && (inner.length > 0
          ? (
            <label className="wk-field"><span>Pole języka w „{target?.name}”</span>
              <select value={s?.key ?? ''} onChange={(e) => setSecond(e.target.value)}>{inner.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
            </label>
          )
          : <p className="wk-warn">Pole „{f.label}” nie wskazuje jednego rodzaju z polami — wybierz w schemacie, do czego się odwołuje.</p>)}
        {p?.needs.includes('second') === true && (
          <label className="wk-field"><span>Drugie pole</span>
            <select value={s?.key ?? ''} onChange={(e) => setSecond(e.target.value)}>{fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
          </label>
        )}
        <button type="button" className="wk-btn" disabled={busy || (p !== undefined && (f === undefined || (through && s === undefined)))} onClick={() => void run(async () => {
          const doc = p === undefined || f === undefined
            ? { name: 'Nowy szablon', kinds: [kind], direction: '', graph: { nodes: [], edges: [] } }
            : p.make(kind, { key: f.key, label: f.label }, s === undefined ? undefined : { key: s.key, label: s.label });
          const made = await lib.saveDoc('template', doc);
          /* Der neue Szablon steht gleich darunter offen — der Dialog hat seine Arbeit getan. */
          if (box.current !== null) box.current.open = false;
          onMade(made.id);
        })}>Utwórz</button>
        {failed !== null && <p className="wk-error">{failed}</p>}
      </div>
    </details>
  );
}

function TemplateForm({ template }: { template: Template }) {
  const { lib, writes } = useCtx();
  const [draft, setDraft] = useState<Template>(template);
  const [dirty, setDirty] = useState(false);
  const { busy, failed, run } = useBusy();
  const [sample, setSample] = useState<string | null>(null);
  useEffect(() => { if (!dirty) setDraft(template); }, [template, dirty]);

  /* Die Felder der eigenen Arten — und der Arten, auf die sie verweisen: die Sprache der Wörter einer Übersetzung. */
  const fieldKeys = useMemo(() => {
    const seen = new Map<string, string>();
    const visited = new Set<string>();
    let layer: string[] = [...draft.kinds];
    for (let depth = 0; depth < 3 && layer.length > 0; depth += 1) {
      const next: string[] = [];
      for (const id of layer) {
        const kind = lib.kind(id);
        if (kind === undefined || visited.has(id)) continue;
        visited.add(id);
        for (const field of kind.fields) {
          if (!seen.has(field.key)) seen.set(field.key, depth === 0 ? field.label : `${kind.name}: ${field.label}`);
          if (field.type === 'ref') next.push(...(field.to ?? []));
        }
      }
      layer = next;
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [draft.kinds, lib]);

  const entity = sample === null ? lib.ofKind(draft.kinds[0] ?? '')[0] : lib.entity(sample);
  const preview = useAsync(entity === undefined ? null : async () => {
    const ctx = { look: lib.look, entity, pool: (k: string) => lib.ofKind(k), seed: 'podglad', ...(lib.python === undefined ? {} : { python: lib.python }) };
    const made = await cardsOf(draft, ctx);
    const evaluated = await evaluate(draft.graph, TEMPLATE_PALETTE, ctx);
    return { made, errors: evaluated.errors };
  }, [JSON.stringify(graphJson(draft.graph)), entity?.id, lib.revision]);

  const set = (patch: Partial<Template>) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };
  const save = () => run(async () => {
    await lib.saveDoc('template', { name: draft.name, kinds: draft.kinds, direction: draft.direction, graph: graphJson(draft.graph) }, draft.id);
    setDirty(false);
  });
  const problems = templateProblems(draft);

  return (
    <div className="cg">
      <div className="cg-row">
        <label className="wk-field"><span>Nazwa</span><input value={draft.name} disabled={!writes} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="wk-field"><span>Kierunek (część klucza karty)</span><input value={draft.direction} disabled={!writes} placeholder="np. a→b" onChange={(e) => set({ direction: e.target.value })} /></label>
        <fieldset className="cg-row"><legend>Dla rodzajów</legend>
          {lib.kinds.map((k) => (
            <label key={k.id} className="pe-check">
              <input type="checkbox" checked={draft.kinds.includes(k.id)} disabled={!writes} onChange={(e) => set({ kinds: e.target.checked ? [...draft.kinds, k.id] : draft.kinds.filter((x) => x !== k.id) })} />
              <span>{k.name}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <p className="wk-hint">Zmiana kierunku albo pytań zaczyna historię kart od nowa tylko tam, gdzie zmieniła się poprawna odpowiedź.</p>
      <GraphEditor graph={draft.graph} palette={TEMPLATE_PALETTE} fieldKeys={fieldKeys} readOnly={!writes}
        errors={preview === undefined || preview === null ? undefined : preview.errors}
        onChange={(g: Graph) => set({ graph: g })} />
      {problems.map((p, i) => <p key={i} className="wk-warn">{p}</p>)}
      <div className="cg-card">
        <div className="cg-row"><strong>Podgląd na wpisie:</strong>
          <EntityPicker lib={lib} kinds={draft.kinds} value={entity?.id ?? null} onPick={setSample} allowClear={false} />
        </div>
        {entity === undefined ? <span className="wk-hint">Nie ma jeszcze wpisu tego rodzaju.</span>
          : preview === undefined ? <span className="wk-hint">Liczenie…</span>
          : preview === null ? <span className="wk-error">Podgląd się nie udał.</span>
          : (
            <>
              {preview.made.cards.length === 0 && <span className="wk-hint">Z tego wpisu nie powstaje karta (np. puste pole albo warunek niespełniony).</span>}
              <ul>
                {preview.made.cards.slice(0, 20).map((c) => <li key={c.key}>{c.prompt.map((p) => p.text).join(' ') || '(bez treści)'} → <strong>{answerText(c)}</strong> <span className="cg-muted">({c.answer.form}{c.varies ? ', losowa' : ''})</span></li>)}
              </ul>
              {preview.made.problems.map((p, i) => <p key={i} className="wk-warn">{p}</p>)}
            </>
          )}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {writes && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Zapisywanie…' : 'Zapisz szablon'}</button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={async () => { if (await askText('Usunąć szablon? Karty z niego znikną z powtórek (odpowiedzi zostają).')) void run(() => lib.remove(draft.id)); }}>Usuń szablon</button>
        </div>
      )}
    </div>
  );
}
