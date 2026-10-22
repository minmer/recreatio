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
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { fromBase64Url } from '../../core/crypto';
import { usePerson } from '../pagePerson';
import type { Show } from './presentation';
import type { StoryRun } from './showContext';
import { limitsOf, startValues, type Story } from './story';

type Learn = typeof import('../../cogita/learn');
type Holders = typeof import('../../cogita/holders');
type Knowness = typeof import('../../cogita/knowness');
type Logic = typeof import('../../cogita/logic');

interface Loaded {
  readonly learner: InstanceType<Learn['Learner']>;
  readonly knowness: Knowness;
  readonly logic: Logic;
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
}> {
  const local = { holder: holders.localHolder(), target: null };
  if (base === '' || chosen === null) return local;
  try {
    if (chosen.kind === 'role') {
      const role = chosen.ring.roleOf(chosen.id);
      const area = role === undefined ? null : storage !== '' ? storage : await holders.personalArea();
      if (role === undefined || area === null) return local;
      return {
        holder: { kind: 'role', roleId: role.id, wrapPublicKey: fromBase64Url(role.wrapPublicKey), wrapPrivate: () => chosen.ring.wrapPrivate(role.id) },
        target: await learn.targetOf(area)
      };
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
export function useStoryRun(show: Show, pageId: string | null): { readonly run: StoryRun | null; readonly ready: boolean } {
  const story: Story | null = show.story;
  const person = usePerson();
  const chosen = person?.chosen ?? null;
  const chosenId = chosen?.id ?? null;
  /* Verbunden: erst, wenn die eigenen Personen da sind — sonst lernte er erst im Browser und gleich darauf noch einmal als er selbst. */
  const waiting = (story?.base ?? '') !== '' && person?.loading === true;
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
        const [learn, holders, knowness, logic]: [Learn, Holders, Knowness, Logic] = await Promise.all([
          import('../../cogita/learn'), import('../../cogita/holders'), import('../../cogita/knowness'), import('../../cogita/logic')
        ]);
        const { holder, target } = await learnerFor(learn, holders, base, storage, chosen);
        made = new learn.Learner(base !== '' ? base : flowOf(pageId), holder, target);
        off = made.subscribe(() => setVersion((n) => n + 1));
        await made.load().catch(() => undefined);
        visited.current = new Set(made.progress.positions.get(flowOf(pageId))?.visited ?? []);
        if (alive) setLoaded({ learner: made, knowness, logic });
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
  }, [story === null, pageId, base, storage, chosenId, waiting]);

  const run = useMemo((): StoryRun | null => {
    if (loaded === null || story === null || pageId === null) return null;
    const { learner, knowness, logic } = loaded;
    const lastOf = (id: string): number | null => {
      const marks = learner.marks(id);
      return marks.length === 0 ? null : marks[marks.length - 1].correctness;
    };
    return {
      mode: learner.holder.kind === 'local' ? 'browser' : 'cogita',
      version,
      facts: () => ({
        values: startValues(story, learner.progress.values),
        knowness: (id) => knowness.knownessOf(learner.marks(id), Date.now()),
        answered: lastOf,
        visited: visited.current,
        now: new Date()
      }),
      record: (card, correctness, given) => {
        learner.record(card, correctness, {
          ...(given === undefined ? {} : { given }), via: flowOf(pageId)
        });
      },
      apply: (gates) => {
        let values = startValues(story, learner.progress.values);
        for (const gate of gates) if (gate.type === 'set') values = logic.apply(gate.actions, values, limitsOf(story)).values;
        void learner.keepValues(values).catch(() => undefined);
      },
      visit: (sceneKey) => {
        visited.current = new Set([...visited.current, sceneKey]);
        /* Die Stelle wird kurz danach gemerkt, nicht bei jedem Durchscrollen — die letzte gilt; was schon so dasteht, geht nicht noch einmal hinaus. */
        if (keepTimer.current !== null) window.clearTimeout(keepTimer.current);
        keepTimer.current = window.setTimeout(() => {
          const kept = learner.progress.positions.get(flowOf(pageId));
          if (kept?.step === sceneKey && kept.visited.length === visited.current.size) return;
          void learner.keepPosition({ flow: flowOf(pageId), step: sceneKey, visited: [...visited.current], at: Date.now() }).catch(() => undefined);
        }, 1500);
      },
      last: () => learner.progress.positions.get(flowOf(pageId))?.step ?? null
    };
  }, [loaded, story, pageId, version]);

  return { run, ready: story === null || pageId === null || run !== null || failed };
}
