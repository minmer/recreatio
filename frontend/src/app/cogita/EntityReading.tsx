/**
 * 2026-10-31 — EIN EINTRAG ZUM LESEN, für Lernende: nach einer Antwort (die Erklärung) und vor der ersten Frage eines
 * neuen Themas („Nowy temat").
 *
 * <code>
 *   Anriss      das Streszczenie (ein Feld `summary` oder „Streszczenie"), sonst der erste Absatz des Textes — nie der
 *               ganze Text in einem Block
 *   Nowy temat  Titel und Anriss, formatiert wie auf der Seite des Eintrags (fett, Fussnoten zum Anklicken), auf dem
 *               Telefon höchstens vier Zeilen; darunter „Czytaj dalej" (der ganze Text an Ort und Stelle, unten
 *               „Zwiń tekst") und „Czytaj tekst" (die Stelle im Buch: das Feld mit Stelle, sonst die erste Quelle des
 *               Textes, die einen Text hat — im Arbeitsbereich der Czytnik, sonst der Abschnitt hier)
 *   Erklärung   eine Zeile: Titel und der erste Satz des Anrisses — der erste Eintrag zwei, drei Zeilen; aufgeklappt
 *               der ganze Text, Daten als kleine Zeile, Verweise mit Stelle und „Otwórz wpis"
 *   der Text    Absätze, fette Zwischentitel, Fussnoten mit „pokaż w tekście" und dem Czytnik; Listen unter ihrem
 *               Zwischentitel zugeklappt, bis man sie öffnet (`reading.ts`)
 *   nie         was nur die Maschine braucht: Nummern (`nr`), Wahlfelder, ja/nein, Listen, Verweise ohne Stelle
 *               (Gruppen, Ebenen), Orte auf der Karte, Dateien, leere Felder — und von einer Frage alles ausser
 *               ihrem Titel (Kartentext)
 * </code>
 * Gelesen wird nach den Erklärungen im Rodzaj (Typ, Rolle, Stelle); das Streszczenie auch an seinem Namen.
 */

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';

import { Passage, readerPath, TextJump } from '../library/SourceJump';
import { blocksIn, blocksMarkup, blocksTitle, firstSentence, thesisOf } from '../library/blocks';
import { workBehind } from '../library/libraryCite';
import { isSource, refTarget, str, type LibEntry, type Lookup } from '../library/libraryKinds';
import { parseMarkup } from '../library/libraryMarkup';
import { Blocks, countNotes, Inlines, MarkupLinks, NoteList, type MarkupLinkTo } from '../library/markupView';
import { placeFor, workLook } from '../library/sourceFind';
import type { TextLink } from '../library/sourceText';
import { citedPlaces, formatReading, leadAt, leadPlain, leadShape, readingParts, readingPattern, readingSource } from './reading';
import { fieldsOf, fieldText, kindsOf, labelOf, patternKeys, placeText, plainOf, valuesOf, type Entity, type FieldDef } from './schema';
import type { CogitaLibrary } from './store';
import { originPath } from './ui';

const PROSE: ReadonlySet<string> = new Set(['markup', 'text', 'blocks']);
const WHEN: ReadonlySet<string> = new Set(['date', 'range']);

/** Das Streszczenie: ein Feld mit Text, dessen Rolle (oder Schlüssel) `summary` ist — oder das „Streszczenie" heisst. */
const isSummary = (f: FieldDef): boolean =>
  PROSE.has(f.type) && ((f.role ?? f.key) === 'summary' || f.key === 'streszczenie' || f.label.trim().toLowerCase() === 'streszczenie');

/** Der Text eines Feldes als Zapis: Bausteine als ihr Zapis, sonst jeder Wert, durch eine Leerzeile getrennt. */
function proseText(entity: Entity, field: FieldDef): string {
  if (field.type === 'blocks') return blocksMarkup(blocksIn(entity.data[field.key]));
  return valuesOf(entity, field).map((v) => (typeof v.value === 'string' ? v.value : '')).filter((t) => t.trim() !== '').join('\n\n');
}

const paragraphsOf = (text: string): string[] => text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '');

/** Der Anriss eines Feldes ohne Zeichen — für eine Zeile. Ein Streszczenie ganz, ein Text sein erster Absatz. */
function plainLead(entity: Entity, field: FieldDef, whole: boolean): string {
  if (field.type === 'blocks') {
    const blocks = blocksIn(entity.data[field.key]);
    return thesisOf(blocks) || blocksTitle(blocks, true);
  }
  const text = proseText(entity, field);
  if (field.type === 'markup') return whole ? plainOf(text) : leadPlain(text);
  return (whole ? text : paragraphsOf(text)[0] ?? '').replace(/\s+/g, ' ').trim();
}

