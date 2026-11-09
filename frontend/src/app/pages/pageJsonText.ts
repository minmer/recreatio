/**
 * Die Beschreibung neben jedem JSON-Fach (0064): wozu, welche Schlüssel, ein Beispiel — für Seite, Präsentation, Teil, Modul.
 *
 * <b>2026-10-24 — als Baum</b> (`core/jsonTree.ts`): die Seite trägt den Eintrag
 * eines Moduls, der Eintrag die Arten und das Formular, das Formular seine
 * Wymagania. Jeder Abschnitt steht an EINER Stelle; die Beschreibung der
 * Seite, eines Moduls und eines Bausteins setzt sich aus denselben Knoten
 * zusammen — was ein Formular neu kann, steht sofort in allen dreien.
 */

import { QUESTION_EXAMPLE } from '../forms/formJson';
import { FORM_FORMAT } from '../forms/formFormat';
import { DEFAULT_ENTRY, MAX_APPOINTMENTS, MAX_DEPTH } from '../calendar/appointmentsJson';
import { describe, keyLines, pretty, textNode, type JsonNode } from '../core/jsonTree';
import { motionDescription } from './motion/motion';
import { liveDescription } from './motion/liveText';
import { MODULE_FORMAT, PAGE_FORMAT } from './pageJson';
import { MAX_NEEDS, NEED_PREFIX } from './pageImageNeeds';
import { GATE_KINDS, INPUT_KINDS, PAGE_NODE_LABEL } from './pageLogic';
import { subjectDescription } from './pageSubject';
import type { PartModule } from './part';
import { PARTS, partOf } from './parts/registry';
import { DEFAULT_THEMES } from './slides/slideLook';
import { PAGE_STYLE_NODE } from './pageStyleText';
import { t, texts } from '../core/i18n';

/* -- Die Beschreibung ------------------------------------------------------------- */

/** Was eine Art im JSON ist: wozu, welche Schlüssel, ein Beispiel. */
function kindText(def: PartModule): string {
  const flags = [
    def.takes ? t('pagesJson.kind.takes') : null,
    def.fullscreen ? t('pagesJson.kind.fullscreen') : null,
    def.Editor !== null ? t('pagesJson.kind.editor') : null
  ].filter((one) => one !== null);
  return [
    def.use + (flags.length === 0 ? '' : ` (${flags.join('; ')})`),
    t('pagesJson.kind.size', { w: def.box.colSpan, h: def.box.rowSpan }),
    '"config":',
    keyLines(def.json.keys),
    t('pagesJson.kind.example'),
    pretty(def.json.example)
  ].join('\n');
}

/** Eine Art als Knoten — dieselbe in der Seite, im Modul und im Baustein. */
const kindNodes = new Map<string, JsonNode>();
export function kindNode(def: PartModule): JsonNode {
  const known = kindNodes.get(def.kind);
  if (known !== undefined) return known;
  const node: JsonNode = {
    key: `part:${def.kind}`,
    /* Getter: Bezeichnung und Sprache von jetzt, nicht von dem Moment, an dem der Knoten entstand. */
    get title() { return `"${def.kind}" — ${def.label}${def.retired === undefined ? '' : t('pagesJson.kind.retiredTitle', { why: def.retired })}`; },
    get short() { return `"${def.kind}" — ${def.label}${def.retired === undefined ? '' : t('pagesJson.kind.retiredShort')}`; },
    text: () => kindText(def)
  };
  kindNodes.set(def.kind, node);
  return node;
}

const LAYERS = (): string => t('pagesJson.text.layers');

/* „<klucz>“ und „<cel>“ als Platzhalter — die Prüfung vergleicht <wörter> zwischen den Sprachen. */
const PRESENTATION = (): string => t('pagesJson.text.presentation', { keyTag: `<${t('pagesJson.text.keyTag')}>`, targetTag: `<${t('pagesJson.text.targetTag')}>` });

const ENTRY_KEYS: Readonly<Record<string, string>> = texts({
  id: 'pagesJson.entry.id',
  module: 'pagesJson.entry.module',
  name: 'pagesJson.entry.name',
  kind: 'pagesJson.entry.kind',
  lang: 'pagesJson.entry.lang',
  slide: 'pagesJson.entry.slide',
  show: 'pagesJson.entry.show',
  size: 'pagesJson.entry.size',
  layout: 'pagesJson.entry.layout',
  config: 'pagesJson.entry.config',
  questions: 'pagesJson.entry.questions',
  design: 'pagesJson.entry.design',
  needs: 'pagesJson.entry.needs'
});

