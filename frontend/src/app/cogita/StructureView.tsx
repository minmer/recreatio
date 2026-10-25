/**
 * DIE STRUKTURA ALS GANZES (2026-10-25, Wywód) — was ein Widok im Modus „Struktura" wählt
 * (`viewOutline`), gezeichnet als das, was es ist.
 *
 * <code>
 *   mit „Idź po strukturze"   oben die Wurzel (eine Frage: „Pytanie wiodące"), darunter die Schritte —
 *                             als Baum oder in der Reihenfolge des Textes; jeder Schritt: das Feld über
 *                             ihm (`outline.chip`), seine These, seine Stelle relativ zur Wurzel, Marken,
 *                             aufgeklappt die ganze Aussage, „pokaż w tekście" und, was der Widok dazu holt
 *   ohne                       wie bisher: jeder Eintrag ganz, darunter, wohin „Idź po odwołaniu" führt,
 *                             nach Feldern — Ebene um Ebene
 * </code>
 *
 * Im Układ „Tomasz z Akwinu" teilen Überschriften den Artikel (Zarzuty · Sed contra · Odpowiedź ·
 * Odpowiedzi na zarzuty), und eine Zahl des Autors („arg. 3") ist die Nummer. Die Listen sind
 * Listen; der Name eines Schritts ist sein Knopf zum Aufklappen (`aria-expanded`, `aria-controls`),
 * der Pfeil davor nur für die Maus (2026-10-25: ein Halt je Schritt für den Tabulator, nicht zwei);
 * ↑ ↓ wandern zwischen den Schritten, → klappt auf, ← zu.
 *
 * 2026-10-26 — „Tezy skrócone | Całe tezy" oben bei jeder Wurzel: eine Teza steht gekürzt (wie jeder Name in
 * Listen nach 90 Zeichen „…") oder ganz. Eine Wahl des Lesers für alle Wurzeln auf dem Schirm, gemerkt im Browser.
 *
 * 2026-10-25 — „pokaż w tekście" bekommt die Bibliothek seines Werks, in jedem Bild neu gefragt
 * (`workLook`): ist sie nach einem frischen Laden noch nicht da, kommt sie später als neues `look`, und
 * jede Änderung eines offenen Speichers (auch das Laden der privaten Texte) erhöht ihre `revision` —
 * `TextJump` sucht dann neu, ohne neu zu beginnen. Vorher hing ein Schlüssel aus allen Revisionen an
 * ihm: jeder Abgleich (ein Wechsel des Tabs, ein Speichern) klappte einen offenen Abschnitt zu.
 */

