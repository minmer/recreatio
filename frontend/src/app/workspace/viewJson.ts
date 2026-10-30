/**
 * 2026-10-29 — DER WIDOK ALS JSON ("recreatio/workspace-view", Fassung 1).
 *
 * <b>Was davon heute einstellbar ist.</b> Bis 2026-10-16 war ein Widok ein Baukasten — Teile, ihre Weisen,
 * ihre Reihenfolge, eigene Widoki (0094, damals als „recreatio.view"). Seitdem sind „Teraz" und der Überblick
 * eines Bereichs feste Seiten (`WorkspaceHome.tsx`); was ein Konto an ihnen noch selbst bestimmt, ist die Liste
 * „Czeka na Ciebie": welche Arten sich melden und in welcher Reihenfolge (`alerts.ts`, gemerkt versiegelt in
 * `prefs.ts`). Genau das trägt dieses Format — ein Format für Teile, die niemand mehr liest, wäre eine Falle
 * für den Assistenten, der es befüllt. Die Beschreibung sagt, dass der Aufbau fest ist.
 *
 * <b>An Ort und Stelle:</b> eine Art ist ihre Kennung (`kind`). Was das Dokument nennt, steht oben, in seiner
 * Reihenfolge; was es nicht nennt, behält sein Ein/Aus und folgt dahinter in der bisherigen Reihenfolge. Nicht
 * „hinter dem alten Vordermann" wie bei `readAlerts`: wer nur „forms, bookings" schreibt, meint diese zwei
 * oben — und nicht, dass alles, was bisher hinter „bookings" stand, mit nach oben wandert. Neue Arten gibt es
 * nicht — die kennt die App.
 */

import { describe, keyLines, pretty, type JsonNode } from '../core/jsonTree';
import { ALERT_KINDS, alertLabel, type AlertKind, type AlertSettings } from './alerts';

export const VIEW_FORMAT = 'recreatio/workspace-view';
export const VIEW_VERSION = 1;

const KNOWN = new Set<string>(ALERT_KINDS.map((one) => one.kind));

/* -- Die Sätze ----------------------------------------------------------------------------------------- */

const TOP_KEYS: Readonly<Record<string, string>> = {
  format: `"${VIEW_FORMAT}"`,
  version: `${VIEW_VERSION} — wersja formatu`,
  alerts: 'lista „Czeka na Ciebie” w Twojej kolejności — od góry (niżej); zamiast obiektu wystarczy sam "kind" jako tekst (wtedy włączenie zostaje, jakie było)'
};

const ALERT_KEYS: Readonly<Record<string, string>> = {
  kind: 'rodzaj powiadomienia (niżej) — po nim import rozpoznaje pozycję; każdy rodzaj najwyżej raz',
  on: 'true — pokazuje się w dzwonku i na stronie Teraz; false — wyłączony (nie liczy się też przy dzwonku); pominięte — zostaje, jak było',
  label: 'tylko informacja z eksportu: nazwa rodzaju (import jej nie zmienia)'
};

/** Jeder Schlüssel als Pfad (`alerts[].kind`) mit seinem Satz — für die Prüfung. */
export const VIEW_KEYS: Readonly<Record<string, string>> = {
  ...TOP_KEYS,
  ...Object.fromEntries(Object.entries(ALERT_KEYS).map(([k, v]) => [`alerts[].${k}`, v]))
};

/** Ein Beispiel aus der Kanzlei: Zgłoszenia und Rezerwacje zuerst, Powtórki aus — die übrigen bleiben, wie sie sind. */
const SAMPLE = {
  format: VIEW_FORMAT,
  version: VIEW_VERSION,
  alerts: [
    { kind: 'forms', label: alertLabel('forms'), on: true },
    { kind: 'bookings', label: alertLabel('bookings'), on: true },
    { kind: 'chats', label: alertLabel('chats'), on: true },
    { kind: 'records', label: alertLabel('records'), on: true },
    'today',
    { kind: 'learn', label: alertLabel('learn'), on: false }
  ]
};

/*
 * 2026-10-30 — WER DIE EINSTELLUNG LIEST: nur die Glocke (`NotifyBell.tsx`: Liste und Zahl, ohne „dziś") und
 * „Czeka na Ciebie" (`ViewParts.tsx` auf Teraz und im Überblick eines Bereichs, dort nur seine Bereiche);
 * die Zahlen aus einer Frage (`notify.ts`); was das Gerät meldet, stellt jedes Gerät selbst ein (`NotifySettings`).
 */
