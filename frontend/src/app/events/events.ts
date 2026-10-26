/**
 * 0131 — EIN BEREICH ALS WYDARZENIE (`AreaEvent.cs`).
 *
 * Die Marke zeigt auf Hauptseite und Haupttermin und hält sonst nichts: Titel,
 * Vorspann und Bild stehen auf der Seite, Datum, Ort und Programm im Termin,
 * Menschen, Formulare und Rozmowy im Bereich, wer für die Daten geradesteht in
 * dessen Administrator danych. Listen („Wydarzenia") zeigen Wydarzenia nach einer
 * Regel (diese Bereiche und darunter) und auf Bitte; den Katalog recreatio.pl/events
 * gibt der Betreiber frei, Karte für Karte — eine Änderung an der Karte nimmt die
 * Freigabe zurück.
 */

import { fromBase64Url, openText } from '../core/crypto';
import { API, call } from '../core/session';
import { itemFieldAad } from '../calendar/calendar';
import type { ControllerInfo } from '../areas/controllers';
import { openCard as openProfileCard, type ProfileKind, type SealedCard } from '../areas/profile';

/** Die Adresse des Katalogs — die eigene Seite des Betreibers. */
export const CATALOGUE_PATH = 'events';

export interface EventMark {
  readonly areaId: string;
  readonly slugId: string | null;
  readonly path: string | null;
  readonly itemId: string | null;
  readonly kind: string | null;
  readonly imageId: string | null;
  readonly createdAt: string;
}

export interface AreaEventState {
  readonly areaId: string;
  readonly mark: EventMark | null;
  /** Was noch fehlt, damit Zapisy ruszą. */
  readonly controller: ControllerInfo | null;
  readonly public: boolean;
}

export const loadAreaEvent = (areaId: string): Promise<AreaEventState> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/event`);

/**
 * Markieren oder ändern. `path`: die Hauptseite (eine, die ich führe); `itemId`:
 * ein Termin ohne Wiederholung in einem Kalender des Bereichs; `imageId`: ein Bild
 * der Hauptseite ('' nimmt es weg).
 */
export const setAreaEvent = (areaId: string, mark: { path?: string | null; itemId?: string | null; kind?: string | null; imageId?: string | null }): Promise<{ mark: EventMark | null }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/event`, {
    method: 'POST',
    body: JSON.stringify({ path: mark.path ?? null, itemId: mark.itemId ?? null, kind: mark.kind ?? null, imageId: mark.imageId ?? null })
  });

