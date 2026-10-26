/**
 * Was unter einer Adresse steht — holen und schreiben.
 *
 * <b>Offen, ausser die Seite ist versiegelt.</b> Eine öffentliche Seite wird
 * ohne Konto ausgeliefert; hier gibt es keinen Schlüssel und keine Hülle.
 * 0121 — eine Seite NUR MIT ZUGANG darf versiegelt sein: dann kommt sie hier
 * als Hüllen an und geht als Hüllen hinaus (`pageSeal.ts`). Alles dazwischen —
 * Editor, Anzeige, JSON — sieht sie offen, als wäre nichts.
 */

import type { Layout } from './layout';
import { readConfig } from '../modules/module';
import { call, WorkspaceError } from '../core/session';
import type { Aad } from '../core/crypto';
import type { PageKey, PageSealInfo } from './pageSeal';
import type { PageResponsible } from '../areas/controllers';

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

  /** 0133 — nur für die Menschen dieses Bereichs (der Dienst schickt den Baustein sonst nicht); fehlt: für alle. */
  readonly audienceAreaId?: string | null;

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
   * 0099 — DIESES KONTO DARF DIE SEITE BEARBEITEN (es führt sie). Dann steht
   * oben „Edytuj stronę".
   */
  readonly editable: boolean;

  /**
   * 0054 — DAS MENÜ, das hier gilt: das eigene der Seite oder eines, das sie
   * von einer anderen Seite holt (0056, `from`: von wo aus seine relativen
   * Ziele gelten). Geerbt wird nicht (0058).
   */
  readonly menu?: { readonly from: string; readonly items: readonly MenuItem[] } | null;

  /**
   * 0062 — WIE DIE SEITE ERSCHEINT: `page` — Bausteine im Raster, `slides` —
   * jeder Baustein ein Slajd; 0085 `presentation` — Szenen, auf denen die
   * Bausteine frei stehen. `theme` ist das Aussehen als JSON (`slides.ts`,
   * die Szenen darin unter "show" — `presentation.ts`).
   */
  readonly mode?: PageMode;
  readonly theme?: string | null;

  /**
   * 0082 — WOVON DIE SEITE HANDELT („Wybór na stronie"), als JSON — etwa
   * `{"kind":"entry","form":"…"}`: ein Mensch aus diesem Formular. Oben
   * steht dann die Auswahl, und die Bausteine nehmen sie (`pageSubject.tsx`).
   */
  readonly subject?: string | null;

  /** 0121 — die Kennung der Seite (bei einem Alias: die seines Ziels); sie steht in jedem Etikett einer Hülle. */
  readonly id?: string;

  /** 0121 — VERSIEGELT: die Hüllen des Seitenschlüssels. Fehlt es, ist die Seite offen. */
  readonly seal?: PageSealInfo | null;

  /**
   * 0121 — versiegelt, und dieser Browser hat keinen Schlüssel dazu: Titel,
   * Inhalt und Menü sind leer. Die Oberfläche sagt das, statt „nic tu nie ma".
   */
  readonly locked?: boolean;

  /**
   * 0129 — WER FÜR DIE SEITE GERADESTEHT: der Bereich, den sie (oder die nächste
   * darüber, `fromPath`) nennt, und sein Administrator danych. `null`: niemand —
   * eine öffentliche Seite lässt sich dann nicht speichern.
   */
  readonly responsible?: PageResponsible | null;
}

/** Die drei Arten einer Seite (0062, 0085). */
export type PageMode = 'page' | 'slides' | 'presentation';

export const PAGE_MODES: readonly PageMode[] = ['page', 'slides', 'presentation'];

/** Was der Dienst nennt — duldsam: was keine der drei ist, ist eine Seite mit Bausteinen. */
export const pageModeOf = (value: unknown): PageMode =>
  value === 'slides' || value === 'presentation' ? value : 'page';

