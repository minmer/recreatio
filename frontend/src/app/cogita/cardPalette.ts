/**
 * Die Bausteine einer Vorlage (COGITA.md §5): Daten, Text, Wahl, Zahlen, Karte — und die Palette, aus der der Editor sie anbietet.
 */

import { type AnswerSpec, type Fragment, type Item, type PromptPart, type TemplateContext, fragmentTree, isObject, lines, num, rngOf, shuffle, str } from './cardBasics';
import { GAP_RULE, TEXT_RULE, readDateAnswer, readRule } from './check';
import { type NodeKind, type Port, paletteOf } from './graph';
import { type DatePrecision, type Entity, type GeoPoint, type MediaRef, dateKey, fieldOf, labelOf, plainOf, readDate, readNumber, valueText, valuesOf } from './schema';
import { blockPlain, thesisOf, type CommentBlock } from '../library/blocks';
import { entityAbout, entityBlocks } from './statements';
import { guessKind, kindById } from '../core/quantities';

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

function readField(ctx: TemplateContext, entities: readonly Entity[], key: string): Item[] {
  const out: Item[] = [];
  for (const entity of entities) {
    const field = fieldOf(entity, ctx.look, key);
    if (field === undefined) continue;
    for (const v of valuesOf(entity, field)) {
      if (v.value === null) continue;
      const text = valueText(field, v.value, ctx.look);
      if (field.type === 'ref' && typeof v.value === 'string') out.push({ text, entity: v.value, state: v.state });
      else if (field.type === 'media' && isObject(v.value)) out.push({ text, media: v.value as unknown as MediaRef, state: v.state });
      else if (field.type === 'markup' && typeof v.value === 'string') out.push({ text: plainOf(v.value), value: v.value, state: v.state });
      /* 2026-10-22 — die Bausteine einer Aussage: einer je Stück (Absatz, Liste, Tabelle). */
      else if (field.type === 'blocks' && Array.isArray(v.value)) for (const block of v.value as readonly CommentBlock[]) out.push({ text: blockPlain(block, refName(ctx)), state: v.state });
      else out.push({ text, value: v.value, state: v.state });
    }
  }
  return out;
}

const FIELD: Kind = {
  type: 'field', label: 'Pole', group: 'Dane',
  says: 'Wartości jednego pola — tego wpisu albo wpisów, które przychodzą z lewej.',
  ports: () => ({ inputs: [port('of', 'Z wpisów', 'items', true)], outputs: [port('values', 'Wartości')] }),
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
  type: 'statement.thesis', label: 'Teza', group: 'Wypowiedź',
  says: 'Pierwsze zdanie treści w blokach — teza (tego wpisu albo wpisów, które przychodzą z lewej; każdy rodzaj z polem „Treść w blokach”).',
  ports: () => ({ inputs: [port('of', 'Z wpisów', 'items', true)], outputs: [port('text', 'Teza')] }),
  run: ({ inputs, ctx }) => ({ text: sourcesOf(ctx, itemsAt(inputs, 'of')).map((e) => ({ text: thesisOf(entityBlocks(e, ctx.look)), entity: e.id })).filter((i) => i.text !== '') })
};

const STATEMENT_PART: Kind = {
  type: 'statement.part', label: 'Część treści', group: 'Wypowiedź',
  says: 'Blok numer n (1, 2, …) treści w blokach: akapit jako tekst, lista — każdy punkt osobno, tabela — każdy wiersz („Łk 1,35 — Dz 1,8"). Puste: wszystkie akapity.',
  ports: () => ({ inputs: [port('of', 'Z wpisów', 'items', true)], outputs: [port('values', 'Części')] }),
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
  type: 'statement.table', label: 'Tabela z treści', group: 'Wypowiedź',
  says: 'Wiersze tabeli z treści w blokach jako dwie strony: kolumna A po lewej, kolumna B po prawej (te same miejsca tworzą parę) — do „dopasowania par" albo pytań o kolumnę.',
  ports: () => ({ inputs: [port('of', 'Z wpisów', 'items', true)], outputs: [port('left', 'Kolumna A'), port('right', 'Kolumna B')] }),
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
  type: 'statement.subjects', label: 'O czym jest', group: 'Wypowiedź',
  says: 'Wpisy, na które wskazują pola-odwołania wypowiedzi (np. „O czym”) — z miejscem (np. „Łk 1,35").',
  ports: () => ({ inputs: [port('of', 'Z wpisów', 'items', true)], outputs: [port('entities', 'Wpisy')] }),
  run: ({ inputs, ctx }) => ({
    entities: sourcesOf(ctx, itemsAt(inputs, 'of')).flatMap((e) => entityAbout(e, ctx.look).map((s) => ({ text: refName(ctx)(s.ref, s.locator), entity: s.ref })))
  })
};

