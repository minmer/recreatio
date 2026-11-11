/**
 * 2026-11-11 — WAS EINE FOLIE ALS TEXT ZEIGT (der Schritt „show" im Spieler einer Erzählung). Der Reihe nach:
 * <code>
 *   blocks    ein Feld „blocks" (eine Aussage, eine Folie im Format des Leitfadens): sein Zapis, ganz
 *   reading   sonst der Wzór tekstu des Rodzaju (`KindDef.reading`, z. B. "{tresc}"), wie in „Nowy temat"
 *   markup    sonst die Textfelder (Typ markup) in ihrer Reihenfolge — ohne Beschriftung, ohne das Feld des Titels
 * </code>
 * Nichts davon: `null` — dann zeigt der Spieler den Eintrag wie bisher mit seinen Feldern. Der Titel steht nie im Text
 * (der Spieler setzt ihn darüber), Verweisfelder (Ort, Linie) nie auf der Folie. Rein bis auf `readingOf` (die Bibliothek).
 */

import { readingOf } from './EntityReading';
import type { PublicEntity } from './publish';
import type { CogitaLibrary } from './store';

export interface SlideText {
  readonly text: string;
  /** Aus einem Feld „blocks" (eine Aussage) — dann ohne die Bilder des Eintrags darüber (wie bisher). */
  readonly blocks: boolean;
  readonly from: 'blocks' | 'reading' | 'markup';
}

export function slideText(entity: PublicEntity, lib: Pick<CogitaLibrary, 'entity' | 'look'> | null): SlideText | null {
  const blocks = entity.fields.find((f) => f.type === 'blocks');
  if (blocks !== undefined) return { text: blocks.text, blocks: true, from: 'blocks' };
  const full = lib === null ? undefined : lib.entity(entity.id);
  if (lib !== null && full !== undefined) {
    const shown = readingOf(lib as CogitaLibrary, full).shown;
    if (shown !== undefined && shown.trim() !== '') return { text: shown, blocks: false, from: 'reading' };
  }
  const prose = entity.fields.filter((f) => f.type === 'markup' && f.text.trim() !== '' && f.text.trim() !== entity.label.trim());
  if (prose.length > 0) return { text: prose.map((f) => f.text).join('\n\n'), blocks: false, from: 'markup' };
  return null;
}
