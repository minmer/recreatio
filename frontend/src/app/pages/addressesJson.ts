/**
 * 2026-10-29 — ADRESY I DOMENY ALS JSON ("recreatio/addresses", Fassung 1): die Aliase und eigenen Domains des
 * Kontos — hinaus, und herein mit dem Plan vor dem Knopf und der Beschreibung daneben, wie überall (`JsonPanel`).
 * Ein Assistent liest dieselbe Beschreibung über MCP (`get_import_format`).
 *
 * <b>Der Import kann genau, was die Ansicht kann</b> (`Addresses.tsx`): einen Alias unter einer eigenen Wurzel
 * anlegen (`declareAlias`), eine Domain an eine Wurzel hängen, sie ersetzen oder — nur mit ausdrücklichem
 * `"host": null` — abnehmen (`bindDomain`). Einen Alias umhängen oder löschen kann die App nicht, also auch der
 * Import nicht; er sagt es, statt still zu übergehen.
 *
 * <b>Was ausserhalb liegt, sagt der Plan mit</b>: DNS, der Ort der Dateien unter dem neuen Namen und `Api:Origins`
 * des Dienstes. Keine Zeile in der Datenbank — und der häufigste Grund, warum eine Domain „nicht geht".
 *
 * Rein bis auf `applyAddresses`, und auch das bekommt seine zwei Aufrufe hereingereicht: die Reihenfolge der
 * Domains (erst abnehmen, dann anhängen) lässt sich so ohne Dienst prüfen (`app-json-addresses-check.mjs`).
 */

import { describe, keyLines, pretty, type JsonNode } from '../core/jsonTree';
import { plural } from '../core/plural';
import { PATH_SHAPE } from '../routes';
import type { PageCard } from '../workspace/desk';

export const ADDRESSES_FORMAT = 'recreatio/addresses';
export const ADDRESSES_VERSION = 1;

/**
 * Wohin eine eigene Domain zeigen muss — abgelesen von recreatio.pl selbst: die Adressen von GitHub Pages, wo
 * diese Oberfläche liegt. Seit 2026-10-29 hier und nicht mehr in `Addresses.tsx`, damit Ansicht, Plan und
 * Beschreibung dieselben Zeilen sagen; ändert sich das Hosting, ändert es sich an EINER Stelle.
 */
export const PAGES_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
export const PAGES_AAAA = ['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153'];
export const PAGES_CNAME = 'minmer.github.io';

/** Klein, mit Punkt, ohne Schema und ohne Pfad — wie `Slug.IsHostName` im Dienst. */
export const HOST_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

/** Höchstens so viele je Dokument — mehr ist kein Import zum Durchsehen. */
export const MAX_ALIASES = 200;
export const MAX_DOMAINS = 50;

/* -- Die Sätze — eine Stelle für Beschreibung und Prüfung ------------------------------------------------- */

const TOP_KEYS: Readonly<Record<string, string>> = {
  format: `"${ADDRESSES_FORMAT}"`,
  version: `${ADDRESSES_VERSION} — wersja formatu`,
  pages: 'tylko informacja z eksportu: adresy stron, które prowadzisz — tylko one mogą być celem aliasu ("target") i stroną domeny ("path"); "" to samo recreatio.pl',
  roles: 'tylko informacja z eksportu: Twoje role, które mogą odpowiadać za alias (niżej)',
  aliases: `aliasy (niżej), najwyżej ${MAX_ALIASES}`,
  domains: `własne domeny (niżej), najwyżej ${MAX_DOMAINS}`
};

const ROLE_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator roli — tego używa "role" aliasu',
  name: 'nazwa roli, jak widzisz ją w warsztacie'
};

