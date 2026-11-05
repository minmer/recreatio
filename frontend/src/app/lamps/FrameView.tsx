/**
 * EIN PAKET, AUFGESCHLÜSSELT — unter jedem Feld für Hex (Sygnał, Odczyt z
 * pilota): wie viele Bytes, welche AD-Strukturen, Kennung und Daten des
 * Herstellers, und genau das, worum Android gebeten wird und was dann in der
 * Luft steht. Was nicht geht, steht da, statt still geändert zu werden.
 */

import { rich, useT } from '../core/i18n';
import { adName, airBytes, asciiOf, hexOf, idText, LEGACY_MAX, readFrame, spaced } from './adv';

const B = { b: (s: string, k: number) => <strong key={k}>{s}</strong> };

export function FrameView({ hex, compact = false }: { hex: string; compact?: boolean }) {
  const t = useT();
  const read = readFrame(hex);
  if (read.hex === '') return null;
  const adv = read.advertising;
  const used = adv === null ? Math.floor(read.hex.length / 2) : adv.bytes.length - adv.padding;

  return (
    <div className="lp-view" aria-live="polite">
      <p className="lp-view-size">
        {rich(t('lamps.frame.bytesOf', { count: used, max: LEGACY_MAX }), B)}
        {adv !== null && adv.manufacturer !== null && <> · {rich(t('lamps.frame.maker', { id: idText(adv.manufacturer.id) }), B)}</>}
        {read.problem === null && <> · <span className="lp-ok">{t('lamps.frame.canSend')}</span></>}
      </p>
      {read.problem !== null && <p className="wk-error">{read.problem}</p>}
      {adv !== null && adv.problems.slice(1).map((p) => <p key={p} className="wk-error">{p}</p>)}
      {adv !== null && adv.notes.map((n) => <p key={n} className="wk-working">{n}</p>)}

      {!compact && adv !== null && adv.structures.length > 0 && (
        <dl className="lp-dl">
          {adv.structures.map((s) => (
            <div key={s.offset} className="lp-dl-row">
              <dt>{t('lamps.frame.byte', { n: s.offset + 1 })}</dt>
              <dd>
                <span className="lp-hex">{spaced(hexOf(new Uint8Array([s.length, s.type])))}</span> {adName(s.type)} · {t('lamps.frame.dataBytes', { count: s.length - 1 })}
              </dd>
            </div>
          ))}
          {read.manufacturer !== null && (
            <>
              <div className="lp-dl-row">
                <dt>{t('lamps.frame.makerData')}</dt>
                <dd>
                  <span className="lp-hex">{spaced(hexOf(read.manufacturer.data))}</span>
                  <span className="lp-ascii" title={t('lamps.frame.ascii')}>{asciiOf(read.manufacturer.data)}</span>
                </dd>
              </div>
              <div className="lp-dl-row">
                <dt>{t('lamps.frame.android')}</dt>
                <dd>
                  {rich(t('lamps.frame.androidCall', { id: idText(read.manufacturer.id), n: read.manufacturer.data.length }), { c: (s, k) => <code key={k}>{s}</code> })}
                </dd>
              </div>
              <div className="lp-dl-row">
                <dt>{t('lamps.frame.onAir')}</dt>
                <dd><span className="lp-hex">{spaced(hexOf(airBytes(read.manufacturer)))}</span></dd>
              </div>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
