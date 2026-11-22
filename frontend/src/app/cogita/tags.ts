/**
 * 2026-11-22 (Änderungspaket C2/A5) — DIE TAGS EINER WELT: ein Netz mit Ebenen, von den Autoren gewählt.
 *
 * Ein Verweisfeld mit `"tag": "up"` (`schema.ts`) nennt die Tags eines Eintrags. Ein Tag ist irgendein Eintrag, auf den ein
 * solches Feld zeigt (meist eines eigenen Rodzaj „Tag"); die Tag-Felder EINES TAGS nennen seine oberen Tags. So entsteht ein Netz
 * mit Ebenen, in dem ein Untertag mehreren oberen angehören darf (kein strenger Baum). Kreise werden an der Kante geschnitten, die
 * sie schliesst (`cut`), und beim Import gemeldet.
 *
 * Ein oberer Tag zeigt alle Türme unter sich, über alle Ebenen (`below`). Welche Einträge Türme sind und welche Tags sie tragen,
 * sagt der Aufrufer (die Weltkarte: `wmTags.ts`, mit den Tags des Blocks eines Turms). Rein — dieselbe Rechnung für die Karte, die
 * Einstufung, die Widoki und die Abschrift für MCP.
 *
 * Nicht zu verwechseln mit den Fehler-Tags einer Frage (Feld `tags`, `adaptive.ts`): die benennen Denkfehler, nicht Themen.
 */

import { fieldsOf, labelOf as entityLabel, valuesOf, type Entity, type Lookup } from './schema';

/** Ein Eintrag mit den Zielen seiner Tag-Felder. */
export interface TagSource {
  readonly id: string;
  readonly label: string;
  readonly tags: readonly string[];
  /** Seine Rodzaje: ein Eintrag eines Rodzaj, dessen Einträge Tags sind, ist auch ein Tag (ein neuer, noch ohne Türme). */
  readonly kinds?: readonly string[];
}

export interface Tag {
  readonly id: string;
  readonly label: string;
  /** Die oberen Tags (nach dem Schneiden der Kreise). */
  readonly parents: readonly string[];
  readonly children: readonly string[];
  /** 0: ohne oberen Tag; sonst der längste Weg von einer Wurzel. */
  readonly level: number;
}

export interface TagNetwork {
  readonly tags: ReadonlyMap<string, Tag>;
  /** Nach Ebene, dann Name. */
  readonly order: readonly string[];
  readonly roots: readonly string[];
  /** Die Türme, die den Tag selbst tragen. */
  direct(tag: string): ReadonlySet<string>;
  /** Alle Türme unter dem Tag: seine eigenen und die jedes Untertags, über alle Ebenen. */
  below(tag: string): ReadonlySet<string>;
  /** Der Tag und alle Tags unter ihm. */
  descendants(tag: string): ReadonlySet<string>;
  /** Die Tags, die ein Turm selbst trägt. */
  towerTags(tower: string): readonly string[];
  /** Kanten (Untertag → oberer Tag), die einen Kreis schlossen und weggelassen sind. */
  readonly cut: readonly (readonly [string, string])[];
}

export const EMPTY_TAGS: TagNetwork = {
  tags: new Map(), order: [], roots: [], cut: [],
  direct: () => new Set(), below: () => new Set(), descendants: () => new Set(), towerTags: () => []
};

/**
 * Das Netz. `entries`: jeder Eintrag mit den Zielen seiner Tag-Felder (Tags und Türme gleichermassen); `towers`: die Türme mit
 * ihren Tags (bei der Weltkarte samt denen ihres Blocks). Ein Tag ist, worauf irgendein Tag-Feld zeigt und was es gibt.
 */