/** Die Marke abnehmen — der Bereich bleibt, wie er ist. */
export const clearAreaEvent = (areaId: string): Promise<{ mark: null }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/event`, { method: 'POST', body: JSON.stringify({ off: true }) });

/* -- In fremden Listen ------------------------------------------------------------ */

export type ListingState = 'asked' | 'shown' | 'refused';

export const LISTING_WORDS: Record<ListingState, string> = { asked: 'czeka na decyzję', shown: 'pokazane', refused: 'odmówiono' };

export interface Listing {
  readonly moduleId: string;
  readonly state: ListingState;
  readonly askedAt: string;
  readonly decidedAt: string | null;
  readonly path: string | null;
}

export const loadListings = (areaId: string): Promise<{ listings: readonly Listing[] }> =>
  call(`/workspace/event/${encodeURIComponent(areaId)}/listings`);

/** „Pokaż też na…": eine Liste, genannt durch die Adresse ihrer Seite (oder ihren Baustein). */
export const askListing = (areaId: string, where: { path?: string; moduleId?: string }): Promise<{ state: ListingState; catalogue: boolean; moduleId: string }> =>
  call(`/workspace/event/${encodeURIComponent(areaId)}/listing`, { method: 'POST', body: JSON.stringify(where) });

/** Über eine Bitte entscheiden — im Katalog der Betreiber, mit der Bestätigung, dass die Karte keine Daten über Menschen trägt. */
export const decideListing = (areaId: string, moduleId: string, accept: boolean, noPersonalData: boolean): Promise<{ state: ListingState }> =>
  call(`/workspace/listing/${encodeURIComponent(areaId)}/${encodeURIComponent(moduleId)}`, {
    method: 'POST', body: JSON.stringify({ accept, noPersonalData })
  });

/* -- Karten (ohne Konto) ---------------------------------------------------------- */

export interface SealedField {
  readonly field: string;
  readonly areaId: string;
  readonly epoch: number;
  readonly sealed: string;
}

export interface EventCard {
  readonly areaId: string;
  /** 0133 — die Art des Profils (Wydarzenie, Grupa …). */
  readonly type?: ProfileKind;
  /** Das Wort für Filter („rekolekcje"). */
  readonly kind: string | null;
  readonly name: string;
  readonly organiser: string | null;
  readonly page: { readonly path: string; readonly title: string | null; readonly lead: string | null; readonly imageId: string | null };
  /** 0133 — die Wizytówka, versiegelt unter dem Schlüssel ihres (jawnen) Bereichs. */
  readonly card?: SealedCard | null;
  /** 0133 — nach dem Ende: die Seite „po wydarzeniu". */
  readonly after?: { readonly path: string } | null;
  readonly ended?: boolean;
  readonly item: null | {
    readonly id: string; readonly startsAt: string | null; readonly endsAt: string | null; readonly allDay: boolean;
    readonly status: string | null; readonly fields: readonly SealedField[];
  };
  /** Zapisy otwarte — ein Formular nimmt wirklich an. */
  readonly open: boolean;
  readonly via: 'rule' | 'request';
}

export type EventWhen = 'coming' | 'past' | 'all';

export interface EventQuery {
  readonly areas: readonly string[];
  /** 0133 — welche Art von Profil (Vorgabe: Wydarzenia). */
  readonly type?: ProfileKind;
  readonly deep?: boolean;
  readonly kind?: string;
  readonly when?: EventWhen;
  readonly limit?: number;
  /** Der Baustein der Liste — dann auch die, die darin stehen dürfen. */
  readonly module?: string | null;
}

export function loadEvents(q: EventQuery): Promise<{ events: readonly EventCard[]; catalogue: boolean }> {
  const params = new URLSearchParams();
  if (q.areas.length > 0) params.set('areas', q.areas.join(','));
  if (q.deep === false) params.set('deep', '0');
  if (q.kind !== undefined && q.kind.trim() !== '') params.set('kind', q.kind.trim());
  if (q.when !== undefined) params.set('when', q.when);
  if (q.type !== undefined && q.type !== 'event') params.set('type', q.type);
  if (q.limit !== undefined) params.set('limit', String(q.limit));
  if (q.module) params.set('module', q.module);
  return call(`/events?${params.toString()}`);
}

export const loadEvent = (areaId: string): Promise<{ event: EventCard; forms: readonly string[]; controller: ControllerInfo | null }> =>
  call(`/event/${encodeURIComponent(areaId)}`);

/** Das Bild einer Karte (ein Bild der Hauptseite). */
export const eventImageUrl = (imageId: string): string => `${API}/page-image/${encodeURIComponent(imageId)}`;

/* -- Titel und Ort öffnen -------------------------------------------------------- */

const keys = new Map<string, Promise<Uint8Array | null>>();

/** Der offengelegte Schlüssel einer Epoche (`/area/{id}/key?epoch=`). */
const loadPublicKeyAt = (areaId: string, epoch: number): Promise<{ key: string }> =>
  call(`/area/${encodeURIComponent(areaId)}/key?epoch=${epoch}`);

const keyAt = (areaId: string, epoch: number): Promise<Uint8Array | null> => {
  const id = `${areaId}:${epoch}`;
  let found = keys.get(id);
  if (found === undefined) {
    found = loadPublicKeyAt(areaId, epoch).then((k) => fromBase64Url(k.key)).catch(() => null);
    keys.set(id, found);
  }
  return found;
};

export interface CardTexts {
  /** 0133 — der Titel der Wizytówka, sonst der des Haupttermins (`null`: keiner zu öffnen). */
  readonly title: string | null;
  /** 0133 — der Vorspann der Wizytówka (`null`: keine). */
  readonly lead?: string | null;
  readonly location: string | null;
}

/** Titel und Vorspann der Wizytówka, Titel und Ort des Haupttermins — mit den offengelegten Schlüsseln, hier im Browser. */
export async function openCard(card: EventCard): Promise<CardTexts> {
  let title: string | null = null;
  let location: string | null = null;
  const profile = card.card == null ? null : await openProfileCard(card.card, card.areaId, null).catch(() => null);
  for (const f of card.item?.fields ?? []) {
    const key = await keyAt(f.areaId, f.epoch);
    if (key === null) continue;
    try {
      const text = await openText(key, itemFieldAad(card.item!.id, f.field), fromBase64Url(f.sealed));
      if (f.field === 'title') title = text; else if (f.field === 'location') location = text;
    } catch {
      // Nicht offen ausgehängt — dann der Titel der Seite.
    }
  }
  return {
    title: profile !== null && profile.title.trim() !== '' ? profile.title : title,
    lead: profile !== null && profile.lead.trim() !== '' ? profile.lead : null,
    location
  };
}

/** Wann, in Worten: „sob., 14 lis. 2026, 18:00–20:00" — oder `null`. */
export function whenText(item: EventCard['item']): string | null {
  if (item === null || item.startsAt === null) return null;
  const start = new Date(item.startsAt);
  const end = item.endsAt === null ? null : new Date(item.endsAt);
  const day = (d: Date) => d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (item.allDay) {
    if (end === null) return day(start);
    const last = new Date(end.getTime() - 1);
    return last.toDateString() === start.toDateString() ? day(start) : `${day(start)} – ${day(last)}`;
  }
  if (end === null) return `${day(start)}, ${time(start)}`;
  return end.toDateString() === start.toDateString()
    ? `${day(start)}, ${time(start)}–${time(end)}`
    : `${day(start)}, ${time(start)} – ${day(end)}, ${time(end)}`;
}
