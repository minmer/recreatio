/**
 * 2026-11-05 — DIE SPRACHEN DER ANWENDUNG: Englisch (Vorgabe), Deutsch, Polnisch.
 *
 * <b>Kein Text im Code.</b> Jeder Text der Oberfläche steht in `src/locales/<sprache>/<datei>.json`
 * und wird hier mit seinem Schlüssel geholt: `t('calendar.today')` liest `today` aus
 * `locales/<sprache>/calendar.json`. Übersetzen heisst: die Dateien dieses Ordners übersetzen.
 * Die Regeln stehen in documentation/LOCALIZATION.md.
 *
 * <b>Drei Ebenen der Wahl.</b> Die Sprache der Anwendung (je Gerät, `recreatio.lang`), darüber je
 * Teil der Anwendung eine eigene (`recreatio.lang.sections`, z. B. Nauka auf Deutsch), darüber je
 * Seite und je Baustein einer Seite die, die ihr Autor festgelegt hat — als `<LangScope>` um den
 * Teilbaum. `useT()` folgt dem nächsten Scope, das blanke `t()` der Sprache der Anwendung.
 *
 * <b>Ein Speicher auf `globalThis`.</b> Die Prüfskripte bündeln einzelne Module mit esbuild, jedes
 * mit seiner eigenen Kopie dieses Moduls; über `globalThis` sehen alle dieselben Wörterbücher
 * (`scripts/i18n-node.mjs` füllt sie in Node).
 */

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

export type Lang = 'en' | 'de' | 'pl';
export const LANGS: readonly Lang[] = ['en', 'de', 'pl'];
export const DEFAULT_LANG: Lang = 'en';
/* Jede Sprache in ihrem eigenen Namen — so findet man die eigene auch in einer fremden Oberfläche. */
export const LANG_NAME: Readonly<Record<Lang, string>> = { en: 'English', de: 'Deutsch', pl: 'Polski' }; // i18n-ignore

export const isLang = (x: unknown): x is Lang => x === 'en' || x === 'de' || x === 'pl';

/** Die Kennung für `Intl` und `toLocale…String`. */
export const localeOf = (lang: Lang): string => (lang === 'de' ? 'de-DE' : lang === 'pl' ? 'pl-PL' : 'en-GB');

/* -- Der Speicher ----------------------------------------------------------- */

export type Message = string | { readonly [key: string]: Message };
export type Dictionary = { readonly [key: string]: Message };
type Params = Readonly<Record<string, string | number>>;

interface Store {
  app: Lang;
  dicts: Partial<Record<Lang, Record<string, Dictionary>>>;
  loading: Partial<Record<Lang, Promise<void>>>;
  loader: ((lang: Lang) => Promise<Record<string, Dictionary>>) | null;
  version: number;
  listeners: Set<() => void>;
}

const G = globalThis as { __recreatioI18n?: Store };
const S: Store = (G.__recreatioI18n ??= { app: DEFAULT_LANG, dicts: {}, loading: {}, loader: null, version: 0, listeners: new Set() });

const notify = () => {
  S.version += 1;
  for (const one of S.listeners) one();
};
const subscribe = (fn: () => void) => {
  S.listeners.add(fn);
  return () => { S.listeners.delete(fn); };
};

/** Die Dateien einer Sprache eintragen (der Lader in `src/locales/`, die Prüfskripte in Node). */
export function registerLang(lang: Lang, files: Record<string, Dictionary>): void {
  S.dicts[lang] = { ...(S.dicts[lang] ?? {}), ...files };
  notify();
}

/** Wer die Dateien einer Sprache holt (`src/locales/index.ts`). */
export function setLangLoader(loader: (lang: Lang) => Promise<Record<string, Dictionary>>): void {
  S.loader = loader;
}

export const langLoaded = (lang: Lang): boolean => S.dicts[lang] !== undefined;

