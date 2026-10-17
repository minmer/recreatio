/**
 * COGITA — USTAWIENIA DER BAZA WIEDZY: ihr Name (und sie löschen), 0110 ihre
 * Quellen — Bibliotheken und andere Bazy wiedzy, auch aus anderen Bereichen —,
 * wohin die Antworten gehen (und ob dort eine Annahme ist), wie motiviert
 * wird, die Perspektiven, die Seite zum Beitreten einer Sitzung, die Baza
 * wiedzy für Vorschläge, die Abhängigkeiten (auch die vorgeschlagenen), die
 * Werte, eigene Regeln für Sitzungen und Aussehen.
 */

import { useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { createIntake } from '../forms/intake';
import { deleteLibrary, libraryKindOf, loadLibraries, openLibraries, renameLibrary, type OpenLibrary } from '../library/library';
import { viewPath } from '../routes';
import { BASES_CHANGED } from './sources';
import { DEPENDENCY_KINDS, DEPENDENCY_LABEL, type DependencyKind } from './knowness';
import { intakeOf } from './learn';
import { LOOK_LABEL, LOOK_TYPES, type LookType } from './flow';
import { DEFAULT_RULES, describeRules, PRESETS, readRules, type LiveRules } from './rules';
import { MOTIVATION_LABEL, MOTIVATIONS, type DependencyEdge, type Motivation, type SourceRef } from './store';
import { EntityPicker, entityName, OriginTag, useAsync, useBusy, useCtx } from './ui';

export function CogitaSettings() {
  const { lib, writes } = useCtx();
  const settings = lib.settings();
  const { busy, failed, run } = useBusy();
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [libraries, setLibraries] = useState<readonly OpenLibrary[]>([]);
  const { me } = useCtx();
  useEffect(() => {
    void loadAreas().then((r) => setAreas(r.areas)).catch(() => undefined);
    if (me !== null) void loadLibraries().then((r) => openLibraries(me.ring, r.libraries)).then(setLibraries).catch(() => undefined);
  }, [me]);
  const [tags, setTags] = useState(settings.tags.join('\n'));
  const [joinPage, setJoinPage] = useState(settings.joinPage ?? '');
  const save = (patch: Record<string, unknown>) => run(() => lib.saveSettings(patch));
  if (!writes) return <p className="wk-hint">Ustawienia bazy wiedzy zmieniają autorzy.</p>;

  return (
    <div className="cg">
      <BaseSection areas={areas} />
      <Sources libraries={libraries} areas={areas} />

      <section className="cg-card">
        <h3>Gdzie zapisują się odpowiedzi uczących się</h3>
        <p className="wk-hint">Postępy uczących się widzi ten, kto prowadzi wybrany obszar (np. nauczyciel). Bez wyboru — tylko sam uczący się.</p>
        <AreaPick label="Gdzie zapisują się odpowiedzi uczących się" areas={areas} value={settings.storageAreaId ?? ''} disabled={busy}
          extras={[{ value: '', label: 'prywatny obszar uczącego się' }]} personalLabel="mój prywatny obszar"
          onChange={(areaId) => void save({ storageAreaId: areaId || undefined })} />
        <IntakeState areaId={settings.storageAreaId ?? null} areas={areas} />
      </section>

      <section className="cg-card">
        <h3>Zgłoszenia i liczby od uczących się (anonimowo)</h3>
        <p className="wk-hint">Zgłoszone karty i liczby błędów trafiają do przyjęć obszaru tej bazy wiedzy — bez imion.</p>
        <IntakeState areaId={lib.areaId} areas={areas} />
      </section>

      <section className="cg-card">
        <h3>Motywacja</h3>
        <select value={settings.motivation} disabled={busy} onChange={(e) => void save({ motivation: e.target.value as Motivation })}>
          {MOTIVATIONS.map((m) => <option key={m} value={m}>{MOTIVATION_LABEL[m]}</option>)}
        </select>
        <p className="wk-hint">Rankingi są tylko w sesjach na żywo.</p>
      </section>

      <section className="cg-card">
        <h3>Perspektywy (tagi wiedzy)</h3>
        <textarea rows={3} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="historyczna&#10;duchowa&#10;literacka" />
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void save({ tags: tags.split('\n').map((t) => t.trim()).filter(Boolean) })}>Zapisz perspektywy</button>
      </section>

      <section className="cg-card">
        <h3>Strona dołączania do sesji</h3>
        <p className="wk-hint">Strona z modułem „Dołącz do sesji" (np. parafia/quiz). Link i kod QR sesji prowadzą tam.</p>
        <div className="cg-row">
          <input value={joinPage} onChange={(e) => setJoinPage(e.target.value)} placeholder="parafia/quiz" />
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void save({ joinPage: joinPage.trim() || undefined })}>Zapisz</button>
        </div>
      </section>

      <section className="cg-card">
        <h3>Propozycje od czytających</h3>
        <p className="wk-hint">Autorzy zmieniają bazę wprost; inni proponują wyjaśnienia i pytania, a autor je przyjmuje.</p>
        <select value={settings.contributionLibraryId ?? ''} disabled={busy} onChange={(e) => void save({ contributionLibraryId: e.target.value || undefined })}>
          <option value="">— bez propozycji —</option>
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
  const { lib, name, me } = useCtx();
  const [draft, setDraft] = useState(name);
  const [confirm, setConfirm] = useState('');
  const { busy, failed, run } = useBusy();
  const area = areas.find((a) => a.areaId === lib.areaId);
  if (me === null) return null;
  return (
    <section className="cg-card">
      <h3>Baza wiedzy</h3>
      <div className="cg-row">
        <input value={draft} aria-label="Nazwa bazy wiedzy" onChange={(e) => setDraft(e.target.value)} />
        <button type="button" className="wk-btn" disabled={busy || draft.trim() === '' || draft.trim() === name}
          onClick={() => void run(async () => { await renameLibrary(me.ring, lib, draft); window.dispatchEvent(new Event(BASES_CHANGED)); })}>Zapisz nazwę</button>
      </div>
      <p className="wk-hint">Obszar: {area?.personal === true ? 'tylko Ty' : area?.name ?? 'nieznany'} — kto ma jego klucz, uczy się z tej bazy; kto w nim pisze, ją buduje.</p>
      <details>
        <summary>Usuń bazę wiedzy</summary>
        <p className="wk-hint">Usuwa wszystkie wpisy, szablony, powtórki, przebiegi i odpowiedzi uczących się; sesje zostają, ale bez bazy. Tego nie da się cofnąć — najpierw zrób eksport (JSON).</p>
        <label className="wk-field"><span>Wpisz nazwę, żeby potwierdzić</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        <button type="button" className="wk-btn lib-btn-danger" disabled={busy || confirm.trim() !== name.trim()}
          onClick={() => void run(async () => { await deleteLibrary(lib.libraryId); window.dispatchEvent(new Event(BASES_CHANGED)); window.location.hash = viewPath('learn'); })}>Usuń na zawsze</button>
      </details>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/**
 * 0110 — ŹRÓDŁA: worauf diese Baza wiedzy verweist, auch aus anderen
 * Bereichen. Eine Bibliothek nur zum Verweisen (Werke, Zitate, Personen in
 * Feldern und Zitaten); eine andere Baza wiedzy zum Wiederverwenden. Jede liest
 * nur, wer ihren Bereich liest — der Verweis gibt nichts frei.
 */
function Sources({ libraries, areas }: { libraries: readonly OpenLibrary[]; areas: readonly AreaRow[] }) {
  const { lib, writes, sources } = useCtx();
  const { busy, failed, run } = useBusy();
  const [pick, setPick] = useState('');
  const list = lib.settings().sources;
  const loaded = new Map(lib.sourceList().map((s) => [s.store.libraryId, s]));
  const missing = new Set((sources?.missing ?? []).map((s) => s.id));
  const areaName = (id: string | undefined) => {
    const area = areas.find((a) => a.areaId === id);
    return area === undefined ? null : area.personal === true ? 'tylko Ty' : area.name;
  };
  const choices = libraries.filter((l) => l.libraryId !== lib.libraryId && !list.some((s) => s.id === l.libraryId));
  const save = (next: readonly SourceRef[]) => run(() => lib.saveSettings({ sources: next }));
  return (
    <section className="cg-card">
      <h3>Źródła</h3>
      <p className="wk-hint">
        <strong>Biblioteki</strong> — tylko do odwołań: ich dzieła, cytaty i osoby można wskazać w polach i cytować, ale nie stają się kartami.{' '}
        <strong>Inne bazy wiedzy</strong> — do wykorzystania: ich rodzaje, wpisy, szablony, powtórki i przebiegi działają tutaj, a zmienia się je u nich.
        Każde źródło widzi tylko ten, kto ma dostęp do jego obszaru.
      </p>
      {list.length === 0 ? <p className="wk-hint">Jeszcze bez źródeł.</p> : (
        <ul>
          {list.map((s) => {
            const open = loaded.get(s.id);
            const where = areaName(open?.store.areaId ?? libraries.find((l) => l.libraryId === s.id)?.areaId);
            return (
              <li key={s.id} className="cg-row">
                <strong>{s.name}</strong>
                <span className="cg-tag">{s.kind === 'books' ? 'biblioteka — do odwołań' : 'baza wiedzy — do wykorzystania'}</span>
                {where !== null && <span className="cg-muted">{where}</span>}
                {missing.has(s.id) ? <span className="cg-tag is-warn">niedostępne w tej karcie</span>
                  : open !== undefined ? <span className="cg-tag is-ok">{open.store.all().length} wpisów</span>
                  : <span className="wk-hint">wczytywanie…</span>}
                {writes && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void save(list.filter((x) => x.id !== s.id))}>usuń</button>}
              </li>
            );
          })}
        </ul>
      )}
      {writes && (
        <div className="cg-row">
          <select value={pick} aria-label="Dodaj źródło" onChange={(e) => setPick(e.target.value)}>
            <option value="">— dodaj bibliotekę albo bazę wiedzy —</option>
            {choices.map((l) => <option key={l.libraryId} value={l.libraryId}>{l.name} ({libraryKindOf(l) === 'knowledge' ? 'baza wiedzy' : 'biblioteka'}{areaName(l.areaId) === null ? '' : ` · ${areaName(l.areaId)}`})</option>)}
          </select>
          <button type="button" className="wk-btn" disabled={busy || pick === ''} onClick={() => {
            const row = libraries.find((l) => l.libraryId === pick);
            if (row === undefined) return;
            void save([...list, { id: row.libraryId, kind: libraryKindOf(row), name: row.name }]).then(() => setPick(''));
          }}>Dodaj</button>
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

function IntakeState({ areaId, areas }: { areaId: string | null; areas: readonly AreaRow[] }) {
  const { me } = useCtx();
  const [tick, setTick] = useState(0);
  const has = useAsync(areaId === null ? null : () => intakeOf(areaId).then((k) => k !== null), [areaId, tick]);
  const { busy, failed, run } = useBusy();
  const [role, setRole] = useState(me?.person.id ?? '');
  if (areaId === null) return null;
  const area = areas.find((a) => a.areaId === areaId);
  if (has === undefined) return <span className="wk-hint">Sprawdzanie przyjęć…</span>;
  if (has === true) return <span className="cg-tag is-ok">przyjęcia działają{area === undefined ? '' : ` · ${area.name}`}</span>;
  return (
    <div className="cg">
      <span className="cg-tag is-warn">ten obszar nie ma jeszcze przyjęć — odpowiedzi zobaczy tylko uczący się</span>
      {me !== null && area !== undefined && area.myLevel === 'admin' && (
        <div className="cg-row">
          <span className="cg-muted">Klucz przyjęć dla roli:</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>{me.roles.filter((r) => r.kind !== 'account').map((r) => <option key={r.id} value={r.id}>{me.names.get(r.id) ?? 'rola'}</option>)}</select>
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => { await createIntake(me.ring, areaId, role); setTick((n) => n + 1); })}>{busy ? 'Tworzenie klucza (kilka sekund)…' : 'Utwórz przyjęcia'}</button>
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

function Dependencies({ edges, busy, onSave }: { edges: readonly DependencyEdge[]; busy: boolean; onSave: (e: DependencyEdge[]) => void }) {
  const { lib } = useCtx();
  const [parent, setParent] = useState<string | null>(null);
  const [child, setChild] = useState<string | null>(null);
  const [kind, setKind] = useState<DependencyKind>('prerequisite');
  const [impact, setImpact] = useState(0.5);
  return (
    <section className="cg-card">
      <h3>Zależności</h3>
      <p className="wk-hint">„Najpierw trzeba znać" blokuje karty, dopóki podstawa nie jest opanowana; każda krawędź przekazuje część znajomości (waga) w górę.</p>
      <ul>
        {edges.map((d, i) => (
          <li key={`${d.parent}>${d.child}`} className="cg-row">
            <span>{entityName(lib, d.child)} → {entityName(lib, d.parent)} · {DEPENDENCY_LABEL[d.kind]} · waga {d.impact}</span>
            {d.proposed === true && <span className="cg-tag is-warn">propozycja</span>}
            {d.proposed === true && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onSave(edges.map((e, j) => (j === i ? { parent: e.parent, child: e.child, kind: e.kind, impact: e.impact } : e)))}>potwierdź</button>}
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onSave(edges.filter((_, j) => j !== i))}>usuń</button>
          </li>
        ))}
      </ul>
      <div className="cg-row">
        <EntityPicker lib={lib} value={child} onPick={setChild} placeholder="wpis, który zależy" />
        <select value={kind} onChange={(e) => setKind(e.target.value as DependencyKind)}>{DEPENDENCY_KINDS.map((k) => <option key={k} value={k}>{DEPENDENCY_LABEL[k]}</option>)}</select>
        <EntityPicker lib={lib} value={parent} onPick={setParent} placeholder="od czego" />
        <input type="number" min={0} max={1} step={0.1} value={impact} onChange={(e) => setImpact(Number(e.target.value))} aria-label="Waga" />
        <button type="button" className="wk-btn" disabled={busy || parent === null || child === null || parent === child} onClick={() => { onSave([...edges, { parent: parent!, child: child!, kind, impact }]); setParent(null); setChild(null); }}>Dodaj</button>
      </div>
    </section>
  );
}

interface ValueDef { readonly id: string; readonly label: string; readonly scope: 'person' | 'group' | 'session'; readonly visibility: 'all' | 'group' | 'person'; readonly min?: number; readonly max?: number; readonly initial: number; readonly score: boolean }

/** Wartości kursu [H7, F37]: punkty, bliskość postaci, zasoby — z zasięgiem, widocznością, granicami. */
function ValuesEditor() {
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
      <h3>Wartości kursu</h3>
      <p className="wk-hint">Zmieniają się podczas nauki (kroki przebiegów, postępy): punkty, bliskość postaci, zasoby. Zostają między sesjami.</p>
      {values.map((v, i) => (
        <div key={i} className="cg-row">
          <input value={v.id} onChange={(e) => set(i, { id: e.target.value.replace(/\s+/g, '_') })} aria-label="Klucz" />
          <input value={v.label} onChange={(e) => set(i, { label: e.target.value })} aria-label="Nazwa" />
          <select value={v.scope} onChange={(e) => set(i, { scope: e.target.value as ValueDef['scope'] })}><option value="person">osoby</option><option value="group">grupy</option><option value="session">sesji</option></select>
          <select value={v.visibility} onChange={(e) => set(i, { visibility: e.target.value as ValueDef['visibility'] })}><option value="all">widzą wszyscy</option><option value="group">grupa</option><option value="person">tylko osoba</option></select>
          <input type="number" value={v.initial} onChange={(e) => set(i, { initial: Number(e.target.value) })} aria-label="Na start" />
          <input type="number" value={v.min ?? ''} placeholder="min" onChange={(e) => set(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <input type="number" value={v.max ?? ''} placeholder="max" onChange={(e) => set(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <label className="pe-check"><input type="checkbox" checked={v.score} onChange={(e) => set(i, { score: e.target.checked })} /><span>punkty</span></label>
          <button type="button" className="wk-link-btn" onClick={() => setValues((x) => x.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div className="cg-row">
        <button type="button" className="wk-link-btn" onClick={() => setValues((v) => [...v, { id: `wartosc${v.length + 1}`, label: 'Nowa wartość', scope: 'person', visibility: 'person', initial: 0, score: false }])}>+ wartość</button>
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(() => lib.saveDoc('values', { values }, doc?.id))}>Zapisz wartości</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/** Własne zasady sesji [I5] — z gotowego początku, zmienione liczbami. */
function RulesTemplates() {
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  const [from, setFrom] = useState(PRESETS[0].id);
  const [chosen, setChosen] = useState<string | null>(null);
  const doc = chosen === null ? undefined : lib.docs('rules').find((e) => e.id === chosen);
  const [rules, setRules] = useState<LiveRules>(DEFAULT_RULES);
  const [name, setName] = useState('');
  useEffect(() => { if (doc !== undefined) { setRules(readRules(doc.data.rules)); setName(String(doc.data.name ?? 'Zasady')); } }, [doc?.id, doc?.version]);
  const num = (label: string, value: number, apply: (n: number) => LiveRules) => (
    <label className="wk-field"><span>{label}</span><input type="number" value={value} onChange={(e) => setRules(apply(Number(e.target.value)))} /></label>
  );
  return (
    <section className="cg-card">
      <h3>Zasady sesji na żywo</h3>
      <div className="cg-row">
        <select value={chosen ?? ''} onChange={(e) => setChosen(e.target.value || null)}>
          <option value="">— własne zasady ({lib.docs('rules').length}) —</option>
          {lib.docs('rules').map((e) => <option key={e.id} value={e.id}>{String(e.data.name ?? 'Zasady')}{lib.isOwn(e.id) ? '' : ` · z: ${lib.origin(e.id)?.name ?? '?'}`}</option>)}
        </select>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(async () => {
          const p = PRESETS.find((x) => x.id === from)!;
          const made = await lib.saveDoc('rules', { name: p.label, preset: p.id, rules: p.rules, mode: p.mode, hostView: p.hostView, participantView: p.participantView });
          setChosen(made.id);
        })}>+ z gotowych</button>
      </div>
      {doc !== undefined && (
        <div className="cg">
          <label className="wk-field"><span>Nazwa</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="cg-row">
            {num('Czas na pytanie (s)', rules.roundTimer.seconds, (n) => ({ ...rules, roundTimer: { ...rules.roundTimer, seconds: n } }))}
            {num('Po pierwszej odpowiedzi (s)', rules.actionTimer.seconds, (n) => ({ ...rules, actionTimer: { ...rules.actionTimer, seconds: n } }))}
            {num('Za dobrą odpowiedź', rules.scoring.baseCorrect, (n) => ({ ...rules, scoring: { ...rules.scoring, baseCorrect: n } }))}
            {num('Bonus za pierwszą', rules.scoring.firstCorrectBonus, (n) => ({ ...rules, scoring: { ...rules.scoring, firstCorrectBonus: n } }))}
            {num('Bonus za szybkość (max)', rules.speedBonus.maxPoints, (n) => ({ ...rules, speedBonus: { ...rules.speedBonus, maxPoints: n } }))}
            {num('Bonus za serię', rules.scoring.streakBaseBonus, (n) => ({ ...rules, scoring: { ...rules.scoring, streakBaseBonus: n } }))}
            {num('Kara za błąd', rules.scoring.wrongAnswerPenalty, (n) => ({ ...rules, scoring: { ...rules.scoring, wrongAnswerPenalty: n } }))}
          </div>
          <label className="pe-check"><input type="checkbox" checked={rules.nextQuestion.mode === 'timer'} onChange={(e) => setRules({ ...rules, nextQuestion: { ...rules.nextQuestion, mode: e.target.checked ? 'timer' : 'manual' } })} /><span>następne pytanie samo</span></label>
          <ul className="cg-muted">{describeRules(readRules(rules)).map((l, i) => <li key={i}>{l}</li>)}</ul>
          {lib.isOwn(doc.id)
            ? <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(() => lib.saveDoc('rules', { ...doc.data, name: name.trim() || 'Zasady', rules: readRules(rules) }, doc.id))}>Zapisz zasady</button>
            : <p className="wk-hint">Te zasady są z „{lib.origin(doc.id)?.name}” — działają tutaj, zmienia się je tam.</p>}
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/** Wygląd [G4, G8]: rodzaj (czytanie, slajdy, …), co pokazać z każdego rodzaju wpisu, przejścia z ruchu 0107. */
function Looks() {
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  return (
    <section className="cg-card">
      <h3>Wyglądy</h3>
      <p className="wk-hint">Wygląd mówi, jak przebieg pokazuje kroki i co widać z każdego rodzaju wpisu (np. karta osoby: imię, lata, portret).</p>
      <ul>
        {lib.docs('look').filter((e) => !lib.isOwn(e.id)).map((e) => (
          <li key={e.id} className="cg-row"><span>{String(e.data.name ?? 'Wygląd')}</span> <OriginTag id={e.id} /></li>
        ))}
        {lib.docs('look').filter((e) => lib.isOwn(e.id)).map((e) => (
          <li key={e.id} className="cg-row">
            <input defaultValue={String(e.data.name ?? 'Wygląd')} onBlur={(ev) => void run(() => lib.saveDoc('look', { ...e.data, name: ev.target.value }, e.id))} aria-label="Nazwa" />
            <select defaultValue={String(e.data.type ?? 'reading')} onChange={(ev) => void run(() => lib.saveDoc('look', { ...e.data, type: ev.target.value as LookType }, e.id))}>
              {LOOK_TYPES.map((l) => <option key={l} value={l}>{LOOK_LABEL[l]}</option>)}
            </select>
            <input defaultValue={String(e.data.transition ?? '')} placeholder="przejście (np. fade, slide)" onBlur={(ev) => void run(() => lib.saveDoc('look', { ...e.data, transition: ev.target.value }, e.id))} />
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => lib.remove(e.id))}>usuń</button>
          </li>
        ))}
      </ul>
      <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => lib.saveDoc('look', { name: 'Nowy wygląd', type: 'reading', kinds: {} }))}>+ wygląd</button>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
