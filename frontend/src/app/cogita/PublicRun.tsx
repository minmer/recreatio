/**
 * COGITA OHNE KONTO (0109, COGITA.md §14) — wer ohne Konto lernt, lernt im
 * Browser [L6], bis er seinen Fortschritt nach der Anmeldung mitnimmt.
 *
 * 2026-10-22 (Schritt 8) — keine veröffentlichten Bündel mehr: eine Powtórka
 * ohne Konto (eine Sitzung im eigenen Tempo, ein Baustein der Seite) läuft auf
 * der Baza wiedzy selbst, so wie ihr Bereich sie diesem Leser zeigt
 * (`pageBase.ts`): öffentlich, über einen Link, einen Platz oder als Mitglied.
 */

import { useEffect, useState } from 'react';

import type { Card } from './cardBasics';
import { localHolder } from './holders';
import { Learner } from './learn';
import { usePageBase } from './pageBase';
import { RevisionRun } from './RevisionRun';
import { CogitaContext } from './ui';
import { Loading } from '../ui/Loading';

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

/** Eine Powtórka der Baza wiedzy laufen lassen, ohne Konto — wenn dieser Leser die Baza lesen darf. */
export function PageRevisionRun({ libraryId, revisionId, learner, title, via, onClose, onAnswer }: {
  libraryId: string;
  revisionId: string;
  learner: Learner | null;
  title?: string;
  via?: string;
  onClose?: () => void;
  onAnswer?: (card: Card, correctness: number, given: unknown) => void;
}) {
  const { lib, ctx } = usePageBase(libraryId);
  if (lib === undefined) return <Loading label="Wczytywanie powtórki…" />;
  if (lib === null || ctx === null) return <p className="wk-error">Tej bazy wiedzy nie możesz czytać — powtórka bez konta działa w bazie z obszaru publicznego (albo z linkiem do niego).</p>;
  const doc = lib.docs('revision').find((e) => e.id === revisionId);
  if (doc === undefined) return <p className="wk-error">Tej powtórki nie ma w bazie wiedzy.</p>;
  const name = title ?? (typeof doc.data.name === 'string' ? doc.data.name : 'Powtórka');
  return (
    <CogitaContext.Provider value={ctx}>
      <RevisionRun lib={lib} learner={learner} source={{ revisionId, title: name }} onClose={onClose} via={via} onAnswer={onAnswer} />
    </CogitaContext.Provider>
  );
}
