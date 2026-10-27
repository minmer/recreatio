/**
 * 2026-10-27 — WAS AUF DEM BILDSCHIRM WIRKLICH STEHT, gemessen im Browser.
 *
 * Die Vorschau für Assistenten soll nicht nur ein Bild liefern, sondern sagen,
 * was darauf nicht stimmt — so, wie es ein Mensch sähe:
 *
 * <code>
 *   text-cut      Text, den ein Kasten abschneidet (rechts, unten, mit „…")
 *   scrolls       Inhalt, der in einem Kasten rollt (auf dem Bild unsichtbar)
 *   spills        Inhalt, der über seine Kachel hinausragt
 *   tiny-text     Schrift unter 12 px
 *   contrast      Text, der sich vom Grund kaum abhebt (WCAG: 4,5 : 1, gross 3 : 1) — gemessen
 *                 am fertigen Bild (der Treiber), hier nur Text, Farbe und Ort
 *   image         Bilder, die nicht laden, oder Platzhalter
 *   empty         eine Kachel, die nichts zeigt
 *   loading       noch „Wczytywanie…"
 *   off-screen    auf einer Bühne halb oder ganz ausserhalb des Bildschirms
 *   overlap       zwei Texte übereinander
 * </code>
 *
 * Gemessen wird an der fertigen Seite (`settle` wartet, bis nichts mehr lädt),
 * über `getComputedStyle` und die Rechtecke. Den Kontrast misst erst das Bild:
 * der Grund unter einem Text ist oft kein Vorfahr, sondern eine Schicht daneben,
 * ein Verlauf, ein Foto.
 */

import type { PreviewFetch } from './previewFetch';

export interface Rect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface Finding { readonly kind: string; readonly detail: string }

/**
 * Ein Text und seine Farbe, für den Kontrast. Gemessen wird er am fertigen
 * Bild (der Treiber, `frontend/mcp/`): der Grund unter einem Text ist oft eine
 * Schicht daneben, ein Verlauf, ein Foto — das weiss nur das Bild.
 */
export interface TextSample {
  readonly rect: Rect;
  /** sRGB 0–255. */
  readonly color: readonly [number, number, number];
  /** Gross (ab 24 px, oder fett ab 18,6 px): dann genügt 3 : 1 statt 4,5 : 1. */
  readonly big: boolean;
  readonly text: string;
}

export interface ItemMeasure {
  /** Die Stelle auf der Seite (Kennung des Bausteins). */
  readonly id: string;
  readonly kind: string;
  /** Auf der Seite: im Dokument; auf Slajdy und Bühne: im Fenster. */
  readonly rect: Rect;
  readonly opacity: number;
  /** Wie viel davon im Fenster steht (0–1). */
  readonly visible: number;
  readonly text: string;
  /** Was der Baustein über sich selbst sagt („Tu nie ma formularza.", „Brak terminów"). */
  readonly says: readonly string[];
  readonly folded: boolean;
  readonly images: { readonly total: number; readonly broken: number; readonly loading: number; readonly placeholder: number };
  readonly minFont: number | null;
  readonly findings: readonly Finding[];
  readonly texts: readonly TextSample[];
}

export interface ViewMeasure {
  readonly viewport: { readonly w: number; readonly h: number };
  readonly page: { readonly w: number; readonly h: number };
  /** Um so viel ist die Seite breiter als das Fenster (waagrecht rollen). */
  readonly overflowX: number;
  readonly culprits: readonly { readonly id: string | null; readonly what: string; readonly right: number }[];
  readonly header: Rect | null;
  readonly menu: { readonly rect: Rect; readonly items: number; readonly rows: number } | null;
  readonly title: string | null;
  readonly items: readonly ItemMeasure[];
  readonly overlaps: readonly { readonly a: string; readonly b: string; readonly share: number }[];
  readonly loading: number;
  /** Was ausserhalb der Bausteine steht und etwas sagt (eine leere Seite, „Strona niedostępna"). */
  readonly notices: readonly string[];
}

/* -- Warten ------------------------------------------------------------------------- */

export const nextFrames = (n = 2): Promise<void> => new Promise((done) => {
  const step = (left: number) => (left <= 0 ? done() : requestAnimationFrame(() => step(left - 1)));
  step(n);
});

const sleep = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));

