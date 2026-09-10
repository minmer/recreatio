/**
 * Wspólnoty parafialne — dostęp do usługi i reguły, które da się policzyć.
 *
 * <b>Dlaczego reguły stoją tutaj, a nie w komponencie.</b> Grupa ma dwie
 * widoczności — aushang i wnętrze — i cztery stany dostępu (członek, zarządca,
 * obcy, zamknięty). To się mnoży: który przycisk pokazać, co napisać, gdzie
 * prowadzi odnośnik. Policzone w JSX byłoby to szesnaście gałęzi rozsypanych
 * po pliku, a pomyłka wyglądałaby jak zwykły widok.
 *
 * <b>Klucze są po stronie usługi, nie tutaj.</b> Przeglądarka NIE odszyfrowuje
 * notatki wewnętrznej: robi to serwis, bo tylko on ma klucz epoki, i przysyła
 * albo tekst, albo powód, dla którego się nie dało. Tu rozstrzyga się jedynie,
 * jak to nazwać.
 */

import { rcFetch, type RcApi } from '../lib/rcApi';

export type RcGroup = RcApi<'RcParishGroupView'>;
export type RcGroupOne = RcApi<'RcParishGroupResponse'>;
export type RcGroups = RcApi<'RcParishGroupsResponse'>;
export type RcPublicGroups = RcApi<'RcPublicParishGroupsResponse'>;
export type RcPublicGroup = RcApi<'RcPublicParishGroupView'>;

/* -- Usługa ---------------------------------------------------------------- */

export const rcGroups = (parishId: string) =>
  rcFetch<RcGroups>(`/parishes/${parishId}/groups`, { withUnlock: true });

export const rcGroup = (groupId: string) =>
  rcFetch<RcGroupOne>(`/groups/${groupId}`, { withUnlock: true });

/**
 * Aushang bez konta.
 *
 * Osobne wywołanie, a nie „to samo bez klucza": ta lista jest widoczna dla
 * kogoś, kto dopiero szuka wspólnoty. Gdyby szła tą samą drogą co lista
 * wewnętrzna, wymagałaby zalogowania — a wtedy nie zobaczyłby jej właśnie ten,
 * dla kogo wisi.
 */
export const rcPublicGroups = (parishSlug: string) =>
  rcFetch<RcPublicGroups>(`/public/parishes/${encodeURIComponent(parishSlug)}/groups`);

export interface RcNewGroup {
  readonly personRoleId: string;
  readonly slug: string;
  readonly name: string;
  readonly summary?: string | null;
  readonly meets?: string | null;
  readonly isPublic?: boolean;
  readonly note?: string | null;
}

export const rcCreateGroup = (parishId: string, group: RcNewGroup) =>
  rcFetch<RcApi<'RcParishGroupCreatedResponse'>>(`/parishes/${parishId}/groups`, {
    body: {
      personRoleId: group.personRoleId,
      slug: group.slug,
      name: group.name,
      summary: group.summary ?? null,
      meets: group.meets ?? null,
      isPublic: group.isPublic ?? true,
      note: group.note ?? null
    },
    withUnlock: true
  });

export interface RcGroupEdit {
  readonly name?: string;
  readonly summary?: string;
  readonly meets?: string;
  readonly isPublic?: boolean;
  readonly note?: string;
  /**
   * Wyczyścić notatkę.
   *
   * Osobne pole, bo `note: ''` znaczy „nie ruszaj", a nie „skasuj". Bez tego
   * rozróżnienia formularz, który wysyła samą nazwę, kasowałby notatkę przy
   * okazji — i nikt by nie wiedział, kiedy zniknęła.
   */
  readonly clearNote?: boolean;
  readonly lifecycle?: 'active' | 'archived';
}

export const rcSaveGroup = (groupId: string, edit: RcGroupEdit) =>
  rcFetch<RcApi<'RcParishGroupSavedResponse'>>(`/groups/${groupId}`, {
    body: {
      name: edit.name ?? null,
      summary: edit.summary ?? null,
      meets: edit.meets ?? null,
      isPublic: edit.isPublic ?? null,
      note: edit.note ?? null,
      clearNote: edit.clearNote ?? null,
      lifecycle: edit.lifecycle ?? null
    },
    withUnlock: true
  });

