/**
 * Die Bausteine einer Vorlage (COGITA.md §5): Daten, Text, Wahl, Zahlen, Karte — und die Palette, aus der der Editor sie anbietet.
 */

import { type AnswerSpec, type Fragment, type Item, type PromptPart, type TemplateContext, fragmentTree, isObject, lines, num, rngOf, shuffle, shuffleAway, shuffledPairs, str } from './cardBasics';
import { GAP_RULE, TEXT_RULE, readDateAnswer, readRule } from './check';
import { type NodeKind, type Port, paletteOf } from './graph';
import { type DatePrecision, type Entity, type GeoPoint, type MediaRef, dateKey, fieldOf, labelOf, plainOf, readDate, readNumber, valueText, valuesOf } from './schema';
import { blockPlain, thesisOf, type CommentBlock } from '../library/blocks';
import { entityAbout, entityBlocks } from './statements';
import { guessKind, kindById } from '../core/quantities';
import { hasTex } from '../core/tex';
import { compile, isExprError, isList, isRecord, newEnv, recordId, takeOverrun, truth as isTrue, valueText as exprText, withRng, type Val } from '../pages/motion/expr';
import { drawInstance, readParamsSpec, recordOf, storedValues, type GenWorld, type Stored } from './generator';
import { t } from '../core/i18n';

/** Was an einem Eingang ankam — alle Kanten, alle Stücke, in einer Liste. */
const itemsAt = (inputs: Readonly<Record<string, readonly unknown[]>>, port: string): Item[] =>
  (inputs[port] ?? []).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v): v is Item => isObject(v) && typeof (v as { text?: unknown }).text === 'string');

const texts = (items: readonly Item[]): string[] => items.map((i) => i.text).filter((t) => t.trim() !== '');

const port = (id: string, label: string, type = 'items', many = false): Port => ({ id, label, type, many });

type Kind = NodeKind<TemplateContext>;

const rngFor = (ctx: TemplateContext, nodeId: string) => rngOf(`${ctx.seed}:${nodeId}:${ctx.variant ?? ''}`);

/** Die Einträge, deren Feld gelesen wird: was ankommt, sonst der eigene. */
function sourcesOf(ctx: TemplateContext, items: readonly Item[]): Entity[] {
  if (items.length === 0) return [ctx.entity];
  return items.map((i) => (i.entity === undefined ? undefined : ctx.look.entity(i.entity))).filter((e): e is Entity => e !== undefined);
}

/**
 * 2026-11-01 — EIN TEXT MIT WZORY: als `$…$` (gesetzt von KaTeX auf der Karte), wenn wirklich ein Wzór darin steht —
 * sonst genau wie bisher (eine Zeile ohne LaTeX). Ohne Dollar ist die Fassung mit Wzory dieselbe; steht nur ein Dollar
 * da, der kein Wzór ist (`\$`), gilt die alte Zeile — sonst müsste man einen Backslash tippen.
 */
const texOr = (tex: string, plain: () => string): string => (!tex.includes('$') || hasTex(tex) ? tex : plain());

/** Das Etikett eines Eintrags für eine Karte — mit seinen Wzory, wenn es welche hat. */
const labelFor = (entity: Entity, look: TemplateContext['look']): string => texOr(labelOf(entity, look, 0, false, true), () => labelOf(entity, look));

function readField(ctx: TemplateContext, entities: readonly Entity[], key: string): Item[] {
  const out: Item[] = [];
  for (const entity of entities) {
    const field = fieldOf(entity, ctx.look, key);
    if (field === undefined) continue;
    for (const v of valuesOf(entity, field)) {
      if (v.value === null) continue;
      const value = v.value;
      /* 2026-11-01 — ein Verweis heisst wie sein Ziel, mit dessen Wzory (`valueText` mit `tex`). */
      const text = field.type === 'ref' ? texOr(valueText(field, value, ctx.look, 0, false, true), () => valueText(field, value, ctx.look)) : valueText(field, value, ctx.look);
      if (field.type === 'ref' && typeof value === 'string') out.push({ text, entity: value, state: v.state });
      else if (field.type === 'media' && isObject(value)) out.push({ text, media: value as unknown as MediaRef, state: v.state });
      else if (field.type === 'markup' && typeof value === 'string') out.push({ text: texOr(plainOf(value, 'inline'), () => plainOf(value)), value, state: v.state });
      /* 2026-10-22 — die Bausteine einer Aussage: einer je Stück (Absatz, Liste, Tabelle). */
      else if (field.type === 'blocks' && Array.isArray(v.value)) for (const block of v.value as readonly CommentBlock[]) out.push({ text: blockPlain(block, refName(ctx)), state: v.state });
      else out.push({ text, value: v.value, state: v.state });
    }
  }
  return out;
}

const FIELD: Kind = {
  type: 'field', get label() { return t('cogitaEditCard.kind.field.label'); }, get group() { return t('cogitaEditCard.group.data'); },
  get says() { return t('cogitaEditCard.kind.field.says'); },
  ports: () => ({ inputs: [port('of', t('cogitaEditCard.port.fromEntries'), 'items', true)], outputs: [port('values', t('cogitaEditCard.port.values'))] }),
  run: ({ config, inputs, ctx }) => ({ values: readField(ctx, sourcesOf(ctx, itemsAt(inputs, 'of')), str(config.key)) })
};

/* -- 2026-10-22: Aussagen — Teza, Stücke, Tabelle, Gegenstände ------------------------------------
 * 2026-10-23 — jeder Eintrag, dessen Rodzaj ein Feld `blocks` hat (`statements.ts`), nicht mehr nur
 * der Komentarz der Bibliothek. Die Teza ist der erste Satz des ersten Absatzes seines ersten Feldes
 * `blocks`; „worüber" sind die Werte seiner Verweisfelder (mit Stelle). */

/** Wie ein Verweis in einer Zelle heisst: bei der Schrift die Stelle allein („Łk 1,35"), sonst der Name mit der Stelle. */
const refName = (ctx: TemplateContext) => (ref: string, locator: string): string => {
  const target = ctx.look.entity(ref);
  if (target === undefined) return locator;
  if (target.data.workType === 'bible' && locator !== '') return locator;
  return [labelOf(target, ctx.look), locator].filter(Boolean).join(', ');
};

const STATEMENT_THESIS: Kind = {
  type: 'statement.thesis', get label() { return t('cogitaEditCard.kind.statementThesis.label'); }, get group() { return t('cogitaEditCard.group.statement'); },
  get says() { return t('cogitaEditCard.kind.statementThesis.says'); },
  ports: () => ({ inputs: [port('of', t('cogitaEditCard.port.fromEntries'), 'items', true)], outputs: [port('text', t('cogitaEditCard.port.thesis'))] }),
  run: ({ inputs, ctx }) => ({ text: sourcesOf(ctx, itemsAt(inputs, 'of')).map((e) => ({ text: thesisOf(entityBlocks(e, ctx.look)), entity: e.id })).filter((i) => i.text !== '') })
};

const STATEMENT_PART: Kind = {
  type: 'statement.part', get label() { return t('cogitaEditCard.kind.statementPart.label'); }, get group() { return t('cogitaEditCard.group.statement'); },
  get says() { return t('cogitaEditCard.kind.statementPart.says'); },
  ports: () => ({ inputs: [port('of', t('cogitaEditCard.port.fromEntries'), 'items', true)], outputs: [port('values', t('cogitaEditCard.port.parts'))] }),
  run: ({ config, inputs, ctx }) => {
    const n = Math.round(num(config.n, 0));
    const out: Item[] = [];
    for (const e of sourcesOf(ctx, itemsAt(inputs, 'of'))) {
      const blocks = entityBlocks(e, ctx.look);
      const chosen = n > 0 ? blocks.slice(n - 1, n) : blocks.filter((b) => b.type === 'paragraph');
      for (const block of chosen) {
        if (block.type === 'paragraph') out.push({ text: blockPlain(block, refName(ctx)) });
        else if (block.type === 'table') for (const row of block.rows) out.push({ text: blockPlain({ type: 'table', columns: block.columns, rows: [row] }, refName(ctx)) });
        else for (const cell of block.items) out.push({ text: blockPlain({ type: block.type, items: [cell] }, refName(ctx)) });
      }
    }
    return { values: out.filter((i) => i.text !== '') };
  }
};

