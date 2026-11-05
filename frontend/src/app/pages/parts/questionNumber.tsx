/**
 * 2026-10-23 (Schritt 13) — DIE ZAHL EINER FRAGE im Editor: die Einheit, die
 * Grösse (mit Grösse zählt die Einheit der Antwort, `core/quantities.ts`) und
 * die Toleranz. Eigene Datei, erst im Editor geladen: eine Seite mit Fragen
 * trägt die Liste der Einheiten nicht mit.
 */

import { useT } from '../../core/i18n';
import { findUnit, guessKind, kindById, kindsText, measures, QUANTITY_KINDS } from '../../core/quantities';
import type { EditorProps, RawConfig } from '../part';
import type { QuestionConfig } from './question';

export default function QuestionNumber({ raw, c, busy, onSet }: { raw: RawConfig; c: QuestionConfig; busy: boolean; onSet: EditorProps['onSet'] }) {
  const t = useT();
  const unit = findUnit(c.unit);
  const quantity = kindById(c.quantity) === undefined ? '' : c.quantity;
  const kind = quantity !== '' ? quantity : guessKind(c.unit);
  const say = quantity !== '' && unit !== undefined && !measures(unit, quantity)
    ? t('moduleDataLearn.qnum.notMeasures', { unit: unit.symbol, quantity: kindById(quantity)?.label ?? quantity })
    : quantity === '' && unit !== undefined && unit.kinds.length > 1
      ? t('moduleDataLearn.qnum.ambiguous', { unit: unit.symbol, kinds: kindsText(unit.kinds) })
      : kind !== undefined ? t('moduleDataLearn.qnum.converted', { quantity: kindById(kind)?.label ?? kind }) : null;
  return (
    <div className="pb-question-number">
      <label className="wk-field">
        <span>{t('moduleDataLearn.qnum.unit')}</span>
        <input value={raw.unit ?? ''} disabled={busy} placeholder={t('moduleDataLearn.qnum.unitPh')} onChange={(e) => onSet({ unit: e.target.value })} />
      </label>
      <label className="wk-field">
        <span>{t('moduleDataLearn.qnum.quantity')}</span>
        <select value={quantity} disabled={busy} onChange={(e) => onSet({ quantity: e.target.value })}>
          <option value="">{t('moduleDataLearn.qnum.noQuantity')}</option>
          {QUANTITY_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </label>
      <label className="wk-field">
        <span>{t('moduleDataLearn.qnum.tolerance')}</span>
        <input value={raw.tolerance ?? ''} disabled={busy} inputMode="decimal" placeholder="0" onChange={(e) => onSet({ tolerance: e.target.value })} />
      </label>
      {say !== null && <p className="wk-card-muted">{say}</p>}
    </div>
  );
}
