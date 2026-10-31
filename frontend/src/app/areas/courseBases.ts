/**
 * 2026-11-01 — DIE BAZY EINES KURSES. Ein Kurs ist eine Hilfe, keine Bedingung: gelernt wird auf Seiten, aus beliebig
 * vielen Bazy wiedzy, und eine Baza steht in beliebig vielen Kursen (und auf Seiten ohne Kurs). Was ein Kurs „hat", ist
 * darum nur, was er nutzt:
 *
 * <code>
 *   die Bazy seines Bereichs           sie gehören ihm
 *   gemerkt (Art `library`, 0135)      „Dodaj istniejącą" — auch ohne Baustein auf der Seite
 *   auf seiner Hauptseite              jeder Baustein, der eine Baza nennt (ein Feld der Art `knowledge`)
 * </code>
 *
 * Keine Baza wird dafür geändert (früher setzte der Kurs ihre Ustawienia „Gdzie zapisują się odpowiedzi" — dann
 * gehörten die Antworten aller Kurse dem ersten). Wohin die Antworten gehen, sagt jeder Lernbaustein selbst
 * (`answers`, `cogita/answersTo.ts`); auf der Seite eines Kurses: in den Kurs.
 *
 * Rein, ohne Netz — geprüft in `scripts/app-duty-check.mjs`.
 */

export interface LibLike { readonly libraryId: string; readonly areaId: string }
export interface KeyLike { readonly kind: string; readonly key: string; readonly refId: string | null }
export interface PartLike { readonly id: string; readonly kind: string; readonly config: Readonly<Record<string, string | undefined>> }

/** Unter diesem Schlüssel (Art `library`) merkt sich ein Kurs eine Baza; das eine `base` von 0135 zählt auch. */
export const baseKey = (libraryId: string): string => `base-${libraryId.toLowerCase()}`;

/** Bausteine, die mit einer Baza lernen und Antworten schicken — sie nennen ihren Bereich (`answers`). */
export const LEARNING_KINDS: readonly string[] = ['cogita-revision', 'cogita-flow', 'seat-learn'];

export interface CourseBaseRef {
  readonly libraryId: string;
  /** Im Bereich des Kurses. */
  readonly own: boolean;
  /** Die Schlüssel, unter denen der Kurs sie führt (zum Vergessen beim „Odłącz"). */
  readonly keys: readonly string[];
  /** Bausteine der Hauptseite, die sie nennen. */
  readonly parts: readonly string[];
  /** Davon Lernbausteine (Powtórka, Przebieg, Nauka) — „na stronie głównej". */
  readonly learning: readonly string[];
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * Die Bazy eines Kurses, in Ordnung: die eigenen zuerst (wie gegeben), dann die der Hauptseite (in ihrer Folge), dann
 * die nur gemerkten. `knowledgeFields`: welche Felder einer Bausteinart eine Baza nennen.
 */
export function courseBaseRefs(input: {
  readonly areaId: string;
  readonly knowledge: readonly LibLike[];
  readonly keys: readonly KeyLike[];
  readonly parts: readonly PartLike[];
  readonly knowledgeFields: (kind: string) => readonly string[];
}): CourseBaseRef[] {
  const order: string[] = [];
  const add = (id: string) => { if (id !== '' && !order.some((o) => same(o, id))) order.push(id); };
  for (const lib of input.knowledge) if (same(lib.areaId, input.areaId)) add(lib.libraryId);
  const named = input.parts.map((part) => ({
    part,
    ids: input.knowledgeFields(part.kind).map((key) => (part.config[key] ?? '').trim()).filter((id) => id !== '')
  }));
  for (const { ids } of named) ids.forEach(add);
  const kept = input.keys.filter((k) => k.kind === 'library' && k.refId !== null && k.refId !== '');
  for (const k of kept) add(k.refId!);
  return order.map((libraryId) => {
    const own = input.knowledge.some((lib) => same(lib.libraryId, libraryId) && same(lib.areaId, input.areaId));
    const using = named.filter(({ ids }) => ids.some((id) => same(id, libraryId))).map(({ part }) => part);
    return {
      libraryId, own,
      keys: kept.filter((k) => same(k.refId!, libraryId)).map((k) => k.key),
      parts: using.map((p) => p.id),
      learning: using.filter((p) => LEARNING_KINDS.includes(p.kind)).map((p) => p.id)
    };
  });
}

/**
 * Lernbausteine der Hauptseite, deren Antworten NICHT ausdrücklich in den Kurs gehen — kein Bereich genannt (dann
 * entscheidet die Powtórka oder die Baza, also womöglich ein anderer Kurs) oder einer ausserhalb. Ein Bereich IM Kurs
 * (`inside`: die Prowadzący mit eigenem Bereich darin) ist richtig: dorthin schicken die Uczący się des Kurses auch.
 */
export function strayLearning(parts: readonly PartLike[], areaId: string, inside: (areaId: string) => boolean = () => false): PartLike[] {
  return parts.filter((p) => {
    if (!LEARNING_KINDS.includes(p.kind)) return false;
    const said = (p.config.answers ?? '').trim();
    return said === '' || !(same(said, areaId) || inside(said));
  });
}

/** Liegt ein Bereich in einem anderen (über die Elternbereiche, höchstens 16 Stufen)? `parentOf`: was ich von ihm weiss. */
export function isInside(areaId: string, outer: string, parentOf: (areaId: string) => string | null): boolean {
  let at = parentOf(areaId);
  for (let n = 0; at !== null && n < 16; n += 1) {
    if (same(at, outer)) return true;
    at = parentOf(at);
  }
  return false;
}

/**
 * Wohin die Lernbausteine einer Baza auf der Hauptseite die Antworten schicken — dort sieht die Lehrerin ihre Uczący
 * się. Ein einziger genannter Bereich: der; sonst (keiner oder mehrere) der Kurs.
 */
export function answersOfBase(parts: readonly PartLike[], learning: readonly string[], areaId: string): string {
  const said = [...new Set(parts.filter((p) => learning.includes(p.id)).map((p) => (p.config.answers ?? '').trim().toLowerCase()))];
  return said.length === 1 && said[0] !== '' ? parts.find((p) => (p.config.answers ?? '').trim().toLowerCase() === said[0])!.config.answers!.trim() : areaId;
}

/**
 * Schliesst „Odłącz" den Bereich einer Baza für die Uczący się? Nie den Kurs selbst — und nicht, solange dort noch eine
 * andere Baza des Kurses liegt (die lesen sie weiter).
 */
export function closesArea(areaId: string, leaving: LibLike, remaining: readonly LibLike[]): boolean {
  if (same(leaving.areaId, areaId)) return false;
  return !remaining.some((lib) => !same(lib.libraryId, leaving.libraryId) && same(lib.areaId, leaving.areaId));
}
