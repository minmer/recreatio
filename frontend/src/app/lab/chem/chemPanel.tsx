/**
 * 2026-10-18 — DIE BEDIENUNG DER CHEMIA (neben oder unter dem Tisch): das
 * Regal (was man in die Hand nimmt, wie viel), die Werkzeuge, neues Glas
 * (Piaskownica), das gewählte Gefäss (Werte, Zusammensetzung von Gas und
 * Lösung, Feststoffe, Korek, Wymieszaj …, die Lupe), das Protokoll der
 * Beobachtungen mit Gleichungen und die Schritte eines Versuchs.
 *
 * Werte, die sich in jedem Bild ändern (Temperatur, pH, Druck), schreibt die
 * Schleife (`data-q`); die Zusammensetzung baut React ein paarmal je Sekunde.
 */

import type { MutableRefObject, ReactNode } from 'react';

import { LabSection } from '../LabFrame';
import { GAS_COLORS, INDICATORS, REAGENTS, REAGENT_GROUPS, SPECIES, VESSELS, reagentOf, type Reagent, type VesselKind } from './chemData';
import type { Lab, ToolKey } from './chemBench';
import { shares } from './chemMicro';
import type { Step } from './chemScene';
import { indicatorColor, type ChemEvent, type Vessel } from './chemVessel';

export type Hand =
  | { readonly kind: 'reagent'; readonly id: string; readonly amount: number }
  | { readonly kind: 'tool'; readonly tool: ToolKey }
  | { readonly kind: 'vessel'; readonly type: VesselKind | 'burner'; readonly size: number }
  | null;

/* -- Das Regal ---------------------------------------------------------------------------------- */

const SOLUTION_COLOR: Readonly<Record<string, string>> = { CuSO4: '#2f86d6', KMnO4: '#7a1fa2', K2CrO4: '#e6c619', FeCl3: '#d08a1e', FeSO4: '#b9d49a' };

/** Die Farbe eines Reagenzes im Regal. */
export function swatchOf(r: Reagent): string {
  if (r.form === 'indicator') {
    const i = INDICATORS.find((x) => x.id === r.id);
    return i === undefined ? '#888' : indicatorColor(i.stops, i.stops[Math.floor(i.stops.length / 2)][0]);
  }
  if (r.form === 'gas') return GAS_COLORS[r.solid as keyof typeof GAS_COLORS] ?? '#ccc';
  if (r.solid !== undefined) return SPECIES[r.solid]?.color ?? '#ccc';
  /* Eine Lösung hat die Farbe ihres farbigen Ions (sonst: Wasser). */
  return SOLUTION_COLOR[r.solute ?? ''] ?? 'rgba(140,190,230,0.55)';
}

/** Ein Farbfleck (SVG, kein Inline-Stil): Tropfen für Lösungen, Kreis für Feststoffe, Quadrat für Kristalle. */
export function Swatch({ form, color }: { form: Reagent['form'] | 'dot'; color: string }) {
  const liquid = form === 'solution' || form === 'liquid' || form === 'indicator';
  return (
    <svg className={form === 'dot' ? 'lab-dot' : 'lab-swatch'} viewBox="0 0 16 16" aria-hidden="true">
      {liquid ? <path d="M8 1C5 6 3 8.5 3 11a5 5 0 0 0 10 0c0-2.5-2-5-5-10z" fill={color} stroke="rgba(0,0,0,0.25)" />
        : form === 'crystals' ? <rect x="3" y="3" width="10" height="10" fill={color} stroke="rgba(0,0,0,0.25)" transform="rotate(12 8 8)" />
          : form === 'gas' ? <circle cx="8" cy="8" r="6" fill={color} fillOpacity="0.55" stroke="rgba(0,0,0,0.25)" strokeDasharray="2 1.5" />
            : <circle cx="8" cy="8" r={form === 'dot' ? 8 : 6} fill={color} stroke={form === 'dot' ? 'none' : 'rgba(0,0,0,0.25)'} />}
    </svg>
  );
}