/** Bilder, die erst beim Rollen laden, sofort laden — sonst stünden sie auf einem Bild der ganzen Seite leer da. */
function eagerImages(): void {
  for (const img of Array.from(document.images)) if (img.loading === 'lazy') img.loading = 'eager';
}

export interface Settled {
  readonly settled: boolean;
  readonly ms: number;
  /** Woran es zuletzt noch hing, wenn die Zeit aus war. */
  readonly waiting: readonly string[];
}

/**
 * BIS NICHTS MEHR LÄDT: keine Anfrage unterwegs (und eine Weile keine Antwort),
 * kein „Wczytywanie…", Bilder geladen, Schriften und Stilblätter da — dann
 * noch zwei Bilder des Browsers und die Zeit für ein Einblenden.
 */
export async function settle(fetches: PreviewFetch, timeout = 15000): Promise<Settled> {
  const start = performance.now();
  let waiting: string[] = [];
  await nextFrames(2);
  while (performance.now() - start < timeout) {
    eagerImages();
    waiting = [];
    if (fetches.pending() > 0) waiting.push(`${fetches.pending()} zapytań do usługi`);
    if (performance.now() - fetches.lastAt() < 350) waiting.push('świeża odpowiedź');
    const loading = document.querySelectorAll('.ui-loading').length;
    if (loading > 0) waiting.push(`${loading} modułów jeszcze się wczytuje`);
    const images = Array.from(document.images).filter((img) => !img.complete).length;
    if (images > 0) waiting.push(`${images} obrazów w drodze`);
    if (document.fonts.status !== 'loaded') waiting.push('czcionki');
    const sheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).filter((one) => one.sheet === null).length;
    if (sheets > 0) waiting.push(`${sheets} arkuszy stylów`);
    if (waiting.length === 0) {
      /* Was einblendet (ein Bild, das aufgeht), braucht seine Zeit. */
      await sleep(450);
      await nextFrames(2);
      if (fetches.pending() === 0 && document.querySelectorAll('.ui-loading').length === 0) {
        return { settled: true, ms: Math.round(performance.now() - start), waiting: [] };
      }
      continue;
    }
    await sleep(120);
  }
  return { settled: false, ms: Math.round(performance.now() - start), waiting };
}

/* -- Farben ------------------------------------------------------------------------- */

let paint: CanvasRenderingContext2D | null = null;
const colorCache = new Map<string, [number, number, number, number]>();

/** Jede Farbe, die CSS kennt (auch oklch, color-mix), als sRGB 0–255 und Deckkraft 0–1 — über eine Leinwand. */
function rgba(css: string): [number, number, number, number] {
  const known = colorCache.get(css);
  if (known !== undefined) return known;
  if (paint === null) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    paint = canvas.getContext('2d', { willReadFrequently: true });
  }
  let out: [number, number, number, number] = [0, 0, 0, 0];
  if (paint !== null) {
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = '#000';
    paint.fillStyle = css;
    paint.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
    out = [r, g, b, a / 255];
  }
  colorCache.set(css, out);
  return out;
}

/* -- Ein Kasten --------------------------------------------------------------------- */

const ownText = (el: Element): string => {
  let out = '';
  for (const node of Array.from(el.childNodes)) if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? '';
  return out.replace(/\s+/g, ' ').trim();
};

const snippet = (text: string, n = 48): string => (text.length > n ? `${text.slice(0, n)}…` : text);

const rectOf = (r: DOMRect, fixed: boolean): Rect => ({
  x: Math.round(r.left + (fixed ? 0 : window.scrollX)),
  y: Math.round(r.top + (fixed ? 0 : window.scrollY)),
  w: Math.round(r.width),
  h: Math.round(r.height)
});

/** Wie deckend ein Element wirklich ist — seine Deckkraft mal die aller Vorfahren. */
function opacityOf(el: Element): number {
  let value = 1;
  for (let at: Element | null = el; at !== null; at = at.parentElement) value *= Number.parseFloat(getComputedStyle(at).opacity || '1');
  return Math.round(value * 100) / 100;
}

/** Wie viel eines Rechtecks im Fenster steht (0–1). */
function inViewport(r: DOMRect): number {
  const area = r.width * r.height;
  if (area <= 0) return 0;
  const w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
  const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
  return Math.round(((w * h) / area) * 100) / 100;
}

/** Was ein Baustein über sich selbst sagt. */
const SAYS = '.wk-card-muted, .wk-card-unknown, .wk-blocked, .ui-empty, .wk-note';