/** Ein Eintrag des Menüs (siehe `menu.ts`). */
export interface MenuItem {
  readonly label: string;
  readonly kind: 'abs' | 'rel' | 'url' | 'none';
  readonly target: string;
  readonly children: readonly MenuItem[];
  /**
   * 2026-10-21 — EIN BILD STATT DES NAMENS (ein Logo): ein Bild der Seite
   * (`page-image:<id>`), https oder ein eigener Pfad (`/logo.svg`). Der Name
   * bleibt — er ist, was ein Bildschirmleser vorliest.
   */
  readonly image?: string;
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

/* -- 0121: der Schlüssel einer versiegelten Seite, solange sie offen ist ------------------------------ */

/** Je ECHTEM Pfad (bei einem Alias: der seines Ziels) der Schlüssel der Seite, wie sie zuletzt geladen wurde. */
const pageKeys = new Map<string, PageKey>();

/** Der Schlüssel dieser Seite in diesem Tab — `null`: offen, oder (noch) nicht geladen. */
export const pageKeyOf = (path: string): PageKey | null => pageKeys.get(path) ?? null;

type SealModule = typeof import('./pageSeal');

/** Das Stück zum Versiegeln — erst geladen, wenn es eine versiegelte Seite gibt (fast jeder Besucher braucht es nie). */
let sealModule: Promise<SealModule> | null = null;
const sealing = (): Promise<SealModule> => (sealModule ??= import('./pageSeal'));

/** Bei der Abmeldung: nichts davon gehört dem Nächsten. */
export function forgetLoadedPageKeys(): void {
  pageKeys.clear();
  if (sealModule !== null) void sealModule.then((m) => m.forgetPageKeys()).catch(() => undefined);
}

/**
 * EINE GELADENE SEITE, wie die Oberfläche sie braucht: offen. Eine versiegelte
 * wird hier geöffnet (das Stück dafür lädt erst, wenn es eine gibt) und ihr
 * Schlüssel gemerkt — das Speichern versiegelt damit wieder.
 */
export async function openLoadedPage(raw: PageContent): Promise<PageContent> {
  const real = raw.aliasOf ?? raw.path;
  if (raw.seal == null) {
    pageKeys.delete(real);
    return raw;
  }
  const { openPageContent } = await sealing();
  const { content, key } = await openPageContent(raw);
  if (key !== null) pageKeys.set(real, key);
  else pageKeys.delete(real);
  return content;
}

/**
 * Speichern auf einer Seite, die versiegelt sein KANN: mit ihrem Schlüssel,
 * wenn sie einen hat. Sagt der Dienst, dass die Seite inzwischen anders ist
 * (versiegelt oder wieder offen — Urteil `sealed` / `open`), wird sie neu geholt
 * und einmal neu geschrieben.
 */
async function sealedWrite<T>(path: string, send: (key: PageKey | null) => Promise<T>): Promise<T> {
  try {
    return await send(pageKeys.get(path) ?? null);
  } catch (e) {
    if (!(e instanceof WorkspaceError) || (e.verdict !== 'sealed' && e.verdict !== 'open')) throw e;
    await loadPage(path).catch(() => undefined);
    const key = pageKeys.get(path) ?? null;
    if (e.verdict === 'sealed' && key === null) throw new WorkspaceError('Ta strona jest zaszyfrowana, a ta przeglądarka nie ma do niej klucza.');
    return send(e.verdict === 'open' ? null : key);
  }
}

/** Ein Stück versiegeln, wenn es einen Schlüssel gibt — sonst bleibt es, wie es ist. */
async function piece(key: PageKey | null, label: (seal: SealModule, key: PageKey) => Aad, text: string | null): Promise<string | null> {
  if (key === null || text === null) return text;
  const seal = await sealing();
  return seal.sealPiece(key, label(seal, key), text);
}

/**
 * Eine Seite holen — mit den Links, die dieser Browser für ihr Haus hält.
 * Auf einer Seite nur mit Zugang entscheiden sie, ob (und für wen) man sie sieht.
 */
/** `links`: die Beweise der Links mit Zugang in diesem Browser (0073, `linkAccess.heldProofs`). */
export const loadPage = async (path: string, seats: readonly string[] = [], links: readonly string[] = []): Promise<PageContent> => {
  const query = [
    ...(seats.length === 0 ? [] : [`seats=${encodeURIComponent(seats.join(','))}`]),
    ...(links.length === 0 ? [] : [`links=${encodeURIComponent(links.join(','))}`])
  ];
  return openLoadedPage(await call<PageContent>(`/page/${encodePath(path)}${query.length === 0 ? '' : `?${query.join('&')}`}`));
};

export const savePage = (
  path: string, body: { readonly title: string; readonly lead: string | null }
): Promise<PageContent> =>
  sealedWrite(path, async (key) => {
    const saved = await call<PageContent>(`/workspace/page/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: await piece(key, (s, k) => s.sealAad.title(k.id, k.v), body.title.trim()),
        lead: await piece(key, (s, k) => s.sealAad.lead(k.id, k.v), body.lead)
      })
    });
    /* Die Antwort wiederholt, was ankam — offen zurück, wie es gemeint war. */
    return { ...saved, title: body.title.trim(), lead: body.lead };
  });

/** 0062 — Seite, Slajdy oder (0085) Prezentacja, und ihr Aussehen. `theme: null` — automatisch. */
export const savePageLook = (
  path: string, look: { readonly mode: PageMode; readonly theme: string | null }
): Promise<{ mode: string; theme: string | null }> =>
  sealedWrite(path, async (key) => {
    const saved = await call<{ mode: string; theme: string | null }>(`/workspace/page-look/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ mode: look.mode, theme: await piece(key, (s, k) => s.sealAad.look(k.id, k.v), look.theme) })
    });
    return { ...saved, theme: look.theme };
  });

