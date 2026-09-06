/**
 * Jede Art, aus der eine Veranstaltung gebaut wird.
 *
 * Die Reihenfolge ist die, in der sie im „Teil hinzufuegen"-Menue stehen —
 * ungefaehr die, in der man sie benutzt. Eine Art hinzuzufuegen heisst: eine
 * Datei schreiben und sie hier eintragen. Huelle, Herausgeber und Dienst
 * brauchen dafuer keine Aenderung.
 *
 * <b>Uebernommen aus dem alten Modul, aber noch nicht vollstaendig.</b> Dort
 * gibt es achtzehn Arten; hier stehen die elf, die mit dem auskommen, was der
 * Dienst heute hat.
 *
 * Zehn davon sind reine Ansichten ueber `configJson`. `form` ist die Ausnahme:
 * es liest Felder aus einer eigenen Tabelle — die gibt es im rc-Modell schon.
 *
 * Was noch fehlt und warum — jede Zeile unten ist eine Tabelle, die es noch
 * nicht gibt:
 *
 * <code>
 *   gallery         rc_event_photo fehlt (Anhaenge brauchen erst einen Traeger)
 *   meme            wie gallery, plus die Ablage der fertigen Bilder
 *   roster          rc_event_roster fehlt
 *   participantcard rc_event_card fehlt
 *   checklist       Fortschritt je Leser fehlt
 *   topics          rc_event_topic fehlt (und ueberschneidet sich mit dem Chat)
 *   registration    liegt am Dienst schon bereit, braucht nur die Ansicht
 * </code>
 *
 * <b>Eine unbekannte Art blendet nicht die Seite aus.</b> `getPartModule` gibt
 * `null`, und die Huelle schreibt eine Zeile hin. Eine Veranstaltung, die einen
 * `roster` enthaelt, bleibt also lesbar — nur diese eine Kachel sagt, dass sie
 * hier noch nicht dargestellt wird.
 */

import type { PartModule } from './contracts';
import { contactPart } from './ContactPart';
import { costsPart } from './CostsPart';
import { faqPart } from './FaqPart';
import { filesPart } from './FilesPart';
import { formPart } from './FormPart';
import { mapPart } from './MapPart';
import { peoplePart } from './PeoplePart';
import { planPart } from './PlanPart';
import { shortInfosPart } from './ShortInfosPart';
import { textPart } from './TextPart';
import { titlePart } from './TitlePart';

export const PART_MODULES: PartModule[] = [
  titlePart,
  shortInfosPart,
  textPart,
  planPart,
  mapPart,
  formPart,
  costsPart,
  faqPart,
  peoplePart,
  filesPart,
  contactPart
];

const BY_KIND = new Map<string, PartModule>(PART_MODULES.map((module) => [module.kind, module]));

export function getPartModule(kind: string): PartModule | null {
  return BY_KIND.get(kind) ?? null;
}

export function partLabel(kind: string): string {
  return BY_KIND.get(kind)?.label ?? kind;
}
