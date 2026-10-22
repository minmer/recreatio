/**
 * 2026-10-21 — DIE PRÄSENTATION ALS PRZEBIEG (Storyboard).
 *
 * Eine Präsentation trägt jetzt, was ein Przebieg von Cogita trug: Fragen mit
 * einem Ausgang für „dobrze" und einen für „źle", Wahlen (Knöpfe), Bedingungen
 * und Werte. Dieselbe Seite läuft in zwei Arten:
 *
 * <code>
 *   als Beispiel     nichts verlässt den Browser — Antworten, Werte, Wege
 *                    bleiben dort (der Lernende `local` von Cogita)
 *   mit Cogita       verbunden mit einer Bazy wiedzy: wer angemeldet ist (oder
 *                    über einen Platz hier ist), lernt als er selbst — seine
 *                    Antworten gehen versiegelt in den Bereich, den die Seite
 *                    nennt, und zählen in Cogita (Postępy, Powtórki, Znajomość)
 * </code>
 *
 * <b>Eine Logik.</b> Bedingungen und Aktionen sind die von `cogita/logic.ts`
 * (dieselben wie im Przebieg, in Formularen, auf der Karte einer Seite):
 * Werte, Antworten, Besuchtes, Znajomość, Zeit.
 *
 * <b>Die Teile</b>, rein und ohne React:
 *
 * <code>
 *   story.values   Werte mit Anfang und Grenzen (Punkte, Nähe einer Gestalt)
 *   story.gates    Tore zwischen den Szenen — ein Ziel `gate:<key>`:
 *                    condition   „tak" → yes, „nie" → no
 *                    set         Werte setzen/ändern, dann weiter (next)
 *   Frage          ein Baustein `question` auf einer Szene; seine Ausgänge
 *                  stehen am Baustein: go["<szene>:right"], go["<szene>:wrong"]
 *                  (fehlt einer: „dalej" der Szene)
 * </code>
 *
 * <b>Wann ein Tor gilt.</b> Eine Bedingung entscheidet, wenn der Weg berechnet
 * wird — mit dem, was der Lernende gerade weiss und hat; ändert eine Antwort
 * oder ein Wert etwas, wird der Weg ab der aktuellen Szene neu berechnet. Ein
 * `set` gilt, wenn der Lernende die Szene dahinter wirklich erreicht (oder
 * gleich, wenn ein Knopf oder eine Antwort hindurchführt).
 */

import { apply, holds, readAction, readCondition, type Action, type Condition, type Facts, type ValueLimit } from '../../cogita/logic';
import { END, GATE, LINK } from './showPaths';
import type { Piece, Show } from './presentation';

/* -- Das Modell ------------------------------------------------------------------------------ */

export interface StoryValue {
  readonly id: string;
  readonly label: string;
  readonly start: number;
  readonly min: number | null;
  readonly max: number | null;
}

export type Gate =
  | { readonly key: string; readonly label: string; readonly type: 'condition'; readonly when: Condition | null; readonly yes: string | null; readonly no: string | null }
  | { readonly key: string; readonly label: string; readonly type: 'set'; readonly actions: readonly Action[]; readonly next: string | null };

export const GATE_LABEL: Record<Gate['type'], string> = { condition: 'Warunek', set: 'Zmień wartość' };

export interface Story {
  /** Die Baza wiedzy, in deren Postępy die Antworten zählen — leer: nur als Beispiel (im Browser). */
  readonly base: string;
  /** Wohin die Antworten angemeldeter Lernender gehen (ein Bereich mit Annahme) — leer: ihr eigener privater Bereich. */
  readonly storage: string;
  readonly values: readonly StoryValue[];
  readonly gates: readonly Gate[];
}

export const NO_STORY: Story = { base: '', storage: '', values: [], gates: [] };

/** Ein Ausgang einer Frage am Baustein: je Szene einer für „dobrze" und einer für „źle". */
export type Outcome = 'right' | 'wrong';
export const outcomeKey = (sceneKey: string, outcome: Outcome): string => `${sceneKey}:${outcome}`;

/** Ist dieser Schlüssel von `piece.go` ein Ausgang einer Frage (und kein Knopf)? */
export const isOutcomeKey = (key: string): boolean => /:(right|wrong)$/.test(key);

/* -- Duldsam lesen, knapp schreiben ------------------------------------------------------------ */