const STATEMENT_TABLE: Kind = {
  type: 'statement.table', get label() { return t('cogitaEditCard.kind.statementTable.label'); }, get group() { return t('cogitaEditCard.group.statement'); },
  get says() { return t('cogitaEditCard.kind.statementTable.says'); },
  ports: () => ({ inputs: [port('of', t('cogitaEditCard.port.fromEntries'), 'items', true)], outputs: [port('left', t('cogitaEditCard.port.columnA')), port('right', t('cogitaEditCard.port.columnB'))] }),
  run: ({ config, inputs, ctx }) => {
    const a = Math.max(1, Math.round(num(config.left, 1))) - 1;
    const b = Math.max(1, Math.round(num(config.right, 2))) - 1;
    const which = Math.max(1, Math.round(num(config.table, 1)));
    const left: Item[] = [];
    const right: Item[] = [];
    for (const e of sourcesOf(ctx, itemsAt(inputs, 'of'))) {
      const table = entityBlocks(e, ctx.look).filter((x): x is Extract<CommentBlock, { type: 'table' }> => x.type === 'table')[which - 1];
      if (table === undefined) continue;
      for (const row of table.rows) {
        const l = row[a] === undefined ? '' : blockPlain({ type: 'unordered', items: [row[a]!] }, refName(ctx));
        const r = row[b] === undefined ? '' : blockPlain({ type: 'unordered', items: [row[b]!] }, refName(ctx));
        if (l === '' || r === '') continue;
        left.push({ text: l });
        right.push({ text: r });
      }
    }
    return { left, right };
  }
};

const STATEMENT_SUBJECTS: Kind = {
  type: 'statement.subjects', get label() { return t('cogitaEditCard.kind.statementSubjects.label'); }, get group() { return t('cogitaEditCard.group.statement'); },
  get says() { return t('cogitaEditCard.kind.statementSubjects.says'); },
  ports: () => ({ inputs: [port('of', t('cogitaEditCard.port.fromEntries'), 'items', true)], outputs: [port('entities', t('cogitaEditCard.port.entries'))] }),
  run: ({ inputs, ctx }) => ({
    entities: sourcesOf(ctx, itemsAt(inputs, 'of')).flatMap((e) => entityAbout(e, ctx.look).map((s) => ({ text: refName(ctx)(s.ref, s.locator), entity: s.ref })))
  })
};

const MEDIA: Kind = {
  type: 'media', get label() { return t('cogitaEditCard.kind.media.label'); }, get group() { return t('cogitaEditCard.group.data'); },
  get says() { return t('cogitaEditCard.kind.media.says'); },
  ports: () => ({ inputs: [port('of', t('cogitaEditCard.port.fromEntries'), 'items', true)], outputs: [port('values', t('cogitaEditCard.port.files'))] }),
  run: ({ config, inputs, ctx }) => ({ values: readField(ctx, sourcesOf(ctx, itemsAt(inputs, 'of')), str(config.key)).filter((i) => i.media !== undefined) })
};

/** Mehrere Schritte über Verweise: „autor → miejsce urodzenia". */
const FOLLOW: Kind = {
  type: 'follow', get label() { return t('cogitaEditCard.kind.follow.label'); }, get group() { return t('cogitaEditCard.group.data'); },
  get says() { return t('cogitaEditCard.kind.follow.says'); },
  ports: () => ({ inputs: [port('of', t('cogitaEditCard.port.startEntries'), 'items', true)], outputs: [port('entities', t('cogitaEditCard.port.entries'))] }),
  run: ({ config, inputs, ctx }) => {
    let current: Entity[] = sourcesOf(ctx, itemsAt(inputs, 'of'));
    let items: Item[] = [];
    for (const key of lines(config.path)) {
      items = readField(ctx, current, key).filter((i) => i.entity !== undefined);
      current = items.map((i) => ctx.look.entity(i.entity!)).filter((e): e is Entity => e !== undefined);
    }
    return { entities: items };
  }
};

const LIST: Kind = {
  type: 'list', get label() { return t('cogitaEditCard.kind.list.label'); }, get group() { return t('cogitaEditCard.group.data'); },
  get says() { return t('cogitaEditCard.kind.list.says'); },
  ports: () => ({ inputs: [], outputs: [port('values', t('cogitaEditCard.port.items'))] }),
  run: ({ config }) => ({ values: lines(config.items).map((text) => ({ text })) })
};

const SELF: Kind = {
  type: 'entity', get label() { return t('cogitaEditCard.kind.entity.label'); }, get group() { return t('cogitaEditCard.group.data'); },
  get says() { return t('cogitaEditCard.kind.entity.says'); },
  ports: () => ({ inputs: [], outputs: [port('entities', t('cogitaEditCard.port.entry'))] }),
  run: ({ ctx }) => ({ entities: [{ text: labelFor(ctx.entity, ctx.look), entity: ctx.entity.id }] })
};

/** Zwei Stücke sind dasselbe: derselbe Eintrag — oder, wo einem der Eintrag fehlt, derselbe Text. */
const sameItem = (a: Item, b: Item): boolean =>
  a.entity !== undefined && b.entity !== undefined ? a.entity === b.entity : a.text.trim().toLowerCase() === b.text.trim().toLowerCase();

/**
 * 2026-10-18 — TEILT EINTRÄGE NACH EINEM FELD: die, deren Feld einen der
 * Vergleichswerte hat, und die übrigen — die Wörter in der Sprache dieser
 * Karte und die in den anderen. Verglichen wird mit dem, was an „Porównaj z"
 * ankommt (die Sprache aus „Dla każdej wartości"), sonst mit dem getippten
 * Wert; ohne Feld mit dem Eintrag selbst („alle außer diesem").
 */
const FILTER: Kind = {
  type: 'filter', get label() { return t('cogitaEditCard.kind.filter.label'); }, get group() { return t('cogitaEditCard.group.data'); },
  get says() { return t('cogitaEditCard.kind.filter.says'); },
  ports: () => ({ inputs: [port('items', t('cogitaEditCard.port.entries'), 'items', true), port('like', t('cogitaEditCard.port.compareWith'), 'items', true)], outputs: [port('kept', t('cogitaEditCard.port.matching')), port('rest', t('cogitaEditCard.port.others'))] }),
  run: ({ config, inputs, ctx }) => {
    const targets: Item[] = [...itemsAt(inputs, 'like'), ...lines(config.value).map((text) => ({ text }))];
    if (targets.length === 0) throw new Error(t('cogitaEditCard.error.filterNothing'));
    const key = str(config.key);
    const kept: Item[] = [];
    const rest: Item[] = [];
    for (const item of itemsAt(inputs, 'items')) {
      const values = key === '' ? [item] : readField(ctx, sourcesOf(ctx, [item]), key);
      (values.some((v) => targets.some((t) => sameItem(v, t))) ? kept : rest).push(item);
    }
    return { kept, rest };
  }
};

const UNIQUE: Kind = {
  type: 'unique', get label() { return t('cogitaEditCard.kind.unique.label'); }, get group() { return t('cogitaEditCard.group.data'); },
  get says() { return t('cogitaEditCard.kind.unique.says'); },
  ports: () => ({ inputs: [port('items', t('cogitaEditCard.port.values'), 'items', true)], outputs: [port('items', t('cogitaEditCard.port.eachOnce'))] }),
  run: ({ inputs }) => {
    const out: Item[] = [];
    for (const item of itemsAt(inputs, 'items')) if (!out.some((o) => sameItem(o, item))) out.push(item);
    return { items: out };
  }
};

/*
  2026-10-18 — EIN VERZEICHNIS JE VORRAT UND FELD: welche Einträge diesen
  Wert haben. Die Karten aller Einträge entstehen auf einmal; ohne Verzeichnis
  läse jede Karte den ganzen Vorrat (5000 Wörter × 5000 Karten). Der Vorrat
  einer Art ist je Stand der Bibliothek dasselbe Feld — daran hängt es.
  Schlüssel wie `sameItem`: ein Eintrag als `@id` und mit seinem Etikett
  (`~`), ein Text als `#`.
*/
const INDEX = new WeakMap<readonly Entity[], Map<string, Map<string, Entity[]>>>();
const PLACE = new WeakMap<readonly Entity[], Map<string, number>>();
const norm = (text: string) => text.trim().toLowerCase();