/** Eine Sprache laden — einmal; danach sofort. */
export function loadLang(lang: Lang): Promise<void> {
  if (langLoaded(lang)) return Promise.resolve();
  const had = S.loading[lang];
  if (had !== undefined) return had;
  if (S.loader === null) return Promise.resolve();
  const loader = S.loader;
  const p = loader(lang).then((files) => registerLang(lang, files)).catch(() => { delete S.loading[lang]; });
  S.loading[lang] = p;
  return p;
}

/* -- Die Wahl --------------------------------------------------------------- */

const KEY_APP = 'recreatio.lang';
const KEY_SECTIONS = 'recreatio.lang.sections';

const readStore = (key: string): string | null => {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
};
const writeStore = (key: string, value: string | null): void => {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch { /* ohne Speicher gilt die Wahl bis zum Neuladen */ }
};

/** Die gewählte Sprache, sonst die des Browsers (wenn es eine der drei ist), sonst Englisch. */
export function initialLang(): Lang {
  const chosen = readStore(KEY_APP);
  if (isLang(chosen)) return chosen;
  const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
  for (const tag of nav?.languages ?? (nav?.language !== undefined ? [nav.language] : [])) {
    const base = tag.slice(0, 2).toLowerCase();
    if (isLang(base)) return base;
  }
  return DEFAULT_LANG;
}

/** Hat jemand die Sprache selbst gewählt (oder folgt sie dem Browser)? */
export const langChosen = (): boolean => isLang(readStore(KEY_APP));

export const appLang = (): Lang => S.app;

/**
 * Die Sprache der Anwendung setzen. Mit `persist` wird sie gemerkt und die Karte neu geladen: Texte,
 * die schon gezeichnet sind (Menüs, gemerkte Listen), sollen nicht halb in der alten Sprache stehen.
 * `null` heisst: wieder dem Browser folgen.
 */
export function setAppLang(lang: Lang | null, persist = true): void {
  if (persist) {
    writeStore(KEY_APP, lang);
    globalThis.location?.reload();
    return;
  }
  S.app = lang ?? DEFAULT_LANG;
  if (globalThis.document !== undefined) globalThis.document.documentElement.lang = S.app;
  notify();
}

/** Die Teile der Anwendung, die eine eigene Sprache haben können (Bezeichnungen: `i18n.section.<id>`). */
export const SECTIONS = [
  'workspace', 'areas', 'calendar', 'chat', 'forms', 'pages', 'library', 'scriptorium', 'knowledge', 'learn',
  'masses', 'bookings', 'communities', 'roles', 'addresses', 'sms', 'lamps', 'registry', 'reports', 'account', 'lab'
] as const;
export type Section = (typeof SECTIONS)[number];

export function sectionLangs(): Partial<Record<Section, Lang>> {
  try {
    const raw = JSON.parse(readStore(KEY_SECTIONS) ?? '{}') as Record<string, unknown>;
    const out: Partial<Record<Section, Lang>> = {};
    for (const s of SECTIONS) { const v = raw[s]; if (isLang(v)) out[s] = v; }
    return out;
  } catch { return {}; }
}

export const sectionLang = (section: Section): Lang | null => sectionLangs()[section] ?? null;

/** Einem Teil eine eigene Sprache geben (`null`: er folgt der Anwendung). Gilt sofort. */
export function setSectionLang(section: Section, lang: Lang | null): void {
  const all: Record<string, Lang> = { ...sectionLangs() };
  if (lang === null) delete all[section];
  else all[section] = lang;
  writeStore(KEY_SECTIONS, JSON.stringify(all));
  if (lang !== null) void loadLang(lang);
  notify();
}

/**
 * Beim Start, vor dem ersten Bild: die Sprache festlegen und ihre Dateien laden.
 */
