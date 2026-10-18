/**
 * 2026-10-18 — DIE BEDIENUNG DER CHEMIA (neben oder unter dem Tisch): das
 * Regal (was man in die Hand nimmt, wie viel), die Werkzeuge (Streichholz,
 * Span, Draht, Glasstab, Stopfen, Papier, Thermometer, Sonde …), neue Dinge
 * für den Tisch (Piaskownica), das gewählte Ding (Inhalt, Lupe, Brenner,
 * Heizplatte, Bürette, Kerze), das Protokoll der Beobachtungen und die
 * Schritte eines Versuchs.
 *
 * Werte, die sich in jedem Bild ändern (Temperatur, pH, Druck), schreibt die
 * Schleife (`data-q`); die Zusammensetzung baut React ein paarmal je Sekunde.
 */

import type { MutableRefObject, ReactNode } from 'react';

import { LabSection } from '../LabFrame';
import { GAS_COLORS, INDICATORS, REAGENTS, REAGENT_GROUPS, SPECIES, reagentOf, type Reagent } from './chemData';
import { indicatorColor } from './chemAq';
import type { Sample } from './chemMicro';
import { shares } from './chemMicro';
import type { Step, ToolKey } from './chemSetup';
import { THING_NAME, type Thing, type ThingKind } from './chemThings';
import type { ChemEvent, Summary } from './chemWorld';

export type Hand =
  | { readonly kind: 'reagent'; readonly id: string; readonly amount: number }
  | { readonly kind: 'tool'; readonly tool: ToolKey }
  | { readonly kind: 'thing'; readonly thing: ThingKind; readonly size: number; readonly of?: string }
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
export function HandBar({ hand, onAmount, onDrop }: { hand: Hand; onAmount: (a: number) => void; onDrop: () => void }) {
  if (hand === null) return null;
  const r = hand.kind === 'reagent' ? reagentOf(hand.id) : undefined;
  return (
    <div className="lab-hand" role="status">
      {r !== undefined && hand.kind === 'reagent' && (
        <>
          <span className="lab-hand-what"><Swatch form={r.form} color={swatchOf(r)} /> {r.name}</span>
          <span className="lab-amounts" role="group" aria-label="Ile">
            {r.amounts.map((a) => <button key={a} type="button" className={`lab-chip-btn${a === hand.amount ? ' is-on' : ''}`} aria-pressed={a === hand.amount} onClick={() => onAmount(a)}>{amountText(r, a)}</button>)}
          </span>
          <span className="lab-muted-inline">Dotknij naczynia (albo miejsca na stole), żeby dodać.</span>
        </>
      )}
      {hand.kind === 'tool' && <span className="lab-hand-what">{TOOL_LABEL[hand.tool]} — {TOOL_SAYS[hand.tool]}</span>}
      {hand.kind === 'thing' && <span className="lab-hand-what">Dotknij stołu, żeby postawić: {THING_NAME[hand.thing]}{hand.of !== undefined ? ` (${SPECIES[hand.of]?.name ?? hand.of})` : ''}.</span>}
      <button type="button" className="wk-link-btn" onClick={onDrop}>Odłóż</button>
    </div>
  );
}

/* -- Werkzeuge ---------------------------------------------------------------------------------- */

