/**
 * Was unter einer Adresse steht — holen und schreiben.
 *
 * <b>Nichts davon ist versiegelt.</b> Eine öffentliche Seite wird ohne Konto
 * ausgeliefert; hier gibt es keinen Schlüssel und keine Hülle, und das ist der
 * Unterschied zu allem anderen im Arbeitsplatz.
 */

import type { Layout } from './layout';
import { readConfig } from './module';
import { call } from './session';

/**
 * Ein Baustein, so wie er gespeichert liegt.
 *
 * `layout` und `config` sind ZEICHENKETTEN und keine Objekte: der Dienst legt
 * sie ab, ohne sie zu lesen. Ausgepackt werden sie hier — duldsam, damit ein
 * kaputter Eintrag nur sich selbst leert und nicht die Seite.
 */
export interface PagePart {
  readonly id: string;
  readonly kind: string;
  readonly layout: string;
  readonly config: string | null;

  /**
   * WELCHEN Baustein diese Stelle zeigt (0036).
   *
   * <b>Nicht dasselbe wie `id`.</b> Bis jetzt war es das immer — eine neue
   * Stelle legte einen Baustein unter DERSELBEN Kennung an. Sobald dieselbe
   * Stelle einen VORHANDENEN Baustein zeigt, laufen die beiden auseinander,
   * und dann ist die Kennung des Bausteins die, unter der seine Fragen und
   * seine Antworten hängen.
   *
   * `null` nur bei einer Zeile, die älter ist als 0036.
   */
  readonly moduleId: string | null;
}

export interface PageContent {
  readonly path: string;

  /**
   * Der Pfad, für den diese Seite nur ein zweiter Name ist (0014) — sonst
   * nichts. Menü und Karte gelten für den ECHTEN Pfad; wer hier den
   * Zweitnamen nähme, sähe im Menü keinen Eintrag hervorgehoben.
   */
  readonly aliasOf?: string | null;

  /** `null` heisst: die Adresse ist übernommen, aber noch nichts geschrieben. */
  readonly title: string | null;
  readonly lead: string | null;
  readonly updatedAt: string | null;
  readonly parts: readonly PagePart[];

  /**
   * DIE KARTE DER SEITE (0048) — was wann zu sehen ist, und die Schritte des
   * Bausteins „Kroki osoby". JSON, oder `null`: keine Karte, alles steht da.
   */
  readonly logic?: string | null;

  /** Wer hier handeln darf — auf einer Seite nur mit Zugang (siehe `pageAccess`). */
  readonly access?: PageAccess;

  /**
   * 0054 — DAS MENÜ, das hier gilt: das eigene der Seite oder das der nächsten
   * darüber (`from`), von wo aus seine relativen Ziele gelten.
   */
  readonly menu?: { readonly from: string; readonly items: readonly MenuItem[] } | null;

  /**
   * 0062 — WIE DIE SEITE ERSCHEINT: `page` — Bausteine im Raster, `slides` —
   * jeder Baustein ein Slajd. `theme` ist das Aussehen als JSON (`slides.ts`).
   */
  readonly mode?: 'page' | 'slides';
  readonly theme?: string | null;

  /**
   * 0082 — WOVON DIE SEITE HANDELT („Wybór na stronie"), als JSON — etwa
   * `{"kind":"entry","form":"…"}`: ein Mensch aus diesem Formular. Oben
   * steht dann die Auswahl, und die Bausteine nehmen sie (`pageSubject.tsx`).
   */
  readonly subject?: string | null;
}

/** Ein Eintrag des Menüs (siehe `menu.ts`). */
export interface MenuItem {
  readonly label: string;
  readonly kind: 'abs' | 'rel' | 'url' | 'none';
  readonly target: string;
  readonly children: readonly MenuItem[];
}

/**
 * DER ZUGANG ZU EINER SEITE, wie ihn der Dienst beim Laden nennt.
 *
 * <code>
 *   restricted  die Seite ist nur für Menschen mit Zugang
 *   seats       welche der mitgeschickten Links zu GENAU dieser Seite gehören
 *   roles       welche eigenen Personen die Rolle der Seite halten
 *   manages     dieses Konto führt die Seite
 * </code>
 */