/** Was zu zeigt und ob danach noch etwas kommt. */
function fieldShape(entity: Entity, field: FieldDef): { readonly lead: boolean; readonly more: boolean } {
  if (field.type === 'text') {
    const n = paragraphsOf(proseText(entity, field)).length;
    return { lead: n > 0, more: n > 1 };
  }
  return leadShape(proseText(entity, field));
}

/** Die Felder, die den Titel bilden — sie stehen nicht noch einmal im Text. */
function labelKeys(entity: Entity, lib: CogitaLibrary): Set<string> {
  return new Set(kindsOf(entity, lib.look).flatMap((k) => patternKeys(k.label)));
}

const filled = (entity: Entity, field: FieldDef): boolean => valuesOf(entity, field).some((v) => v.value !== null && v.value !== '' && !(Array.isArray(v.value) && v.value.length === 0));

/**
 * Was ein Lernender von einem Eintrag liest — Streszczenie, Prosa, Zeit, Quellen; ohne Technisches. Hat sein Rodzaj
 * einen Wzór tekstu (`reading`), ist `shown` der Text nach ihm, und nur er steht da. `pattern`: ein anderer Wzór (die
 * Vorschau im Editor des Rodzaju).
 */
export function readingOf(lib: CogitaLibrary, entity: Entity, pattern?: string) {
  const look = lib.look;
  const inTitle = labelKeys(entity, lib);
  const question = entity.kinds.includes('question');
  const wzor = question ? undefined : pattern ?? readingPattern(entity, look);
  /* Eine Frage als Erklärung: nur ihr Titel — ihre Felder sind Kartentext (Möglichkeiten, Antworten), keine Lektüre. */
  const fields = question ? [] : fieldsOf(entity, look).filter((f) => filled(entity, f));
  const summary = fields.find(isSummary);
  const prose = fields.filter((f) => PROSE.has(f.type) && f !== summary && !(f.type !== 'blocks' && inTitle.has(f.key)));
  const when = fields.filter((f) => WHEN.has(f.type)).map((f) => ({ label: f.label, text: fieldText(entity, f, look) })).filter((x) => x.text !== '');
  const places = fields.filter((f) => f.type === 'ref' && f.locator === true)
    .flatMap((f) => valuesOf(entity, f).filter((v) => typeof v.value === 'string' && v.value !== '')
      .map((v) => ({ field: f, work: v.value as string, locator: v.locator ?? '' })));
  const leadField = summary ?? prose[0];
  const shown = wzor === undefined || wzor.trim() === '' ? undefined : formatReading(wzor, entity, look);
  return {
    title: labelOf(entity, look),
    summary,
    prose,
    when,
    places,
    /** Der Text nach dem Wzór des Rodzaju — statt Streszczenie, Feldern, Daten und Stellen. */
    shown,
    /** Der Anriss ohne Zeichen: der erste Absatz nach dem Wzór, sonst das Streszczenie, sonst der erste Absatz des ersten Textes. */
    lead: shown !== undefined ? leadPlain(shown) : leadField === undefined ? '' : plainLead(entity, leadField, leadField === summary)
  };
}

type Reading = ReturnType<typeof readingOf>;

/* -- Der Text ------------------------------------------------------------------------------------------------- */

/** Ein Sprung zu einer Stelle in einer zugeklappten Liste: erst die Klappen um sie auf. */
function openFoldsTo(id: string): void {
  for (let d = document.getElementById(id)?.closest('details') ?? null; d !== null; d = d.parentElement?.closest('details') ?? null) d.open = true;
}

const smooth = (): ScrollBehavior => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/**
 * EIN TEXT MIT ZAPIS — dieselben Bausteine wie auf der Seite des Eintrags (`Markup`, `markupView.tsx`), aber Listen
 * unter ihrem Zwischentitel zugeklappt. `short`: nur der Anriss (der erste Absatz), ohne die Fussnoten darunter — ihre
 * Nummern sind schon die des ganzen Textes.
 */
