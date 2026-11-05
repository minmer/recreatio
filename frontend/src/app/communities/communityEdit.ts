/**
 * 0137 — ÄNDERUNGEN AM ENTWURF einer Wspólnota, rein: was die Oberfläche (Karte, Liste, die fünf
 * Schritte, Osoby) am Dokument tut. Gespeichert wird erst mit „Zapisz zmiany" — über denselben Import
 * mit Vorschau wie ein JSON (`communityImport.ts`).
 */

import { flatten, setSetting, slug, type Blueprint, type CommunityDoc, type Person, type PersonPlace, type Position, type Unit } from './community';

/** Eine Einheit im Baum ändern. */
export function updateUnit(doc: CommunityDoc, key: string, change: (u: Unit) => Unit): CommunityDoc {
  const walk = (u: Unit): Unit => {
    const here = u.key === key ? change(u) : u;
    return here.units === undefined ? here : { ...here, units: here.units.map(walk) };
  };
  return { ...doc, unit: walk(doc.unit) };
}

export const setUnitSetting = (doc: CommunityDoc, key: string, path: string, value: unknown): CommunityDoc =>
  updateUnit(doc, key, (u) => {
    const settings = setSetting(u.settings, path, value);
    const { settings: _old, ...rest } = u;
    return Object.keys(settings).length === 0 ? rest : { ...rest, settings };
  });

/** Ein freier Schlüssel: „krag-4", „krag-4-2" … */
export function freeUnitKey(doc: CommunityDoc, name: string): string {
  const taken = new Set(flatten(doc.unit).map((u) => u.unit.key));
  const base = slug(name);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) if (!taken.has(`${base}-${n}`.slice(0, 40))) return `${base}-${n}`.slice(0, 40);
  return `${base.slice(0, 30)}-${Date.now() % 1e6}`;
}

export function addUnit(doc: CommunityDoc, parentKey: string, unit: Omit<Unit, 'key'> & { key?: string }): CommunityDoc {
  const key = unit.key ?? freeUnitKey(doc, unit.name);
  return updateUnit(doc, parentKey, (p) => ({ ...p, units: [...(p.units ?? []), { ...unit, key }] }));
}

/** Darf `key` unter `target`? Nicht unter sich selbst und nicht unter etwas in sich. */
export function mayMove(doc: CommunityDoc, key: string, target: string): boolean {
  if (key === target || key === doc.unit.key) return false;
  const t = flatten(doc.unit).find((u) => u.unit.key === target);
  return t !== undefined && !t.path.includes(key);
}

/** Umhängen im Entwurf — beim Speichern hängt der Import den Bereich um (`setParent`). */
export function moveUnit(doc: CommunityDoc, key: string, target: string): CommunityDoc {
  if (!mayMove(doc, key, target)) return doc;
  const moving = flatten(doc.unit).find((u) => u.unit.key === key)!.unit;
  const cut = (u: Unit): Unit => (u.units === undefined ? u : { ...u, units: u.units.filter((c) => c.key !== key).map(cut) });
  const without = { ...doc, unit: cut(doc.unit) };
  return updateUnit(without, target, (t) => ({ ...t, units: [...(t.units ?? []), moving] }));
}

/** Auflösen (oder zurücknehmen): der Bereich bleibt, die Wspólnota verwaltet ihn nicht mehr. */
export const removeUnit = (doc: CommunityDoc, key: string, remove = true): CommunityDoc =>
  key === doc.unit.key ? doc : updateUnit(doc, key, (u) => {
    const { remove: _r, ...rest } = u;
    return remove ? { ...rest, remove: true } : rest;
  });