/* -- Reguły ---------------------------------------------------------------- */

/**
 * Adres wspólnoty: małe litery, cyfry, myślniki.
 *
 * Ta sama zasada co przy wydarzeniu i parafii — i ten sam powód: adres wisi w
 * odnośnikach, które ktoś przepisze z kartki.
 */
export function rcGroupSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Słowa, które w adresie znaczą czynność, nie nazwę.
 *
 * Ta sama lista co w usłudze (`RcParishGroups.ReservedSlugs`). Stoi w dwóch
 * miejscach, bo formularz ma powiedzieć DLACZEGO, zanim ktoś kliknie — ale
 * rozstrzyga usługa: formularz nie jest zaporą.
 */
export const RC_GROUP_RESERVED: readonly string[] = ['new', 'edit'];

/** Co blokuje założenie wspólnoty — albo `null`, gdy nic. */
export function rcGroupBlocker(
  name: string, slug: string, taken: readonly string[]
): string | null {
  if (name.trim() === '' && slug === '') return 'Wpisz nazwę i adres.';
  if (name.trim() === '') return 'Wpisz nazwę.';
  if (slug === '') return 'Wpisz adres (slug).';
  if (rcGroupSlug(slug) !== slug) return 'Adres: małe litery, cyfry i myślniki.';
  if (RC_GROUP_RESERVED.includes(slug)) return `„${slug}" w adresie oznacza działanie, nie nazwę.`;
  if (taken.includes(slug)) return 'Ten adres jest już zajęty w tej parafii.';
  return null;
}

/**
 * Stan notatki wewnętrznej — trzy przypadki, nie dwa.
 *
 * <b>To jest miejsce, w którym łatwo skasować cudzą pracę.</b> „Nie ma
 * notatki" i „jest notatka, której nie otworzysz" wyglądają w formularzu tak
 * samo: puste pole. Kto zapisze na tym pustym polu, nadpisze coś, czego nigdy
 * nie widział — i nikt się nie dowie, co tam stało.
 *
 * Dlatego `sealed` jest osobnym stanem, a formularz go NIE pozwala nadpisać.
 *
 * Pole `noteUnreadable` bywa w odpowiedzi NIEOBECNE, a nie `null`: usługa nie
 * wypisuje pustych pól. Porównanie `!== null` dałoby tu „zapieczętowane" dla
 * każdej wspólnoty — dokładnie ten błąd zjadł kiedyś cały terminarz.
 */
export type RcNoteState =
  | { readonly kind: 'none' }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'sealed'; readonly reason: string };

export function rcNoteState(group: {
  readonly note?: string | null;
  readonly noteUnreadable?: string | null;
}): RcNoteState {
  const reason = group.noteUnreadable ?? null;
  if (reason !== null) return { kind: 'sealed', reason };

  const text = group.note ?? '';
  return text === '' ? { kind: 'none' } : { kind: 'text', text };
}

/**
 * Co ten człowiek może z tą wspólnotą zrobić.
 *
 * Jedna funkcja zamiast czterech `&&` rozsianych po widoku. Kolejność ma
 * znaczenie: zarządca parafii NIE jest członkiem wspólnoty — widzi ją i może
 * ją zmienić, ale nie należy do niej. Zlanie tych dwóch rzeczy pokazałoby mu
 * „moje wspólnoty" pełne cudzych.
 */
