/**
 * 2026-11-22 (Änderungspaket C2) — DIE TAGS AUF DER WELTKARTE: das Netz (`tags.ts`) aus den Einträgen der Welt. Ein Turm trägt die
 * Tags seines Eintrags und die seines Blocks (`"part": "up"`). Einmal je Welt gerechnet. Dazu der gemerkte Ausschnitt (je Widok
 * auf diesem Gerät, wie die Ansicht) und was ein Ausschnitt auf der Karte enthält.
 */

import { EMPTY_TAGS, tagNetwork, type TagNetwork, type TagSource } from '../tags';
import type { World } from './wmTypes';

const MEMO = new WeakMap<World, TagNetwork>();

export function worldTags(world: World): TagNetwork {
  const had = MEMO.get(world);
  if (had !== undefined) return had;
  const sources: TagSource[] = [];
  let any = false;
  for (const e of world.entries.values()) {
    const tags = e.refs.filter((r) => r.tag === 'up').map((r) => r.to);
    if (tags.length > 0) any = true;
    sources.push({ id: e.id, label: e.label, tags, kinds: e.kinds });
  }
  if (!any) { MEMO.set(world, EMPTY_TAGS); return EMPTY_TAGS; }
  const own = (id: string) => world.entries.get(id)?.refs.filter((r) => r.tag === 'up').map((r) => r.to) ?? [];
  const towers = [...world.places.values()].map((p) => ({ id: p.id, tags: [...own(p.id), ...(p.block === undefined ? [] : own(p.block))] }));
  const net = tagNetwork(sources, towers);
  MEMO.set(world, net);
  return net;
}

/**
 * Der gewählte Weg durch das Netz (vom oberen Tag zum verfeinerten): leer = die ganze Welt. Gemerkt je Widok und Lernendem auf
 * diesem Gerät; ein Tag, den es nicht mehr gibt, kürzt den Weg.
 */
const sliceKey = (k: string) => `cg-wm-tag:${k}`;
export function keptSlice(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(sliceKey(key));
    if (raw === null) return null;
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  } catch { return null; }
}
export function keepSlice(key: string, path: readonly string[]): void {
  try { localStorage.setItem(sliceKey(key), JSON.stringify(path)); } catch { /* ohne Speicher */ }
}

/** Der gültige Teil eines gemerkten Weges: jeder Tag muss es geben und unter dem vorigen liegen. */
export function validSlice(net: TagNetwork, path: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of path) {
    if (!net.tags.has(id)) break;
    const prev = out[out.length - 1];
    if (prev !== undefined && !net.descendants(prev).has(id)) break;
    out.push(id);
  }
  return out;
}

/** Ab so vielen Türmen öffnet eine Welt ohne gemerkte Wahl auf einem Tag statt auf allem (`startTag`). */
export const SLICE_FROM = 400;