import { Fragment, useId, useMemo, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';

import { EntityGlance } from './CardFace';
import { TextJump } from '../library/SourceJump';
import { workLook } from '../library/sourceFind';
import { statementOf, statementRole } from '../library/statement';
import { plural } from '../core/plural';
import { fieldsOf, fieldText, labelOf, placeText, valuesOf, type Entity } from './schema';
import { authorNumber, childrenOf, isStructured, parentsOf, pathFromRoot, pieceOf, PIECE_HEADING, placeLabel, placeOf, relativePlace, schemeFor, textOrder, type StructNode } from './structure';
import { readView, viewOutline, type OutlineDisplay, type OutlineGroup, type OutlineNode } from './views';
import { anchorsAt } from './anchors';
import { useCtx } from './ui';

type Order = 'tree' | 'text';

const ORDER_KEY = 'cg-structure-order';
const savedOrder = (): Order | null => {
  try { const v = window.localStorage.getItem(ORDER_KEY); return v === 'tree' || v === 'text' ? v : null; } catch { return null; }
};
const keepOrder = (order: Order) => { try { window.localStorage.setItem(ORDER_KEY, order); } catch { /* ohne Speicher: nur für jetzt */ } };

/* Wie lang die Tezy stehen — eine Wahl für alle Wurzeln: was in dieser Karte gewählt wurde, sonst was der Browser sich merkte. */
type Theses = 'short' | 'whole';
const THESES_KEY = 'cg-structure-theses';
let pickedTheses: Theses | null = null;
const thesesHeard = new Set<() => void>();
const thesesNow = (): Theses => {
  if (pickedTheses !== null) return pickedTheses;
  try { return window.localStorage.getItem(THESES_KEY) === 'whole' ? 'whole' : 'short'; } catch { return 'short'; }
};
const keepTheses = (next: Theses) => {
  pickedTheses = next;
  try { window.localStorage.setItem(THESES_KEY, next); } catch { /* ohne Speicher: nur für jetzt */ }
  thesesHeard.forEach((heard) => heard());
};
const hearTheses = (heard: () => void) => { thesesHeard.add(heard); return () => { thesesHeard.delete(heard); }; };

/** Der Baum einer Wurzel, wie `textOrder` ihn braucht: nur die Schritte der Struktur. */
const toStruct = (n: OutlineNode): StructNode => ({
  id: n.id,
  ...(n.again === true ? { again: true as const } : {}),
  children: n.groups.filter((g) => g.structure === true).flatMap((g) => g.nodes).map(toStruct)
});

const countSteps = (n: OutlineNode): number =>
  n.groups.filter((g) => g.structure === true).reduce((sum, g) => sum + g.nodes.reduce((s, c) => s + 1 + (c.again === true ? 0 : countSteps(c)), 0), 0);

const stepsWord = (n: number): string => `${n} ${plural(n, 'krok', 'kroki', 'kroków')}`;

export function StructureView({ roots, display, onOpen, more = false, capped = false }: {
  roots: readonly OutlineNode[];
  display: OutlineDisplay | null;
  onOpen: (id: string) => void;
  more?: boolean;
  capped?: boolean;
}) {
  if (roots.length === 0) return <p className="wk-empty">Nic tu nie ma.</p>;
  return (
    <div className="cg-wy-list">
      {/*
        Der Schlüssel trägt die gewählte Reihenfolge: ändert der Besitzer sie, beginnt die Wurzel neu.
        2026-10-25 — ohne die Stelle in der Liste (die Kennungen sind eindeutig): rückt eine Wurzel (Suche,
        eine neue davor), bleiben ihre offenen Schritte und ihre Reihenfolge.
      */}
      {roots.map((root) => <StructureRoot key={`${root.id}:${display?.order ?? ''}`} root={root} display={display} onOpen={onOpen} />)}
      {more && <p className="cg-muted">Pokazano pierwsze 50 — zawęź wybór albo szukaj.</p>}
      {capped && <p className="cg-muted">Struktura jest bardzo duża — pokazano jej część.</p>}
    </div>
  );
}

function StructureRoot({ root, display, onOpen }: { root: OutlineNode; display: OutlineDisplay | null; onOpen: (id: string) => void }) {
  const hasStructure = root.groups.some((g) => g.structure === true);
  return hasStructure ? <WywodRoot root={root} display={display} onOpen={onOpen} /> : <ClassicNode node={root} onOpen={onOpen} top />;
}

function WywodRoot({ root, display, onOpen }: { root: OutlineNode; display: OutlineDisplay | null; onOpen: (id: string) => void }) {
  const { lib, sources } = useCtx();
  /* Solange die Quellen der Baza laden, ist ein Werk nicht „niedostępne", nur noch nicht da. */
  const loading = sources?.loading === true;
  const entity = lib.entity(root.id);
  const struct = useMemo(() => toStruct(root), [root]);
  /* Alle Stellen des Baumes — für den Układ, wenn das Werk nicht lesbar ist. */
  const place = entity === undefined ? null : placeOf(entity, lib);
  const scheme = useMemo(() => {
    if (place === null) return null;
    const locators: string[] = [];
    const walk = (n: StructNode) => { const e = lib.entity(n.id); const p = e === undefined ? null : placeOf(e, lib); if (p !== null && p.work === place.work && p.locator !== '') locators.push(p.locator); n.children.forEach(walk); };
    walk(struct);
    return schemeFor(place.work, lib, locators);
  }, [lib, lib.revision, place?.work, struct]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Die Wahl des Besitzers gilt; sonst die des Lesers; sonst: ein Artikel nach Tomasz im Text, alles andere als Baum. */
  const [order, setOrder] = useState<Order>(() => display?.order ?? savedOrder() ?? (scheme?.scheme === 'aquinas' ? 'text' : 'tree'));
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  /* „Rozwiń wszystko": alles offen — ausser dem, was man danach wieder zuklappt. */
  const [all, setAll] = useState(false);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const whole = useSyncExternalStore(hearTheses, thesesNow, thesesNow) === 'whole';
  if (entity === undefined) return null;
  const entry = lib.entry(root.id);
  const statement = entry === undefined ? null : statementOf(entry, lib.markupLook);
  const work = place === null ? undefined : lib.entity(place.work);
  const steps = countSteps(root);
  const flip = (set: ReadonlySet<string>, key: string) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; };
  const toggle = (key: string) => (all ? setClosed((was) => flip(was, key)) : setOpen((was) => flip(was, key)));
  const isOpen = (key: string) => (all ? !closed.has(key) : open.has(key));
  const chipOf = (e: Entity): string => {
    const field = display?.chip ? fieldsOf(e, lib.look).find((f) => f.key === display.chip) : undefined;
    return field === undefined ? '' : fieldText(e, field, lib.look);
  };
  const nameOf = (e: Entity): string => (whole ? labelOf(e, lib.look, 0, true) : lib.label(e));
  const ctx: NodeCtx = { root: place?.locator ?? '', work: place?.work ?? '', scheme, chipOf, nameOf, onOpen, isOpen, toggle };
  const kids = root.groups.filter((g) => g.structure === true).flatMap((g) => g.nodes);
  const side = root.groups.filter((g) => g.structure !== true);
  const setOrderKept = (next: Order) => { setOrder(next); keepOrder(next); };

  return (
    <article className="cg-wy" data-structure-root={root.id}>
      <header className="cg-wy-head">
        <p className="cg-wy-kicker">
          <span>{statement?.question === true ? 'Pytanie wiodące' : chipOf(entity) || 'Na górze'}</span>
          {place !== null && scheme !== null && <span className="cg-wy-place">{place.locator === '' ? 'całe dzieło' : placeLabel(place.locator, scheme.scheme, scheme.options)}</span>}
        </p>
        <h3 className="cg-wy-title"><button type="button" className="cg-ref" onClick={() => onOpen(root.id)}>{nameOf(entity)}</button></h3>
        {/*
          2026-10-25 — „jeszcze bez kroków" nur, wenn nichts abgeschnitten ist. Blieb für diese Wurzel im Mass aller
          Wurzeln zusammen nichts übrig (nur so hat sie keinen Schritt und doch `cut`), sagt sie, wie viel fehlt und
          dass ihr Eintrag es zeigt — dort hat sie ihr ganzes Mass. „pokaż w tekście" am Ende der Zeile: ein geöffneter
          Abschnitt steht unter ihr, nicht mehr zwischen dem Werk und der Zahl der Schritte.
        */}
        <div className="cg-wy-meta">
          {work !== undefined ? lib.label(work) : place === null ? '' : loading ? 'Otwieranie źródeł…' : 'dzieło niedostępne'}
          {(steps > 0 || root.cut === undefined) && <>{' · '}{steps === 0 ? 'jeszcze bez kroków' : stepsWord(steps)}</>}
          {root.cut !== undefined && (
            <span className="cg-muted">
              {' · ▸ '}{stepsWord(root.cut)} niżej nie pokazano
              {steps === 0 && <> — <button type="button" className="cg-ref" onClick={() => onOpen(root.id)}>{statement?.question === true ? 'otwórz pytanie' : 'otwórz wpis'}</button>, żeby je zobaczyć</>}
            </span>
          )}
          {scheme?.recognised === true && !loading && <span className="cg-muted"> · układ rozpoznany z miejsc</span>}
          {place !== null && place.locator !== '' && <TextJump look={workLook(place.work)} workId={place.work} locator={place.locator} />}
        </div>
        {steps > 0 && (
          <div className="cg-row cg-wy-tools">
            <span className="cg-subtabs" role="group" aria-label="Kolejność">
              <button type="button" className={order === 'tree' ? 'is-on' : ''} aria-pressed={order === 'tree'} onClick={() => setOrderKept('tree')}>Wywód</button>
              <button type="button" className={order === 'text' ? 'is-on' : ''} aria-pressed={order === 'text'} onClick={() => setOrderKept('text')}>Kolejność tekstu</button>
            </span>
            <span className="cg-subtabs" role="group" aria-label="Długość tez">
              <button type="button" className={whole ? '' : 'is-on'} aria-pressed={!whole} onClick={() => keepTheses('short')}>Tezy skrócone</button>
              <button type="button" className={whole ? 'is-on' : ''} aria-pressed={whole} onClick={() => keepTheses('whole')}>Całe tezy</button>
            </span>
            <button type="button" className="wk-link-btn" aria-pressed={all} onClick={() => { setAll(!all); setOpen(new Set()); setClosed(new Set()); }}>{all ? 'Tylko tezy' : 'Rozwiń wszystko'}</button>
          </div>
        )}
        <p className="cg-wy-legend cg-muted">Kroki mówią, co jest w źródle — każdy przy swoim miejscu; to, co od tego odbiega, ma znacznik.</p>
      </header>
      {side.length > 0 && <SideGroups groups={side} onOpen={onOpen} />}
      {kids.length > 0 && (order === 'tree'
        ? <StepList label={lib.label(entity)}>{kids.map((n, i) => <TreeNode key={`${n.id}-${i}`} node={n} path={`${root.id}/${n.id}/${i}`} ctx={ctx} />)}</StepList>
        : <TextList root={root} struct={struct} ctx={ctx} />)}
    </article>
  );
}

interface NodeCtx {
  readonly root: string;
  readonly work: string;
  readonly scheme: ReturnType<typeof schemeFor> | null;
  readonly chipOf: (e: Entity) => string;
  /** Der Name eines Schritts: gekürzt oder ganz, wie der Leser oben gewählt hat. */
  readonly nameOf: (e: Entity) => string;
  readonly onOpen: (id: string) => void;
  readonly isOpen: (key: string) => boolean;
  readonly toggle: (key: string) => void;
}

/**
 * Eine Liste von Schritten: ↑ ↓ wandern zwischen ihnen, → klappt einen auf, ← zu (solange der Fokus auf einem Schritt liegt).
 * 2026-10-25 — der Zustand steht am Namen (dem Knopf mit dem Fokus), nicht mehr am Pfeil davor.
 */
function StepList({ label, flat = false, children }: { label: string; flat?: boolean; children: ReactNode }) {
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-wy-label]')];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[Math.max(0, Math.min(items.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const step = items[at]!;
      if ((step.getAttribute('aria-expanded') === 'true') === (e.key === 'ArrowLeft')) { e.preventDefault(); step.click(); }
    }
  };
  return <ol className={`cg-wy-tree${flat ? ' cg-wy-flat' : ''}`} aria-label={label} onKeyDown={onKey}>{children}</ol>;
}