function ReadingMarkup({ lib, text, onEntity, short }: { lib: CogitaLibrary; text: string; onEntity?: (id: string) => void; short: boolean }) {
  const look = lib.markupLook;
  const prefix = `cg${useId().replace(/[^A-Za-z0-9]/g, '')}-`;
  const blocks = useMemo(() => parseMarkup(readingSource(text)), [text]);
  const notes = useMemo(() => countNotes([blocks], look), [blocks, look]);
  const parts = useMemo(() => readingParts(blocks), [blocks]);
  const links = useMemo<MarkupLinkTo>(() => (onEntity === undefined ? {} : { open: (e: LibEntry) => onEntity(e.id) }), [onEntity]);
  const at = short ? leadAt(blocks) : -1;
  const lead = at < 0 ? undefined : blocks[at];
  /* Zurück aus den Fussnoten in eine zugeklappte Liste: die Klappe geht auf, bevor gesprungen wird. */
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    const href = (e.target as Element).closest('a')?.getAttribute('href') ?? '';
    if (href.startsWith(`#${prefix}`)) openFoldsTo(href.slice(1));
  };
  return (
    <MarkupLinks.Provider value={links}>
      <div className="cg-markup" onClickCapture={onClickCapture}>
        {short
          ? lead !== undefined && <Blocks blocks={[lead]} look={look} notes={notes} prefix={prefix} />
          : parts.map((part, i) => (part.t === 'block'
            ? <Blocks key={i} blocks={[part.block]} look={look} notes={notes} prefix={prefix} />
            : (
              <details key={i} className="cg-fold" data-fold={part.items}>
                <summary>
                  <span className="cg-fold-title"><Inlines list={part.head} notes={notes} prefix={prefix} look={look} /></span>
                  <span className="cg-fold-count" aria-label={`${part.items} pozycji`}>{part.items}</span>
                </summary>
                <Blocks blocks={part.body} look={look} notes={notes} prefix={prefix} />
              </details>
            )))}
        {!short && <NoteList notes={notes} prefix={prefix} />}
      </div>
    </MarkupLinks.Provider>
  );
}

/** Ein Feld mit Text: Zapis und Bausteine wie oben, schlichter Text in Absätzen. */
function ReadingField({ lib, entity, field, onEntity, short = false }: { lib: CogitaLibrary; entity: Entity; field: FieldDef; onEntity?: (id: string) => void; short?: boolean }) {
  const text = proseText(entity, field);
  if (field.type === 'text') {
    const paragraphs = paragraphsOf(text);
    return <div className="cg-reading-text">{(short ? paragraphs.slice(0, 1) : paragraphs).map((p, i) => <p key={i}>{p}</p>)}</div>;
  }
  return <ReadingMarkup lib={lib} text={text} onEntity={onEntity} short={short} />;
}

/** Daten als kleine Zeile, Verweise mit Stelle (Werk, Seite, „pokaż w tekście"). */
function ReadingMeta({ lib, r }: { lib: CogitaLibrary; r: Reading }) {
  return (
    <>
      {r.when.length > 0 && <p className="cg-reading-meta">{r.when.map((w) => `${w.label}: ${w.text}`).join(' · ')}</p>}
      {r.places.map((p, i) => {
        const target = lib.entity(p.work);
        const name = target === undefined ? '' : lib.label(target);
        return (
          <p key={i} className="cg-reading-meta cg-reading-source">
            {p.field.label}: {p.locator === '' ? name || '…' : placeText(target, p.locator, name)}
            {p.locator !== '' && <TextJump look={workLook(p.work)} workId={p.work} locator={p.locator} />}
          </p>
        );
      })}
    </>
  );
}

/** Wohin „Otwórz wpis" führt: in seiner Baza (oder Bibliothek) — ohne Herkunft nichts. */
function openHref(lib: CogitaLibrary, id: string): string | undefined {
  const from = lib.origin(id);
  return from === undefined ? undefined : originPath(from, id, 'wpisy');
}

/* -- „Czytaj tekst": die Stelle im Buch ----------------------------------------------------------------------- */

interface SourceLink {
  readonly link: TextLink;
  readonly look: Lookup | undefined;
  /** Im Arbeitsbereich: der Czytnik an dieser Stelle. Sonst klappt der Abschnitt hier auf. */
  readonly href?: string;
}

const inWorkspace = (): boolean => typeof window !== 'undefined' && window.location.hash.startsWith('#/workspace');

function textAt(look: Lookup | undefined, workId: string, locator: string): SourceLink | null {
  const link = placeFor(look, workId, locator);
  if (link === null || link.status !== 'found') return null;
  const href = inWorkspace() ? readerPath(link) : undefined;
  return { link, look, ...(href === undefined ? {} : { href }) };
}

