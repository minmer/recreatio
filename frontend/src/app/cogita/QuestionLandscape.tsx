/**
 * 2026-11-05 (Prompt 23, A4/A5) — DIE LANDSCHAFT „PYTANIA“ NEBEN „OPOWIEŚCI“: dieselbe Karte (`WorldMap`), aber je Gruppe von
 * Fragen ein Feld — die Fragen mit denselben führenden Folien in der Erklärung (`slideLinks.ts`), benannt nach den Folien;
 * eine Frage über die ganze Erzählung (ihre Erklärung nennt die Einheit) im Feld „Cała opowieść“. Die Gebiete sind die
 * Erzählungen, verschachtelt nach ihrer Leiter (Überblick › Etappe › Erzählung). Höhe und Stand aus der Kenntnis der Karten
 * der Gruppe, dieselben Bänder wie sonst (Tal, zu wiederholen, lernbar, Berg mit den offenen Gruppen davor). Nichts davon ist
 * gespeichert: gerechnet aus den Erzählungen und den Erklärungen der Fragen.
 * <code>
 *   gewählt   eine Gruppe: daneben ihre Fragen, „Ćwicz“, „Zobacz w opowieści“ und „Pokaż opowieść na mapie“ (die Karte der
 *             Erzählungen mit ihr gewählt); kommt man von einer gewählten Erzählung, gleitet die Karte zu ihr
 * </code>
 */

import { useEffect, useMemo, useState } from 'react';

import type { Card } from './cardBasics';
import { landscapeWords } from './landscapeWords';
import { baseLang } from './lang';
import { nestAsRegions, type TopicGraph } from './levelMap';
import type { NestNode, NestTree } from './landscapeNest';
import { libQuestionGroups, libStoryIndex } from './slideLib';
import { groupStands, ladderOf, type CardStand, type QuestionGroup } from './slideLinks';
import { SlideActions } from './SlideView';
import { slideWords } from './slideWords';
import type { CogitaLibrary } from './store';
import { WorldMap, type WorldCommand, type WorldTopic } from './WorldMap';
import { worldLayout } from './worldLayout';
import { stepFor } from './worldView';
import { TexText } from '../ui/tex/Tex';
import './slides.css';

export interface QuestionLandscapeProps {
  readonly lib: CogitaLibrary;
  readonly cards: readonly Card[];
  /** Wie eine Karte steht (Kenntnis, schon beantwortet) — aus derselben Rechnung wie die Karte der Erzählungen. */
  readonly stand: (card: Card) => CardStand;
  /** Nur die Erzählungen dieser Einheiten (die Karte der Erzählungen); leer: alle. */
  readonly units: ReadonlySet<string>;
  readonly width: number;
  readonly compact: boolean;
  readonly memoryKey: string;
  /** Die Erzählung, die auf der anderen Karte gewählt ist (ihre Einheit) — die Karte gleitet zu ihr. */
  readonly story: string | null;
  /** „Pokaż opowieść na mapie“: zur Karte der Erzählungen, diese Einheit gewählt. */
  readonly onStory: (unit: string) => void;
  /** „Ćwicz“: eine Powtórka mit genau diesen Karten. */
  readonly onPractise: (title: string, cards: readonly Card[]) => void;
  /** Gewählt: die Gruppe (ihre Erzählung) — damit die andere Karte sie kennt. */
  readonly onChoose?: (unit: string | null) => void;
  /** 2026-11-05 (Prompt 23, E) — die Ścieżka des Überblicks (Einheit) öffnen, der Zweig dieser Erzählung hervorgehoben. */
  readonly onBranch?: (overviewUnit: string, flow: string) => void;
}