function valueIndex(ctx: TemplateContext, pool: readonly Entity[], key: string): Map<string, Entity[]> {
  let byKey = INDEX.get(pool);
  if (byKey === undefined) { byKey = new Map(); INDEX.set(pool, byKey); }
  let index = byKey.get(key);
  if (index === undefined) {
    const built = new Map<string, Entity[]>();
    const put = (k: string, e: Entity) => { const list = built.get(k); if (list === undefined) built.set(k, [e]); else if (list[list.length - 1] !== e) list.push(e); };
    for (const e of pool) {
      for (const v of readField(ctx, [e], key)) {
        if (v.entity !== undefined) { put(`@${v.entity}`, e); put(`~${norm(v.text)}`, e); } else put(`#${norm(v.text)}`, e);
      }
    }
    index = built;
    byKey.set(key, index);
  }
  return index;
}

/** Wo ein Vergleichswert im Verzeichnis steht — dieselbe Regel wie `sameItem`. */
const lookupKeys = (t: Item): string[] => (t.entity !== undefined ? [`@${t.entity}`, `#${norm(t.text)}`] : [`#${norm(t.text)}`, `~${norm(t.text)}`]);

function placeIn(pool: readonly Entity[]): Map<string, number> {
  let place = PLACE.get(pool);
  if (place === undefined) { place = new Map(pool.map((e, i) => [e.id, i])); PLACE.set(pool, place); }
  return place;
}

/** Höchstens `count` zufällig — ohne den ganzen Vorrat zu mischen, wenn er gross ist. */
function sample<T>(list: readonly T[], count: number, rng: () => number): T[] {
  if (list.length <= count * 3) return shuffle(list, rng).slice(0, count);
  const picked = new Set<number>();
  while (picked.size < count) picked.add(Math.floor(rng() * list.length));
  return [...picked].map((i) => list[i]);
}

/**
 * 2026-10-18 — WPISY EINES RODZAJ: alle, oder die, deren Feld einen der
 * Vergleichswerte hat — die Wörter derselben Schreibung, die Übersetzungen,
 * in denen dieses Wort steht (der Weg zurück), die Wörter einer Sprache.
 * Ohne diesen Eintrag, nur aus der aktuellen Sammlung, höchstens N zufällig.
 */
const ENTRIES: Kind = {
  type: 'entries', get label() { return t('cogitaEditCard.kind.entries.label'); }, get group() { return t('cogitaEditCard.group.data'); },
  get says() { return t('cogitaEditCard.kind.entries.says'); },
  ports: () => ({ inputs: [port('like', t('cogitaEditCard.port.whereField'), 'items', true)], outputs: [port('entities', t('cogitaEditCard.port.entries'))] }),
  run: ({ node, config, inputs, ctx }) => {
    const pool = ctx.pool(str(config.kind) || ctx.entity.kinds[0] || '');
    const key = str(config.key);
    let found: readonly Entity[] = pool;
    if (key !== '') {
      const targets: Item[] = [...itemsAt(inputs, 'like'), ...lines(config.value).map((text) => ({ text }))];
      if (targets.length === 0) throw new Error(t('cogitaEditCard.error.entriesNothing'));
      const index = valueIndex(ctx, pool, key);
      const hit = new Set<Entity>();
      for (const t of targets) for (const k of lookupKeys(t)) for (const e of index.get(k) ?? []) hit.add(e);
      const place = placeIn(pool);
      found = [...hit].sort((a, b) => (place.get(a.id) ?? 0) - (place.get(b.id) ?? 0));
    }
    if (config.self === true) found = found.filter((e) => e.id !== ctx.entity.id);
    if (config.scope === true && ctx.scope !== undefined) found = found.filter((e) => ctx.scope!.has(e.id));
    const count = Math.round(num(config.count, 0));
    /* Der Zufall hängt am Eintrag: jede Karte zieht andere — nicht alle dieselben zwölf. */
    if (count > 0) found = sample(found, count, rngOf(`${ctx.seed}:${node.id}:${ctx.entity.id}:${ctx.variant ?? ''}`));
    return { entities: found.map((e) => ({ text: labelFor(e, ctx.look), entity: e.id })) };
  }
};

const PATTERN: Kind = {
  type: 'pattern', get label() { return t('cogitaEditCard.kind.pattern.label'); }, get group() { return t('cogitaEditCard.group.text'); },
  get says() { return t('cogitaEditCard.kind.pattern.says'); },
  ports: (config) => {
    const count = Math.max(1, Math.min(10, Math.round(num(config.inputs, 1))));
    return { inputs: Array.from({ length: count }, (_, i) => port(`p${i}`, `{${i}}`, 'items', true)), outputs: [port('text', t('cogitaEditCard.port.text'))] };
  },
  run: ({ config, inputs }) => {
    const joiner = typeof config.joiner === 'string' ? config.joiner : ', ';
    const text = str(config.text).replace(/\{(\d)\}/g, (_w, i: string) => texts(itemsAt(inputs, `p${i}`)).join(joiner)).replace(/\s+/g, ' ').trim();
    return { text: text === '' ? [] : [{ text }] };
  }
};

/** Wörter — die Lücke fällt auf Wortgrenzen, nie mitten in ein Wort. */
const words = (text: string): string[] => text.split(/(\s+)/).filter((w) => w !== '');

const MASK: Kind = {
  type: 'mask', get label() { return t('cogitaEditCard.kind.mask.label'); }, get group() { return t('cogitaEditCard.group.text'); },
  get says() { return t('cogitaEditCard.kind.mask.says'); },
  ports: () => ({ inputs: [port('text', t('cogitaEditCard.port.text'))], outputs: [port('shown', t('cogitaEditCard.port.withGap')), port('hidden', t('cogitaEditCard.port.hidden')), port('full', t('cogitaEditCard.port.whole'))] }),
  run: ({ node, config, inputs, ctx }) => {
    const text = texts(itemsAt(inputs, 'text')).join(' ');
    const keep = Math.max(0, Math.min(1, num(config.keep, 0.3)));
    const gap = str(config.gap) || '…';
    const parts = words(text);
    const solid = parts.map((w, i) => ({ w, i })).filter((p) => p.w.trim() !== '');
    const visible = Math.max(0, Math.min(solid.length - 1, Math.round(solid.length * keep)));
    let hideIdx: Set<number>;
    if (config.mode === 'suffix') hideIdx = new Set(solid.slice(0, solid.length - visible).map((p) => p.i));
    else if (config.mode === 'random') hideIdx = new Set(shuffle(solid, rngFor(ctx, node.id)).slice(0, solid.length - visible).map((p) => p.i));
    else hideIdx = new Set(solid.slice(visible).map((p) => p.i));
    const shown: string[] = [];
    const hidden: string[] = [];
    parts.forEach((w, i) => {
      if (!hideIdx.has(i)) { shown.push(w); return; }
      hidden.push(w);
      shown.push(gap);
    });
    /* Nebeneinander verdeckte Wörter sind EINE Lücke, nicht mehrere. */
    const escaped = gap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const joined = shown.join('').replace(new RegExp(`${escaped}(\\s+${escaped})+`, 'g'), gap).replace(/\s+/g, ' ').trim();
    return {
      shown: text === '' ? [] : [{ text: joined }],
      hidden: hidden.length === 0 ? [] : [{ text: hidden.join(' ') }],
      full: text === '' ? [] : [{ text }]
    };
  }
};

const FRAGMENTS: Kind = {
  type: 'fragments', get label() { return t('cogitaEditCard.kind.fragments.label'); }, get group() { return t('cogitaEditCard.group.text'); },
  get says() { return t('cogitaEditCard.kind.fragments.says'); },
  ports: () => ({ inputs: [port('text', t('cogitaEditCard.port.quote'))], outputs: [port('fragments', t('cogitaEditCard.port.fragments'))] }),
  run: ({ config, inputs }) => {
    const text = texts(itemsAt(inputs, 'text')).join(' ');
    const tree = fragmentTree(text, num(config.min, 7), num(config.max, 13));
    return { fragments: tree.map((f) => ({ text: f.text, value: { fragment: f, full: text } })) };
  }
};

const PICK: Kind = {
  type: 'pick', get label() { return t('cogitaEditCard.kind.pick.label'); }, get group() { return t('cogitaEditCard.group.choice'); },
  get says() { return t('cogitaEditCard.kind.pick.says'); },
  ports: () => ({ inputs: [port('items', t('cogitaEditCard.port.list'), 'items', true)], outputs: [port('chosen', t('cogitaEditCard.port.chosen')), port('rest', t('cogitaEditCard.port.rest'))] }),
  run: ({ node, config, inputs, ctx }) => {
    const list = itemsAt(inputs, 'items');
    if (list.length === 0) return { chosen: [], rest: [] };
    const at = config.position === 'first' ? 0 : config.position === 'last' ? list.length - 1 : Math.floor(rngFor(ctx, node.id)() * list.length);
    return { chosen: [list[at]], rest: list.filter((_x, i) => i !== at) };
  }
};