const record = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {});
const text = (v: unknown, max = 80): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const target = (v: unknown): string | null => { const t = text(v, 120); return t === '' ? null : t; };
const numberOr = (v: unknown, fallback: number | null): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const KEY = /^[A-Za-z0-9_-]{1,40}$/;

export function readStory(value: unknown): Story | null {
  if (value === undefined || value === null) return null;
  const raw = record(value);
  const values: StoryValue[] = [];
  for (const one of Array.isArray(raw.values) ? raw.values.slice(0, 40) : []) {
    const v = record(one);
    const id = text(v.id, 40);
    if (!KEY.test(id) || values.some((x) => x.id === id)) continue;
    values.push({ id, label: text(v.label) || id, start: numberOr(v.start, 0) ?? 0, min: numberOr(v.min, null), max: numberOr(v.max, null) });
  }
  const gates: Gate[] = [];
  for (const one of Array.isArray(raw.gates) ? raw.gates.slice(0, 80) : []) {
    const g = record(one);
    const key = text(g.key, 40);
    if (!KEY.test(key) || gates.some((x) => x.key === key)) continue;
    const label = text(g.label);
    if (g.type === 'set') {
      gates.push({ key, label, type: 'set', actions: (Array.isArray(g.actions) ? g.actions : []).map(readAction).filter((a): a is Action => a !== null && a.type !== 'go').slice(0, 20), next: target(g.next) });
    } else {
      gates.push({ key, label, type: 'condition', when: readCondition(g.when), yes: target(g.yes), no: target(g.no) });
    }
  }
  return { base: text(raw.base, 64), storage: text(raw.storage, 64), values, gates };
}

export function storyJson(story: Story): Record<string, unknown> {
  return {
    ...(story.base !== '' ? { base: story.base } : {}),
    ...(story.storage !== '' ? { storage: story.storage } : {}),
    ...(story.values.length > 0 ? {
      values: story.values.map((v) => ({ id: v.id, ...(v.label !== v.id ? { label: v.label } : {}), ...(v.start !== 0 ? { start: v.start } : {}), ...(v.min !== null ? { min: v.min } : {}), ...(v.max !== null ? { max: v.max } : {}) }))
    } : {}),
    ...(story.gates.length > 0 ? {
      gates: story.gates.map((g) => (g.type === 'set'
        ? { key: g.key, ...(g.label !== '' ? { label: g.label } : {}), type: 'set', actions: g.actions, ...(g.next !== null ? { next: g.next } : {}) }
        : { key: g.key, ...(g.label !== '' ? { label: g.label } : {}), type: 'condition', ...(g.when !== null ? { when: g.when } : {}), ...(g.yes !== null ? { yes: g.yes } : {}), ...(g.no !== null ? { no: g.no } : {}) }))
    } : {})
  };
}

/** Die Grenzen eines Wertes — für `apply`. */
export const limitsOf = (story: Story) => (id: string): ValueLimit => {
  const v = story.values.find((one) => one.id === id);
  return v === undefined ? {} : { ...(v.min !== null ? { min: v.min } : {}), ...(v.max !== null ? { max: v.max } : {}) };
};

/** Die Werte am Anfang (was der Lernende schon hat, gewinnt). */
export const startValues = (story: Story, kept: Readonly<Record<string, number>>): Record<string, number> => ({
  ...Object.fromEntries(story.values.map((v) => [v.id, v.start])),
  ...kept
});

/* -- Durch die Tore ------------------------------------------------------------------------------ */

export const gateOf = (story: Story, said: string | null | undefined): Gate | undefined =>
  said != null && said.startsWith(GATE) ? story.gates.find((g) => g.key === said.slice(GATE.length)) : undefined;

/**
 * VON EINEM ZIEL BIS ZU EINEM, DAS KEIN TOR IST — eine Szene, `end`,
 * `link:<id>` — mit den Werten danach und den `set`-Toren, durch die es ging.
 * Ein Kreis aus Toren endet nach 32 Schritten (dann: nirgends).
 */
export function throughGates(story: Story, said: string | null, facts: Facts): { readonly target: string | null; readonly values: Record<string, number>; readonly passed: readonly Gate[] } {
  let values: Record<string, number> = { ...facts.values };
  const passed: Gate[] = [];
  let at = said;
  for (let guard = 0; guard < 32; guard += 1) {
    const gate = gateOf(story, at);
    if (gate === undefined) return { target: at, values, passed };
    passed.push(gate);
    if (gate.type === 'set') {
      values = apply(gate.actions, values, limitsOf(story)).values;
      at = gate.next;
    } else {
      at = holds(gate.when, { ...facts, values }) ? gate.yes : gate.no;
    }
  }
  return { target: null, values, passed };
}

