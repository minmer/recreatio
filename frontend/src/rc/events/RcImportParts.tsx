/**
 * Wgranie części do istniejącej strony.
 *
 * <b>Po co osobno od importu całego wydarzenia.</b> Najczęstszy przypadek to
 * nie „zrób nowe", tylko „dołóż program i koszty jak rok temu". Zmuszanie do
 * założenia wydarzenia od nowa po to, żeby przenieść dwie części, kończy się
 * przepisywaniem ich ręką.
 *
 * <b>Nieznany rodzaj jest WYMIENIONY, nie połknięty.</b> Strona, której brakuje
 * połowy, wygląda na kompletną — a kto ją wgrał, szuka błędu u siebie.
 *
 * <b>Części dziedziczą jawność po STRONIE.</b> Plik może twierdzić, że jego
 * część jest publiczna; gdyby to przeważyło, wgranie na stronę wewnętrzną
 * położyłoby treść jawnie i wystarczyłby adres.
 */

import { useMemo, useState } from 'react';

import { rcAddPart, type RcPartKind } from '../lib/rcEvents';
import { asArray, asOptionalText, asRecord, asText } from './parts/contracts';
import { getPartModule } from './parts/registry';

type Ready = {
  readonly kind: string;
  readonly menuLabel: string | null;
  readonly title: string | null;
  readonly intro: string | null;
  readonly configJson: string | null;
};

type Reading =
  | { readonly ok: true; readonly parts: readonly Ready[]; readonly skipped: readonly string[] }
  | { readonly ok: false; readonly error: string };

/**
 * Czyta listę części — albo obiekt strony, w którym ta lista siedzi.
 *
 * Oba kształty, bo oba się zdarzają: wyeksportowana strona ma `parts`, a
 * skopiowany fragment jest samą tablicą. Odrzucanie drugiego byłoby pedanterią
 * wobec kogoś, kto właśnie zaznaczył to, co chciał.
 */
export function rcReadParts(text: string): Reading {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: 'Nie wklejono niczego.' };

  let parsed: unknown;
  try { parsed = JSON.parse(trimmed); }
  catch { return { ok: false, error: 'To nie jest poprawny JSON.' }; }

  const raw = Array.isArray(parsed) ? parsed : asArray(asRecord(parsed).parts);
  if (raw.length === 0) return { ok: false, error: 'Nie znaleziono żadnej części.' };

  const parts: Ready[] = [];
  const skipped: string[] = [];

  for (const [n, entry] of raw.entries()) {
    const part = asRecord(entry);
    const kind = asText(part.kind).trim();

    if (getPartModule(kind) === null) {
      skipped.push(`Część ${n + 1}: nieznany rodzaj „${kind || '?'}".`);
      continue;
    }

    const config = part.configJson ?? part.config ?? null;

    parts.push({
      kind,
      menuLabel: asOptionalText(part.menuLabel),
      title: asOptionalText(part.title),
      intro: asOptionalText(part.intro),
      configJson: config === null || config === undefined
        ? null
        : typeof config === 'string' ? config : JSON.stringify(config, null, 2)
    });
  }

  if (parts.length === 0) return { ok: false, error: 'Żadnej części nie dało się odczytać.' };

  return { ok: true, parts, skipped };
}

export function RcImportParts({
  pageId, pageLabel, isPublic, onImported, onError
}: {
  pageId: string;
  pageLabel: string;
  isPublic: boolean;
  onImported: () => void;
  onError: (message: string) => void;
}) {
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const reading = useMemo(() => (json.trim() === '' ? null : rcReadParts(json)), [json]);

  const send = async () => {
    if (reading === null || !reading.ok) return;
    setBusy('Wgrywanie…');

    try {
      for (const [n, part] of reading.parts.entries()) {
        setBusy(`Część ${n + 1} z ${reading.parts.length}…`);
        await rcAddPart(pageId, part.kind as RcPartKind, {
          isPublic,
          menuLabel: part.menuLabel ?? undefined,
          title: part.title ?? undefined,
          intro: part.intro ?? undefined,
          configJson: part.configJson ?? undefined
        });
      }
      setJson('');
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Nie udało się wgrać części.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="eva-import">
      <p className="eva-hint">
        Wklej listę części albo całą stronę. Trafią na koniec strony „{pageLabel}"
        {isPublic ? '' : ' i będą zapieczętowane, bo to strona wewnętrzna'}.
      </p>

      <textarea
        rows={7}
        value={json}
        disabled={busy !== null}
        placeholder={'[{ "kind": "text", "menuLabel": "O wydarzeniu" }]'}
        onChange={(e) => setJson(e.target.value)}
      />

      {reading !== null && !reading.ok && <p className="eva-error">{reading.error}</p>}

      {reading !== null && reading.ok && (
        <>
          <p className="eva-hint">Do wgrania: {reading.parts.length} części.</p>

          {/* Co odpadnie, stoi TU — zanim cokolwiek powstanie. */}
          {reading.skipped.length > 0 && (
            <div className="eva-skipped">
              <p>Tego nie da się wgrać:</p>
              <ul>{reading.skipped.map((one) => <li key={one}>{one}</li>)}</ul>
            </div>
          )}

          <button type="button" className="eva-cta" disabled={busy !== null} onClick={() => void send()}>
            {busy ?? 'Wgraj części'}
          </button>
        </>
      )}
    </div>
  );
}

export default RcImportParts;
