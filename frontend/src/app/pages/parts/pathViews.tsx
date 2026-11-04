/**
 * DIE ANSICHT DES BAUSTEINS „ŚCIEŻKA" (`path.tsx`) — erst geladen, wenn eine Seite ihn zeigt. Liest die Baza so, wie
 * dieser Leser sie lesen darf (`cogita/pageBase.ts`), lernt als die Person der Seite (`pageLearner.tsx`) und zeigt die
 * Ścieżka (`cogita/PathMap.tsx`): einer Erzählung, einer Einheit, eines Widoku oder der ganzen Baza.
 */

import { useMemo, useState } from 'react';

import type { PartContext } from '../part';
import { answersArea } from '../../cogita/answersTo';
import { contentOfLibrary, FlowPlayer, storyPathOf } from '../../cogita/FlowPlayer';
import { learnerFlows, reviewStart, storyStage, storyUnitsOf } from '../../cogita/flowFacts';
import type { Flow } from '../../cogita/flow';
import { storyMarks, type StoryPath } from '../../cogita/storyPath';
import { factsOf, gaugeFromMarks, withFlows } from '../../cogita/knowing';
import { decideBy } from '../../cogita/runningStory';
import { answeredCards, positionFor, renamer } from '../../cogita/learn';
import { usePageBase } from '../../cogita/pageBase';
import { LearnerLine, usePageLearner } from '../../cogita/pageLearner';
import { authorOrder, gaugeKnow, pathOfEntries, unitMembers, usePathRun } from '../../cogita/PathLearn';
import { PathMap } from '../../cogita/PathMap';
import { EMPTY_PATH, pathMarks, type PathMarks, type PathModel } from '../../cogita/pathLayout';
import { cardsAbout, questionIds } from '../../cogita/prerequisites';
import { skipStep } from '../../cogita/flowAsk';
import { baseLang, words } from '../../cogita/lang';
import type { CogitaLibrary } from '../../cogita/store';
import { CogitaContext, useAsync } from '../../cogita/ui';
import { readView, viewList } from '../../cogita/views';
import { presentationPath } from '../presentation/presentationPath';
import { loadStory } from '../presentation/storyOfPage';
import { Loading } from '../../ui/Loading';
import type { PathConfig } from './path';

const isTall = (ctx: PartContext): boolean => ctx.whole === true || ctx.size.height === 'tall';

/** Ein Eintrag aus dem Baustein: seine Kennung oder sein bleibender Name (`@kurs/lekcja-1`). */
function entryOf(lib: CogitaLibrary, said: string): string | null {
  const s = said.trim();
  if (s === '') return null;
  if (lib.entity(s) !== undefined) return s;
  const named = lib.byImportRef(s, 'entity');
  return named === undefined ? null : named.id;
}