/**
 * Was ein Schritt sagt, in einer Zeile: Nummer/Rolle, These, Stelle, Marken.
 * 2026-10-25 — der Name ist der Knopf zum Aufklappen (`aria-expanded`, `aria-controls`) und der einzige Halt
 * für den Tabulator; der Pfeil davor bleibt für die Maus (`tabIndex={-1}`, `aria-hidden`). `before` steht vor
 * allem anderen der Zeile (die Überschrift eines Stücks für Bildschirmleser — vor dem Schritt, den sie einleitet).
 */
function StepLine({ id, ctx, path, bodyId, before, extra }: { id: string; ctx: NodeCtx; path: string; bodyId: string; before?: ReactNode; extra?: ReactNode }) {
  const { lib } = useCtx();
  const entity = lib.entity(id);
  if (entity === undefined) return null;
  const entry = lib.entry(id);
  const place = placeOf(entity, lib);
  const sameWork = place !== null && place.work === ctx.work;
  const rel = place === null ? '' : ctx.scheme === null || !sameWork ? place.locator : relativePlace(place.locator, ctx.root, ctx.scheme.scheme, ctx.scheme.options);
  const number = place !== null && sameWork && ctx.scheme !== null ? authorNumber(place.locator, ctx.scheme.scheme) : null;
  const chip = ctx.chipOf(entity);
  const statement = entry === undefined ? null : statementOf(entry, lib.markupLook);
  const interp = statement !== null && entry !== undefined && statementRole(entry, lib.markupLook) === 'interpretation';
  const loose = place === null || place.locator === '';
  const open = ctx.isOpen(path);
  return (
    <div className="cg-wy-line">
      {before}
      <button type="button" className="cg-wy-twist" tabIndex={-1} aria-hidden="true" onClick={() => ctx.toggle(path)}>{open ? '▾' : '▸'}</button>
      {chip !== '' && <span className="cg-wy-chip">{chip}{number !== null ? ` ${number}` : ''}</span>}
      <button type="button" className="cg-wy-label" data-wy-label="" aria-expanded={open} aria-controls={bodyId} onClick={() => ctx.toggle(path)}>{ctx.nameOf(entity)}</button>
      {rel !== '' && <span className="cg-wy-place">{rel}</span>}
      {loose && <span className="cg-tag" title="Krok bez miejsca w dziele — dopowiedziany przy rekonstrukcji">dopowiedziane</span>}
      {interp && <span className="cg-tag is-interp" title="Opiera się na innej wypowiedzi albo nie wskazuje źródła">Interpretacja</span>}
      {!interp && !loose && <span className="cg-sr">Informacja</span>}
      {extra}
    </div>
  );
}

