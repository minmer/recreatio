/**
 * Alle Bausteine, aus denen eine Seite gebaut werden kann.
 *
 * <b>Die EINZIGE Stelle, die sie alle kennt.</b> Die Zeichnung fragt hier nach,
 * der Editor holt hier die Liste, der Bausteinverwalter auch. Eine neue Art
 * hinzuzufügen heisst: eine Datei schreiben und sie hier eintragen.
 *
 * <b>Die Reihenfolge ist die der Liste „Baustein hinzufügen"</b> und damit
 * ungefähr die, in der man sie braucht: erst was jede Seite trägt, dann was
 * lebt, zuletzt was nur hinter einem persönlichen Link etwas zeigt.
 *
 * <b>Nur, was sich heute zeigen lässt.</b> Der Altbestand hatte zwölf Arten;
 * mehrere hingen an Quellen, die es im Neubau nicht gibt. Eine Kachel
 * anzubieten, die dauerhaft leer bleibt, ist keine Vorbereitung, sondern ein
 * Versprechen, das die Seite nicht hält — die Galerie fehlt deshalb weiterhin.
 */

import type { PartModule } from '../part';

import { contactPart } from './contact';
import { hoursPart } from './hours';
import { linksPart } from './links';
import { formPart, massesPart, slotsPart } from './live';
import { noticePart } from './notice';
import { seatNotePart, seatSharedPart, seatSubmissionPart } from './seat';
import { textPart } from './text';

export const PARTS: readonly PartModule[] = [
  /* Was auf jeder Seite steht. */
  textPart,
  noticePart,
  hoursPart,
  contactPart,
  linksPart,

  /* Was seinen Inhalt woanders herholt. */
  massesPart,
  formPart,
  slotsPart,

  /* Was nur hinter einem persönlichen Link etwas zeigt (0028). */
  seatSubmissionPart,
  seatNotePart,
  seatSharedPart
];

const BY_KIND = new Map(PARTS.map((one) => [one.kind, one]));

/**
 * Der Baustein zu einem Wort — oder nichts.
 *
 * <b>`undefined` ist ein echter Zustand.</b> Eine Seite kann eine Art tragen,
 * die diese Fassung des Browsers nicht kennt: sie wurde später hinzugefügt oder
 * früher entfernt. Sie wird dann NICHT gelöscht und nicht verschwiegen —
 * gezeigt wird, dass dort etwas steht, das hier niemand zeichnen kann.
 */
export const partOf = (kind: string): PartModule | undefined => BY_KIND.get(kind);

/** Der Name einer Art — oder ihr Wort, wenn es sie hier nicht gibt. */
export const partLabel = (kind: string): string => partOf(kind)?.label ?? kind;

/** Erzeugt diese Art Plätze? Dann muss dastehen, wem sie gehören (0038). */
export const takesEntries = (kind: string): boolean => partOf(kind)?.takes === true;
