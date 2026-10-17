/**
 * COGITA OHNE SCHLÜSSEL (0109, COGITA.md §14): was eine öffentliche Seite,
 * ein Code oder ein Link ohne Konto zu sehen bekommt — die veröffentlichten
 * Bündel einer Bibliothek (`data.public` eines Eintrags), und wer damit lernt:
 * im Browser [L6], bis er seinen Fortschritt nach der Anmeldung mitnimmt.
 *
 * Gebraucht von den Bausteinen der Seiten (`parts/cogita.tsx`) und vom
 * Mitmachen an einer Sitzung, die man mit einem Code betreten hat — beide
 * haben keinen Schlüssel der Bibliothek.
 */

import { useEffect, useMemo, useState } from 'react';

import { loadPublishedOne } from '../library';
import type { Card } from './cards';
import { publicFileUrl } from './files';
import { localHolder } from './holders';
import { Learner } from './learn';
import type { PublicEntity, PublicRevision } from './publish';
import { REVISION_BUNDLE } from './published';
import { readPlan } from './revision';
import { RevisionRun, type RunSource } from './RevisionRun';
import { PublicContext, type PublicCtx } from './ui';
import { Loading } from '../ui/Loading';

/**
 * Ein veröffentlichtes Bündel — `undefined`: wird geholt; `null`: gibt es
 * nicht (zurückgezogen, nie veröffentlicht, ein anderes Format).
 */
export function useBundle<T>(library: string, entry: string, format: string): T | null | undefined {
  const [found, setFound] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    if (library === '' || entry === '') { setFound(null); return undefined; }
    let alive = true;
    setFound(undefined);
    void loadPublishedOne(library, entry).then((r) => {
      let data: unknown = null;
      try { data = (JSON.parse(r.entry.json) as { data?: unknown }).data ?? null; } catch { data = null; }
      const fits = typeof data === 'object' && data !== null && (data as { format?: unknown }).format === format;
      if (alive) setFound(fits ? data as T : null);
    }, () => { if (alive) setFound(null); });
    return () => { alive = false; };
  }, [library, entry, format]);
  return found;
}

/** Wer hier ohne Konto lernt — eine Kennung je Browser; neu gezeichnet, wenn sich sein Fortschritt ändert. */
export function useLocalLearner(libraryId: string): Learner | null {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (libraryId === '') { setLearner(null); return undefined; }
    const made = new Learner(libraryId, localHolder(), null);
    const off = made.subscribe(() => setTick((n) => n + 1));
    let alive = true;
    const ready = () => { if (alive) setLearner(made); };
    void made.load().then(ready, ready);
    return () => { alive = false; off(); void made.flush().catch(() => undefined); };
  }, [libraryId]);
  return learner;
}

/** Was eine öffentliche Seite statt der Schlüssel hat: die offenen Dateien, die Einträge des Bündels. */
export const publicOf = (library: string, entities: Readonly<Record<string, PublicEntity>>): PublicCtx => ({
  fileUrl: (fileId, from) => publicFileUrl(from ?? library, fileId),
  entity: (id) => entities[id] ?? null
});

/** Der Lauf aus einem Bündel: sein Plan (ohne Lernstand gerechnet), seine Karten, seine Abhängigkeiten. */
export function revisionSource(bundle: PublicRevision): RunSource {
  const plan = bundle.plan as unknown as Record<string, unknown>;
  const gate = typeof plan.gate === 'number' ? plan.gate : null;
  return { plan: readPlan(bundle.cards, gate, plan), cards: bundle.cards, deps: bundle.deps ?? [], title: bundle.title };
}

/** Eine veröffentlichte Powtórka laufen lassen — mit den Erklärungen und Dateien, die sie mitbringt. */
export function PublicRevisionRun({ libraryId, revisionId, learner, title, via, onClose, onAnswer }: {
  libraryId: string;
  revisionId: string;
  learner: Learner | null;
  title?: string;
  via?: string;
  onClose?: () => void;
  onAnswer?: (card: Card, correctness: number, given: unknown) => void;
}) {
  const bundle = useBundle<PublicRevision>(libraryId, revisionId, REVISION_BUNDLE);
  const shown = useMemo(() => (bundle == null ? null : publicOf(libraryId, bundle.explain ?? {})), [bundle, libraryId]);
  const source = useMemo(() => (bundle == null ? null : { ...revisionSource(bundle), ...(title === undefined ? {} : { title }) }), [bundle, title]);
  if (bundle === undefined) return <Loading label="Wczytywanie powtórki…" />;
  if (bundle === null || source === null) return <p className="wk-error">Ta powtórka nie jest opublikowana — autor musi ją opublikować.</p>;
  return (
    <PublicContext.Provider value={shown}>
      <RevisionRun lib={null} learner={learner} source={source} onClose={onClose} via={via} onAnswer={onAnswer} />
    </PublicContext.Provider>
  );
}