const ALIAS_KEYS: Readonly<Record<string, string>> = {
  path: 'adres aliasu bez "recreatio.pl/", np. "parafia/news": małe litery, cyfry i myślniki, części oddzielone ukośnikiem; musi leżeć POD adresem, który prowadzisz (adres najwyższego poziomu, jak "cogita", wydaje serwer z kodem); po nim import rozpoznaje alias, który już jest',
  target: 'adres strony, na którą alias prowadzi — jeden z "pages" (nie inny alias: łańcuchów nie ma)',
  role: 'kto odpowiada za alias: "id" z "roles"; pominięta — rola, która prowadzi stronę docelową'
};

const DOMAIN_KEYS: Readonly<Record<string, string>> = {
  path: 'strona, którą domena pokazuje — jeden z "pages" (strona ma najwyżej jedną domenę); po nim import rozpoznaje domenę, która już jest',
  host: 'sama nazwa domeny, np. "cogita.pl": małe litery, z kropką, bez "https://" i bez ścieżki (do 200 znaków); inna niż obecna — zamienia ją; null — odpina domenę od tej strony (jedyny sposób usunięcia w tym formacie)'
};

/** Jeder Schlüssel als Pfad (`aliases[].path`) mit seinem Satz — für die Prüfung, dass nichts unbeschrieben bleibt. */
export const ADDRESSES_KEYS: Readonly<Record<string, string>> = {
  ...TOP_KEYS,
  ...Object.fromEntries(Object.entries(ROLE_KEYS).map(([k, v]) => [`roles[].${k}`, v])),
  ...Object.fromEntries(Object.entries(ALIAS_KEYS).map(([k, v]) => [`aliases[].${k}`, v])),
  ...Object.fromEntries(Object.entries(DOMAIN_KEYS).map(([k, v]) => [`domains[].${k}`, v]))
};

const SAMPLE_ROLE = '0190a0a0-0000-7000-8000-0000000000a1';

const SAMPLE = {
  format: ADDRESSES_FORMAT,
  version: ADDRESSES_VERSION,
  pages: ['parafia', 'parafia/aktualnosci', 'cogita'],
  roles: [{ id: SAMPLE_ROLE, name: 'Kancelaria parafii (rola)' }],
  aliases: [{ path: 'parafia/news', target: 'parafia/aktualnosci', role: SAMPLE_ROLE }],
  domains: [{ path: 'cogita', host: 'cogita.pl' }]
};

/** Was ausserhalb der App bleibt — in der Beschreibung und im Plan dieselben Sätze. */
const OUTSIDE: readonly string[] = [
  `DNS u rejestratora domeny: A dla samej domeny → ${PAGES_A.join(', ')}; AAAA → ${PAGES_AAAA.join(', ')}; CNAME dla „www” → ${PAGES_CNAME}.`,
  'Osobne miejsce na pliki strony pod tą nazwą: GitHub Pages przyjmuje jedną własną domenę na repozytorium, a tą jest już recreatio.pl — potrzebne osobne repozytorium z plikiem CNAME albo inny hosting plików statycznych.',
  'Zgoda usługi: nazwa domeny w „Api:Origins” usługi api.recreatio.pl — ustawia ją administrator serwera; bez tego strona pod domeną nie odczyta danych.'
];

/*
 * 2026-10-30 — WAS EIN ZWEITER WEG BEWIRKT: der Dienst folgt ihm zum Ziel und nimmt alles von dort
 * (`Page.Write.cs`: Inhalt, Aussehen, Zugang, Sperre); unter der eigenen Domain sind die Unterwege lokal
 * (`Page.Show.cs`); Rechte gibt er keine (`Slug.cs`); in der Wahl einer Seite stehen Aliase nicht (`aliasOf`).
 */