/** Ein vollständiges Beispiel einer Seite — aus den Beispielen der Bausteine. */
export function pageExample(): Record<string, unknown> {
  const sample = ['hero', 'plan', 'text', 'form'].map((kind) => partOf(kind)).filter((def): def is PartModule => def !== undefined);
  return {
    format: PAGE_FORMAT,
    version: 1,
    path: 'parafia/pielgrzymka',
    title: 'Pielgrzymka rowerowa', // i18n-ignore — Beispieldaten
    lead: 'Dwa dni, 140 km, jedna wspólnota.', // i18n-ignore — Beispieldaten
    mode: 'slides',
    theme: DEFAULT_THEMES.dark,
    cover: [],
    /* 0107 — ein gemeinsames Tuch mit Schein und Nici, Punkte statt Namen, die Bühne höchstens 80 rem. */
    deck: {
      backdrop: [
        { kind: 'glow', speed: 0.12, color: 'accent', x: 58, y: 42, size: 60, opacity: 0.3, blend: 'normal' },
        { kind: 'mesh', speed: 0.05, seed: 7, count: 4, color: 'rgba(143, 208, 255, 0.25)', glow: 'rgba(167, 224, 255, 0.35)', center: 0.82, amplitude: 1, opacity: 0.9, dust: true, motion: { name: 'sway' } }
      ],
      nav: 'dots',
      width: 80
    },
    menu: [{ label: 'Parafia', kind: 'abs', target: 'parafia', children: [] }, { label: 'Zapisy', kind: 'rel', target: 'zapisy', children: [] }],
    logic: null,
    modules: [
      ...sample.map((def, i) => ({
        ...(i === 0 ? { id: 'start' } : {}),
        kind: def.kind,
        ...(def.kind === 'form' ? { name: 'Zapisy 2026' } : {}),
        slide: i === 0 ? { label: def.label, layers: [], layout: { align: 'start', width: 56, tall: { valign: 'end', width: 100 } } }
          : i === 1 ? { label: def.label, layers: [], transition: 'dissolve', enter: 'rise', motion: { name: 'rise', delay: 220 } }
          : i === 2 ? { label: def.label, layers: [], colors: { accent: '#d3a25e' }, stage: { frames: { start: { x: 80, y: 18, w: 22, scale: 1, rotate: 0, opacity: 1, max: 20, tall: { x: 50, y: 12, w: 40 } } }, bare: true } }
          : { label: def.label, layers: [] },
        size: def.box,
        config: def.json.example,
        /* 2026-10-24 — und die Minderjährigen mit allen Möglichkeiten (`forms/needs.ts`). */
        ...(def.kind === 'form' ? { ...QUESTION_EXAMPLE, needs: [{ id: 'minor', age: 'birth', ways: ['parent', 'adult', 'consent'] }] } : {})
      })),
      /* 0107 — eine Animacja neben dem Hasło, auf dessen Slajd; auf dem Telefon darüber. */
      { kind: 'animation', slide: { label: 'Mapa', layers: [], with: { slide: 'start', side: 'end', share: 42, tallSide: 'start' } }, size: { colSpan: 3, rowSpan: 3 }, config: { scene: 'map' } }
    ]
  };
}

/** Die Beschreibung der Seite — neben dem Import der Seite, und zum Kopieren für ein Sprachmodell. */
/* 2026-10-24 — Termine, die eine Seite mitbringt (mit Programm), und die Eingänge, über die sie in Kalender gehen. */
const APPOINTMENTS_SECTION = (): string => t('pagesJson.text.appointments', {
  entry: DEFAULT_ENTRY, depth: MAX_DEPTH, max: MAX_APPOINTMENTS,
  example: pretty({
    calendars: [{ key: 'rekolekcje', label: 'Kalendarz rekolekcji' }], // i18n-ignore — Beispieldaten
    appointments: [{
      key: 'dzien1', calendar: 'rekolekcje', title: 'Rekolekcje adwentowe — dzień 1', start: '2026-12-05T18:00', end: '21:00', location: 'Kościół', // i18n-ignore — Beispieldaten
      points: [
        { title: 'Msza święta', start: '18:00', end: '19:00' }, // i18n-ignore — Beispieldaten
        { title: 'Konferencja', start: '19:15', end: '20:00', points: [{ title: 'Czas na pytania', start: '19:45' }] }, // i18n-ignore — Beispieldaten
        { title: 'Adoracja', start: '20:00', end: '21:00' }
      ]
    }],
    modules: [{ kind: 'program', config: { title: 'Program', calendar: '', item: '@dzien1' } }]
  })
});

