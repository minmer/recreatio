/**
 * 2026-11-05 (Prompt 23, A2) — „ZOBACZ W OPOWIEŚCI“: die Erzählung einer Folie, an dieser Folie geöffnet — NUR ZUM ANSEHEN
 * („Podgląd“): der Spieler ohne Lernenden (`learner={null}`: kein `keepPosition`, kein `record`, keine Werte, keine Ziele,
 * kein Zähler der Przegląd) und ohne Sperre (`gate={false}`) — auch eine nicht begonnene oder gesperrte Erzählung. Darüber
 * die Leiter, über die man sie als Abstecher erreicht („Etap 1 › Sen dziewięciolatka“). Eine Schicht über allem: „Wróć“
 * (oder Esc) schliesst sie, und darunter steht alles, wie es war (die Powtórka, die Erzählung, die Karte).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Card } from './cardBasics';
import { readFlow, resolveFlow } from './flow';
import { contentOfLibrary, FlowPlayer } from './FlowPlayer';
import { baseLang } from './lang';
import { slideWords } from './slideWords';
import type { CogitaLibrary } from './store';
import { Loading } from '../ui/Loading';
import { TexText } from '../ui/tex/Tex';
import './slides.css';

export default function StoryPreview({ lib, flowId, step, ladder, onClose }: {
  lib: CogitaLibrary;
  flowId: string;
  /** Der Schritt der Folie (`null`: der Anfang — „Część opowieści“). */
  step: string | null;
  /** Die Leiter von oben bis zu dieser Erzählung (nur diese: kein Abstecher). */
  ladder: readonly string[];
  onClose: () => void;
}) {
  const W = slideWords(baseLang(lib));
  const [cards, setCards] = useState<readonly Card[] | null>(null);
  useEffect(() => {
    let alive = true;
    void lib.cards('flow').then((r) => { if (alive) setCards(r.cards); }, () => { if (alive) setCards([]); });
    return () => { alive = false; };
  }, [lib]);
  const flow = useMemo(() => {
    const docs = lib.docs('flow');
    const d = docs.find((x) => x.id === flowId);
    if (d === undefined) return null;
    const find = (x: string) => { const f = docs.find((one) => one.id === x); return f === undefined ? undefined : readFlow(f.id, f.data); };
    return resolveFlow(readFlow(d.id, d.data), find);
  }, [lib, lib.revision, flowId]); // eslint-disable-line react-hooks/exhaustive-deps
  const content = useMemo(() => (cards === null ? null : contentOfLibrary(lib, cards)), [lib, cards]);
  const [at] = useState(() => Date.now());
  const nameOf = (id: string) => { const d = lib.docs('flow').find((x) => x.id === id); return String(d?.data.name ?? id); };
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const was = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('keydown', esc, true); was?.focus?.(); };
  }, [onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={box} className="cg-preview" role="dialog" aria-modal="true" aria-label={`${W.preview}: ${flow?.name ?? ''}`} tabIndex={-1} data-story-preview={flowId} data-story-preview-step={step ?? ''}>
      <header className="cg-preview-head">
        <button type="button" className="wk-btn wk-btn-line" onClick={onClose} data-story-preview-back="">{W.back}</button>
        <span className="cg-preview-tag" data-story-preview-tag="">{W.preview}</span>
        <nav className="cg-preview-ladder" aria-label={W.openInStory} data-story-preview-ladder={ladder.length}>
          {ladder.map((id, i) => (
            <span key={id} className="cg-preview-crumb" {...(i === ladder.length - 1 ? { 'aria-current': 'page' as const } : {})}>
              {i > 0 && <span aria-hidden> › </span>}<TexText text={nameOf(id)} />
            </span>
          ))}
        </nav>
      </header>
      <p className="cg-muted cg-preview-note">{W.previewNote}</p>
      <div className="cg-preview-body">
        {flow === null ? <p className="cg-muted">{W.noStory}</p> : content === null ? <Loading label={W.loading} /> : (
          <FlowPlayer key={`${flow.id}:${step ?? ''}`} flow={flow} content={content} learner={null} gate={false} onClose={onClose} backLabel={W.back.replace(/^‹\s*/, '')}
            jumpTo={step === null ? null : { step, at }} />
        )}
      </div>
    </div>,
    document.body
  );
}
