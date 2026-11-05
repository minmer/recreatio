/**
 * 2026-11-05 — EIN KREIS, DER SICH FÜLLT, solange etwas lädt: mit bekannter Menge der Anteil (und die Zahl in der Mitte),
 * ohne sie ein kreisender Bogen. Die Worte gibt, wer ihn zeigt (`label`, `detail`).
 */

import { fmtNumber, useT } from '../core/i18n';

export function ProgressRing({ done, total, label, detail }: { done: number; total: number | null; label: string; detail?: string }) {
  const t = useT();
  const known = total !== null && total > 0;
  const share = known ? Math.max(0, Math.min(1, done / total)) : 0;
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <div className="ui-ring" role="progressbar" aria-label={label} aria-valuemin={0} {...(known ? { 'aria-valuemax': total, 'aria-valuenow': Math.min(done, total) } : {})} aria-valuetext={detail ?? label}>
      <svg className={`ui-ring-svg${known ? '' : ' is-open'}`} viewBox="0 0 64 64" aria-hidden>
        <circle className="ui-ring-track" cx={32} cy={32} r={R} />
        <circle className="ui-ring-bar" cx={32} cy={32} r={R} strokeDasharray={C.toFixed(2)} strokeDashoffset={(known ? C * (1 - share) : C * 0.72).toFixed(2)} transform="rotate(-90 32 32)" />
        {known && <text className="ui-ring-pct" x={32} y={32} textAnchor="middle" dominantBaseline="central">{fmtNumber(share, { style: 'percent', maximumFractionDigits: 0 }, t.lang)}</text>}
      </svg>
      <span className="ui-ring-label">{label}</span>
      {detail !== undefined && <span className="ui-ring-detail">{detail}</span>}
    </div>
  );
}

export default ProgressRing;