export interface PageAccess {
  readonly restricted: boolean;
  readonly seats?: readonly string[];
  readonly roles?: readonly string[];
  readonly manages?: boolean;
  /** 0073 — die Linkrollen der Links in diesem Browser, die hier Zugang geben. */
  readonly links?: readonly string[];
}

/* Jeder Teil für sich kodiert: ein Schrägstrich TRENNT die Teile und darf
   nicht in einem stehen. `encodeURIComponent` über den ganzen Pfad machte
   daraus `%2F` — der Dienst sähe eine Adresse, die es nicht gibt. */
const encodePath = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

/**
 * Eine Seite holen — mit den Links, die dieser Browser für ihr Haus hält.
 * Auf einer Seite nur mit Zugang entscheiden sie, ob (und für wen) man sie sieht.
 */
/** `links`: die Beweise der Links mit Zugang in diesem Browser (0073, `linkAccess.heldProofs`). */
export const loadPage = (path: string, seats: readonly string[] = [], links: readonly string[] = []): Promise<PageContent> => {
  const query = [
    ...(seats.length === 0 ? [] : [`seats=${encodeURIComponent(seats.join(','))}`]),
    ...(links.length === 0 ? [] : [`links=${encodeURIComponent(links.join(','))}`])
  ];
  return call<PageContent>(`/page/${encodePath(path)}${query.length === 0 ? '' : `?${query.join('&')}`}`);
};

export const savePage = (
  path: string, body: { readonly title: string; readonly lead: string | null }
): Promise<PageContent> =>
  call<PageContent>(`/workspace/page/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

/** 0062 — Seite oder Slajdy, und ihr Aussehen. `theme: null` — automatisch. */
export const savePageLook = (
  path: string, look: { readonly mode: 'page' | 'slides'; readonly theme: string | null }
): Promise<{ mode: string; theme: string | null }> =>
  call(`/workspace/page-look/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify(look)
  });

/** Die Karte der Seite speichern (0048) — als Ganzes; `null` nimmt sie weg. */
export const savePageLogic = (path: string, logic: string | null): Promise<{ saved: boolean }> =>
  call(`/workspace/page-logic/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ logic })
  });

/** 0082 — „Wybór na stronie" speichern; `null` nimmt ihn weg. */
export const savePageSubject = (path: string, subject: string | null): Promise<{ subject: string | null }> =>
  call(`/workspace/page-subject/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ subject })
  });

/** Ein Baustein, wie ihn der Editor hält: ausgepackt. */
export interface DraftPart {
  readonly id: string;

  /** Der Baustein, den diese Stelle zeigt — siehe `PagePart.moduleId`. */
  readonly moduleId: string | null;

  readonly kind: string;
  readonly layout: Layout;
  readonly config: Record<string, string>;
}

/**
 * Vom Gespeicherten zum Bearbeitbaren — duldsam.
 *
 * Was hier ankommt, hat den Dienst als Zeichenkette passiert: er liest es nicht
 * und prüft es nicht. Ein kaputter Eintrag darf deshalb nur sich selbst leeren
 * und nicht den Editor — aus Unlesbarem wird ein Baustein ohne Anordnung, und
 * der landet beim nächsten Öffnen oben links statt nirgends.
 */
export function toDraft(part: PagePart): DraftPart {
  let layout: Layout = {};

  try {
    const parsed: unknown = JSON.parse(part.layout);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      layout = parsed as Layout;
    }
  } catch { /* ohne Anordnung */ }

  return {
    id: part.id,
    moduleId: part.moduleId ?? null,
    kind: part.kind,
    layout,
    config: readConfig(part.config)
  };
}

/**
 * Die ganze Anordnung auf einmal.
 *
 * Wer zieht, schiebt und löscht, ändert nicht einen Baustein, sondern eine
 * Anordnung — deshalb geht sie als Ganzes hinaus und wird in einer Transaktion
 * ersetzt.
 */
export const saveParts = (path: string, parts: readonly DraftPart[]): Promise<{ parts: number }> =>
  call<{ parts: number }>('/workspace/parts', {
    method: 'PUT',
    body: JSON.stringify({
      path,
      parts: parts.map((part) => ({
        id: part.id,
        moduleId: part.moduleId,
        kind: part.kind,
        layout: JSON.stringify(part.layout),
        config: JSON.stringify(part.config)
      }))
    })
  });
