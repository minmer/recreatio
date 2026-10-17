/**
 * Eine Stufe aus wenigen — als EIN Bedienelement.
 *
 * <b>Vorher war die gewählte Stufe ein gefüllter Knopf</b> und die übrigen
 * unterstrichene Verweise: das Gewählte sah aus, als wäre es das, was man
 * drücken soll. Hier ist es ein Feld mit Abteilungen, und die eingeschaltete
 * ist erkennbar eingeschaltet.
 *
 * 2026-10-17 — aus `Areas.tsx` hierher: wer nur das Feld brauchte (eine Rolle
 * auf einer öffentlichen Seite), lud den ganzen Bildschirm der Obszary mit.
 */

export function Segment<T extends string>({ now, options, busy, onPick }: {
  now: T;
  options: readonly { value: T; label: string }[];
  busy: boolean;
  onPick: (value: T) => void;
}) {
  return (
    <div className="wk-seg" role="group">
      {options.map((one) => (
        <button
          key={one.value}
          type="button"
          aria-pressed={one.value === now}
          className={one.value === now ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
          disabled={busy || one.value === now}
          onClick={() => onPick(one.value)}
        >
          {one.label}
        </button>
      ))}
    </div>
  );
}

export default Segment;
