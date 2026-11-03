/**
 * 2026-10-21 — DER PRZEBIEG EINER PRÄSENTATION IM LAUF: wer lernt, und wo es bleibt.
 *
 * <code>
 *   ohne Bazę wiedzy     ein Beispiel: alles bleibt im Browser (der Lernende
 *                        `local` von Cogita, unter „page:<seite>")
 *   mit Bazą wiedzy      wer oben gewählt ist (eine eigene Person oder ein Platz),
 *                        lernt als er selbst — versiegelt in den Bereich, den die
 *                        Seite nennt (sonst sein eigener privater); ein Besucher
 *                        ohne Konto lernt im Browser, wie ein Beispiel
 * </code>
 *
 * Es ist DERSELBE Lernende wie in Cogita (`cogita/learn.ts`): Antworten,
 * Werte, die Stelle, an der er war. Die Stücke von Cogita kommen erst, wenn
 * eine Präsentation einen Przebieg hat — eine gewöhnliche lädt davon nichts.
 *
 * 2026-10-22 (Schritt 12) — IN NAUKA bringt der Ablauf seinen Lernenden mit
 * (`given`, der der Baza): dann lernt er als dieser, unter derselben Stelle
 * (`page:<seite>`) — wer auf der Seite aufhörte, macht in Nauka weiter und
 * umgekehrt. Er gehört dem, der ihn gab: hier wird er weder geschrieben
 * (`flush`) noch geschlossen.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { fromBase64Url } from '../../core/crypto';
import { usePerson } from '../pagePerson';
import type { Show } from './presentation';
import type { StoryRun } from './showContext';
import { limitsOf, startValues, type Story } from './story';
import { nextOf } from './showPaths';
import type { Learner as CogitaLearner } from '../../cogita/learn';

type Learn = typeof import('../../cogita/learn');
type Holders = typeof import('../../cogita/holders');
type Knowness = typeof import('../../cogita/knowness');
type Logic = typeof import('../../cogita/logic');
type Knowing = typeof import('../../cogita/knowing');
type FlowFactsModule = typeof import('../../cogita/flowFacts');
type Cards = typeof import('../../cogita/cards');

interface Loaded {
  readonly learner: InstanceType<Learn['Learner']>;
  readonly knowness: Knowness;
  readonly logic: Logic;
  readonly learn: Learn;
  readonly knowing: Knowing;
  readonly flowFacts: FlowFactsModule;
  readonly cards: Cards;
}

/** 2026-11-03 (G) — die Baza der Erzählung, wie dieser Leser sie lesen darf, mit ihren Karten. */
interface Base {
  readonly lib: import('../../cogita/store').CogitaLibrary;
  readonly cards: readonly import('../../cogita/cardBasics').Card[];
}

/** Wo sich der Lauf einer Seite merkt, wo er war (`FlowPosition.flow`). */
const flowOf = (pageId: string): string => `page:${pageId}`;

type Chosen = NonNullable<ReturnType<typeof usePerson>>['chosen'];

/**
 * WER LERNT, UND WOHIN: verbunden und oben gewählt — als er selbst (eine
 * eigene Person: in den Bereich der Seite oder seinen privaten; ein Platz: nur,
 * wenn die Seite einen Bereich nennt). Sonst — und immer als Beispiel — im
 * Browser. Was schiefgeht, lernt ebenfalls im Browser.
 */
