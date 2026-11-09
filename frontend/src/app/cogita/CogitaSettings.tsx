/**
 * COGITA — USTAWIENIA DER BAZA WIEDZY: ihr Name (und sie löschen), 0110 ihre
 * Quellen — Bibliotheken und andere Bazy wiedzy, auch aus anderen Bereichen —,
 * wohin die Antworten gehen (und ob dort eine Annahme ist), wie motiviert
 * wird, die Perspektiven, die Seite zum Beitreten einer Sitzung, die Baza
 * wiedzy für Vorschläge, die Abhängigkeiten (auch die vorgeschlagenen), die
 * Werte, eigene Regeln für Sitzungen und Aussehen.
 */

import { worldWords } from './worldWords';
import { handleFrom, readHandle, WORLD_HANDLE, type WorldRef } from './worlds';
import { useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { createIntake } from '../forms/intake';
import { deleteLibrary, libraryKindOf, loadLibraries, openLibraries, renameLibrary, type OpenLibrary } from '../library/library';
import { viewPath } from '../routes';
import { BASES_CHANGED } from './sources';
import { BaseVisibility } from './BaseWho';
import { AreaSpacingSettings, AreaStackSettings } from './SpacingSettings';
import { DEPENDENCY_KINDS, DEPENDENCY_LABEL, type DependencyKind } from './knowness';
import { intakeOf } from './learn';
import { DEFAULT_DAILY_GOAL, readDailyGoal } from './lessons';
import { baseLang, LANG_LABEL, LANGS } from './lang';
import { LOOK_LABEL, LOOK_TYPES, type LookType } from './flow';
import { DEFAULT_RULES, describeRules, PRESETS, readRules, type LiveRules } from './rules';
import { MOTIVATION_LABEL, MOTIVATIONS, type DependencyEdge, type Motivation, type SourceRef } from './store';
import { EntityPicker, entityNameTex, OriginTag, useAsync, useBusy, useCtx } from './ui';
import { TexText } from '../ui/tex/Tex';
import { rich, useT } from '../core/i18n';

export function CogitaSettings() {
  const t = useT();
  const { lib, writes, href } = useCtx();
  const settings = lib.settings();
  const { busy, failed, run } = useBusy();
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [libraries, setLibraries] = useState<readonly OpenLibrary[]>([]);
  const { me } = useCtx();
  const [round, setRound] = useState(0);
  useEffect(() => {
    void loadAreas().then((r) => setAreas(r.areas)).catch(() => undefined);
    if (me !== null) void loadLibraries().then((r) => openLibraries(me.ring, r.libraries)).then(setLibraries).catch(() => undefined);
  }, [me, round]);
  const [joinPage, setJoinPage] = useState(settings.joinPage ?? '');
  const save = (patch: Record<string, unknown>) => run(() => lib.saveSettings(patch));
  if (!writes) return <p className="wk-hint">{t('cogitaEditSettings.authorsOnly')}</p>;

  return (
    <div className="cg">
      <BaseSection areas={areas} />
      <BaseVisibility libraries={libraries} areas={areas} onChanged={() => setRound((n) => n + 1)} />
      <Sources libraries={libraries} areas={areas} />
      <OtherWorlds libraries={libraries} />

      <section className="cg-card">
        <h3>{t('cogitaEditSettings.storage.title')}</h3>
        <p className="wk-hint">{t('cogitaEditSettings.storage.hint')}</p>
        <AreaPick label={t('cogitaEditSettings.storage.title')} areas={areas} value={settings.storageAreaId ?? ''} disabled={busy}
          extras={[{ value: '', label: t('cogitaEditSettings.storage.learnerPrivate') }]} personalLabel={t('cogitaEditSettings.storage.myPrivate')}
          onChange={(areaId) => void save({ storageAreaId: areaId || undefined })} />
        <IntakeState areaId={settings.storageAreaId ?? null} areas={areas} />
      </section>

      <section className="cg-card">
        <h3>{t('cogitaEditSettings.reports.title')}</h3>
        <p className="wk-hint">{t('cogitaEditSettings.reports.hint')}</p>
        <IntakeState areaId={lib.areaId} areas={areas} />
      </section>

      <section className="cg-card">
        <h3>{t('cogitaEditSettings.motivation.title')}</h3>
        <select value={settings.motivation} disabled={busy} onChange={(e) => void save({ motivation: e.target.value as Motivation })}>
          {MOTIVATIONS.map((m) => <option key={m} value={m}>{MOTIVATION_LABEL[m]}</option>)}
        </select>
        {/* 2026-11-01 (2.11) — nur mit „Serie dni nauki": ein Tagesziel, die Tage hintereinander, die Woche. */}
        {settings.motivation === 'streaks' && <DailyGoalSetting value={settings.dailyGoal ?? DEFAULT_DAILY_GOAL} busy={busy} onSave={(n) => void save({ dailyGoal: n })} />}
        {/* 2026-11-02 — „Punkty i nagrody": welche Zasady nagród in der Nauka gelten (Bausteine auf Seiten wählen ihre eigenen). */}
        {settings.motivation === 'rewards' && (
          <div className="cg-row" data-settings-rewards="">
            <label className="wk-field">
              <span>{t('cogitaEditSettings.motivation.rewards')}</span>
              <select value={settings.rewards ?? ''} disabled={busy} onChange={(e) => void save({ rewards: e.target.value || undefined })}>
                <option value="">{t('cogitaEditSettings.motivation.rewardsDefault')}</option>
                {lib.docs('reward').map((e) => <option key={e.id} value={e.id}>{typeof e.data.name === 'string' ? e.data.name : t('cogitaEditSettings.motivation.rewardsFallback')}{lib.isOwn(e.id) ? '' : t('cogitaEditSettings.fromOrigin', { name: lib.origin(e.id)?.name ?? '?' })}</option>)}
              </select>
            </label>
            <a className="wk-link" href={href('nagrody')}>{t('cogitaEditSettings.motivation.rewardsLink')}</a>
          </div>
        )}
        <p className="wk-hint">{t('cogitaEditSettings.motivation.rankings')}</p>
      </section>

      {/* 2026-11-04 (Prompt 15) — die Abstände der Wiederholungen für alle, die hier lernen (und ob sie sie ändern dürfen). */}
      <AreaSpacingSettings lib={lib} busy={busy} onSave={(spacing) => void save({ spacing })} />
      {/* 2026-11-05 — wie viele Karten eine Wiederholung zugleich hat. */}
      <AreaStackSettings lib={lib} busy={busy} onSave={(stack) => void save({ stack })} />

      {/* 2026-11-04 (Prompt 9) — die Sprache der Lernbildschirme (Krajobraz, Ścieżka, Powtórka); ohne Wahl erkannt aus der Baza. */}
      <section className="cg-card" data-settings-language="">
        <h3>{t('cogitaEditSettings.language.title')}</h3>
        <p className="cg-muted">{t('cogitaEditSettings.language.hint', { lang: LANG_LABEL[baseLang(lib)] })}</p>
        <select value={settings.language ?? ''} disabled={busy} onChange={(e) => void save({ language: e.target.value || undefined })}>
          <option value="">{t('cogitaEditSettings.language.detect')}</option>
          {LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
        </select>
      </section>

      {/* 2026-10-23 (Schritt 5) — Perspektywy und Tematy gibt es nicht mehr; eine Baza mit alten Perspektywy hört es hier einmal. */}
      {settings.tags.length > 0 && (
        <section className="cg-card">
          <h3>{t('cogitaEditSettings.tags.title')}</h3>
          <p className="cg-muted">{t('cogitaEditSettings.tags.hint', { tags: settings.tags.join(', ') })}</p>
        </section>
      )}

      <section className="cg-card">
        <h3>{t('cogitaEditSettings.join.title')}</h3>
        <p className="wk-hint">{t('cogitaEditSettings.join.hint')}</p>
        <div className="cg-row">
          <input value={joinPage} onChange={(e) => setJoinPage(e.target.value)} placeholder="parafia/quiz" />{/* i18n-ignore: eine Adresse */}
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void save({ joinPage: joinPage.trim() || undefined })}>{t('common.save')}</button>
        </div>
      </section>

      <section className="cg-card">
        <h3>{t('cogitaEditSettings.proposals.title')}</h3>
        <p className="wk-hint">{t('cogitaEditSettings.proposals.hint')}</p>
        <select value={settings.contributionLibraryId ?? ''} disabled={busy} onChange={(e) => void save({ contributionLibraryId: e.target.value || undefined })}>
          <option value="">{t('cogitaEditSettings.proposals.none')}</option>
          {libraries.filter((l) => l.libraryId !== lib.libraryId && libraryKindOf(l) === 'knowledge').map((l) => <option key={l.libraryId} value={l.libraryId}>{l.name}</option>)}
        </select>
      </section>

      <Dependencies edges={settings.dependencies} busy={busy} onSave={(deps) => void save({ dependencies: deps })} />
      <ValuesEditor />
      <RulesTemplates />
      <Looks />
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/** Die Baza wiedzy selbst: ihr Name, ihr Bereich — und sie löschen. */
function BaseSection({ areas }: { areas: readonly AreaRow[] }) {
  const t = useT();
  const { lib, name, me } = useCtx();
  const [draft, setDraft] = useState(name);
  const [confirm, setConfirm] = useState('');
  const { busy, failed, run } = useBusy();
  const area = areas.find((a) => a.areaId === lib.areaId);
  if (me === null) return null;
  return (
    <section className="cg-card">
      <h3>{t('cogitaEditSettings.base.title')}</h3>
      <div className="cg-row">
        <input value={draft} aria-label={t('cogitaEditSettings.base.name')} onChange={(e) => setDraft(e.target.value)} />
        <button type="button" className="wk-btn" disabled={busy || draft.trim() === '' || draft.trim() === name}
          onClick={() => void run(async () => { await renameLibrary(me.ring, lib, draft); window.dispatchEvent(new Event(BASES_CHANGED)); })}>{t('cogitaEditSettings.base.saveName')}</button>
      </div>
      <p className="wk-hint">{t('cogitaEditSettings.base.area', { area: area?.personal === true ? t('cogitaEditSettings.onlyYou') : area?.name ?? t('cogitaEditSettings.base.unknownArea') })}</p>
      <details>
        <summary>{t('cogitaEditSettings.base.delete')}</summary>
        <p className="wk-hint">{t('cogitaEditSettings.base.deleteHint')}</p>
        <label className="wk-field"><span>{t('cogitaEditSettings.base.typeName')}</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        <button type="button" className="wk-btn lib-btn-danger" disabled={busy || confirm.trim() !== name.trim()}
          onClick={() => void run(async () => { await deleteLibrary(lib.libraryId); window.dispatchEvent(new Event(BASES_CHANGED)); window.location.hash = viewPath('knowledge'); })}>{t('cogitaEditSettings.base.deleteForever')}</button>
      </details>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/**
 * 0110 — ŹRÓDŁA: worauf diese Baza wiedzy verweist, auch aus anderen
 * Bereichen. Eine Bibliothek nur zum Verweisen (Werke, Zitate, Personen in
 * Feldern und Zitaten); (2026-10-23) ein Skryptorium mit seinen Texten und
 * Rodzajen tekstów (ein Widok zeigt Kazania in der Macierz Tajemnica × Obszar);
 * eine andere Baza wiedzy zum Wiederverwenden. Jede liest nur, wer ihren
 * Bereich liest — der Verweis gibt nichts frei.
 */
function Sources({ libraries, areas }: { libraries: readonly OpenLibrary[]; areas: readonly AreaRow[] }) {
  const t = useT();
  const { lib, writes, sources } = useCtx();
  const { busy, failed, run } = useBusy();
  const [pick, setPick] = useState('');
  const list = lib.settings().sources;
  const loaded = new Map(lib.sourceList().map((s) => [s.store.libraryId, s]));
  const missing = new Set((sources?.missing ?? []).map((s) => s.id));
  const areaName = (id: string | undefined) => {
    const area = areas.find((a) => a.areaId === id);
    return area === undefined ? null : area.personal === true ? t('cogitaEditSettings.onlyYou') : area.name;
  };
  const choices = libraries.filter((l) => l.libraryId !== lib.libraryId && !list.some((s) => s.id === l.libraryId));
  const save = (next: readonly SourceRef[]) => run(() => lib.saveSettings({ sources: next }));
  return (
    <section className="cg-card">
      <h3>{t('cogitaEditSettings.sources.title')}</h3>
      <p className="wk-hint">{rich(t('cogitaEditSettings.sources.intro'), { b: (s) => <strong>{s}</strong> })}</p>
      {list.length === 0 ? <p className="wk-hint">{t('cogitaEditSettings.sources.none')}</p> : (
        <ul>
          {list.map((s) => {
            const open = loaded.get(s.id);
            const where = areaName(open?.store.areaId ?? libraries.find((l) => l.libraryId === s.id)?.areaId);
            return (
              <li key={s.id} className="cg-row">
                <strong>{s.name}</strong>
                <span className="cg-tag">{s.kind === 'liturgy' ? t('liturgy.name') : s.kind === 'books' ? t('cogitaEditSettings.sources.kindBooks') : s.kind === 'writing' ? t('cogitaEditSettings.sources.kindWriting') : t('cogitaEditSettings.sources.kindKnowledge')}</span>
                {where !== null && <span className="cg-muted">{where}</span>}
                {missing.has(s.id) ? <span className="cg-tag is-warn">{t('cogitaEditSettings.sources.unavailable')}</span>
                  : open !== undefined ? <span className="cg-tag is-ok">{t('cogitaEditSettings.sources.entries', { count: open.store.all().length })}</span>
                  : <span className="wk-hint">{t('cogitaEditSettings.sources.loading')}</span>}
                {writes && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void save(list.filter((x) => x.id !== s.id))}>{t('cogitaEditSettings.remove')}</button>}
              </li>
            );
          })}
        </ul>
      )}
      {writes && (
        <div className="cg-row">
          <select value={pick} aria-label={t('cogitaEditSettings.sources.add')} onChange={(e) => setPick(e.target.value)}>
            <option value="">{t('cogitaEditSettings.sources.addPlaceholder')}</option>
            {choices.map((l) => <option key={l.libraryId} value={l.libraryId}>{l.name} ({libraryKindOf(l) === 'liturgy' ? t('liturgy.name') : libraryKindOf(l) === 'knowledge' ? t('cogitaEditSettings.kind.knowledge') : libraryKindOf(l) === 'writing' ? t('cogitaEditSettings.kind.writing') : t('cogitaEditSettings.kind.books')}{areaName(l.areaId) === null ? '' : ` · ${areaName(l.areaId)}`})</option>)}
          </select>
          <button type="button" className="wk-btn" disabled={busy || pick === ''} onClick={() => {
            const row = libraries.find((l) => l.libraryId === pick);
            if (row === undefined) return;
            void save([...list, { id: row.libraryId, kind: libraryKindOf(row), name: row.name }]).then(() => setPick(''));
          }}>{t('common.add')}</button>
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/**
 * 2026-11-05 (Prompt 24) — „Inne światy": der bleibende Name dieser Baza (für Verweise aus anderen, "@@name:@…") und die Welten,
 * auf die Verweise von hier zeigen (Name → Baza). Nie zusammengeführt (das sind „Źródła"): nur Angebote.
 */
function OtherWorlds({ libraries }: { libraries: readonly OpenLibrary[] }) {
  const { lib, writes, name } = useCtx();
  const { busy, failed, run } = useBusy();
  const W = worldWords(baseLang(lib));
  const s = lib.settings();
  const [handle, setHandle] = useState(s.handle ?? '');
  const shown = handle.trim().toLowerCase();
  const valid = shown === '' || WORLD_HANDLE.test(shown);
  const rows = s.worlds;
  const readable = new Set(libraries.map((l) => l.libraryId));
  const saveWorlds = (next: readonly WorldRef[]) => run(() => lib.saveSettings({ worlds: next }));
  return (
    <section className="cg-card" data-settings-worlds="">
      <h3>{W.settingsTitle}</h3>
      <label className="wk-field">
        <span>{W.settingsHandle}</span>
        <span className="cg-row">
          <span aria-hidden="true">@</span>
          <input value={handle} disabled={!writes} placeholder={handleFrom(name)} onChange={(e) => setHandle(e.target.value)} aria-invalid={!valid} data-settings-handle="" />
          {writes && <button type="button" className="wk-btn" disabled={busy || !valid || (readHandle(shown) ?? '') === (s.handle ?? '')} onClick={() => void run(() => lib.saveSettings({ handle: shown === '' ? undefined : shown }))}>{W.settingsSave}</button>}
        </span>
      </label>
      <p className="cg-muted">{W.settingsHandleNote}</p>
      <h4>{W.settingsWorlds}</h4>
      {rows.length === 0 ? <p className="cg-muted">{W.settingsNoWorlds}</p> : (
        <ul>
          {rows.map((w) => (
            <li key={w.id} className="cg-row" data-settings-world={w.handle}>
              <strong>{w.name}</strong> <code>@@{w.handle}:…</code>
              {!readable.has(w.id) && <span className="cg-tag is-warn">{W.unavailable}</span>}
              {writes && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void saveWorlds(rows.filter((x) => x.id !== w.id))}>{W.settingsRemove}</button>}
            </li>
          ))}
        </ul>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

function IntakeState({ areaId, areas }: { areaId: string | null; areas: readonly AreaRow[] }) {
  const t = useT();
  const { me } = useCtx();
  const [tick, setTick] = useState(0);
  const has = useAsync(areaId === null ? null : () => intakeOf(areaId).then((k) => k !== null), [areaId, tick]);
  const { busy, failed, run } = useBusy();
  const [role, setRole] = useState(me?.person.id ?? '');
  if (areaId === null) return null;
  const area = areas.find((a) => a.areaId === areaId);
  if (has === undefined) return <span className="wk-hint">{t('cogitaEditSettings.intake.checking')}</span>;
  if (has === true) return <span className="cg-tag is-ok">{area === undefined ? t('cogitaEditSettings.intake.works') : t('cogitaEditSettings.intake.worksIn', { area: area.name })}</span>;
  return (
    <div className="cg">
      <span className="cg-tag is-warn">{t('cogitaEditSettings.intake.none')}</span>
      {me !== null && area !== undefined && area.myLevel === 'admin' && (
        <div className="cg-row">
          <span className="cg-muted">{t('cogitaEditSettings.intake.keyFor')}</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>{me.roles.filter((r) => r.kind !== 'account').map((r) => <option key={r.id} value={r.id}>{me.names.get(r.id) ?? t('cogitaEditSettings.intake.role')}</option>)}</select>
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => { await createIntake(me.ring, areaId, role); setTick((n) => n + 1); })}>{busy ? t('cogitaEditSettings.intake.creating') : t('cogitaEditSettings.intake.create')}</button>
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/**
 * Die Zależności zwischen einzelnen Einträgen. 2026-10-27: die Reihenfolge des Lernens kommt vor
 * allem aus den Feldern „Najpierw trzeba znać" der Rodzaje (`prerequisites.ts`) — hier steht, was
 * dazukommt (und Pogłębia / Daje tło, die nur die Kenntnis weitergeben).
 */
function Dependencies({ edges, busy, onSave }: { edges: readonly DependencyEdge[]; busy: boolean; onSave: (e: DependencyEdge[]) => void }) {
  const t = useT();
  const { lib } = useCtx();
  const [parent, setParent] = useState<string | null>(null);
  const [child, setChild] = useState<string | null>(null);
  const [kind, setKind] = useState<DependencyKind>('prerequisite');
  const [impact, setImpact] = useState(0.5);
  return (
    <section className="cg-card">
      <h3>{t('cogitaEditSettings.deps.title')}</h3>
      <p className="wk-hint">{t('cogitaEditSettings.deps.hint')}</p>
      <ul>
        {edges.map((d, i) => (
          <li key={`${d.parent}>${d.child}`} className="cg-row">
            <span><TexText text={entityNameTex(lib, d.child)} /> → <TexText text={entityNameTex(lib, d.parent)} /> · {DEPENDENCY_LABEL[d.kind]} · {t('cogitaEditSettings.deps.weightOf', { n: d.impact })}</span>
            {d.proposed === true && <span className="cg-tag is-warn">{t('cogitaEditSettings.deps.proposal')}</span>}
            {d.proposed === true && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onSave(edges.map((e, j) => (j === i ? { parent: e.parent, child: e.child, kind: e.kind, impact: e.impact } : e)))}>{t('cogitaEditSettings.deps.confirm')}</button>}
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onSave(edges.filter((_, j) => j !== i))}>{t('cogitaEditSettings.remove')}</button>
          </li>
        ))}
      </ul>
      <div className="cg-row">
        <EntityPicker lib={lib} value={child} onPick={setChild} placeholder={t('cogitaEditSettings.deps.child')} />
        <select value={kind} onChange={(e) => setKind(e.target.value as DependencyKind)}>{DEPENDENCY_KINDS.map((k) => <option key={k} value={k}>{DEPENDENCY_LABEL[k]}</option>)}</select>
        <EntityPicker lib={lib} value={parent} onPick={setParent} placeholder={t('cogitaEditSettings.deps.parent')} />
        <input type="number" min={0} max={1} step={0.1} value={impact} onChange={(e) => setImpact(Number(e.target.value))} aria-label={t('cogitaEditSettings.deps.weight')} />
        <button type="button" className="wk-btn" disabled={busy || parent === null || child === null || parent === child} onClick={() => { onSave([...edges, { parent: parent!, child: child!, kind, impact }]); setParent(null); setChild(null); }}>{t('common.add')}</button>
      </div>
    </section>
  );
}

interface ValueDef { readonly id: string; readonly label: string; readonly scope: 'person' | 'group' | 'session'; readonly visibility: 'all' | 'group' | 'person'; readonly min?: number; readonly max?: number; readonly initial: number; readonly score: boolean }

/** Wartości kursu [H7, F37]: punkty, bliskość postaci, zasoby — z zasięgiem, widocznością, granicami. */
function ValuesEditor() {
  const t = useT();
  const { lib } = useCtx();
  /* 0110 — die eigenen Werte; die einer Quelle gelten mit, geändert werden sie dort. */
  const doc = lib.docs('values').find((e) => lib.isOwn(e.id));
  const read = (): ValueDef[] => (Array.isArray(doc?.data.values) ? doc!.data.values : []).flatMap((v): ValueDef[] => {
    if (typeof v !== 'object' || v === null) return [];
    const o = v as Record<string, unknown>;
    return typeof o.id === 'string' ? [{ id: o.id, label: typeof o.label === 'string' ? o.label : o.id, scope: o.scope === 'group' || o.scope === 'session' ? o.scope : 'person', visibility: o.visibility === 'group' || o.visibility === 'person' ? o.visibility : 'all', ...(typeof o.min === 'number' ? { min: o.min } : {}), ...(typeof o.max === 'number' ? { max: o.max } : {}), initial: typeof o.initial === 'number' ? o.initial : 0, score: o.score === true }] : [];
  });
  const [values, setValues] = useState<ValueDef[]>(read);
  const { busy, failed, run } = useBusy();
  const set = (i: number, patch: Partial<ValueDef>) => setValues((v) => v.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <section className="cg-card">
      <h3>{t('cogitaEditSettings.values.title')}</h3>
      <p className="wk-hint">{t('cogitaEditSettings.values.hint')}</p>
      {values.map((v, i) => (
        <div key={i} className="cg-row">
          <input value={v.id} onChange={(e) => set(i, { id: e.target.value.replace(/\s+/g, '_') })} aria-label={t('cogitaEditSettings.values.key')} />
          <input value={v.label} onChange={(e) => set(i, { label: e.target.value })} aria-label={t('common.name')} />
          <select value={v.scope} onChange={(e) => set(i, { scope: e.target.value as ValueDef['scope'] })}><option value="person">{t('cogitaEditSettings.values.scopePerson')}</option><option value="group">{t('cogitaEditSettings.values.scopeGroup')}</option><option value="session">{t('cogitaEditSettings.values.scopeSession')}</option></select>
          <select value={v.visibility} onChange={(e) => set(i, { visibility: e.target.value as ValueDef['visibility'] })}><option value="all">{t('cogitaEditSettings.values.visAll')}</option><option value="group">{t('cogitaEditSettings.values.visGroup')}</option><option value="person">{t('cogitaEditSettings.values.visPerson')}</option></select>
          <input type="number" value={v.initial} onChange={(e) => set(i, { initial: Number(e.target.value) })} aria-label={t('cogitaEditSettings.values.initial')} />
          <input type="number" value={v.min ?? ''} placeholder={t('cogitaEditSettings.values.min')} onChange={(e) => set(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <input type="number" value={v.max ?? ''} placeholder={t('cogitaEditSettings.values.max')} onChange={(e) => set(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <label className="pe-check"><input type="checkbox" checked={v.score} onChange={(e) => set(i, { score: e.target.checked })} /><span>{t('cogitaEditSettings.values.score')}</span></label>
          <button type="button" className="wk-link-btn" onClick={() => setValues((x) => x.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div className="cg-row">
        <button type="button" className="wk-link-btn" onClick={() => setValues((v) => [...v, { id: `wartosc${v.length + 1}`, label: t('cogitaEditSettings.values.newLabel'), scope: 'person', visibility: 'person', initial: 0, score: false }])}>{t('cogitaEditSettings.values.add')}</button>
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(() => lib.saveDoc('values', { values }, doc?.id))}>{t('cogitaEditSettings.values.save')}</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/** Własne zasady sesji [I5] — z gotowego początku, zmienione liczbami. */
function RulesTemplates() {
  const t = useT();
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  const [from, setFrom] = useState(PRESETS[0].id);
  const [chosen, setChosen] = useState<string | null>(null);
  const doc = chosen === null ? undefined : lib.docs('rules').find((e) => e.id === chosen);
  const [rules, setRules] = useState<LiveRules>(DEFAULT_RULES);
  const [name, setName] = useState('');
  useEffect(() => { if (doc !== undefined) { setRules(readRules(doc.data.rules)); setName(String(doc.data.name ?? t('cogitaEditSettings.rules.fallback'))); } }, [doc?.id, doc?.version]);
  const num = (label: string, value: number, apply: (n: number) => LiveRules) => (
    <label className="wk-field"><span>{label}</span><input type="number" value={value} onChange={(e) => setRules(apply(Number(e.target.value)))} /></label>
  );
  return (
    <section className="cg-card">
      <h3>{t('cogitaEditSettings.rules.title')}</h3>
      <div className="cg-row">
        <select value={chosen ?? ''} onChange={(e) => setChosen(e.target.value || null)}>
          <option value="">{t('cogitaEditSettings.rules.own', { n: lib.docs('rules').length })}</option>
          {lib.docs('rules').map((e) => <option key={e.id} value={e.id}>{String(e.data.name ?? t('cogitaEditSettings.rules.fallback'))}{lib.isOwn(e.id) ? '' : t('cogitaEditSettings.fromOrigin', { name: lib.origin(e.id)?.name ?? '?' })}</option>)}
        </select>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(async () => {
          const p = PRESETS.find((x) => x.id === from)!;
          const made = await lib.saveDoc('rules', { name: p.label, preset: p.id, rules: p.rules, mode: p.mode, hostView: p.hostView, participantView: p.participantView });
          setChosen(made.id);
        })}>{t('cogitaEditSettings.rules.fromPreset')}</button>
      </div>
      {doc !== undefined && (
        <div className="cg">
          <label className="wk-field"><span>{t('common.name')}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="cg-row">
            {num(t('cogitaEditSettings.rules.roundTimer'), rules.roundTimer.seconds, (n) => ({ ...rules, roundTimer: { ...rules.roundTimer, seconds: n } }))}
            {num(t('cogitaEditSettings.rules.actionTimer'), rules.actionTimer.seconds, (n) => ({ ...rules, actionTimer: { ...rules.actionTimer, seconds: n } }))}
            {num(t('cogitaEditSettings.rules.baseCorrect'), rules.scoring.baseCorrect, (n) => ({ ...rules, scoring: { ...rules.scoring, baseCorrect: n } }))}
            {num(t('cogitaEditSettings.rules.firstBonus'), rules.scoring.firstCorrectBonus, (n) => ({ ...rules, scoring: { ...rules.scoring, firstCorrectBonus: n } }))}
            {num(t('cogitaEditSettings.rules.speedBonus'), rules.speedBonus.maxPoints, (n) => ({ ...rules, speedBonus: { ...rules.speedBonus, maxPoints: n } }))}
            {num(t('cogitaEditSettings.rules.streakBonus'), rules.scoring.streakBaseBonus, (n) => ({ ...rules, scoring: { ...rules.scoring, streakBaseBonus: n } }))}
            {num(t('cogitaEditSettings.rules.penalty'), rules.scoring.wrongAnswerPenalty, (n) => ({ ...rules, scoring: { ...rules.scoring, wrongAnswerPenalty: n } }))}
          </div>
          <label className="pe-check"><input type="checkbox" checked={rules.nextQuestion.mode === 'timer'} onChange={(e) => setRules({ ...rules, nextQuestion: { ...rules.nextQuestion, mode: e.target.checked ? 'timer' : 'manual' } })} /><span>{t('cogitaEditSettings.rules.autoNext')}</span></label>
          <ul className="cg-muted">{describeRules(readRules(rules)).map((l, i) => <li key={i}>{l}</li>)}</ul>
          {lib.isOwn(doc.id)
            ? <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(() => lib.saveDoc('rules', { ...doc.data, name: name.trim() || t('cogitaEditSettings.rules.fallback'), rules: readRules(rules) }, doc.id))}>{t('cogitaEditSettings.rules.save')}</button>
            : <p className="wk-hint">{t('cogitaEditSettings.rules.foreign', { name: lib.origin(doc.id)?.name ?? '' })}</p>}
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/** Wygląd [G4, G8]: rodzaj (czytanie, slajdy, …), co pokazać z każdego rodzaju wpisu, przejścia z ruchu 0107. */
function Looks() {
  const t = useT();
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  return (
    <section className="cg-card">
      <h3>{t('cogitaEditSettings.looks.title')}</h3>
      <p className="wk-hint">{t('cogitaEditSettings.looks.hint')}</p>
      <ul>
        {lib.docs('look').filter((e) => !lib.isOwn(e.id)).map((e) => (
          <li key={e.id} className="cg-row"><span>{String(e.data.name ?? t('cogitaEditSettings.looks.fallback'))}</span> <OriginTag id={e.id} /></li>
        ))}
        {lib.docs('look').filter((e) => lib.isOwn(e.id)).map((e) => (
          <li key={e.id} className="cg-row">
            <input defaultValue={String(e.data.name ?? t('cogitaEditSettings.looks.fallback'))} onBlur={(ev) => void run(() => lib.saveDoc('look', { ...e.data, name: ev.target.value }, e.id))} aria-label={t('common.name')} />
            <select defaultValue={String(e.data.type ?? 'reading')} onChange={(ev) => void run(() => lib.saveDoc('look', { ...e.data, type: ev.target.value as LookType }, e.id))}>
              {LOOK_TYPES.map((l) => <option key={l} value={l}>{LOOK_LABEL[l]}</option>)}
            </select>
            <input defaultValue={String(e.data.transition ?? '')} placeholder={t('cogitaEditSettings.looks.transition')} onBlur={(ev) => void run(() => lib.saveDoc('look', { ...e.data, transition: ev.target.value }, e.id))} />
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => lib.remove(e.id))}>{t('cogitaEditSettings.remove')}</button>
          </li>
        ))}
      </ul>
      <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => lib.saveDoc('look', { name: t('cogitaEditSettings.looks.newName'), type: 'reading', kinds: {} }))}>{t('cogitaEditSettings.looks.add')}</button>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/**
 * 2026-11-01 (2.11) — DAS TAGESZIEL: wie viele verschiedene Karten am Tag. Die Lernenden sehen dann in der Nauka und am
 * Ende einer Powtórka den heutigen Stand, die Tage hintereinander und die Woche — jeder nur seine eigenen.
 */
function DailyGoalSetting({ value, busy, onSave }: { value: number; busy: boolean; onSave: (n: number) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const n = readDailyGoal(draft);
  return (
    <label className="wk-field" data-daily-goal-setting="">
      <span>{t('cogitaEditSettings.daily.label')}</span>
      <span className="cg-row">
        <input type="number" min={1} max={500} step={1} inputMode="numeric" value={draft} disabled={busy} onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (n !== undefined && n !== value) onSave(n); }} onKeyDown={(e) => { if (e.key === 'Enter' && n !== undefined && n !== value) onSave(n); }} />
        <span className="cg-muted">{t('cogitaEditSettings.daily.hint')}</span>
      </span>
    </label>
  );
}
