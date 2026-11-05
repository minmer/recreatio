/**
 * COGITA — SPIEL IM GELÄNDE (COGITA.md §11): die Regeln bauen (Zonen auf der
 * Karte, Werte, Auslöser), das Spiel führen (wer wo ist — nur der Gastgeber
 * sieht es —, was ausgelöst hat, verdächtige Sprünge), und mitspielen.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { changeValue, loadGame, postPosition, suspicions, TRIGGER_LABEL, watchPlace, type GameAction, type GameRules, type GameValue, type GameView, type Position, type Trigger, type Zone } from './game';
import { GeoMap } from './GeoMap';
import type { Credentials, SessionEvent } from './live';
import { fmtDate, useT } from '../core/i18n';
import { useBusy } from './ui';
import { Loading } from '../ui/Loading';

/* -- Die Regeln bauen ---------------------------------------------------------------------- */

export function GameRulesEditor({ rules, steps, writes, onChange }: { rules: GameRules; steps: readonly { id: string; label: string }[]; writes: boolean; onChange: (r: GameRules) => void }) {
  const t = useT();
  const [zoneRadius, setZoneRadius] = useState(30);
  const set = (patch: Partial<GameRules>) => onChange({ ...rules, ...patch });
  const setZone = (i: number, patch: Partial<Zone>) => set({ zones: rules.zones.map((z, j) => (j === i ? { ...z, ...patch } : z)) });
  const setValue = (i: number, patch: Partial<GameValue>) => set({ values: rules.values.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const setTrigger = (i: number, patch: Partial<Trigger>) => set({ triggers: rules.triggers.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <div className="cg">
      <p className="wk-hint">{t('cogitaViewsRewards.panel.privacy')}</p>
      <div className="cg-row">
        <span className="cg-muted">{t('cogitaViewsRewards.panel.clickMap')}</span>
        <input type="number" value={zoneRadius} min={5} max={5000} onChange={(e) => setZoneRadius(Number(e.target.value))} aria-label={t('cogitaViewsRewards.panel.radius')} /> m
      </div>
      <GeoMap circles={rules.zones.map((z) => ({ lat: z.lat, lon: z.lon, radius: z.radius, label: z.id }))}
        marks={rules.zones.map((z) => ({ lat: z.lat, lon: z.lon, kind: 'dot' as const, label: z.id }))}
        onPick={writes ? (at) => set({ zones: [...rules.zones, { id: `strefa${rules.zones.length + 1}`, lat: Number(at.lat.toFixed(6)), lon: Number(at.lon.toFixed(6)), radius: zoneRadius }] }) : undefined} />
      <table className="cg-table">
        <thead><tr><th>{t('cogitaViewsRewards.panel.zone')}</th><th>{t('cogitaViewsRewards.panel.radius')}</th><th>{t('common.from')}</th><th>{t('common.to')}</th><th /></tr></thead>
        <tbody>
          {rules.zones.map((z, i) => (
            <tr key={i}>
              <td><input value={z.id} disabled={!writes} onChange={(e) => setZone(i, { id: e.target.value })} /></td>
              <td><input type="number" value={z.radius} disabled={!writes} onChange={(e) => setZone(i, { radius: Number(e.target.value) })} /></td>
              <td><input type="datetime-local" value={z.from?.slice(0, 16) ?? ''} disabled={!writes} onChange={(e) => setZone(i, { from: e.target.value || undefined })} /></td>
              <td><input type="datetime-local" value={z.to?.slice(0, 16) ?? ''} disabled={!writes} onChange={(e) => setZone(i, { to: e.target.value || undefined })} /></td>
              <td>{writes && <button type="button" className="wk-link-btn" onClick={() => set({ zones: rules.zones.filter((_, j) => j !== i) })}>×</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>{t('cogitaViewsRewards.panel.values')}</h4>
      {rules.values.map((v, i) => (
        <div key={i} className="cg-row">
          <input value={v.id} disabled={!writes} onChange={(e) => setValue(i, { id: e.target.value })} />
          <select value={v.scope} disabled={!writes} onChange={(e) => setValue(i, { scope: e.target.value as GameValue['scope'] })}>
            <option value="player">{t('cogitaViewsRewards.panel.scopePlayer')}</option><option value="team">{t('cogitaViewsRewards.panel.scopeTeam')}</option><option value="session">{t('cogitaViewsRewards.panel.scopeSession')}</option>
          </select>
          <input type="number" value={v.initial} disabled={!writes} onChange={(e) => setValue(i, { initial: Number(e.target.value) })} aria-label={t('cogitaViewsRewards.panel.initial')} />
          <input type="number" value={v.min ?? ''} placeholder={t('cogitaViewsRewards.panel.min')} disabled={!writes} onChange={(e) => setValue(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <input type="number" value={v.max ?? ''} placeholder={t('cogitaViewsRewards.panel.max')} disabled={!writes} onChange={(e) => setValue(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
          {writes && <button type="button" className="wk-link-btn" onClick={() => set({ values: rules.values.filter((_, j) => j !== i) })}>×</button>}
        </div>
      ))}
      {writes && <button type="button" className="wk-link-btn" onClick={() => set({ values: [...rules.values, { id: `punkty${rules.values.length === 0 ? '' : rules.values.length + 1}`, scope: 'team', initial: 0 }] })}>{t('cogitaViewsRewards.panel.addValue')}</button>}

      <h4>{t('cogitaViewsRewards.panel.triggers')}</h4>
      {rules.triggers.map((tr, i) => (
        <div key={i} className="cg-card">
          <div className="cg-row">
            <input value={tr.id} disabled={!writes} onChange={(e) => setTrigger(i, { id: e.target.value })} />
            <select value={tr.on} disabled={!writes} onChange={(e) => setTrigger(i, { on: e.target.value as Trigger['on'] })}>
              {(Object.keys(TRIGGER_LABEL) as Trigger['on'][]).map((o) => <option key={o} value={o}>{TRIGGER_LABEL[o]}</option>)}
            </select>
            {tr.on !== 'every' && (
              <select value={tr.zone ?? ''} disabled={!writes} onChange={(e) => setTrigger(i, { zone: e.target.value || undefined })}>
                <option value="">{t('cogitaViewsRewards.panel.zonePick')}</option>
                {rules.zones.map((z) => <option key={z.id} value={z.id}>{z.id}</option>)}
              </select>
            )}
            {tr.on === 'present' && <input type="number" value={tr.count ?? 2} min={1} disabled={!writes} onChange={(e) => setTrigger(i, { count: Number(e.target.value) })} aria-label={t('cogitaViewsRewards.panel.howMany')} />}
            {tr.on === 'every' && <input type="number" value={tr.seconds ?? 60} min={5} disabled={!writes} onChange={(e) => setTrigger(i, { seconds: Number(e.target.value) })} aria-label={t('cogitaViewsRewards.panel.everySeconds')} />}
            <label className="pe-check"><input type="checkbox" checked={tr.once} disabled={!writes} onChange={(e) => setTrigger(i, { once: e.target.checked })} /><span>{t('cogitaViewsRewards.panel.once')}</span></label>
            <input value={tr.team ?? ''} placeholder={t('cogitaViewsRewards.panel.onlyTeam')} disabled={!writes} onChange={(e) => setTrigger(i, { team: e.target.value || undefined })} />
            {writes && <button type="button" className="wk-link-btn" onClick={() => set({ triggers: rules.triggers.filter((_, j) => j !== i) })}>×</button>}
          </div>
          <TriggerActions actions={tr.actions} values={rules.values} steps={steps} writes={writes} onChange={(actions) => setTrigger(i, { actions })} />
        </div>
      ))}
      {writes && <button type="button" className="wk-link-btn" onClick={() => set({ triggers: [...rules.triggers, { id: `wyzwalacz${rules.triggers.length + 1}`, on: 'enter', zone: rules.zones[0]?.id, once: true, actions: [] }] })}>{t('cogitaViewsRewards.panel.addTrigger')}</button>}
    </div>
  );
}

function TriggerActions({ actions, values, steps, writes, onChange }: { actions: readonly GameAction[]; values: readonly GameValue[]; steps: readonly { id: string; label: string }[]; writes: boolean; onChange: (a: GameAction[]) => void }) {
  const t = useT();
  const set = (i: number, patch: Partial<GameAction>) => onChange(actions.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <div className="cg-actions">
      {actions.map((a, i) => (
        <div key={i} className="cg-cond-row">
          <select value={a.do} disabled={!writes} onChange={(e) => set(i, { do: e.target.value as GameAction['do'] })}>
            <option value="add">{t('cogitaViewsRewards.panel.doAdd')}</option><option value="set">{t('cogitaViewsRewards.panel.doSet')}</option><option value="open">{t('cogitaViewsRewards.panel.doOpen')}</option><option value="notice">{t('cogitaViewsRewards.panel.doNotice')}</option>
          </select>
          {(a.do === 'add' || a.do === 'set') && (
            <>
              <select value={a.value ?? ''} disabled={!writes} onChange={(e) => set(i, { value: e.target.value })}>
                <option value="">{t('cogitaViewsRewards.panel.valuePick')}</option>
                {values.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
              </select>
              <input type="number" value={a.do === 'add' ? a.by ?? 1 : a.to ?? 0} disabled={!writes} onChange={(e) => set(i, a.do === 'add' ? { by: Number(e.target.value) } : { to: Number(e.target.value) })} />
              <select value={a.target ?? ''} disabled={!writes} onChange={(e) => set(i, { target: (e.target.value || undefined) as GameAction['target'] })}>
                <option value="">{t('cogitaViewsRewards.panel.toValue')}</option><option value="each">{t('cogitaViewsRewards.panel.toEach')}</option>
              </select>
            </>
          )}
          {(a.do === 'open' || a.do === 'notice') && (
            <select value={a.step ?? ''} disabled={!writes} onChange={(e) => set(i, { step: e.target.value })}>
              <option value="">{t('cogitaViewsRewards.panel.stepPick')}</option>
              {steps.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
          {writes && <button type="button" className="wk-link-btn" onClick={() => onChange(actions.filter((_, j) => j !== i))}>×</button>}
        </div>
      ))}
      {writes && <button type="button" className="wk-link-btn" onClick={() => onChange([...actions, { do: 'add', value: values[0]?.id, by: 10 }])}>{t('cogitaViewsRewards.panel.addAction')}</button>}
    </div>
  );
}

/* -- Das Spiel führen ----------------------------------------------------------------------- */

export function GameHost({ sessionId, cred, events }: { sessionId: string; cred: Credentials; events: readonly SessionEvent[] }) {
  const t = useT();
  const [view, setView] = useState<GameView | null>(null);
  const track = useRef(new Map<string, Position[]>());
  const { busy, failed, run } = useBusy();
  useEffect(() => {
    let alive = true;
    const pull = () => loadGame(sessionId, cred).then((v) => {
      if (!alive) return;
      setView(v);
      for (const p of v.positions ?? []) {
        const list = track.current.get(p.player) ?? [];
        if (list[list.length - 1]?.at !== p.at) track.current.set(p.player, [...list.slice(-30), p]);
      }
    }, () => undefined);
    void pull();
    const timer = window.setInterval(pull, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [sessionId, cred]);
  const triggers = events.filter((e) => e.kind === 'trigger').slice(-20).reverse();
  const odd = useMemo(() => suspicions(track.current), [view]);
  if (view === null) return <Loading label={t('cogitaViewsRewards.panel.loading')} />;
  if (!view.running) return <p className="wk-hint">{t('cogitaViewsRewards.panel.noRules')}</p>;
  const zones = view.rules?.zones ?? [];
  const values = view.state?.values ?? {};
  return (
    <div className="cg">
      <GeoMap circles={zones.map((z) => ({ lat: z.lat, lon: z.lon, radius: z.radius, label: z.id }))}
        marks={(view.positions ?? []).map((p) => ({ lat: p.lat, lon: p.lon, kind: 'dot' as const, label: `${p.player}${p.team ? ` (${p.team})` : ''}` }))} height="24rem" /> {/* i18n-ignore */}
      {odd.length > 0 && <p className="wk-warn">{t('cogitaViewsRewards.panel.suspicious', { list: odd.map((s) => `${s.player} — ${s.why}`).join('; ') })}</p>}
      <div className="cg-grid">
        {Object.entries(values).map(([target, bag]) => (
          <div key={target} className="cg-card">
            <strong>{target.startsWith('player:') ? t('cogitaViewsRewards.panel.targetPlayer', { name: target.slice(7) }) : target.startsWith('team:') ? t('cogitaViewsRewards.panel.targetTeam', { name: target.slice(5) }) : target === 'session' ? t('cogitaViewsRewards.panel.targetSession') : target}</strong>
            {Object.entries(bag).map(([k, v]) => (
              <span key={k} className="cg-row">{k}: <strong>{v}</strong>
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => changeValue(sessionId, k, target, { by: 1 }))}>+1</button>
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => changeValue(sessionId, k, target, { by: -1 }))}>−1</button>
              </span>
            ))}
          </div>
        ))}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <details>
        <summary>{t('cogitaViewsRewards.panel.happened', { count: triggers.length })}</summary>
        <ul className="cg-muted">
          {triggers.map((e) => <li key={e.seq}>{fmtDate(new Date(e.createdAt), { hour: '2-digit', minute: '2-digit', second: '2-digit' }, t.lang)} · {e.plain}</li>)}
        </ul>
      </details>
    </div>
  );
}

/* -- Mitspielen ------------------------------------------------------------------------------- */

/** Die Stelle melden, solange das Spiel läuft; was ausgelöst hat und für mich gilt, öffnet den Schritt. */
export function GamePlay({ sessionId, cred, player, team, events, onOpen }: {
  sessionId: string;
  cred: Credentials;
  player: string;
  team: string | null;
  events: readonly SessionEvent[];
  onOpen: (step: string) => void;
}) {
  const t = useT();
  const [problem, setProblem] = useState<string | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const opened = useRef(new Set<number>());
  useEffect(() => watchPlace((pos) => {
    setMe({ lat: pos.lat, lon: pos.lon });
    void postPosition(sessionId, cred, { player, team, ...pos }).catch((e: unknown) => setProblem(e instanceof Error ? e.message : t('cogitaViewsRewards.panel.sendFailed')));
  }, setProblem), [sessionId, cred, player, team]);
  useEffect(() => {
    let alive = true;
    const pull = () => loadGame(sessionId, cred, player, team ?? undefined).then((v) => { if (alive) setView(v); }, () => undefined);
    void pull();
    const timer = window.setInterval(pull, 10_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [sessionId, cred, player, team]);
  useEffect(() => {
    for (const e of events) {
      if (e.kind !== 'trigger' || e.plain === null || opened.current.has(e.seq)) continue;
      opened.current.add(e.seq);
      try {
        const fired = JSON.parse(e.plain) as { player?: string; team?: string; actions?: { do?: string; step?: string; target?: string }[] };
        const forMe = fired.player === undefined ? fired.team === undefined || fired.team === team : fired.player === player;
        if (!forMe) continue;
        const open = (fired.actions ?? []).find((a) => a.do === 'open' && typeof a.step === 'string');
        if (open?.step !== undefined) onOpen(open.step);
      } catch { /* übergehen */ }
    }
  }, [events, player, team, onOpen]);
  const zones = view?.rules?.zones ?? [];
  const mine = view?.values ?? {};
  return (
    <div className="cg">
      <GeoMap center={me ?? undefined} zoom={16} circles={zones.map((z) => ({ lat: z.lat, lon: z.lon, radius: z.radius, label: z.id }))}
        marks={me === null ? [] : [{ ...me, kind: 'dot' }]} height="18rem" />
      {problem !== null && <p className="wk-warn">{problem}</p>}
      <div className="cg-row">
        {Object.entries(mine).flatMap(([target, bag]) => Object.entries(bag).map(([k, v]) => <span key={`${target}${k}`} className="cg-tag">{target.startsWith('team:') ? t('cogitaViewsRewards.panel.team') : target === 'session' ? t('cogitaViewsRewards.panel.everyone') : t('cogitaViewsRewards.panel.you')} · {k}: {v}</span>))}
        {(view?.inside ?? []).length > 0 && <span className="cg-tag is-ok">{t('cogitaViewsRewards.panel.inZone', { list: (view?.inside ?? []).join(', ') })}</span>}
      </div>
    </div>
  );
}