async function learnerFor(learn: Learn, holders: Holders, base: string, storage: string, chosen: Chosen): Promise<{
  readonly holder: ReturnType<Holders['localHolder']>;
  readonly target: Awaited<ReturnType<Learn['targetOf']>> | null;
  readonly fallback?: Awaited<ReturnType<Learn['targetOf']>> | null;
}> {
  const local = { holder: holders.localHolder(), target: null };
  if (base === '' || chosen === null) return local;
  try {
    if (chosen.kind === 'role') {
      const role = chosen.ring.roleOf(chosen.id);
      if (role === undefined) return local;
      const holder = { kind: 'role' as const, roleId: role.id, wrapPublicKey: fromBase64Url(role.wrapPublicKey), wrapPrivate: () => chosen.ring.wrapPrivate(role.id) };
      /*
        2026-11-03 (G) — WOHIN wie in Nauka (`targetFor`): was die Seite nennt, sonst die Baza (Ustawienia), sonst der
        eigene Bereich, sonst der Bereich der Baza — dieselbe Person, derselbe Ort: Nauka sieht die Antworten der Erzählung.
      */
      const { openPageBase } = await import('../../cogita/pageBase');
      const lib = await openPageBase(base, false).catch(() => null);
      if (lib !== null) {
        const { target, fallback } = await holders.targetFor(lib, holder, storage === '' ? null : storage);
        return target === null ? local : { holder, target, fallback };
      }
      const area = storage !== '' ? storage : await holders.personalArea();
      return area === null ? local : { holder, target: await learn.targetOf(area) };
    }
    if (storage === '') return local;
    const seat = await holders.holderOfSeat(chosen.seat);
    return seat === null ? local : { holder: seat, target: await learn.targetOf(storage) };
  } catch {
    return local;
  }
}

/**
 * Der Lauf — und ob er so weit ist (`ready`): eine Präsentation mit Przebieg
 * wartet auf ihn, damit ihr Weg von Anfang an durch die Tore geht. Ohne
 * Przebieg (oder im Editor) ist sie sofort so weit, ohne Lauf. Geht das
 * Laden schief, läuft sie ohne — wie eine Präsentation ohne Logik.
 */
