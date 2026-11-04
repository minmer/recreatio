/**
 * 2026-11-03 (F) — WAS EINE ŚCIEŻKA BRAUCHT, gemeinsam für Nauka → Ścieżka, den Baustein „Ścieżka" und das Feld einer
 * Einheit im Krajobraz: welche Einträge (die ganze Baza, ein Widok, eine Einheit), ihr Stand (dieselbe Kenntnis wie im
 * Krajobraz: gelernt ab 10 %, sicher ab 100 %), und „Ucz się" an einem Knoten — die Powtórka „Najpierw podstawy" über
 * ihn und was vor ihm kommt.
 */

import { useMemo, useState, type ReactNode } from 'react';

import type { Card } from './cardBasics';
import { readGraph } from './graph';
import { learnerFlows } from './flowFacts';
import { itemKnowness, type Gauge } from './knowing';
import { spacingFor } from './spacing';
import { LS_KNOWN, LS_LEARNED } from './landscape';
import { renamer, type Learner } from './learn';
import { effectiveNeeds, pathModel, type PathItem, type PathModel } from './pathLayout';
import { basicsRevision } from './presets';
import { cardsAbout, type PrerequisiteGraph } from './prerequisites';
import { planOf } from './revision';
import { RevisionRun } from './RevisionRun';
import type { RewardRules } from './rewards';
import { childrenOf } from './structure';
import type { CogitaLibrary } from './store';
import { useAsync } from './ui';
import { Loading } from '../ui/Loading';

/**
 * DIE REIHENFOLGE DES AUTORS für Gabeln ohne andere Ordnung: der bleibende Name aus dem Import (`_ref`, so wie der Autor
 * ihn schrieb: `@kurs/t/a1` vor `@kurs/t/b1`), sonst der Name — beide natürlich sortiert (2 vor 10). Die Kennungen
 * taugen dafür nicht: was ein Import in derselben Millisekunde anlegt, liegt zufällig.
 */
export function authorOrder(lib: CogitaLibrary): (a: string, b: string) => number {
  const keyOf = (id: string): string => {
    const e = lib.entity(id);
    if (e === undefined) return id;
    /* Der Name aus dem Import steht am gespeicherten Eintrag (die Entität trägt nur ihre Felder). */
    const ref = lib.entry(id)?.data._ref;
    return typeof ref === 'string' && ref !== '' ? ref : lib.label(e);
  };
  const keys = new Map<string, string>();
  const key = (id: string) => { let k = keys.get(id); if (k === undefined) { k = keyOf(id); keys.set(id, k); } return k; };
  return (a, b) => key(a).localeCompare(key(b), 'pl', { numeric: true }) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Der Stand eines Eintrags auf der Karte — wie im Krajobraz (gelernt ab 10 %; zu wiederholen, solange unter 100 %). */
export const gaugeKnow = (g: Gauge) => (id: string): { learned: boolean; due: boolean } => {
  const k = itemKnowness(g, id);
  return { learned: k >= LS_LEARNED - 1e-12, due: k >= LS_LEARNED - 1e-12 && k < LS_KNOWN };
};

/**
 * 2026-11-03 (G) — DER STAND IN EINER ERZÄHLUNG: was Karten hat, nach seiner Kenntnis; was keine hat (eine Einführung,
 * ein Treffpunkt), ist durch, sobald die Erzählung es gezeigt hat.
 */
export const storyKnow = (g: Gauge, shown: ReadonlySet<string>) => {
  const known = gaugeKnow(g);
  return (id: string): { learned: boolean; due: boolean } => (g.testing.has(id) ? known(id) : { learned: shown.has(id), due: false });
};

/** Die Karte über diesen Einträgen (in ihrer Reihenfolge), aus der einen Reihenfolge des Lernens; ohne sie eine Kette. */
export function pathOfEntries(items: readonly PathItem[], graph: PrerequisiteGraph, chainIfFlat = true): PathModel {
  const needs = effectiveNeeds(items.map((i) => i.id), (id) => graph.needs.get(id) ?? []);
  return pathModel(items, needs, { chainIfFlat });
}

/**
 * Was zu einer Einheit gehört: ihre Teile (die Einträge darunter in der Struktur, mit Karten — in die Tiefe), sonst die
 * Pytania über sie. Leer: sie hat keine eigene Ścieżka.
 */
export function unitMembers(lib: CogitaLibrary, id: string, cards: readonly Card[], askable: (id: string) => boolean): string[] {
  const src = lib.selectContext();
  const order = authorOrder(lib);
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length > 0 && out.length < 400) {
    const at = queue.shift()!;
    /* In der Reihenfolge des Eintrags (eine Liste darunter), sonst in der des Autors. */
    for (const k of childrenOf(at, src).sort((a, b) => a.listed - b.listed || order(a.id, b.id))) {
      if (seen.has(k.id)) continue;
      seen.add(k.id);
      if (askable(k.id)) out.push(k.id);
      queue.push(k.id);
    }
  }
  if (out.length > 0) return out;
  /* Ohne Teile: die Pytania über sie (jede Frage ein Knoten). */
  return [...new Set(cardsAbout(cards, id).map((c) => c.question).filter((q) => q !== id && lib.entity(q) !== undefined))];
}

/** „Ucz się" an einem Knoten: die Powtórka „Najpierw podstawy" über ihn (oder alles) — im Gastgeber gezeigt, solange sie läuft. */
export function usePathRun(lib: CogitaLibrary | null, learner: Learner | null, cards: readonly Card[] | null, rewards?: RewardRules | null): { readonly start: (title: string, ids: readonly string[] | null) => void; readonly view: ReactNode | null } {
  const rename = useMemo(() => (lib === null ? null : renamer(lib.merges())), [lib]);
  const [run, setRun] = useState<{ title: string; ids: readonly string[] | null } | null>(null);
  const source = useAsync(run === null || cards === null || lib === null || rename === null ? null : async () => {
    const fp = new Map(cards.map((c) => [c.key, c.fingerprint]));
    /* Ein Eintrag mit den Pytania über ihn („O czym") — sie prüfen ihn mit. */
    const ids = run.ids === null ? null : [...new Set(run.ids.flatMap((id) => [id, ...cardsAbout(cards, id).map((c) => c.entity ?? c.question)]))];
    const doc = basicsRevision(ids, run.title);
    const made = await planOf(readGraph(doc.graph), lib.revisionContext(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], Date.now(), learnerFlows(lib, learner?.progress.positions), spacingFor(lib, learner)));
    return made.plan === null ? null : { plan: made.plan, cards, deps: lib.dependencies(), title: run.title };
  }, [run, cards, lib, learner]);
  const view = run === null ? null
    : source === undefined ? <Loading label="Przygotowywanie kart…" />
    : source === null ? <p className="cg-muted" data-path-run="empty">Do tego nie ma jeszcze pytań. <button type="button" className="wk-link-btn" onClick={() => setRun(null)}>Wróć</button></p>
    : <RevisionRun lib={lib} learner={learner} source={source} onClose={() => setRun(null)} rewards={rewards ?? null} />;
  return { start: (title, ids) => setRun({ title, ids }), view };
}