/*
   2026-10-24 — Dateien, um die eine Seite bittet: beschrieben in "images", eingesetzt überall, wo
   "page-image:@schlüssel" steht (`pageImageNeeds.ts`, im Import `ImageNeeds.tsx`).
*/
const IMAGES_SECTION = (): string => t('pagesJson.text.images', {
  prefix: NEED_PREFIX, max: MAX_NEEDS,
  example: pretty({
    images: [
      { key: 'dom', label: 'Dom od strony ogrodu', description: 'Dom w słońcu, widziany z ogrodu; poziomo, szeroki kadr — tło pierwszego ekranu', name: 'dom-ogrod.jpg' }, // i18n-ignore — Beispieldaten
      { key: 'ognisko', kind: 'video', label: 'Ognisko wieczorem', description: '5–10 sekund ognia w pętli, bez dźwięku, poziomo' }, // i18n-ignore — Beispieldaten
      { key: 'regulamin', kind: 'file', label: 'Regulamin', description: 'Regulamin pobytu jako PDF' }
    ],
    cover: [{ kind: 'image', speed: 0.3, url: `${NEED_PREFIX}dom`, opacity: 1, blend: 'normal', position: 'center' }],
    modules: [
      { kind: 'image', config: { url: `${NEED_PREFIX}dom`, video: `${NEED_PREFIX}ognisko`, alt: 'Dom od strony ogrodu wieczorem, przy ognisku', fit: 'cover' } },
      { kind: 'files', config: { files: [{ label: 'Regulamin pobytu', url: `${NEED_PREFIX}regulamin`, note: null, size: null }], note: null } } // i18n-ignore — Beispieldaten
    ]
  })
});

/* -- Der Baum der Seite (2026-10-24) ------------------------------------------------------ */

const PAGE_INTRO = (): string => t('pagesJson.text.intro', { module: MODULE_FORMAT });

const PAGE_KEYS = (): string => t('pagesJson.text.keys', {
  format: PAGE_FORMAT,
  subject: subjectDescription(),
  nodes: ([...INPUT_KINDS, ...GATE_KINDS, 'part', 'step'] as const).map((k) => `"${k}" (${PAGE_NODE_LABEL[k]})`).join(', '),
  prefix: NEED_PREFIX
});

const PAGE_TEXTS = (): string => t('pagesJson.text.texts');

/*
   2026-10-30 — WAS DIE APP MIT DER SEITE TUT: wo sie steht, wer sie sieht, was von ihr liest — und was
   ihr Dokument nicht ändert. Jeder Satz im Code nachgesehen: Adresse und Alias (`routes.ts`, `Slug.Alias.cs`),
   Menü nicht geerbt (`Menu.cs`), ein Modul an mehreren Stellen (`Form.Config.cs`), was vom Platz geht
   (`Page.Parts.cs`), Zugang und „po wydarzeniu" (`Page.Write.cs`, `Page.Show.cs`), Widżet (`Widget.tsx`),
   wer geradesteht (`Controllers.PageGateAsync`, `PageFooter.tsx`), Dateien ohne Siegel (`PageImage.cs`),
   die Karten (`parts/events.tsx`), Nauka (`presentation/storyOfPage.ts`), die Vorschau (`preview/`).
*/
const PAGE_USAGE = (): string => t('pagesJson.text.usage');

/** Die Arten — ihr Inhalt ("config") je Art. */
const KINDS_JSON: JsonNode = {
  key: 'kinds',
  get title() { return t('pagesJson.node.kinds'); },
  text: () => t('pagesJson.node.kindsText'),
  inside: () => PARTS.map(kindNode)
};

/** Der Eintrag eines Moduls in "modules" — die Arten und das Formular stecken in ihm. */
const ENTRY_JSON: JsonNode = {
  key: 'page.module',
  get title() { return t('pagesJson.node.entry'); },
  text: () => keyLines(ENTRY_KEYS),
  inside: () => [KINDS_JSON, FORM_FORMAT]
};