export type RcGroupStance = {
  readonly member: boolean;
  readonly admin: boolean;

  /**
   * Czy trzyma URZĄD wspólnoty (rc_0037).
   *
   * To NIE to samo co `admin`: zarządca parafii może zmieniać wspólnotę,
   * nie prowadząc jej. Zlanie tych dwóch rzeczy wpisałoby kancelarii
   * dwadzieścia cudzych wspólnot do „prowadzę".
   */
  readonly leading: boolean;

  /** Czy w ogóle otworzy wnętrze: czat, kalendarz, zadania. */
  readonly inside: boolean;
  /** Czy może zapraszać — link niesie klucz, więc to nie jest drobiazg. */
  readonly mayInvite: boolean;

  /**
   * Czy może PRZEKAZAĆ prowadzenie.
   *
   * Link z urzędem oddaje całą wspólnotę — kto go otworzy, prowadzi ją.
   * Dlatego może go wystawić tylko ten, kto już nią zarządza.
   */
  readonly mayHandOver: boolean;
};

export function rcGroupStance(group: {
  readonly mine: boolean;
  readonly mayAdmin: boolean;
  readonly leading?: boolean;
}): RcGroupStance {
  return {
    member: group.mine,
    admin: group.mayAdmin,

    /*
     * Pole `leading` bywa w odpowiedzi NIEOBECNE, nie `false` — usługa nie
     * wypisuje pustych pól. `?? false` jest tu jedyną poprawną lekturą.
     */
    leading: group.leading ?? false,

    inside: group.mine || group.mayAdmin,
    mayHandOver: group.mayAdmin,

    /*
     * ZAPRASZA TYLKO ZARZĄDCA.
     *
     * Link zawiera klucz roli członkowskiej — kto go rozsyła, rozdaje dostęp
     * do wszystkiego, co wspólnota napisała od swojej epoki. Gdyby mógł to
     * każdy członek, o składzie wspólnoty nie decydowałby nikt.
     */
    mayInvite: group.mayAdmin
  };
}

/**
 * Czego brakuje wspólnocie, żeby wyglądała na stronie parafii.
 *
 * <b>Po co to liczyć osobno.</b> Wspólnota zakłada się w pół minuty: nazwa,
 * adres, gotowe. Opis i godzina spotkań są nieobowiązkowe — i właśnie
 * dlatego zostają puste. W gablocie wisi wtedy sama nazwa, co dla kogoś, kto
 * szuka wspólnoty, nie jest żadną informacją.
 *
 * Zwraca NAZWY pól, nie liczbę: „uzupełnij 2 rzeczy" każe szukać, „brakuje
 * opisu i godzin" mówi, co zrobić.
 *
 * Wspólnota schowana ze strony (`isPublic === false`) niczego nie potrzebuje
 * — nie wisi nigdzie, więc nie ma czego uzupełniać. Zgłaszanie jej braków
 * byłoby wyrzutem za decyzję, którą ktoś podjął świadomie.
 */
export function rcPublicInfoMissing(group: {
  readonly summary?: string | null;
  readonly meets?: string | null;
  readonly isPublic: boolean;
}): readonly string[] {
  if (!group.isPublic) return [];

  const missing: string[] = [];
  if ((group.summary ?? '').trim() === '') missing.push('opis');
  if ((group.meets ?? '').trim() === '') missing.push('godziny spotkań');
  return missing;
}

/**
 * Podział listy na „moje" i „pozostałe", z zachowaniem kolejności.
 *
 * Wspólnota archiwalna spada na koniec i nie miesza się z żywymi — ale NIE
 * znika: ktoś jej szuka właśnie dlatego, że pamięta, że była.
 */
export function rcSortGroups(groups: readonly RcGroup[]): {
  readonly mine: readonly RcGroup[];
  readonly others: readonly RcGroup[];
  readonly archived: readonly RcGroup[];
} {
  const mine: RcGroup[] = [];
  const others: RcGroup[] = [];
  const archived: RcGroup[] = [];

  for (const group of groups) {
    if (group.lifecycle === 'archived') archived.push(group);
    else if (group.mine) mine.push(group);
    else others.push(group);
  }

  return { mine, others, archived };
}

/** Jak podpisać liczbę członków po polsku. */
export function rcMemberCount(n: number): string {
  if (n === 1) return '1 osoba';

  const last = n % 10;
  const teens = n % 100;

  return teens >= 12 && teens <= 14 ? `${n} osób`
    : last >= 2 && last <= 4 ? `${n} osoby`
    : `${n} osób`;
}
