/**
 * EIN PAKET, AUFGESCHLÜSSELT — unter jedem Feld für Hex (Sygnał, Odczyt z
 * pilota): wie viele Bytes, welche AD-Strukturen, Kennung und Daten des
 * Herstellers, und genau das, worum Android gebeten wird und was dann in der
 * Luft steht. Was nicht geht, steht da, statt still geändert zu werden.
 */

import { adName, airBytes, asciiOf, hexOf, idText, LEGACY_MAX, readFrame, spaced } from './adv';

export function FrameView({ hex, compact = false }: { hex: string; compact?: boolean }) {
  const read = readFrame(hex);
  if (read.hex === '') return null;
  const adv = read.advertising;
  const used = adv === null ? Math.floor(read.hex.length / 2) : adv.bytes.length - adv.padding;

  return (
    <div className="lp-view" aria-live="polite">
      <p className="lp-view-size">
        <strong>{used}</strong> {used === 1 ? 'bajt' : 'bajtów'} z {LEGACY_MAX}
        {adv !== null && adv.manufacturer !== null && <> · producent <strong>{idText(adv.manufacturer.id)}</strong></>}
        {read.problem === null && <> · <span className="lp-ok">da się nadać</span></>}
      </p>
      {read.problem !== null && <p className="wk-error">{read.problem}</p>}
      {adv !== null && adv.problems.slice(1).map((p) => <p key={p} className="wk-error">{p}</p>)}
      {adv !== null && adv.notes.map((n) => <p key={n} className="wk-working">{n}</p>)}

      {!compact && adv !== null && adv.structures.length > 0 && (
        <dl className="lp-dl">
          {adv.structures.map((s) => (
            <div key={s.offset} className="lp-dl-row">
              <dt>{`Bajt ${s.offset + 1}`}</dt>
              <dd>
                <span className="lp-hex">{spaced(hexOf(new Uint8Array([s.length, s.type])))}</span> {adName(s.type)} · {s.length - 1} {s.length - 1 === 1 ? 'bajt' : 'bajtów'} danych
              </dd>
            </div>
          ))}
          {read.manufacturer !== null && (
            <>
              <div className="lp-dl-row">
                <dt>Dane producenta</dt>
                <dd>
                  <span className="lp-hex">{spaced(hexOf(read.manufacturer.data))}</span>
                  <span className="lp-ascii" title="Znaki ASCII w danych">{asciiOf(read.manufacturer.data)}</span>
                </dd>
              </div>
              <div className="lp-dl-row">
                <dt>Android</dt>
                <dd>
                  <code>addManufacturerData({idText(read.manufacturer.id)}, {read.manufacturer.data.length} B)</code>, bez nazwy, flag i mocy nadawania
                </dd>
              </div>
              <div className="lp-dl-row">
                <dt>W powietrzu</dt>
                <dd><span className="lp-hex">{spaced(hexOf(airBytes(read.manufacturer)))}</span></dd>
              </div>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
