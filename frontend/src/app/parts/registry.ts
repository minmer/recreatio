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
 * <b>0063 — die Bausteine der Ereignisseiten</b> sind herübergekommen: Tytuł,
 * Krótkie informacje, Plan, Mapa, Koszty, Pytania, Osoby, Pliki, Galeria
 * (`event/kit.tsx`). Was dort an einem eigenen Dienst hing — Zgłoszenia,
 * Karta uczestnika, Lista, Tematy —, hat im Neubau seine Entsprechung schon:
 * Formularz, Twoje zgłoszenie, Kroki, Rozmowa. Memy und die Bilder, die
 * Teilnehmer selbst in die Galerie legen, warten auf einen eigenen Dienst.
 *
 * <b>0064 — aus der Bibliothek:</b> Tekst z biblioteki (eine Predigt mit
 * Fussnoten und Quellen), Archiwum tekstów, Zbiór cytatów. Sie zeigen, was
 * in der Bibliothek veröffentlicht ist (`LibraryPublic.tsx`).
 *
 * <b>Nur, was sich heute zeigen lässt.</b> Der Altbestand hatte zwölf Arten;
 * mehrere hingen an Quellen, die es im Neubau nicht gibt. Eine Kachel
 * anzubieten, die dauerhaft leer bleibt, ist keine Vorbereitung, sondern ein
 * Versprechen, das die Seite nicht hält.
 */

import type { PartModule } from '../part';

import { calendarPart } from './calendar';
import { chatPart } from './chat';
import { contactPart } from './contact';
import { costsPart } from './costs';
import { factsPart } from './facts';
import { faqPart } from './faq';
import { filesPart } from './files';
import { galleryPart } from './gallery';
import { heroPart } from './hero';
import { hoursPart } from './hours';
import { linksPart } from './links';
import { mapPart } from './map';
import { formPart, massesPart, slotsPart } from './live';
import { noticePart } from './notice';
import { peoplePart } from './people';
import { planPart } from './plan';
import { seatChatPart, seatNotePart, seatSharedPart, seatStepsPart, seatSubmissionPart } from './seat';
import { textPart } from './text';
import { quotesPart } from './quotes';
import { writingPart } from './writing';
import { writingsPart } from './writings';

export const PARTS: readonly PartModule[] = [
  /* Was auf jeder Seite steht. */
  textPart,
  noticePart,
  hoursPart,
  contactPart,
  linksPart,

  /* Was eine Ereignisseite trägt (0063, aus dem Altbestand). */
  heroPart,
  factsPart,
  planPart,
  mapPart,
  costsPart,
  faqPart,
  peoplePart,
  filesPart,
  galleryPart,

  /* Was aus der Bibliothek kommt (0064): Predigten mit ihren Quellen, das Archiv, die Zitate. */
  writingPart,
  writingsPart,
  quotesPart,

  /* Was seinen Inhalt woanders herholt. */
  massesPart,
  calendarPart,
  formPart,
  slotsPart,
  chatPart,

  /* Was nur hinter einem persönlichen Link etwas zeigt (0028). */
  seatSubmissionPart,
  seatStepsPart,
  seatNotePart,
  seatSharedPart,
  seatChatPart
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
