/**
 * 2026-11-02 — NAUKA → NAGRODY (die Regel: `rewards.ts`, die Tafel: `RewardViews.tsx`).
 *
 * <b>Für jeden</b>: die eigene Tafel — Punkte, Stufe, Serie, Tagesziel, Abzeichen, die letzten Nagrody — nach der Regel,
 * die in der Nauka gilt (Ustawienia → Motywacja „Punkty i nagrody", gewählt oder die erste, sonst die eingebaute).
 *
 * <b>Für Autoren</b>: die Dokumente „Nagrody" dieser Baza — aus einem fertigen Anfang, dann mit Zahlen geändert: Punkte
 * je Ereignis, wann eine Karte utrwalona ist, Tagesziel und Einheit, was einen Tag der Serie macht, Stufen, Abzeichen —
 * und dasselbe als JSON. Darunter, live, die eigenen Punkte nach der Regel, wie sie gerade im Editor steht.
 * „Użyj w Nauce" macht sie zur Regel der Nauka; Bausteine auf Seiten wählen ihre eigene.
 *
 * 2026-11-05 (Prompt 17) — <b>„Odznaki i poziomy"</b> (`nagrody/odznaki`, `BadgesPage.tsx`): statt Tafel und Dokumenten die
 * Seite der eigenen Abzeichen und Stufen — mit den zuletzt gemessenen Massen der Karte (`mapMeasures.ts`); was davon eben
 * erreicht ist, bekommt sein Datum (`Learner.keepAwards`). Im Editor: die Masse der Karte und die Art eines Abzeichens.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { askText } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { BadgesPage } from './BadgesPage';
import { baseLang, rewardWords, type Lang } from './lang';
import type { Learner } from './learn';
import { holderKey, renamer } from './learn';
import { mapMeasuresOf } from './mapMeasures';
import {
  BADGE_ICONS, BADGE_KINDS, badgeKindOf, describeRewards, GOAL_UNIT_LABEL, GOAL_UNITS, isExtraMeasure, MEASURE_LABEL, POINT_KINDS, POINT_LABEL, readRewards, REWARD_MEASURES,
  REWARD_PRESETS, rewardsData, rewardsFor, type BadgeIcon, type BadgeKind, type ExtraMeasures, type GoalUnit, type PointKind, type RewardBadge, type RewardMeasure, type RewardRules
} from './rewards';
import { RewardBoard, RewardIcon } from './RewardViews';
import type { CogitaLibrary } from './store';
import { OriginTag, useBusy, useCtx } from './ui';

/** 2026-11-05 (Prompt 17) — das Wort der Seite „Odznaki i poziomy" in der Adresse (`nagrody/odznaki`) — keine Kennung eines Dokuments. */
export const BADGES_SLUG = 'odznaki';

/* -- Welche Regel in der Nauka gilt ----------------------------------------------------------------------------------- */

export interface BaseRewards {
  /** Die Nauka zählt Punkte (Motywacja „Punkty i nagrody"). */
  readonly on: boolean;
  /** Welches Dokument gilt — `null`: die eingebaute Regel. */
  readonly id: string | null;
  readonly rules: RewardRules;
}

/** Die Regel der Nauka dieser Baza — dasselbe Objekt, solange sich die Baza nicht ändert (die Tafel merkt sich daran, was neu ist). */
export function baseRewards(lib: CogitaLibrary): BaseRewards {
  const settings = lib.settings();
  const { id, rules } = rewardsFor(lib.docs('reward'), null, settings.rewards ?? null);
  return { on: settings.motivation === 'rewards', id, rules };
}

export function useBaseRewards(): BaseRewards {
  const { lib } = useCtx();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- neu, wenn sich die Baza ändert
  return useMemo(() => baseRewards(lib), [lib, lib.revision]);
}