/** Aufgeklappt: die ganze Aussage, „pokaż w tekście", und was der Widok dazu holt. */
function StepBody({ node, ctx, id }: { node: OutlineNode; ctx: NodeCtx; id: string }) {
  const { lib } = useCtx();
  const entity = lib.entity(node.id);
  if (entity === undefined) return null;
  const place = placeOf(entity, lib);
  const side = node.groups.filter((g) => g.structure !== true);
  return (
    <div className="cg-wy-body" id={id}>
      <EntityGlance lib={lib} entity={entity} onEntity={ctx.onOpen} />
      {place !== null && place.locator !== '' && <div className="cg-outline-place">{place.locator}<TextJump look={workLook(place.work)} workId={place.work} locator={place.locator} /></div>}
      <p className="cg-row"><button type="button" className="wk-link-btn" onClick={() => ctx.onOpen(node.id)}>Otwórz wpis</button></p>
      {side.length > 0 && <SideGroups groups={side} onOpen={ctx.onOpen} />}
    </div>
  );
}

const sideCount = (node: OutlineNode): number => node.groups.filter((g) => g.structure !== true).reduce((s, g) => s + g.nodes.length, 0);

function TreeNode({ node, path, ctx }: { node: OutlineNode; path: string; ctx: NodeCtx }) {
  const { lib } = useCtx();
  const bodyId = `wy-${useId().replace(/:/g, '')}`;
  if (node.again === true) {
    const e = lib.entity(node.id);
    return <li className="cg-wy-node is-again"><span className="cg-muted">↺ {e === undefined ? '' : ctx.nameOf(e)} (już wyżej)</span></li>;
  }
  const kids = node.groups.filter((g) => g.structure === true).flatMap((g) => g.nodes);
  const comments = sideCount(node);
  const open = ctx.isOpen(path);
  return (
    <li className="cg-wy-node" data-structure-node={node.id} data-open={open ? '' : undefined}>
      <StepLine id={node.id} ctx={ctx} path={path} bodyId={bodyId} extra={<>
        {comments > 0 && <span className="cg-wy-count" title={`${comments} — rozwiń, żeby zobaczyć`}>● {comments}</span>}
        {node.cut !== undefined && <span className="cg-muted"> · ▸ {stepsWord(node.cut)} niżej nie pokazano</span>}
      </>} />
      {open && <StepBody node={node} ctx={ctx} id={bodyId} />}
      {kids.length > 0 && <ol className="cg-wy-tree">{kids.map((k, i) => <TreeNode key={`${k.id}-${i}`} node={k} path={`${path}/${k.id}/${i}`} ctx={ctx} />)}</ol>}
    </li>
  );
}