/** Zu sehen: nicht verborgen (`visibility` erbt — das Element selbst sagt es für seine Vorfahren mit). */
const shown = (el: Element): boolean => {
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
};

/**
 * Malt etwas, auch ohne Text und Bild: eine Fläche, ein Verlauf, ein Rand (ein
 * Kształt, eine Schicht). Eine Kachel selbst malt immer ihren Grund — bei ihr
 * zählt nur, was darin steht.
 */
function paints(el: HTMLElement): boolean {
  const inside = Array.from(el.querySelectorAll<HTMLElement>('*')).slice(0, 60);
  const list = el.classList.contains('wk-card') ? inside : [el, ...inside];
  return list.some((one) => {
    const style = getComputedStyle(one);
    const r = one.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    return style.backgroundImage !== 'none' || rgba(style.backgroundColor)[3] > 0.05
      || (Number.parseFloat(style.borderTopWidth) > 0 && rgba(style.borderTopColor)[3] > 0.05) || style.boxShadow !== 'none';
  });
}

/** EIN BAUSTEIN, gemessen: was er zeigt und was daran nicht stimmt. */
export function inspect(el: HTMLElement, id: string, kind: string, fixed: boolean): ItemMeasure {
  const box = el.getBoundingClientRect();
  const findings: Finding[] = [];
  const text = (el.innerText ?? '').replace(/\s+/g, ' ').trim();
  const says = Array.from(el.querySelectorAll(SAYS)).map((one) => (one as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter((one) => one !== '').slice(0, 4);
  const folded = el.querySelector('.wk-card-open') !== null;

  /* Bilder. */
  const imgs = Array.from(el.querySelectorAll('img'));
  const images = {
    total: imgs.length,
    broken: imgs.filter((img) => img.complete && img.naturalWidth === 0).length,
    loading: imgs.filter((img) => !img.complete).length,
    placeholder: imgs.filter((img) => img.currentSrc.startsWith('data:image/svg+xml')).length
  };
  if (images.broken > 0) findings.push({ kind: 'image', detail: `${images.broken} z ${images.total} obrazów nie wczytuje się` });

  /* Abgeschnitten, gerollt, zu klein — an den Elementen mit eigenem Text. */
  let minFont: number | null = null;
  let tiny = 0;
  const cut: string[] = [];
  const scrolls: string[] = [];
  const texts: TextSample[] = [];
  let worstSpill = { left: 0, right: 0, top: 0, bottom: 0 };
  /* Wie weit hinunter etwas zu sehen ist — eine hohe Kachel mit wenig Inhalt ist eine leere Fläche. */
  let contentBottom = box.top;
  /* Deckkraft je Element, einmal gerechnet: die eigene mal die des Vorfahren. */
  const memo = new Map<Element, number>();
  const opacity = (node: Element): number => {
    const known = memo.get(node);
    if (known !== undefined) return known;
    const value = Number.parseFloat(getComputedStyle(node).opacity || '1') * (node.parentElement === null ? 1 : opacity(node.parentElement));
    memo.set(node, value);
    return value;
  };
  const all = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))].slice(0, 900);
  for (const one of all) {
    if (!(one instanceof HTMLElement)) continue;
    const style = getComputedStyle(one);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const own = ownText(one);
    const r = one.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    /* Was gerade ausgeblendet ist (ein Hinweis, der erst später erscheint), zeigt nichts. */
    if (opacity(one) < 0.1) continue;

    /* Was über die Kachel hinausragt (nur, was etwas zeigt). */
    if (one !== el && (own !== '' || one instanceof HTMLImageElement || one instanceof HTMLCanvasElement || one instanceof HTMLVideoElement)) {
      contentBottom = Math.max(contentBottom, Math.min(r.bottom, box.bottom));
      worstSpill = {
        left: Math.max(worstSpill.left, box.left - r.left),
        right: Math.max(worstSpill.right, r.right - box.right),
        top: Math.max(worstSpill.top, box.top - r.top),
        bottom: Math.max(worstSpill.bottom, r.bottom - box.bottom)
      };
    }

    const inner = (one.innerText ?? '').trim();
    /* Nur für Bildschirmleser (1 px, abgeschnitten): das ist Absicht. */
    const readerOnly = r.width <= 2 || r.height <= 2;
    if (inner !== '' && !readerOnly) {
      const overX = one.scrollWidth - one.clientWidth;
      const overY = one.scrollHeight - one.clientHeight;
      const hidesX = style.overflowX === 'hidden' || style.overflowX === 'clip';
      const hidesY = style.overflowY === 'hidden' || style.overflowY === 'clip';
      const rollsX = style.overflowX === 'auto' || style.overflowX === 'scroll';
      const rollsY = style.overflowY === 'auto' || style.overflowY === 'scroll';
      const clamp = style.getPropertyValue('-webkit-line-clamp');
      const ellipsis = style.textOverflow === 'ellipsis';
      /*
       * WESSEN TEXT wird abgeschnitten? Ein Kasten, der Bilder neben sich abschneidet
       * (ein Karussell), schneidet keinen Text: gezählt wird nur Text, der wirklich
       * über seinen Rand reicht — der eigene, oder der eines Kindes.
       */
      const victim = (edge: 'right' | 'bottom'): string | null => {
        if (own !== '' && (edge === 'right' ? overX > 1 : overY > 4)) return own;
        for (const kid of Array.from(one.querySelectorAll<HTMLElement>('*')).slice(0, 200)) {
          const said = ownText(kid);
          if (said === '' || opacity(kid) < 0.1 || !shown(kid)) continue;
          const q = kid.getBoundingClientRect();
          if (q.width === 0 || q.height === 0) continue;
          if (edge === 'right' ? q.right > r.right + 1 && q.left < r.right : q.bottom > r.bottom + 4 && q.top < r.bottom) return said;
        }
        return null;
      };
      const right = overX > 1 && (hidesX || ellipsis) ? victim('right') : null;
      const bottom = right === null && overY > 4 && hidesY ? victim('bottom') : null;
      /* Unten erst ab 5 px: darunter sind es die Unterlängen einer Zeile, kein verlorener Text. */
      if (right !== null) cut.push(`„${snippet(right)}” ucięty z prawej o ${overX} px`);
      else if (bottom !== null) cut.push(`„${snippet(bottom)}” ucięty u dołu o ${overY} px${clamp !== '' && clamp !== 'none' ? ' (skrót do linii)' : ''}`);
      if ((overX > 1 && rollsX) || (overY > 1 && rollsY)) scrolls.push(`„${snippet(inner, 32)}” przewija się wewnątrz (${Math.max(overX, overY)} px ukryte)`);
    }

    if (own === '') continue;
    const size = Number.parseFloat(style.fontSize);
    if (Number.isFinite(size)) {
      minFont = minFont === null ? size : Math.min(minFont, size);
      if (size < 12) tiny += 1;
    }

    /*
     * Für den Kontrast: der Text, seine Farbe, wo er steht (gemessen wird am Bild) —
     * nur ganz gezeigter Text: was eine Szene absichtlich zurücknimmt (die anderen
     * Stücke neben dem betonten), ist kein Fehler.
     */
    if (texts.length < 24 && style.color !== '' && opacity(one) >= 0.9 && r.width >= 4 && r.height >= 6) {
      const [cr, cg, cb] = rgba(style.color);
      texts.push({
        rect: rectOf(r, fixed),
        color: [cr, cg, cb],
        big: size >= 24 || (size >= 18.6 && Number.parseInt(style.fontWeight, 10) >= 700),
        text: snippet(own, 36)
      });
    }
  }

  const unique = (list: string[]) => [...new Set(list)];
  for (const one of unique(cut).slice(0, 4)) findings.push({ kind: 'text-cut', detail: one });
  for (const one of unique(scrolls).slice(0, 2)) findings.push({ kind: 'scrolls', detail: one });
  const spill = Object.entries(worstSpill).filter(([, px]) => px > 2).map(([side, px]) => `${side} ${Math.round(px)} px`);
  if (spill.length > 0) findings.push({ kind: 'spills', detail: `treść wystaje poza kartę: ${spill.join(', ')}` });
  if (tiny > 0) findings.push({ kind: 'tiny-text', detail: `${tiny} tekstów mniejszych niż 12 px (najmniejszy ${minFont} px)` });
  /* Im Raster: eine hohe Kachel, in der der Inhalt oben endet (die Zeilen geben ihr eine Mindesthöhe). */
  const fill = box.height > 0 ? (contentBottom - box.top) / box.height : 1;
  if (!fixed && box.height >= 240 && fill < 0.5 && contentBottom > box.top) {
    findings.push({ kind: 'sparse', detail: `treść zajmuje ${Math.round(fill * 100)}% wysokości karty (${Math.round(box.height - (contentBottom - box.top))} px pustego miejsca) — mniejsza wysokość (rowSpan) albo więcej treści` });
  }
  if (el.querySelector('.ui-loading') !== null) findings.push({ kind: 'loading', detail: 'w chwili zdjęcia nadal się wczytywał' });
  const media = el.querySelector('img, svg, canvas, video, iframe, picture') !== null;
  if (text === '' && !media && !paints(el)) findings.push({ kind: 'empty', detail: 'karta nic nie pokazuje' });

  return {
    id, kind,
    rect: rectOf(box, fixed),
    opacity: opacityOf(el),
    visible: fixed ? inViewport(box) : 1,
    text: snippet(text, 140),
    says,
    folded,
    images,
    minFont,
    findings,
    texts
  };
}

