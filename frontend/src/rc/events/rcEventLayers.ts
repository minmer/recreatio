/**
 * Warstwy i kolejność części — czysta część modułu wydarzeń.
 *
 * <b>Wygląd niesie samo wydarzenie.</b> Rajd rowerowy nie ma wyglądać jak
 * rekolekcje, a jedno i drugie stoi na tej samej platformie. Dlatego tło części
 * bierze się z jej własnej konfiguracji, a nie z arkusza platformy — tak samo
 * jak w starym module.
 *
 * <b>Konfiguracja przychodzi jako tekst i może być czymkolwiek.</b> Wpisuje ją
 * człowiek w edytorze, a przechowuje kolumna. Wszystko tutaj musi więc przeżyć
 * pusty tekst, zepsuty JSON i pola, których nie ma — i w każdym z tych
 * przypadków oddać stronę bez tła, a nie stronę bez treści.
 */

import type { RcEventView } from '../lib/rcEvents';

export type RcPartView = NonNullable<RcEventView['pages']>[number]['parts'][number];

/**
 * Części w kolejności czytania — ze wszystkich stron wydarzenia.
 *
 * <b>Kolejność jest zapisana, nie przypadkowa.</b> `sortOrder` decyduje; przy
 * remisie kolejność strony, a na końcu kennung. Lista, która przy każdym
 * wczytaniu układa się inaczej, ma przy drugim otwarciu inne adresy części — a
 * odnośnik do „części 3" wysłany komuś prowadziłby wtedy gdzie indziej.
 *
 * Niewidoczne części wypadają: `isVisible` niesie już decyzję serwera o tym,
 * co wolno pokazać temu czytelnikowi.
 */
export function rcPartsOf(event: RcEventView): readonly RcPartView[] {
  const pages = [...(event.pages ?? [])]
    .filter((page) => page.isVisible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.pageId.localeCompare(b.pageId));

  return pages.flatMap((page) =>
    [...(page.parts ?? [])]
      .filter((part) => part.isVisible !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.partId.localeCompare(b.partId)));
}

/** Jedna warstwa tła, tak jak zapisuje ją edytor. */
type Layer = {
  readonly kind?: string;
  readonly from?: string;
  readonly via?: string;
  readonly to?: string;
  readonly angle?: number;
  readonly color?: string;
  readonly ink?: string;
};

/**
 * Odczytać konfigurację części.
 *
 * Cicha porażka jest tu właściwa: zepsuty JSON w jednej części nie może
 * zabrać całego wydarzenia. Bez tła strona wygląda skromniej i daje się
 * przeczytać — bez treści nie daje się wcale.
 */
function config(part: RcPartView): Record<string, unknown> {
  const raw = (part.configJson ?? '').trim();
  if (raw === '') return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Czy to jest kolor — CAŁY, nie na początku.
 *
 * <b>Sprawdzanie samego początku nie wystarcza.</b> „#fff; background-image:
 * url(...)" zaczyna się jak kolor i całe trafiłoby do `style`. Przeglądarka
 * zwykle odrzuci taką wartość, ale opieranie się na tym znaczy: bezpieczeństwo
 * zależy od tego, jak CSSOM potraktuje śmieci. Wzorzec jest więc zakotwiczony
 * z obu stron i dopuszcza tylko to, co naprawdę jest kolorem.
 *
 * Wartość idzie wprost do atrybutu `style`, a CSS potrafi więcej, niż się
 * wydaje: wczytać obraz z obcego serwera i tym samym zdradzić, kto czyta tę
 * stronę.
 */
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const FUNC = /^(rgb|rgba|hsl|hsla)\([0-9.,%\s/a-z]+\)$/i;

const isColor = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;

  const text = value.trim();
  if (text.length === 0 || text.length > 40) return false;

  return HEX.test(text) || FUNC.test(text);
};

/**
 * Tło i barwa pisma dla części.
 *
 * <b>Tylko wartości, które wyglądają jak kolor.</b> To, co tu wchodzi, trafia
 * wprost do atrybutu `style`; dowolny tekst z bazy byłby wstrzyknięciem CSS —
 * a CSS potrafi więcej, niż się wydaje: wczytać obraz z obcego serwera i tym
 * samym zdradzić, kto czyta tę stronę.
 *
 * Brak konfiguracji daje pusty obiekt, czyli wygląd domyślny. To nie jest
 * awaria, tylko wydarzenie, któremu nikt jeszcze nie nadał barw.
 */
export function rcLayerStyle(part: RcPartView): React.CSSProperties {
  const found = config(part).layers;
  const layers: Layer[] = Array.isArray(found) ? (found as Layer[]) : [];

  const style: Record<string, string> = {};

  for (const layer of layers) {
    if (layer.kind === 'gradient' && isColor(layer.from) && isColor(layer.to)) {
      const angle = Number.isFinite(layer.angle) ? Number(layer.angle) : 160;
      const stops = isColor(layer.via)
        ? `${layer.from}, ${layer.via}, ${layer.to}`
        : `${layer.from}, ${layer.to}`;

      style.background = `linear-gradient(${angle}deg, ${stops})`;
    }

    if (layer.kind === 'solid' && isColor(layer.color)) style.background = layer.color;
    if (isColor(layer.ink)) style.color = layer.ink;
  }

  return style as React.CSSProperties;
}
