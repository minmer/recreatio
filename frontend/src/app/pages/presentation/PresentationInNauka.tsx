/**
 * EINE PRÄSENTATION IN NAUKA (2026-10-22, Schritt 12; COGITA.md §8 „One
 * narrative") — ein Ablauf der Baza wiedzy, der auf ein Storyboard zeigt
 * (`presentation`), spielt die Präsentation selbst: dieselben Szenen, Tore,
 * Fragen und Werte, durch ihren eigenen Motor (`PagePresentation`), wie auf
 * der Seite.
 *
 * <b>Wer lernt:</b> der Lernende der Baza (`learner`, der von Nauka) statt der
 * Person oben auf der Seite. Seine Antworten, Werte und die Stelle zählen in
 * der Baza; die Stelle steht unter derselben Kennung wie auf der Seite
 * (`page:<seite>`). Ohne Lernenden (der Editor: „Wypróbuj") läuft sie wie für
 * einen Besucher, im Browser.
 *
 * <b>Wer sie sieht:</b> wer die Seite sehen darf — geholt wird sie wie jede
 * Seite, mit dem eigenen Zugang (`storyOfPage.ts`).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { FlowContent } from '../../cogita/FlowPlayer';
import { answeredCards, type Learner } from '../../cogita/learn';
import { gaugeFromMarks } from '../../cogita/knowing';
import { storyKnow } from '../../cogita/PathLearn';
import { flowShown } from '../../cogita/flowPath';
import { PathMap } from '../../cogita/PathMap';
import { branchOf, pathMarks } from '../../cogita/pathLayout';
import type { DriveControl } from './usePresentationDrive';
import { presentationPath } from './presentationPath';
import { knownessOf } from '../../cogita/knowness';
import type { Facts } from '../../cogita/logic';
import { pageSteps, viewPath } from '../../routes';
import { Loading } from '../../ui/Loading';
import { PageAccessContext } from '../pageAccess';
import { PageLogicProvider } from '../PageLogicView';
import { PersonProvider } from '../pagePerson';
import { PageSubjectProvider } from '../pageSubject';
import { PagePresentation } from './PagePresentation';
import { NO_STORY, startValues } from './story';
import { loadStory, type LoadedStory } from './storyOfPage';

export default function PresentationInNauka({ name, path, learner, onClose, narrator, content, unit = null }: {
  /** Der Name des Ablaufs. */
  name: string;
  /** Der Pfad der Seite mit der Präsentation. */
  path: string;
  learner: Learner | null;
  onClose?: () => void;
  /** Wer gerade erzählt — der Ablauf wählt ihn nach dem, was über den Lernenden bekannt ist. */
  narrator?: (facts: Facts) => ReactNode;
  /** 2026-11-03 (G) — die Baza des Ablaufs: die Ścieżka der Erzählung neben der Bühne; die Einheit, die die Erzählung ist (kein Schritt). */
  content?: FlowContent;
  unit?: string | null;
}) {
  /* 2026-11-03 (G) — welche Szene gerade steht, und ein Griff, um zu einer zu fahren (die Ścieżka führt dorthin). */
  const [active, setActive] = useState(0);
  const control = useRef<DriveControl | null>(null);
  const [pathOpen, setPathOpen] = useState(() => { try { return sessionStorage.getItem(`cg-show-path-open:${path}`) !== '0'; } catch { return true; } });
  const [loaded, setLoaded] = useState<LoadedStory | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoaded(undefined);
    setFailed(null);
    loadStory(path).then(
      (found) => { if (alive) setLoaded(found); },
      (e: unknown) => { if (alive) { setFailed(e instanceof Error ? e.message : 'Nie udało się wczytać prezentacji.'); setLoaded(null); } });
    return () => { alive = false; };
  }, [path]);

  /* Der Erzähler folgt den Werten: neu zeichnen, wenn der Lernende etwas dazulernt. */
  useEffect(() => (learner === null ? undefined : learner.subscribe(() => setTick((n) => n + 1))), [learner]);

  /*
    DIE ŚCIEŻKA DER ERZÄHLUNG (G): je Szene, wofür ihre Fragen (und Labore mit Ziel) zählen, über den Graphen des
    Storyboards — jetzt dran ist die Szene, die steht; eine gewählte Spur leuchtet; ein freier Knoten fährt zu seiner Szene.
  */
  const told = useMemo(() => {
    if (loaded === undefined || loaded === null || content === undefined) return null;
    const refs = {
      resolve: content.resolve ?? ((r: string) => (content.entity(r) !== null ? r : null)),
      aboutOf: (id: string) => content.card(id)?.about ?? [],
      label: content.label ?? ((id: string) => content.entity(id)?.label ?? id),
      needsOf: content.needsOf ?? (() => [])
    };
    return presentationPath(loaded.flow, loaded.show, loaded.parts, refs, `page:${loaded.page.id ?? path}`, unit);
  }, [loaded, content, path, unit]);

  if (loaded === undefined) return <Loading />;
  if (loaded === null) {
    return (
      <section className="cg-flow">
        <div className="cg-flow-step">
          <h2>{name}</h2>
          <p className="cg-muted">{failed}</p>
          {onClose !== undefined && <div className="wk-actions"><button type="button" className="wk-btn" onClick={onClose}>Wróć</button></div>}
        </div>
      </section>
    );
  }

  const { page, parts, look, show } = loaded;
  const pageId = page.id ?? null;
  const storyMap = (() => {
    if (told === null || told.model.nodes.length < 2 || content === undefined) return null;
    const all = content.cards ?? [];
    const fp = new Map(all.map((c) => [c.key, c.fingerprint] as const));
    const g = gaugeFromMarks([...all, ...(learner === null ? [] : answeredCards(learner.progress, new Set(fp.keys())))], (key) => learner?.marks(key, fp.get(key)) ?? [], [], Date.now());
    /* Die Szene, die steht: der Weg der Bühne an dieser Stelle (er kann von der Liste der Szenen abweichen). */
    const key = control.current?.route?.()[active] ?? show.scenes[active]?.key;
    const here = key === undefined ? [] : told.fp.entriesAt.get(`s:${key}`) ?? [];
    const kept = pageId === null ? undefined : learner?.progress.positions.get(`page:${pageId}`);
    const visited = [...new Set([...(kept?.visited ?? []), ...(key === undefined ? [] : [key])])].map((k) => `s:${k}`);
    const marks = pathMarks(told.model, storyKnow(g, flowShown(told.fp, visited)), here[0] ?? null);
    const now = marks.current >= 0 ? told.model.nodes[marks.current].id : null;
    return (
      <div className="cg-show-path" data-show-path="">
        <PathMap model={told.model} marks={marks} size="small" title="Ścieżka" collapsible open={pathOpen}
          onOpen={(v) => { setPathOpen(v); try { sessionStorage.setItem(`cg-show-path-open:${path}`, v ? '1' : '0'); } catch { /* ohne Speicher */ } }}
          highlight={now === null ? null : branchOf(told.model, [now])}
          onPick={(id) => { const step = told.fp.stepOf.get(id); if (step !== undefined && step.startsWith('s:')) control.current?.jump?.(step.slice(2)); }} />
      </div>
    );
  })();
  const facts = (): Facts => {
    const kept = pageId === null ? undefined : learner?.progress.positions.get(`page:${pageId}`);
    return {
      values: startValues(show.story ?? NO_STORY, learner?.progress.values ?? {}),
      knowness: (id) => (learner === null ? 0 : knownessOf(learner.marks(id), Date.now())),
      answered: (id) => {
        const marks = learner?.marks(id) ?? [];
        return marks.length === 0 ? null : marks[marks.length - 1].correctness;
      },
      visited: new Set(kept?.visited ?? []),
      now: new Date()
    };
  };

  /* Oben links, wo auf der Seite „für wen" steht: der Ablauf, wer erzählt, und der Weg zurück. */
  const over = (
    <div className="cg-over-show" data-nauka-show="">
      <div className="cg-row-between">
        <strong>{name}</strong>
        <span className="cg-row">
          {page.editable && <a className="wk-link-btn" href={viewPath('pages', ...pageSteps(loaded.path))}>edytuj w prezentacji</a>}
          {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={onClose}>zamknij</button>}
        </span>
      </div>
      {narrator?.(facts())}
      {storyMap}
    </div>
  );

  return (
    <PageAccessContext.Provider value={page.access ?? null}>
      <PersonProvider path={loaded.path}>
        <PageSubjectProvider subject={page.subject} path={loaded.path}>
          <PageLogicProvider logic={page.logic}>
            <PagePresentation parts={parts} look={look} title={page.title} pageId={pageId} learner={learner} extra={over} pagePath={loaded.path} control={control} onActive={setActive} />
          </PageLogicProvider>
        </PageSubjectProvider>
      </PersonProvider>
    </PageAccessContext.Provider>
  );
}