export const VIEW_USAGE_JSON: JsonNode = {
  key: 'workspace-view.usage',
  title: 'Jak aplikacja używa tych danych',
  text: () => `- Czytają to dwa miejsca: dzwonek (lista i liczba) i lista „Czeka na Ciebie” — na stronie Teraz i w przeglądzie każdego obszaru. Oba pokazują rodzaje w tej kolejności i pomijają wyłączone.
- Liczba przy dzwonku sumuje tylko włączone rodzaje, które się w niej liczą („Liczy się przy dzwonku”).
- Przegląd obszaru bierze z listy tylko to, co należy do tego obszaru i obszarów w nim; zadania, dołączenia przez link i powtórki stoją tylko na stronie Teraz i w dzwonku, a „Terminy dziś” — tylko na stronach (dzwonek ich nie wczytuje).
- Same liczby przychodzą z jednego zapytania o nowości — z tego, do czego masz dostęp. Ustawienie ich nie zmienia, niczego nie oznacza jako przejrzane i nie dotyczy innych osób.
- Powiadomienia systemowe każde urządzenie ustawia osobno („Na tym urządzeniu”) — rodzaj wyłączony tutaj może się tam nadal zgłaszać.`
};

export const VIEW_JSON: JsonNode = {
  key: 'workspace-view',
  title: `Widok — powiadomienia jako JSON ("${VIEW_FORMAT}", wersja ${VIEW_VERSION})`,
  short: 'Widok (powiadomienia)',
  text: () => `Co pokazuje dzwonek i lista „Czeka na Ciebie” na stronie Teraz (i w przeglądzie obszaru) — które rodzaje i w jakiej kolejności. Ustawienie należy do konta (zapieczętowane w przeglądarce) i działa na każdym urządzeniu. W aplikacji: „Powiadomienia” (dzwonek → „Ustawienia” albo Teraz → „Czeka na Ciebie” → „Ustaw”, #/workspace/account/widok) → „Powiadomienia jako JSON”.
Układ strony Teraz i przeglądu obszaru jest stały (od 2026-10-16): nie ma własnych widoków, części ani sposobów wyświetlania do ustawienia — nie ma ich więc w tym formacie. Ustawienia „Na tym urządzeniu” (powiadomienia systemowe) każde urządzenie ma własne — też poza formatem.
Co robi import:
- Najpierw pokazuje plan (nowa kolejność, co się włączy, co wyłączy); zapisuje dopiero po „Importuj”.
- Rodzaje z dokumentu stają na początku listy, w jego kolejności; "on" włącza albo wyłącza. Rodzaje, których w dokumencie nie ma, stoją za nimi — w dotychczasowej kolejności, włączone albo wyłączone jak dotąd. Wystarczy więc podać te, które mają być na górze.
- Nieznany rodzaj i powtórzony rodzaj — ostrzeżenie, pominięte. Niczego nie usuwa; nowych rodzajów nie tworzy (zna je aplikacja).
Zwróć JEDEN obiekt JSON, bez komentarzy.

Dokument:
${keyLines(TOP_KEYS)}

Pozycja (wpis w "alerts"):
${keyLines(ALERT_KEYS)}

Rodzaje ("kind"), w kolejności domyślnej:
${keyLines(Object.fromEntries(ALERT_KINDS.map((one) => [one.kind, `${one.label}: ${one.says}${one.counts ? ' Liczy się przy dzwonku.' : ''}`])))}

Przykład (kancelaria: zgłoszenia i rezerwacje na górze, powtórki wyłączone):
${pretty(SAMPLE)}`,
  inside: () => [VIEW_USAGE_JSON],
  samples: () => [{ label: 'Kancelaria: zgłoszenia i rezerwacje na górze', doc: () => SAMPLE }]
};

/** Die Beschreibung als Text — ohne Zusammenhang aufrufbar (MCP, `import-formats.mjs`). */
export const workspaceViewDescription = (): string => describe(VIEW_JSON);

/* -- Export -------------------------------------------------------------------------------------------- */