/* -- Die ganze Ansicht -------------------------------------------------------------- */

/** Die Elemente, die über den rechten Rand ragen — jeweils das äusserste einer Kette. */
function overflowCulprits(): { id: string | null; what: string; right: number }[] {
  const vw = document.documentElement.clientWidth;
  const out: { id: string | null; what: string; right: number }[] = [];
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 1) continue;
    const parent = el.parentElement?.getBoundingClientRect();
    if (parent !== undefined && parent.right > vw + 1) continue;
    const card = el.closest<HTMLElement>('[id^="part-"], [data-part], [data-pz-piece]');
    const id = card?.id.startsWith('part-') ? card.id.slice(5) : card?.dataset.part ?? card?.dataset.pzPiece ?? null;
    out.push({ id, what: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''} „${snippet((el.innerText ?? '').trim(), 30)}”`, right: Math.round(r.right - vw) });
    if (out.length >= 6) break;
  }
  return out;
}

/** Zwei Texte übereinander: wie viel des kleineren der andere bedeckt. */
function overlapsOf(items: readonly { id: string; rect: DOMRect; text: boolean }[]): { a: string; b: string; share: number }[] {
  const out: { a: string; b: string; share: number }[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i], b = items[j];
      if (!a.text || !b.text) continue;
      const w = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const h = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (w <= 0 || h <= 0) continue;
      const small = Math.min(a.rect.width * a.rect.height, b.rect.width * b.rect.height);
      const share = small <= 0 ? 0 : (w * h) / small;
      if (share > 0.1) out.push({ a: a.id, b: b.id, share: Math.round(share * 100) / 100 });
    }
  }
  return out;
}

export type ViewKind = 'page' | 'slides' | 'presentation' | 'matrix';

/** Die Bausteine der Ansicht: im Raster, auf den Slajdy (und der Bühne der Folge), als Stücke einer Szene, in der Matrix. */
function itemsOf(view: ViewKind): { el: HTMLElement; id: string; kind: string }[] {
  const kindOf = (el: Element, fallback: string) => /\bwk-card-([a-z0-9-]+)/.exec(el.className)?.[1] ?? /\bkind-([a-z0-9-]+)/.exec(el.className)?.[1] ?? fallback;
  if (view === 'page') {
    return Array.from(document.querySelectorAll<HTMLElement>('.wk-page-grid > article[id^="part-"]')).map((el) => ({ el, id: el.id.slice(5), kind: kindOf(el, '?') }));
  }
  if (view === 'slides') {
    return Array.from(document.querySelectorAll<HTMLElement>('.wk-deck [data-part]')).map((el) => ({ el, id: el.dataset.part ?? '', kind: kindOf(el.matches('.wk-deck-actor') ? el.querySelector('[class*="wk-card-"]') ?? el : el, '?') }));
  }
  if (view === 'presentation') {
    return Array.from(document.querySelectorAll<HTMLElement>('.pz [data-pz-piece]')).map((el) => ({ el, id: el.dataset.pzPiece ?? '', kind: kindOf(el, '?') }));
  }
  /* Die Matrix: die Kachel jeder Grösse (ohne ihre Beschriftung darüber). */
  return Array.from(document.querySelectorAll<HTMLElement>('.pv-cell .wk-page-grid > article')).map((el) => ({
    el, id: el.closest<HTMLElement>('.pv-cell')?.dataset.pvCell ?? '', kind: kindOf(el, 'cell')
  }));
}

/** DIE ANSICHT, gemessen. Auf Slajdy und der Bühne zählt nur, was sichtbar ist. */
export function measureView(view: ViewKind): ViewMeasure {
  const fixed = view === 'slides' || view === 'presentation';
  const found = itemsOf(view);
  const items: ItemMeasure[] = [];
  const shapes: { id: string; rect: DOMRect; text: boolean }[] = [];
  const screen = window.innerWidth * window.innerHeight;
  for (const one of found) {
    const r = one.el.getBoundingClientRect();
    if (!shown(one.el) || r.width === 0 || r.height === 0) continue;
    if (fixed) {
      const opacity = opacityOf(one.el);
      if (opacity < 0.05 || inViewport(r) === 0) continue;
    }
    const measured = inspect(one.el, one.id, one.kind, fixed);
    /*
     * Halb ausserhalb des Schirms — aber nicht, was grösser ist als er (ein Grund,
     * ein Kreis, der alles bedeckt) und nicht, was nur Fläche ist (ein Kształt).
     */
    const backdrop = r.width * r.height >= screen * 0.9 || one.kind === 'shape' || one.kind === 'layers';
    if (fixed && !backdrop && measured.visible < 0.98 && measured.opacity > 0.5) {
      const findings = [...measured.findings, {
        kind: 'off-screen',
        detail: measured.visible <= 0.05 ? 'poza ekranem' : `ucięty przez brzeg ekranu — widać ${Math.round(measured.visible * 100)}%`
      }];
      items.push({ ...measured, findings });
    } else items.push(measured);
    shapes.push({ id: one.id, rect: r, text: measured.opacity >= 0.9 && measured.text !== '' && one.el.querySelector('img, canvas, video') === null });
  }

  const head = document.querySelector<HTMLElement>('[data-app-head]');
  const menu = document.querySelector<HTMLElement>('.wk-sitemenu');
  const menuItems = menu === null ? [] : Array.from(menu.querySelectorAll<HTMLElement>('a, button')).filter((one) => {
    const r = one.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && shown(one);
  });
  const rows = new Set(menuItems.map((one) => Math.round(one.getBoundingClientRect().top / 8)));
  const notices = Array.from(document.querySelectorAll<HTMLElement>('.ui-empty, .wk-blocked'))
    .filter((one) => one.closest('[id^="part-"], [data-part], [data-pz-piece]') === null)
    .map((one) => one.innerText.replace(/\s+/g, ' ').trim()).filter((one) => one !== '').slice(0, 3);
  const doc = document.documentElement;

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    page: { w: doc.scrollWidth, h: doc.scrollHeight },
    overflowX: Math.max(0, doc.scrollWidth - doc.clientWidth),
    culprits: doc.scrollWidth > doc.clientWidth + 1 ? overflowCulprits() : [],
    header: head === null || head.getBoundingClientRect().height === 0 ? null : rectOf(head.getBoundingClientRect(), true),
    menu: menu === null ? null : { rect: rectOf(menu.getBoundingClientRect(), true), items: menuItems.length, rows: rows.size },
    title: document.querySelector<HTMLElement>('.wk-main h1, .wk-deck-cover h1')?.innerText.trim() ?? null,
    items,
    overlaps: fixed ? overlapsOf(shapes) : [],
    loading: document.querySelectorAll('.ui-loading').length,
    notices
  };
}

/* -- Bewegungen nach der Uhr --------------------------------------------------------- */

/** Welche Bausteine der Ansicht sich nach der Uhr bewegen: Kennung → die längste Dauer eines Durchgangs (ms). */
export function animatedItems(view: ViewKind): Record<string, number> {
  const out: Record<string, number> = {};
  for (const one of itemsOf(view)) {
    const all = one.el.getAnimations({ subtree: true });
    if (all.length === 0) continue;
    let longest = 0;
    for (const anim of all) {
      const timing = anim.effect?.getComputedTiming();
      if (timing === undefined) continue;
      const duration = typeof timing.duration === 'number' ? timing.duration : 0;
      longest = Math.max(longest, (timing.delay ?? 0) + duration);
    }
    if (longest > 0) out[one.id] = Math.round(longest);
  }
  return out;
}

/** Alle Bewegungen anhalten — bei `t` ms ab ihrem Anfang; `null` lässt sie weiterlaufen. */
export function seek(t: number | null): void {
  for (const one of document.getAnimations()) {
    if (t === null) { one.play(); continue; }
    one.pause();
    one.currentTime = t;
  }
}
