/**
 * 2026-11-04 — IST DIE ŚCIEŻKA EINES ABLAUFS FOLGERICHTIG? Genau ein Anfang, ein erreichbares Ende, jeder Schritt vom
 * Anfang erreichbar und von jedem Schritt aus das Ende — keine Sackgassen, keine losen Schritte, kein zweiter Anfang.
 * Jeder Fehler nennt den Schritt beim Namen. Gebraucht im Import (Vorschau warnt; ohne Anfang oder ohne Ende geht der
 * Zapis nicht) und im Editor des Ablaufs. Rein.
 * <code>
 *   error     kein Anfang (kein gültiges "start" und nicht genau ein Schritt ohne Weg dorthin); kein Ende (kein
 *             „Koniec", „Powrót" oder „Przekazanie" vom Anfang aus erreichbar)
 *   warning   ein zweiter Anfang (nichts führt zu ihm); ein Schritt, den der Anfang nicht erreicht; ein Ausgang ohne Weg
 *             (dort endet der Ablauf ohne „Koniec"); ein Schritt, von dem aus kein Ende erreichbar ist (eine Schleife
 *             ohne Ausgang)
 * </code>
 * Ein Ablauf, dessen Graph eine Präsentation trägt ("presentation"), wird hier nicht geprüft (die Seite trägt ihn).
 */

import { exitsOf, follow, type Flow } from './flow';
import { optionalExit, stepName } from './storyPath';

export interface FlowProblem {
  readonly level: 'error' | 'warning';
  readonly text: string;
  /** Der Schritt, um den es geht. */
  readonly step?: string;
}

const STOPS = new Set(['end', 'return', 'handoff']);

/** Der Schritt, an dem ein Ablauf beginnt, wenn "start" fehlt: der eine, zu dem nichts führt — sonst keiner. */
export function entryStep(graph: Flow['graph']): string | null {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const reached = new Set(graph.edges.filter((e) => e.from !== e.to && ids.has(e.from)).map((e) => e.to));
  const free = graph.nodes.filter((n) => !reached.has(n.id));
  return free.length === 1 ? free[0].id : null;
}