const UNIT = (r: Reagent): string => (r.form === 'indicator' ? 'kr.' : r.form === 'solution' || r.form === 'liquid' || r.form === 'gas' ? 'cm³' : 'g');
const amountText = (r: Reagent, a: number): string => `${String(a).replace('.', ',')} ${UNIT(r)}`;

export function Shelf({ ids, hand, onPick }: { ids: readonly string[]; hand: Hand; onPick: (id: string) => void }) {
  const groups = REAGENT_GROUPS.map(([g, label]) => [label, REAGENTS.filter((r) => r.group === g && ids.includes(r.id))] as const).filter(([, list]) => list.length > 0);
  return (
    <div className="lab-shelf">
      {groups.map(([label, list], i) => (
        <details key={label} className="lab-shelf-group" open={i === 0 || groups.length <= 2}>
          <summary>{label} <span className="lab-muted-inline">{list.length}</span></summary>
          <div className="lab-reagents">
            {list.map((r) => (
              <button key={r.id} type="button" className={`lab-reagent${hand?.kind === 'reagent' && hand.id === r.id ? ' is-on' : ''}`} aria-pressed={hand?.kind === 'reagent' && hand.id === r.id} onClick={() => onPick(r.id)} title={r.warn === undefined ? r.name : `${r.name} — ${r.warn}`}>
                <Swatch form={r.form} color={swatchOf(r)} />
                <span className="lab-reagent-name">{r.name}</span>
                {r.warn !== undefined && <span className="lab-warn" aria-label={r.warn}>!</span>}
              </button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

/** Was in der Hand ist: Menge wählen, weglegen. */
export function HandBar({ hand, lab, onAmount, onDrop }: { hand: Hand; lab: Lab; onAmount: (a: number) => void; onDrop: () => void }) {
  if (hand === null && lab.spoon === null && lab.loop === null) return null;
  const r = hand?.kind === 'reagent' ? reagentOf(hand.id) : undefined;
  return (
    <div className="lab-hand" role="status">
      {r !== undefined && hand?.kind === 'reagent' && (
        <>
          <span className="lab-hand-what"><Swatch form={r.form} color={swatchOf(r)} /> {r.name}</span>
          <span className="lab-amounts" role="group" aria-label="Ile">
            {r.amounts.map((a) => <button key={a} type="button" className={`lab-chip-btn${a === hand.amount ? ' is-on' : ''}`} aria-pressed={a === hand.amount} onClick={() => onAmount(a)}>{amountText(r, a)}</button>)}
          </span>
          <span className="lab-muted-inline">Dotknij naczynia, żeby dodać.</span>
        </>
      )}
      {hand?.kind === 'tool' && <span className="lab-hand-what">{TOOL_LABEL[hand.tool]} — {TOOL_SAYS[hand.tool]}</span>}
      {hand?.kind === 'vessel' && <span className="lab-hand-what">Dotknij stołu, żeby postawić: {hand.type === 'burner' ? 'palnik' : `${VESSELS[hand.type].name} ${hand.size} cm³`}.</span>}
      {lab.spoon !== null && <span className="lab-hand-what">Na łyżeczce: {SPECIES[lab.spoon.sp]?.name}{lab.spoon.burning ? ' (płonie)' : ''}.</span>}
      {lab.loop !== null && <span className="lab-hand-what">Na druciku: {SPECIES[lab.loop.ion]?.name} — dotknij palnika.</span>}
      {hand !== null && <button type="button" className="wk-link-btn" onClick={onDrop}>Odłóż</button>}
    </div>
  );
}

/* -- Werkzeuge ---------------------------------------------------------------------------------- */

const stick = (tip: ReactNode) => <><path d="M27 5L9 23" stroke="#c8955a" strokeWidth="3" />{tip}</>;
const TOOL_ICONS: Record<ToolKey, ReactNode> = {
  glow: stick(<circle cx="8" cy="24" r="3" fill="#ff6a1a" />),
  splint: stick(<path d="M8 25c-4-3-2-8 1-11 0 4 4 4 3 8-1 2-2 3-4 3z" fill="#ffb347" />),
  match: <><path d="M24 26L12 12" stroke="#d9b38c" strokeWidth="2.5" /><circle cx="11" cy="11" r="2.6" fill="#b5332a" /><path d="M10 9c-3-3-1-6 1-8 0 3 3 3 2 6z" fill="#ffb347" /></>,
  paper: <><rect x="13" y="3" width="6" height="26" fill="#f7f3e6" stroke="#999" /><rect x="13" y="20" width="6" height="9" fill="#40a040" /></>,
  wetpaper: <><rect x="13" y="3" width="6" height="26" fill="#f7f3e6" stroke="#999" /><rect x="13" y="3" width="6" height="8" fill="#2878c8" /><path d="M24 18c-2 3 2 3 0 0z" fill="#5aa0e0" /></>,
  loop: <><path d="M26 28L14 14" stroke="#9aa0a8" strokeWidth="2" /><circle cx="11" cy="11" r="4" fill="none" stroke="#9aa0a8" strokeWidth="2" /></>,
  stir: <><path d="M7 10v16h18V10" fill="rgba(140,190,230,0.35)" stroke="#5a7a90" /><path d="M24 3L13 25" stroke="#8fb0c8" strokeWidth="2" /></>,
  stopper: <path d="M9 10h14l-2 14h-10z" fill="#8a4b2a" />,
  gauge: <><path d="M9 4v18a4 4 0 0 0 8 0V4" stroke="#5a7a90" strokeWidth="2" fill="none" /><path d="M9 14v8a4 4 0 0 0 8 0V9" stroke="#3c78dc" strokeWidth="2" fill="none" /></>,
  tube: <path d="M6 26V8h20v18" stroke="#5a7a90" strokeWidth="2.4" fill="none" />,
  spoon: <><path d="M24 3v20" stroke="#7d8289" strokeWidth="2" /><path d="M18 23h12a6 4 0 0 1-12 0z" fill="#7d8289" /></>,
  probe: <><circle cx="16" cy="18" r="6" fill="none" stroke="#c0392b" strokeWidth="2" /><path d="M16 4v8" stroke="#c0392b" strokeWidth="2" /></>,
  empty: <><path d="M8 8l14 4-3 13-11-3z" fill="rgba(140,190,230,0.35)" stroke="#5a7a90" /><path d="M23 13c3 4 3 8 1 12" stroke="#5aa0e0" strokeWidth="2" fill="none" /></>,
  delete: <path d="M8 9h16M12 9V6h8v3M10 9l1 17h10l1-17" stroke="#c0392b" strokeWidth="1.8" fill="none" />
};

export const TOOL_LABEL: Record<ToolKey, string> = {
  glow: 'Żarzące się łuczywo', splint: 'Płonące łuczywo', match: 'Zapałka', paper: 'Papierek wskaźnikowy', wetpaper: 'Wilgotny papierek',
  loop: 'Drucik', stir: 'Bagietka', stopper: 'Korek', gauge: 'Manometr', tube: 'Rurka', spoon: 'Łyżeczka do spalań', probe: 'Sonda ciśnienia', empty: 'Wylej', delete: 'Usuń'
};

const TOOL_SAYS: Record<ToolKey, string> = {
  glow: 'dotknij naczynia: w tlenie łuczywo się zapala.',
  splint: 'dotknij naczynia: wodór spala się z trzaskiem, w CO₂ płomień gaśnie.',
  match: 'zapal świeczkę, palnik, etanol albo siarkę.',
  paper: 'dotknij naczynia z cieczą — pokaże pH.',
  wetpaper: 'dotknij naczynia — zbada gaz u wylotu.',
  loop: 'zanurz w roztworze, potem dotknij palnika (próba płomieniowa).',
  stir: 'dotknij naczynia, żeby wymieszać.',
  stopper: 'dotknij naczynia, żeby je zamknąć albo otworzyć.',
  gauge: 'dotknij naczynia: korek z manometrem.',
  tube: 'dotknij naczynia z gazem, potem drugiego — gaz popłynie rurką.',
  spoon: 'nabierz suchą substancję, zapal ją w palniku i wprowadź do innego naczynia.',
  probe: 'dotknij cieczy — ciśnienie na tej głębokości.',
  empty: 'dotknij naczynia, żeby je opróżnić.',
  delete: 'dotknij naczynia albo palnika, żeby je usunąć.'
};

export function Tools({ tools, hand, onPick }: { tools: readonly ToolKey[]; hand: Hand; onPick: (t: ToolKey) => void }) {
  return (
    <div className="lab-palette">
      {tools.map((t) => {
        const on = hand?.kind === 'tool' && hand.tool === t;
        return (
          <button key={t} type="button" className={`lab-item${on ? ' is-on' : ''}`} aria-pressed={on} title={`${TOOL_LABEL[t]}: ${TOOL_SAYS[t]}`} onClick={() => onPick(t)}>
            <svg viewBox="0 0 32 32" aria-hidden="true">{TOOL_ICONS[t]}</svg>
            <span>{TOOL_LABEL[t]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Neues Glas und Geräte (Piaskownica). */
export function Equipment({ hand, onPick }: { hand: Hand; onPick: (type: VesselKind | 'burner', size: number) => void }) {
  const items: [VesselKind | 'burner', number, string][] = [
    ['beaker', 100, 'zlewka 100'], ['beaker', 250, 'zlewka 250'], ['beaker', 600, 'zlewka 600'], ['flask', 250, 'kolba stożkowa'], ['roundflask', 250, 'kolba okrągła'],
    ['tube', 25, 'probówka'], ['cylinder', 100, 'cylinder'], ['dish', 50, 'parownica'], ['crucible', 30, 'tygiel'], ['jar', 1000, 'słój'], ['burette', 50, 'biureta'], ['syringe', 100, 'strzykawka'], ['burner', 0, 'palnik']
  ];
  return (
    <div className="lab-chips">
      {items.map(([type, size, label]) => {
        const on = hand?.kind === 'vessel' && hand.type === type && hand.size === size;
        return <button key={label} type="button" className={`lab-chip-btn${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onPick(type, size)}>{label}</button>;
      })}
    </div>
  );
}

/* -- Das gewählte Gefäss ------------------------------------------------------------------------------ */

/** Ein Wert, den die Schleife schreibt (`data-q`). */
function Live({ label, q }: { label: string; q: string }) {
  return (
    <div className="lab-value">
      <span>{label}</span>
      <output data-q={q} />
    </div>
  );
}

export interface InspectorActions {
  readonly toggle: (what: 'stopper' | 'gauge' | 'stir' | 'empty' | 'delete' | 'burner' | 'air' | 'drip') => void;
  readonly rate: (mlPerSecond: number) => void;
}

export function Inspector({ v, lab, show, edit, micro, onAct }: {
  v: Vessel; lab: Lab; show: { composition: boolean; micro: boolean }; edit: boolean;
  micro: MutableRefObject<HTMLCanvasElement | null>; onAct: InspectorActions;
}) {
  const s = show.composition && !v.hidden ? shares(v) : { gas: [], liquid: [] };
  const burner = lab.burnerOf(v);
  const solids = v.lumps.filter((l) => l.mass() > 1e-4 && l.form !== 'candle');
  return (
    <LabSection title={`${v.label || v.type.name}${v.hidden ? '' : ` · ${v.type.name} ${v.size} cm³`}`}>
      <div className="lab-values">
        <Live label="Temperatura" q="T" />
        {v.kind === 'syringe' ? <Live label="Gaz w strzykawce" q="gas" /> : <Live label="Ciecz" q="V" />}
        {v.kind !== 'syringe' && <Live label="pH" q="pH" />}
        <Live label="Ciśnienie gazu" q="p" />
      </div>
      {show.composition && !v.hidden && s.gas.length > 0 && (
        <div className="lab-mix">
          <p className="lab-muted">Gaz w naczyniu</p>
          <GasBar parts={s.gas} />
          <ul className="lab-legend">{s.gas.slice(0, 6).map((g) => <li key={g.sp}><Swatch form="dot" color={g.color} />{g.label} <b>{g.value}</b></li>)}</ul>
        </div>
      )}
      {show.composition && !v.hidden && s.liquid.length > 0 && (
        <div className="lab-mix">
          <p className="lab-muted">W roztworze</p>
          <ul className="lab-legend">{s.liquid.map((g) => <li key={g.sp}><Swatch form="dot" color={g.color} />{g.label} <b>{g.value}</b></li>)}</ul>
        </div>
      )}
      {!v.hidden && solids.length > 0 && (
        <div className="lab-mix">
          <p className="lab-muted">Ciała stałe</p>
          <ul className="lab-legend">{solids.slice(0, 6).map((l) => <li key={l.id}><Swatch form="dot" color={SPECIES[l.sp]?.color ?? '#ccc'} />{SPECIES[l.sp]?.name ?? l.sp} <b>{(l.mass() < 0.01 ? l.mass().toFixed(4) : l.mass().toFixed(2)).replace('.', ',')} g</b>{l.burning ? ' 🔥' : ''}</li>)}</ul>
        </div>
      )}
      {show.micro && show.composition && !v.hidden && (
        <figure className="lab-micro">
          <canvas ref={micro} aria-label="Pod lupą: cząsteczki gazu i roztworu" />
          <figcaption className="lab-muted">Pod lupą: na górze gaz, na dole roztwór (cząsteczki i jony).</figcaption>
        </figure>
      )}
      <div className="lab-row">
        {v.kind !== 'syringe' && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.toggle('stopper')}>{v.closed ? 'Zdejmij korek' : 'Zamknij korkiem'}</button>}
        {v.kind !== 'syringe' && v.kind !== 'burette' && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.toggle('stir')}>Wymieszaj</button>}
        {burner !== null && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.toggle('burner')}>{burner.on ? 'Zgaś palnik' : 'Zapal palnik'}</button>}
        {v.kind === 'burette' && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.toggle('drip')}>{v.drip > 0 ? 'Zamknij kranik' : 'Otwórz kranik'}</button>}
        {edit && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.toggle('empty')}>Wylej</button>}
        {edit && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.toggle('delete')}>Usuń</button>}
      </div>
      {v.kind === 'burette' && (
        <label className="lab-field">
          Szybkość kapania: {(v.drip > 0 ? v.drip : 0.5).toFixed(1).replace('.', ',')} cm³/s
          <input type="range" min={0.1} max={3} step={0.1} value={v.drip > 0 ? v.drip : 0.5} onChange={(e) => onAct.rate(Number(e.currentTarget.value))} />
        </label>
      )}
    </LabSection>
  );
}

/** Die Anteile des Gases als ein Streifen (SVG). */
function GasBar({ parts }: { parts: readonly { sp: string; label: string; color: string; value: string }[] }) {
  const w = parts.map((g) => Math.max(0.6, parseFloat(g.value.replace(',', '.'))));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  let x = 0;
  return (
    <svg className="lab-gasbar" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label={parts.map((g) => `${g.label} ${g.value}`).join(', ')}>
      {parts.map((g, i) => { const width = (w[i] / sum) * 100; const r = <rect key={g.sp} x={x} y="0" width={width} height="6" fill={g.color} />; x += width; return r; })}
    </svg>
  );
}

/** Der gewählte Brenner. */
export function BurnerPanel({ on, air, onToggle, onAir }: { on: boolean; air: boolean; onToggle: () => void; onAir: () => void }) {
  return (
    <LabSection title="Palnik">
      <div className="lab-row">
        <button type="button" className="wk-btn wk-btn-line" onClick={onToggle}>{on ? 'Zgaś' : 'Zapal'}</button>
        <button type="button" className="wk-btn wk-btn-line" title={air ? 'Płomień stanie się świecący (żółty) i chłodniejszy' : 'Płomień stanie się nieświecący (niebieski) i gorętszy'} onClick={onAir}>{air ? 'Zamknij powietrze' : 'Otwórz powietrze'}</button>
      </div>
      <p className="lab-muted">Postaw naczynie na trójnogu nad palnikiem (przeciągnij je), żeby je ogrzać.</p>
    </LabSection>
  );
}

/* -- Protokoll ------------------------------------------------------------------------------------- */

export function Log({ events, equations }: { events: readonly ChemEvent[]; equations: boolean }) {
  const list = events.slice(-40).reverse();
  if (list.length === 0) return <p className="lab-muted">Tu pojawią się obserwacje: gaz, osad, zmiana barwy, temperatura.</p>;
  return (
    <ol className="lab-log" aria-live="polite">
      {list.map((e, i) => (
        <li key={`${e.key}:${e.t}:${i}`} className={e.key.startsWith('act:') ? 'is-act' : ''}>
          <span>{e.text}</span>
          {equations && e.eq !== undefined && <span className="lab-eq">{e.eq}</span>}
        </li>
      ))}
    </ol>
  );
}

/* -- Schritte --------------------------------------------------------------------------------------- */

export function StepsPanel({ steps, at, showing, picked, right, onShow, onNext, onAnswer }: {
  steps: readonly Step[]; at: number; showing: boolean;
  /** Gewählte Antwort je Schritt; die richtige (−1: Meinung). */
  picked: Readonly<Record<number, number>>; right: (i: number) => number;
  onShow: () => void; onNext: () => void; onAnswer: (step: number, option: number) => void;
}) {
  if (steps.length === 0) return null;
  const step = steps[at];
  const waiting = step?.ask !== null && step?.ask !== undefined && picked[at] === undefined;
  return (
    <LabSection title="Kroki doświadczenia">
      <ol className="lab-steps">
        {steps.map((s, i) => <li key={i} className={i === at ? 'is-now' : i < at ? 'is-done' : ''}>{s.say || s.ask?.q}</li>)}
      </ol>
      {step?.ask !== null && step?.ask !== undefined && (
        <div className="lab-ask" role="group" aria-label={step.ask.q}>
          <p className="lab-text"><b>{step.ask.q}</b></p>
          <div className="lab-chips">
            {step.ask.options.map((o, k) => {
              const chosen = picked[at] === k;
              const good = right(at);
              const mark = picked[at] === undefined ? '' : k === good ? ' is-right' : chosen ? ' is-wrong' : '';
              return <button key={k} type="button" className={`lab-chip-btn${chosen ? ' is-on' : ''}${mark}`} disabled={picked[at] !== undefined} onClick={() => onAnswer(at, k)}>{o}</button>;
            })}
          </div>
          {picked[at] !== undefined && (
            <p className="lab-muted" role="status">{right(at) < 0 ? '' : picked[at] === right(at) ? 'Dobrze! ' : 'Nie tym razem. '}{step.ask.why}</p>
          )}
        </div>
      )}
      <div className="lab-row">
        <button type="button" className="wk-btn" disabled={showing || waiting} onClick={onShow}>{at === 0 ? 'Pokaż' : 'Pokaż dalej'}</button>
        <button type="button" className="wk-btn wk-btn-line" disabled={at >= steps.length || waiting} onClick={onNext}>{at >= steps.length ? 'Koniec' : 'Następny krok'}</button>
      </div>
    </LabSection>
  );
}
