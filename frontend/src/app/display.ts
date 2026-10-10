/**
 * SPOSÓB WYŚWIETLANIA (0094) — wie sich jeder Teil des Arbeitsplatzes zeigt:
 * einfach, oder erweitert.
 *
 * <b>Einfach ist für alle die Vorgabe.</b> Der Arbeitsplatz ist Teil für Teil
 * gewachsen, und jeder Teil zeigt seit langem alles, was er kann: Schlüssel
 * und Epochen, sieben Reiter eines Formulars, den Rollengraphen. Wer nur
 * wissen will, wer sich angemeldet hat, braucht davon fast nichts. Also zeigt
 * jeder Teil zuerst seinen einfachen Weg; der erweiterte liegt im selben
 * Auswahlfeld daneben.
 *
 * <b>Mehrere Wege, ein Feld.</b> Ein Teil kann mehr als zwei haben (die Liste
 * der Strony, ihr Baum); jeder Weg sagt, ob er erweitert ist. Wer einen
 * anderen wählt, sieht ihn sofort — gemerkt wird er erst mit „Zapisz"
 * (`save`), dann für dieses Konto auf jedem Gerät (versiegelt, `prefs.ts`).
 * Bis dahin gilt er nur in dieser Karte. Die Einstellungen (Konto → Wygląd
 * warsztatu) zeigen alle Teile untereinander.
 */

import { useSyncExternalStore } from 'react';

import { setValue, useRemembered } from './prefs';

export type Tool = 'areas' | 'forms' | 'modules' | 'pages' | 'pageEditor' | 'roles' | 'addresses';

export interface DisplayMode {
  readonly id: string;
  readonly label: string;
  /** Der erweiterte Weg — mehr Möglichkeiten, mehr zu verstehen. */
  readonly extended: boolean;
  /** Was er zeigt, in einem Satz. */
  readonly says: string;
}

export interface ToolDef {
  readonly tool: Tool;
  readonly label: string;
  readonly modes: readonly DisplayMode[];
}

const simple = (id: string, label: string, says: string): DisplayMode => ({ id, label, extended: false, says });
const extended = (id: string, label: string, says: string): DisplayMode => ({ id, label, extended: true, says });

/** Jeder Teil mit seinen Wegen — der erste ist die Vorgabe, und er ist einfach. */
export const TOOLS: readonly ToolDef[] = [
  { tool: 'areas', label: 'Obszary', modes: [
    simple('view', 'Widok obszaru', 'Co nowego, terminy, rozmowy, formularze, osoby i dostęp — w jednym miejscu.'),
    extended('full', 'Szczegóły obszaru', 'Także epoki i klucze, role z poziomami, dostęp dla wszystkich, ustawienia.')
  ] },
  { tool: 'forms', label: 'Formularz', modes: [
    simple('simple', 'Trzy zakładki', 'Zgłoszenia, Formularz i Ustawienia — to, czego używa się co dzień.'),
    extended('full', 'Wszystkie zakładki', 'Także układ i logika, znaczniki, tabela zgłoszeń, JSON.')
  ] },
  { tool: 'modules', label: 'Moduły', modes: [
    simple('forms', 'Formularze', 'Tylko formularze — z liczbą zgłoszeń i nowymi.'),
    extended('all', 'Wszystkie moduły', 'Każdy rodzaj modułu, nieużywane moduły, mapa zależności.')
  ] },
  { tool: 'pages', label: 'Strony', modes: [
    simple('list', 'Lista stron', 'Twoje strony — otwórz, edytuj, udostępnij.'),
    extended('tree', 'Drzewo i adresy', 'Drzewo podstron, przejmowanie adresów, ostatnio edytowane.')
  ] },
  { tool: 'pageEditor', label: 'Edytor strony', modes: [
    simple('simple', 'Moduły strony', 'Układ modułów, wygląd i zapis.'),
    extended('full', 'Z mapą logiki i JSON', 'Także mapa logiki strony i cała strona jako JSON.')
  ] },
  { tool: 'roles', label: 'Role', modes: [
    simple('simple', 'Dostęp w obszarach', 'Kto ma dostęp, widać w każdym obszarze i przy linkach.'),
    extended('full', 'Graf ról', 'Wszystkie role, kto kogo trzyma i na jakim stopniu.')
  ] },
  { tool: 'addresses', label: 'Adresy i domeny', modes: [
    simple('simple', 'Ukryte', 'Aliasy i własne domeny ustawia się rzadko.'),
    extended('full', 'Adresy i domeny', 'Drugie wejście na stronę: alias albo własna domena.')
  ] }
];

export const toolDef = (tool: Tool): ToolDef => TOOLS.find((one) => one.tool === tool)!;

/** Der Weg zu einer Kennung — eine unbekannte (alte, umbenannte) fällt auf die Vorgabe. */
export function modeOf(tool: Tool, id: string | null | undefined): DisplayMode {
  const def = toolDef(tool);
  return def.modes.find((one) => one.id === id) ?? def.modes[0];
}

const slot = (tool: Tool) => `display.${tool}`;

/* -- Ausprobiert, noch nicht gemerkt (nur diese Karte) --------------------------------------- */

const trying = new Map<Tool, string>();
const listeners = new Set<() => void>();
let stamp = 0;
const ping = () => { stamp += 1; for (const one of listeners) one(); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export interface Display {
  readonly def: ToolDef;
  /** Was gerade gilt (ausprobiert oder gemerkt). */
  readonly mode: DisplayMode;
  /** Was gemerkt ist. */
  readonly saved: DisplayMode;
  readonly extended: boolean;
  /** Etwas anderes ausprobiert, als gemerkt ist. */
  readonly trying: boolean;
  /** Einen Weg ausprobieren (nur diese Karte). */
  readonly pick: (id: string) => void;
  /** Das Ausprobierte merken — für das Konto, auf jedem Gerät. */
  readonly save: () => void;
  /** Zurück zum Gemerkten. */
  readonly reset: () => void;
}

export function useDisplay(tool: Tool): Display {
  useSyncExternalStore(subscribe, () => stamp);
  const [savedId] = useRemembered(slot(tool), '');
  const def = toolDef(tool);
  const saved = modeOf(tool, savedId);
  const mode = modeOf(tool, trying.get(tool) ?? saved.id);

  return {
    def, mode, saved,
    extended: mode.extended,
    trying: mode.id !== saved.id,
    pick: (id) => {
      if (id === saved.id) trying.delete(tool); else trying.set(tool, id);
      ping();
    },
    save: () => {
      setValue(slot(tool), mode.id);
      trying.delete(tool);
      ping();
    },
    reset: () => { trying.delete(tool); ping(); }
  };
}

/** Den Weg eines Teils gleich merken — aus den Einstellungen. */
export function saveDisplay(tool: Tool, id: string): void {
  setValue(slot(tool), modeOf(tool, id).id);
  trying.delete(tool);
  ping();
}

/** Für Prüfstände und die Abmeldung: nichts mehr ausprobiert. */
export function forgetTrying(): void {
  trying.clear();
  ping();
}
