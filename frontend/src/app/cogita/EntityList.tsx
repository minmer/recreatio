/**
 * COGITA — DIE EINTRÄGE (COGITA.md §2.3, [F2, F3, F7]): als Tabelle mit
 * Spalten, Filtern und Sortierung, als Baum nach Arten (und Themen), als
 * Leinwand, deren Plätze alle Autoren teilen. Ein Widok merkt sich Filter,
 * Spalten und Sortierung — und lässt sich als Link weitergeben.
 *
 * 2026-10-22 (Schritt 9) — der Widok ist das Dokument aus `views.ts`: eine
 * Auswahl in Schritten (dieselben wie in der Powtórka, `selection.ts`),
 * Gruppen für das Drzewo; derselbe Widok steht als Baustein „Widok" auf einer
 * Seite. „Rodzaj" und „Filtr" oben sind Abkürzungen in seine Schritte.
 *
 * 2026-10-22 (Schritt 10) — die Macierz (Zeilen × Spalten, ein Feld öffnet
 * sich darunter) und, wer schreiben darf, die Taten (`viewActions.ts`): ein
 * neuer Eintrag mit dem Zusammenhang des Feldes, die Einträge an den Plan eines
 * Kazanie, eine Powtórka aus dem Widok oder aus einem Feld.
 */

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node, type NodeChange } from 'reactflow';
import 'reactflow/dist/style.css';