const MEDIA: Kind = {
  type: 'media', label: 'Obraz albo dźwięk', group: 'Dane',
  says: 'Plik z pola — jako pytanie: pokaż obraz, odtwórz nagranie.',
  ports: () => ({ inputs: [port('of', 'Z wpisów', 'items', true)], outputs: [port('values', 'Pliki')] }),
  run: ({ config, inputs, ctx }) => ({ values: readField(ctx, sourcesOf(ctx, itemsAt(inputs, 'of')), str(config.key)).filter((i) => i.media !== undefined) })
};

/** Mehrere Schritte über Verweise: „autor → miejsce urodzenia". */
const FOLLOW: Kind = {
  type: 'follow', label: 'Przez odwołania', group: 'Dane',
  says: 'Idzie po odwołaniach, krok po kroku (np. autor, potem jego miejsce urodzenia), i daje wpisy na końcu drogi.',
  ports: () => ({ inputs: [port('of', 'Od wpisów', 'items', true)], outputs: [port('entities', 'Wpisy')] }),
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
  type: 'list', label: 'Lista', group: 'Dane',
  says: 'Stała lista wpisana przez autora — np. dodatkowe poprawne odpowiedzi albo własne dystraktory.',
  ports: () => ({ inputs: [], outputs: [port('values', 'Pozycje')] }),
  run: ({ config }) => ({ values: lines(config.items).map((text) => ({ text })) })
};

