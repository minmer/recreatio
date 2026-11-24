/**
 * 2026-11-24 (Eigentümer: „als Lehrer auf der Karte wählen, was die Schüler sehen — Pfade, Türme, Kreuzungen an- und abwählen") —
 * DIE KARTE IM WAHL-MODUS FÜR EINE KLASSE.
 *
 * Die Karte zeigt die GANZE Welt; was die Klasse nicht sieht, steht grau (Türme) und grau gestrichelt (Pfade), Wegweiser blass. Ein
 * Klick schaltet um: einen Turm, einen Abschnitt eines Pfades (ein Zweig einer Gabelung allein), eine Gabelung (alle ihre Zweige),
 * einen Wegweiser; „Cała opowieść" die ganze Erzählung des zuletzt gewählten Pfades. Was die Klasse sieht, ist dieselbe Rechnung wie
 * auf der Klassenseite (`classWorldInput`) — die Lehrerin sieht genau das. Ein Turm, dessen Voraussetzungen fehlen, holt sie mit (mit
 * einem Satz); ein Pfad zu einem ausgeblendeten Turm ist von selbst grau. Speichern schreibt den Widok der Klasse (`setClassView`,
 * `landscape.only` mit `hidePlaces`, `hideFlows`, `hideSections`, `hideSigns`); die Liste unter „Świat klasy" bearbeitet dasselbe.
 *
 * Wege hinein: das Menü der Karte (☰ → „Widoczne dla klasy…", nur wer die Baza schreibt und Klassen leitet) und „Wybierz na mapie"
 * im Editor der Teilwelt (über `sessionStorage`: die Karte der Baza öffnet sich gleich im Wahl-Modus).
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { T } from '../../core/i18n';
import type { Me } from '../../core/me';
import type { CogitaLibrary } from '../store';
import { myClasses } from '../classes/classes';
import { classOnly, classWorldInput, sectionKey, sectionStep, setClassView, subWorldPlaces } from '../classes/subWorld';
import type { HiddenSection, LandscapeOnly } from '../views';
import { readWorld } from './wmGraph';
import { linesOf } from './wmLines';
import { worldTags } from './wmTags';
import type { Lines, Section, World, WorldInput } from './wmTypes';

/** Was „Wybierz na mapie" der Karte übergibt (sie öffnet sich danach). */
export const SELECT_HANDOFF = 'cg-wm-select';
export const handOffSelect = (library: string, klass: { readonly areaId: string; readonly name: string }): void => {
  try { sessionStorage.setItem(SELECT_HANDOFF, JSON.stringify({ library, areaId: klass.areaId, name: klass.name })); } catch { /* ohne Speicher: dann über das Menü */ }
};

interface Target { readonly areaId: string; readonly name: string }

const EMPTY: LandscapeOnly = { tags: [], places: [], withBase: true };
const sameKey = (h: HiddenSection) => `${h.flow}#${h.step}`;

export interface ClassSelect {
  readonly active: boolean;
  readonly start: (klass: Target) => void;
  /** Die Klassen für das Menü (leer: keine Lehrerin dieser Baza). */
  readonly classes: readonly Target[];
  readonly bar: ReactNode;
  readonly lit: ReadonlySet<string> | null;
  readonly hiddenLanes: ReadonlySet<string> | null;
  readonly signOff: (paths: readonly string[]) => boolean;
  readonly pickPlace: (id: string) => void;
  readonly pickLane: (section: string) => void;
  readonly pickJunction: (id: string) => void;
  readonly pickSign: (paths: readonly string[]) => void;
}