/** Für den Lauf einer Powtórka in der Nauka: die Regel, wenn die Nauka Punkte zählt — sonst keine. */
export function useRunRewards(): RewardRules | null {
  const base = useBaseRewards();
  return base.on ? base.rules : null;
}

/* -- Der Reiter -------------------------------------------------------------------------------------------------------- */

export function RewardsTab({ learner, chosen, go }: { learner: Learner | null; chosen: string | null; go: (...tail: string[]) => void }) {
  const { lib, writes, href } = useCtx();
  const base = useBaseRewards();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const { busy, failed, run } = useBusy();
  const lang = baseLang(lib);
  const RW = rewardWords(lang);
  /* 2026-11-05 (Prompt 17) — „Odznaki i poziomy" statt Tafel und Dokumenten. */
  if (chosen === BADGES_SLUG) return <OwnBadges learner={learner} rules={base.rules} rename={rename} lang={lang} />;
  return (
    <div className="cg cg-rewards" data-rewards-tab="">
      <section className="cg-card">
        <h3>Twoje nagrody</h3>
        {!base.on && <p className="cg-muted" data-rewards-off="">W Nauce tej bazy punkty są wyłączone{writes ? ' — włączysz je tutaj albo w Ustawieniach (Motywacja).' : '.'} Moduły „Punkty i seria” na stronach liczą je i tak.</p>}
        {!base.on && writes && (
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} data-rewards-enable="" onClick={() => void run(() => lib.saveSettings({ motivation: 'rewards' }))}>Włącz punkty w Nauce</button>
          </div>
        )}
        <p className="cg-muted">Zasady: <strong>{base.rules.name}</strong>{base.id === null ? ' (wbudowane)' : ''} — {describeRewards(base.rules)}.</p>
        {/* 2026-11-05 (Prompt 17) — der Eingang zu „Odznaki i poziomy". */}
        <div className="wk-actions">
          <a className="wk-btn wk-btn-quiet" href={href('nagrody', BADGES_SLUG)} data-rewards-badges-link=""><RewardIcon name="medal" className="is-medal" />{RW.title}</a>
          <span className="cg-muted">{RW.openSays}</span>
        </div>
        <RewardBoard learner={learner} rules={base.rules} rename={rename} shape="full" />
        {failed !== null && <p className="wk-error">{failed}</p>}
      </section>
      {writes && <RewardDocs chosen={chosen} active={base.on ? base.id : null} go={go} learner={learner} />}
    </div>
  );
}

/**
 * 2026-11-05 (Prompt 17) — „ODZNAKI I POZIOMY" FÜR SICH SELBST: die eigenen Antworten und Werte, dazu die Masse der Karte,
 * die der Krajobraz in diesem Browser zuletzt mass. Was davon eben erreicht ist, bekommt sein Datum — über Geräte hinweg.
 */
function OwnBadges({ learner, rules, rename, lang }: { learner: Learner | null; rules: RewardRules; rename: ((key: string) => string) | undefined; lang: Lang }) {
  const { lib, href } = useCtx();
  const RW = rewardWords(lang);
  const measured = learner === null ? null : mapMeasuresOf(lib.libraryId, holderKey(learner.holder));
  const regions = measured?.regions;
  const map = measured?.map;
  const clean = measured?.clean;
  const extra = useMemo<ExtraMeasures | undefined>(() => (regions === undefined || map === undefined || clean === undefined ? undefined : { regions, map, clean }), [regions, map, clean]);
  const keep = useCallback((add: Readonly<Record<string, number>>) => { void learner?.keepAwards(add).catch(() => undefined); }, [learner]);
  return (
    <div className="cg cg-rewards" data-rewards-tab="" data-rewards-badges="">
      <div className="cg-row">
        <a className="wk-link" href={href('nagrody')} data-rewards-back="">{RW.back}</a>
      </div>
      <section className="cg-card">
        {learner === null ? <p className="cg-muted">{RW.counting}</p> : (
          <BadgesPage rules={rules} answers={learner.progress.answers} values={learner.progress.values} rename={rename} extra={extra} lang={lang} onAwards={keep} />
        )}
      </section>
    </div>
  );
}