/** Wohin „dalej" von dieser Szene führt — ihr eigenes Ziel, sonst die nächste der Liste, nach der letzten das Ende. */
const nextSaid = (show: Show, key: string): string => {
  const at = show.scenes.findIndex((sc) => sc.key === key);
  const own = at < 0 ? null : show.scenes[at].next;
  if (own !== null && own.trim() !== '') return own;
  return show.scenes[at + 1]?.key ?? END;
};

export interface Stop {
  readonly key: string;
  /** Die `set`-Tore auf dem Weg HIERHER (sie gelten, wenn der Lernende hier ankommt). */
  readonly via: readonly Gate[];
}

/**
 * „DALEJ" ENTLANG, durch die Tore — von einer Szene bis zum Ende, hinaus, oder
 * zu einer Szene, die schon dran war. Bedingungen entscheiden mit den Werten,
 * die die `set`-Tore davor ergäben (gerechnet, nicht gesetzt).
 */
export function storyChain(show: Show, story: Story, key: string, facts: Facts, taken: ReadonlySet<string> = new Set(), waits: ReadonlySet<string> = new Set()): Stop[] {
  const out: Stop[] = [];
  const seen = new Set(taken);
  let values = { ...facts.values };
  let at: string | null = key;
  let via: readonly Gate[] = [];
  while (at !== null && !seen.has(at) && show.scenes.some((sc) => sc.key === at)) {
    out.push({ key: at, via });
    seen.add(at);
    /* Eine Szene mit einer Frage WARTET: der Weg dahinter steht erst nach der Antwort fest (dobrze / źle). */
    if (waits.has(at)) break;
    const passed = throughGates(story, nextSaid(show, at), { ...facts, values });
    values = passed.values;
    via = passed.passed.filter((g) => g.type === 'set');
    at = passed.target !== null && show.scenes.some((sc) => sc.key === passed.target) ? passed.target : null;
  }
  return out;
}

/** Wohin „dalej" nach der letzten Szene des Weges führt (durch die Tore): eine Szene, ein Weg hinaus, das Ende. */
export const beyondOf = (show: Show, story: Story, key: string, facts: Facts): string | null =>
  throughGates(story, nextSaid(show, key), facts).target;

/* -- Fragen ---------------------------------------------------------------------------------------- */

/**
 * WOHIN EINE FRAGE NACH DER ANTWORT FÜHRT: ihr Ausgang für dieses Ergebnis auf
 * dieser Szene — sonst „dalej" der Szene. `null`: „dalej" (nichts Eigenes).
 */
export const outcomeTarget = (piece: Piece, sceneKey: string, outcome: Outcome): string | null => {
  const own = piece.go[outcomeKey(sceneKey, outcome)];
  return own !== undefined && own.trim() !== '' ? own : null;
};

/* -- Für den Editor ----------------------------------------------------------------------------------- */

/** Ein Tor in Worten. */
export const gateLabel = (gate: Gate): string => gate.label || GATE_LABEL[gate.type];

/** Alles, wohin ein Ausgang über die Tore führen KANN — beide Seiten einer Bedingung (für die Karte und „erreichbar"). */
export function gateTargets(story: Story, said: string | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (at: string | null) => {
    if (at === null || seen.has(at)) return;
    seen.add(at);
    const gate = gateOf(story, at);
    if (gate === undefined) { out.push(at); return; }
    if (gate.type === 'set') walk(gate.next);
    else { walk(gate.yes); walk(gate.no); }
  };
  walk(said);
  return out;
}

/** Ein neues Tor mit frischer Kennung. */
export const blankGate = (key: string, type: Gate['type']): Gate =>
  type === 'set' ? { key, label: '', type: 'set', actions: [], next: null } : { key, label: '', type: 'condition', when: null, yes: null, no: null };

/** Ein Ziel, das auf ein Tor zeigt, das es nicht mehr gibt. */
export const brokenGate = (story: Story, said: string | null | undefined): boolean =>
  said != null && said.startsWith(GATE) && gateOf(story, said) === undefined;

/** Ziele, die hinaus führen, sind kein Tor und keine Szene. */
export const isOut = (said: string | null): boolean => said === END || (said !== null && said.startsWith(LINK));
