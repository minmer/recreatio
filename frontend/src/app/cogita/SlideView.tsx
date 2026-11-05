/**
 * 2026-11-05 (Prompt 23, A1–A3, A5) — EINE FOLIE DER ERZÄHLUNG AUSSERHALB DES SPIELERS: unter der Erklärung einer Frage
 * gezeichnet wie im Spieler (`SlideBody` — dieselbe Kette: `publicEntity` → das Feld „blocks“ als Zapis → `Markup`: Titel,
 * Text, Zitate mit „> — Autor“, Wzory, Fussnoten), dazu „Zobacz w opowieści“ (eine Vorschau der Erzählung an dieser Folie,
 * `StoryPreview.tsx`) und die Fragen zu ihr („Pytania do tego slajdu (N)“ mit „Ćwicz“).
 */

import { lazy, Suspense, useContext, useMemo, useState } from 'react';

import { baseLang } from './lang';
import { publicEntity } from './publish';
import { readPlan } from './revision';
import { libStoryIndex, slideQuestionIds } from './slideLib';
import { ladderOf, storyForSlide } from './slideLinks';
import { slideWords } from './slideWords';
import type { Entity } from './schema';
import type { CogitaLibrary } from './store';
import { CogitaContext, Markup } from './ui';
import { Loading } from '../ui/Loading';
import { TexText } from '../ui/tex/Tex';
import './slides.css';

/* Erst geladen, wenn jemand eine Vorschau öffnet (sie bringt den Spieler mit — und keinen Kreis der Importe). */
const StoryPreview = lazy(() => import('./StoryPreview'));
const RevisionRunLazy = lazy(() => import('./RevisionRun').then((m) => ({ default: m.RevisionRun })));

/** Der Text einer Folie, wie ihn der Spieler zeigt (ohne Titel — den setzt, wer sie zeigt). */
export function SlideBody({ lib, entity, onEntity }: { lib: CogitaLibrary; entity: Entity; onEntity?: (id: string) => void }) {
  const pe = publicEntity(lib, entity);
  const text = pe.fields.find((f) => f.type === 'blocks');
  if (text === undefined) return null;
  return <div className="cg-slide-body" data-slide-body={entity.id}><Markup text={text.text} lib={lib} {...(onEntity === undefined ? {} : { onEntity })} /></div>;
}

/** Wo eine Folie (oder die Einheit einer Erzählung) zu sehen ist: Erzählung, Schritt, Leiter — mit der begonnenen zuerst. */
export function useStoryAt(lib: CogitaLibrary, id: string, unitFlow: string | null): { readonly flow: string; readonly step: string | null; readonly ladder: readonly string[] } | null {
  const learner = useContext(CogitaContext)?.learner ?? null;
  const positions = learner?.progress.positions;
  return useMemo(() => {
    const ix = libStoryIndex(lib);
    if (unitFlow !== null) return { flow: unitFlow, step: null, ladder: ladderOf(ix, unitFlow) };
    const started = (f: string) => { const p = positions?.get(f); return p !== undefined && (p.visited.length > 0 || p.done === true); };
    return storyForSlide(ix, id, started);
  }, [lib, lib.revision, id, unitFlow, positions]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * DIE KNÖPFE UNTER EINER AUFGEKLAPPTEN FOLIE: „Zobacz w opowieści“ (falls eine Erzählung sie zeigt) und „Pytania do tego
 * slajdu (N)“ mit „Ćwicz“ (genau diese Karten, gekonnte wie immer übersprungen). `unitFlow`: die Einheit einer Erzählung
 * („Część opowieści“) — die Vorschau beginnt am Anfang.
 */
export function SlideActions({ lib, entity, unitFlow = null, questions = true }: { lib: CogitaLibrary; entity: Entity; unitFlow?: string | null; questions?: boolean }) {
  const W = slideWords(baseLang(lib));
  const at = useStoryAt(lib, entity.id, unitFlow);
  const [open, setOpen] = useState(false);
  return (
    <div className="cg-slide-actions" data-slide-actions={entity.id}>
      {at !== null && <button type="button" className="wk-link-btn" onClick={() => setOpen(true)} data-slide-open-story={at.flow} data-slide-open-step={at.step ?? ''}>{W.openInStory}</button>}
      {questions && <SlideQuestions lib={lib} slide={entity.id} name={lib.label(entity)} />}
      {open && at !== null && (
        <Suspense fallback={null}>
          <StoryPreview lib={lib} flowId={at.flow} step={at.step} ladder={at.ladder} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

/** „Pytania do tego slajdu (N)“: die Fragen, deren Erklärung die Folie nennt — aufgeklappt mit „Ćwicz“ (eine kurze Powtórka). */
export function SlideQuestions({ lib, slide, name, compact = false }: { lib: CogitaLibrary; slide: string; name: string; compact?: boolean }) {
  const W = slideWords(baseLang(lib));
  const ctx = useContext(CogitaContext);
  const ids = useMemo(() => slideQuestionIds(lib, slide), [lib, lib.revision, slide]); // eslint-disable-line react-hooks/exhaustive-deps
  const [run, setRun] = useState<{ readonly key: string; readonly plan: ReturnType<typeof readPlan>; readonly cards: Awaited<ReturnType<CogitaLibrary['cards']>>['cards'] } | null>(null);
  const [busy, setBusy] = useState(false);
  if (ids.length === 0) return compact ? null : <p className="cg-muted" data-slide-questions="0">{W.noQuestions}</p>;
  const practise = () => {
    setBusy(true);
    void lib.cards('flow').then(({ cards }) => {
      const wanted = new Set(ids);
      const list = cards.filter((c) => wanted.has(c.question)).filter((c) => !(ctx?.learner?.progress.suspended.has(c.key) ?? false));
      setBusy(false);
      if (list.length === 0) return;
      setRun({ key: `slide:${slide}:${Date.now()}`, plan: readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: Math.min(20, list.length), endWhenDone: true }), cards });
    }, () => setBusy(false));
  };
  return (
    <details className="cg-slide-questions" data-slide-questions={ids.length}>
      <summary>{W.slideQuestions(ids.length)}</summary>
      <ul className="cg-slide-qlist">
        {ids.map((q) => { const e = lib.entity(q); return <li key={q} data-slide-question={q}><TexText text={e === undefined ? q : lib.label(e)} /></li>; })}
      </ul>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-line is-small" disabled={busy} onClick={practise} data-slide-practise={slide}>{W.practise}</button>
      </div>
      {run !== null && (
        <div className="cg-slide-run" data-slide-run="">
          <Suspense fallback={<Loading label={W.loading} />}>
            <RevisionRunLazy key={run.key} lib={lib} learner={ctx?.learner ?? null} source={{ plan: run.plan, cards: run.cards, title: W.practiseTitle(name) }} onClose={() => setRun(null)} />
          </Suspense>
        </div>
      )}
    </details>
  );
}
