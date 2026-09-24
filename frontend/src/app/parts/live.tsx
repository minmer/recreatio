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

import { definePart, maybeNumber, text, type RawConfig } from '../part';
import { FormCard } from '../FormCard';
import { MassCard } from '../MassCard';
import { SlotCard } from '../SlotCard';

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

export const massesPart = definePart<MassConfig>({
  kind: 'masses',
  label: 'Msze i intencje',
  use: 'Porządek mszy z kalendarza, z intencjami.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Porządek mszy' },
    { key: 'calendar', label: 'Kalendarz', kind: 'line', hint: 'Kennung — puste: wszystkie jawne' },
    { key: 'days', label: 'Ile dni pokazać', kind: 'line', hint: 'Puste: ile zmieści się w kafelku' }
  ],

  read: (raw: RawConfig): MassConfig => ({
    title: text(raw, 'title'),
    calendar: text(raw, 'calendar'),
    days: maybeNumber(raw, 'days')
  }),

  hasContent: () => true,

  View: ({ config, ctx }) => (
    <MassCard
      title={config.title}
      calendar={config.calendar}
      days={config.days}
      colSpan={ctx.box.colSpan}
      rowSpan={ctx.box.rowSpan}
    />
  )
});

/* -- Ein Formular ----------------------------------------------------------- */

interface FormConfig {
  readonly title: string;
  readonly portalUnder: string;
}

export const formPart = definePart<FormConfig>({
  kind: 'form',
  label: 'Formularz',
  use: 'Pytania i zgłoszenia; każdy dostaje własny adres.',
  box: { colSpan: 3, rowSpan: 3 },
  takes: true,

  /*
   * `sms` steht in den Feldern und NICHT in der Gestalt: die Vorlage liest die
   * Kanzlei (`FormOffice`), nicht die Seite. Sie hier auszulesen hiesse, sie
   * für jeden Besucher mitzuschicken, der sie nie zu sehen bekommt.
   */
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Zgłoszenie' },
    {
      key: 'portalUnder', label: 'Miejsca pod stroną', kind: 'line',
      hint: 'Adres podstrony — puste: o poziom wyżej'
    },
    {
      key: 'sms', label: 'Szablon wiadomości', kind: 'text',
      hint: 'Użyj {link}, żeby wstawić adres osoby'
    }
  ],

  read: (raw: RawConfig): FormConfig => ({
    title: text(raw, 'title'),
    portalUnder: text(raw, 'portalUnder')
  }),

  hasContent: () => true,

  View: ({ config, ctx }) => (
    <FormCard partId={ctx.partId} title={config.title} portalUnder={config.portalUnder} />
  )
});

/* -- Termine zum Aussuchen -------------------------------------------------- */

interface SlotConfig {
  readonly title: string;
  readonly calendar: string;
}

export const slotsPart = definePart<SlotConfig>({
  kind: 'slots',
  label: 'Terminy do wyboru',
  use: 'Kto otworzy swój adres, wybiera sobie godzinę.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Wybierz termin spotkania' },
    { key: 'calendar', label: 'Kalendarz', kind: 'line', hint: 'Kennung kalendarza z terminami' }
  ],

  read: (raw: RawConfig): SlotConfig => ({
    title: text(raw, 'title'),
    calendar: text(raw, 'calendar')
  }),

  hasContent: () => true,

  View: ({ config }) => <SlotCard title={config.title} calendar={config.calendar} />
});