export const ADDRESSES_USAGE_JSON: JsonNode = {
  key: 'addresses.usage',
  title: 'Jak aplikacja używa tych danych',
  text: () => `- Alias i domena to tylko drugie wejście: usługa prowadzi je do strony docelowej i stamtąd bierze wszystko — tytuł, wstęp, moduły, wygląd. Zmiana strony jest od razu widoczna pod każdym wejściem.
- Pod własną domeną podstrony mają krótsze adresy: na cogita.pl strona cogita/kursy to #/kursy.
- Dostęp idzie za stroną docelową: strona tylko z dostępem (także zapieczętowana) zostaje taka pod aliasem i pod domeną, a zablokowana po zgłoszeniu nie pokazuje się pod żadnym wejściem.
- Nikt nie dostaje nowych praw: stronę edytują dalej ci, którzy prowadzą jej adres. "role" aliasu mówi tylko, kto nim zarządza — nie, kto widzi stronę.
- Alias nie jest osobną stroną: tam, gdzie wybiera się stronę (np. przy linkach dostępu), go nie ma — wybiera się stronę docelową. Mapa zależności pokazuje domenę przy jej stronie.`
};

export const ADDRESSES_JSON: JsonNode = {
  key: 'addresses',
  title: `Adresy i domeny jako JSON ("${ADDRESSES_FORMAT}", wersja ${ADDRESSES_VERSION})`,
  short: 'Adresy i domeny',
  text: () => `Aliasy i własne domeny stron, które prowadzi to konto (Warsztat → Ustawienia → „Adresy i domeny” → „Import i eksport (JSON)”, #/workspace/addresses). Alias to drugie wejście na stronę wewnątrz recreatio.pl (recreatio.pl/parafia/news pokazuje parafia/aktualnosci); własna domena pokazuje stronę pod inną nazwą (cogita.pl pokazuje recreatio.pl/cogita). Treść zostaje tam, gdzie leży — wejście tylko na nią wskazuje.
Co robi import:
- Najpierw pokazuje plan zmian z ostrzeżeniami; zapisuje dopiero po „Importuj”.
- Alias, którego jeszcze nie ma, zakłada. Alias, który już jest, rozpoznaje po "path": ten sam cel — bez zmian; inny cel — ostrzeżenie (celu aliasu nie da się zmienić ani aliasu usunąć — także w aplikacji).
- Domenę podpina do strony "path", zamienia na inną albo — tylko przy "host": null — odpina. Przeniesienie domeny na inną stronę: przy starej stronie "host": null (albo inna domena), przy nowej ta domena — import najpierw odpina, potem podpina.
- Strony, których nie ma w "domains", i aliasy, których nie ma w "aliases", zostają bez zmian. Niczego innego nie usuwa.
- Adresów nie przejmuje: adres najwyższego poziomu (np. recreatio.pl/cogita) wydaje serwer z kodem — „Strony” → „Przejmij adres”.
Co zostaje poza aplikacją — dla każdej nowej domeny (plan przypomina o tym przy imporcie):
${OUTSIDE.map((line, i) => `${i + 1}. ${line}`).join('\n')}
Logowanie pod własną domeną wymaga jeszcze api.<domena> (CNAME na tę samą usługę, z certyfikatem) — to również praca na serwerze; strony publiczne działają bez tego.
Zwróć JEDEN obiekt JSON, bez komentarzy.

Dokument:
${keyLines(TOP_KEYS)}

Alias (wpis w "aliases"):
${keyLines(ALIAS_KEYS)}

Domena (wpis w "domains"):
${keyLines(DOMAIN_KEYS)}

Rola (wpis w "roles", tylko informacja):
${keyLines(ROLE_KEYS)}

Przykład:
${pretty(SAMPLE)}`,
  inside: () => [ADDRESSES_USAGE_JSON],
  samples: () => [{ label: 'Alias i własna domena', doc: () => SAMPLE }]
};

/** Die Beschreibung als Text — ohne Zusammenhang aufrufbar (MCP, `import-formats.mjs`). */
export const addressesDescription = (): string => describe(ADDRESSES_JSON);

/* -- Export ---------------------------------------------------------------------------------------------- */

/** Was Export und Plan brauchen: die Adressen des Kontos und die Rollen, die übernehmen können (`takers`). */
export interface AddressState {
  readonly pages: readonly Pick<PageCard, 'path' | 'roleId' | 'aliasOf' | 'host'>[];
  readonly roles: readonly { readonly id: string; readonly name: string }[];
}

const byPath = <T extends { path: string }>(a: T, b: T) => a.path.localeCompare(b.path);