export function tagNetwork(entries: Iterable<TagSource>, towers: Iterable<{ readonly id: string; readonly tags: readonly string[] }>): TagNetwork {
  const byId = new Map<string, TagSource>();
  for (const e of entries) byId.set(e.id, e);
  const isTag = new Set<string>();
  for (const e of byId.values()) for (const t of e.tags) if (byId.has(t) && t !== e.id) isTag.add(t);
  const towerList = [...towers];
  for (const tw of towerList) for (const t of tw.tags) if (byId.has(t)) isTag.add(t);
  if (isTag.size === 0) return EMPTY_TAGS;
  /* Ein Tag, auf den (noch) nichts zeigt — ein neuer Untertag ohne Türme: ein Eintrag desselben Rodzaj wie ein Tag, kein Turm. */
  const towerIds = new Set(towerList.map((tw) => tw.id));
  const tagKinds = new Set<string>();
  for (const id of isTag) for (const k of byId.get(id)?.kinds ?? []) tagKinds.add(k);
  if (tagKinds.size > 0) for (const e of byId.values()) if (!towerIds.has(e.id) && (e.kinds ?? []).some((k) => tagKinds.has(k))) isTag.add(e.id);

  /* Die oberen Tags; ein Kreis wird an der Kante geschnitten, die ihn schliesst (Tiefensuche in fester Reihenfolge). */
  const ids = [...isTag].sort((a, b) => labelOf(byId, a).localeCompare(labelOf(byId, b)) || (a < b ? -1 : 1));
  const rawParents = new Map<string, string[]>();
  for (const id of ids) rawParents.set(id, [...new Set((byId.get(id)?.tags ?? []).filter((p) => p !== id && isTag.has(p)))]);
  const parents = new Map<string, string[]>();
  const cut: (readonly [string, string])[] = [];
  const mark = new Map<string, 1 | 2>();
  const visit = (id: string) => {
    mark.set(id, 1);
    const kept: string[] = [];
    for (const p of rawParents.get(id) ?? []) {
      const m = mark.get(p);
      if (m === 1) { cut.push([id, p]); continue; }
      if (m === undefined) visit(p);
      kept.push(p);
    }
    parents.set(id, kept);
    mark.set(id, 2);
  };
  for (const id of ids) if (!mark.has(id)) visit(id);
  for (const id of ids) {
    const self = (byId.get(id)?.tags ?? []).includes(id);
    if (self) cut.push([id, id]);
  }

  const children = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const id of ids) for (const p of parents.get(id) ?? []) children.get(p)!.push(id);
  /* Die Ebene: der längste Weg von einer Wurzel (das Netz ist jetzt ohne Kreise). */
  const level = new Map<string, number>();
  const levelOf = (id: string): number => {
    const had = level.get(id);
    if (had !== undefined) return had;
    level.set(id, 0);
    const ps = parents.get(id) ?? [];
    const l = ps.length === 0 ? 0 : 1 + Math.max(...ps.map(levelOf));
    level.set(id, l);
    return l;
  };
  for (const id of ids) levelOf(id);

  const tags = new Map<string, Tag>(ids.map((id) => [id, { id, label: labelOf(byId, id), parents: parents.get(id) ?? [], children: children.get(id) ?? [], level: level.get(id) ?? 0 }]));
  const order = [...ids].sort((a, b) => (level.get(a)! - level.get(b)!) || labelOf(byId, a).localeCompare(labelOf(byId, b)) || (a < b ? -1 : 1));
  const roots = order.filter((id) => (parents.get(id) ?? []).length === 0);

  const direct = new Map<string, Set<string>>();
  const ownTags = new Map<string, string[]>();
  for (const tw of towerList) {
    const own = [...new Set(tw.tags.filter((t) => isTag.has(t)))];
    if (own.length === 0) continue;
    ownTags.set(tw.id, own);
    for (const t of own) { const s = direct.get(t) ?? new Set<string>(); s.add(tw.id); direct.set(t, s); }
  }
  const downMemo = new Map<string, ReadonlySet<string>>();
  const descendants = (tag: string): ReadonlySet<string> => {
    const had = downMemo.get(tag);
    if (had !== undefined) return had;
    const out = new Set<string>();
    if (tags.has(tag)) {
      const stack = [tag];
      while (stack.length > 0) {
        const t = stack.pop()!;
        if (out.has(t)) continue;
        out.add(t);
        for (const c of children.get(t) ?? []) stack.push(c);
      }
    }
    downMemo.set(tag, out);
    return out;
  };
  const belowMemo = new Map<string, ReadonlySet<string>>();
  const below = (tag: string): ReadonlySet<string> => {
    const had = belowMemo.get(tag);
    if (had !== undefined) return had;
    const out = new Set<string>();
    for (const t of descendants(tag)) for (const tw of direct.get(t) ?? []) out.add(tw);
    belowMemo.set(tag, out);
    return out;
  };
  const none: ReadonlySet<string> = new Set();
  return {
    tags, order, roots, cut,
    direct: (tag) => direct.get(tag) ?? none,
    below, descendants,
    towerTags: (tower) => ownTags.get(tower) ?? []
  };
}

