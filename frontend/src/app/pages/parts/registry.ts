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

import { animationPart } from './animation';
import { calendarPart } from './calendar';
import { chatPart } from './chat';
import { cogitaFlowPart, cogitaLivePart, cogitaRevisionPart, entityCardPart, entityTablePart, knowledgeMapPart, seatLearnPart, topicExplorerPart } from './cogita';
import { contactPart } from './contact';
import { costsPart } from './costs';
import { entryListPart, entryPanelPart } from './entries';
import { factsPart } from './facts';
import { faqPart } from './faq';
import { filesPart } from './files';
import { galleryPart } from './gallery';
import { heroPart } from './hero';
import { hoursPart } from './hours';
import { imagePart } from './image';
import { layersPart } from './layers';
import { linksPart } from './links';
import { mapPart } from './map';
import { formPart, massesPart, slotsPart } from './live';
import { noticePart } from './notice';
import { peoplePart } from './people';
import { particlesPart } from './particles';
import { lab2dPart } from './lab2d';
import { physicsPart } from './physics';
import { planPart } from './plan';
import { programPart } from './program';
import { questionPart } from './question';
import { shapePart } from './shape';
import { seatAskPart, seatChatPart, seatSharedPart, seatStepsPart, seatSubmissionPart, seatTasksPart } from './seat';
import { textPart } from './text';
import { quotesPart } from './quotes';
import { writingPart } from './writing';
import { writingsPart } from './writings';
import { viewPart } from './view';

export const PARTS: readonly PartModule[] = [
  /* Was auf jeder Seite steht. */
  textPart,
  noticePart,
  hoursPart,
  contactPart,
  linksPart,

  /* 0085 — ein Bild und eine Fläche: gebraucht von der Präsentation, auf jeder Seite zu haben. */
  imagePart,
  shapePart,

  /* 0107 — aus dem Pokaz von Cogita: ein Bild aus Ebenen mit eigener Bewegung, und die bewegten Bilder selbst. */
  layersPart,
  animationPart,

  /* 2026-10-18 — Laboratorium fizyki: ein fest eingebauter Motor, der Versuch als Dokument (Fizyka 2D). */
  physicsPart,

  /* 2026-10-19 — Laboratorium cząstek: eine Partikel-Engine (documentation/particles/), der Aufbau als Dokument. */
  particlesPart,

  /* 2026-10-20 — Laboratorium 2D: die Lab-Engine v2 (Gitter, APIC-Wasser, Blasen; documentation/lab2d/). */
  lab2dPart,

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

  /* 2026-10-21 — eine Frage zum Prüfen; in einer Präsentation ein Schritt des Przebiegs (dobrze / źle). */
  questionPart,

  /* 0109 — Cogita: was eine Bibliothek zum Lernen veröffentlicht — ohne Konto, Fortschritt im Browser. */
  cogitaRevisionPart,
  cogitaFlowPart,
  knowledgeMapPart,
  entityCardPart,
  entityTablePart,
  topicExplorerPart,
  /* 2026-10-22 (Schritt 9) — ein gespeicherter Widok einer Baza: Tabela oder Drzewo, der Zustand je Baustein in der Adresse. */
  viewPart,

  /* Was seinen Inhalt woanders herholt. */
  massesPart,
  calendarPart,
  /* 0070 — ein Termin mit seinen Teilen (Rekolekcje, Pielgrzymka, Festyn). */
  programPart,
  formPart,
  slotsPart,
  chatPart,
  /* 0109 — an einer Sitzung teilnehmen: Code oder Link. */
  cogitaLivePart,

  /* 0082 — für die Kanzlei: alle Menschen eines Formulars, und einer davon (oben auf der Seite gewählt). */
  entryListPart,
  entryPanelPart,

  /* Was nur hinter einem persönlichen Link etwas zeigt (0028). */
  seatSubmissionPart,
  seatStepsPart,
  /* 0098 — Aufgaben mit Zeitraum. */
  seatTasksPart,
  seatSharedPart,
  seatChatPart,
  seatAskPart,
  /* 0109 — die Powtórki eines Kurses für den Menschen hinter dem Link. */
  seatLearnPart
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