/** Wie nah sich zwei Werte sind — für Dystraktoren „podobne wartości". */
function nearness(a: Item, b: Item): number {
  const x = typeof a.value === 'number' ? a.value : readNumber(a.text);
  const y = typeof b.value === 'number' ? b.value : readNumber(b.text);
  if (x !== null && y !== null) return Math.abs(x - y);
  const p = a.text.toLowerCase();
  const q = b.text.toLowerCase();
  let common = 0;
  while (common < p.length && common < q.length && p[common] === q[common]) common += 1;
  return Math.abs(p.length - q.length) + (Math.max(p.length, q.length) - common);
}

const DISTRACTORS: Kind = {
  type: 'distractors', get label() { return t('cogitaEditCard.kind.distractors.label'); }, get group() { return t('cogitaEditCard.group.choice'); },
  get says() { return t('cogitaEditCard.kind.distractors.says'); },
  ports: () => ({ inputs: [port('expected', t('cogitaEditCard.port.correctMany'), 'items', true), port('list', t('cogitaEditCard.port.authorList'), 'items', true)], outputs: [port('distractors', t('cogitaEditCard.port.distractors'))] }),
  run: ({ node, config, inputs, ctx }) => {
    const count = Math.max(1, Math.min(20, Math.round(num(config.count, 3))));
    const from = new Set(lines(config.from).length > 0 ? lines(config.from) : ['field']);
    const expected = itemsAt(inputs, 'expected');
    const banned = new Set(expected.map((e) => e.text.trim().toLowerCase()));
    const key = str(config.key);
    let candidates: Item[] = [];
    if ((from.has('field') || from.has('scope')) && key !== '') {
      const others = new Map<string, Entity>();
      for (const kind of ctx.entity.kinds) for (const e of ctx.pool(kind)) if (e.id !== ctx.entity.id) others.set(e.id, e);
      const pool = [...others.values()].filter((e) => !from.has('scope') || ctx.scope === undefined || ctx.scope.has(e.id));
      candidates = readField(ctx, pool, key);
    }
    if (from.has('list')) candidates = [...candidates, ...itemsAt(inputs, 'list'), ...lines(config.list).map((text) => ({ text }))];
    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      const k = c.text.trim().toLowerCase();
      if (k === '' || banned.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const ordered = from.has('near') && expected.length > 0
      ? unique.slice().sort((a, b) => nearness(a, expected[0]) - nearness(b, expected[0]))
      : shuffle(unique, rngFor(ctx, node.id));
    return { distractors: ordered.slice(0, count) };
  }
};

/** Der Knoten der Schleife — sein Ausgang wird je Lauf vorgegeben (`cardsOf`). */
const EACH: Kind = {
  type: 'each', get label() { return t('cogitaEditCard.kind.each.label'); }, get group() { return t('cogitaEditCard.group.choice'); },
  get says() { return t('cogitaEditCard.kind.each.says'); },
  ports: () => ({ inputs: [port('items', t('cogitaEditCard.port.values'), 'items', true)], outputs: [port('item', t('cogitaEditCard.port.value'))] }),
  run: ({ inputs }) => ({ item: itemsAt(inputs, 'items').slice(0, 1) })
};

/**
 * 2026-10-18 — PAARE AUS EINTRÄGEN, für „Odpowiedź: dopasowanie par": aus
 * jedem Eintrag die Werte eines Feldes, die links hingehören (die englischen
 * Wörter einer Übersetzung), und die, die rechts hingehören (die polnischen —
 * ohne Angabe: alle übrigen). Nebeneinander, gleiche Stelle = ein Paar; wem
 * eine Seite fehlt, fällt weg, und kein Text steht zweimal auf einer Seite
 * (zweimal „dom" liesse sich nicht richtig zuordnen).
 */
const PAIRS: Kind = {
  type: 'pairs', get label() { return t('cogitaEditCard.kind.pairs.label'); }, get group() { return t('cogitaEditCard.group.choice'); },
  get says() { return t('cogitaEditCard.kind.pairs.says'); },
  ports: () => ({
    inputs: [port('items', t('cogitaEditCard.port.entries'), 'items', true), port('left', t('cogitaEditCard.port.leftLike'), 'items', true), port('right', t('cogitaEditCard.port.rightLike'), 'items', true)],
    outputs: [port('left', t('cogitaEditCard.port.leftSide')), port('right', t('cogitaEditCard.port.rightSide'))]
  }),
  run: ({ config, inputs, ctx }) => {
    const key = str(config.key);
    const by = str(config.by);
    if (key === '' || by === '') throw new Error(t('cogitaEditCard.error.pairsFields'));
    const lefts: Item[] = [...itemsAt(inputs, 'left'), ...lines(config.leftValue).map((text) => ({ text }))];
    const rights: Item[] = [...itemsAt(inputs, 'right'), ...lines(config.rightValue).map((text) => ({ text }))];
    if (lefts.length === 0) throw new Error(t('cogitaEditCard.error.pairsLeft'));
    const most = Math.max(2, Math.min(20, Math.round(num(config.count, 5))));
    const fits = (v: Item, targets: readonly Item[]) => readField(ctx, sourcesOf(ctx, [v]), by).some((x) => targets.some((t) => sameItem(x, t)));
    const side = (values: readonly Item[]): Item => ({ text: texts(values).join(', '), ...(values[0].entity === undefined ? {} : { entity: values[0].entity }) });
    const left: Item[] = [];
    const right: Item[] = [];
    const seen = new Set<string>();
    for (const entry of itemsAt(inputs, 'items')) {
      if (left.length >= most) break;
      const id = entry.entity ?? `#${entry.text}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const values = readField(ctx, sourcesOf(ctx, [entry]), key);
      const l = values.filter((v) => fits(v, lefts));
      const r = values.filter((v) => !l.includes(v) && (rights.length === 0 || fits(v, rights)));
      if (l.length === 0 || r.length === 0) continue;
      const a = side(l);
      const b = side(r);
      /* Ein Wort, das sich selbst gegenübersteht („hotel — hotel"), ist keine Aufgabe. */
      if (norm(a.text) === norm(b.text) || left.some((x) => norm(x.text) === norm(a.text)) || right.some((x) => norm(x.text) === norm(b.text))) continue;
      left.push(a);
      right.push(b);
    }
    return { left, right };
  }
};

/**
 * 2026-10-25 (Wywód) — PAARE AUS ZWEI FELDERN DERSELBEN EINTRÄGE, für „Odpowiedź: dopasowanie par":
 * je Eintrag links das eine Feld (etwa ein wichtiger Fragment des Textes), rechts das andere — ohne
 * Feld die Teza des Eintrags. Fünf Fragmente eines Werks und ihre fünf Tezy, richtig zu verbinden.
 * Wem eine Seite fehlt, fällt weg; kein Text steht zweimal auf einer Seite.
 */
const FIELD_PAIRS: Kind = {
  type: 'pairs.fields', get label() { return t('cogitaEditCard.kind.pairsFields.label'); }, get group() { return t('cogitaEditCard.group.choice'); },
  get says() { return t('cogitaEditCard.kind.pairsFields.says'); },
  ports: () => ({ inputs: [port('items', t('cogitaEditCard.port.entries'), 'items', true)], outputs: [port('left', t('cogitaEditCard.port.leftSide')), port('right', t('cogitaEditCard.port.rightSide'))] }),
  run: ({ config, inputs, ctx }) => {
    const most = Math.max(2, Math.min(12, Math.round(num(config.count, 5))));
    const side = (e: Entity, key: string): string => (key === '' ? thesisOf(entityBlocks(e, ctx.look)) : texts(readField(ctx, [e], key)).join(' ')).replace(/\s+/g, ' ').trim();
    const left: Item[] = [];
    const right: Item[] = [];
    const seen = new Set<string>();
    for (const e of sourcesOf(ctx, itemsAt(inputs, 'items'))) {
      if (left.length >= most) break;
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const l = side(e, str(config.left));
      const r = side(e, str(config.right));
      if (l === '' || r === '' || norm(l) === norm(r)) continue;
      if (left.some((x) => norm(x.text) === norm(l)) || right.some((x) => norm(x.text) === norm(r))) continue;
      left.push({ text: l, entity: e.id });
      right.push({ text: r, entity: e.id });
    }
    return { left, right };
  }
};

const RANDOM: Kind = {
  type: 'random', get label() { return t('cogitaEditCard.kind.random.label'); }, get group() { return t('cogitaEditCard.group.numbers'); },
  get says() { return t('cogitaEditCard.kind.random.says'); },
  ports: () => ({ inputs: [port('items', t('cogitaEditCard.port.fromList'), 'items', true)], outputs: [port('value', t('cogitaEditCard.port.value'))] }),
  run: ({ node, config, inputs, ctx }) => {
    const rng = rngFor(ctx, node.id);
    /* 2026-11-03 — „Ile": k różnych naraz (bez powtórzeń); bez — jedna, jak dotąd. */
    const count = Math.max(1, Math.min(200, Math.round(num(config.count, 1))));
    /* 2026-11-01 — auch eine hier getippte Liste (eine Pozycja je Zeile); eine Zahl darin bleibt eine Zahl. */
    const list = [...itemsAt(inputs, 'items'), ...lines(config.list).map((text): Item => { const n = strictNumber(text); return n === null ? { text } : { text, value: n }; })];
    if (list.length > 0) {
      if (count === 1) return { value: [list[Math.floor(rng() * list.length)]] };
      if (list.length < count) throw new Error(t('cogitaEditCard.error.randomItems', { count, have: list.length }));
      return { value: sample(list, count, rng) };
    }
    const min = num(config.min, 1);
    const max = Math.max(min, num(config.max, 10));
    const step = Math.max(1e-9, num(config.step, 1));
    const steps = Math.floor((max - min) / step + 1e-9);
    const one = (k: number): Item => { const value = Number((min + k * step).toFixed(10)); return { text: String(value).replace('.', ','), value }; };
    if (count === 1) return { value: [one(Math.floor(rng() * (steps + 1)))] };
    if (steps + 1 < count) throw new Error(t('cogitaEditCard.error.randomRange', { have: steps + 1, count }));
    const picked = new Set<number>();
    while (picked.size < count) picked.add(Math.floor(rng() * (steps + 1)));
    return { value: [...picked].map(one) };
  }
};

const OPS = ['add', 'sub', 'mul', 'div', 'pow', 'exp', 'log', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'mod'] as const;

type Op = (typeof OPS)[number];

const MANY_OPS: ReadonlySet<Op> = new Set<Op>(['add', 'mul', 'min', 'max']);

const ONE_OPS: ReadonlySet<Op> = new Set<Op>(['exp', 'log', 'abs', 'floor', 'ceil', 'round']);

const numbersOf = (items: readonly Item[]): number[] =>
  items.map((i) => (typeof i.value === 'number' ? i.value : readNumber(i.text))).filter((n): n is number => n !== null);

const MATH: Kind = {
  type: 'math', get label() { return t('cogitaEditCard.kind.math.label'); }, get group() { return t('cogitaEditCard.group.numbers'); },
  get says() { return t('cogitaEditCard.kind.math.says'); },
  ports: (config) => {
    const op = (OPS as readonly string[]).includes(str(config.op)) ? (str(config.op) as Op) : 'add';
    if (MANY_OPS.has(op)) return { inputs: [port('a', t('cogitaEditCard.port.numbers'), 'items', true)], outputs: [port('value', t('cogitaEditCard.port.result'))] };
    if (ONE_OPS.has(op)) return { inputs: [port('a', t('cogitaEditCard.port.number'))], outputs: [port('value', t('cogitaEditCard.port.result'))] };
    return { inputs: [port('a', 'a'), port('b', 'b')], outputs: [port('value', t('cogitaEditCard.port.result'))] };
  },
  run: ({ config, inputs }) => {
    const op = (OPS as readonly string[]).includes(str(config.op)) ? (str(config.op) as Op) : 'add';
    const a = numbersOf(itemsAt(inputs, 'a'));
    const b = numbersOf(itemsAt(inputs, 'b'));
    const x = a[0];
    const y = b[0];
    let r: number;
    switch (op) {
      case 'add': r = a.reduce((s, n) => s + n, 0); break;
      case 'mul': r = a.reduce((s, n) => s * n, 1); break;
      case 'min': r = a.length === 0 ? Number.NaN : Math.min(...a); break;
      case 'max': r = a.length === 0 ? Number.NaN : Math.max(...a); break;
      case 'sub': r = x - y; break;
      case 'div': r = x / y; break;
      case 'pow': r = Math.pow(x, y); break;
      case 'mod': r = ((x % y) + y) % y; break;
      case 'exp': r = Math.exp(x); break;
      case 'log': r = Math.log(x); break;
      case 'abs': r = Math.abs(x); break;
      case 'floor': r = Math.floor(x); break;
      case 'ceil': r = Math.ceil(x); break;
      case 'round': r = Math.round(x); break;
    }
    if (!Number.isFinite(r)) throw new Error(t('cogitaEditCard.error.cannotCompute'));
    const decimals = Math.max(0, Math.min(10, Math.round(num(config.decimals, 6))));
    const value = Number(r.toFixed(decimals));
    return { value: [{ text: String(value).replace('.', ','), value }] };
  }
};

/* -- 2026-11-01: Rechnen in Vorlagen (Lemma) -----------------------------------------------------------------------
 * „Oblicz" rechnet Ausdrücke in der Sprache der Rysunki (`pages/motion/expr.ts` — dieselben Funktionen: mod, round,
 * fmt, sqrt …), „Zbierz" fasst viele Werte zusammen (die Protonen der Bestandteile einer Verbindung). Zusammen mit
 * „Losowa wartość" macht eine Vorlage Fragen, die jedes Mal anders rechnen — und mit „Oblicz" Zahlen-Dystraktoren
 * („p0 + 1; p0 - 1; p0 * 2") für „Odpowiedź: jeden wybór". */

/** Ein Text, der ganz eine Zahl ist („12", „-3,5", „1 000") — sonst `null` (nicht „Rozdział 3"). */
function strictNumber(text: string): number | null {
  const t = text.trim().replace(/^[−–]/, '-').replace(/[\s ]/g, '').replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Die Zahl eines Stücks: sein Wert, sonst sein Text — ein Eintrag (sein Etikett) ist keine Zahl. */
const numberOfItem = (item: Item): number | null =>
  (typeof item.value === 'number' ? (Number.isFinite(item.value) ? item.value : null) : item.entity !== undefined ? null : readNumber(item.text));

/** Eine gerechnete Zahl als Stück: ohne Rundungsreste (0,1 + 0,2 = 0,3), mit Komma; `decimals` rundet. */
function numberItem(n: number, decimals: number | null): Item {
  const value = decimals === null ? Number(n.toPrecision(12)) : Number(n.toFixed(decimals));
  return { text: String(value).replace('.', ','), value };
}

/** Wie viele Stellen nach dem Komma eine Einstellung will — `null`: nicht runden. */
const decimalsOf = (config: Readonly<Record<string, unknown>>): number | null =>
  (typeof config.decimals === 'number' && Number.isFinite(config.decimals) ? Math.max(0, Math.min(10, Math.round(config.decimals))) : null);

/** Wie viele Eingänge „Oblicz" hat: 1–8. */
export const CALC_INPUTS = 8;
const calcInputs = (config: Readonly<Record<string, unknown>>): number => Math.max(1, Math.min(CALC_INPUTS, Math.round(num(config.inputs, 1))));

/** Die Ausdrücke einer Einstellung — einer je Zeile oder nach „;". */
export const calcExpressions = (config: Readonly<Record<string, unknown>>): string[] =>
  str(config.expr).split(/[;\n]/).map((x) => x.trim()).filter((x) => x !== '').slice(0, 20);

/**
 * 2026-11-03 — EIN GERECHNETER WERT ALS STÜCKE: eine Zahl (gerundet, wenn gesagt), ein Text (eine Zahl darin bleibt
 * eine Zahl — für „Odpowiedź: liczba"), ein Eintrag (sein Name, er selbst), eine Liste — jedes Element ein Stück.
 */
function itemsOfValue(v: Val, decimals: number | null): Item[] {
  if (typeof v === 'number') return Number.isFinite(v) ? [numberItem(v, decimals)] : [];
  if (isRecord(v)) {
    const id = recordId(v);
    const label = exprText(v);
    return id === '' ? (label === '' ? [] : [{ text: label }]) : [{ text: label || id, entity: id }];
  }
  if (isList(v)) return v.flatMap((x) => itemsOfValue(x, decimals));
  /* Ein Text (fmt): wie er ist, mit einfachem Minus. */
  const text = v.replace(/−/g, '-');
  if (text.trim() === '') return [];
  const n = strictNumber(text);
  return [n === null ? { text } : { text, value: n }];
}

/** 2026-11-03 — die Werte eines Eingangs als Liste für Ausdrücke (`l0`): Zahlen, Texte, Einträge als Datensätze (`it.masa`). */
const listOfItems = (items: readonly Item[], look: TemplateContext['look']): Val[] => items.map((item): Val => {
  if (item.entity !== undefined) { const e = look.entity(item.entity); if (e !== undefined) return recordOf(e, look); }
  const n = numberOfItem(item);
  return n !== null ? n : item.text;
});

const CALC: Kind = {
  type: 'calc', get label() { return t('cogitaEditCard.kind.calc.label'); }, get group() { return t('cogitaEditCard.group.numbers'); },
  get says() { return t('cogitaEditCard.kind.calc.says'); },
  ports: (config) => ({
    inputs: Array.from({ length: calcInputs(config) }, (_, i) => port(`p${i}`, `p${i}`, 'items', true)),
    outputs: [port('value', t('cogitaEditCard.port.result'))]
  }),
  run: ({ node, config, inputs, ctx }) => {
    const count = calcInputs(config);
    const sources = calcExpressions(config);
    if (sources.length === 0) throw new Error(t('cogitaEditCard.error.calcEmpty'));
    /* 2026-11-03 — `shuffle`, `choose`, `pick` ziehen mit dem Zufall dieser Karte. */
    const env = withRng(newEnv(), rngFor(ctx, node.id));
    const empty = new Set<string>();
    for (let i = 0; i < count; i += 1) {
      const items = itemsAt(inputs, `p${i}`);
      const first = items.map(numberOfItem).find((x): x is number => x !== null);
      env[`p${i}`] = first ?? Number.NaN;
      env[`n${i}`] = items.length;
      env[`l${i}`] = listOfItems(items, ctx.look);
      if (first === undefined) empty.add(`p${i}`);
    }
    const known = (name: string) => Object.prototype.hasOwnProperty.call(env, name);
    const decimals = decimalsOf(config);
    const out: Item[] = [];
    for (const source of sources) {
      const expr = compile(source, { known, lists: true });
      if (isExprError(expr)) throw new Error(`„${source}”: ${expr.error}.`);
      const lacking = expr.reads.filter((name) => empty.has(name));
      if (lacking.length > 0) throw new Error(t('cogitaEditCard.error.inputNoNumber', { inputs: lacking.join(', ') }));
      const v: Val = expr.run(env);
      if (takeOverrun()) throw new Error(t('cogitaEditCard.error.tooMuch', { source }));
      out.push(...itemsOfValue(v, decimals));
    }
    if (out.length === 0) throw new Error(t('cogitaEditCard.error.noExprNumber'));
    return { value: out };
  }
};

/*
 * 2026-11-03 — DER GENERATOR IM SZABLON (`generator.ts`): dieselbe Einstellung wie an einer Frage — `params` (Zahlen,
 * Listen, Einträge aus der Baza), `let`, `require` — und `texts` (Texte mit {…}); `this` ist der Eintrag der Karte.
 * Je Name ein Ausgang. Kann keine Aufgabe gezogen werden, entsteht für diesen Eintrag keine Karte (mit dem Grund).
 */
const generatorNames = (config: Readonly<Record<string, unknown>>): string[] => {
  const spec = readParamsSpec(config);
  if (spec === null) return [];
  return [...new Set([...spec.params.map((p) => p.name), ...spec.lets.map((l) => l.name), ...spec.texts.map((t) => t.name)])];
};

/** Was ein Generator für die Antwort mitgibt: die Werte (gekürzt) und die gezogenen Einträge. */
export interface GeneratorRun {
  readonly values: Readonly<Record<string, Stored>>;
  readonly picked: readonly string[];
  readonly tries: number;
}

const GENERATE: Kind = {
  type: 'generate', get label() { return t('cogitaEditCard.kind.generate.label'); }, get group() { return t('cogitaEditCard.group.numbers'); },
  get says() { return t('cogitaEditCard.kind.generate.says'); },
  ports: (config) => ({ inputs: [], outputs: generatorNames(config).map((name) => port(name, name)) }),
  run: ({ node, config, ctx }) => {
    /* „Tylko dla": ein Eintrag, für den der Generator nicht gedacht ist, bekommt still keine Karte (kein Fehler). */
    const only = str(config.only).trim();
    if (only !== '') {
      const test = compile(only, { known: (name) => name === 'this', lists: true });
      if (isExprError(test)) throw new Error(t('cogitaEditCard.error.onlyFor', { only, error: test.error }));
      const env = newEnv();
      env.this = recordOf(ctx.entity, ctx.look);
      if (!isTrue(test.run(env))) return { pass: false };
    }
    const spec = readParamsSpec(config);
    if (spec === null) throw new Error(t('cogitaEditCard.error.generatorEmpty'));
    const world: GenWorld = { look: ctx.look, pool: ctx.pool, self: ctx.entity, ...(ctx.kindOf === undefined ? {} : { kindOf: ctx.kindOf }) };
    /* Jede Karte ihr eigenes Zadanie: der Zufall auch nach dem Eintrag (sonst zöge jeder Eintrag eines Laufs dasselbe). */
    const made = drawInstance(spec, rngOf(`${ctx.seed}:${node.id}:${ctx.variant ?? ''}:${ctx.entity.id}`), world);
    if (!made.held) throw new Error(made.problem ?? t('cogitaEditCard.error.noTask'));
    const out: Record<string, unknown> = {};
    for (const name of generatorNames(config)) {
      const v = made.values[name];
      out[name] = v === undefined ? [] : itemsOfValue(v, null);
    }
    /* Kein Ausgang: was die Karte mit der Antwort mitnimmt (`cardsOf`). */
    out.$generator = { values: storedValues(spec, made.values), picked: made.picked, tries: made.tries } satisfies GeneratorRun;
    return out;
  }
};

export const AGGREGATE_OPS = ['sum', 'count', 'min', 'max', 'avg'] as const;
type AggregateOp = (typeof AGGREGATE_OPS)[number];

const AGGREGATE: Kind = {
  type: 'aggregate', get label() { return t('cogitaEditCard.kind.aggregate.label'); }, get group() { return t('cogitaEditCard.group.numbers'); },
  get says() { return t('cogitaEditCard.kind.aggregate.says'); },
  ports: () => ({ inputs: [port('values', t('cogitaEditCard.port.values'), 'items', true)], outputs: [port('value', t('cogitaEditCard.port.result'))] }),
  run: ({ config, inputs }) => {
    const op: AggregateOp = (AGGREGATE_OPS as readonly string[]).includes(str(config.op)) ? (str(config.op) as AggregateOp) : 'sum';
    const items = itemsAt(inputs, 'values');
    if (op === 'count') return { value: [numberItem(items.length, null)] };
    const numbers = items.map(numberOfItem).filter((n): n is number => n !== null);
    if (numbers.length === 0) return { value: [] };
    const sum = numbers.reduce((s, n) => s + n, 0);
    const r = op === 'min' ? Math.min(...numbers) : op === 'max' ? Math.max(...numbers) : op === 'avg' ? sum / numbers.length : sum;
    return { value: [numberItem(r, decimalsOf(config))] };
  }
};

/** Eine Zahl oder ein Datum als Zahl zum Vergleichen. */
function ordinal(item: Item | undefined): number | null {
  if (item === undefined) return null;
  if (typeof item.value === 'number') return item.value;
  const date = readDate(item.value) ?? readDateAnswer(item.text);
  if (date !== null && /\d{3,}/.test(item.text + str(item.value))) return date.y * 10000 + (date.m ?? 0) * 100 + (date.d ?? 0);
  return readNumber(item.text);
}

const COMPARE: Kind = {
  type: 'compare', get label() { return t('cogitaEditCard.kind.compare.label'); }, get group() { return t('cogitaEditCard.group.numbers'); },
  get says() { return t('cogitaEditCard.kind.compare.says'); },
  ports: () => ({ inputs: [port('a', 'a'), port('b', 'b')], outputs: [port('result', t('cogitaEditCard.port.trueFalse'))] }),
  run: ({ config, inputs }) => {
    const a = ordinal(itemsAt(inputs, 'a')[0]);
    const b = ordinal(itemsAt(inputs, 'b')[0]);
    if (a === null || b === null) throw new Error(t('cogitaEditCard.error.compareNeeds'));
    const op = str(config.op) || 'lt';
    const result = op === 'gt' ? a > b : op === 'eq' ? a === b : op === 'ne' ? a !== b : op === 'le' ? a <= b : op === 'ge' ? a >= b : a < b;
    return { result: [{ text: result ? t('cogitaEditCard.value.true') : t('cogitaEditCard.value.false'), value: result }] };
  }
};

const WHEN: Kind = {
  type: 'when', get label() { return t('cogitaEditCard.kind.when.label'); }, get group() { return t('cogitaEditCard.group.numbers'); },
  get says() { return t('cogitaEditCard.kind.when.says'); },
  ports: () => ({ inputs: [port('items', t('cogitaEditCard.port.values'), 'items', true)], outputs: [port('items', t('cogitaEditCard.port.onward'))] }),
  run: ({ config, inputs }) => {
    const items = itemsAt(inputs, 'items');
    const want = str(config.value).trim().toLowerCase();
    /* 2026-10-25 — auch der gespeicherte Wert einer Wahl („odpowiedz"), nicht nur ihr Name: ein umbenanntes Etikett hält die Karte nicht mehr an. */
    const has = items.some((i) => i.text.trim().toLowerCase() === want || (typeof i.value === 'string' && i.value.trim().toLowerCase() === want));
    const test = str(config.test) || 'filled';
    const pass = test === 'empty' ? items.length === 0 : test === 'equals' ? has : test === 'differs' ? !has : items.length > 0;
    return { items, pass };
  }
};

const PYTHON: Kind = {
  type: 'python', get label() { return t('cogitaEditCard.kind.python.label'); }, get group() { return t('cogitaEditCard.group.numbers'); },
  get says() { return t('cogitaEditCard.kind.python.says'); },
  ports: (config) => {
    const count = Math.max(0, Math.min(6, Math.round(num(config.inputs, 1))));
    return { inputs: Array.from({ length: count }, (_, i) => port(`p${i}`, t('cogitaEditCard.port.inputN', { n: i + 1 }), 'items', true)), outputs: [port('value', t('cogitaEditCard.port.result'))] };
  },
  run: async ({ config, inputs, ctx }) => {
    if (ctx.python === undefined) throw new Error(t('cogitaEditCard.error.noPython'));
    const count = Math.max(0, Math.min(6, Math.round(num(config.inputs, 1))));
    const args = Array.from({ length: count }, (_, i) => itemsAt(inputs, `p${i}`).map((it) => it.value ?? it.text));
    const result = await ctx.python(str(config.code), args.map((a) => (a.length === 1 ? a[0] : a)));
    const list = Array.isArray(result) ? result : [result];
    return { value: list.filter((v) => v !== null && v !== undefined).map((v) => ({ text: typeof v === 'number' ? String(v).replace('.', ',') : str(v) || JSON.stringify(v), value: v })) };
  }
};

/* -- Frage und Antwort ------------------------------------------------------------- */

const PROMPT: Kind = {
  type: 'prompt', get label() { return t('cogitaEditCard.kind.prompt.label'); }, get group() { return t('cogitaEditCard.group.card'); },
  get says() { return t('cogitaEditCard.kind.prompt.says'); },
  ports: () => ({ inputs: [port('parts', t('cogitaEditCard.port.parts'), 'items', true)], outputs: [port('prompt', t('cogitaEditCard.port.question'), 'prompt')] }),
  run: ({ inputs }) => ({ prompt: itemsAt(inputs, 'parts').map((i): PromptPart => (i.media ? { text: i.text, media: i.media } : { text: i.text })) })
};

export interface Draft {
  readonly answer: AnswerSpec;
}

const answerPort = () => [port('answer', t('cogitaEditCard.port.answer'), 'answer')];

const ANSWER_TEXT: Kind = {
  type: 'answer.text', get label() { return t('cogitaEditCard.kind.answerText.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerText.says'); },
  ports: () => ({ inputs: [port('expected', t('cogitaEditCard.port.correctOne'), 'items', true), port('accepted', t('cogitaEditCard.port.otherCorrect'), 'items', true)], outputs: answerPort() }),
  run: ({ config, inputs }) => {
    const accepted = [...texts(itemsAt(inputs, 'expected')), ...texts(itemsAt(inputs, 'accepted'))];
    if (accepted.length === 0) return {};
    return { answer: { answer: { form: 'text', accepted: unique(accepted), rule: readRule(config.rule, TEXT_RULE) } } satisfies Draft };
  }
};

const unique = (list: readonly string[]): string[] => {
  const seen = new Set<string>();
  return list.filter((t) => {
    const k = t.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const ANSWER_GAP: Kind = {
  type: 'answer.gap', get label() { return t('cogitaEditCard.kind.answerGap.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerGap.says'); },
  ports: () => ({ inputs: [port('shown', t('cogitaEditCard.port.textWithGap')), port('hidden', t('cogitaEditCard.port.hidden'), 'items', true), port('fragment', t('cogitaEditCard.port.fragment'))], outputs: answerPort() }),
  run: ({ config, inputs }) => {
    const fragment = itemsAt(inputs, 'fragment')[0];
    const rule = readRule(config.rule, GAP_RULE);
    if (fragment !== undefined && isObject(fragment.value) && isObject(fragment.value.fragment)) {
      const f = fragment.value.fragment as unknown as Fragment;
      const full = str(fragment.value.full);
      const shown = `${full.slice(0, f.start)}…${full.slice(f.end)}`.replace(/\s+/g, ' ').trim();
      return { answer: { answer: { form: 'gap', shown, accepted: [f.text.trim()], rule } } satisfies Draft };
    }
    const hidden = texts(itemsAt(inputs, 'hidden'));
    const shown = texts(itemsAt(inputs, 'shown'))[0] ?? '';
    if (hidden.length === 0 || shown === '') return {};
    return { answer: { answer: { form: 'gap', shown, accepted: unique(hidden), rule } } satisfies Draft };
  }
};

const ANSWER_NUMBER: Kind = {
  type: 'answer.number', get label() { return t('cogitaEditCard.kind.answerNumber.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerNumber.says'); },
  ports: () => ({ inputs: [port('expected', t('cogitaEditCard.port.correctOne'), 'items', true)], outputs: answerPort() }),
  run: ({ config, inputs }) => {
    const values = numbersOf(itemsAt(inputs, 'expected'));
    if (values.length === 0) return {};
    const quantity = kindById(str(config.quantity))?.id ?? guessKind(str(config.unit));
    return { answer: { answer: { form: 'number', values, tolerance: Math.max(0, num(config.tolerance, 0)), relative: config.relative === true, unit: str(config.unit), ...(quantity === undefined ? {} : { quantity }) } } satisfies Draft };
  }
};

const ANSWER_DATE: Kind = {
  type: 'answer.date', get label() { return t('cogitaEditCard.kind.answerDate.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerDate.says'); },
  ports: () => ({ inputs: [port('expected', t('cogitaEditCard.port.correctOne'), 'items', true)], outputs: answerPort() }),
  run: ({ config, inputs }) => {
    const values = itemsAt(inputs, 'expected')
      .map((i) => readDate(i.value) ?? readDateAnswer(i.text))
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map(dateKey);
    if (values.length === 0) return {};
    const precision: DatePrecision = config.precision === 'day' || config.precision === 'month' ? config.precision : 'year';
    return { answer: { answer: { form: 'date', values, precision, tolerance: Math.max(0, Math.round(num(config.tolerance, 0))) } } satisfies Draft };
  }
};

const ANSWER_ONE: Kind = {
  type: 'answer.one', get label() { return t('cogitaEditCard.kind.answerOne.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerOne.says'); },
  ports: () => ({ inputs: [port('expected', t('cogitaEditCard.port.correctOne')), port('distractors', t('cogitaEditCard.port.distractors'), 'items', true)], outputs: answerPort() }),
  run: ({ node, inputs, ctx }) => {
    const right = texts(itemsAt(inputs, 'expected'))[0];
    if (right === undefined) return {};
    const wrong = unique(texts(itemsAt(inputs, 'distractors'))).filter((t) => t.toLowerCase() !== right.toLowerCase());
    const options = shuffle([right, ...wrong], rngFor(ctx, node.id));
    return { answer: { answer: { form: 'one', options, correct: options.indexOf(right) } } satisfies Draft };
  }
};

const ANSWER_MANY: Kind = {
  type: 'answer.many', get label() { return t('cogitaEditCard.kind.answerMany.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerMany.says'); },
  ports: () => ({ inputs: [port('expected', t('cogitaEditCard.port.correctMany'), 'items', true), port('distractors', t('cogitaEditCard.port.distractors'), 'items', true)], outputs: answerPort() }),
  run: ({ node, inputs, ctx }) => {
    const right = unique(texts(itemsAt(inputs, 'expected')));
    if (right.length === 0) return {};
    const lower = new Set(right.map((r) => r.toLowerCase()));
    const wrong = unique(texts(itemsAt(inputs, 'distractors'))).filter((t) => !lower.has(t.toLowerCase()));
    const options = shuffle([...right, ...wrong], rngFor(ctx, node.id));
    const correct = options.map((o, i) => (lower.has(o.toLowerCase()) ? i : -1)).filter((i) => i >= 0);
    return { answer: { answer: { form: 'many', options, correct } } satisfies Draft };
  }
};

function truth(item: Item | undefined): boolean | null {
  if (item === undefined) return null;
  if (typeof item.value === 'boolean') return item.value;
  const t = item.text.trim().toLowerCase();
  if (['tak', 'prawda', 'true', 'yes'].includes(t)) return true;
  if (['nie', 'fałsz', 'false', 'no'].includes(t)) return false; // i18n-ignore
  return null;
}

const ANSWER_TRUEFALSE: Kind = {
  type: 'answer.truefalse', get label() { return t('cogitaEditCard.kind.answerTruefalse.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerTruefalse.says'); },
  ports: () => ({ inputs: [port('expected', t('cogitaEditCard.port.trueFalse'))], outputs: answerPort() }),
  run: ({ inputs }) => {
    const value = truth(itemsAt(inputs, 'expected')[0]);
    return value === null ? {} : { answer: { answer: { form: 'truefalse', value } } satisfies Draft };
  }
};

const ANSWER_ORDER: Kind = {
  type: 'answer.order', get label() { return t('cogitaEditCard.kind.answerOrder.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerOrder.says'); },
  ports: () => ({ inputs: [port('items', t('cogitaEditCard.port.inOrder'), 'items', true)], outputs: answerPort() }),
  run: ({ node, inputs, ctx }) => {
    const items = texts(itemsAt(inputs, 'items'));
    if (items.length < 2) return {};
    /* 2026-10-31 — nie w kolejności, w jakiej przyszły (to ta dobra). */
    return { answer: { answer: { form: 'order', items, shown: shuffleAway(items, rngFor(ctx, node.id), (a, b) => norm(a) === norm(b)) } } satisfies Draft };
  }
};

const ANSWER_MATCH: Kind = {
  type: 'answer.match', get label() { return t('cogitaEditCard.kind.answerMatch.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerMatch.says'); },
  ports: () => ({ inputs: [port('left', t('cogitaEditCard.port.leftSide'), 'items', true), port('right', t('cogitaEditCard.port.rightSide'), 'items', true)], outputs: answerPort() }),
  run: ({ node, inputs, ctx }) => {
    const left = texts(itemsAt(inputs, 'left'));
    const right = texts(itemsAt(inputs, 'right'));
    const n = Math.min(left.length, right.length);
    if (n < 2) return {};
    /* 2026-10-31 — obie kolumny wymieszane, lewa nigdy w kolejności, w jakiej przyszła (często według czasu). */
    const shown = shuffledPairs(Array.from({ length: n }, (_, i) => ({ left: left[i], right: right[i] })), rngFor(ctx, node.id));
    return { answer: { answer: { form: 'match', ...shown } } satisfies Draft };
  }
};

const ANSWER_FLASH: Kind = {
  type: 'answer.flash', get label() { return t('cogitaEditCard.kind.answerFlash.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerFlash.says'); },
  ports: () => ({ inputs: [port('back', t('cogitaEditCard.port.back'), 'items', true)], outputs: answerPort() }),
  run: ({ inputs }) => {
    const back = texts(itemsAt(inputs, 'back'));
    return back.length === 0 ? {} : { answer: { answer: { form: 'flash', back } } satisfies Draft };
  }
};

const ANSWER_CODE: Kind = {
  type: 'answer.code', get label() { return t('cogitaEditCard.kind.answerCode.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerCode.says'); },
  ports: () => ({ inputs: [], outputs: answerPort() }),
  run: ({ config }) => ({
    answer: {
      answer: {
        form: 'code',
        task: str(config.task),
        starter: str(config.starter) || 'def transform(x):\n    return x',
        createInput: str(config.createInput) || 'def create_input(seed):\n    return seed',
        reference: str(config.reference) || 'def reference(x):\n    return x',
        cases: Math.max(1, Math.min(200, Math.round(num(config.cases, 5))))
      }
    } satisfies Draft
  })
};

const ANSWER_POINT: Kind = {
  type: 'answer.point', get label() { return t('cogitaEditCard.kind.answerPoint.label'); }, get group() { return t('cogitaEditCard.group.answer'); },
  get says() { return t('cogitaEditCard.kind.answerPoint.says'); },
  ports: () => ({ inputs: [port('expected', t('cogitaEditCard.port.place'))], outputs: answerPort() }),
  run: ({ config, inputs }) => {
    if (config.on === 'image') {
      const x = num(config.x, Number.NaN);
      const y = num(config.y, Number.NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return {};
      return { answer: { answer: { form: 'point', on: 'image', target: { x, y, r: Math.max(0.005, num(config.r, 0.05)) } } } satisfies Draft };
    }
    const place = itemsAt(inputs, 'expected').find((i) => isObject(i.value) && typeof i.value.lat === 'number');
    if (place === undefined) return {};
    const geo = place.value as GeoPoint;
    return { answer: { answer: { form: 'point', on: 'map', target: { lat: geo.lat, lon: geo.lon, r: Math.max(1, num(config.r, 1000)) } } } satisfies Draft };
  }
};

const CARD: Kind = {
  type: 'card', get label() { return t('cogitaEditCard.kind.card.label'); }, get group() { return t('cogitaEditCard.group.card'); },
  get says() { return t('cogitaEditCard.kind.card.says'); },
  ports: () => ({
    inputs: [port('prompt', t('cogitaEditCard.port.question'), 'prompt'), port('answer', t('cogitaEditCard.port.answer'), 'answer'), port('explain', t('cogitaEditCard.port.explanation'), 'items', true),
      /* 2026-11-03 — podpowiedzi i rozwiązanie z wartościami zadania (z „Generatora” albo „Wzoru tekstu”). */
      port('hints', t('cogitaEditCard.port.hints'), 'items', true), port('solution', t('cogitaEditCard.port.solution'), 'items', true)],
    outputs: [port('card', t('cogitaEditCard.port.card'), 'card')]
  }),
  run: ({ inputs }) => ({
    card: {
      prompt: (inputs.prompt ?? [])[0] ?? [],
      draft: (inputs.answer ?? [])[0],
      explain: itemsAt(inputs, 'explain').map((i) => i.entity).filter((e): e is string => e !== undefined),
      hints: texts(itemsAt(inputs, 'hints')),
      explanation: texts(itemsAt(inputs, 'solution')).join('\n\n')
    }
  })
};

/** Die Bausteine einer Kartenvorlage — die Palette, die der Editor zeigt [D2, D3]. */
export const TEMPLATE_PALETTE = paletteOf<TemplateContext>('card-template', [
  FIELD, MEDIA, FOLLOW, LIST, SELF, ENTRIES, FILTER, UNIQUE,
  STATEMENT_THESIS, STATEMENT_PART, STATEMENT_TABLE, STATEMENT_SUBJECTS,
  PATTERN, MASK, FRAGMENTS,
  PICK, DISTRACTORS, EACH, PAIRS, FIELD_PAIRS,
  RANDOM, MATH, CALC, AGGREGATE, GENERATE, COMPARE, WHEN, PYTHON,
  PROMPT, ANSWER_TEXT, ANSWER_GAP, ANSWER_NUMBER, ANSWER_DATE, ANSWER_ONE, ANSWER_MANY, ANSWER_TRUEFALSE, ANSWER_ORDER, ANSWER_MATCH, ANSWER_FLASH, ANSWER_CODE, ANSWER_POINT,
  CARD
]);