function labelOf(byId: ReadonlyMap<string, TagSource>, id: string): string {
  return byId.get(id)?.label ?? id;
}

/** Die Einträge einer Baza mit den Zielen ihrer Tag-Felder (`"tag": "up"`). */
export function tagSourcesOf(entities: readonly Entity[], look: Lookup): TagSource[] {
  const out: TagSource[] = [];
  for (const e of entities) {
    const tags: string[] = [];
    for (const f of fieldsOf(e, look)) {
      if (f.type !== 'ref' || f.tag !== 'up') continue;
      for (const v of valuesOf(e, f)) if (typeof v.value === 'string' && v.value !== '') tags.push(v.value);
    }
    out.push({ id: e.id, label: entityLabel(e, look), tags, kinds: e.kinds });
  }
  return out;
}

/** Wie viele Türme unter einem Tag erobert sind, von allen unter ihm. */
export function tagCount(net: TagNetwork, tag: string, conquered: (tower: string) => boolean): { readonly done: number; readonly total: number } {
  let done = 0, total = 0;
  for (const tw of net.below(tag)) { total += 1; if (conquered(tw)) done += 1; }
  return { done, total };
}

/**
 * Die Tags, die jetzt etwas bieten: mindestens ein Turm unter ihnen ist erreichbar (`reach`: verfügbar, begonnen oder erobert).
 * Ein oberer Tag ist dabei, sobald einer seiner Untertags es ist.
 */
export function reachableTags(net: TagNetwork, reach: (tower: string) => boolean): ReadonlySet<string> {
  const out = new Set<string>();
  for (const id of net.order) {
    for (const tw of net.below(id)) if (reach(tw)) { out.add(id); break; }
  }
  return out;
}

/**
 * Der Tag, mit dem eine sehr grosse Welt beim ersten Öffnen beginnt (statt mit allem): unter den erreichbaren Wurzeln die, unter der
 * gerade am meisten zu tun ist — zuerst begonnene Türme, dann jetzt verfügbare, dann die wenigsten Türme (der kleinste Ausschnitt).
 */
export function startTag(net: TagNetwork, reachable: ReadonlySet<string>, started: (tower: string) => boolean, available: (tower: string) => boolean): string | null {
  let best: { id: string; s: number; a: number; n: number } | null = null;
  for (const id of net.roots) {
    if (!reachable.has(id)) continue;
    let s = 0, a = 0;
    const all = net.below(id);
    for (const tw of all) { if (started(tw)) s += 1; if (available(tw)) a += 1; }
    const one = { id, s, a, n: all.size };
    if (best === null || one.s > best.s || (one.s === best.s && (one.a > best.a || (one.a === best.a && one.n < best.n)))) best = one;
  }
  return best?.id ?? null;
}

/** Für die Abschrift (MCP): je Tag Name, obere Tags, Ebene, eigene Türme und alle Türme unter ihm. */
export interface TagListRow {
  readonly id: string;
  readonly name: string;
  readonly parents: readonly string[];
  readonly level: number;
  readonly towers: number;
  readonly towersBelow: number;
}

export function tagList(net: TagNetwork): TagListRow[] {
  return net.order.map((id) => {
    const t = net.tags.get(id)!;
    return { id, name: t.label, parents: [...t.parents], level: t.level, towers: net.direct(id).size, towersBelow: net.below(id).size };
  });
}