/** `raw`: das Dokument des Ablaufs, wie es kam (um zu sagen, ob "start" fehlte) — ohne: der gelesene Anfang gilt. */
export function flowProblems(flow: Flow, label: (id: string) => string = (id) => id, raw?: Readonly<Record<string, unknown>>): FlowProblem[] {
  const out: FlowProblem[] = [];
  const nodes = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
  if (flow.graph.nodes.length === 0) {
    if (flow.presentation === undefined) out.push({ level: 'error', text: 'Przebieg nie ma żadnego kroku — nie ma początku ani końca.' });
    return out;
  }
  const name = (id: string) => { const n = nodes.get(id); return n === undefined ? id : `„${stepName(n, label)}”`; };
  const given = raw === undefined ? (flow.start ?? '') : typeof raw.start === 'string' ? raw.start.trim() : '';
  let start: string | null = nodes.has(given) ? given : null;
  if (start === null) {
    start = entryStep(flow.graph);
    if (start === null) { out.push({ level: 'error', text: 'Nie ma początku: pole "start" nie wskazuje kroku, a kroków, do których nic nie prowadzi, jest więcej niż jeden albo nie ma żadnego — wpisz "start".' }); return out; }
    out.push({ level: 'warning', text: `Pole "start" nie wskazuje kroku — początkiem jest ${name(start)} (jedyny, do którego nic nie prowadzi).`, step: start });
  }

  /* Kapitel: ein „Koniec rozdziału" geht zurück zur Auswahl; die geht nach allen weiter („done"). */
  const hubOf = new Map<string, string>();
  for (const hub of flow.graph.nodes.filter((n) => n.type === 'chapters')) {
    for (const p of exitsOf(hub.type, hub.config)) {
      if (!/^c\d+$/.test(p.id)) continue;
      const seen = new Set<string>();
      const stack = [follow(flow, hub.id, p.id)].filter((x): x is string => x !== null);
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const n = nodes.get(id);
        if (n === undefined) continue;
        if (n.type === 'chapterEnd') { if (!hubOf.has(id)) hubOf.set(id, hub.id); continue; }
        if (n.type === 'chapters' || STOPS.has(n.type)) continue;
        for (const q of exitsOf(n.type, n.config)) { const to = follow(flow, id, q.id); if (to !== null) stack.push(to); }
      }
    }
  }
  /** Je Schritt seine Wege: Ausgang und Ziel (`null`: kein Weg). */
  const ways = (id: string): { exit: string; label: string; to: string | null }[] => {
    const n = nodes.get(id);
    if (n === undefined || STOPS.has(n.type)) return [];
    if (n.type === 'chapterEnd') { const hub = hubOf.get(id); return hub === undefined ? [{ exit: 'next', label: 'dalej', to: follow(flow, id, 'next') }] : [{ exit: 'next', label: 'do rozdziałów', to: hub }]; }
    if (n.type === 'restart') return [];
    const ports = exitsOf(n.type, n.config);
    const list = flow.graph.edges.filter((e) => e.from === id).map((e) => ({ exit: e.out, label: ports.find((p) => p.id === e.out)?.label ?? e.out, to: nodes.has(e.to) ? e.to : null }));
    for (const p of ports) if (!list.some((x) => x.exit === p.id) && !optionalExit(n.type, p.id, list.length)) list.push({ exit: p.id, label: p.label, to: null });
    return list;
  };

  const reach = new Set<string>();
  const stack = [start];
  while (stack.length > 0) { const id = stack.pop()!; if (reach.has(id)) continue; reach.add(id); for (const w of ways(id)) if (w.to !== null) stack.push(w.to); }
  const ends = [...reach].filter((id) => STOPS.has(nodes.get(id)!.type));
  if (ends.length === 0) out.push({ level: 'error', text: 'Nie ma końca: z początku nie da się dojść do kroku „Koniec” (ani „Powrót”, „Przekazanie”) — dodaj go i połącz z ostatnim krokiem.' });

  /* Ein zweiter Anfang und was der Anfang nicht erreicht. */
  const reachedBy = new Set(flow.graph.edges.filter((e) => e.from !== e.to).map((e) => e.to));
  for (const n of flow.graph.nodes) {
    if (reach.has(n.id)) continue;
    if (!reachedBy.has(n.id)) out.push({ level: 'warning', text: `Drugi początek: do kroku ${name(n.id)} nic nie prowadzi — połącz go z resztą albo usuń.`, step: n.id });
    else out.push({ level: 'warning', text: `Krok ${name(n.id)} jest nieosiągalny — od początku nie prowadzi do niego żadna droga.`, step: n.id });
  }

  /* Ausgänge ohne Weg: dort endet der Ablauf, ohne „Koniec". */
  const open = new Set<string>();
  for (const id of reach) {
    const missing = ways(id).filter((w) => w.to === null);
    if (missing.length === 0) continue;
    open.add(id);
    out.push({ level: 'warning', text: `Ślepy zaułek: z kroku ${name(id)} ${missing.length === 1 ? `wyjście „${missing[0].label}” nie prowadzi` : `wyjścia ${missing.map((w) => `„${w.label}”`).join(', ')} nie prowadzą`} nigdzie — przebieg skończy się tam bez kroku „Koniec”.`, step: id });
  }
  /* Von wo aus kein Ende erreichbar ist (rückwärts von den Enden). */
  if (ends.length > 0) {
    const into = new Map<string, string[]>();
    for (const id of reach) for (const w of ways(id)) if (w.to !== null) into.set(w.to, [...(into.get(w.to) ?? []), id]);
    const ok = new Set<string>();
    const back = [...ends, ...open];
    while (back.length > 0) { const id = back.pop()!; if (ok.has(id)) continue; ok.add(id); for (const p of into.get(id) ?? []) back.push(p); }
    for (const id of reach) if (!ok.has(id)) out.push({ level: 'warning', text: `Ślepy zaułek: z kroku ${name(id)} nie da się dojść do końca (pętla bez wyjścia).`, step: id });
  }
  /* 2026-11-05 (Prompt 23, D4) — ein Przegląd in einem Schritt prüft die Fragen der Erzählung: ohne Fragen prüft er nichts. */
  const asks = flow.graph.nodes.some((n) => n.type === 'question');
  for (const n of flow.graph.nodes) {
    if (n.type !== 'review') continue;
    const of = typeof n.config.of === 'string' ? n.config.of.trim() : '';
    if ((of === '' || of === 'story') && !asks) out.push({ level: 'warning', text: `Przegląd ${name(n.id)} nie ma czego sprawdzać: w tym przebiegu nie ma kroków „Pytanie”.`, step: n.id });
    const t = n.config.threshold;
    if (t !== undefined && (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 100)) out.push({ level: 'warning', text: `Przegląd ${name(n.id)}: "threshold" to liczba od 0 do 1 (np. 0.9) — przyjęto 0.9.`, step: n.id });
  }
  return out;
}
