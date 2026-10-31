/**
 * 2026-10-31 — EIN EINTRAG ZUM LESEN, für Lernende: nach einer Antwort (die Erklärung) und vor der ersten Frage eines
 * neuen Themas.
 *
 * <code>
 *   zu        eine Zeile: der Titel und der erste Satz seines Streszczenie (Feld mit der Rolle `summary`, sonst das erste
 *             Feld mit Text) — beim ersten Eintrag zwei, drei Zeilen davon
 *   auf       der ganze Text: Zapis mit Fussnoten (die Quelle mit „pokaż w tekście" und dem Czytnik), Bausteine, Daten
 *             als kleine Zeile, Verweise mit Stelle (Werk, Seite, „pokaż w tekście") — und „Otwórz wpis"
 *   nie       was nur die Maschine braucht: Nummern (`nr`), Wahlfelder, ja/nein, Listen, Verweise ohne Stelle
 *             (Gruppen, Ebenen), Orte auf der Karte, Dateien, leere Felder — und von einer Frage alles ausser
 *             ihrem Titel (Kartentext)
 * </code>
 * Gelesen wird nach den Erklärungen im Rodzaj (Typ, Rolle, Stelle), nie nach dem Schlüssel eines Feldes.
 */

import { useId, useState } from 'react';

import { TextJump } from '../library/SourceJump';
import { blocksIn, blocksMarkup, firstSentence, thesisOf, blocksTitle } from '../library/blocks';
import { workLook } from '../library/sourceFind';
import { fieldsOf, fieldText, labelOf, patternKeys, placeText, plainOf, roleField, valuesOf, kindsOf, type Entity, type FieldDef } from './schema';
import type { CogitaLibrary } from './store';
import { Markup, originPath } from './ui';

const PROSE: ReadonlySet<string> = new Set(['markup', 'text', 'blocks']);
const WHEN: ReadonlySet<string> = new Set(['date', 'range']);

/** Der Text eines Feldes mit Prosa, schlicht — für die Kopfzeile. */
function plainField(entity: Entity, field: FieldDef): string {
  const raw = entity.data[field.key];
  if (field.type === 'blocks') {
    const blocks = blocksIn(raw);
    return thesisOf(blocks) || blocksTitle(blocks, true);
  }
  const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').join(' ') : '';
  return field.type === 'markup' ? plainOf(text) : text.replace(/\s+/g, ' ').trim();
}

/** Die Felder, die den Titel bilden — sie stehen nicht noch einmal im Text. */
function labelKeys(entity: Entity, lib: CogitaLibrary): Set<string> {
  return new Set(kindsOf(entity, lib.look).flatMap((k) => patternKeys(k.label)));
}

const filled = (entity: Entity, field: FieldDef): boolean => valuesOf(entity, field).some((v) => v.value !== null && v.value !== '' && !(Array.isArray(v.value) && v.value.length === 0));

/** Was ein Lernender von einem Eintrag liest — Streszczenie, Prosa, Zeit, Quellen; ohne Technisches. */
export function readingOf(lib: CogitaLibrary, entity: Entity) {
  const look = lib.look;
  const inTitle = labelKeys(entity, lib);
  /* Eine Frage als Erklärung: nur ihr Titel — ihre Felder sind Kartentext (Möglichkeiten, Antworten), keine Lektüre. */
  const fields = entity.kinds.includes('question') ? [] : fieldsOf(entity, look).filter((f) => filled(entity, f));
  const summaryField = roleField(entity, look, 'summary');
  const prose = fields.filter((f) => PROSE.has(f.type) && f.role !== 'summary' && !(f.type !== 'blocks' && inTitle.has(f.key)));
  const summarySource = summaryField !== undefined && filled(entity, summaryField) ? summaryField : prose[0];
  const summary = summarySource === undefined ? '' : plainField(entity, summarySource);
  const when = fields.filter((f) => WHEN.has(f.type)).map((f) => ({ label: f.label, text: fieldText(entity, f, look) })).filter((x) => x.text !== '');
  const places = fields.filter((f) => f.type === 'ref' && f.locator === true)
    .flatMap((f) => valuesOf(entity, f).filter((v) => typeof v.value === 'string' && v.value !== '')
      .map((v) => ({ field: f, work: v.value as string, locator: v.locator ?? '' })));
  return {
    title: labelOf(entity, look),
    summary,
    /** Das Streszczenie stand als eigenes Feld da: es ist im Text noch nicht enthalten. */
    summaryOwn: summarySource !== undefined && summarySource === summaryField,
    /** Ein Feld mit Text, das nichts als das Streszczenie sagt (ein kurzer Opis) — steht es schon da, nicht noch einmal. */
    onlySummary: prose.find((f) => f === summarySource && plainField(entity, f) === summary),
    prose,
    when,
    places,
    /** Mehr als die Kopfzeile: ein Text, ein Datum, eine Quelle. */
    more: prose.some((f) => !(f === summarySource && plainField(entity, f) === summary)) || when.length > 0 || places.length > 0
  };
}