/** Die Dokumente „Nagrody": Liste, ein neues aus einem fertigen Anfang, der Editor des gewählten. */
function RewardDocs({ chosen, active, go, learner }: { chosen: string | null; active: string | null; go: (...tail: string[]) => void; learner: Learner | null }) {
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  const [preset, setPreset] = useState(REWARD_PRESETS[0]!.id);
  const docs = lib.docs('reward');
  /* `odznaki` ist die Seite „Odznaki i poziomy", kein Dokument. */
  const doc = chosen === null || chosen === BADGES_SLUG ? undefined : docs.find((e) => e.id === chosen);
  const settings = lib.settings();
  return (
    <>
      <section className="cg-card" data-reward-docs={docs.length}>
        <h3>Zasady nagród</h3>
        <p className="cg-muted">Kilka zasad w jednej bazie: każde miejsce wybiera swoje — moduł „Punkty i seria” albo „Statystyki na żywo” na stronie, a Nauka tę, którą wskażesz. Punkty liczą się z odpowiedzi, więc zmiana zasad zmienia je od razu wszystkim.</p>
        {docs.length === 0 ? <p className="wk-empty">Nie ma jeszcze własnych zasad — wszędzie obowiązują wbudowane („Punkty, seria i poziomy”).</p> : (
          <ul className="lib-list">
            {docs.map((e) => {
              const rules = readRewards(e.data);
              return (
                <li key={e.id} className="cg-method">
                  <button type="button" className={`lib-row${e.id === chosen ? ' is-on' : ''}`} data-reward-doc={e.id} onClick={() => go('nagrody', e.id)}>
                    <span className="lib-row-title">{rules.name} <OriginTag id={e.id} />{e.id === active ? <span className="cg-chip is-on"> w Nauce</span> : null}</span>
                    <span className="lib-row-meta">{describeRewards(rules)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="cg-row">
          <select value={preset} disabled={busy} aria-label="Gotowy początek" onChange={(e) => setPreset(e.target.value)}>
            {REWARD_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button type="button" className="wk-btn" disabled={busy} data-reward-new="" onClick={() => void run(async () => {
            const p = REWARD_PRESETS.find((x) => x.id === preset) ?? REWARD_PRESETS[0]!;
            const made = await lib.saveDoc('reward', rewardsData(p.rules));
            go('nagrody', made.id);
          })}><Icon name="plus" />Nagrody</button>
        </div>
        <p className="cg-muted">{REWARD_PRESETS.find((x) => x.id === preset)?.says}</p>
        {failed !== null && <p className="wk-error">{failed}</p>}
      </section>
      {doc !== undefined && (lib.isOwn(doc.id)
        ? <RewardEditor key={doc.id} id={doc.id} data={doc.data} active={doc.id === active} isDefault={settings.rewards === doc.id || (settings.rewards === undefined && docs[0]?.id === doc.id)} learner={learner} onGone={() => go('nagrody')} />
        : (
          <section className="cg-card">
            <h3>{readRewards(doc.data).name}</h3>
            <p className="cg-muted">Te zasady pochodzą z innej bazy wiedzy ({lib.origin(doc.id)?.name ?? '?'}) — tu można ich używać, zmienia się je tam.</p>
            <p className="cg-muted">{describeRewards(readRewards(doc.data))}</p>
          </section>
        ))}
    </>
  );
}

/* -- Der Editor -------------------------------------------------------------------------------------------------------- */

/** Was ein Dokument ausser der Regel trägt (bleibender Name eines Imports, Markierungen) — bleibt beim Speichern. */
const metaOf = (data: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(data).filter(([k]) => k.startsWith('_')));

const n = (v: string): number => { const x = Number(v.trim() === '' ? '0' : v); return Number.isFinite(x) ? x : 0; };

function Num({ label, value, onChange, min = 0, max, step = 1, data }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; data?: string }) {
  return (
    <label className="wk-field cg-reward-num">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} data-reward-field={data} onChange={(e) => onChange(n(e.target.value))} />
    </label>
  );
}

function RewardEditor({ id, data, active, isDefault, learner, onGone }: {
  id: string;
  data: Readonly<Record<string, unknown>>;
  active: boolean;
  isDefault: boolean;
  learner: Learner | null;
  onGone: () => void;
}) {
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  /* 2026-11-05 (Prompt 17) — die neuen Worte des Editors (er bleibt polnisch wie die übrigen). */
  const EDITOR_WORDS = rewardWords('pl');
  const [draft, setDraft] = useState<RewardRules>(() => readRewards(data));
  const [json, setJson] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(false); }, [draft]);
  /* Was die Tafel unten zeigt: die Regel, wie sie gespeichert würde (dieselbe Lesung wie überall). */
  const preview = useMemo(() => readRewards(rewardsData(draft)), [draft]);
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const set = (patch: Partial<RewardRules>) => setDraft((d) => ({ ...d, ...patch }));
  const setPoint = (k: PointKind, v: number) => setDraft((d) => ({ ...d, points: { ...d.points, [k]: v } }));
  const setLevel = (i: number, patch: Partial<RewardRules['levels'][number]>) => setDraft((d) => ({ ...d, levels: d.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const setBadge = (i: number, patch: Partial<RewardBadge>) => setDraft((d) => ({ ...d, badges: d.badges.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const save = (rules: RewardRules) => run(async () => {
    await lib.saveDoc('reward', { ...metaOf(data), ...rewardsData(readRewards(rewardsData(rules))) }, id);
    setSaved(true);
  });

  return (
    <section className="cg-card cg-reward-editor" data-reward-editor={id}>
      <div className="cg-row-between">
        <h3>{draft.name || 'Nagrody'}</h3>
        <span className="cg-row">
          {active ? <span className="cg-chip is-on" data-reward-active="">obowiązują w Nauce</span>
            : <button type="button" className="wk-link-btn" disabled={busy} data-reward-use="" onClick={() => void run(() => lib.saveSettings({ motivation: 'rewards', rewards: id }))}>Użyj w Nauce</button>}
          {!active && isDefault && <span className="cg-muted">(domyślne tej bazy)</span>}
        </span>
      </div>

      <label className="wk-field">
        <span>Nazwa</span>
        <input value={draft.name} maxLength={80} data-reward-field="name" onChange={(e) => set({ name: e.target.value })} />
      </label>

      <fieldset className="cg-reward-group">
        <legend>Punkty</legend>
        <div className="cg-row cg-reward-nums">
          {POINT_KINDS.map((k) => <Num key={k} label={POINT_LABEL[k]} value={draft.points[k]} max={10_000} data={`points.${k}`} onChange={(v) => setPoint(k, v)} />)}
        </div>
        <div className="cg-row cg-reward-nums">
          <Num label="Utrwalona: następna powtórka za co najmniej (dni)" value={draft.known.days} min={0.01} max={365} step={0.5} data="known.days" onChange={(v) => set({ known: { days: v } })} />
          <Num label="Szybka: w ciągu (sekund)" value={draft.fast.seconds} min={1} max={600} data="fast.seconds" onChange={(v) => set({ fast: { seconds: v } })} />
          <Num label="Seria dobrych: co ile z rzędu" value={draft.combo.every} min={2} max={1000} data="combo.every" onChange={(v) => set({ combo: { every: v } })} />
        </div>
      </fieldset>

      <fieldset className="cg-reward-group">
        <legend>Cel dnia i seria dni</legend>
        <div className="cg-row cg-reward-nums">
          <Num label="Cel dnia" value={draft.goal.amount} min={1} max={100_000} data="goal.amount" onChange={(v) => set({ goal: { ...draft.goal, amount: v } })} />
          <label className="wk-field">
            <span>Czego</span>
            <select value={draft.goal.unit} data-reward-field="goal.unit" onChange={(e) => set({ goal: { ...draft.goal, unit: e.target.value as GoalUnit } })}>
              {GOAL_UNITS.map((u) => <option key={u} value={u}>{GOAL_UNIT_LABEL[u]}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>Dzień serii to dzień</span>
            <select value={draft.streak.counts} data-reward-field="streak.counts" onChange={(e) => set({ streak: { ...draft.streak, counts: e.target.value === 'any' ? 'any' : 'goal' } })}>
              <option value="goal">z osiągniętym celem</option>
              <option value="any">z jakąkolwiek nauką</option>
            </select>
          </label>
          <Num label="Dni przerwy, które nie przerywają serii" value={draft.streak.grace} max={6} data="streak.grace" onChange={(v) => set({ streak: { ...draft.streak, grace: v } })} />
          <Num label="Premia za serię rośnie do dnia" value={draft.streak.max} min={1} max={365} data="streak.max" onChange={(v) => set({ streak: { ...draft.streak, max: v } })} />
        </div>
      </fieldset>

      <fieldset className="cg-reward-group" data-reward-levels={draft.levels.length}>
        <legend>Poziomy</legend>
        {draft.levels.length === 0 && <p className="cg-muted">Bez poziomów.</p>}
        {draft.levels.map((l, i) => (
          <div key={i} className="cg-row">
            <Num label="Od punktów" value={l.at} max={100_000_000} onChange={(v) => setLevel(i, { at: v })} />
            <label className="wk-field"><span>Nazwa</span><input value={l.name} maxLength={60} onChange={(e) => setLevel(i, { name: e.target.value })} /></label>
            <button type="button" className="wk-link-btn" aria-label={`Usuń poziom ${l.name}`} onClick={() => set({ levels: draft.levels.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        <button type="button" className="wk-link-btn" data-reward-add-level="" onClick={() => set({ levels: [...draft.levels, { at: (draft.levels[draft.levels.length - 1]?.at ?? 0) * 2 || 100, name: `Poziom ${draft.levels.length + 1}` }] })}>+ poziom</button>
      </fieldset>

      <fieldset className="cg-reward-group" data-reward-badges={draft.badges.length}>
        <legend>Odznaki</legend>
        {draft.badges.length === 0 && <p className="cg-muted">Bez odznak.</p>}
        {draft.badges.map((x, i) => (
          <div key={i} className="cg-row cg-reward-badge-row">
            <span className="cg-reward-badge-preview" aria-hidden><RewardIcon name={x.icon} /></span>
            <label className="wk-field"><span>Nazwa</span><input value={x.name} maxLength={60} onChange={(e) => setBadge(i, { name: e.target.value })} /></label>
            <label className="wk-field">
              <span>Znak</span>
              <select value={x.icon} onChange={(e) => setBadge(i, { icon: e.target.value as BadgeIcon })}>{BADGE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}</select>
            </label>
            <label className="wk-field">
              <span>Za</span>
              <select value={x.measure} data-reward-badge-measure={i} onChange={(e) => setBadge(i, { measure: e.target.value as RewardMeasure })}>{REWARD_MEASURES.map((m) => <option key={m} value={m}>{MEASURE_LABEL[m]}</option>)}</select>
            </label>
            <Num label="Od" value={x.atLeast} min={1} max={x.measure === 'map' ? 100 : 100_000_000} onChange={(v) => setBadge(i, { atLeast: v })} />
            <Num label="Punkty" value={x.points} max={10_000} onChange={(v) => setBadge(i, { points: v })} />
            {/* 2026-11-05 (Prompt 17) — die Art (die Gruppe auf „Odznaki i poziomy"); leer: aus dem Mass. */}
            <label className="wk-field">
              <span>{EDITOR_WORDS.editorKind}</span>
              <select value={x.kind ?? ''} data-reward-badge-kind={i} onChange={(e) => setBadge(i, { kind: (BADGE_KINDS as readonly string[]).includes(e.target.value) ? e.target.value as BadgeKind : undefined })}>
                <option value="">{EDITOR_WORDS.editorKindAuto(EDITOR_WORDS.kinds[badgeKindOf({ measure: x.measure, atLeast: x.atLeast })])}</option>
                {BADGE_KINDS.map((k) => <option key={k} value={k}>{EDITOR_WORDS.kinds[k]}</option>)}
              </select>
            </label>
            <label className="wk-field cg-reward-says"><span>Opis</span><input value={x.says ?? ''} maxLength={200} onChange={(e) => setBadge(i, { says: e.target.value })} /></label>
            <button type="button" className="wk-link-btn" aria-label={`Usuń odznakę ${x.name}`} onClick={() => set({ badges: draft.badges.filter((_, j) => j !== i) })}>×</button>
            {isExtraMeasure(x.measure) && <p className="cg-muted cg-reward-map-note" data-reward-map-note={i}>{EDITOR_WORDS.editorMapNote}</p>}
          </div>
        ))}
        <button type="button" className="wk-link-btn" data-reward-add-badge="" onClick={() => set({ badges: [...draft.badges, { id: '', name: `Odznaka ${draft.badges.length + 1}`, icon: 'star', measure: 'points', atLeast: 100, points: 0 }] })}>+ odznaka</button>
      </fieldset>

      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy} data-reward-save="" onClick={() => void save(draft)}>Zapisz</button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => { setJson(JSON.stringify(rewardsData(preview), null, 2)); setJsonError(null); }}>JSON</button>
        <button type="button" className="wk-link-btn" disabled={busy} data-reward-delete="" onClick={async () => {
          if (!await askText('Usunąć te nagrody? Punkty liczą się z odpowiedzi, więc nic nie ginie — moduły i Nauka, które je wybrały, wezmą zasady domyślne.')) return;
          void run(async () => {
            if (lib.settings().rewards === id) await lib.saveSettings({ rewards: undefined });
            await lib.remove(id);
            onGone();
          });
        }}>Usuń</button>
        {saved && <span className="cg-muted" role="status">Zapisano.</span>}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}

      {json !== null && (
        <div className="cg-reward-json" data-reward-json="">
          <label className="wk-field">
            <span>Te zasady jako JSON — zmień i zastosuj (czego brakuje, bierze się z zasad wbudowanych)</span>
            <textarea rows={14} value={json} spellCheck={false} onChange={(e) => setJson(e.target.value)} />
          </label>
          {jsonError !== null && <p className="wk-error">{jsonError}</p>}
          <div className="cg-row">
            <button type="button" className="wk-btn" disabled={busy} data-reward-json-apply="" onClick={() => {
              let parsed: unknown;
              try { parsed = JSON.parse(json); } catch (e) { setJsonError(`To nie jest poprawny JSON: ${e instanceof Error ? e.message : String(e)}`); return; }
              if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) { setJsonError('Oczekiwany jest obiekt {…} z zasadami.'); return; }
              const rules = readRewards(parsed);
              setDraft(rules);
              setJsonError(null);
              setJson(null);
              void save(rules);
            }}>Zastosuj i zapisz</button>
            <button type="button" className="wk-link-btn" onClick={() => setJson(null)}>Zamknij</button>
          </div>
        </div>
      )}

      <div className="cg-reward-preview" data-reward-preview="">
        <h4>Twoje punkty według tych zasad</h4>
        <p className="cg-muted">{describeRewards(preview)}</p>
        <RewardBoard learner={learner} rules={preview} rename={rename} shape="block" />
      </div>
    </section>
  );
}