/** Das Feld mit Stelle (ein Werk und seine Seite), sonst die erste Quelle des Textes, deren Text dieser Leser hat. */
function sourceOf(lib: CogitaLibrary, entity: Entity, r: Reading): SourceLink | null {
  for (const p of r.places) {
    const hit = textAt(workLook(p.work), p.work, p.locator);
    if (hit !== null) return hit;
  }
  const look = lib.markupLook;
  for (const field of [...(r.summary === undefined ? [] : [r.summary]), ...r.prose]) {
    if (field.type === 'text') continue;
    for (const item of citedPlaces(parseMarkup(readingSource(proseText(entity, field))))) {
      const target = refTarget(look, item.key);
      if (target === undefined || !isSource(target)) continue;
      const work = workBehind(target, look);
      if (work === undefined) continue;
      const hit = textAt(look, work.id, target.kind === 'quote' ? (item.locator || str(target.data, 'locator')) : item.locator);
      if (hit !== null) return hit;
    }
  }
  return null;
}

/* -- Die Erklärung nach einer Antwort ------------------------------------------------------------------------- */

/**
 * EIN EINTRAG IN DER ERKLÄRUNG. `line` — eine Zeile (Titel und erster Satz); `preview` — der erste Eintrag: Titel und
 * zwei, drei Zeilen. Aufgeklappt der ganze Text.
 */