/** „Zapisz jako plan budowy": Art, Positionen, Einstellungen und Teile der Einheit — die Einheit nimmt ihn gleich. */
export function saveAsBlueprint(doc: CommunityDoc, unitKey: string, name: string): CommunityDoc {
  const u = flatten(doc.unit).find((x) => x.unit.key === unitKey)?.unit;
  if (u === undefined) return doc;
  const taken = new Set(doc.blueprints.map((b) => b.key));
  let key = slug(name);
  for (let n = 2; taken.has(key); n += 1) key = `${slug(name)}-${n}`;
  const from = doc.blueprints.find((b) => b.key === u.from);
  const bp: Blueprint = {
    key, name,
    kind: u.kind ?? from?.kind,
    positions: [...new Set([...(from?.positions ?? []), ...(u.positions ?? [])])],
    settings: { ...(from?.settings ?? {}), ...(u.settings ?? {}) },
    ...(u.council ?? from?.council ? { council: u.council ?? from?.council } : {}),
    ...(u.extra ?? from?.extra ? { extra: { ...(from?.extra ?? {}), ...(u.extra ?? {}) } } : {})
  };
  const withBp = { ...doc, blueprints: [...doc.blueprints, bp] };
  return updateUnit(withBp, unitKey, (x) => {
    const { settings: _s, positions: _p, kind: _k, council: _c, extra: _e, ...rest } = x;
    return { ...rest, from: key };
  });
}

export function upsertPosition(doc: CommunityDoc, position: Position): CommunityDoc {
  const i = doc.positions.findIndex((p) => p.key === position.key);
  const positions = [...doc.positions];
  if (i >= 0) positions[i] = position; else positions.push(position);
  return { ...doc, positions };
}

export function freePositionKey(doc: CommunityDoc, name: string): string {
  const base = slug(name, 28);
  const taken = new Set(doc.positions.map((p) => p.key));
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
  return key;
}

/** Positionen einer Einheit: welche gelten (ohne die aus dem Plan doppelt zu schreiben). */
export const setUnitPositions = (doc: CommunityDoc, unitKey: string, keys: readonly string[]): CommunityDoc =>
  updateUnit(doc, unitKey, (u) => {
    const fromPlan = new Set(doc.blueprints.find((b) => b.key === u.from)?.positions ?? []);
    return { ...u, positions: keys.filter((k) => !fromPlan.has(k)) };
  });

export function upsertPerson(doc: CommunityDoc, person: Omit<Person, 'key'> & { key?: string }): CommunityDoc {
  const key = person.key ?? (() => {
    const taken = new Set(doc.persons.map((p) => p.key));
    let k = slug(person.name);
    for (let n = 2; taken.has(k); n += 1) k = `${slug(person.name)}-${n}`;
    return k;
  })();
  const i = doc.persons.findIndex((p) => p.key === key);
  const persons = [...doc.persons];
  const next = { ...person, key };
  if (i >= 0) persons[i] = next; else persons.push(next);
  return { ...doc, persons };
}

export const setPlaces = (doc: CommunityDoc, personKey: string, places: readonly PersonPlace[]): CommunityDoc =>
  ({ ...doc, persons: doc.persons.map((p) => (p.key === personKey ? { ...p, places } : p)) });

export const removePerson = (doc: CommunityDoc, personKey: string, remove = true): CommunityDoc =>
  ({ ...doc, persons: doc.persons.map((p) => {
    if (p.key !== personKey) return p;
    const { remove: _r, ...rest } = p;
    return remove ? { ...rest, remove: true } : rest;
  }) });

/** Viele Namen auf einmal (eine Zeile je Person) auf eine Position — „najpierw grupą”. */
export function addPeople(doc: CommunityDoc, unitKey: string, positionKey: string, names: string): CommunityDoc {
  let out = doc;
  for (const line of names.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')) {
    const key = slug(line);
    const had = out.persons.find((p) => p.key === key && p.name === line);
    if (had !== undefined) {
      if (!had.places.some((pl) => pl.unit === unitKey && pl.position === positionKey)) out = setPlaces(out, had.key, [...had.places, { unit: unitKey, position: positionKey }]);
    } else out = upsertPerson(out, { name: line.slice(0, 120), places: [{ unit: unitKey, position: positionKey }] });
  }
  return out;
}

/** Wie viele Änderungen ein Entwurf gegenüber dem Gespeicherten hat (für den Knopf). */
export const changed = (a: CommunityDoc | null, b: CommunityDoc): boolean => a === null || JSON.stringify(a) !== JSON.stringify(b);