function ProseField({ lib, entity, field, onEntity }: { lib: CogitaLibrary; entity: Entity; field: FieldDef; onEntity?: (id: string) => void }) {
  const raw = entity.data[field.key];
  if (field.type === 'blocks') return <Markup text={blocksMarkup(blocksIn(raw))} lib={lib} onEntity={onEntity} />;
  if (field.type === 'markup') return <Markup text={typeof raw === 'string' ? raw : ''} lib={lib} onEntity={onEntity} />;
  const text = typeof raw === 'string' ? raw : '';
  return <div className="cg-reading-text">{text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>;
}

/** Wohin „Otwórz wpis" führt: in seiner Baza (oder Bibliothek) — ohne Herkunft nichts. */
function openHref(lib: CogitaLibrary, id: string): string | undefined {
  const from = lib.origin(id);
  return from === undefined ? undefined : originPath(from, id, 'wpisy');
}

/**
 * EIN EINTRAG ZUM LESEN. `line` — eine Zeile (Titel und erster Satz); `preview` — der erste Eintrag einer Erklärung:
 * Titel und zwei, drei Zeilen; `intro` — ein neues Thema vor seiner ersten Frage: Titel, Streszczenie, „Czytaj tekst".
 */
export function EntityReading({ lib, entity, onEntity, variant = 'line' }: {
  lib: CogitaLibrary;
  entity: Entity;
  onEntity?: (id: string) => void;
  variant?: 'line' | 'preview' | 'intro';
}) {
  const [open, setOpen] = useState(false);
  const bodyId = `cg-read-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const r = readingOf(lib, entity);
  const href = onEntity === undefined ? openHref(lib, entity.id) : undefined;
  const lead = variant === 'line' ? firstSentence(r.summary) : r.summary;
  const body = (
    <div className="cg-reading-body" id={bodyId}>
      {r.summaryOwn && variant !== 'intro' && r.summary !== '' && <p className="cg-reading-summary">{r.summary}</p>}
      {r.prose.filter((f) => !(variant === 'intro' && f === r.onlySummary)).map((f, i) => (
        <section key={f.key} className="cg-reading-part">
          {(i > 0 || r.summaryOwn) && <h4 className="cg-reading-label">{f.label}</h4>}
          <ProseField lib={lib} entity={entity} field={f} onEntity={onEntity} />
        </section>
      ))}
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
      {onEntity !== undefined
        ? <button type="button" className="wk-link-btn cg-reading-open" onClick={() => onEntity(entity.id)}>Otwórz wpis</button>
        : href !== undefined && <a className="wk-link-btn cg-reading-open" href={href}>Otwórz wpis</a>}
    </div>
  );

  if (variant === 'intro') {
    return (
      <div className="cg-reading is-intro" data-reading={entity.id}>
        <h3 className="cg-reading-title">{r.title}</h3>
        {r.summary !== '' && <p className="cg-reading-summary">{r.summary}</p>}
        {r.more && (
          <button type="button" className="wk-link-btn" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((x) => !x)}>
            {open ? 'Zwiń tekst' : 'Czytaj tekst'}
          </button>
        )}
        {open && body}
      </div>
    );
  }

  return (
    <div className={`cg-reading is-${variant}${open ? ' is-open' : ''}`} data-reading={entity.id}>
      <button type="button" className="cg-reading-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((x) => !x)}>
        <span className="cg-reading-chevron" aria-hidden>{open ? '▾' : '▸'}</span>
        <span className="cg-reading-line">
          <strong className="cg-reading-title">{r.title}</strong>
          {!open && lead !== '' && lead !== r.title && <span className="cg-reading-lead">{variant === 'line' ? ` — ${lead}` : lead}</span>}
        </span>
      </button>
      {open && body}
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
