/**
 * Msze i intencje — strona przeglądarki.
 *
 * <b>Msza nie jest osobnym kalendarzem.</b> To wpis kalendarza typu `mass`:
 * czas, powtórzenie i wyjątki umie już kalendarz. Nowe są tylko intencje.
 *
 * <b>Intencja wisi przy WYSTĄPIENIU, nie przy serii.</b> „W dni powszednie o
 * 18:00" to jeden wpis; we wtorek czyta się inną intencję niż w środę. Adresem
 * jest `(itemId, occurrenceAt)`, gdzie `occurrenceAt` to PIERWOTNY początek —
 * ten sam adres, pod którym kalendarz trzyma swoje wyjątki. Msza przesunięta o
 * godzinę nie gubi przez to swoich intencji.
 *
 * <b>Tekst jawny, ofiarodawca nie.</b> Intencję czyta się na głos i drukuje w
 * gazetce; szyfrowanie jej działałoby przeciw celowi. Kto ją zamówił i ile
 * złożył — to już nie wisi w gablocie.
 */

import { rcFetch } from '../lib/rcApi';
import type { RcApi } from '../lib/rcApi';
import { rcOccurrenceKey } from '../lib/rcCalendar';

export type RcPublicMasses = RcApi<'MassRcPublicMassesResponse'>;
export type RcPublicMass = RcApi<'MassPublicMassView'>;
export type RcPublicIntention = RcApi<'MassPublicIntentionView'>;

export type RcIntentions = RcApi<'MassRcIntentionsResponse'>;
export type RcIntention = RcApi<'MassIntentionView'>;

/**
 * Dwa rodzaje intencji — i to nie jest etykieta.
 *
 * <b>single</b>: w jednej mszy może ich być kilka, ale wtedy KAŻDY KAPŁAN ma
 * swoją. Dwie pojedyncze znaczą więc: dwóch kapłanów koncelebruje.
 *
 * <b>collective</b>: jeden kapłan czyta kilka razem.
 *
 * Kto prowadzi obie jako „kilka intencji", nie odpowie już na pytanie, czy
 * potrzebny jest jeszcze jeden kapłan — a właśnie po to jest to rozróżnienie.
 */
export const RC_INTENTION_KINDS = ['single', 'collective'] as const;
export type RcIntentionKind = (typeof RC_INTENTION_KINDS)[number];

export const RC_KIND_LABEL: Record<RcIntentionKind, string> = {
  single: 'pojedyncza',
  collective: 'zbiorowa'
};

/**
 * Plan mszy — bez konta.
 *
 * Plan wisi w gablocie; kto szuka go w sieci, nie powinien się w tym celu
 * logować, a my nie powinniśmy wiedzieć, że zaglądał.
 */
export const rcPublicMasses = (slug: string, from?: Date, to?: Date) => {
  const query = new URLSearchParams();
  if (from !== undefined) query.set('from', from.toISOString());
  if (to !== undefined) query.set('to', to.toISOString());

  const tail = query.toString();
  return rcFetch<RcPublicMasses>(
    `/public/parishes/${encodeURIComponent(slug)}/masses${tail === '' ? '' : `?${tail}`}`);
};

/**
 * Intencje jednej mszy — widok kancelarii, z ofiarodawcą.
 *
 * Adres wystąpienia przechodzi przez `rcOccurrenceKey`: znak plus ze strefy
 * `+00:00` kończy w ścieżce jako `%2B`, a to IIS odrzuca zanim aplikacja to
 * zobaczy — 404 bez śladu w logu.
 */
export const rcIntentions = (itemId: string, occurrenceAt: string) =>
  rcFetch<RcIntentions>(
    `/calendar-items/${encodeURIComponent(itemId)}`
    + `/occurrences/${encodeURIComponent(rcOccurrenceKey(occurrenceAt))}/intentions`,
    { withUnlock: true });

export const rcAddIntention = (
  itemId: string,
  occurrenceAt: string,
  body: {
    text: string;
    kind: RcIntentionKind;
    giver?: string;
    offering?: string;
    celebrantRoleId?: string | null;
  }
) =>
  rcFetch<RcApi<'MassRcIntentionCreatedResponse'>>(
    `/calendar-items/${encodeURIComponent(itemId)}`
    + `/occurrences/${encodeURIComponent(rcOccurrenceKey(occurrenceAt))}/intentions`,
    { body, withUnlock: true });