export async function startI18n(lang: Lang = initialLang()): Promise<void> {
  S.app = lang;
  if (globalThis.document !== undefined) globalThis.document.documentElement.lang = lang;
  await loadLang(lang);
  /* Englisch wird NICHT dazu geladen: app-i18n-check verlangt in jeder Sprache jeden Schlüssel — der Rückfall träfe nie. */
  const own = new Set(Object.values(sectionLangs()));
  for (const one of own) void loadLang(one);
}

/* -- Das Nachschlagen ------------------------------------------------------- */

const PLURALS = new Map<Lang, Intl.PluralRules>();
const pluralOf = (lang: Lang, n: number): string => {
  let rules = PLURALS.get(lang);
  if (rules === undefined) { rules = new Intl.PluralRules(localeOf(lang)); PLURALS.set(lang, rules); }
  return rules.select(n);
};

function find(lang: Lang, key: string): Message | undefined {
  const dot = key.indexOf('.');
  if (dot < 0) return undefined;
  let at: Message | undefined = S.dicts[lang]?.[key.slice(0, dot)];
  for (const part of key.slice(dot + 1).split('.')) {
    if (at === undefined || typeof at === 'string') return undefined;
    at = at[part];
  }
  return at;
}

const fill = (text: string, params: Params | undefined): string =>
  params === undefined ? text : text.replace(/\{(\w+)\}/g, (all, name: string) => (name in params ? String(params[name]) : all));

/**
 * Ein Text in einer bestimmten Sprache. `{name}` wird aus `params` gefüllt; ist der Eintrag eine
 * Mehrzahl (`{ "one": …, "few": …, "many": …, "other": … }`), wählt `params.count` die Form.
 * Fehlt er in der Sprache, kommt der englische, fehlt auch der, der Schlüssel selbst.
 */
export function tIn(lang: Lang, key: string, params?: Params): string {
  let msg = find(lang, key);
  let from = lang;
  if (msg === undefined && lang !== DEFAULT_LANG) { msg = find(DEFAULT_LANG, key); from = DEFAULT_LANG; }
  if (msg === undefined) return key;
  if (typeof msg !== 'string') {
    const n = typeof params?.count === 'number' ? params.count : Number(params?.count ?? NaN);
    const form = Number.isFinite(n) ? msg[pluralOf(from, n)] ?? msg.other : msg.other;
    msg = typeof form === 'string' ? form : key;
  }
  return fill(msg, params);
}

/** Ein Text in der Sprache der Anwendung — für Code ausserhalb von Komponenten. In Komponenten: `useT()`. */
export const t = (key: string, params?: Params): string => tIn(S.app, key, params);

/** Gibt es diesen Schlüssel (in der Sprache, sonst auf Englisch)? Für Schlüssel aus Daten (`kind.${x}`). */
export const hasKey = (key: string, lang: Lang = S.app): boolean => find(lang, key) !== undefined || find(DEFAULT_LANG, key) !== undefined;

/** Ein Text, dessen Schlüssel aus Daten kommt — mit eigenem Rückfall, wenn es ihn nicht gibt. */
export const tOr = (key: string, fallback: string, params?: Params, lang: Lang = S.app): string =>
  hasKey(key, lang) ? tIn(lang, key, params) : fallback;

/**
 * Eine Tabelle von Bezeichnungen, die wie früher als Objekt gelesen wird (`VIEWS.calendar`), deren Text aber erst
 * beim Lesen geholt wird — in der Sprache der Anwendung zu diesem Zeitpunkt. Für Tabellen, die andere Module
 * importieren: `export const VIEWS = texts({ calendar: 'workspace.view.calendar', … })`.
 */
export function texts<K extends string>(keys: Readonly<Record<K, string>>): Readonly<Record<K, string>> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(keys) as K[]) Object.defineProperty(out, k, { get: () => t(keys[k]), enumerable: true });
  return out;
}

/* -- In Komponenten ---------------------------------------------------------- */

export type T = ((key: string, params?: Params) => string) & { readonly lang: Lang; readonly locale: string };