const SELF: Kind = {
  type: 'entity', label: 'Ten wpis', group: 'Dane',
  says: 'Wpis, dla którego powstaje karta — z jego etykietą.',
  ports: () => ({ inputs: [], outputs: [port('entities', 'Wpis')] }),
  run: ({ ctx }) => ({ entities: [{ text: labelOf(ctx.entity, ctx.look), entity: ctx.entity.id }] })
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
  type: 'filter', label: 'Filtr', group: 'Dane',
  says: 'Dzieli wpisy według pola: te, których pole ma wartość z „Porównaj z" (albo wpisaną), i pozostałe — np. słowa w języku tej karty i słowa w innych językach. Bez pola porównuje same wpisy.',
  ports: () => ({ inputs: [port('items', 'Wpisy', 'items', true), port('like', 'Porównaj z', 'items', true)], outputs: [port('kept', 'Pasujące'), port('rest', 'Pozostałe')] }),
  run: ({ config, inputs, ctx }) => {
    const targets: Item[] = [...itemsAt(inputs, 'like'), ...lines(config.value).map((text) => ({ text }))];
    if (targets.length === 0) throw new Error('Filtr nie ma z czym porównać: podłącz „Porównaj z" albo wpisz wartość.');
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
  type: 'unique', label: 'Bez powtórzeń', group: 'Dane',
  says: 'Każdy wpis (albo tekst) tylko raz — np. języki wszystkich słów tłumaczenia, każdy jeden raz.',
  ports: () => ({ inputs: [port('items', 'Wartości', 'items', true)], outputs: [port('items', 'Każda raz')] }),
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
  type: 'entries', label: 'Wpisy rodzaju', group: 'Dane',
  says: 'Wpisy wybranego rodzaju — wszystkie albo te, których pole ma wartość z „Gdzie pole ma" (albo wpisaną): słowa o tej samej pisowni, tłumaczenia z tym słowem, słowa w danym języku. Może pominąć ten wpis i wziąć kilka losowo.',
  ports: () => ({ inputs: [port('like', 'Gdzie pole ma', 'items', true)], outputs: [port('entities', 'Wpisy')] }),
  run: ({ node, config, inputs, ctx }) => {
    const pool = ctx.pool(str(config.kind) || ctx.entity.kinds[0] || '');
    const key = str(config.key);
    let found: readonly Entity[] = pool;
    if (key !== '') {
      const targets: Item[] = [...itemsAt(inputs, 'like'), ...lines(config.value).map((text) => ({ text }))];
      if (targets.length === 0) throw new Error('„Wpisy rodzaju" z polem nie mają z czym porównać: podłącz „Gdzie pole ma" albo wpisz wartość.');
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
    return { entities: found.map((e) => ({ text: labelOf(e, ctx.look), entity: e.id })) };
  }
};

const PATTERN: Kind = {
  type: 'pattern', label: 'Wzór tekstu', group: 'Tekst',
  says: 'Składa tekst z wejść: „Kto napisał {0}?". Kilka wartości na jednym wejściu łączy przecinkiem.',
  ports: (config) => {
    const count = Math.max(1, Math.min(10, Math.round(num(config.inputs, 1))));
    return { inputs: Array.from({ length: count }, (_, i) => port(`p${i}`, `{${i}}`, 'items', true)), outputs: [port('text', 'Tekst')] };
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
  type: 'mask', label: 'Maska', group: 'Tekst',
  says: 'Zakrywa część tekstu: koniec, początek albo losowe słowa. Daje tekst z luką, zakrytą część i całość.',
  ports: () => ({ inputs: [port('text', 'Tekst')], outputs: [port('shown', 'Z luką'), port('hidden', 'Zakryte'), port('full', 'Całość')] }),
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
  type: 'fragments', label: 'Fragmenty cytatu', group: 'Tekst',
  says: 'Dzieli cytat na kawałki (7–13 znaków) i układa je w drzewo: najpierw kawałki, potem to, co razem tworzą. Podłącz „Dla każdej wartości".',
  ports: () => ({ inputs: [port('text', 'Cytat')], outputs: [port('fragments', 'Fragmenty')] }),
  run: ({ config, inputs }) => {
    const text = texts(itemsAt(inputs, 'text')).join(' ');
    const tree = fragmentTree(text, num(config.min, 7), num(config.max, 13));
    return { fragments: tree.map((f) => ({ text: f.text, value: { fragment: f, full: text } })) };
  }
};

const PICK: Kind = {
  type: 'pick', label: 'Wybierz jeden', group: 'Wybór',
  says: 'Bierze jedną wartość z listy (losowo, pierwszą albo ostatnią) i oddaje osobno ją i resztę.',
  ports: () => ({ inputs: [port('items', 'Lista', 'items', true)], outputs: [port('chosen', 'Wybrany'), port('rest', 'Reszta')] }),
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
  type: 'distractors', label: 'Dystraktory', group: 'Wybór',
  says: 'Błędne odpowiedzi do wyboru: to samo pole innych wpisów tego rodzaju, tylko z bieżącego zbioru, lista autora albo wartości najbliższe poprawnej.',
  ports: () => ({ inputs: [port('expected', 'Poprawne', 'items', true), port('list', 'Lista autora', 'items', true)], outputs: [port('distractors', 'Dystraktory')] }),
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
  type: 'each', label: 'Dla każdej wartości', group: 'Wybór',
  says: 'Robi osobną kartę dla każdej wartości z lewej — każde tłumaczenie, każdy fragment cytatu.',
  ports: () => ({ inputs: [port('items', 'Wartości', 'items', true)], outputs: [port('item', 'Wartość')] }),
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
  type: 'pairs', label: 'Pary', group: 'Wybór',
  says: 'Z każdego wpisu para: wartości pola pasujące do lewej strony i te pasujące do prawej (bez prawej: wszystkie pozostałe) — np. z każdego tłumaczenia słowo angielskie i polskie. Wpis bez którejś strony odpada.',
  ports: () => ({
    inputs: [port('items', 'Wpisy', 'items', true), port('left', 'Lewa: porównaj z', 'items', true), port('right', 'Prawa: porównaj z', 'items', true)],
    outputs: [port('left', 'Lewa strona'), port('right', 'Prawa strona')]
  }),
  run: ({ config, inputs, ctx }) => {
    const key = str(config.key);
    const by = str(config.by);
    if (key === '' || by === '') throw new Error('Pary potrzebują pola z wartościami (np. słowa) i pola, według którego się dzielą (np. język).');
    const lefts: Item[] = [...itemsAt(inputs, 'left'), ...lines(config.leftValue).map((text) => ({ text }))];
    const rights: Item[] = [...itemsAt(inputs, 'right'), ...lines(config.rightValue).map((text) => ({ text }))];
    if (lefts.length === 0) throw new Error('Pary nie wiedzą, co jest po lewej: podłącz „Lewa: porównaj z" albo wpisz wartość.');
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
  type: 'pairs.fields', label: 'Pary z dwóch pól', group: 'Wybór',
  says: 'Z każdego wpisu para: pole po lewej (np. fragment tekstu) i pole po prawej (puste: teza wpisu) — do „dopasowania par”, np. pięć fragmentów jednego dzieła i ich pięć tez. Wpis bez którejś strony odpada.',
  ports: () => ({ inputs: [port('items', 'Wpisy', 'items', true)], outputs: [port('left', 'Lewa strona'), port('right', 'Prawa strona')] }),
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
  type: 'random', label: 'Losowa wartość', group: 'Liczby',
  says: 'Losuje liczbę z przedziału (z krokiem) albo jedną pozycję z listy — dla pytań, które za każdym razem liczą co innego.',
  ports: () => ({ inputs: [port('items', 'Z listy', 'items', true)], outputs: [port('value', 'Wartość')] }),
  run: ({ node, config, inputs, ctx }) => {
    const rng = rngFor(ctx, node.id);
    const list = itemsAt(inputs, 'items');
    if (list.length > 0) return { value: [list[Math.floor(rng() * list.length)]] };
    const min = num(config.min, 1);
    const max = Math.max(min, num(config.max, 10));
    const step = Math.max(1e-9, num(config.step, 1));
    const steps = Math.floor((max - min) / step + 1e-9);
    const value = Number((min + Math.floor(rng() * (steps + 1)) * step).toFixed(10));
    return { value: [{ text: String(value).replace('.', ','), value }] };
  }
};

const OPS = ['add', 'sub', 'mul', 'div', 'pow', 'exp', 'log', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'mod'] as const;

type Op = (typeof OPS)[number];

const MANY_OPS: ReadonlySet<Op> = new Set<Op>(['add', 'mul', 'min', 'max']);

const ONE_OPS: ReadonlySet<Op> = new Set<Op>(['exp', 'log', 'abs', 'floor', 'ceil', 'round']);

const numbersOf = (items: readonly Item[]): number[] =>
  items.map((i) => (typeof i.value === 'number' ? i.value : readNumber(i.text))).filter((n): n is number => n !== null);

const MATH: Kind = {
  type: 'math', label: 'Działanie', group: 'Liczby',
  says: 'Liczy: dodawanie, odejmowanie, mnożenie, dzielenie, potęga, logarytm, zaokrąglanie, reszta z dzielenia.',
  ports: (config) => {
    const op = (OPS as readonly string[]).includes(str(config.op)) ? (str(config.op) as Op) : 'add';
    if (MANY_OPS.has(op)) return { inputs: [port('a', 'Liczby', 'items', true)], outputs: [port('value', 'Wynik')] };
    if (ONE_OPS.has(op)) return { inputs: [port('a', 'Liczba')], outputs: [port('value', 'Wynik')] };
    return { inputs: [port('a', 'a'), port('b', 'b')], outputs: [port('value', 'Wynik')] };
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
    if (!Number.isFinite(r)) throw new Error('Tego nie da się policzyć (brak liczby albo dzielenie przez zero).');
    const decimals = Math.max(0, Math.min(10, Math.round(num(config.decimals, 6))));
    const value = Number(r.toFixed(decimals));
    return { value: [{ text: String(value).replace('.', ','), value }] };
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
  type: 'compare', label: 'Porównanie', group: 'Liczby',
  says: 'Prawda albo fałsz z porównania dwóch liczb lub dat: „urodził się przed …?".',
  ports: () => ({ inputs: [port('a', 'a'), port('b', 'b')], outputs: [port('result', 'Prawda / fałsz')] }),
  run: ({ config, inputs }) => {
    const a = ordinal(itemsAt(inputs, 'a')[0]);
    const b = ordinal(itemsAt(inputs, 'b')[0]);
    if (a === null || b === null) throw new Error('Do porównania potrzeba dwóch liczb albo dat.');
    const op = str(config.op) || 'lt';
    const result = op === 'gt' ? a > b : op === 'eq' ? a === b : op === 'ne' ? a !== b : op === 'le' ? a <= b : op === 'ge' ? a >= b : a < b;
    return { result: [{ text: result ? 'prawda' : 'fałsz', value: result }] };
  }
};

const WHEN: Kind = {
  type: 'when', label: 'Warunek', group: 'Liczby',
  says: 'Karta powstaje tylko wtedy, gdy warunek jest spełniony — np. gdy pole jest wypełnione.',
  ports: () => ({ inputs: [port('items', 'Wartości', 'items', true)], outputs: [port('items', 'Dalej')] }),
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
  type: 'python', label: 'Python', group: 'Liczby',
  says: 'Liczy w Pythonie, w przeglądarce (Pyodide): funkcja run(*wejścia) zwraca wartość albo listę wartości.',
  ports: (config) => {
    const count = Math.max(0, Math.min(6, Math.round(num(config.inputs, 1))));
    return { inputs: Array.from({ length: count }, (_, i) => port(`p${i}`, `wejście ${i + 1}`, 'items', true)), outputs: [port('value', 'Wynik')] };
  },
  run: async ({ config, inputs, ctx }) => {
    if (ctx.python === undefined) throw new Error('Python nie jest tu dostępny.');
    const count = Math.max(0, Math.min(6, Math.round(num(config.inputs, 1))));
    const args = Array.from({ length: count }, (_, i) => itemsAt(inputs, `p${i}`).map((it) => it.value ?? it.text));
    const result = await ctx.python(str(config.code), args.map((a) => (a.length === 1 ? a[0] : a)));
    const list = Array.isArray(result) ? result : [result];
    return { value: list.filter((v) => v !== null && v !== undefined).map((v) => ({ text: typeof v === 'number' ? String(v).replace('.', ',') : str(v) || JSON.stringify(v), value: v })) };
  }
};

/* -- Frage und Antwort ------------------------------------------------------------- */

const PROMPT: Kind = {
  type: 'prompt', label: 'Pytanie', group: 'Karta',
  says: 'To, co widzi uczący się: teksty, obrazy, nagrania — w kolejności połączeń z góry na dół.',
  ports: () => ({ inputs: [port('parts', 'Części', 'items', true)], outputs: [port('prompt', 'Pytanie', 'prompt')] }),
  run: ({ inputs }) => ({ prompt: itemsAt(inputs, 'parts').map((i): PromptPart => (i.media ? { text: i.text, media: i.media } : { text: i.text })) })
};

export interface Draft {
  readonly answer: AnswerSpec;
}

const answerPort = [port('answer', 'Odpowiedź', 'answer')];

const ANSWER_TEXT: Kind = {
  type: 'answer.text', label: 'Odpowiedź: tekst', group: 'Odpowiedź',
  says: 'Uczący się wpisuje tekst. Pierwsza wartość jest wzorcowa, kolejne i „inne poprawne" też się liczą.',
  ports: () => ({ inputs: [port('expected', 'Poprawna', 'items', true), port('accepted', 'Inne poprawne', 'items', true)], outputs: answerPort }),
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
  type: 'answer.gap', label: 'Odpowiedź: luka w cytacie', group: 'Odpowiedź',
  says: 'Uczący się uzupełnia lukę. Przyjmuje tekst z luką i zakrytą część (z maski) albo fragment cytatu.',
  ports: () => ({ inputs: [port('shown', 'Tekst z luką'), port('hidden', 'Zakryte', 'items', true), port('fragment', 'Fragment')], outputs: answerPort }),
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
  type: 'answer.number', label: 'Odpowiedź: liczba', group: 'Odpowiedź',
  says: 'Uczący się wpisuje liczbę; tolerancja bezwzględna albo w procentach, jednostka do wpisania obok; z wielkością (np. moment siły) liczy się jednostka odpowiedzi: inna jednostka tej samej wielkości jest przeliczana, jednostka innej wielkości — błędem.',
  ports: () => ({ inputs: [port('expected', 'Poprawna', 'items', true)], outputs: answerPort }),
  run: ({ config, inputs }) => {
    const values = numbersOf(itemsAt(inputs, 'expected'));
    if (values.length === 0) return {};
    const quantity = kindById(str(config.quantity))?.id ?? guessKind(str(config.unit));
    return { answer: { answer: { form: 'number', values, tolerance: Math.max(0, num(config.tolerance, 0)), relative: config.relative === true, unit: str(config.unit), ...(quantity === undefined ? {} : { quantity }) } } satisfies Draft };
  }
};

const ANSWER_DATE: Kind = {
  type: 'answer.date', label: 'Odpowiedź: data', group: 'Odpowiedź',
  says: 'Uczący się wpisuje datę z wymaganą dokładnością (rok, miesiąc, dzień); tolerancja w tych jednostkach.',
  ports: () => ({ inputs: [port('expected', 'Poprawna', 'items', true)], outputs: answerPort }),
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
  type: 'answer.one', label: 'Odpowiedź: jeden wybór', group: 'Odpowiedź',
  says: 'Uczący się wybiera jedną odpowiedź spośród poprawnej i dystraktorów, w losowej kolejności.',
  ports: () => ({ inputs: [port('expected', 'Poprawna'), port('distractors', 'Dystraktory', 'items', true)], outputs: answerPort }),
  run: ({ node, inputs, ctx }) => {
    const right = texts(itemsAt(inputs, 'expected'))[0];
    if (right === undefined) return {};
    const wrong = unique(texts(itemsAt(inputs, 'distractors'))).filter((t) => t.toLowerCase() !== right.toLowerCase());
    const options = shuffle([right, ...wrong], rngFor(ctx, node.id));
    return { answer: { answer: { form: 'one', options, correct: options.indexOf(right) } } satisfies Draft };
  }
};

const ANSWER_MANY: Kind = {
  type: 'answer.many', label: 'Odpowiedź: kilka wyborów', group: 'Odpowiedź',
  says: 'Uczący się zaznacza wszystkie poprawne spośród poprawnych i dystraktorów.',
  ports: () => ({ inputs: [port('expected', 'Poprawne', 'items', true), port('distractors', 'Dystraktory', 'items', true)], outputs: answerPort }),
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
  if (['nie', 'fałsz', 'false', 'no'].includes(t)) return false;
  return null;
}

const ANSWER_TRUEFALSE: Kind = {
  type: 'answer.truefalse', label: 'Odpowiedź: prawda albo fałsz', group: 'Odpowiedź',
  says: 'Uczący się mówi „prawda" albo „fałsz"; wartość przychodzi np. z porównania.',
  ports: () => ({ inputs: [port('expected', 'Prawda / fałsz')], outputs: answerPort }),
  run: ({ inputs }) => {
    const value = truth(itemsAt(inputs, 'expected')[0]);
    return value === null ? {} : { answer: { answer: { form: 'truefalse', value } } satisfies Draft };
  }
};

const ANSWER_ORDER: Kind = {
  type: 'answer.order', label: 'Odpowiedź: kolejność', group: 'Odpowiedź',
  says: 'Uczący się układa pozycje w kolejności — tej, w której przychodzą.',
  ports: () => ({ inputs: [port('items', 'W dobrej kolejności', 'items', true)], outputs: answerPort }),
  run: ({ node, inputs, ctx }) => {
    const items = texts(itemsAt(inputs, 'items'));
    if (items.length < 2) return {};
    return { answer: { answer: { form: 'order', items, shown: shuffle(items, rngFor(ctx, node.id)) } } satisfies Draft };
  }
};

const ANSWER_MATCH: Kind = {
  type: 'answer.match', label: 'Odpowiedź: dopasowanie par', group: 'Odpowiedź',
  says: 'Uczący się łączy w pary: pozycje z lewej z pozycjami z prawej (te same miejsca na listach tworzą parę).',
  ports: () => ({ inputs: [port('left', 'Lewa strona', 'items', true), port('right', 'Prawa strona', 'items', true)], outputs: answerPort }),
  run: ({ node, inputs, ctx }) => {
    const left = texts(itemsAt(inputs, 'left'));
    const right = texts(itemsAt(inputs, 'right'));
    const n = Math.min(left.length, right.length);
    if (n < 2) return {};
    const order = shuffle(Array.from({ length: n }, (_, i) => i), rngFor(ctx, node.id));
    const shownRight = order.map((i) => right[i]);
    const pairs = Array.from({ length: n }, (_, i): [number, number] => [i, order.indexOf(i)]);
    return { answer: { answer: { form: 'match', left: left.slice(0, n), right: shownRight, pairs } } satisfies Draft };
  }
};

const ANSWER_FLASH: Kind = {
  type: 'answer.flash', label: 'Odpowiedź: fiszka', group: 'Odpowiedź',
  says: 'Uczący się odwraca kartę i sam ocenia: umiałem, częściowo, nie umiałem.',
  ports: () => ({ inputs: [port('back', 'Druga strona', 'items', true)], outputs: answerPort }),
  run: ({ inputs }) => {
    const back = texts(itemsAt(inputs, 'back'));
    return back.length === 0 ? {} : { answer: { answer: { form: 'flash', back } } satisfies Draft };
  }
};

const ANSWER_CODE: Kind = {
  type: 'answer.code', label: 'Odpowiedź: kod (Python)', group: 'Odpowiedź',
  says: 'Uczący się pisze funkcję w Pythonie; sprawdza ją Pyodide w przeglądarce na losowych przypadkach.',
  ports: () => ({ inputs: [], outputs: answerPort }),
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
  type: 'answer.point', label: 'Odpowiedź: punkt', group: 'Odpowiedź',
  says: 'Uczący się wskazuje miejsce na mapie (z pola „miejsce") albo punkt na obrazie.',
  ports: () => ({ inputs: [port('expected', 'Miejsce')], outputs: answerPort }),
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
  type: 'card', label: 'Karta', group: 'Karta',
  says: 'Składa kartę: pytanie, odpowiedź i (po odpowiedzi) wyjaśnienie z połączonych wpisów.',
  ports: () => ({ inputs: [port('prompt', 'Pytanie', 'prompt'), port('answer', 'Odpowiedź', 'answer'), port('explain', 'Wyjaśnienie', 'items', true)], outputs: [port('card', 'Karta', 'card')] }),
  run: ({ inputs }) => ({
    card: {
      prompt: (inputs.prompt ?? [])[0] ?? [],
      draft: (inputs.answer ?? [])[0],
      explain: itemsAt(inputs, 'explain').map((i) => i.entity).filter((e): e is string => e !== undefined)
    }
  })
};

/** Die Bausteine einer Kartenvorlage — die Palette, die der Editor zeigt [D2, D3]. */
export const TEMPLATE_PALETTE = paletteOf<TemplateContext>('card-template', [
  FIELD, MEDIA, FOLLOW, LIST, SELF, ENTRIES, FILTER, UNIQUE,
  STATEMENT_THESIS, STATEMENT_PART, STATEMENT_TABLE, STATEMENT_SUBJECTS,
  PATTERN, MASK, FRAGMENTS,
  PICK, DISTRACTORS, EACH, PAIRS, FIELD_PAIRS,
  RANDOM, MATH, COMPARE, WHEN, PYTHON,
  PROMPT, ANSWER_TEXT, ANSWER_GAP, ANSWER_NUMBER, ANSWER_DATE, ANSWER_ONE, ANSWER_MANY, ANSWER_TRUEFALSE, ANSWER_ORDER, ANSWER_MATCH, ANSWER_FLASH, ANSWER_CODE, ANSWER_POINT,
  CARD
]);
