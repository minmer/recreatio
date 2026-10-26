/**
 * 0133 — EIN BEREICH MIT EINER ART (`Profiles.cs`): Wydarzenie, Grupa,
 * Parafia / organizacja, Kurs.
 *
 * Ein Bereich bleibt ein Bereich. Die Art fügt ein Profil hinzu — die
 * Wizytówka (Titel und Vorspann, hier versiegelt unter dem Schlüssel des
 * Bereichs, in dem sie veröffentlicht ist), ein Bild, die Hauptseite, eine Seite
 * für die Zeit danach, den Haupttermin, wohin neue Stücke standardmässig gehen —
 * und schaltet Werkzeuge frei (`AreaKindPanel.tsx`).
 *
 * <b>Veröffentlichen je Stück</b>: die Wizytówka, der Haupttermin, die Fragen
 * eines Formulars können je in einem anderen Bereich stehen als die Daten —
 * die Antworten, die Menschen, die Rozmowy bleiben im Bereich. In einen anderen
 * Bereich veröffentlicht nur, wer beide führt (der Dienst prüft es).
 */

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import type { Ring } from '../core/keys';
import { call } from '../core/session';
import { areaKeys, newestKey } from '../chat/chat';
import type { AreaRow } from './area';
import type { ControllerInfo } from './controllers';

/** 0134 — dazu `school` (Klassen, Programme, ihre Verwirklichung) und `class` (Schüler, Stundenplan, Dziennik). */
export type ProfileKind = 'event' | 'group' | 'organisation' | 'course' | 'school' | 'class';

export const PROFILE_KINDS: readonly { readonly kind: ProfileKind; readonly label: string; readonly says: string }[] = [
  { kind: 'event', label: 'Wydarzenie', says: 'Rekolekcje, wyjazd, warsztaty, obóz — strona, zapisy, termin, rozmowy uczestników.' },
  { kind: 'group', label: 'Grupa', says: 'Schola, oaza, rada — członkowie, rozmowa, kalendarz, link dla członków.' },
  { kind: 'organisation', label: 'Parafia / organizacja', says: 'Administrator danych, publiczna strona, listy jej wydarzeń i grup.' },
  { kind: 'course', label: 'Kurs', says: 'Baza wiedzy z powtórkami, uczący się z linku.' },
  { kind: 'school', label: 'Szkoła', says: 'Klasy, programy nauczania raz dla wszystkich i ich realizacja w każdej klasie, nauczyciele.' },
  { kind: 'class', label: 'Klasa', says: 'Uczniowie, plan lekcji, dziennik: program z realizacją i notatkami, obecność, uwagi o uczniach.' }
];

export const kindLabel = (kind: ProfileKind | string): string => PROFILE_KINDS.find((one) => one.kind === kind)?.label ?? kind;

export interface SealedCard {
  readonly areaId: string;
  readonly epoch: number;
  readonly sealed: string;
}

export interface Profile {
  readonly kind: ProfileKind;
  /** Wohin neue Stücke standardmässig gehen; `null`: in den Bereich selbst. */
  readonly publishAreaId: string | null;
  readonly card: SealedCard | null;
  readonly imageId: string | null;
  /** Ein Wort wie „rekolekcje" — für Filter in Listen. */
  readonly category: string | null;
  readonly main: { readonly slugId: string; readonly path: string | null } | null;
  readonly after: { readonly slugId: string; readonly path: string | null } | null;
  readonly itemId: string | null;
  readonly item: {
    readonly startsAt: string | null; readonly endsAt: string | null; readonly allDay: boolean; readonly visibilityAreaId: string | null;
    /** `planned`, `confirmed`, `cancelled` — ein Ändern behält es. */
    readonly status?: string | null;
    readonly calendarId?: string | null;
    readonly ownerRoleId?: string | null;
  } | null;
  readonly archiveMode: 'auto' | 'manual';
  readonly archivedAt: string | null;
  /** Vorbei: archiviert, oder der Haupttermin ist zu Ende. */
  readonly ended: boolean;
  readonly createdAt: string;
}

