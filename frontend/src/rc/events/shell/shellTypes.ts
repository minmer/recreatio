/**
 * Was die Huelle vom Ganzen braucht — und woher es im rc-Modell kommt.
 *
 * <b>Warum es diese Zwischenschicht gibt.</b> Die Huelle und die Teile sind aus
 * dem alten Veranstaltungsmodul uebernommen, weil sie dort gut geloest sind. Sie
 * sprechen ueber `EventSiteHeader` und `EventPage` — Formen, die es im rc-Modell
 * so nicht gibt: dort heisst die Kennung einer Seite `pageId` statt `id`, es gibt
 * kein `themeJson` am Ganzen (das Aussehen sitzt an den Teilen) und keine
 * `places` (der Katalog filtert noch nicht danach).
 *
 * Die Alternative waere gewesen, in dreissig uebernommenen Dateien Feldnamen zu
 * aendern. Das haette jede kuenftige Angleichung an das alte Modul — das noch
 * laeuft und noch gepflegt wird — zu einer Handarbeit gemacht. Ein Uebersetzer
 * an einer Stelle ist billiger als dreissig Abweichungen an dreissig.
 *
 * <b>Was hier NICHT uebersetzt wird.</b> `accessToken`. Im alten Modul war der
 * Link zur internen Seite das Geheimnis; hier liegt Internes unter dem
 * Epochenschluessel des Bereichs und `mayRead` sagt, ob der Leser dazugehoert.
 * Ein Geheimnis, das in einer Adresse steht, steht auch im Verlauf des Browsers.
 */

import type { RcApi } from '../../lib/rcApi';
import type { EventPart } from '../parts/contracts';

type RcEventView = RcApi<'RcEventViewResponse'>;
type RcPageView = RcApi<'EventsPageView'>;

/** Der Kopf: was auf jeder Seite der Veranstaltung gleich bleibt. */
export type ShellSite = {
  slug: string;
  /** Die Seite des Veranstalters — die erste Haelfte der Adresse. */
  collectionSlug: string;
  title: string;
  dateLabel: string | null;
  places: string[];
  themeJson: string | null;
};

/** Eine Seite der Veranstaltung mit ihren Teilen. */
export type ShellPage = {
  id: string;
  slug: string;
  title: string;
  menuLabel: string;
  kind: 'public' | 'internal';
  sortOrder: number;
  parts: EventPart[];
};

/** Nur so viel, wie der Seitenumschalter braucht. */
export type ShellPageRef = {
  slug: string;
  title: string;
  menuLabel: string;
  kind: 'public' | 'internal';
};

/**
 * Ein Datum in einer Zeile, wie es unter dem Titel steht.
 *
 * Ein Tag steht allein; zwei Tage stehen mit Gedankenstrich. Das Jahr faellt am
 * Anfang weg, wenn beide Enden im selben liegen — „5. – 8. Juli 2026" statt
 * derselben Jahreszahl zweimal.
 */
export function rcDateLabel(startsUtc?: string | null, endsUtc?: string | null): string | null {
  const day = (iso: string): Date | null => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const from = startsUtc === null || startsUtc === undefined ? null : day(startsUtc);
  const to = endsUtc === null || endsUtc === undefined ? null : day(endsUtc);

  if (from === null) return null;

  const full = (d: Date) =>
    d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

  if (to === null) return full(from);

  const same = from.getFullYear() === to.getFullYear()
    && from.getMonth() === to.getMonth()
    && from.getDate() === to.getDate();
  if (same) return full(from);

  const short = (d: Date) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
  return from.getFullYear() === to.getFullYear()
    ? `${short(from)} – ${full(to)}`
    : `${full(from)} – ${full(to)}`;
}

/**
 * Eine Seite ist INTERN, wenn kein Teil auf ihr oeffentlich ist.
 *
 * Im alten Modell stand das als eigenes Feld an der Seite. Hier folgt es aus den
 * Teilen, und das ist die ehrlichere Auskunft: eine Seite, auf der ein einziger
 * Teil oeffentlich liegt, IST von aussen zu sehen — sie „intern" zu nennen,
 * weil jemand ein Haekchen so gesetzt hat, waere eine Beschriftung, die von der
 * Sache abweicht.
 *
 * Eine leere Seite gilt als oeffentlich: es gibt nichts zu verbergen, und
 * „intern" an einer leeren Seite liest sich wie eine Warnung ohne Anlass.
 */
export function rcPageKind(page: RcPageView): 'public' | 'internal' {
  const parts = page.parts ?? [];
  return parts.length > 0 && parts.every((p) => !p.isPublic) ? 'internal' : 'public';
}

export function rcShellSite(view: RcEventView): ShellSite {
  return {
    slug: view.slug,
    collectionSlug: view.collectionSlug,
    title: view.title,
    dateLabel: rcDateLabel(view.startsUtc, view.endsUtc),

    /*
     * Noch leer. Der Katalog des alten Moduls filterte nach Orten, und dafuer
     * standen sie strukturiert am Ganzen; im rc-Modell gibt es die Spalte noch
     * nicht. Hier `[]` zu liefern ist ehrlicher, als einen Ort aus dem
     * Kartenteil zu raten — geraten waere er auf dem Plakat gelandet.
     */
    places: [],

    /*
     * Das Aussehen sitzt im rc-Modell an den TEILEN (`rcLayerStyle`), nicht am
     * Ganzen: ein Rad-Rallye soll nicht aussehen wie Exerzitien, aber auch
     * nicht jede seiner Seiten gleich.
     */
    themeJson: null
  };
}

export function rcShellPage(page: RcPageView): ShellPage {
  const kind = rcPageKind(page);
  return {
    id: page.pageId,
    slug: page.slug,
    title: page.title,
    menuLabel: page.title,
    kind,
    sortOrder: page.sortOrder,
    parts: page.parts ?? []
  };
}

/**
 * Die Seiten, die dem Leser offenstehen — in ihrer Reihenfolge.
 *
 * Unsichtbare Seiten fallen weg. Sie stehen in der Antwort, weil der Herausgeber
 * sie braucht; im Umschalter waeren sie Tueren, die nicht aufgehen.
 */
export function rcShellPages(view: RcEventView): ShellPageRef[] {
  return [...(view.pages ?? [])]
    .filter((p) => p.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ slug: p.slug, title: p.title, menuLabel: p.title, kind: rcPageKind(p) }));
}
