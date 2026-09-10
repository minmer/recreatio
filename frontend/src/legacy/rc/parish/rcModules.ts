/**
 * Der Bausteinkatalog der Pfarr-Startseite — übernommen aus
 * `parishModuleCatalog` in `pages/parish/ParishPage.tsx`.
 *
 * <b>Die Vorgabegrössen sind nicht geraten.</b> Sie stammen aus der alten
 * Seite und beschreiben, wie viel Platz ein Baustein wirklich braucht: ein
 * Kalender ist breit und hoch, ein Aushang schmal und flach. Wer einen
 * Baustein in der Vorgabegrösse ablegt, bekommt etwas, das sofort brauchbar
 * aussieht — und kann es danach ändern.
 *
 * Die Namen sind dieselben wie dort (`one-third` = 2 Spalten, `one-half` = 3,
 * `two-thirds` = 4, `full` = 6; Höhen `one` = 1, `three` = 3, `five` = 5),
 * nur schon in Rasterzahlen umgerechnet.
 */

export type RcModuleDef = {
  readonly type: string;
  readonly label: string;
  readonly colSpan: number;
  readonly rowSpan: number;
};

export const RC_MODULE_CATALOG: readonly RcModuleDef[] = [
  { type: 'intentions',    label: 'Intencje',    colSpan: 3, rowSpan: 3 },
  { type: 'sticky',        label: 'Aktualność',  colSpan: 2, rowSpan: 1 },
  { type: 'hours',         label: 'Godziny',     colSpan: 2, rowSpan: 1 },
  { type: 'news',          label: 'Aktualności', colSpan: 3, rowSpan: 3 },
  { type: 'announcements', label: 'Ogłoszenia',  colSpan: 2, rowSpan: 3 },
  { type: 'calendar',      label: 'Kalendarz',   colSpan: 4, rowSpan: 5 },
  { type: 'masses',        label: 'Msze',        colSpan: 4, rowSpan: 1 },
  { type: 'groups',        label: 'Grupy',       colSpan: 3, rowSpan: 3 },
  { type: 'events',        label: 'Wydarzenia',  colSpan: 3, rowSpan: 3 },
  { type: 'sacraments',    label: 'Sakramenty',  colSpan: 3, rowSpan: 3 },
  { type: 'contact',       label: 'Kontakt',     colSpan: 2, rowSpan: 1 },
  { type: 'gallery',       label: 'Galeria',     colSpan: 4, rowSpan: 3 }
];

/** Der Name eines Bausteins — oder sein Schlüssel, wenn es ihn nicht gibt. */
export const rcModuleLabel = (type: string): string =>
  RC_MODULE_CATALOG.find((m) => m.type === type)?.label ?? type;