export interface ProfileState {
  readonly areaId: string;
  readonly profile: Profile | null;
  /** Führe ich den Bereich? */
  readonly admin: boolean;
  readonly controller: ControllerInfo | null;
  /** Ist der Bereich selbst jawny? */
  readonly public: boolean;
  /** Ist der Bereich, in den standardmässig veröffentlicht wird, jawny? */
  readonly publishPublic: boolean;
  /** Formulare, die gerade wirklich annehmen. */
  readonly openForms: readonly string[];
}

export const loadProfile = (areaId: string): Promise<ProfileState> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/profile`);

/** Was fehlt, bleibt; `''` leert es. */
export interface ProfilePatch {
  readonly kind?: ProfileKind;
  readonly publishAreaId?: string;
  readonly card?: SealedCard | { readonly sealed: '' };
  readonly imageId?: string;
  readonly category?: string;
  readonly path?: string;
  readonly afterPath?: string;
  readonly itemId?: string;
  readonly archiveMode?: 'auto' | 'manual';
}

export const saveProfile = (areaId: string, patch: ProfilePatch): Promise<{ profile: Profile | null }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/profile`, { method: 'POST', body: JSON.stringify(patch) });

/** Das Profil abnehmen — der Bereich, seine Seiten, Formulare und Rozmowy bleiben. */
export const removeProfile = (areaId: string): Promise<{ profile: null }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/profile`, { method: 'POST', body: JSON.stringify({ off: true }) });

/** Archivieren (Formulare zu, die Seite danach offen) — oder wieder öffnen. */
export const setArchived = (areaId: string, archived: boolean): Promise<{ profile: Profile | null }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/archive`, { method: 'POST', body: JSON.stringify({ archived }) });

/* -- Die Wizytówka --------------------------------------------------------------- */

export interface CardText {
  readonly title: string;
  readonly lead: string;
}

/** Das Etikett nennt den Bereich des PROFILS — gleich, unter welchem Schlüssel sie liegt: umziehen ändert es nicht. */
export const cardAad = (profileAreaId: string) => aad('area', 'profile', profileAreaId, Field.AreaProfileCard, 1);

/** Die Wizytówka versiegeln — unter dem neuesten Schlüssel des Bereichs, in dem sie veröffentlicht wird. */
export async function sealCard(ring: Ring, profileAreaId: string, cardAreaId: string, text: CardText): Promise<SealedCard> {
  const newest = newestKey(await areaKeys(ring, cardAreaId, true));
  if (newest === null) throw new Error('Nie masz klucza obszaru, w którym ma być widoczna wizytówka.');
  const body = JSON.stringify({ title: text.title.trim(), lead: text.lead.trim() });
  return { areaId: cardAreaId, epoch: newest.epoch, sealed: toBase64Url(await sealText(newest.key, cardAad(profileAreaId), body)) };
}

const published = new Map<string, Promise<Uint8Array | null>>();

/** Der offengelegte Schlüssel einer Epoche (`/area/{id}/key?epoch=`) — für Besucher ohne Konto. */
const publishedKey = (areaId: string, epoch: number): Promise<Uint8Array | null> => {
  const id = `${areaId}:${epoch}`;
  let found = published.get(id);
  if (found === undefined) {
    found = call<{ key: string }>(`/area/${encodeURIComponent(areaId)}/key?epoch=${epoch}`).then((k) => fromBase64Url(k.key)).catch(() => null);
    published.set(id, found);
  }
  return found;
};

/** Die Wizytówka öffnen — mit dem eigenen Schlüssel, sonst dem offengelegten. `null`: nicht für diesen Leser. */
export async function openCard(card: SealedCard, profileAreaId: string, ring: Ring | null): Promise<CardText | null> {
  let key: Uint8Array | null | undefined;
  if (ring !== null) key = (await areaKeys(ring, card.areaId).catch(() => new Map<number, Uint8Array>())).get(card.epoch);
  if (key === undefined || key === null) key = await publishedKey(card.areaId, card.epoch);
  if (key === null) return null;
  try {
    const value = JSON.parse(await openText(key, cardAad(profileAreaId), fromBase64Url(card.sealed))) as Partial<CardText>;
    return { title: typeof value.title === 'string' ? value.title : '', lead: typeof value.lead === 'string' ? value.lead : '' };
  } catch {
    return null;
  }
}