const stick = (tip: ReactNode) => <><path d="M27 5L9 23" stroke="#c8955a" strokeWidth="3" />{tip}</>;
const TOOL_ICONS: Record<ToolKey, ReactNode> = {
  match: <><path d="M24 26L12 12" stroke="#d9b38c" strokeWidth="2.5" /><circle cx="11" cy="11" r="2.6" fill="#b5332a" /><path d="M10 9c-3-3-1-6 1-8 0 3 3 3 2 6z" fill="#ffb347" /></>,
  splint: stick(<path d="M8 25c-4-3-2-8 1-11 0 4 4 4 3 8-1 2-2 3-4 3z" fill="#ffb347" />),
  glow: stick(<circle cx="8" cy="24" r="3" fill="#ff6a1a" />),
  loop: <><path d="M26 28L14 14" stroke="#9aa0a8" strokeWidth="2" /><circle cx="11" cy="11" r="4" fill="none" stroke="#9aa0a8" strokeWidth="2" /></>,
  stir: <><path d="M7 10v16h18V10" fill="rgba(140,190,230,0.35)" stroke="#5a7a90" /><path d="M24 3L13 25" stroke="#8fb0c8" strokeWidth="2" /></>,
  stopper: <path d="M9 10h14l-2 14h-10z" fill="#8a4b2a" />,
  paper: <><rect x="13" y="3" width="6" height="26" fill="#f7f3e6" stroke="#999" /><rect x="13" y="20" width="6" height="9" fill="#40a040" /></>,
  thermometer: <><path d="M16 4v18" stroke="#9cb6c6" strokeWidth="4" strokeLinecap="round" /><path d="M16 12v12" stroke="#c0392b" strokeWidth="2" /><circle cx="16" cy="25" r="3.5" fill="#c0392b" /></>,
  probe: <><circle cx="16" cy="18" r="6" fill="none" stroke="#c0392b" strokeWidth="2" /><path d="M16 4v8" stroke="#c0392b" strokeWidth="2" /></>,
  empty: <><path d="M8 8l14 4-3 13-11-3z" fill="rgba(140,190,230,0.35)" stroke="#5a7a90" /><path d="M23 13c3 4 3 8 1 12" stroke="#5aa0e0" strokeWidth="2" fill="none" /></>,
  delete: <path d="M8 9h16M12 9V6h8v3M10 9l1 17h10l1-17" stroke="#c0392b" strokeWidth="1.8" fill="none" />
};

export const TOOL_LABEL: Record<ToolKey, string> = {
  match: 'Zapałka', splint: 'Płonące łuczywo', glow: 'Żarzące się łuczywo', loop: 'Drucik', stir: 'Bagietka', stopper: 'Korek',
  paper: 'Papierek wskaźnikowy', thermometer: 'Termometr', probe: 'Sonda', empty: 'Wylej', delete: 'Usuń'
};