import { MenuButton } from '../ui/Menu';
import { TexText } from '../ui/tex/Tex';
import { fieldsOf, fieldText, valuesOf, type Entity } from './schema';
import { SelectionBar } from './EntitySelection';
import { RuleEditor } from './RuleEditor';
import { OriginTag, useAsyncKeep, useBusy, useCtx } from './ui';
import { axisColumns, ViewSteps } from './ViewSteps';
import {
  AXIS_COLUMN, cellKey, cellText, groupTitle, KNOWING_COLUMNS, LIST_MODE_LABEL, needsKnowing, readView, ruleOf, sourceKind, viewColumns, viewFrom, viewGroups, viewJson, viewList, viewMatrix, viewOutline,
  withKnowing, withRule, withSourceKind, type OutlineDisplay, type ViewDoc, type ViewLib
} from './views';
import { gaugeFromMarks, withFlows } from './knowing';
import { learnerFlows } from './flowFacts';
import { renamer, answeredCards } from './learn';
import { answerIndex } from './measures';
import { QuiltView } from './QuiltView';
import { LandscapeView } from './LandscapeView';
import { useRunRewards } from './RewardsEditor';
import { clipTex } from './texClip';
import { StructureView } from './StructureView';
import type { Group } from './selection';
import { MatrixGrid } from './MatrixGrid';
import { addToPlan, contextOf, createHere, learn, learnFromView } from './viewActions';
import { containerPath } from '../library/library';
import { ask, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';

export type { ListMode } from './views';

/**
 * 2026-11-03 — WAS MAN AN EINEM WIDOK GEÄNDERT, ABER NICHT GESPEICHERT HAT (Modus, Budget und Anteile des Krajobraz,
 * Filter …), je Baza und Widok: ein anderer Reiter und zurück — oder ein Neuladen — findet es wieder. Gilt nur, solange
 * der gespeicherte Widok derselbe ist (`base`); nach dem Speichern fällt es weg.
 */
const drafts = new Map<string, { readonly base: string; readonly view: ViewDoc }>();
/** 2026-11-03 — ob „Dostosuj“ offen stand (die Eingaben des Krajobraz stehen darin) — je Widok, wie der Entwurf. */
const adjustOpen = new Map<string, boolean>();
const draftKey = (libraryId: string, viewId: string | null, design: boolean) => `${libraryId}:${design ? 'design:' : ''}${viewId ?? '-'}`;
function readDraft(key: string, base: string): ViewDoc | undefined {
  const here = drafts.get(key);
  if (here !== undefined) return here.base === base ? here.view : undefined;
  try {
    const raw = sessionStorage.getItem(`cg-view-draft:${key}`);
    if (raw === null) return undefined;
    const got = JSON.parse(raw) as { base?: unknown; view?: unknown };
    return got.base === base && typeof got.view === 'object' && got.view !== null ? readView(got.view) : undefined;
  } catch { return undefined; }
}
function keepDraft(key: string, base: string, view: ViewDoc | null): void {
  if (view === null) drafts.delete(key); else drafts.set(key, { base, view });
  try {
    if (view === null) sessionStorage.removeItem(`cg-view-draft:${key}`);
    else sessionStorage.setItem(`cg-view-draft:${key}`, JSON.stringify({ base, view: viewJson(view) }));
  } catch { /* ohne Speicher des Tabs: nur im Speicher dieser Seite */ }
}

/**
 * 2026-10-24 (Wiedza) — ZWEI GESTALTEN DERSELBEN LISTE. In „Wpisy" steht das Wissen vorn:
 * suchen, ein Rodzaj, ein Sposób wyświetlania — und „Dostosuj" für den, der mehr will (was
 * gezeigt wird: Filtr, Wybór i grupy; wie: Tabela, Drzewo, Macierz, Płótno). In „Schematy →
 * Sposoby wyświetlania" (`design`) wird ein Sposób gebaut: Name, dieselben Teile offen, Zapisz,
 * Usuń — und darunter, was er zeigt. Hinzugefügt wird in „Dodaj", nicht hier.
 */
export function EntityList({ viewId, startAt = null, onOpen, onView, onAdd, onDesign, design = false, onSaved, onRemoved }: {
  viewId: string | null;
  /** 2026-10-25 (Wywód) — der Widok, geöffnet an diesem Eintrag (`wpisy/widok/<widok>/<eintrag>`, ein Wejście z Biblioteki). */
  startAt?: string | null;
  onOpen: (id: string) => void;
  onView: (id: string | null) => void;
  /** Zum Reiter „Dodaj". */
  onAdd?: () => void;
  /** Diesen Sposób wyświetlania bauen (Schematy). */
  onDesign?: (id: string | null) => void;
  design?: boolean;
  onSaved?: (id: string) => void;
  onRemoved?: () => void;
}) {
  const { lib, writes, href, learner } = useCtx();
  const saved = viewId === null ? undefined : lib.docs('view').find((e) => e.id === viewId);
  /* 2026-11-03 — ein nicht gespeicherter Stand dieses Widoku kommt wieder (`drafts`). */
  const dKey = draftKey(lib.libraryId, viewId, design);
  const dBase = saved === undefined ? '' : `${saved.id}:${saved.version}`;
  const [view, setView] = useState<ViewDoc>(() => readDraft(dKey, dBase) ?? readView(saved?.data ?? { mode: 'table', ...(design ? { name: 'Nowy sposób wyświetlania' } : {}) }));
  const [shownFor, setShownFor] = useState(viewId);
  if (shownFor !== viewId) { setShownFor(viewId); setView(readDraft(dKey, dBase) ?? readView(saved?.data ?? { mode: 'table' })); }
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    keepDraft(dKey, dBase, view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const { busy, failed, run } = useBusy();
  const look = lib.look;
  /* 2026-10-18 — zaznaczone wpisy: bleiben über Seiten und Filter hinweg gewählt, bis man sie abwählt. */
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (picked.size === 0) return undefined;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setPicked(new Set()); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [picked.size]);

  /* 2026-10-25 — an einem Eintrag geöffnet: was vor dem ersten „Idź po…" steht, ist dieser Eintrag. */
  const start = startAt === null ? undefined : lib.entity(startAt);
  const shown = useMemo(() => (start === undefined ? view : viewFrom(view, start.id)), [view, start?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /*
    2026-10-30 — DIE KENNTNIS DES BETRACHTERS, nur wenn der Widok sie braucht (Filtr znajomości, Spalten oder
    Reihenfolge daraus): der Lernende dieses Kontos — ein Autor, der eine Tabelle ansieht, sieht seine eigene.
  */
  const wants = needsKnowing(shown);
  /* 2026-11-01 — die Mapa postępów braucht die Karten immer (die Kenntnis jedes Eintrags und seine Fragen). */
  const quilt = view.mode === 'quilt';
  /* 2026-11-03 — der Krajobraz braucht die Karten immer (wer Karten hat, ist lernbar; die Kenntnis jedes Eintrags). */
  const landscape = view.mode === 'landscape';
  /* 2026-11-03 — die Karten bleiben stehen, solange neue gerechnet werden (sonst wiche der Krajobraz einem „Liczenie…" und verlöre alles). */
  const [knowCards, knowBusy] = useAsyncKeep(wants || quilt || landscape ? () => lib.cards('learn').then((r) => r.cards) : null, [wants, quilt, landscape, lib.revision], () => lib.cardsReady('learn'));
  /* Punkte und Serie im Lauf aus dem Krajobraz — wenn die Nauka dieser Baza sie zählt. */
  const runRewards = useRunRewards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ownAnswers = useMemo(() => (learner == null ? () => [] : answerIndex(learner.progress, renamer(lib.merges()))), [learner, learner?.progress, lib]);
  const knowing = useMemo(() => {
    if (!wants || knowCards === null || knowCards === undefined) return null;
    const rename = renamer(lib.merges());
    const fp = new Map(knowCards.map((c) => [c.key, c.fingerprint]));
    const page = learner === null || learner === undefined ? [] : answeredCards(learner.progress, new Set(fp.keys()));
    return withFlows(gaugeFromMarks([...knowCards, ...page], (key) => learner?.marks(key, fp.get(key), rename) ?? [], lib.dependencies(), Date.now(), lib.prerequisites()), learnerFlows(lib, learner?.progress.positions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wants, knowCards, learner, learner?.progress, lib.revision]);
  const vlib = useMemo(() => withKnowing(lib, knowing), [lib, knowing]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => viewList(vlib, shown), [vlib, lib.revision, shown.query, JSON.stringify(shown.steps), JSON.stringify(shown.sort)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => (view.mode === 'tree' && view.group !== null ? viewGroups(vlib, view, list) : null), [list, view.mode, JSON.stringify(view.group)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const matrix = useMemo(() => (view.mode === 'matrix' ? viewMatrix(vlib, view, list) : null), [list, view.mode, JSON.stringify(view.matrix)]);
  const [cell, setCell] = useState<{ row: string; col: string } | null>(null);
  const cellIds = matrix === null || cell === null ? [] : matrix.cell(cell.row, cell.col);

  const quickKind = sourceKind(view);
  const kind = quickKind === null || quickKind === '' ? undefined : lib.kind(quickKind);
  const shownColumns = viewColumns(vlib, view, list);
  const columns = view.columns.length > 0 ? view.columns : kind !== undefined ? kind.fields.filter((f) => f.type !== 'markup' && f.type !== 'text').slice(0, 4).map((f) => f.key) : shownColumns.map((f) => f.key);
  const chooserFields = [
    ...(kind !== undefined ? kind.fields.map((f) => ({ key: f.key, label: f.label }))
      : [...new Map(list.slice(0, 200).flatMap((e) => fieldsOf(e, look)).filter((f) => f.type !== 'markup' && f.type !== 'blocks').map((f) => [f.key, { key: f.key, label: f.label }])).values()]),
    /* 2026-10-22 (Schritt 10) — eine Achse als Spalte; 2026-10-23: ein Rodzaj — die Werte, auf die der Eintrag zeigt. */
    ...axisColumns(lib),
    /* 2026-10-30 — wie gut der Betrachter den Eintrag kann, wann er wieder dran ist, auf welchem Poziom nauki. */
    ...KNOWING_COLUMNS
  ];
  const label = (key: string) => (key.startsWith(AXIS_COLUMN) ? chooserFields.find((f) => f.key === key)?.label.replace(/ \(oś\)$/, '') ?? key
    : KNOWING_COLUMNS.find((c) => c.key === key)?.label);

  /* Die Taten (Schritt 10) — nur, wer schreiben darf. */
  const here = (row: string, col: string) => run(async () => {
    if (matrix === null || view.matrix === null) return;
    const r = matrix.rows.find((g) => g.key === row);
    const c = matrix.cols.find((g) => g.key === col);
    if (r === undefined || c === undefined) return;
    const context = contextOf([{ grouping: view.matrix.rows, group: r }, { grouping: view.matrix.cols, group: c }]);
    const made = await createHere(lib, view, context);
    toast(`Nowy wpis: ${context.words.join(' × ')}`);
    if (made.inLibrary) window.location.hash = containerPath(made.libraryId, made.id);
    else onOpen(made.id);
  });
  /* Do planu kazania: die Texte der Bibliotheken, aus denen die Baza schöpft. */
  const texts = useMemo(() => [...lib.material('text')].sort((a, b) => lib.label(a).localeCompare(lib.label(b), 'pl')), [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const [planText, setPlanText] = useState('');
  const toPlan = (ids: readonly string[]) => run(async () => {
    const text = texts.find((t) => t.id === planText);
    if (text === undefined) return;
    const n = await addToPlan(lib, text.id, ids);
    toast(`Dodano ${n} punktów do planu „${lib.label(text)}”.`);
  });
  const toRevision = (ids?: readonly string[], name?: string) => run(async () => {
    /* 2026-10-25 — geöffnet an einem Eintrag: gelernt wird, was da steht (sein Teil der Struktur), nicht der ganze Widok. */
    const id = await learn(lib, start === undefined ? view : { ...shown, name: `${view.name}: ${lib.label(start)}`.slice(0, 120) }, ids, name);
    window.location.hash = href('powtorki', id);
  });
  const setV = (patch: Partial<ViewDoc>) => setView((v) => ({ ...v, ...patch }));
  const rule = ruleOf(view);

  const saveView = (asNew: boolean) => run(async () => {
    /* Ein neuer aus „Wpisy": gespeichert mit einem Namen aus dem Rodzaj — benannt und weiter gebaut wird er in den Schematy. */
    const name = design || !asNew ? view.name : view.name === 'Widok' ? `${kind?.name ?? 'Wpisy'} — widok` : view.name;
    const doc = viewJson({ ...view, name: name.trim() || 'Widok' });
    const done = await lib.saveDoc('view', doc, asNew ? undefined : viewId ?? undefined);
    keepDraft(dKey, dBase, null);
    if (design) { toast('Zapisano sposób wyświetlania.'); onSaved?.(done.id); return; }
    if (asNew && onDesign !== undefined) { toast(`Zapisano „${name}” — tu możesz zmienić nazwę i ustawienia.`); onDesign(done.id); return; }
    onView(done.id);
  });
  const removeView = () => run(async () => {
    if (viewId === null) return;
    if (!(await ask({ title: `Usunąć sposób wyświetlania „${view.name}”?`, body: 'Wpisy zostają; znika tylko ten sposób pokazywania ich (także z modułów „Widok" na stronach).', confirm: 'Usuń', danger: true }))) return;
    await lib.remove(viewId);
    onRemoved?.();
  });
  const layout = (
    <span className="cg-subtabs" role="group" aria-label="Układ">
      {(['table', 'tree', 'outline', 'matrix', 'canvas', 'quilt', 'landscape'] as const).map((m) => <button key={m} type="button" className={view.mode === m ? 'is-on' : ''} aria-pressed={view.mode === m} data-mode={m} onClick={() => setV({ mode: m, ...(m === 'matrix' && view.matrix === null ? { matrix: { rows: view.group ?? { by: 'kind' }, cols: { by: 'kind' } } } : {}) })}>{LIST_MODE_LABEL[m]}</button>)}
    </span>
  );
  /* „Co pokazać" (die Auswahl) und „Jak pokazać" (die Gestalt) — getrennt gesagt, zusammen gespeichert. */
  const adjust = (
    <>
      <div className="cg-adjust-part">
        <h4 className="cg-adjust-h">Co pokazać</h4>
        {/* 2026-10-25 — geöffnet an einem Eintrag: Filtr und Wybór vor dem ersten „Idź po…" ersetzt dieser Eintrag; geändert werden sie im ganzen Widok. */}
        {start !== undefined && viewId !== null ? (
          <p className="cg-muted" data-view-start-note="">Widok otwarty od jednego wpisu — filtr, wybór, wyszukiwanie i rodzaj działają w całym sposobie wyświetlania. <a className="wk-link-btn" href={href('wpisy', 'widok', viewId)}>Pokaż cały</a></p>
        ) : (
          <>
            <details open={design || undefined}>
              <summary>Filtr {rule !== null && rule.items.length > 0 ? `(${rule.items.length})` : ''}</summary>
              <RuleEditor rule={rule ?? { op: 'and', items: [] }} onChange={(next) => setView(withRule(view, next))} />
            </details>
            <details open={design || undefined}>
              <summary>Wybór — także po odwołaniach — i grupy {view.steps.length > 1 || quickKind === null ? `(${view.steps.length} ${view.steps.length === 1 ? 'krok' : 'kroki'})` : ''}</summary>
              <ViewSteps view={view} onChange={setView} />
            </details>
          </>
        )}
      </div>
      <div className="cg-adjust-part">
        <h4 className="cg-adjust-h">Jak pokazać</h4>
        {layout}
        {view.mode === 'outline' && <OutlineSettings value={view.outline} fields={chooserFields.filter((f) => !f.key.startsWith(AXIS_COLUMN))} onChange={(outline) => setV({ outline })} />}
        {landscape && (
          <div className="cg-row" data-landscape-settings="">
            {/* 2026-11-04 (Prompt 11) — die Gebiete kommen aus den Verbindungen; Namen und Verschiebungen ändert der Besitzer auf der Karte selbst. */}
            <p className="cg-muted">Krajobraz to świat obszarów: obszary tworzą się same z tego, co od czego zależy („Najpierw trzeba znać”) — tematy, które wiele łączy, leżą razem. Na każdym poziomie widać kilka do kilkunastu pól; dotknięcie obszaru otwiera jego mapę. Wysokość to liczba stopni do pokonania: dolina — umiesz, jeden stopień — możesz zacząć teraz. Nazwę obszaru zmienisz na mapie („Zmień nazwę”), a temat przeniesiesz do innego obszaru w jego okienku.</p>
          </div>
        )}
        {quilt && <p className="cg-muted" data-quilt-hint="">Mapa postępów: każdy wpis to kafelek w kolorze tego, jak dobrze go znasz — pogrupowany jak w „Wybór i grupy” (np. idee według lekcji, lekcje pod rozdziałami). Uczący się widzą ją w Postępach i w module „Widok” na stronie.</p>}
      </div>
    </>
  );

  return (
    <div className="cg">
      {design && (
        <div className="cg-row" data-view-design="">
          <label className="wk-field cg-grow">
            <span>Nazwa sposobu wyświetlania</span>
            <input value={view.name} disabled={!writes} onChange={(e) => setV({ name: e.target.value })} />
          </label>
          {writes && <button type="button" className="wk-btn" disabled={busy} onClick={() => void saveView(viewId === null)}>{viewId === null ? 'Utwórz' : 'Zapisz'}</button>}
          {viewId !== null && <a className="wk-link-btn" href={href('wpisy', 'widok', viewId)}>Zobacz we Wpisach</a>}
          {writes && viewId !== null && <button type="button" className="wk-link-btn wk-danger-link" disabled={busy} onClick={() => void removeView()}>Usuń</button>}
        </div>
      )}
      <div className="cg-row">
        {/* 2026-10-25 — geöffnet an einem Eintrag gilt dieser eine Anfang: Suche und Rodzaj fänden nichts anderes (zurück über „Pokaż cały sposób wyświetlania”). */}
        <input type="search" value={view.query} placeholder="Szukaj we wpisach…" onChange={(e) => setV({ query: e.target.value })} aria-label="Szukaj"
          disabled={start !== undefined} title={start !== undefined ? 'Widok otwarty od jednego wpisu — szukać można w całym sposobie wyświetlania' : undefined} />
        <select value={quickKind ?? '#inne'} onChange={(e) => { if (e.target.value !== '#inne') setView(withSourceKind(view, e.target.value)); }} aria-label="Rodzaj" disabled={start !== undefined}>
          <option value="">wszystkie rodzaje</option>
          {lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name} ({lib.ofKind(k.id).length})</option>)}
          {quickKind === null && <option value="#inne">inne źródło (zob. „Wybór")</option>}
        </select>
        {!design && (
          <select value={viewId ?? ''} onChange={(e) => onView(e.target.value === '' ? null : e.target.value)} aria-label="Sposób wyświetlania">
            <option value="">— wszystkie wpisy —</option>
            {lib.docs('view').map((v) => <option key={v.id} value={v.id}>{typeof v.data.name === 'string' ? v.data.name : 'Widok'}</option>)}
          </select>
        )}
        {/* 2026-10-25 — in der Struktura zählt der Baum (er nennt seine Schritte selbst), nicht das Ende der Auswahl. */}
        {view.mode !== 'outline' && <span className="cg-muted">{list.length} {list.length === 1 ? 'wpis' : 'wpisów'}</span>}
        {!design && writes && onAdd !== undefined && <button type="button" className="wk-btn" onClick={onAdd}><Icon name="plus" />Dodaj</button>}
        {!design && (writes || viewId !== null) && (
          <MenuButton label="Więcej: ten widok" items={[
            ...(writes ? [{ label: 'Zapisz jako nowy sposób wyświetlania…', icon: 'plus' as const, onSelect: () => void saveView(true) }] : []),
            ...(writes && viewId !== null ? [{ label: 'Zapisz zmiany tego sposobu', icon: 'check' as const, onSelect: () => void saveView(false) }] : []),
            ...(writes && onDesign !== undefined ? [{ label: viewId === null ? 'Sposoby wyświetlania (Schematy)…' : 'Ustaw ten sposób w Schematach…', icon: 'settings' as const, onSelect: () => onDesign(viewId) }] : []),
            ...(viewId !== null ? [{ label: 'Kopiuj link do tego widoku', icon: 'link' as const, onSelect: () => { void navigator.clipboard?.writeText(window.location.href); } }] : []),
            ...(writes && list.length > 0 ? [{ label: 'Ucz się tego — powtórka w Nauce', icon: 'cap' as const, onSelect: () => void toRevision() }] : []),
            /* 2026-10-30 — eine Powtórka, die diesen Widok als Quelle nimmt (keine Kopie): ändert er sich, ändert sie sich mit. */
            ...(writes && viewId !== null && start === undefined ? [{ label: 'Powtórka z tego widoku (zawsze aktualna)', icon: 'cap' as const, onSelect: () => void run(async () => { const id = await learnFromView(lib, viewId, view.name); window.location.hash = href('powtorki', id); }) }] : [])
          ]} />
        )}
      </div>
      {design ? adjust : (
        <details className="cg-adjust" open={adjustOpen.get(dKey) === true || undefined} onToggle={(e) => { adjustOpen.set(dKey, e.currentTarget.open); }}>
          <summary>Dostosuj — co i jak pokazać</summary>
          {adjust}
        </details>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {start !== undefined && viewId !== null && (
        <p className="wk-note cg-start-banner" data-view-start={start.id}>
          <span>Od wpisu: <strong><TexText text={lib.labelTex(start)} /></strong> <span className="cg-muted">(wyszukiwanie, rodzaj i filtr — w całym sposobie wyświetlania)</span></span>
          <a className="wk-link-btn" href={href('wpisy', 'widok', viewId)}>Pokaż cały sposób wyświetlania</a>
          <button type="button" className="wk-link-btn" onClick={() => onOpen(start.id)}>Otwórz wpis</button>
        </p>
      )}
      {picked.size > 0 && <SelectionBar ids={picked} total={list.length} onAll={() => setPicked(new Set(list.map((e) => e.id)))} onClear={() => setPicked(new Set())} onKept={setPicked} />}
      {wants && knowing === null && <p className="cg-muted" data-knowing-wait="">Liczenie znajomości…</p>}
      {view.mode === 'table' && <Table list={list} picked={picked} onPick={setPicked} columns={columns} sort={view.sort} onSort={(key) => setV({ sort: view.sort?.key === key ? { key, dir: view.sort.dir === 1 ? -1 : 1 } : { key, dir: 1 } })} onOpen={onOpen}
        onColumns={(cols) => setV({ columns: cols })} kindFields={chooserFields} label={label} vlib={vlib} />}
      {view.retired.map((line) => <p key={line} className="wk-warn">{line}</p>)}
      {view.mode === 'matrix' && matrix === null && <p className="cg-muted">Wybierz wiersze i kolumny macierzy w „Wybór i grupy".</p>}
      {view.mode === 'matrix' && matrix !== null && (
        <>
          <MatrixGrid matrix={matrix} chosen={cell === null ? null : cellKey(cell.row, cell.col)}
            onCell={(row, col) => setCell(cell !== null && cell.row === row && cell.col === col ? null : { row, col })}
            onEmpty={writes ? (row, col) => void here(row, col) : undefined} />
          {cell !== null && (
            <section className="cg-card">
              <h3><GroupName group={matrix.rows.find((g) => g.key === cell.row)} vlib={vlib} /> × <GroupName group={matrix.cols.find((g) => g.key === cell.col)} vlib={vlib} /> <span className="cg-muted">({cellIds.length})</span></h3>
              <ul className="cg-plain-list">
                {cellIds.map((id) => { const e = lib.entity(id); return e === undefined ? null : <li key={id}><button type="button" className="cg-ref" onClick={() => onOpen(id)}><TexText text={lib.labelTex(e)} /></button> <span className="cg-muted">{e.kinds.map((k) => lib.kind(k)?.name ?? k).join(', ')}</span> <OriginTag id={id} /></li>; })}
              </ul>
              {writes && (
                <span className="cg-row">
                  <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void here(cell.row, cell.col)}>+ Nowy wpis tutaj</button>
                  {cellIds.length > 0 && texts.length > 0 && (
                    <span className="cg-row">
                      <select value={planText} aria-label="Do planu którego tekstu" onChange={(e) => setPlanText(e.target.value)}>
                        <option value="">— do planu kazania —</option>
                        {texts.map((t) => <option key={t.id} value={t.id}>{lib.label(t).slice(0, 70)}</option>)}
                      </select>
                      <button type="button" className="wk-link-btn" disabled={busy || planText === ''} onClick={() => void toPlan(cellIds)}>Dodaj do planu</button>
                    </span>
                  )}
                  {cellIds.length > 0 && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void toRevision(cellIds, `${view.name}: ${matrix.rows.find((g) => g.key === cell.row)?.label ?? ''} × ${matrix.cols.find((g) => g.key === cell.col)?.label ?? ''}`)}>Powtórka z tego pola</button>}
                </span>
              )}
            </section>
          )}
        </>
      )}
      {view.mode === 'tree' && (groups === null ? <Tree list={list} onOpen={onOpen} /> : <GroupTree groups={groups} onOpen={onOpen} vlib={vlib} />)}
      {/* 2026-11-01 — die Mapa postępów: wie gut der Betrachter (sein Lernender) jeden Eintrag kann. */}
      {/* 2026-11-03 — der Krajobraz: die Suche oben zeigt Treffer (zum Zeigen, als Ziel), sie schneidet ihn nicht zu. */}
      {landscape && (knowCards === null || knowCards === undefined ? <p className="cg-muted" data-knowing-wait="">Liczenie kart…</p>
        : <LandscapeView view={shown} cards={knowCards} learner={learner ?? null} onOpen={onOpen} query={view.query} viewKey={viewId ?? 'wpisy'} rewards={runRewards} urlScope="" busy={knowBusy} />)}
      {quilt && (knowCards === null || knowCards === undefined ? <p className="cg-muted" data-knowing-wait="">Liczenie kart…</p>
        : <QuiltView view={shown} list={list} cards={knowCards} answers={ownAnswers} learner={learner ?? null} onOpen={onOpen} />)}
      {view.mode === 'outline' && <Outline view={shown} onOpen={onOpen} vlib={vlib} />}
      {view.mode === 'canvas' && <Canvas list={list} positions={view.positions} onOpen={onOpen}
        onMoved={(id, at) => {
          const next = { ...view, positions: { ...view.positions, [id]: at } };
          setView(next);
          if (writes && viewId !== null) void lib.saveDoc('view', viewJson(next), viewId).catch(() => undefined);
        }} />}
      {view.mode === 'canvas' && viewId === null && writes && <p className="wk-hint">Zapisz widok, żeby miejsca na płótnie zostały — widzą je wszyscy autorzy.</p>}
      {picked.size > 0 && <div className="cg-select-room" aria-hidden />}
    </div>
  );
}

function Table({ list, picked, onPick, columns, sort, onSort, onOpen, onColumns, kindFields, label, vlib }: {
  list: readonly Entity[];
  picked: ReadonlySet<string>;
  onPick: (next: ReadonlySet<string>) => void;
  columns: readonly string[];
  sort: { key: string; dir: 1 | -1 } | null;
  onSort: (key: string) => void;
  onOpen: (id: string) => void;
  onColumns?: (cols: string[]) => void;
  kindFields: readonly { key: string; label: string }[];
  /** 2026-10-22 (Schritt 10) — der Name einer Spalte, die kein Feld ist (eine Achse). */
  label?: (key: string) => string | undefined;
  /** 2026-10-30 — die Baza mit der Kenntnis des Betrachters (Spalten „Znajomość", „Kiedy powtórzyć"). */
  vlib: ViewLib;
}) {
  const { lib } = useCtx();
  const look = lib.look;
  const [page, setPage] = useState(0);
  const per = 100;
  const arrow = (key: string) => (sort?.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '');

  /*
    2026-10-18 — WÄHLEN MIT DER MAUS: das Kästchen, Strg+Klick (eins dazu),
    Umschalt+Klick (alles dazwischen), Ziehen über die Kästchen (viele auf
    einmal); auf dem Telefon langes Drücken. Ist schon etwas gewählt, wählt
    ein Klick auf eine Zeile — statt sie zu öffnen.
  */
  const [anchor, setAnchor] = useState<string | null>(null);
  const painting = useRef<boolean | null>(null);
  const holding = useRef<number | null>(null);
  const held = useRef(false);
  useEffect(() => {
    const up = () => { painting.current = null; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  const choosing = picked.size > 0;
  const mark = (ids: readonly string[], on: boolean) => {
    const next = new Set(picked);
    for (const id of ids) if (on) next.add(id); else next.delete(id);
    onPick(next);
  };
  const between = (to: string): string[] => {
    const a = list.findIndex((e) => e.id === (anchor ?? to));
    const b = list.findIndex((e) => e.id === to);
    const [x, y] = a <= b ? [a, b] : [b, a];
    return list.slice(Math.max(0, x), y + 1).map((e) => e.id);
  };
  const rowClick = (ev: MouseEvent, id: string) => {
    if (held.current) { held.current = false; return; }
    if (ev.shiftKey) { mark(between(id), true); return; }
    if (ev.ctrlKey || ev.metaKey || choosing) { mark([id], !picked.has(id)); setAnchor(id); return; }
    onOpen(id);
  };
  const rowKey = (k: KeyboardEvent, id: string) => {
    if (k.key === ' ') { k.preventDefault(); mark([id], !picked.has(id)); setAnchor(id); }
    else if (k.key === 'Enter') { if (choosing) mark([id], !picked.has(id)); else onOpen(id); }
  };
  const stopHold = () => { if (holding.current !== null) { window.clearTimeout(holding.current); holding.current = null; } };
  const pageIds = list.slice(page * per, page * per + per).map((e) => e.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => picked.has(id));

  return (
    <div className="cg">
      <p className="cg-muted cg-select-hint">Zaznaczanie: pole wyboru, Ctrl+klik, Shift+klik albo przeciągnięcie po polach wyboru; na telefonie przytrzymaj wpis.</p>
      {onColumns !== undefined && (
        <details>
          <summary>Kolumny</summary>
          <div className="cg-row">
            {kindFields.map((f) => (
              <label key={f.key} className="pe-check">
                <input type="checkbox" checked={columns.includes(f.key)} onChange={(e) => onColumns(e.target.checked ? [...columns, f.key] : columns.filter((c) => c !== f.key))} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </details>
      )}
      <div className="cg-table-wrap">
        <table className="cg-table">
          <thead>
            <tr>
              <th className="cg-pick-cell"><input type="checkbox" checked={allOnPage} aria-label="Zaznacz wszystkie na tej stronie" onChange={() => mark(pageIds, !allOnPage)} /></th>
              <th><button type="button" onClick={() => onSort('_label')}>Wpis{arrow('_label')}</button></th>
              <th>Rodzaj</th>
              {columns.map((c) => <th key={c}><button type="button" onClick={() => onSort(c)}>{label?.(c) ?? kindFields.find((f) => f.key === c)?.label ?? c}{arrow(c)}</button></th>)}
            </tr>
          </thead>
          <tbody>
            {list.slice(page * per, page * per + per).map((e) => (
              <tr key={e.id} className={`is-link${picked.has(e.id) ? ' is-picked' : ''}`} aria-selected={picked.has(e.id)} tabIndex={0}
                onClick={(ev) => rowClick(ev, e.id)} onKeyDown={(k) => rowKey(k, e.id)}
                onMouseDown={(ev) => { if (ev.shiftKey) ev.preventDefault(); }}
                onMouseEnter={() => { if (painting.current !== null) mark([e.id], painting.current); }}
                onPointerDown={(ev) => {
                  if (ev.pointerType !== 'touch') return;
                  stopHold();
                  holding.current = window.setTimeout(() => { held.current = true; mark([e.id], true); setAnchor(e.id); navigator.vibrate?.(15); }, 500);
                }}
                onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
                onContextMenu={(ev) => { if (held.current) ev.preventDefault(); }}>
                <td className="cg-pick-cell"
                  onMouseDown={(ev) => { ev.preventDefault(); const on = !picked.has(e.id); painting.current = on; mark([e.id], on); setAnchor(e.id); }}
                  onClick={(ev) => ev.stopPropagation()}>
                  <input type="checkbox" checked={picked.has(e.id)} tabIndex={-1} aria-label={`Zaznacz: ${lib.label(e)}`}
                    onClick={(ev) => ev.preventDefault()} onChange={() => undefined} />
                </td>
                <td><TexText text={lib.labelTex(e)} />{lib.tell(e) !== '' && <span className="cg-muted"> · {lib.tell(e)}</span>} <OriginTag id={e.id} /></td>
                <td className="cg-muted">{e.kinds.map((k) => lib.kind(k)?.name ?? k).join(', ')}</td>
                {columns.map((c) => {
                  /* 2026-11-01 — Zellen setzen ihre Wzory; gekürzt wird nie mitten in einem (`clipTex`). */
                  if (c.startsWith('#')) return <td key={c}><TexText text={clipTex(cellText(vlib, e, c, true), 120)} /></td>;
                  const f = fieldsOf(e, look).find((x) => x.key === c);
                  return <td key={c}>{f === undefined ? '' : <TexText text={clipTex(fieldText(e, f, look, 0, false, true), 120)} />}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > per && (
        <div className="cg-row">
          <button type="button" className="wk-link-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← wcześniejsze</button>
          <span className="cg-muted">{page * per + 1}–{Math.min(list.length, page * per + per)} z {list.length}</span>
          <button type="button" className="wk-link-btn" disabled={(page + 1) * per >= list.length} onClick={() => setPage((p) => p + 1)}>dalsze →</button>
        </div>
      )}
    </div>
  );
}

function Tree({ list, onOpen }: { list: readonly Entity[]; onOpen: (id: string) => void }) {
  const { lib } = useCtx();
  /* Nach der ersten Art (2026-10-23: Themen als Baum gibt es nicht mehr — Gruppen nach einer Achse gibt der Widok). */
  const branch = (e: Entity): JSX.Element => (
    <li key={e.id}><button type="button" className="cg-ref" onClick={() => onOpen(e.id)}><TexText text={lib.labelTex(e)} /></button> <OriginTag id={e.id} /></li>
  );
  return (
    <ul className="cg-tree">
      {lib.kinds.map((k) => {
        const of = list.filter((e) => e.kinds[0] === k.id);
        if (of.length === 0) return null;
        return (
          <li key={k.id}>
            <details open={of.length < 30}>
              <summary><strong>{k.name}</strong> <span className="cg-muted">({of.length})</span></summary>
              <ul className="cg-tree">{of.slice(0, 500).map(branch)}</ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/** 2026-11-01 — der Name einer Gruppe (einer Zeile, Spalte der Macierz) mit seinen Wzory. */
function GroupName({ group, vlib }: { group: Pick<Group, 'key' | 'label'> | undefined; vlib: ViewLib }) {
  return group === undefined ? null : <TexText text={groupTitle(vlib, group)} />;
}

/** 2026-10-22 (Schritt 9) — das Drzewo nach den Gruppen des Widoku: nach einem Feld oder (2026-10-23) einer Achse — mit ihren Überschriften. */
function GroupTree({ groups, onOpen, vlib }: { groups: readonly Group[]; onOpen: (id: string) => void; vlib: ViewLib }) {
  const { lib } = useCtx();
  return (
    <ul className="cg-tree">
      {groups.map((g, i) => (
        <Fragment key={g.key || '#reszta'}>
          {g.head !== undefined && g.head.key !== groups[i - 1]?.head?.key && <li className="cg-tree-head"><span className="cg-muted"><GroupName group={g.head} vlib={vlib} /></span></li>}
        <li>
          <details open={groups.length < 8}>
            <summary><strong><GroupName group={g} vlib={vlib} /></strong> <span className="cg-muted">({g.ids.length})</span></summary>
            <ul className="cg-tree">
              {g.ids.slice(0, 500).map((id) => {
                const e = lib.entity(id);
                return e === undefined ? null : <li key={id}><button type="button" className="cg-ref" onClick={() => onOpen(id)}><TexText text={lib.labelTex(e)} /></button> <OriginTag id={id} /></li>;
              })}
            </ul>
          </details>
        </li>
        </Fragment>
      ))}
    </ul>
  );
}

function Canvas({ list, positions, onOpen, onMoved }: {
  list: readonly Entity[];
  positions: Readonly<Record<string, { x: number; y: number }>>;
  onOpen: (id: string) => void;
  onMoved: (id: string, at: { x: number; y: number }) => void;
}) {
  const { lib } = useCtx();
  const look = lib.look;
  const [moving, setMoving] = useState<Record<string, { x: number; y: number }>>({});
  const shown = list.slice(0, 400);
  const ids = new Set(shown.map((e) => e.id));
  const nodes: Node[] = shown.map((e, i) => ({
    id: e.id,
    position: moving[e.id] ?? positions[e.id] ?? { x: (i % 8) * 200, y: Math.floor(i / 8) * 90 },
    data: { label: lib.label(e).slice(0, 60) },
    style: { fontSize: 12, width: 170 }
  }));
  const edges: Edge[] = [];
  for (const e of shown) {
    for (const f of fieldsOf(e, look)) {
      if (f.type !== 'ref') continue;
      for (const v of valuesOf(e, f)) if (typeof v.value === 'string' && ids.has(v.value)) edges.push({ id: `${e.id}-${f.key}-${v.value}`, source: e.id, target: v.value, label: f.label, style: { fontSize: 10 } });
    }
  }
  return (
    <div className="cg-graph-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes: NodeChange[]) => {
          for (const ch of changes) if (ch.type === 'position' && ch.position !== undefined) { const { id, position } = ch; setMoving((m) => ({ ...m, [id]: { x: Math.round(position.x), y: Math.round(position.y) } })); }
        }}
        onNodeDragStop={(_, n) => { const at = moving[n.id]; if (at !== undefined) onMoved(n.id, at); }}
        onNodeDoubleClick={(_, n) => onOpen(n.id)}
        nodesConnectable={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

/* -- 2026-10-24: Struktura; 2026-10-25 (Wywód): als Ganzes gezeichnet (`StructureView.tsx`) ------------------- */

/**
 * DIE STRUKTUR: jeder Eintrag der Quelle, darunter, wohin die Schritte „Idź po odwołaniu" und
 * „Idź po strukturze" führen. Gezeichnet von `StructureView`: die Wurzel oben (eine Frage als
 * „Pytanie wiodące"), die Schritte als Baum oder in der Reihenfolge des Textes.
 */
function Outline({ view, onOpen, vlib }: { view: ViewDoc; onOpen: (id: string) => void; vlib: ViewLib }) {
  const { lib } = useCtx();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shape = useMemo(() => viewOutline(vlib, view), [vlib, lib.revision, view.query, JSON.stringify(view.steps), JSON.stringify(view.sort), JSON.stringify(view.outline)]);
  const leads = view.steps.some((x) => x.type === 'follow' || x.type === 'structure');
  return (
    <div className="cg-outline">
      {!leads && <p className="cg-muted">Struktura pokazuje też to, co leży pod wpisami — dodaj w „Wybór” krok „Idź po strukturze” (po polach, które rodzaj oznacza jako połączenie w strukturze) albo „Idź po odwołaniu”.</p>}
      <StructureView roots={shape.roots} display={view.outline} onOpen={onOpen} more={shape.more} capped={shape.capped} />
    </div>
  );
}

/** 2026-10-25 (Wywód) — wie die Struktura zeigt: das Feld über jedem Knoten, Baum oder Text, das Feld für Gleichstand. */
function OutlineSettings({ value, fields, onChange }: { value: OutlineDisplay | null; fields: readonly { key: string; label: string }[]; onChange: (next: OutlineDisplay) => void }) {
  const now: OutlineDisplay = value ?? { chip: '', tie: '' };
  return (
    <div className="cg-row" data-outline-settings="">
      <label className="wk-field"><span>Nad każdym krokiem</span>
        <select value={now.chip} onChange={(e) => onChange({ ...now, chip: e.target.value })}>
          <option value="">— nic —</option>
          {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </label>
      <label className="wk-field"><span>Na początek</span>
        <select value={now.order ?? ''} onChange={(e) => { const { order: _o, ...rest } = now; onChange(e.target.value === 'text' || e.target.value === 'tree' ? { ...rest, order: e.target.value } : rest); }}>
          <option value="">jak wybierze czytelnik (artykuł Tomasza: tekst)</option>
          <option value="tree">wywód (drzewo)</option>
          <option value="text">kolejność tekstu</option>
        </select>
      </label>
      {/* 2026-10-25 — z. B. „czas" (die Zeit der Erzählung): eine Rückblende vom Ende des Buches steht dann vorn. */}
      <label className="wk-field"><span>Kroki na jednym poziomie — według</span>
        <select value={now.by ?? ''} onChange={(e) => { const { by: _b, ...rest } = now; onChange(e.target.value === '' ? rest : { ...rest, by: e.target.value }); }}>
          <option value="">miejsca w dziele</option>
          {fields.map((f) => <option key={f.key} value={f.key}>pola „{f.label}” (np. czas opowieści)</option>)}
        </select>
      </label>
      <label className="wk-field"><span>Przy tym samym miejscu w dziele — według</span>
        <select value={now.tie} onChange={(e) => onChange({ ...now, tie: e.target.value })}>
          <option value="">— nazwy —</option>
          {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </label>
    </div>
  );
}