/** 0064 — DIE SEITE ALS JSON: der Baum, aus dem ihre Beschreibung entsteht (und die Beispiele zum Einsetzen). */
export const PAGE_JSON: JsonNode = {
  key: 'page',
  get title() { return t('pagesJson.node.page', { format: PAGE_FORMAT }); },
  text: PAGE_INTRO,
  inside: () => [
    textNode('page.keys', t('pagesJson.node.keys'), PAGE_KEYS),
    textNode('page.usage', t('pagesJson.node.usage'), PAGE_USAGE),
    textNode('page.texts', t('pagesJson.node.texts'), PAGE_TEXTS),
    textNode('page.appointments', t('pagesJson.node.appointments'), APPOINTMENTS_SECTION),
    textNode('page.images', t('pagesJson.node.images'), IMAGES_SECTION),
    PAGE_STYLE_NODE,
    ENTRY_JSON,
    textNode('layers', t('pagesJson.node.layers'), LAYERS),
    textNode('motion', t('pagesJson.node.motion'), motionDescription),
    textNode('live', t('pagesJson.node.live'), liveDescription),
    textNode('presentation', t('pagesJson.node.presentation'), PRESENTATION),
    textNode('page.example', t('pagesJson.node.pageExample'), () => pretty(pageExample())),
    textNode('page.presentation', t('pagesJson.node.presentationExample'), () => pretty(presentationExample()))
  ],
  samples: () => [
    { label: t('pagesJson.sample.page'), doc: pageExample },
    { label: t('pagesJson.sample.presentation'), doc: presentationExample }
  ]
};

/** Die Beschreibung der Seite — neben dem Import der Seite, und zum Kopieren für ein Sprachmodell. */
export const pageDescription = (): string => describe(PAGE_JSON);

/**
 * 0085 — EINE KLEINE PRÄSENTATION: der Flug durch den Raum, eine Szene mit
 * Schritten am Faden, ein Kreis, der zum Grund wächst. Steht in der
 * Beschreibung und lässt sich ohne Warnung importieren (`app-json-check`).
 */
export function presentationExample(): Record<string, unknown> {
  return {
    format: PAGE_FORMAT,
    version: 1,
    path: 'parafia/rekolekcje',
    title: 'Rekolekcje',
    lead: null,
    mode: 'presentation',
    theme: { mode: 'light', accent: '#2f5d46', ink: '#171a16', ground: '#f7f8f5', muted: '#7c8479', night: { accent: '#8fc4a8', ink: '#eceee8', ground: '#141713', muted: '#838b7e' } },
    cover: [],
    show: {
      format: 'screen',
      fonts: 'spectral',
      nav: 'dots',
      scenes: [
        { key: 'start', label: 'Start', steps: 3, colors: { ground: '#14180f', ink: '#f2f4ef' }, hint: 'Przewiń', words: { list: ['colligere', 'novatio', 'quies'], prefix: 'RE', count: 15, seed: 7 } }, // i18n-ignore — Beispieldaten
        { key: 'dni', label: 'Trzy dni', steps: 3, change: 'fly', grow: { from: 0.8, to: 1.08 }, thread: 'dots' }, // i18n-ignore — Beispieldaten
        { key: 'zapisy', label: 'Zapisy', colors: { ink: '#f2f4ef', accent: '#9ed3b4' }, next: 'link:parafia' }
      ],
      links: [{ id: 'parafia', label: 'Strona parafii', href: '#/parafia' }], // i18n-ignore — Beispieldaten
      sound: { url: 'https://example.org/ognisko.mp3', label: 'Ognisko', volume: 0.5 }
    },
    modules: [
      { id: 'haslo', kind: 'text', size: { colSpan: 6, rowSpan: 3 }, show: { places: { start: { x: 50, y: 56, w: 40, z: -980 } }, skin: 'plain', type: 'display', align: 'center' }, config: { title: 'Trzy dni, jedna wspólnota' } }, // i18n-ignore — Beispieldaten
      ...['Piątek — przyjazd', 'Sobota — droga', 'Niedziela — powrót'].map((title, step) => ({ // i18n-ignore — Beispieldaten
        id: `dzien${step + 1}`, kind: 'text', size: { colSpan: 3, rowSpan: 3 },
        show: { places: { dni: { x: [30, 70, 50][step], y: [32, 40, 72][step], w: 24, step } }, skin: 'bubble', type: 'title', arrive: 'zoom', delay: step * 0.12, span: 0.55 },
        config: { title }
      })),
      { id: 'kolo', kind: 'shape', size: { colSpan: 2, rowSpan: 2 }, show: { places: { dni: { x: 50, y: 50, w: 12, opacity: 0 }, zapisy: { x: 50, y: 50, w: 12, scale: 22 } }, skin: 'plain', ease: 'in', layer: -2 }, config: { shape: 'circle', fill: '#14180f' } },
      { id: 'zapis', kind: 'text', size: { colSpan: 3, rowSpan: 3 }, show: { places: { zapisy: { x: 34, y: 52, w: 40 } }, skin: 'plain', type: 'heading', arrive: 'fade', delay: 0.45, span: 0.55 }, config: { title: 'Zapisy', body: ['# [zapisy@example.pl](mailto:zapisy@example.pl)', '> Zapisy do 15 maja.'] } },
      { id: 'skrot', kind: 'text', size: { colSpan: 2, rowSpan: 1 }, show: { places: { start: { x: 50, y: 84, w: 22 } }, skin: 'pill', type: 'note', align: 'center', go: { start: 'zapisy' } }, config: { title: 'Od razu do zapisów' } }, // i18n-ignore — Beispieldaten
      /* 2026-10-19 — ein Bild: erst der ganze Grund, dann ein Kadr rechts (der Ausschnitt bleibt beim Feuer); auf den Zapisy kommt es wieder. */
      {
        id: 'ognisko', kind: 'image', size: { colSpan: 3, rowSpan: 3 },
        show: {
          places: {
            start: {
              x: 50, y: 50, w: 100, h: 100, opacity: 0.55, crop: '57% 60%',
              frames: [{ at: 0.3 }, { at: 1, x: 74, y: 50, w: 40, h: 62, opacity: 1, crop: '50% 70%', mask: { shape: 'inset', round: 1.5 }, tall: { x: 50, y: 30, w: 86, h: 34 } }]
            },
            zapisy: { x: 74, y: 52, w: 34, h: 46, crop: '50% 70%', mask: { shape: 'circle', r: 60 } }
          },
          skin: 'plain', layer: -3, between: 'leave', arrive: 'fade'
        },
        config: { url: '/Hortus.jpg', alt: 'Ognisko w ogrodzie', fit: 'cover', at: '57% 50%' }
      }
    ]
  };
}

