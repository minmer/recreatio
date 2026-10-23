/**
 * Was die Seite der Einstellungen (`settings.ts`) die Hintergrundseite fragt — und
 * was zurückkommt. Die Seite selbst ruft den Dienst nie: Thunderbird gibt ihr nur
 * cloudFile, runtime und storage, und das Geheimnis bleibt an einer Stelle.
 */

export type SettingsAsk =
  | { readonly kind: 'state'; readonly accountId: string }
  | { readonly kind: 'connect'; readonly accountId: string; readonly code: string; readonly days: number }
  | { readonly kind: 'days'; readonly accountId: string; readonly days: number }
  | { readonly kind: 'disconnect'; readonly accountId: string };

export interface SettingsState {
  readonly connected: boolean;
  /** Wie das Połączenie auf recreatio.pl heisst. */
  readonly name: string | null;
  readonly days: number;
  /** Was der Bereich gerade teilt — `null`, wenn der Dienst nicht zu erreichen war. */
  readonly usage: { readonly held: number; readonly maxHeld: number; readonly today: number; readonly maxToday: number } | null;
  /** Was schiefging (ein falscher Kod, ein getrenntes Połączenie, kein Netz). */
  readonly error: string | null;
  /** Gerade getrennt — ein Satz für die Seite. */
  readonly note: string | null;
}
