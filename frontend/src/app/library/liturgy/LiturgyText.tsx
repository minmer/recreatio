/**
 * 2026-11-09 — DIE ZWEI ANSICHTEN EINES BRZMIENIE: fortlaufend (das Brzmienie in seinen Absätzen, nichts dazu) und
 * liturgisch (Zeilen mit * und †, Versnummern, K./W., Kreuz, Überschriften, Rubriken; beim Wiederholen „/").
 * Das Modell der Zeilen kommt aus `text.ts` — hier wird nur gezeichnet.
 */
import { useT } from '../../core/i18n';
import type { Line } from './text';

export type View = 'plain' | 'liturgical';

export function LinesView({ lines }: { lines: readonly Line[] }) {
  const t = useT();
  return (
    <div className="lit-lines" data-lit-view="liturgical">
      {lines.map((line, i) => line.kind === 'text' ? (
        <p key={i} className={`lit-line${line.gap === 'stanza' ? ' is-stanza' : line.gap === 'line' ? ' is-verse' : ''}`}>
          {line.role !== undefined && <span className="lit-role">{t(`liturgy.roles.${line.role}`)} </span>}
          {line.verse !== undefined && <sup className="lit-verse">{line.verse}</sup>}
          {line.segs.map((s, k) => (
            <span key={k} className={s.style === undefined ? undefined : `is-${s.style}`}>
              {k > 0 ? ' ' : ''}{s.cross && <span className="lit-cross" aria-label={t('liturgy.view.cross')}>✠ </span>}{s.text}{s.mark !== undefined && <span className="lit-mark"> {s.mark}</span>}
            </span>
          ))}
        </p>
      ) : (
        <p key={i} className={`lit-note is-${line.kind}`}>{line.segs.map((s) => s.text).join(' ')}</p>
      ))}
    </div>
  );
}

export function PlainView({ paragraphs }: { paragraphs: readonly string[] }) {
  return <div className="lit-plain" data-lit-view="plain">{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>;
}

/** Der Umschalter zwischen beiden Ansichten. */
export function ViewSwitch({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const t = useT();
  return (
    <div className="lit-view-switch" role="group" aria-label={t('liturgy.view.label')}>
      {(['plain', 'liturgical'] as const).map((v) => (
        <button key={v} type="button" className={`wk-btn ${view === v ? '' : 'wk-btn-quiet'}`} aria-pressed={view === v} onClick={() => onChange(v)}>{t(`liturgy.view.${v}`)}</button>
      ))}
    </div>
  );
}