export const rcUpdateIntention = (
  intentionId: string,
  body: {
    text?: string;
    status?: string;
    ordinal?: number;
    kind?: RcIntentionKind;
    celebrantRoleId?: string | null;
  }
) =>
  rcFetch<RcApi<'MassRcIntentionUpdatedResponse'>>(
    `/mass-intentions/${encodeURIComponent(intentionId)}`, { body, withUnlock: true });

/* -- Godzina i dzień ------------------------------------------------------- */

/**
 * Godzina, tak jak stoi w planie mszy.
 *
 * Bez sekund i bez wiodącego zera przy godzinie: „7:00", nie „07:00:00". Tak
 * pisze się plan na kartce i tak się go czyta.
 */
export function rcHour(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/** Dzień jako klucz — do grupowania mszy pod jedną datą. */
export function rcDayKey(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MONTHS = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
];

/**
 * Nagłówek dnia: „wtorek, 8 września".
 *
 * Bez roku — plan mszy pokazuje najbliższe dni, a rok przy każdej dacie jest
 * szumem. Przy „dziś" i „jutro" nazwa dnia ustępuje słowu, którego się szuka.
 */
export function rcDayLabel(iso: string, today: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  if (rcDayKey(iso) === rcDayKey(today.toISOString())) return 'dziś';

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (rcDayKey(iso) === rcDayKey(tomorrow.toISOString())) return 'jutro';

  return `${WEEKDAYS[at.getDay()]}, ${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/**
 * Pierwsza msza tego dnia albo któregoś z następnych.
 *
 * <b>Po co „albo następnych".</b> Kancelaria przepisuje intencje z kartki
 * ciągiem — a kartka nie kończy się razem z dniem. Po ostatniej mszy wtorku
 * ma iść pierwsza msza środy, nawet jeśli we wtorek było ich siedem, a w
 * środę jest jedna. Zatrzymanie się na granicy dnia znaczyłoby: sięgnij po
 * mysz i przestaw datę — czyli dokładnie to, czego ten tryb ma oszczędzić.
 *
 * Zwraca `-1`, gdy w całym oknie nie ma już nic. To nie jest błąd, tylko
 * koniec: ktoś doszedł do końca tego, co wczytano.
 */
export function rcFirstOnOrAfter(
  masses: readonly RcPublicMass[], dayKey: string
): number {
  for (let i = 0; i < masses.length; i += 1) {
    if (rcDayKey(masses[i].startsUtc) >= dayKey) return i;
  }
  return -1;
}

/**
 * Która to msza w swoim dniu — „2 z 7".
 *
 * Liczone w obrębie DNIA, nie całego okna. „14 z 96" nie mówi nikomu nic;
 * „2 z 7" mówi, ile jeszcze zostało do końca dnia, który się właśnie
 * przepisuje.
 */
export function rcPositionInDay(
  masses: readonly RcPublicMass[], index: number
): { readonly at: number; readonly of: number } {
  if (index < 0 || index >= masses.length) return { at: 0, of: 0 };

  const day = rcDayKey(masses[index].startsUtc);
  const sameDay = masses.filter((m) => rcDayKey(m.startsUtc) === day);
  const before = masses.slice(0, index).filter((m) => rcDayKey(m.startsUtc) === day);

  return { at: before.length + 1, of: sameDay.length };
}

/** Msze zgrupowane po dniach, w kolejności, w jakiej następują. */
export function rcByDay(
  masses: readonly RcPublicMass[]
): readonly { readonly day: string; readonly masses: readonly RcPublicMass[] }[] {
  const days = new Map<string, RcPublicMass[]>();

  for (const mass of masses) {
    const key = rcDayKey(mass.startsUtc);
    if (key === '') continue;

    const found = days.get(key);
    if (found === undefined) days.set(key, [mass]);
    else found.push(mass);
  }

  return [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, list]) => ({ day, masses: list }));
}
