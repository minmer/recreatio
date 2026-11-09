/**
 * Die drei Bausteine, deren Inhalt WOANDERS liegt.
 *
 * <b>Sie haben immer etwas zu zeigen</b> — auch wenn in ihrem `config` nichts
 * als eine Überschrift steht. Ein Messplan trägt seinen Inhalt in
 * `app.calendar_item`, ein Formular seine Fragen als eigene Zeilen an seiner
 * Kennung. Bliebe für sie die Regel „leer heisst unsichtbar", fielen sie genau
 * dann aus der Seite, wenn sie richtig eingerichtet sind — und niemand käme
 * darauf, warum.
 *
 * Vorher hiess diese Ausnahme `live` und stand als Merkmal im Katalog, während
 * die Regel in der Zeichnung stand. Jetzt beantwortet jeder Baustein dieselbe
 * Frage, und diese drei antworten immer ja.
 *
 * <b>Sie stehen zusammen in einer Datei</b>, weil sie sich genau das teilen und
 * sonst nichts: jeder reicht seine Gestalt an ein Bauteil weiter, das es schon
 * gibt. Drei Dateien mit je acht Zeilen wären drei Wege zu derselben Zeile.
 */

import { t } from '../../core/i18n';
import { maybeNumber, text, type RawConfig } from '../part';
import { field, texts, textPart, withTexts } from './partTexts';
import { massSays, massView } from '../../masses/massShape';
import { later } from '../../ui/later';

/* 2026-10-17 — die Ansicht erst, wenn sie gezeigt wird (`ui/later`): eine Seite ohne diesen Baustein lädt sie nicht. */
const FormCard = later(() => import('../../forms/FormCard').then((m) => m.FormCard));
const MassCard = later(() => import('../../masses/MassCard').then((m) => m.MassCard));
const SlotCard = later(() => import('../../bookings/SlotCard').then((m) => m.SlotCard));

/* -- Messen und Intentionen ------------------------------------------------- */

interface MassConfig {
  readonly title: string;
  readonly calendar: string;

  /**
   * <b>`null` ist nicht 7.</b> Ohne Angabe richtet sich die Zahl nach dem, was
   * in die Kachel passt — eine Vorgabe daraus zu machen füllte jede flache
   * Kachel mit sieben Tagen, die sie nicht zeigen kann.
   */
  readonly days: number | null;
}

export const massesPart = textPart<MassConfig>(texts({ label: 'moduleData.masses.label', use: 'moduleData.masses.use' }), {
  kind: 'masses',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: withTexts({ days: '7' }, texts({ title: 'moduleData.masses.exTitle', calendar: 'moduleData.masses.exCalendar' })),
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    field({ key: 'title', kind: 'line' }, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleData.masses.titleHint' })),
    field({ key: 'calendar', kind: 'calendar' }, texts({ label: 'moduleData.masses.calendar' })),
    field({ key: 'days', kind: 'line' }, texts({ label: 'moduleData.masses.days', hint: 'moduleData.masses.daysHint' }))
  ],

  read: (raw: RawConfig): MassConfig => ({
    title: text(raw, 'title'),
    calendar: text(raw, 'calendar'),
    days: maybeNumber(raw, 'days')
  }),

  hasContent: () => true,

  /* Zwölf Grössen, zwölf Antworten — welche, steht in `massShape.ts`. */
  shows: (config, size) => massSays(massView(size, config.days)),
  fullscreen: true,

  View: ({ config, ctx }) => (
    <MassCard title={config.title} calendar={config.calendar} days={config.days} size={ctx.size} />
  )
});

/* -- Ein Formular ----------------------------------------------------------- */

interface FormConfig {
  readonly title: string;
  readonly portalUnder: string;
}