/** Die Reihenfolge des Textes: flach, mit den Stücken eines Artikels als Überschriften und „↳ do:" für tiefer liegende Schritte. */
function TextList({ root, struct, ctx }: { root: OutlineNode; struct: StructNode; ctx: NodeCtx }) {
  const { lib } = useCtx();
  const rows = useMemo(() => textOrder(struct, lib), [struct, lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Die Knoten des Widoku je Eintrag — mit dem, was er an ihnen dazu holt (die Kommentare). */
  const byId = useMemo(() => {
    const out = new Map<string, OutlineNode>();
    const walk = (n: OutlineNode) => { if (!out.has(n.id) && n.again !== true) out.set(n.id, n); for (const g of n.groups) if (g.structure === true) g.nodes.forEach(walk); };
    walk(root);
    return out;
  }, [root]);
  const base = useId().replace(/:/g, '');
  let lastPiece: number | null = null;
  return (
    <StepList label="Kolejność tekstu" flat>
      {rows.map((row, i) => {
        const e = lib.entity(row.node.id);
        const place = e === undefined ? null : placeOf(e, lib);
        const piece = place === null || ctx.scheme === null || place.work !== ctx.work ? null : pieceOf(place.locator, ctx.scheme.scheme);
        const heading = piece !== null && piece !== lastPiece ? PIECE_HEADING[piece] : null;
        if (piece !== null) lastPiece = piece;
        const parent = row.parent === struct.id ? undefined : lib.entity(row.parent);
        const path = `t/${row.parent}/${row.node.id}/${i}`;
        const outline: OutlineNode = byId.get(row.node.id) ?? { id: row.node.id, groups: [] };
        const comments = sideCount(outline);
        const bodyId = `wy-${base}-${i}`;
        return (
          <Fragment key={path}>
            {heading !== null && <li className="cg-wy-piece" aria-hidden="true">{heading}</li>}
            <li className="cg-wy-node" data-structure-node={row.node.id}>
              {/* 2026-10-25 — die Überschrift für Bildschirmleser am Anfang der Zeile, vor dem Schritt, den sie einleitet (vorher an ihrem Ende). */}
              <StepLine id={row.node.id} ctx={ctx} path={path} bodyId={bodyId} before={heading !== null ? <span className="cg-sr">{heading}</span> : undefined} extra={<>
                {comments > 0 && <span className="cg-wy-count" title={`${comments} — rozwiń, żeby zobaczyć`}>● {comments}</span>}
                {parent !== undefined && <span className="cg-muted cg-wy-up">↳ do: {ctx.chipOf(parent) || lib.label(parent).slice(0, 60)}</span>}
              </>} />
              {ctx.isOpen(path) && <StepBody node={outline} ctx={ctx} id={bodyId} />}
            </li>
          </Fragment>
        );
      })}
    </StepList>
  );
}

/** Was ein Widok an einem Schritt dazu holt (etwa die Kommentare: „← O czym") — jeder Eintrag ganz, mit dem, was unter ihm folgt. */
function SideGroups({ groups, onOpen }: { groups: readonly OutlineGroup[]; onOpen: (id: string) => void }) {
  return (
    <div className="cg-wy-side">
      {groups.map((g, i) => (
        <section key={`${g.label}-${i}`} className="cg-outline-group">
          {g.label !== '' && <h4 className="cg-outline-h">{g.label}</h4>}
          {g.nodes.map((n, j) => <ClassicNode key={`${n.id}-${j}`} node={n} onOpen={onOpen} />)}
        </section>
      ))}
    </div>
  );
}

/**
 * EIN EINTRAG WIE IN DER STRUKTURA BIS 2026-10-24: ganz (eine Aussage mit ihren Bausteinen), seine
 * Verweise mit Stelle samt „pokaż w tekście", darunter seine Gruppen („Argumenty za", „← O czym")
 * — Ebene um Ebene. Für Widoki ohne „Idź po strukturze" und für das, was ein Widok an einem Schritt holt.
 */
function ClassicNode({ node, onOpen, top = false }: { node: OutlineNode; onOpen: (id: string) => void; top?: boolean }) {
  const { lib } = useCtx();
  const entity = lib.entity(node.id);
  if (entity === undefined) return null;
  if (node.again === true) return <p className="cg-muted">↺ <button type="button" className="cg-ref" onClick={() => onOpen(node.id)}>{lib.label(entity)}</button> (już wyżej)</p>;
  const places = fieldsOf(entity, lib.look).filter((f) => f.type === 'ref' && f.locator === true)
    .flatMap((f) => valuesOf(entity, f).filter((v) => typeof v.value === 'string' && v.locator !== undefined).map((v) => ({ f, id: v.value as string, locator: v.locator! })));
  return (
    <div className={top ? 'cg-outline-node cg-outline-top' : 'cg-outline-node'} data-outline-node={node.id}>
      <EntityGlance lib={lib} entity={entity} onEntity={onOpen} />
      {places.map(({ f, id, locator }, i) => {
        const target = lib.entity(id);
        return <div key={i} className="cg-outline-place">{f.label}: {placeText(target, locator, target === undefined ? '' : lib.label(target))}<TextJump look={workLook(id)} workId={id} locator={locator} /></div>;
      })}
      {node.groups.map((g, i) => (
        <section key={`${g.label}-${i}`} className="cg-outline-group">
          {g.label !== '' && <h4 className="cg-outline-h">{g.label}</h4>}
          {g.nodes.map((child, j) => <ClassicNode key={`${child.id}-${j}`} node={child} onOpen={onOpen} />)}
        </section>
      ))}
      {/* 2026-10-25 — wie im Baum; hier sind es Einträge, wohin die Schritte des Widoku führen (auch eine Wurzel, für die kein Platz mehr blieb). */}
      {node.cut !== undefined && <p className="cg-muted">▸ {node.cut} {plural(node.cut, 'wpis', 'wpisy', 'wpisów')} niżej nie pokazano</p>}
    </div>
  );
}

/* -- Auf der Seite eines Eintrags --------------------------------------------------------------- */

/**
 * 2026-10-25 (Wywód) — WIE DIE STRUKTUR AUF DER SEITE EINES EINTRAGS AUSSIEHT: wie in dem Widok,
 * in den ein Wejście an diesem Eintrag führt; sonst wie im ersten Widok „Struktura" mit „Idź po
 * strukturze"; sonst über jedem Knoten das erste Feld zur Auswahl, bei Gleichstand das erste Zahlenfeld.
 */
function displayFor(lib: ReturnType<typeof useCtx>['lib'], entity: Entity): OutlineDisplay {
  const views = lib.docs('view').map((v) => ({ id: v.id, view: readView(v.data) }));
  const viaAnchor = anchorsAt(lib, entity.id).map((a) => views.find((v) => v.id === a.view)).find((v) => v !== undefined && v.view.outline !== null);
  if (viaAnchor?.view.outline) return viaAnchor.view.outline;
  const structural = views.find((v) => v.view.mode === 'outline' && v.view.outline !== null && v.view.steps.some((s) => s.type === 'structure'));
  if (structural?.view.outline) return structural.view.outline;
  const fields = fieldsOf(entity, lib.look);
  return { chip: fields.find((f) => f.type === 'choice')?.key ?? '', tie: fields.find((f) => f.type === 'number')?.key ?? '' };
}

/** Über dem Editor: der Weg von der Wurzel bis hierher, und was unter diesem Eintrag liegt. */
export function EntityStructure({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const { lib } = useCtx();
  const entity = lib.entity(id);
  /* Auch ein Eintrag ohne eigenes Strukturfeld, der in einem `down`-Feld eines anderen steht (oder unter dem einer steht). */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const structured = useMemo(() => entity !== undefined && (isStructured(entity, lib.look) || parentsOf(id, lib).length > 0 || childrenOf(id, lib).length > 0), [lib, lib.revision, id, entity]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const display = useMemo(() => (entity === undefined ? null : displayFor(lib, entity)), [lib, lib.revision, entity]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shape = useMemo(() => (!structured ? null : viewOutline(lib, readView({ mode: 'outline', steps: [{ type: 'source.list', config: { ids: [id] } }, { type: 'structure', config: { dir: 'down' } }], ...(display === null ? {} : { outline: display }) }))), [lib, lib.revision, id, structured, display]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const path = useMemo(() => (!structured ? [] : pathFromRoot(id, lib)), [lib, lib.revision, id, structured]);
  if (entity === undefined || !structured || shape === null) return null;
  const hasKids = shape.roots[0]?.groups.some((g) => g.structure === true && g.nodes.length > 0) === true;
  if (!hasKids && path.length < 2) return null;
  return (
    <section className="cg" data-entity-structure={id}>
      {path.length > 1 && (
        <nav className="cg-row cg-muted" aria-label="W strukturze">
          <span>W strukturze:</span>
          {path.map((x, i) => {
            const e = lib.entity(x);
            const name = e === undefined ? '' : lib.label(e).slice(0, 80);
            return <Fragment key={x}>{i > 0 && <span aria-hidden="true">›</span>}{i === path.length - 1 ? <strong>{name}</strong> : <button type="button" className="cg-ref" onClick={() => onOpen(x)}>{name}</button>}</Fragment>;
          })}
        </nav>
      )}
      {hasKids && <StructureView roots={shape.roots} display={display} onOpen={onOpen} capped={shape.capped} />}
    </section>
  );
}