export function exportView(settings: AlertSettings): Record<string, unknown> {
  return {
    format: VIEW_FORMAT,
    version: VIEW_VERSION,
    alerts: settings.order.map((kind) => ({ kind, label: alertLabel(kind), on: !settings.off.includes(kind) }))
  };
}

/* -- Plan ---------------------------------------------------------------------------------------------- */

export interface ViewPlan {
  readonly next: AlertSettings;
  readonly changed: boolean;
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const described = (keys: Readonly<Record<string, string>>, key: string): boolean => Object.prototype.hasOwnProperty.call(keys, key);

/** Die genannten Arten oben, in ihrer Reihenfolge; die anderen dahinter, wie sie bisher standen. */
const merged = (named: readonly AlertKind[], now: readonly AlertKind[]): AlertKind[] =>
  [...named, ...now.filter((kind) => !named.includes(kind))];

const labels = (kinds: readonly AlertKind[]): string => kinds.map((kind) => alertLabel(kind)).join(', ');

export function planView(doc: unknown, now: AlertSettings): ViewPlan | { error: string } {
  if (!isObject(doc)) return { error: 'To nie jest dokument widoku (oczekiwano obiektu JSON).' };
  if (doc.format !== undefined && doc.format !== VIEW_FORMAT) return { error: `Inny format: "${String(doc.format)}" — oczekiwano "${VIEW_FORMAT}".` };
  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== VIEW_VERSION) warnings.push(`Wersja ${String(doc.version)} — znam wersję ${VIEW_VERSION}; czytam to, co rozpoznaję.`);
  for (const key of Object.keys(doc)) if (!described(TOP_KEYS, key)) warnings.push(`Nieznany klucz "${key}" — pominięty${key === 'parts' || key === 'views' ? ' (układ stron jest stały, nie ustawia się go)' : ''}.`);
  if (doc.alerts === undefined) return { next: now, changed: false, lines: ['Nic do zmiany — brak "alerts".'], warnings };
  if (!Array.isArray(doc.alerts)) return { error: '"alerts" musi być listą.' };

  const named: AlertKind[] = [];
  const off = new Set(now.off);
  doc.alerts.forEach((raw, i) => {
    const where = `Pozycja ${i + 1}`;
    const item = typeof raw === 'string' ? { kind: raw } : raw;
    if (!isObject(item)) { warnings.push(`${where}: to nie obiekt ani rodzaj — pominięta.`); return; }
    for (const key of Object.keys(item)) if (!described(ALERT_KEYS, key)) warnings.push(`${where}: nieznany klucz "${key}" — pominięty.`);
    if (typeof item.kind !== 'string' || !KNOWN.has(item.kind)) { warnings.push(`${where}: nieznany rodzaj „${String(item.kind)}” — pominięta.`); return; }
    const kind = item.kind as AlertKind;
    if (named.includes(kind)) { warnings.push(`${where}: „${alertLabel(kind)}” drugi raz — liczy się pierwsza.`); return; }
    named.push(kind);
    if (item.on === undefined || item.on === null) return;
    if (typeof item.on !== 'boolean') { warnings.push(`${where}: "on" to nie true/false — włączenie zostaje.`); return; }
    if (item.on) off.delete(kind); else off.add(kind);
  });

  const order = merged(named, now.order);
  const next: AlertSettings = { order, off: order.filter((kind) => off.has(kind)) };
  const turnedOn = now.off.filter((kind) => !off.has(kind));
  const turnedOff = order.filter((kind) => off.has(kind) && !now.off.includes(kind));
  const moved = order.some((kind, i) => now.order[i] !== kind);

  const lines: string[] = [];
  if (moved) lines.push(`Nowa kolejność: ${labels(order)}`);
  if (turnedOn.length > 0) lines.push(`Włączy: ${labels(turnedOn)}`);
  if (turnedOff.length > 0) lines.push(`Wyłączy: ${labels(turnedOff)}`);
  const changed = moved || turnedOn.length > 0 || turnedOff.length > 0;
  if (!changed) lines.push('Nic do zmiany — kolejność i włączenie jak teraz.');
  const missing = now.order.filter((kind) => !named.includes(kind));
  if (changed && missing.length > 0) lines.push(`Brak w dokumencie — za nimi, w dotychczasowej kolejności i z dotychczasowym włączeniem: ${labels(missing)}`);
  return { next, changed, lines, warnings };
}
