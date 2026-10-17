/**
 * Was der Arbeitsplatz vom Dienst holt.
 *
 * EINE Adresse für alle Kacheln (`GET /workspace`). Vier Abfragen wären vier
 * Ladezustände auf einem Bild, und drei davon sähen nach Fehlern aus, solange
 * die vierte läuft.
 */

import { call } from '../core/session';

/** Eine Rolle dieses Kontos. Der Anzeigename ist versiegelt — hier steht die Art. */
export interface RoleCard {
  readonly id: string;
  readonly kind: 'account' | 'person' | 'role' | 'group';

  /** Das KONTO selbst (0040). Es hält nur Personen und bekommt nichts. */
  readonly isPersonal: boolean;

  /** Wie weit unter dem Konto: 1 sind die Personen, die es selbst hält. */
  readonly depth: number;
}

/**
 * Wer etwas übernehmen kann — eine Adresse, eine Seite. Alle meine Rollen
 * AUSSER dem Konto: der Dienst lehnt es ohnehin ab, und eine Auswahl, die
 * mit einer Absage endet, ist eine Falle.
 */
export const takers = (roles: readonly RoleCard[]): readonly RoleCard[] =>
  roles.filter((role) => !role.isPersonal);

/**
 * Die Art, solange der Name versiegelt ist. EINE Stelle — vorher stand
 * dieselbe Liste dreimal, und „Twoja rola osobista" hiess dort, was jetzt
 * das Konto ist.
 */
export const kindName = (role: RoleCard): string =>
  role.isPersonal ? 'Konto'
  : role.kind === 'role' ? 'Rola'
  : role.kind === 'group' ? 'Grupa'
  : role.depth === 1 ? 'Ty'
  : 'Osoba';

/**
 * Eine Adresse, die eine meiner Rollen führt.
 *
 * `aliasOf` und `host` sind die zweiten Wege hierher. Der Dienst schickt sie
 * als `null`, wenn es keinen gibt — dieser Dienst lässt Nullen stehen, anders
 * als der Altbestand, wo ein leeres Feld schlicht fehlt.
 */
export interface PageCard {
  readonly path: string;
  readonly roleId: string;
  readonly claimedAt: string;

  /** Worauf dieser Eintrag zeigt — `null`, wenn er selbst die Seite ist. */
  readonly aliasOf: string | null;

  /** Eine eigene Domain, die hierher zeigt, oder `null`. */
  readonly host: string | null;

  /** 0082 — „Wybór na stronie" (JSON, `pageSubject.tsx`) — oder `null`. */
  readonly subject?: string | null;

  /** NUR MIT ZUGANG (0051): die Bereiche, an die die Seite gebunden ist. Leer heisst öffentlich. */
  readonly accessAreaIds?: readonly string[];

  /** 0106 — der Titel der Seite (`null`: noch keiner). */
  readonly title: string | null;
}

/**
 * 0106 — EINE SEITE, AUF DER DIESES KONTO ARBEITET, OHNE SIE ZU FÜHREN:
 * `area` — nur mit Zugang, für einen Bereich, den es liest (die Seite der
 * Animatoren); `seat` — die Seite seines eigenen Links (der Kandydat mit Konto).
 */
export interface OpenPageCard {
  readonly path: string;
  readonly title: string | null;
  readonly why: 'area' | 'seat';
}

export interface Desk {
  readonly roles: readonly RoleCard[];
  readonly pages: readonly PageCard[];

  /** 0106 — die Seiten, auf denen dieses Konto arbeitet, ohne sie zu führen. */
  readonly open: readonly OpenPageCard[];
}

/**
 * 0106 — FÜHRT DIESES KONTO KEINE SEITE (ein Animator, ein Kandydat mit Konto),
 * arbeitet es auf vorbereiteten Seiten: der Warsztat zeigt zuerst sie, und
 * nicht das Anlegen von Seiten und Formularen, mit denen es nichts anfangen kann.
 */
export const leadsNoPage = (desk: Pick<Desk, 'pages'>): boolean => desk.pages.every((one) => one.aliasOf !== null);

export const loadDesk = (): Promise<Desk> => call<Desk>('/workspace');

/**
 * Eine Adresse übernehmen.
 *
 * Drei Angaben, und die dritte ist die, die man leicht vergisst: NICHT ich
 * werde verantwortlich, sondern eine meiner Rollen. Ein Mensch geht, ein Amt
 * bleibt — und die Adresse wandert mit dem Amt.
 */
/**
 * Was der Dienst auf ein Übernehmen antwortet — und das ist NICHT die ganze
 * Karte.
 *
 * `host` steht hier absichtlich nicht, denn die Antwort enthält es nicht. Sie
 * als <see cref="PageCard"/> auszugeben hiesse, ein Feld zu versprechen, das
 * zur Laufzeit `undefined` ist: der Übersetzer liesse `page.host` durch, und
 * gefunden würde es erst auf dem Bild. Wer die ganze Zeile braucht, lädt den
 * Arbeitsplatz neu — dort kommt sie vollständig.
 */
export interface Claimed {
  readonly path: string;
  readonly roleId: string;
  readonly claimedAt: string;
}

export const claimSlug = (path: string, code: string, roleId: string): Promise<Claimed> =>
  call<Claimed>('/workspace/slug/claim', {
    method: 'POST',
    body: JSON.stringify({ path, code, roleId })
  });

/**
 * Einen Alias erklären — einen zweiten Weg auf eine Seite, die ich führe.
 *
 * Kein Code, weil nichts zu vergeben ist: die Zeile ist von Anfang an vergeben,
 * an eine Rolle, die das Ziel schon führt.
 */
export const declareAlias = (
  path: string, target: string, roleId: string
): Promise<Claimed & { readonly aliasOf: string }> =>
  call<Claimed & { readonly aliasOf: string }>('/workspace/alias', {
    method: 'POST',
    body: JSON.stringify({ path, target, roleId })
  });

/**
 * Eine Unteradresse umhängen — mitsamt allem darunter.
 *
 * <b>Der Inhalt zieht nicht um.</b> Text, Bausteine und Formularfelder hängen
 * an der Kennung, nicht am Pfad; was sich ändert, ist die Adresse. Verweise
 * (`alias_of`) ziehen mit, sonst zeigten sie danach ins Leere.
 */
export const moveSlug = (
  path: string, newPath: string
): Promise<{ path: string; moved: number | false }> =>
  call('/workspace/slug/move', {
    method: 'POST',
    body: JSON.stringify({ path, newPath })
  });

/** WER EINE SEITE ÖFFNEN DARF — die Bereiche (0051). Leer macht sie öffentlich. */
export const setPageAreas = (path: string, areaIds: readonly string[]): Promise<{ path: string; areaIds: string[] }> =>
  call('/workspace/slug/areas', {
    method: 'POST',
    body: JSON.stringify({ path, areaIds })
  });

/** Eine eigene Domain anhängen — oder sie abnehmen (`host` = `null`). */
export const bindDomain = (path: string, host: string | null): Promise<{ path: string; host: string | null }> =>
  call('/workspace/domain', {
    method: 'POST',
    body: JSON.stringify({ path, host })
  });