export function exportAddresses(state: AddressState): Record<string, unknown> {
  return {
    format: ADDRESSES_FORMAT,
    version: ADDRESSES_VERSION,
    pages: state.pages.filter((p) => p.aliasOf === null).map((p) => p.path).sort(),
    roles: state.roles.map((r) => ({ id: r.id, name: r.name })),
    aliases: [...state.pages].filter((p) => p.aliasOf !== null).sort(byPath).map((p) => ({ path: p.path, target: p.aliasOf, role: p.roleId })),
    domains: [...state.pages].filter((p) => p.host !== null).sort(byPath).map((p) => ({ path: p.path, host: p.host }))
  };
}

/* -- Plan ------------------------------------------------------------------------------------------------- */

export interface PlannedAlias {
  readonly path: string;
  readonly target: string;
  readonly roleId: string;
  readonly roleName: string;
}

export interface PlannedDomain {
  readonly path: string;
  /** Der neue Name — `null`: abnehmen. */
  readonly host: string | null;
  /** Was bisher dort hing. */
  readonly was: string | null;
}

export interface AddressPlan {
  readonly aliases: readonly PlannedAlias[];
  /** In der Reihenfolge, in der sie gehen: erst abnehmen, dann anhängen — ein Name wird frei, bevor er wandert. */
  readonly domains: readonly PlannedDomain[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Ein beschriebener Schlüssel — eigener, nicht geerbter (sonst wäre „toString" bekannt). */
const described = (keys: Readonly<Record<string, string>>, key: string): boolean => Object.prototype.hasOwnProperty.call(keys, key);

/** Eine Adresse, wie Menschen und Assistenten sie schreiben: mit oder ohne Schema, `recreatio.pl/`, `#/`, Schrägstriche. */
export const pathOf = (raw: string): string =>
  raw.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^(?:www\.)?recreatio\.pl(?=\/|#|$)/, '')
    .replace(/^[/#]+|\/+$/g, '');

/** Ein Name, wie das Formular der Ansicht ihn liest: ohne Schema, ohne Pfad, klein. */
export const hostOf = (raw: string): string =>
  raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');

const shown = (path: string) => (path === '' ? 'recreatio.pl' : `recreatio.pl/${path}`);

/** Liegt der Elternpfad unter einer Wurzel, die das Konto führt? Dort entsteht die neue Zeile (`Slug.AliasAsync`). */
const ledFrom = (parent: string, roots: readonly string[]): boolean =>
  roots.some((root) => root === '' || parent === root || parent.startsWith(`${root}/`));

export function planAddresses(doc: unknown, state: AddressState): AddressPlan | { error: string } {
  if (!isObject(doc)) return { error: 'To nie jest dokument adresów (oczekiwano obiektu JSON).' };
  if (doc.format !== undefined && doc.format !== ADDRESSES_FORMAT) return { error: `Inny format: "${String(doc.format)}" — oczekiwano "${ADDRESSES_FORMAT}".` };

  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== ADDRESSES_VERSION) warnings.push(`Wersja ${String(doc.version)} — znam wersję ${ADDRESSES_VERSION}; czytam to, co rozpoznaję.`);
  for (const key of Object.keys(doc)) if (!described(TOP_KEYS, key)) warnings.push(`Nieznany klucz "${key}" — pominięty.`);

  const roots = state.pages.filter((p) => p.aliasOf === null).map((p) => p.path);
  const page = new Map(state.pages.map((p) => [p.path, p]));
  const roleName = new Map(state.roles.map((r) => [r.id, r.name]));

  /* -- Aliasy -- */
  const aliases: PlannedAlias[] = [];
  let aliasesKept = 0;
  const listOf = (key: 'aliases' | 'domains', max: number): unknown[] => {
    const value = doc[key];
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) { warnings.push(`"${key}" musi być listą — pominięte.`); return []; }
    if (value.length > max) warnings.push(`"${key}": ${value.length} pozycji — biorę pierwsze ${max}.`);
    return value.slice(0, max);
  };

  const seenAliases = new Set<string>();
  listOf('aliases', MAX_ALIASES).forEach((raw, i) => {
    const where = `Alias ${i + 1}`;
    if (!isObject(raw)) { warnings.push(`${where}: to nie obiekt — pominięty.`); return; }
    for (const key of Object.keys(raw)) if (!described(ALIAS_KEYS, key)) warnings.push(`${where}: nieznany klucz "${key}" — pominięty.`);
    if (typeof raw.path !== 'string' || pathOf(raw.path) === '') { warnings.push(`${where}: brak "path" — pominięty.`); return; }
    const path = pathOf(raw.path);
    const named = `${where} (${path})`;
    if (!PATH_SHAPE.test(path)) { warnings.push(`${named}: adres to małe litery, cyfry i myślniki, części oddzielone ukośnikiem — pominięty.`); return; }
    if (seenAliases.has(path)) { warnings.push(`${named}: ten sam adres drugi raz — pominięty.`); return; }
    seenAliases.add(path);
    if (typeof raw.target !== 'string') { warnings.push(`${named}: brak "target" — pominięty.`); return; }
    const target = pathOf(raw.target);

    const there = page.get(path);
    if (there !== undefined) {
      if (there.aliasOf === null) warnings.push(`${named}: to strona, nie alias — pominięty.`);
      else if (there.aliasOf === target) aliasesKept += 1;
      else warnings.push(`${named}: ten alias prowadzi do ${shown(there.aliasOf)}; celu aliasu nie da się zmienić (także w aplikacji) — zostaje, jak jest.`);
      return;
    }

    if (!path.includes('/')) { warnings.push(`${named}: alias zakłada się pod adresem, który prowadzisz (np. parafia/news) — nazwy najwyższego poziomu wydaje serwer z kodem. Pominięty.`); return; }
    if (path === 'workspace' || path.startsWith('workspace/')) { warnings.push(`${named}: adres „workspace” należy do samego warsztatu — pominięty.`); return; }
    if (path === target) { warnings.push(`${named}: alias nie może wskazywać na siebie — pominięty.`); return; }
    const goal = page.get(target);
    if (goal === undefined || goal.aliasOf !== null) {
      warnings.push(`${named}: cel „${target}” nie jest stroną, którą prowadzisz${goal !== undefined ? ' (to alias — łańcuchów nie ma)' : ''} — pominięty.`);
      return;
    }
    const parent = path.split('/').slice(0, -1).join('/');
    if (!ledFrom(parent, roots)) { warnings.push(`${named}: nie prowadzisz adresu „${parent}”, więc nie założysz pod nim aliasu — pominięty.`); return; }

    let roleId = roleName.has(goal.roleId) ? goal.roleId : state.roles[0]?.id ?? '';
    if (raw.role !== undefined && raw.role !== null) {
      if (typeof raw.role === 'string' && roleName.has(raw.role)) roleId = raw.role;
      else warnings.push(`${named}: rola „${String(raw.role)}” nie jest jedną z Twoich ról — odpowie ${roleName.get(roleId) ?? 'rola strony docelowej'}.`);
    }
    if (roleId === '') { warnings.push(`${named}: nie masz roli, która mogłaby za niego odpowiadać — pominięty.`); return; }
    aliases.push({ path, target, roleId, roleName: roleName.get(roleId) ?? roleId });
  });

  /* -- Domeny: was das Dokument will -- */
  interface Wish { readonly path: string; readonly host: string | null; readonly was: string | null; readonly where: string }
  const wishes: Wish[] = [];
  let domainsKept = 0;
  const seenDomains = new Set<string>();
  listOf('domains', MAX_DOMAINS).forEach((raw, i) => {
    const where = `Domena ${i + 1}`;
    if (!isObject(raw)) { warnings.push(`${where}: to nie obiekt — pominięta.`); return; }
    for (const key of Object.keys(raw)) if (!described(DOMAIN_KEYS, key)) warnings.push(`${where}: nieznany klucz "${key}" — pominięty.`);
    if (typeof raw.path !== 'string') { warnings.push(`${where}: brak "path" — pominięta.`); return; }
    const path = pathOf(raw.path);
    const named = `${where} (${shown(path)})`;
    const there = page.get(path);
    if (there === undefined) { warnings.push(`${named}: domenę podpina się do strony, którą prowadzisz — pominięta.`); return; }
    if (seenDomains.has(path)) { warnings.push(`${named}: ta sama strona drugi raz — pominięta.`); return; }
    seenDomains.add(path);
    if (!('host' in raw)) { warnings.push(`${named}: brak "host" (nazwa domeny albo null) — pominięta.`); return; }
    let host: string | null = null;
    if (raw.host !== null) {
      if (typeof raw.host !== 'string') { warnings.push(`${named}: "host" to nie tekst — pominięta.`); return; }
      host = hostOf(raw.host);
      if (host === '' || host.length > 200 || !HOST_SHAPE.test(host)) {
        warnings.push(`${named}: „${raw.host}” to nie nazwa domeny (małe litery, z kropką, bez http:// i bez ścieżki) — pominięta.`);
        return;
      }
    }
    /* Erst „wie bisher", dann die Regel: was so dasteht (auch eine Domain, die der Dienst an einem Alias hält), ist keine Änderung. */
    if (host === there.host) { domainsKept += 1; return; }
    if (there.aliasOf !== null) { warnings.push(`${named}: domenę podpina się do strony, na której leży treść — nie do aliasu. Pominięta.`); return; }
    wishes.push({ path, host, was: there.host, where: named });
  });

  /* Ein Name gehört genau einer Adresse (`ck_slug_host`): wohin er nach dem Import zeigte — und wer ihn noch hält. */
  const holder = new Map<string, string>();
  for (const p of state.pages) if (p.host !== null) holder.set(p.host, p.path);
  const after = new Map<string, string | null>(state.pages.map((p) => [p.path, p.host]));
  for (const w of wishes) after.set(w.path, w.host);
  const kept: Wish[] = [];
  const seenHosts = new Map<string, string>();
  for (const w of wishes) {
    if (w.host === null) { kept.push(w); continue; }
    const first = seenHosts.get(w.host);
    if (first !== undefined) { warnings.push(`${w.where}: domena ${w.host} jest już w dokumencie przy ${shown(first)} — pominięta.`); after.set(w.path, w.was); continue; }
    const now = holder.get(w.host);
    if (now !== undefined && now !== w.path && after.get(now) === w.host) {
      warnings.push(`${w.where}: domena ${w.host} pokazuje już ${shown(now)}. Żeby ją przenieść, daj przy "${now}" "host": null (albo inną domenę). Pominięta.`);
      after.set(w.path, w.was);
      continue;
    }
    seenHosts.set(w.host, w.path);
    kept.push(w);
  }

  /*
   * DIE REIHENFOLGE: erst abnehmen, dann anhängen — und ein Name, den gerade eine andere Seite trägt, erst,
   * nachdem sie ihn abgegeben hat. Was sich so nicht ordnen lässt (zwei Seiten tauschen ihre Domains), geht
   * nicht in einem Import; das wird gesagt statt halb getan.
   */
  const ordered: Wish[] = kept.filter((w) => w.host === null);
  const held = new Map(holder);
  for (const w of ordered) if (w.was !== null) held.delete(w.was);
  let waiting = kept.filter((w) => w.host !== null);
  for (let moved = true; moved && waiting.length > 0;) {
    moved = false;
    const next: Wish[] = [];
    for (const w of waiting) {
      const now = held.get(w.host!);
      if (now !== undefined && now !== w.path) { next.push(w); continue; }
      ordered.push(w);
      if (w.was !== null) held.delete(w.was);
      held.set(w.host!, w.path);
      moved = true;
    }
    waiting = next;
  }
  for (const w of waiting) warnings.push(`${w.where}: strony wymieniają się domenami — tego nie da się zrobić jednym importem. Najpierw odepnij ("host": null), potem podepnij. Pominięta.`);

  const domains: PlannedDomain[] = ordered.map((w) => ({ path: w.path, host: w.host, was: w.was }));

  /* -- Was der Plan sagt -- */
  const lines: string[] = [];
  for (const a of aliases) lines.push(`Nowy alias: ${shown(a.path)} → ${shown(a.target)} (odpowiada: ${a.roleName})`);
  for (const d of domains) {
    lines.push(d.host === null
      ? `Odepnie domenę ${d.was} od ${shown(d.path)}`
      : d.was === null
        ? `Domena ${d.host} pokaże ${shown(d.path)}`
        : `${shown(d.path)}: domena ${d.was} → ${d.host} (${d.was} przestanie ją pokazywać)`);
  }
  if (aliasesKept + domainsKept > 0) {
    lines.push(`Bez zmian: ${aliasesKept} ${plural(aliasesKept, 'alias', 'aliasy', 'aliasów')}, ${domainsKept} ${plural(domainsKept, 'domena', 'domeny', 'domen')}`);
  }
  if (aliases.length === 0 && domains.length === 0) lines.push('Nic do zmiany.');
  lines.push(...outsideLines(domains));
  return { aliases, domains, lines, warnings };
}

/** Was nach dem Import noch fehlt — je neuer Domain, ausserhalb der App. */
export function outsideLines(domains: readonly PlannedDomain[]): string[] {
  const fresh = domains.filter((d) => d.host !== null).map((d) => d.host!);
  if (fresh.length === 0) return [];
  return [
    `Poza aplikacją (import tego nie zrobi) — dla ${fresh.join(', ')}:`,
    ...OUTSIDE.map((line, i) => `${i + 1}. ${line}`)
  ];
}

/* -- Ausführen --------------------------------------------------------------------------------------------- */

/** Die zwei Aufrufe, die die Ansicht auch benutzt (`desk.ts`) — hereingereicht, damit die Reihenfolge prüfbar bleibt. */
export interface AddressCalls {
  readonly declareAlias: (path: string, target: string, roleId: string) => Promise<unknown>;
  readonly bindDomain: (path: string, host: string | null) => Promise<unknown>;
}

const why = (e: unknown): string => (e instanceof Error && e.message !== '' ? e.message : 'nie udało się');

/**
 * Was der Plan sagt, der Reihe nach. Ein Fehler hält die übrigen nicht an: jede Zeile ist für sich, und was
 * nicht ging, steht mit dem Grund des Dienstes in den Warnungen.
 */
export async function applyAddresses(plan: AddressPlan, calls: AddressCalls, stage: (what: string) => void): Promise<{ lines: string[]; warnings: string[] }> {
  const lines: string[] = [];
  const warnings: string[] = [];
  if (plan.aliases.length > 0) stage('Zakładanie aliasów…');
  let made = 0;
  for (const a of plan.aliases) {
    try { await calls.declareAlias(a.path, a.target, a.roleId); made += 1; } catch (e) { warnings.push(`Alias ${shown(a.path)}: ${why(e)}`); }
  }
  if (plan.domains.length > 0) stage('Podpinanie domen…');
  const bound: PlannedDomain[] = [];
  for (const d of plan.domains) {
    try { await calls.bindDomain(d.path, d.host); bound.push(d); } catch (e) { warnings.push(`Domena ${d.host ?? d.was ?? ''} (${shown(d.path)}): ${why(e)}`); }
  }
  if (made > 0) lines.push(`Założone aliasy: ${made}`);
  const on = bound.filter((d) => d.host !== null).length;
  const off = bound.length - on;
  if (on > 0) lines.push(`Podpięte domeny: ${on}`);
  if (off > 0) lines.push(`Odpięte domeny: ${off}`);
  if (lines.length === 0) lines.push('Nic nie zostało zmienione.');
  lines.push(...outsideLines(bound));
  return { lines, warnings };
}