export const formPart = textPart<FormConfig>(texts({ label: 'moduleData.form.label', use: 'moduleData.form.use' }), {
  kind: 'form',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  /* 0086 — `portalAt`: der Zusatz zur Adresse nach dem Absenden. Die Wörter erst beim Lesen (`texts`). */
  example: Object.defineProperty(
    withTexts({ portalUnder: 'parafia/pielgrzymka', paper: 'sign', portalAt: '#twoje-zgloszenie' }, texts({ title: 'moduleData.form.exTitle', sentTitle: 'moduleData.form.exSentTitle', sentText: 'moduleData.form.exSentText', paperSigner: 'moduleData.form.exSigner' })),
    'smsTemplates',
    { enumerable: true, get: () => JSON.stringify([{ label: t('moduleData.form.exSmsLabel'), text: t('moduleData.form.exSmsText') }]) }
  ),

  /*
   * 2026-10-24 — DIE SPERREN DER WYMAGANIA (`needs`) führt das Formular selbst:
   * im JSON stehen die Wymagania als "needs" neben den Fragen (`needsJson.ts`),
   * nicht als Kennungen in der Tafel — kein Import überschreibt sie.
   */
  own: ['needs'],

  /* Was der Bogen trägt, ohne dass die Seite es zeigt — eingestellt wird es in seinem Reiter „Ustawienia". */
  extra: [
    withTexts({ key: 'title', shape: 'line' } as const, texts({ says: 'moduleData.form.sTitle' })),
    withTexts({ key: 'portalUnder', shape: 'line' } as const, texts({ says: 'moduleData.form.sPortalUnder' })),
    withTexts({ key: 'smsTemplates', shape: 'json', inside: texts({ '[].label': 'moduleData.form.sSmsLabel', '[].text': 'moduleData.form.sSmsText' }) } as const, texts({ says: 'moduleData.form.sSms' })),
    /* 0083 — was nach dem Absenden dasteht, und ob ein Ausdruck unterschrieben werden muss. */
    withTexts({ key: 'sentTitle', shape: 'line' } as const, texts({ says: 'moduleData.form.sSentTitle' })),
    withTexts({ key: 'sentText', shape: 'line' } as const, texts({ says: 'moduleData.form.sSentText' })),
    withTexts({ key: 'paper', shape: 'line' } as const, texts({ says: 'moduleData.form.sPaper' })),
    withTexts({ key: 'paperSigner', shape: 'line' } as const, texts({ says: 'moduleData.form.sSigner' })),
    withTexts({ key: 'portalAt', shape: 'line' } as const, texts({ says: 'moduleData.form.sPortalAt' }))
  ],
  box: { colSpan: 3, rowSpan: 3 },
  takes: true,

  /*
   * KEINE FELDER AUF DER SEITE — und das ist die Aussage.
   *
   * Überschrift, Nachrichtenvorlage und Portal gehören dem BOGEN, nicht der
   * Stelle, an der er steht: wer denselben Bogen auf zwei Seiten legt, soll
   * nicht zwei Überschriften pflegen. Eingestellt wird er dort, wo er wohnt
   * — auf seiner eigenen Seite (`FormOffice`), die ihn ohnehin führt.
   *
   * Die Seite wählt nur noch, WELCHEN sie zeigt (`PickModule`).
   */
  fields: [],

  read: (raw: RawConfig): FormConfig => ({
    title: text(raw, 'title'),
    portalUnder: text(raw, 'portalUnder')
  }),

  hasContent: () => true,

  /* Ein halbes Formular gibt es nicht: im Streifen ein Knopf, sonst das ganze. */
  strip: texts({ title: 'moduleData.form.label', open: 'moduleData.form.open' }),
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? t('moduleData.form.showsStrip')
    : t('moduleData.form.showsBlock'),

  View: ({ config, ctx }) => (
    <FormCard partId={ctx.moduleId} title={config.title} portalUnder={config.portalUnder} />
  )
});

/* -- Etwas für eine Zeit nehmen (0039) ------------------------------------ */

interface SlotConfig {
  readonly title: string;

  /**
   * Das Ding — ein Priester, ein Raum, ein Haus.
   *
   * <b>Einen Kalender statt des Dings gibt es nicht mehr.</b> Vor 0039 nahm
   * dieser Baustein eine Kalenderkennung; die einzigen zwei, die je gesetzt
   * wurden, trugen `con26/27/1` und nichts — keiner fand je einen Termin.
   * Einen Rückweg für Einstellungen zu halten, die nie funktioniert haben,
   * hieße, eine zweite Frage offen zu lassen, auf die es keine gute Antwort
   * gibt: welcher Zasób, wenn zwei denselben Kalender lesen?
   */
  readonly resource: string;
}

export const slotsPart = textPart<SlotConfig>(texts({ label: 'moduleData.slots.label', use: 'moduleData.slots.use' }), {
  kind: 'slots',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: texts({ title: 'moduleData.slots.exTitle', resource: 'moduleData.slots.exResource' }),

  /*
   * EIN BAUSTEIN FÜR BEIDES. Ein Treffen mit dem Priester und ein Haus in
   * Hortus Dei sind dasselbe: jemand nimmt sich einen Teil von etwas
   * Begrenztem, für eine Zeit. Welcher Fall es ist, sagt das Ding — nicht
   * dieser Baustein.
   */
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    field({ key: 'title', kind: 'line' }, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleData.slots.titleHint' })),
    field({ key: 'resource', kind: 'resource' }, texts({ label: 'moduleData.slots.resource' }))
  ],

  read: (raw: RawConfig): SlotConfig => ({
    title: text(raw, 'title'),
    resource: text(raw, 'resource')
  }),

  hasContent: () => true,

  /*
   * Im Streifen ein Knopf; sonst die Termine — breiter nebeneinander, damit
   * eine Woche Termine nicht zu einer Spalte wird, die man hinunterscrollt.
   */
  strip: texts({ title: 'moduleData.slots.label', open: 'moduleData.slots.open' }),
  fullscreen: true,
  shows: (_config, size) =>
    size.height === 'strip' ? t('moduleData.slots.showsStrip')
    : size.width === 'wide' ? t('moduleData.slots.showsWide')
    : size.width === 'full' ? t('moduleData.slots.showsFull')
    : t('moduleData.slots.showsBlock'),

  View: ({ config }) => <SlotCard title={config.title} resource={config.resource} />
});