const TOOL_SAYS: Record<ToolKey, string> = {
  match: 'dotknij palnika, knota, łuczywa albo miejsca z gazem palnym, żeby zapalić.',
  splint: 'dotknij stołu — łuczywo pojawi się w dłoni; przeciągnij je do wylotu naczynia.',
  glow: 'dotknij stołu — żarzące się łuczywo pojawi się w dłoni; wsuń je do naczynia z gazem.',
  loop: 'dotknij stołu — drucik pojawi się w dłoni; zanurz go w roztworze, potem w płomieniu.',
  stir: 'dotknij naczynia, żeby wymieszać.',
  stopper: 'dotknij naczynia, żeby je zamknąć albo otworzyć.',
  paper: 'dotknij cieczy — pokaże pH.',
  thermometer: 'dotknij naczynia albo miejsca, żeby wstawić termometr.',
  probe: 'dotknij dowolnego miejsca — temperatura (i ciśnienie, pH) w tym punkcie.',
  empty: 'dotknij naczynia, żeby je opróżnić.',
  delete: 'dotknij rzeczy, żeby ją usunąć.'
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

/** Neue Dinge für den Tisch (Piaskownica). */
export const EQUIPMENT: readonly (readonly [ThingKind, number, string, string?])[] = [
  ['beaker', 100, 'zlewka 100'], ['beaker', 250, 'zlewka 250'], ['beaker', 600, 'zlewka 600'], ['flask', 250, 'kolba stożkowa'],
  ['roundflask', 250, 'kolba okrągła'], ['tube', 25, 'probówka'], ['cylinder', 100, 'cylinder'], ['dish', 100, 'parownica'],
  ['crucible', 30, 'tygiel'], ['jar', 500, 'słój'], ['burette', 50, 'biureta'], ['trough', 3000, 'wanna'],
  ['burner', 0, 'palnik'], ['hotplate', 0, 'płyta grzejna'], ['tripod', 0, 'trójnóg z siatką'], ['stand', 0, 'statyw z pierścieniem'],
  ['candle', 0, 'świeca'], ['thermometer', 24, 'termometr'],
  ['rod', 20, 'pręt szklany', 'glass'], ['rod', 20, 'pręt miedziany', 'Cu'], ['rod', 20, 'pręt stalowy', 'steel'], ['rod', 20, 'pręt aluminiowy', 'Al'], ['rod', 20, 'pręt drewniany', 'wood'],
  ['plate', 10, 'płytka szklana']
];

export function Equipment({ hand, onPick }: { hand: Hand; onPick: (kind: ThingKind, size: number, of?: string) => void }) {
  return (
    <div className="lab-chips">
      {EQUIPMENT.map(([kind, size, label, of]) => {
        const on = hand?.kind === 'thing' && hand.thing === kind && hand.size === size && hand.of === of;
        return <button key={label} type="button" className={`lab-chip-btn${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onPick(kind, size, of)}>{label}</button>;
      })}
    </div>
  );
}

/* -- Das gewählte Ding ------------------------------------------------------------------------------ */

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
  readonly act: (what: 'stopper' | 'stir' | 'empty' | 'delete' | 'thermometer' | 'toggle' | 'light' | 'stirrer') => void;
  readonly set: (what: 'air' | 'gas' | 'power' | 'rate', value: number) => void;
}

export function Inspector({ t, sum, sample, show, edit, micro, closed, onAct }: {
  t: Thing; sum: Summary | null; sample: Sample | null; show: { composition: boolean; micro: boolean }; edit: boolean;
  micro: MutableRefObject<HTMLCanvasElement | null>; closed: boolean; onAct: InspectorActions;
}) {
  const container = t.prof !== null;
  const s = show.composition && !t.hidden && sample !== null ? shares(sample) : { gas: [], liquid: [] };
  const solids = sum === null ? [] : [...sum.solids].map(([sp, n]) => [sp, n * (SPECIES[sp]?.M ?? 100)] as const).filter(([, m]) => m > 1e-4);
  const melts = sum === null ? [] : [...sum.melts].map(([sp, n]) => [sp, n * (SPECIES[sp]?.M ?? 100)] as const).filter(([, m]) => m > 1e-4);
  const title = `${t.label || THING_NAME[t.kind]}${container && !t.hidden ? ` · ${THING_NAME[t.kind]} ${t.size} cm³` : ''}`;
  return (
    <LabSection title={title}>
      {container && (
        <div className="lab-values">
          <Live label="Temperatura" q="T" />
          <Live label="Ciecz" q="V" />
          <Live label="pH" q="pH" />
          <Live label="Ciśnienie gazu" q="p" />
        </div>
      )}
      {t.kind === 'thermometer' && <div className="lab-values"><Live label="Termometr" q="T" /></div>}
      {show.composition && !t.hidden && s.gas.length > 0 && (
        <div className="lab-mix">
          <p className="lab-muted">Gaz w naczyniu</p>
          <GasBar parts={s.gas} />
          <ul className="lab-legend">{s.gas.slice(0, 6).map((g) => <li key={g.sp}><Swatch form="dot" color={g.color} />{g.label} <b>{g.value}</b></li>)}</ul>
        </div>
      )}
      {show.composition && !t.hidden && s.liquid.length > 0 && (
        <div className="lab-mix">
          <p className="lab-muted">W roztworze</p>
          <ul className="lab-legend">{s.liquid.map((g) => <li key={g.sp}><Swatch form="dot" color={g.color} />{g.label} <b>{g.value}</b></li>)}</ul>
        </div>
      )}
      {!t.hidden && (solids.length > 0 || melts.length > 0) && (
        <div className="lab-mix">
          <p className="lab-muted">Ciała stałe i stopione</p>
          <ul className="lab-legend">
            {solids.slice(0, 6).map(([sp, m]) => <li key={sp}><Swatch form="dot" color={SPECIES[sp]?.color ?? '#ccc'} />{SPECIES[sp]?.name ?? sp} <b>{(m < 0.01 ? m.toFixed(4) : m.toFixed(2)).replace('.', ',')} g</b></li>)}
            {melts.slice(0, 4).map(([sp, m]) => <li key={`m:${sp}`}><Swatch form="dot" color={SPECIES[sp]?.color ?? '#ccc'} />{SPECIES[sp]?.name ?? sp} (ciekły) <b>{m.toFixed(2).replace('.', ',')} g</b></li>)}
          </ul>
        </div>
      )}
      {container && show.micro && show.composition && !t.hidden && (
        <figure className="lab-micro">
          <canvas ref={micro} aria-label="Pod lupą: cząsteczki gazu i roztworu" />
          <figcaption className="lab-muted">Pod lupą: na górze gaz, na dole roztwór (cząsteczki i jony).</figcaption>
        </figure>
      )}
      {t.kind === 'burner' && (
        <>
          <label className="lab-field">Dopływ powietrza: {Math.round(t.air * 100)}%<input type="range" min={0} max={1} step={0.05} value={t.air} onChange={(e) => onAct.set('air', Number(e.currentTarget.value))} /></label>
          <label className="lab-field">Gaz: {Math.round(t.flow * 100)}%<input type="range" min={0.1} max={1} step={0.05} value={t.flow} onChange={(e) => onAct.set('gas', Number(e.currentTarget.value))} /></label>
          <p className="lab-muted">Zamknięte powietrze — płomień świecący (żółty, kopci); otwarte — nieświecący (niebieski, gorętszy).</p>
        </>
      )}
      {t.kind === 'hotplate' && <label className="lab-field">Moc: {Math.round(t.air)} W<input type="range" min={50} max={1200} step={50} value={t.air} onChange={(e) => onAct.set('power', Number(e.currentTarget.value))} /></label>}
      {t.kind === 'burette' && <label className="lab-field">Szybkość kapania: {t.flow.toFixed(1).replace('.', ',')} cm³/s<input type="range" min={0.1} max={3} step={0.1} value={t.flow} onChange={(e) => onAct.set('rate', Number(e.currentTarget.value))} /></label>}
      <div className="lab-row">
        {t.kind === 'burner' && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.act('toggle')}>{t.on ? 'Zgaś palnik' : 'Zapal palnik'}</button>}
        {t.kind === 'hotplate' && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.act('toggle')}>{t.on ? 'Wyłącz grzanie' : 'Włącz grzanie'}</button>}
        {t.kind === 'hotplate' && <button type="button" className="wk-btn wk-btn-line" aria-pressed={t.stir} onClick={() => onAct.act('stirrer')}>{t.stir ? 'Wyłącz mieszadło' : 'Włącz mieszadło'}</button>}
        {t.kind === 'burette' && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.act('toggle')}>{t.on ? 'Zamknij kranik' : 'Otwórz kranik'}</button>}
        {t.kind === 'candle' && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.act('light')}>{t.on ? 'Zgaś świecę' : 'Zapal świecę'}</button>}
        {container && t.kind !== 'burette' && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.act('stopper')}>{closed ? 'Zdejmij korek' : 'Zamknij korkiem'}</button>}
        {container && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.act('stir')}>Wymieszaj</button>}
        {container && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.act('thermometer')}>Wstaw termometr</button>}
        {edit && container && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.act('empty')}>Wylej</button>}
        {edit && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAct.act('delete')}>Usuń</button>}
      </div>
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

/* -- Protokoll ------------------------------------------------------------------------------------- */

export function Log({ events, equations, names }: { events: readonly ChemEvent[]; equations: boolean; names: (id: string) => string }) {
  const list = events.slice(-40).reverse();
  if (list.length === 0) return <p className="lab-muted">Tu pojawią się obserwacje: gaz, osad, zmiana barwy, topnienie, wrzenie, płomień.</p>;
  return (
    <ol className="lab-log" aria-live="polite">
      {list.map((e, i) => (
        <li key={`${e.key}:${e.t}:${i}`} className={e.text.startsWith('→') ? 'is-act' : ''}>
          <span>{e.thing !== '—' && !e.text.startsWith('→') ? <b>{names(e.thing)}: </b> : null}{e.text}</span>
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