export const tFor = (lang: Lang): T => Object.assign((key: string, params?: Params) => tIn(lang, key, params), { lang, locale: localeOf(lang) });

const LangContext = createContext<Lang | null>(null);

/** Die Sprache an dieser Stelle: der nächste `<LangScope>`, sonst die der Anwendung. */
export function useLang(): Lang {
  const scoped = useContext(LangContext);
  useSyncExternalStore(subscribe, () => S.version, () => S.version);
  return scoped ?? S.app;
}

/** `const t = useT(); t('calendar.today')` — dazu `t.lang` und `t.locale` (für Datum und Zahl). */
export function useT(): T {
  const lang = useLang();
  const version = useSyncExternalStore(subscribe, () => S.version, () => S.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => tFor(lang), [lang, version]);
}

/**
 * Ein Teilbaum in einer eigenen Sprache: `lang` fest (eine Seite, ein Baustein, eine Baza) oder
 * `section` (die Wahl des Menschen für diesen Teil der Anwendung). `lang` geht vor `section`;
 * ohne beide gilt die Sprache darüber. Bis die Sprache geladen ist, steht die darüber.
 */
/* `bare`: nur die Sprache, kein Rahmen im DOM — wo Regeln mit `>` (`.wk-card > …`) an den Kindern hängen (Bausteine einer Seite). */
export function LangScope({ lang, section, bare = false, children }: { lang?: Lang | null; section?: Section; bare?: boolean; children: ReactNode }) {
  const parent = useLang();
  useSyncExternalStore(subscribe, () => S.version, () => S.version);
  const wanted = (isLang(lang) ? lang : null) ?? (section !== undefined ? sectionLang(section) : null) ?? parent;
  const [, bump] = useState(0);
  useEffect(() => {
    if (!langLoaded(wanted)) void loadLang(wanted).then(() => bump((n) => n + 1));
  }, [wanted]);
  const now = langLoaded(wanted) ? wanted : parent;
  if (bare) return <LangContext.Provider value={now}>{children}</LangContext.Provider>;
  return (
    <LangContext.Provider value={now}>
      <div lang={now} className="wk-lang-scope">{children}</div>
    </LangContext.Provider>
  );
}

/** Zeichnet erst, wenn die Sprache der Anwendung geladen ist (die Einstiege: `mount.tsx`, Vorschau, Labor). */
export function LangReady({ children }: { children: ReactNode }) {
  useSyncExternalStore(subscribe, () => S.version, () => S.version);
  return langLoaded(S.app) ? <>{children}</> : null;
}

/* -- Text mit Auszeichnung -------------------------------------------------- */

/**
 * Ein übersetzter Satz mit Teilen, die anders gezeichnet werden: im Text `<b>…</b>` oder `<link>…</link>`,
 * hier je Name eine Funktion. `rich(t('account.deleteNote'), { b: (s) => <strong>{s}</strong> })`.
 * Unbekannte Namen bleiben als blosser Text stehen; verschachtelt wird nicht.
 */
export function rich(text: string, parts: Readonly<Record<string, (inner: string, key: number) => ReactNode>>): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const render = parts[m[1]!];
    out.push(render !== undefined ? <span key={`r${n}`}>{render(m[2]!, n)}</span> : m[2]);
    n += 1;
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* -- Datum und Zahl --------------------------------------------------------- */

/** Ein Datum in der Sprache (`opts` wie bei `Intl.DateTimeFormat`). */
export const fmtDate = (d: Date | number, opts: Intl.DateTimeFormatOptions, lang: Lang = S.app): string =>
  new Intl.DateTimeFormat(localeOf(lang), opts).format(d);

/** Eine Zahl in der Sprache. */
export const fmtNumber = (n: number, opts?: Intl.NumberFormatOptions, lang: Lang = S.app): string =>
  new Intl.NumberFormat(localeOf(lang), opts).format(n);