export function QuestionLandscape({ lib, cards, stand, units, width, compact, memoryKey, story, onStory, onPractise, onChoose, onBranch }: QuestionLandscapeProps) {
  const lang = baseLang(lib);
  const W = slideWords(lang);
  const T = landscapeWords(lang);
  const ix = libStoryIndex(lib);
  const unitOf = (flow: string | null): string | null => (flow === null ? null : ix.flows.get(flow)?.unit ?? null);
  const groups = useMemo(() => {
    const all = libQuestionGroups(lib);
    const here = all.filter((g) => { const u = unitOf(g.flow); return u !== null && units.has(u); });
    return here.length > 0 ? here : all;
  }, [lib, lib.revision, units]); // eslint-disable-line react-hooks/exhaustive-deps
  const byQuestion = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const c of cards) { const list = m.get(c.question) ?? []; list.push(c); m.set(c.question, list); }
    return m;
  }, [cards]);
  const stands = groupStands(groups, (q) => (byQuestion.get(q) ?? []).map(stand));
  const nameOf = (id: string) => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); };
  const labelOf = (g: QuestionGroup) => (g.whole ? W.wholeStory : g.slides.map(nameOf).join(' · '));

  /* Die Karte: Gruppen als Themen (je Erzählung eine Kette in der Folge ihrer Folien), Erzählungen nach ihrer Leiter als Gebiete. */
  const made = useMemo(() => {
    if (groups.length === 0) return null;
    const flowName = (id: string) => ix.flows.get(id)?.name ?? id;
    const tg: TopicGraph = {
      graph: {
        ids: groups.map((g) => g.key),
        labels: groups.map(labelOf),
        needs: groups.map((_, i) => { const b = stands[i]?.before ?? -1; return b >= 0 ? [b] : []; }),
        rank: groups.map((_, i) => i),
        names: groups.map((g) => (g.flow === null ? [] : ladderOf(ix, g.flow).map(flowName)))
      },
      node: Int32Array.from(groups.map((_, i) => i)),
      topicOf: Int32Array.from(groups.map((_, i) => i))
    };
    const nodes = new Map<string, NestNode>();
    const home = new Map<string, string>();
    const children = new Map<string | null, string[]>();
    const add = (flow: string) => {
      if (nodes.has(flow)) return;
      const ladder = ladderOf(ix, flow);
      const parent = ladder.length > 1 ? ladder[ladder.length - 2] : null;
      if (parent !== null) add(parent);
      nodes.set(flow, { id: flow, label: flowName(flow), parent, order: ix.order.indexOf(flow) });
      const list = children.get(parent) ?? [];
      list.push(flow);
      children.set(parent, list);
    };
    for (const g of groups) if (g.flow !== null) { add(g.flow); home.set(g.key, g.flow); }
    for (const list of children.values()) list.sort((a, b) => (nodes.get(a)?.order ?? 0) - (nodes.get(b)?.order ?? 0));
    const nest: NestTree = { nodes, home, children };
    try {
      const tree = nestAsRegions(nest, tg, T.otherTopics, T.wholeMap);
      return { tg, tree, world: worldLayout(tree, tg) };
    } catch { return null; }
  }, [groups, lib, lib.revision, stands.map((s) => s.before).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const tones = useMemo(() => { const out: string[] = []; for (const c of made?.world.chain ?? []) { const k = (made?.world.top.length ?? 0) <= 1 ? c[1] ?? c[0] : c[0]; if (k !== undefined && !out.includes(k)) out.push(k); } return out; }, [made]);
  const topics = useMemo((): WorldTopic[] => groups.map((g, i) => {
    const s = stands[i];
    /* Die Farbe: die Etappe (das zweite Gebiet von oben), steht nur ein Überblick oben; sonst das oberste. */
    const chain = made?.world.chain[i] ?? [];
    const key = (made?.world.top.length ?? 0) <= 1 ? chain[1] ?? chain[0] : chain[0];
    const topIndex = key === undefined ? -1 : tones.indexOf(key);
    return { id: g.key, label: labelOf(g), steps: s.steps, band: s.band, subject: topIndex < 0 ? -1 : topIndex % 8, glow: s.band === 'ring', share: s.share, todo: W.groupState(s.band), due: s.band === 'due' };
  }), [groups, stands, made, tones]); // eslint-disable-line react-hooks/exhaustive-deps

  const [chosen, setChosen] = useState<number | null>(null);
  const [command, setCommand] = useState<WorldCommand | null>(null);
  /* Von einer gewählten Erzählung her: zu ihr (ihr Gebiet), ihre erste Gruppe gewählt. */
  useEffect(() => {
    if (story === null || made === null) return;
    const flow = [...ix.flows.values()].find((f) => f.unit === story)?.id;
    if (flow === undefined) return;
    const first = groups.findIndex((g) => g.flow === flow);
    if (first < 0) return;
    pick(first);
    setCommand(made.tree.regions.has(flow) ? { kind: 'region', key: flow, at: Date.now() } : { kind: 'topic', key: String(first), at: Date.now() });
  }, [story, made]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (t: number | null) => { setChosen(t); onChoose?.(t === null ? null : unitOf(groups[t]?.flow ?? null)); };

  if (made === null || groups.length === 0) return <p className="cg-muted" data-qls-empty="">{W.noGroups}</p>;
  const most = Math.max(1, ...stands.map((s) => s.steps));
  const g = chosen === null ? null : groups[chosen] ?? null;
  const gs = chosen === null ? null : stands[chosen] ?? null;
  const gCards = g === null ? [] : g.questions.flatMap((q) => byQuestion.get(q) ?? []);
  const unit = g === null ? null : unitOf(g.flow);
  const firstSlide = g === null || g.slides.length === 0 ? undefined : lib.entity(g.slides[0]);
  const unitEntity = unit === null ? undefined : lib.entity(unit);
  return (
    <div className="cg-qls" data-qls={groups.length} data-qls-chosen={g?.key ?? ''}>
      <WorldMap world={made.world} topics={topics} regionName={(k) => made.tree.regions.get(k)?.name ?? k} conquered={new Set()} chosen={chosen} flash={null} home={null}
        links={null} way={null} width={width} compact={compact} T={T} memoryKey={memoryKey} command={command}
        onPickTopic={(t) => pick(t)} onView={() => undefined} onBackground={() => pick(null)} legend={() => null}
        step={stepFor(most + 1)} pieces={[]} goalFlag={null} onPiece={() => undefined} onFlag={() => undefined}
        onStart={(t) => { const x = groups[t]; if (x !== undefined) onPractise(labelOf(x), x.questions.flatMap((q) => byQuestion.get(q) ?? [])); }} />
      {g !== null && gs !== null && (
        <section className="cg-qls-panel" data-qls-group={g.key} data-qls-band={gs.band} data-qls-flow={g.flow ?? ''}>
          <div className="cg-qls-panel-top">
            <h4><TexText text={labelOf(g)} /></h4>
            <button type="button" className="cg-ls-qclose" aria-label="×" onClick={() => pick(null)}>×</button>
          </div>
          <p className="cg-muted">{g.flow !== null ? `${W.inStory(ix.flows.get(g.flow)?.name ?? '')} · ` : ''}{W.groupOf(gs.total, gs.known)}{gs.band === 'known' ? '' : ` · ${W.groupState(gs.band)}`}</p>
          <ul>{g.questions.map((q) => <li key={q} data-qls-question={q}><TexText text={nameOf(q)} /></li>)}</ul>
          <div className="wk-actions">
            {gCards.length > 0 && <button type="button" className="wk-btn" onClick={() => onPractise(labelOf(g), gCards)} data-qls-practise={g.key}>{W.practise}</button>}
            {unit !== null && <button type="button" className="wk-btn wk-btn-line" onClick={() => onStory(unit)} data-qls-show-story={unit}>{W.showStory}</button>}
            {/* 2026-11-05 (Prompt 23, E) — ein Abstecher: die Ścieżka seines Überblicks, sein Zweig hervorgehoben. */}
            {(() => { if (g.flow === null || onBranch === undefined) return null; const lad = ladderOf(ix, g.flow); const up = lad.length > 1 ? lad[lad.length - 2] : undefined; const upUnit = up === undefined ? null : ix.flows.get(up)?.unit ?? null; return up === undefined || upUnit === null ? null : <button type="button" className="wk-link-btn" onClick={() => onBranch(upUnit, g.flow!)} data-qls-show-branch={g.flow}>{W.showBranch(ix.flows.get(up)?.name ?? '')}</button>; })()}
          </div>
          {firstSlide !== undefined && <SlideActions lib={lib} entity={firstSlide} questions={false} />}
          {firstSlide === undefined && unitEntity !== undefined && g.flow !== null && <SlideActions lib={lib} entity={unitEntity} unitFlow={g.flow} questions={false} />}
        </section>
      )}
    </div>
  );
}