export function useClassSelect({ lib, me, writes, input, world, viewKey, t }: {
  lib: CogitaLibrary;
  /** Die Karte, auf der gewählt wird (ein Widok der Baza: seine Abschrift wird der Widok der Klasse). */
  viewKey: string;
  me: Me | null;
  writes: boolean;
  /** Der Eingang der GANZEN Welt (ohne Teilwelt). */
  input: WorldInput;
  world: World;
  t: T;
}): ClassSelect {
  const [target, setTarget] = useState<Target | null>(null);
  const [draft, setDraft] = useState<LandscapeOnly>(EMPTY);
  const [undo, setUndo] = useState<readonly LandscapeOnly[]>([]);
  const [lastLine, setLastLine] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [classes, setClasses] = useState<readonly Target[]>([]);

  /* Die Klassen dieser Baza, die ich leite — nur, wer die Baza schreibt (der Widok liegt in ihr). */
  useEffect(() => {
    if (me === null || !writes) { setClasses([]); return undefined; }
    let alive = true;
    void myClasses(true, lib.libraryId).then((list) => { if (alive) setClasses(list.map((c) => ({ areaId: c.areaId, name: c.name }))); }, () => undefined);
    return () => { alive = false; };
  }, [me, writes, lib.libraryId]);

  const start = (klass: Target) => {
    setTarget(klass);
    setDraft(classOnly(lib, klass.areaId) ?? EMPTY);
    setUndo([]);
    setLastLine(null);
    setNote(null);
  };
  /* „Wybierz na mapie" im Editor der Teilwelt: gleich im Wahl-Modus. */
  useEffect(() => {
    if (!writes) return;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(SELECT_HANDOFF); } catch { raw = null; }
    if (raw === null) return;
    try {
      const v = JSON.parse(raw) as { library?: string; areaId?: string; name?: string };
      if (v.library?.toLowerCase() !== lib.libraryId.toLowerCase() || typeof v.areaId !== 'string') return;
      try { sessionStorage.removeItem(SELECT_HANDOFF); } catch { /* egal */ }
      start({ areaId: v.areaId, name: v.name ?? '' });
    } catch { /* ein kaputter Eintrag: nichts */ }
  }, [writes, lib.libraryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = target !== null;
  const net = useMemo(() => worldTags(world), [world]);
  const fullLines: Lines | null = useMemo(() => (active ? linesOf(world, input.flows) : null), [active, world, input]);
  /* Was die Klasse mit dieser Wahl sieht — dieselbe Rechnung wie auf der Klassenseite. */
  const seen = useMemo(() => {
    if (!active || fullLines === null) return null;
    const restricted = classWorldInput(input, world, net, draft, fullLines);
    if (restricted === null) return { places: new Set(world.places.keys()), keys: null as ReadonlySet<string> | null, lines: null as ReadonlySet<string> | null };
    const w = readWorld(restricted);
    const l = linesOf(w, restricted.flows);
    const keys = new Set<string>();
    for (const s of l.sections.values()) { const k = sectionKey(s); if (k !== null) keys.add(k); }
    return { places: new Set(w.places.keys()), keys: keys as ReadonlySet<string> | null, lines: new Set(l.lines.keys()) as ReadonlySet<string> | null };
  }, [active, fullLines, input, world, net, draft]);

  const isHidden = (s: Section): boolean => {
    if (seen === null) return false;
    if (seen.keys === null || seen.lines === null) return false;
    const k = sectionKey(s);
    if (k !== null) return !seen.keys.has(k);
    const off = (id: string) => world.places.has(id) && !seen.places.has(id);
    return !seen.lines.has(s.line) || off(s.to) || off(s.from);
  };
  const hiddenLanes = useMemo(() => {
    if (!active || fullLines === null || seen === null) return null;
    const out = new Set<string>();
    for (const s of fullLines.sections.values()) if (isHidden(s)) out.add(s.id);
    return out as ReadonlySet<string>;
  }, [active, fullLines, seen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -- Umschalten ------------------------------------------------------------------------------------------------------------ */
  const change = (next: LandscapeOnly, said: string | null = null) => { setUndo((u) => [...u.slice(-40), draft]); setDraft(next); setNote(said); };
  const without = <X,>(list: readonly X[] | undefined, drop: (x: X) => boolean): X[] => (list ?? []).filter((x) => !drop(x));
  const including = (d: LandscapeOnly) => d.tags.length > 0 || d.places.length > 0;

  /** Einen Turm (und, was er voraussetzt) sichtbar machen — gibt die neue Wahl und wie viele Voraussetzungen dazukamen. */
  const showPlaces = (d: LandscapeOnly, ids: readonly string[]): { next: LandscapeOnly; added: number } => {
    const want = new Set(ids);
    const before = subWorldPlaces(world, net, d) ?? new Set(world.places.keys());
    let added = 0;
    for (const id of ids) for (const b of world.base(id)) if (world.places.has(b) && !before.has(b) && !want.has(b)) { want.add(b); added += 1; }
    let next: LandscapeOnly = { ...d, hidePlaces: without(d.hidePlaces, (x) => want.has(x)) };
    if (including(next)) {
      const now = subWorldPlaces(world, net, next) ?? new Set(world.places.keys());
      const missing = [...want].filter((x) => !now.has(x));
      if (missing.length > 0) next = { ...next, places: [...next.places, ...missing] };
    }
    return { next, added };
  };

  const pickPlace = (id: string) => {
    if (seen === null || !world.places.has(id)) return;
    if (seen.places.has(id)) {
      change({ ...draft, places: draft.places.filter((x) => x !== id), hidePlaces: [...(draft.hidePlaces ?? []), id] });
      return;
    }
    const { next, added } = showPlaces(draft, [id]);
    change(next, added > 0 ? t('cogitaClassMap.addedBase', { count: added }) : null);
  };

  const showSection = (d: LandscapeOnly, s: Section): LandscapeOnly => {
    const step = sectionStep(s);
    let next: LandscapeOnly = { ...d, hideFlows: without(d.hideFlows, (x) => x === s.line), hideSections: without(d.hideSections, (h) => step !== null && h.flow === s.line && h.step === step) };
    /* Der Turm am Ende (und vorne) muss dabei sein. */
    const ends = [s.from, s.to].filter((x) => world.places.has(x));
    const shown = subWorldPlaces(world, net, next) ?? new Set(world.places.keys());
    if (ends.some((x) => !shown.has(x))) next = showPlaces(next, ends).next;
    return next;
  };

  const pickLane = (sectionId: string) => {
    const s = fullLines?.sections.get(sectionId);
    if (s === undefined) return;
    setLastLine(s.line);
    if (!isHidden(s)) {
      const step = sectionStep(s);
      if (step === null) { change({ ...draft, hideFlows: [...(draft.hideFlows ?? []), s.line] }, t('cogitaClassMap.wholeStoryHidden')); return; }
      change({ ...draft, hideSections: [...(draft.hideSections ?? []), { flow: s.line, step }] });
      return;
    }
    let next = showSection(draft, s);
    /* Noch immer grau: ein Abschnitt davor ist aus — dann diese Erzählung ganz wieder ein. */
    const probe = classWorldInput(input, world, net, next, fullLines ?? undefined);
    const key = sectionKey(s);
    if (probe !== null && key !== null) {
      const w = readWorld(probe);
      const visible = [...linesOf(w, probe.flows).sections.values()].some((x) => sectionKey(x) === key);
      if (!visible) { next = { ...next, hideSections: without(next.hideSections, (h) => h.flow === s.line) }; change(next, t('cogitaClassMap.storyReopened')); return; }
    }
    change(next);
  };

  const pickJunction = (id: string) => {
    const j = fullLines?.junctions.get(id);
    if (j === undefined || fullLines === null) return;
    const outs = j.out.map((x) => fullLines.sections.get(x)).filter((x): x is Section => x !== undefined);
    if (outs.length === 0) return;
    setLastLine(j.line);
    if (outs.some((s) => !isHidden(s))) {
      const add: HiddenSection[] = [];
      for (const s of outs) { const step = sectionStep(s); if (step !== null && !isHidden(s)) add.push({ flow: s.line, step }); }
      const had = new Set((draft.hideSections ?? []).map(sameKey));
      change({ ...draft, hideSections: [...(draft.hideSections ?? []), ...add.filter((h) => !had.has(sameKey(h)))] }, t('cogitaClassMap.forkHidden', { count: add.length }));
      return;
    }
    let next = draft;
    for (const s of outs) next = showSection(next, s);
    change(next, t('cogitaClassMap.forkShown', { count: outs.length }));
  };

  const signOff = useCallback((paths: readonly string[]) => paths.length > 0 && paths.every((p) => (draft.hideSigns ?? []).includes(p)), [draft]);
  const signOffShown = useCallback((paths: readonly string[]) => active && signOff(paths), [active, signOff]);
  const pickSign = (paths: readonly string[]) => {
    if (paths.length === 0) return;
    change(signOff(paths) ? { ...draft, hideSigns: without(draft.hideSigns, (x) => paths.includes(x)) } : { ...draft, hideSigns: [...without(draft.hideSigns, (x) => paths.includes(x)), ...paths] });
  };

  const wholeStory = (line: string) => {
    const hidden = (draft.hideFlows ?? []).includes(line);
    change(hidden ? { ...draft, hideFlows: without(draft.hideFlows, (x) => x === line), hideSections: without(draft.hideSections, (h) => h.flow === line) } : { ...draft, hideFlows: [...(draft.hideFlows ?? []), line] });
  };

  const save = async () => {
    if (target === null) return;
    setBusy(true);
    try {
      await setClassView(lib, target, draft, t('cogitaSubWorld.viewName', { name: target.name }), viewKey);
      setTarget(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t('cogitaClassMap.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  /* -- Der Balken ------------------------------------------------------------------------------------------------------------- */
  const total = world.places.size;
  const shownPlaces = seen?.places.size ?? total;
  const laneTotal = fullLines === null ? 0 : [...fullLines.sections.values()].filter((s) => s.kind !== 'return').length;
  const laneShown = fullLines === null ? 0 : laneTotal - [...fullLines.sections.values()].filter((s) => s.kind !== 'return' && (hiddenLanes?.has(s.id) ?? false)).length;
  const lineName = lastLine === null ? null : fullLines?.lines.get(lastLine)?.name ?? null;
  const lineOff = lastLine !== null && (draft.hideFlows ?? []).includes(lastLine);

  const bar: ReactNode = !active ? null : (
    <section className="cg-wm-selbar" role="region" aria-label={t('cogitaClassMap.title', { name: target.name })} data-class-select={target.areaId}
      data-class-select-places={`${shownPlaces}/${total}`} data-class-select-lanes={`${laneShown}/${laneTotal}`}>
      <p className="cg-wm-selhead"><strong>{t('cogitaClassMap.title', { name: target.name })}</strong></p>
      <p className="cg-wm-selcount">{t('cogitaClassMap.counts', { places: shownPlaces, total, lanes: laneShown, lanesTotal: laneTotal })}</p>
      <p className="cg-muted cg-wm-selhint">{t('cogitaClassMap.hint')}</p>
      {lineName !== null && (
        <p className="cg-wm-selstory">
          <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => wholeStory(lastLine!)} data-class-select-story={lastLine}>
            {lineOff ? t('cogitaClassMap.showStory', { name: lineName }) : t('cogitaClassMap.hideStory', { name: lineName })}
          </button>
        </p>
      )}
      {note !== null && <p className="wk-note cg-wm-selnote" role="status" data-class-select-note="">{note}</p>}
      <div className="wk-actions cg-wm-selacts">
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void save()} data-class-select-save="">{t('cogitaClassMap.save')}</button>
        <button type="button" className="wk-btn wk-btn-line" disabled={busy} onClick={() => setTarget(null)} data-class-select-cancel="">{t('cogitaClassMap.cancel')}</button>
        <button type="button" className="wk-link-btn" disabled={undo.length === 0} onClick={() => { const last = undo[undo.length - 1]; if (last !== undefined) { setDraft(last); setUndo((u) => u.slice(0, -1)); setNote(null); } }} data-class-select-undo="">↶ {t('cogitaClassMap.undo')}</button>
        <button type="button" className="wk-link-btn" onClick={() => change(EMPTY)} data-class-select-all="">{t('cogitaClassMap.all')}</button>
        <button type="button" className="wk-link-btn" onClick={() => change({ ...EMPTY, hidePlaces: [...world.places.keys()] })} data-class-select-none="">{t('cogitaClassMap.none')}</button>
      </div>
    </section>
  );

  return {
    active,
    start,
    classes,
    bar,
    lit: active && seen !== null ? seen.places : null,
    hiddenLanes,
    signOff: signOffShown,
    pickPlace,
    pickLane,
    pickJunction,
    pickSign
  };
}
