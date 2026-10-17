/**
 * 0082 — „TAK BYŁO → TAK BĘDZIE": eine Liste zum Abhaken, was in die eine Form
 * gebracht wird (Telefon, Adresse). Was der Zerleger nicht sicher wusste,
 * steht mit „sprawdź" da und ist zunächst nicht angehakt. Dieselbe Liste in der
 * Kanzlei eines Formulars und im Durchgang über die ganze Datenbank.
 */

export interface TidyItem {
  readonly key: string;
  readonly before: string;
  readonly after: string;
  readonly doubt: boolean;

  /** Wo es steht — im Durchgang über alles (Formular, Administrator danych). */
  readonly where?: string;
}

export function TidyList({ items, skipped, busy, onToggle }: {
  items: readonly TidyItem[];
  skipped: ReadonlySet<string>;
  busy: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <ul className="wk-tidy-list">
      {items.map((one) => (
        <li key={one.key} className={one.doubt ? 'wk-tidy-row is-doubt' : 'wk-tidy-row'}>
          <label>
            <input type="checkbox" checked={!skipped.has(one.key)} disabled={busy} onChange={() => onToggle(one.key)} />
            <span className="wk-tidy-text">
              {one.where !== undefined && <span className="wk-tidy-where">{one.where}</span>}
              <span className="wk-tidy-before">{one.before}</span>
              <span className="wk-tidy-arrow" aria-hidden="true">→</span>
              <span className="wk-tidy-after">{one.after}</span>
              {one.doubt && <span className="wk-tag wk-tag-warn">sprawdź</span>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Ein Haken an oder aus — für `setSkipped`. */
export const toggled = (was: ReadonlySet<string>, key: string): ReadonlySet<string> => {
  const next = new Set(was);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
};