export function EntityReading({ lib, entity, onEntity, variant = 'line' }: {
  lib: CogitaLibrary;
  entity: Entity;
  onEntity?: (id: string) => void;
  variant?: 'line' | 'preview';
}) {
  const [open, setOpen] = useState(false);
  const bodyId = `cg-read-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const r = readingOf(lib, entity);
  const href = onEntity === undefined ? openHref(lib, entity.id) : undefined;
  const lead = variant === 'line' ? firstSentence(r.lead) : r.lead;
  return (
    <div className={`cg-reading is-${variant}${open ? ' is-open' : ''}`} data-reading={entity.id}>
      <button type="button" className="cg-reading-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((x) => !x)}>
        <span className="cg-reading-chevron" aria-hidden>{open ? '▾' : '▸'}</span>
        <span className="cg-reading-line">
          <strong className="cg-reading-title">{r.title}</strong>
          {!open && lead !== '' && lead !== r.title && <span className="cg-reading-lead">{variant === 'line' ? ` — ${lead}` : lead}</span>}
        </span>
      </button>
      {open && (
        <div className="cg-reading-body" id={bodyId}>
          {r.summary !== undefined && <section className="cg-reading-part"><ReadingField lib={lib} entity={entity} field={r.summary} onEntity={onEntity} /></section>}
          {r.prose.map((f, i) => (
            <section key={f.key} className="cg-reading-part">
              {(i > 0 || r.summary !== undefined) && <h4 className="cg-reading-label">{f.label}</h4>}
              <ReadingField lib={lib} entity={entity} field={f} onEntity={onEntity} />
            </section>
          ))}
          <ReadingMeta lib={lib} r={r} />
          {onEntity !== undefined
            ? <button type="button" className="wk-link-btn cg-reading-open" onClick={() => onEntity(entity.id)}>Otwórz wpis</button>
            : href !== undefined && <a className="wk-link-btn cg-reading-open" href={href}>Otwórz wpis</a>}
        </div>
      )}
    </div>
  );
}

/**
 * DIE ERKLÄRUNG NACH EINER ANTWORT: zuerst das Thema der Frage („O czym"), dann, was sie zur Erklärung nennt — jedes
 * einmal, alle zugeklappt; der erste mit zwei, drei Zeilen.
 */
export function ExplainList({ lib, ids, onEntity }: { lib: CogitaLibrary; ids: readonly string[]; onEntity?: (id: string) => void }) {
  const entities = [...new Set(ids)].map((id) => lib.entity(id)).filter((e): e is Entity => e !== undefined);
  if (entities.length === 0) return null;
  return (
    <div className="cg-explain" data-explain={entities.length}>
      {entities.map((e, i) => <EntityReading key={e.id} lib={lib} entity={e} onEntity={onEntity} variant={i === 0 ? 'preview' : 'line'} />)}
    </div>
  );
}

/* -- „Nowy temat" ---------------------------------------------------------------------------------------------- */

/**
 * EIN NEUES THEMA VOR SEINER ERSTEN FRAGE: Titel und Anriss (kurz — die Frage bleibt auf dem Telefon im Blick), „Czytaj
 * dalej" klappt den ganzen Text an Ort und Stelle auf, „Czytaj tekst" führt zur Stelle im Buch. Eine Fussnote im
 * Anriss klappt auf und springt zu ihr.
 */
export function TopicIntro({ lib, entity }: { lib: CogitaLibrary; entity: Entity }) {
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState(false);
  const [clamped, setClamped] = useState(false);
  const bodyId = `cg-intro-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  /* Was nach dem Auf- oder Zuklappen geschieht: zur Fussnote springen, den Text fokussieren, das Thema wieder zeigen. */
  const then = useRef<{ jump?: string; focus?: boolean; back?: boolean }>({});
  const r = readingOf(lib, entity);
  const source = useMemo(() => sourceOf(lib, entity, readingOf(lib, entity)), [lib, entity]);
  const leadField = r.summary ?? r.prose[0];
  const shape = leadField === undefined ? { lead: false, more: false } : fieldShape(entity, leadField);
  const more = shape.more || r.prose.length > (r.summary === undefined ? 1 : 0) || r.when.length > 0 || r.places.length > 0;

  /* Zu: ist der Anriss länger als seine Zeilen, gibt es auch „Czytaj dalej" (gemessen nach dem Zeichnen, auch beim Drehen). */
  useEffect(() => {
    const el = body.current;
    if (el === null || open) return undefined;
    const measure = () => {
      const p = el.querySelector('p');
      setClamped(p !== null && p.scrollHeight > p.clientHeight + 1);
    };
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(el);
    return () => watch?.disconnect();
  }, [open, entity]);

  useEffect(() => {
    const next = then.current;
    then.current = {};
    if (open && next.jump !== undefined) document.getElementById(next.jump)?.scrollIntoView({ behavior: smooth(), block: 'center' });
    else if (open && next.focus === true) body.current?.focus({ preventScroll: true });
    else if (!open && next.back === true && (root.current?.getBoundingClientRect().top ?? 0) < 0) root.current?.scrollIntoView({ behavior: smooth(), block: 'start' });
  }, [open]);

  /* Eine Fussnote im Anriss: erst der ganze Text, dann zu ihr. */
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (open) return;
    const a = (e.target as Element).closest('a');
    const href = a?.getAttribute('href') ?? '';
    if (a == null || !href.startsWith('#') || a.closest('.lib-fnref') === null) return;
    e.preventDefault();
    e.stopPropagation();
    then.current = { jump: href.slice(1) };
    setOpen(true);
  };

  return (
    <div ref={root} className={`cg-reading is-intro${open ? ' is-open' : ''}`} data-reading={entity.id} onClickCapture={onClickCapture}>
      <h3 className="cg-reading-title">{r.title}</h3>
      <div ref={body} id={bodyId} tabIndex={-1} className={open ? 'cg-reading-body' : 'cg-reading-short'} data-read-open={open ? '' : undefined}>
        {r.summary !== undefined && <section className="cg-reading-part"><ReadingField lib={lib} entity={entity} field={r.summary} short={!open} /></section>}
        {r.prose.map((f, i) => (open || (r.summary === undefined && i === 0)) && (
          <section key={f.key} className="cg-reading-part">
            {open && (i > 0 || r.summary !== undefined) && <h4 className="cg-reading-label">{f.label}</h4>}
            <ReadingField lib={lib} entity={entity} field={f} short={!open} />
          </section>
        ))}
        {open && <ReadingMeta lib={lib} r={r} />}
      </div>
      {(more || clamped || source !== null) && (
        <div className="cg-reading-actions">
          {(more || clamped) && (
            <button type="button" className="wk-link-btn" aria-expanded={open} aria-controls={bodyId} data-read-more=""
              onClick={() => { then.current = open ? { back: true } : { focus: true }; setOpen((x) => !x); }}>
              {open ? 'Zwiń tekst' : 'Czytaj dalej'}
            </button>
          )}
          {source !== null && (source.href !== undefined
            ? <a className="wk-link-btn" href={source.href} data-read-source="">Czytaj tekst</a>
            : <button type="button" className="wk-link-btn" aria-expanded={passage} data-read-source="" onClick={() => setPassage((x) => !x)}>{passage ? 'Ukryj tekst' : 'Czytaj tekst'}</button>)}
        </div>
      )}
      {passage && source !== null && <Passage look={source.look} link={source.link} />}
    </div>
  );
}