/* -- Wohin veröffentlicht wird --------------------------------------------------- */

/**
 * Wohin ein Stück dieses Bereichs gehen kann: der Bereich selbst, und jeder andere,
 * den ich führe (der Dienst verlangt: beide führen). Jawne zuerst nach ihm.
 */
export function publishChoices(areas: readonly AreaRow[], areaId: string): readonly AreaRow[] {
  const led = areas.filter((a) => a.myLevel === 'admin' && a.personal !== true && a.ownChat == null);
  const self = areas.find((a) => a.areaId === areaId);
  const others = led.filter((a) => a.areaId !== areaId)
    .sort((a, b) => Number(b.publicLevel !== 'none') - Number(a.publicLevel !== 'none') || a.name.localeCompare(b.name, 'pl'));
  return self === undefined ? others : [self, ...others];
}

/** Der Bereich, in den standardmässig veröffentlicht wird: der des Profils, sonst der nächste jawne darüber, den ich führe, sonst er selbst. */
export function defaultPublishArea(areas: readonly AreaRow[], areaId: string): string {
  const byId = new Map(areas.map((a) => [a.areaId, a]));
  let at = byId.get(areaId);
  for (let depth = 0; at !== undefined && depth < 16; depth += 1) {
    if (at.publicLevel !== 'none' && at.myLevel === 'admin') return at.areaId;
    at = at.parentAreaId === null ? undefined : byId.get(at.parentAreaId);
  }
  return areaId;
}

/* -- Was ein Import angelegt hat --------------------------------------------------- */

/** `question`: „formularz#pytanie" → die Frage (eine Kennung im Dokument ist keine Kennung des Dienstes). */
export type ImportKeyKind = 'page' | 'form' | 'appointment' | 'role' | 'chat' | 'link' | 'question';

export interface ImportKey {
  readonly kind: ImportKeyKind;
  readonly key: string;
  readonly refId: string | null;
  readonly refText: string | null;
  readonly updatedAt: string;
}

export const loadImportKeys = (areaId: string): Promise<{ keys: readonly ImportKey[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/import-keys`);

export const saveImportKeys = (
  areaId: string, keys: readonly { kind: ImportKeyKind; key: string; refId?: string | null; refText?: string | null; remove?: boolean }[]
): Promise<{ saved: number }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/import-keys`, { method: 'POST', body: JSON.stringify({ keys }) });

/* -- Öffentlich ------------------------------------------------------------------- */

export interface PublicProfile {
  readonly areaId: string;
  readonly kind: ProfileKind;
  readonly category: string | null;
  /** Der Name des Bereichs — nur, wo das Profil ohnehin zu sehen ist (Wizytówka lesbar oder Hauptseite öffentlich). */
  readonly name: string | null;
  readonly card: SealedCard | null;
  readonly imageId: string | null;
  readonly main: { readonly path: string } | null;
  /** Erst nach dem Ende: die Seite „po wydarzeniu". */
  readonly after: { readonly path: string } | null;
  readonly item: null | {
    readonly id: string; readonly startsAt: string | null; readonly endsAt: string | null; readonly allDay: boolean;
    /** `planned`, `confirmed`, `cancelled`. */
    readonly status?: string | null;
    readonly fields: readonly { readonly field: string; readonly areaId: string; readonly epoch: number; readonly sealed: string }[];
  };
  readonly ended: boolean;
  readonly archived: boolean;
  readonly forms: readonly string[];
  readonly controller: ControllerInfo | null;
}

/** 0134 — die Bereiche gleich darin, mit ihrer Art (die Klassen einer Schule) — die, die ich lese. */
export interface ChildProfile {
  readonly areaId: string;
  readonly kind: ProfileKind | null;
  readonly archivedAt: string | null;
}

export const loadChildren = (areaId: string): Promise<{ areaId: string; children: readonly ChildProfile[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/children`);

export const loadPublicProfile = (areaId: string): Promise<PublicProfile> =>
  call(`/area/${encodeURIComponent(areaId)}/profile`);
