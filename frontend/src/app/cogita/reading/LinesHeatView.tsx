/**
 * 2026-11-22 (Homer-Einheit) — DIE WÄRMEKARTE AUF DER LEINWAND (und beim Leiter): der Abschnitt Zeile für Zeile, daneben, wie
 * viele die Zeile gewählt haben (`linesHeat`) — je stärker, desto dunkler der Balken. Nie Namen. Nach dem Aufdecken sind die
 * richtigen Zeilen markiert (✓). Ist der Text hier nicht zu haben, stehen nur die Nummern mit ihren Zahlen da.
 */

import { useT } from '../../core/i18n';
import type { Card } from '../cardBasics';
import type { ReadingSpec } from './readingSpec';
import { usePassage } from './PassageLines';
import './reading.css';

export function LinesHeat({ card, counts, reveal = false }: { card: Card; counts: readonly number[]; reveal?: boolean }) {
  const t = useT();
  const a = card.answer as ReadingSpec;
  const passage = usePassage(a.passage);
  const lines = passage.status === 'ready' ? passage.lines : Array.from({ length: counts.length }, () => '');
  const max = Math.max(1, ...counts);
  const right = (n: number): boolean => reveal && (a.form === 'lines' ? a.correct.includes(n) : a.form === 'span' ? a.spans.some(([x, y]) => n >= x && n <= y) : false);
  if (lines.length === 0) return <p className="cg-muted" data-read-heat="0">{t('cogitaReading.heat.none')}</p>;
  return (
    <section className="cg-read cg-read-heat" aria-label={t('cogitaReading.heat.title')} data-read-heat={counts.reduce((s, n) => s + n, 0)}>
      <p className="cg-read-ask">{t('cogitaReading.heat.title')}</p>
      <ol className="cg-read-lines">
        {lines.map((text, i) => {
          const n = i + 1;
          const c = counts[i] ?? 0;
          return (
            <li key={n} className={`cg-read-line${right(n) ? ' is-right' : ''}`} data-read-line={n} data-read-count={c}>
              <span className="cg-read-no">{n}</span>
              <span className="cg-read-text">{text}{right(n) && <span className="cg-read-mark" aria-label={t('cogitaReading.heat.right')}> ✓</span>}</span>
              <span className="cg-read-heatbar">
                <span ref={(el) => { el?.style.setProperty('--heat', String(c === 0 ? 0 : 0.2 + (0.8 * c) / max)); }} />
                <span>{c}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