/** Die Karte der Seite speichern (0048) — als Ganzes; `null` nimmt sie weg. */
export const savePageLogic = (path: string, logic: string | null): Promise<{ saved: boolean }> =>
  sealedWrite(path, async (key) =>
    call<{ saved: boolean }>(`/workspace/page-logic/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ logic: await piece(key, (s, k) => s.sealAad.logic(k.id, k.v), logic) })
    }));

/** 0082 — „Wybór na stronie" speichern; `null` nimmt ihn weg. */
export const savePageSubject = (path: string, subject: string | null): Promise<{ subject: string | null }> =>
  sealedWrite(path, async (key) => {
    await call(`/workspace/page-subject/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ subject: await piece(key, (s, k) => s.sealAad.subject(k.id, k.v), subject) })
    });
    return { subject };
  });

/** Ein Baustein, wie ihn der Editor hält: ausgepackt. */
export interface DraftPart {
  readonly id: string;

  /** Der Baustein, den diese Stelle zeigt — siehe `PagePart.moduleId`. */
  readonly moduleId: string | null;

  readonly kind: string;
  readonly layout: Layout;
  readonly config: Record<string, string>;

  /** 0133 — nur für die Menschen dieses Bereichs (mit Konto, Link oder ihrem Platz); fehlt oder `null`: für alle. */
  readonly audienceAreaId?: string | null;
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
    config: readConfig(part.config),
    ...(part.audienceAreaId == null ? {} : { audienceAreaId: part.audienceAreaId })
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
  sealedWrite(path, async (key) => call<{ parts: number }>('/workspace/parts', {
    method: 'PUT',
    body: JSON.stringify({
      path,
      /*
       * 0121 — auf einer versiegelten Seite Anordnung und Inhalt als Hülle; ein
       * Formular behält seine offenen Einstellungen (der Dienst liest sie).
       */
      parts: await Promise.all(parts.map(async (part) => ({
        id: part.id,
        moduleId: part.moduleId,
        kind: part.kind,
        audienceAreaId: part.audienceAreaId ?? null,
        layout: await piece(key, (s, k) => s.sealAad.layout(part.id, k.v), JSON.stringify(part.layout)),
        config: part.kind === 'form'
          ? JSON.stringify(part.config)
          : await piece(key, (s, k) => s.sealAad.config(part, k.v), JSON.stringify(part.config))
      })))
    })
  }));