/** Ein Baustein im Editor — sein Inhalt ("config") als Knoten, einer je Art. */
const partJsons = new Map<string, JsonNode>();
export function partFormat(kind: string): JsonNode {
  const known = partJsons.get(kind);
  if (known !== undefined) return known;
  const def = partOf(kind);
  const node: JsonNode = def === undefined
    ? { key: `part-doc:${kind}`, get title() { return t('pagesJson.part.title', { name: kind }); }, text: () => t('pagesJson.part.unknown', { kind }) }
    : {
      key: `part-doc:${kind}`,
      get title() { return t('pagesJson.part.title', { name: def.label }); },
      text: () => t('pagesJson.part.text'),
      inside: () => [kindNode(def)]
    };
  partJsons.set(kind, node);
  return node;
}

/** Die Beschreibung eines einzelnen Bausteins — neben seinem Import im Editor. */
export const partDescription = (kind: string): string => describe(partFormat(kind));

/** Ein Modul im Bausteinverwalter — seine Art und, bei einem Formular, alles, was ein Formular trägt (FORM_FORMAT). */
const moduleJsons = new Map<string, JsonNode>();
export function moduleFormat(kind: string): JsonNode {
  const known = moduleJsons.get(kind);
  if (known !== undefined) return known;
  const def = partOf(kind);
  const form = kind === 'form';
  const node: JsonNode = {
    key: `module:${kind}`,
    get title() { return t('pagesJson.module.title', { format: MODULE_FORMAT }); },
    text: () => [
      t(form ? 'pagesJson.module.introForm' : 'pagesJson.module.intro'),
      '',
      t('pagesJson.module.keys', { format: MODULE_FORMAT }),
      ...(form ? [t('pagesJson.module.formKeys')] : []),
      ...(def === undefined ? [t('pagesJson.module.unknown', { kind })] : [])
    ].join('\n'),
    inside: () => [...(def === undefined ? [] : [kindNode(def)]), ...(form ? [FORM_FORMAT] : [])]
  };
  moduleJsons.set(kind, node);
  return node;
}

/** Die Beschreibung eines Moduls — neben seinem Import im Bausteinverwalter. */
export const moduleDescription = (kind: string): string => describe(moduleFormat(kind));