export function PathView({ config, ctx }: { config: PathConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const who = usePageLearner(lib, answersArea(config.answers));
  const learner = who.learner;
  const cards = useAsync(lib == null ? null : () => lib.cards('page').then((r) => r.cards), [lib, lib?.revision]);
  const T = words(lib == null ? 'pl' : baseLang(lib));
  const title = config.title || T.pathTitle;
  const rename = useMemo(() => (lib == null ? null : renamer(lib.merges())), [lib]);
  const live = learner?.progress;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- neu mit jedem Stand des Lernenden
  const gauge = useMemo(() => {
    if (lib == null || cards == null || rename === null) return null;
    const fp = new Map(cards.map((c) => [c.key, c.fingerprint] as const));
    const page = learner === null ? [] : answeredCards(learner.progress, new Set(fp.keys()));
    return gaugeFromMarks([...cards, ...page], (key) => learner?.marks(key, fp.get(key), rename) ?? [], lib.dependencies(), Date.now(), lib.prerequisites());
  }, [lib, lib?.revision, cards, learner, live, rename]);

  /* 2026-11-03 (G) — eine Erzählung, die eine Präsentation ist: ihre Seite (die Szenen) wird geladen. */
  const shownFlow = useMemo(() => (lib == null || cards == null || config.flow === '' ? undefined : contentOfLibrary(lib, cards).flow(config.flow)), [lib, lib?.revision, cards, config.flow]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useAsync(shownFlow?.presentation === undefined ? null : () => loadStory(shownFlow.presentation!).catch(() => null), [shownFlow?.presentation]);

  /* Welche Einträge, in welcher Reihenfolge — und wo der Besucher ist. */
  const made = useMemo((): { model: PathModel; current: string | null; note: string | null; sp?: StoryPath; marks?: PathMarks } => {
    if (lib == null || cards == null || gauge === null) return { model: EMPTY_PATH, current: null, note: null };
    const graph = lib.prerequisites();
    /* Ein Eintrag ohne Karten ist durch, sobald die Erzählung ihn gezeigt hat (der Teil zählt dann, was besucht ist). */
    const known = gaugeKnow(gauge);
    const storyKnowOf = (cardsOf: (id: string) => readonly unknown[]) => (x: string) => (cardsOf(x).length === 0 ? { learned: true, due: false } : known(x));
    const label = (id: string) => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); };
    /* 2026-11-03 (Prompt 5) — eine Einheit, die eine Erzählung ist (ohne eigene Karten), steht auf der Karte wie ein Schritt. */
    const stories = storyUnitsOf(lib, (id) => gauge.testing.has(id));
    const askable = (id: string) => gauge.askable.has(id) || stories.has(id);
    if (config.flow !== '') {
      const content = contentOfLibrary(lib, cards);
      const flow = content.flow(config.flow);
      if (flow === undefined) return { model: EMPTY_PATH, current: null, note: 'Tej opowieści nie ma w bazie wiedzy.' };
      if (flow.presentation !== undefined) {
        /* Die Szenen der Präsentation: je Szene, wofür ihre Fragen zählen; jetzt dran ist die Szene, an der er war. */
        if (shown === undefined) return { model: EMPTY_PATH, current: null, note: null };
        if (shown === null) return { model: EMPTY_PATH, current: null, note: 'Tej prezentacji nie można tu otworzyć.' };
        const refs = { resolve: content.resolve!, aboutOf: (id: string) => content.card(id)?.about ?? [], label, needsOf: (id: string) => graph.needs.get(id) ?? [] };
        const told = presentationPath(shown.flow, shown.show, shown.parts, refs, `page:${shown.page.id ?? ''}`, flow.unit ?? null, { words: T.partNames });
        const kept = shown.page.id === undefined ? undefined : learner?.progress.positions.get(`page:${shown.page.id}`);
        const visited = (kept?.visited ?? []).map((k) => `s:${k}`);
        const marks = storyMarks(told.sp, { visited, step: kept === undefined ? null : `s:${kept.step}`, ...(learner === null ? {} : { know: storyKnowOf(content.cardsOf) }) });
        return { model: told.model, current: null, note: null, sp: told.sp, marks };
      }
      /*
        2026-11-04 — die Teile der Erzählung (Lesen, Fragen, Przegląd, Gabeln) und ihr Stand aus der gemerkten Stelle.
        2026-11-04 (Prompt 11) — wie im Spieler: ein Warunek, der für diesen Lernenden schon entschieden ist, zeigt nur seinen Weg.
      */
      const known = learner === null ? null : learnerFlows(lib, learner.progress.positions);
      const decide = known === null ? undefined : decideBy({ ...factsOf(withFlows(gauge, known), () => []), flow: (ref: string) => known.get(content.flowRef?.(ref) ?? ref) });
      const sp = storyPathOf(flow, content, decide);
      const kept = positionFor(learner?.progress.positions, flow);
      /* 2026-11-04 (Prompt 10) — gezählt wird, was die Erzählung wirklich fragen würde (gekonnte Fragen übersprungen). */
      const nodeOf = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
      const knownStep = learner === null ? undefined : (s: string) => { const n = nodeOf.get(s); return n !== undefined && skipStep(n, content.card, (c) => learner.marks(c.key, c.fingerprint, content.rename)); };
      const marks = storyMarks(sp, { visited: kept?.visited ?? [], step: kept?.step ?? null, ...(kept?.done === true && ['end', 'return', 'handoff'].includes(nodeOf.get(kept.step)?.type ?? '') ? { ended: true } : {}), ...(learner === null ? {} : { know: storyKnowOf(content.cardsOf), knownStep }) });
      return { model: sp.model, current: null, note: null, sp, marks };
    }
    const unit = config.entry === '' ? null : entryOf(lib, config.entry);
    if (config.entry !== '' && unit === null) return { model: EMPTY_PATH, current: null, note: 'Tego wpisu nie ma w bazie wiedzy.' };
    let ids: string[];
    if (unit !== null) ids = unitMembers(lib, unit, cards, askable);
    else if (config.view !== '') {
      const doc = lib.docs('view').find((v) => v.id === config.view);
      if (doc === undefined) return { model: EMPTY_PATH, current: null, note: 'Tego widoku nie ma w bazie wiedzy.' };
      ids = viewList(lib, readView(doc.data)).map((e) => e.id).filter(askable);
    } else {
      /* Die ganze Baza: was Karten hat, von den Grundlagen her. */
      const byAuthor = authorOrder(lib);
      const asks = questionIds(cards);
      ids = [...graph.level.entries()].filter(([id]) => lib.entity(id) !== undefined && askable(id) && !asks.has(id)).sort((a, b) => a[1] - b[1] || byAuthor(a[0], b[0])).map(([id]) => id);
    }
    return { model: pathOfEntries(ids.map((id) => ({ id, label: label(id) })), graph, unit !== null || config.view !== ''), current: null, note: ids.length === 0 ? 'Tu nie ma jeszcze kroków z pytaniami.' : null };
  }, [lib, lib?.revision, cards, gauge, config.flow, config.entry, config.view, learner, live, shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = usePathRun(lib ?? null, learner, cards ?? null);
  /*
    2026-11-03 (Prompt 5) — DER KNOPF EINER ERZÄHLUNG: eine Präsentation ist eine Seite — dorthin, an die Stelle des
    Lernenden (der Przegląd über `?scena=`); ein eigener Graph spielt hier im Baustein, im Spieler.
  */
  const [story, setStory] = useState<{ readonly flow: Flow; readonly jump: { readonly step: string; readonly at: number } | null } | null>(null);
  const stories = useMemo(() => (lib == null || gauge === null ? new Map<string, Flow>() : storyUnitsOf(lib, (id) => gauge.testing.has(id))), [lib, lib?.revision, gauge]); // eslint-disable-line react-hooks/exhaustive-deps
  const told = useMemo(() => (lib == null ? new Map() : learnerFlows(lib, learner?.progress.positions)), [lib, lib?.revision, learner, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const stageOf = (id: string) => { const f = stories.get(id); return f === undefined ? null : storyStage(f, told.get(f.id)); };
  const openStory = (flow: Flow, review: boolean) => {
    if (flow.presentation !== undefined) {
      const scene = review ? reviewStart(flow) : '';
      window.location.hash = `#/${flow.presentation}${scene === '' ? '' : `?scena=${encodeURIComponent(scene)}`}`;
      return;
    }
    setStory({ flow, jump: review ? { step: reviewStart(flow), at: Date.now() } : null });
  };

  if (lib == null || cg === null) {
    return (
      <>
        <h2 className="wk-card-title">{title}</h2>
        {lib === undefined ? <Loading /> : <p className="wk-card-muted">Tej bazy wiedzy nie możesz tu czytać — nie jest publiczna albo nie masz do niej dostępu.</p>}
      </>
    );
  }
  if (cards == null || gauge === null) return <><h2 className="wk-card-title">{title}</h2><Loading label="Liczenie kart…" /></>;
  if (run.view !== null) return <CogitaContext.Provider value={cg}>{run.view}</CogitaContext.Provider>;
  if (story !== null) {
    return (
      <CogitaContext.Provider value={cg}>
        <FlowPlayer key={`${story.flow.id}:${story.jump?.at ?? 0}`} flow={story.flow} content={contentOfLibrary(lib, cards)} learner={learner} onClose={() => setStory(null)} jumpTo={story.jump} presentationAs="link" />
      </CogitaContext.Provider>
    );
  }
  const baseKnow = gaugeKnow(gauge);
  const marks = made.marks ?? pathMarks(made.model, (id) => { const st = stageOf(id); return st === null ? baseKnow(id) : { learned: st === 'passed', due: false }; }, made.current);
  /* Ein Teil einer Erzählung: was er fragt (zum Lernen); ein Eintrag: er selbst. */
  const idsOf = (id: string): string[] => { const part = made.sp?.parts[made.model.index.get(id) ?? -1]; return part === undefined ? [id] : part.asked.filter((x) => cardsAbout(cards, x).length > 0); };
  const tall = isTall(ctx);
  const label = (id: string) => made.model.nodes[made.model.index.get(id) ?? -1]?.label ?? id;

  if (ctx.size.height === 'strip' && !tall) {
    const now = marks.current >= 0 ? made.model.nodes[marks.current].label : null;
    return (
      <p className="wk-card-muted" data-path-strip={`${marks.done}/${marks.total}`}>
        <strong>{title}</strong> · {T.summary(marks.done, marks.total, made.sp === undefined ? 'topics' : 'parts')}{now !== null ? <> · {T.now}: {now}</> : null}
      </p>
    );
  }
  return (
    <CogitaContext.Provider value={cg}>
      <div className="cg" data-path-part={made.model.nodes.length}>
        {made.note !== null && <p className="wk-card-muted">{made.note}</p>}
        <PathMap model={made.model} marks={marks} size={tall ? 'full' : 'small'} title={title} collapsible={!tall} words={T} noun={made.sp === undefined ? 'topics' : 'parts'}
          detail={(id) => { if (made.sp !== undefined) return null; const n = cardsAbout(cards, id).length; return n === 0 ? null : T.cards(n); }}
          actions={(id, state) => (made.sp !== undefined && idsOf(id).length === 0 ? null : (
            <div className="wk-actions">
              {stageOf(id) !== null ? (
                <button type="button" className="wk-btn" disabled={!who.ready} onClick={() => openStory(stories.get(id)!, stageOf(id) === 'review')} data-path-story={stageOf(id)!}>
                  {T.storyButton[stageOf(id)!]}
                </button>
              ) : (
                <button type="button" className="wk-btn" disabled={!who.ready} onClick={() => run.start(label(id), idsOf(id))} data-path-learn={id}>
                  {state === 'done' ? T.review : state === 'locked' ? T.learnWithBasics : T.learn}
                </button>
              )}
            </div>
          ))} />
        <LearnerLine learner={who} lib={lib} />
      </div>
    </CogitaContext.Provider>
  );
}