export function useStoryRun(show: Show, pageId: string | null, given: CogitaLearner | null = null, pagePath: string | null = null): { readonly run: StoryRun | null; readonly ready: boolean } {
  const story: Story | null = show.story;
  const person = usePerson();
  /*
    2026-11-03 (G) — wie die Bausteine Cogity auf einer Seite (`pageLearner.tsx`): ohne Wahl oben lernt, wer angemeldet ist,
    als seine erste eigene Person — sonst zählte seine Erzählung nur im Browser und Nauka sähe sie nicht.
  */
  const chosen = person?.chosen ?? person?.options.find((o) => o.kind === 'role') ?? null;
  const chosenId = chosen?.id ?? null;
  /* Verbunden: erst, wenn die eigenen Personen da sind — sonst lernte er erst im Browser und gleich darauf noch einmal als er selbst. */
  const waiting = given === null && (story?.base ?? '') !== '' && person?.loading === true;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const visited = useRef(new Set<string>());
  const keepTimer = useRef<number | null>(null);

  const base = story?.base ?? '';
  const storage = story?.storage ?? '';

  useEffect(() => {
    if (story === null || pageId === null || waiting) { setLoaded(null); return undefined; }
    setLoaded(null);
    setFailed(false);
    let alive = true;
    let off = () => undefined as void;
    let made: Loaded['learner'] | null = null;

    void (async () => {
      try {
        const [learn, holders, knowness, logic, knowing, flowFacts, cardsModule]: [Learn, Holders, Knowness, Logic, Knowing, FlowFactsModule, Cards] = await Promise.all([
          import('../../cogita/learn'), import('../../cogita/holders'), import('../../cogita/knowness'), import('../../cogita/logic'),
          import('../../cogita/knowing'), import('../../cogita/flowFacts'), import('../../cogita/cards')
        ]);
        const more = { learn, knowing, flowFacts, cards: cardsModule };
        /* Schritt 12 — der Lernende der Baza (Nauka): nur zuhören, nicht schreiben, nicht schliessen. */
        if (given !== null) {
          if (!alive) return;
          off = given.subscribe(() => setVersion((n) => n + 1));
          visited.current = new Set(given.progress.positions.get(flowOf(pageId))?.visited ?? []);
          setLoaded({ learner: given, knowness, logic, ...more });
          return;
        }
        const { holder, target, fallback } = await learnerFor(learn, holders, base, storage, chosen);
        made = new learn.Learner(base !== '' ? base : flowOf(pageId), holder, target, fallback ?? null);
        off = made.subscribe(() => setVersion((n) => n + 1));
        await made.load().catch(() => undefined);
        visited.current = new Set(made.progress.positions.get(flowOf(pageId))?.visited ?? []);
        if (alive) setLoaded({ learner: made, knowness, logic, ...more });
      } catch {
        if (alive) setFailed(true);
      }
    })();

    const leave = () => { void made?.flush().catch(() => undefined); };
    window.addEventListener('pagehide', leave);
    return () => {
      alive = false;
      off();
      window.removeEventListener('pagehide', leave);
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story === null, pageId, base, storage, chosenId, waiting, given]);

  /* 2026-11-03 (G) — die Baza der Erzählung (echte Fragen, Namen, die Kenntnis der Einträge für Tore). */
  const [baseOpen, setBaseOpen] = useState<Base | null>(null);
  useEffect(() => {
    if (base === '' || story === null || pageId === null) { setBaseOpen(null); return undefined; }
    let alive = true;
    void (async () => {
      const { openPageBase } = await import('../../cogita/pageBase');
      const lib = await openPageBase(base, false);
      if (lib === null || !alive) return;
      const { cards } = await lib.cards('page');
      if (alive) setBaseOpen({ lib, cards });
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [base, story === null, pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useMemo((): StoryRun | null => {
    if (loaded === null || story === null || pageId === null) return null;
    const { learner, knowness, logic } = loaded;
    /*
      2026-11-03 (G) — DIE KENNTNIS EINES EINTRAGS der Baza (für Tore: „überspringe die Szene, wenn X sitzt"): wie überall
      in Cogita aus seinen Karten und den Fragen über ihn — auch denen, die auf einer Seite beantwortet wurden. Ein
      Schlüssel, den die Baza nicht kennt, ist eine Karte (eine Frage dieser Seite).
    */
    let gaugeMemo: import('../../cogita/knowing').Gauge | null = null;
    const gaugeNow = (): import('../../cogita/knowing').Gauge | null => {
      if (baseOpen === null) return null;
      if (gaugeMemo !== null) return gaugeMemo;
      const fp = new Map(baseOpen.cards.map((c) => [c.key, c.fingerprint] as const));
      const all = [...baseOpen.cards, ...loaded.learn.answeredCards(learner.progress, new Set(fp.keys()))];
      gaugeMemo = loaded.knowing.withFlows(
        loaded.knowing.gaugeFromMarks(all, (key) => learner.marks(key, fp.get(key)), baseOpen.lib.dependencies(), Date.now(), baseOpen.lib.prerequisites()),
        loaded.flowFacts.learnerFlows(baseOpen.lib, learner.progress.positions)
      );
      return gaugeMemo;
    };
    const resolve = (ref: string): string | null => {
      const r = ref.trim();
      if (baseOpen === null || r === '') return null;
      if (r.startsWith('@')) return baseOpen.lib.byImportRef(r.slice(1))?.id ?? null;
      return baseOpen.lib.entity(r) !== undefined || baseOpen.lib.docs('flow').some((d) => d.id === r) ? r : null;
    };
    const entryKnowness = (id: string): number => {
      const g = gaugeNow();
      const ref = id.startsWith('@') ? resolve(id) ?? id : id;
      if (g !== null && (g.testing.has(ref) || g.totals.has(ref))) return loaded.knowing.itemKnowness(g, ref);
      return knowness.knownessOf(learner.marks(ref), Date.now());
    };
    const lastOf = (id: string): number | null => {
      const marks = learner.marks(id);
      return marks.length === 0 ? null : marks[marks.length - 1].correctness;
    };
    const factsNow = () => ({
      values: startValues(story, learner.progress.values),
      knowness: entryKnowness,
      answered: lastOf,
      visited: visited.current,
      now: new Date(),
      /* 2026-11-03 (G) — die Erzählungen dieses Lernenden in der Baza (die Bedingung „Przebieg"). */
      flow: (id: string) => gaugeNow()?.flows?.get(id.startsWith('@') ? resolve(id) ?? id : id)
    });
    return {
      mode: learner.holder.kind === 'local' ? 'browser' : 'cogita',
      version,
      facts: factsNow,
      record: (card, correctness, given) => {
        learner.record(card, correctness, {
          ...(given === undefined ? {} : { given }), via: flowOf(pageId),
          /* 2026-11-03 (G) — eine Frage dieser Seite, die für Einträge der Baza zählt: das steht an der Antwort. */
          ...(card.about !== undefined && card.about.length > 0 && baseOpen?.cards.some((c) => c.key === card.key) !== true ? { about: card.about } : {})
        });
      },
      ...(baseOpen === null ? {} : {
        card: (ref: string) => {
          const id = resolve(ref);
          if (id === null) return null;
          const own = baseOpen.cards.find((c) => c.question === id && (c.entity === undefined || c.entity === id));
          if (own !== undefined) return own;
          const e = baseOpen.lib.entity(id);
          return e !== undefined && e.kinds.includes('question') ? loaded.cards.questionCard(e, 'page') : null;
        },
        resolve
      }),
      apply: (gates) => {
        let values = startValues(story, learner.progress.values);
        for (const gate of gates) if (gate.type === 'set') values = logic.apply(gate.actions, values, limitsOf(story)).values;
        void learner.keepValues(values).catch(() => undefined);
      },
      visit: (sceneKey) => {
        visited.current = new Set([...visited.current, sceneKey]);
        /*
          Die Stelle wird kurz danach gemerkt, nicht bei jedem Durchscrollen — die letzte gilt; was schon so dasteht, geht
          nicht noch einmal hinaus. 2026-11-03 (G): eine Szene, nach der „Dalej" endet, ist ein Ende — die Erzählung ist
          durch (das bleibt); dazu der Pfad der Seite, über den der Ablauf der Baza, der auf sie zeigt, sie findet.
        */
        const ends = nextOf(show, sceneKey).kind === 'end';
        if (keepTimer.current !== null) window.clearTimeout(keepTimer.current);
        keepTimer.current = window.setTimeout(() => {
          const kept = learner.progress.positions.get(flowOf(pageId));
          const done = ends || kept?.done === true;
          /* 2026-11-03 (Prompt 5) — die Ziele des Ablaufs der Baza, der auf diese Seite zeigt (der Przegląd): einmal erreicht bleibt erreicht. */
          const reached = baseOpen === null ? [] : loaded.flowFacts.pageGoals(baseOpen.lib, pagePath, factsNow());
          const goals = loaded.flowFacts.mergeGoals(kept?.goals, reached);
          const sameGoals = goals.length === (kept?.goals?.length ?? 0);
          if (kept?.step === sceneKey && kept.visited.length === visited.current.size && (kept.done === true) === done && (pagePath === null || kept.path === pagePath) && sameGoals) return;
          void learner.keepPosition({
            flow: flowOf(pageId), step: sceneKey, visited: [...visited.current], at: Date.now(),
            ...(done ? { done: true } : {}), ...(pagePath === null || pagePath === '' ? {} : { path: pagePath }),
            ...(goals.length > 0 ? { goals } : {})
          }).catch(() => undefined);
        }, ends ? 300 : 1500);
      },
      last: () => learner.progress.positions.get(flowOf(pageId))?.step ?? null
    };
  }, [loaded, story, pageId, version, pagePath, show, baseOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return { run, ready: story === null || pageId === null || run !== null || failed };
}
