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
import { t } from '../core/i18n';
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

/** Sätze, die erst beim Lesen entstehen — in der Sprache von dann (Getter, keine Übersetzung beim Laden). */
function lazy(said: Readonly<Record<string, () => string>>): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(said)) Object.defineProperty(out, key, { get: text, enumerable: true });
  return out;
}

const TOP_KEYS = lazy({
  format: () => `"${ADDRESSES_FORMAT}"`,
  version: () => t('pagesAddresses.json.key.version', { version: ADDRESSES_VERSION }),
  pages: () => t('pagesAddresses.json.key.pages'),
  roles: () => t('pagesAddresses.json.key.roles'),
  aliases: () => t('pagesAddresses.json.key.aliases', { max: MAX_ALIASES }),
  domains: () => t('pagesAddresses.json.key.domains', { max: MAX_DOMAINS })
});

const ROLE_KEYS = lazy({
  id: () => t('pagesAddresses.json.key.roleId'),
  name: () => t('pagesAddresses.json.key.roleName')
});

const ALIAS_KEYS = lazy({
  path: () => t('pagesAddresses.json.key.aliasPath'),
  target: () => t('pagesAddresses.json.key.aliasTarget'),
  role: () => t('pagesAddresses.json.key.aliasRole')
});

const DOMAIN_KEYS = lazy({
  path: () => t('pagesAddresses.json.key.domainPath'),
  host: () => t('pagesAddresses.json.key.domainHost')
});

/** Jeder Schlüssel als Pfad (`aliases[].path`) mit seinem Satz — für die Prüfung, dass nichts unbeschrieben bleibt. */
export const ADDRESSES_KEYS: Readonly<Record<string, string>> = lazy({
  ...Object.fromEntries(Object.keys(TOP_KEYS).map((k) => [k, () => TOP_KEYS[k]])),
  ...Object.fromEntries(Object.keys(ROLE_KEYS).map((k) => [`roles[].${k}`, () => ROLE_KEYS[k]])),
  ...Object.fromEntries(Object.keys(ALIAS_KEYS).map((k) => [`aliases[].${k}`, () => ALIAS_KEYS[k]])),
  ...Object.fromEntries(Object.keys(DOMAIN_KEYS).map((k) => [`domains[].${k}`, () => DOMAIN_KEYS[k]]))
});

const SAMPLE_ROLE = '0190a0a0-0000-7000-8000-0000000000a1';

const SAMPLE = {
  format: ADDRESSES_FORMAT,
  version: ADDRESSES_VERSION,
  pages: ['parafia', 'parafia/aktualnosci', 'cogita'],
  roles: [{ id: SAMPLE_ROLE, name: 'Kancelaria parafii (rola)' }], // i18n-ignore — Beispieldaten
  aliases: [{ path: 'parafia/news', target: 'parafia/aktualnosci', role: SAMPLE_ROLE }],
  domains: [{ path: 'cogita', host: 'cogita.pl' }]
};

/** Was ausserhalb der App bleibt — in der Beschreibung und im Plan dieselben Sätze. */
const outside = (): string[] => [
  t('pagesAddresses.json.outside.dns', { a: PAGES_A.join(', '), aaaa: PAGES_AAAA.join(', '), cname: PAGES_CNAME }),
  t('pagesAddresses.json.outside.host'),
  t('pagesAddresses.json.outside.origin')
];

/*
 * 2026-10-30 — WAS EIN ZWEITER WEG BEWIRKT: der Dienst folgt ihm zum Ziel und nimmt alles von dort
 * (`Page.Write.cs`: Inhalt, Aussehen, Zugang, Sperre); unter der eigenen Domain sind die Unterwege lokal
 * (`Page.Show.cs`); Rechte gibt er keine (`Slug.cs`); in der Wahl einer Seite stehen Aliase nicht (`aliasOf`).
 */
export const ADDRESSES_USAGE_JSON: JsonNode = {
  key: 'addresses.usage',
  get title() { return t('pagesAddresses.json.usageTitle'); },
  text: () => t('pagesAddresses.json.usage')
};

export const ADDRESSES_JSON: JsonNode = {
  key: 'addresses',
  get title() { return t('pagesAddresses.json.formatTitle', { format: ADDRESSES_FORMAT, version: ADDRESSES_VERSION }); },
  get short() { return t('pagesAddresses.json.short'); },
  text: () => `${t('pagesAddresses.json.intro', { host: `<${t('pagesAddresses.json.hostWord')}>`, outside: outside().map((line, i) => `${i + 1}. ${line}`).join('\n') })}

${t('pagesAddresses.json.doc')}
${keyLines(TOP_KEYS)}

${t('pagesAddresses.json.aliasEntry')}
${keyLines(ALIAS_KEYS)}

${t('pagesAddresses.json.domainEntry')}
${keyLines(DOMAIN_KEYS)}

${t('pagesAddresses.json.roleEntry')}
${keyLines(ROLE_KEYS)}

${t('pagesAddresses.json.example')}
${pretty(SAMPLE)}`,
  inside: () => [ADDRESSES_USAGE_JSON],
  samples: () => [{ label: t('pagesAddresses.json.sample'), doc: () => SAMPLE }]
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
  if (!isObject(doc)) return { error: t('pagesAddresses.json.w.notDoc') };
  if (doc.format !== undefined && doc.format !== ADDRESSES_FORMAT) return { error: t('pagesAddresses.json.w.otherFormat', { said: String(doc.format), format: ADDRESSES_FORMAT }) };

  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== ADDRESSES_VERSION) warnings.push(t('pagesAddresses.json.w.version', { said: String(doc.version), version: ADDRESSES_VERSION }));
  for (const key of Object.keys(doc)) if (!described(TOP_KEYS, key)) warnings.push(t('pagesAddresses.json.w.unknownKey', { key }));

  const roots = state.pages.filter((p) => p.aliasOf === null).map((p) => p.path);
  const page = new Map(state.pages.map((p) => [p.path, p]));
  const roleName = new Map(state.roles.map((r) => [r.id, r.name]));

  /* -- Aliasy -- */
  const aliases: PlannedAlias[] = [];
  let aliasesKept = 0;
  const listOf = (key: 'aliases' | 'domains', max: number): unknown[] => {
    const value = doc[key];
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) { warnings.push(t('pagesAddresses.json.w.notList', { key })); return []; }
    if (value.length > max) warnings.push(t('pagesAddresses.json.w.tooMany', { key, count: value.length, max }));
    return value.slice(0, max);
  };

  const seenAliases = new Set<string>();
  listOf('aliases', MAX_ALIASES).forEach((raw, i) => {
    const where = t('pagesAddresses.json.w.aliasN', { n: i + 1 });
    if (!isObject(raw)) { warnings.push(t('pagesAddresses.json.w.aliasNotObject', { where })); return; }
    for (const key of Object.keys(raw)) if (!described(ALIAS_KEYS, key)) warnings.push(t('pagesAddresses.json.w.entryUnknownKey', { where, key }));
    if (typeof raw.path !== 'string' || pathOf(raw.path) === '') { warnings.push(t('pagesAddresses.json.w.aliasNoPath', { where })); return; }
    const path = pathOf(raw.path);
    const named = `${where} (${path})`;
    if (!PATH_SHAPE.test(path)) { warnings.push(t('pagesAddresses.json.w.aliasBadPath', { named })); return; }
    if (seenAliases.has(path)) { warnings.push(t('pagesAddresses.json.w.aliasTwice', { named })); return; }
    seenAliases.add(path);
    if (typeof raw.target !== 'string') { warnings.push(t('pagesAddresses.json.w.aliasNoTarget', { named })); return; }
    const target = pathOf(raw.target);

    const there = page.get(path);
    if (there !== undefined) {
      if (there.aliasOf === null) warnings.push(t('pagesAddresses.json.w.aliasIsPage', { named }));
      else if (there.aliasOf === target) aliasesKept += 1;
      else warnings.push(t('pagesAddresses.json.w.aliasOtherTarget', { named, target: shown(there.aliasOf) }));
      return;
    }

    if (!path.includes('/')) { warnings.push(t('pagesAddresses.json.w.aliasTop', { named })); return; }
    if (path === 'workspace' || path.startsWith('workspace/')) { warnings.push(t('pagesAddresses.json.w.aliasWorkspace', { named })); return; }
    if (path === target) { warnings.push(t('pagesAddresses.json.w.aliasSelf', { named })); return; }
    const goal = page.get(target);
    if (goal === undefined || goal.aliasOf !== null) {
      warnings.push(t(goal !== undefined ? 'pagesAddresses.json.w.aliasTargetAlias' : 'pagesAddresses.json.w.aliasTargetNotYours', { named, target }));
      return;
    }
    const parent = path.split('/').slice(0, -1).join('/');
    if (!ledFrom(parent, roots)) { warnings.push(t('pagesAddresses.json.w.aliasNotLed', { named, parent })); return; }

    let roleId = roleName.has(goal.roleId) ? goal.roleId : state.roles[0]?.id ?? '';
    if (raw.role !== undefined && raw.role !== null) {
      if (typeof raw.role === 'string' && roleName.has(raw.role)) roleId = raw.role;
      else warnings.push(t('pagesAddresses.json.w.aliasRole', { named, role: String(raw.role), instead: roleName.get(roleId) ?? t('pagesAddresses.json.w.targetRole') }));
    }
    if (roleId === '') { warnings.push(t('pagesAddresses.json.w.aliasNoRole', { named })); return; }
    aliases.push({ path, target, roleId, roleName: roleName.get(roleId) ?? roleId });
  });

  /* -- Domeny: was das Dokument will -- */
  interface Wish { readonly path: string; readonly host: string | null; readonly was: string | null; readonly where: string }
  const wishes: Wish[] = [];
  let domainsKept = 0;
  const seenDomains = new Set<string>();
  listOf('domains', MAX_DOMAINS).forEach((raw, i) => {
    const where = t('pagesAddresses.json.w.domainN', { n: i + 1 });
    if (!isObject(raw)) { warnings.push(t('pagesAddresses.json.w.domainNotObject', { where })); return; }
    for (const key of Object.keys(raw)) if (!described(DOMAIN_KEYS, key)) warnings.push(t('pagesAddresses.json.w.entryUnknownKey', { where, key }));
    if (typeof raw.path !== 'string') { warnings.push(t('pagesAddresses.json.w.domainNoPath', { where })); return; }
    const path = pathOf(raw.path);
    const named = `${where} (${shown(path)})`;
    const there = page.get(path);
    if (there === undefined) { warnings.push(t('pagesAddresses.json.w.domainNotYours', { named })); return; }
    if (seenDomains.has(path)) { warnings.push(t('pagesAddresses.json.w.domainTwice', { named })); return; }
    seenDomains.add(path);
    if (!('host' in raw)) { warnings.push(t('pagesAddresses.json.w.domainNoHost', { named })); return; }
    let host: string | null = null;
    if (raw.host !== null) {
      if (typeof raw.host !== 'string') { warnings.push(t('pagesAddresses.json.w.domainHostNotText', { named })); return; }
      host = hostOf(raw.host);
      if (host === '' || host.length > 200 || !HOST_SHAPE.test(host)) {
        warnings.push(t('pagesAddresses.json.w.domainBadHost', { named, host: raw.host }));
        return;
      }
    }
    /* Erst „wie bisher", dann die Regel: was so dasteht (auch eine Domain, die der Dienst an einem Alias hält), ist keine Änderung. */
    if (host === there.host) { domainsKept += 1; return; }
    if (there.aliasOf !== null) { warnings.push(t('pagesAddresses.json.w.domainOnAlias', { named })); return; }
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
    if (first !== undefined) { warnings.push(t('pagesAddresses.json.w.domainDouble', { where: w.where, host: w.host, page: shown(first) })); after.set(w.path, w.was); continue; }
    const now = holder.get(w.host);
    if (now !== undefined && now !== w.path && after.get(now) === w.host) {
      warnings.push(t('pagesAddresses.json.w.domainTaken', { where: w.where, host: w.host, page: shown(now), path: now }));
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
  for (const w of waiting) warnings.push(t('pagesAddresses.json.w.domainSwap', { where: w.where }));

  const domains: PlannedDomain[] = ordered.map((w) => ({ path: w.path, host: w.host, was: w.was }));

  /* -- Was der Plan sagt -- */
  const lines: string[] = [];
  for (const a of aliases) lines.push(t('pagesAddresses.json.line.alias', { path: shown(a.path), target: shown(a.target), role: a.roleName }));
  for (const d of domains) {
    lines.push(d.host === null
      ? t('pagesAddresses.json.line.unbind', { host: d.was ?? '', page: shown(d.path) })
      : d.was === null
        ? t('pagesAddresses.json.line.bind', { host: d.host, page: shown(d.path) })
        : t('pagesAddresses.json.line.swap', { page: shown(d.path), was: d.was, host: d.host }));
  }
  if (aliasesKept + domainsKept > 0) {
    lines.push(t('pagesAddresses.json.line.kept', { aliases: t('pagesAddresses.json.line.aliases', { count: aliasesKept }), domains: t('pagesAddresses.json.line.domains', { count: domainsKept }) }));
  }
  if (aliases.length === 0 && domains.length === 0) lines.push(t('pagesAddresses.json.line.nothing'));
  lines.push(...outsideLines(domains));
  return { aliases, domains, lines, warnings };
}

/** Was nach dem Import noch fehlt — je neuer Domain, ausserhalb der App. */
export function outsideLines(domains: readonly PlannedDomain[]): string[] {
  const fresh = domains.filter((d) => d.host !== null).map((d) => d.host!);
  if (fresh.length === 0) return [];
  return [
    t('pagesAddresses.json.line.outside', { hosts: fresh.join(', ') }),
    ...outside().map((line, i) => `${i + 1}. ${line}`)
  ];
}

/* -- Ausführen --------------------------------------------------------------------------------------------- */

/** Die zwei Aufrufe, die die Ansicht auch benutzt (`desk.ts`) — hereingereicht, damit die Reihenfolge prüfbar bleibt. */
export interface AddressCalls {
  readonly declareAlias: (path: string, target: string, roleId: string) => Promise<unknown>;
  readonly bindDomain: (path: string, host: string | null) => Promise<unknown>;
}

const why = (e: unknown): string => (e instanceof Error && e.message !== '' ? e.message : t('pages.run.failed'));

/**
 * Was der Plan sagt, der Reihe nach. Ein Fehler hält die übrigen nicht an: jede Zeile ist für sich, und was
 * nicht ging, steht mit dem Grund des Dienstes in den Warnungen.
 */
export async function applyAddresses(plan: AddressPlan, calls: AddressCalls, stage: (what: string) => void): Promise<{ lines: string[]; warnings: string[] }> {
  const lines: string[] = [];
  const warnings: string[] = [];
  if (plan.aliases.length > 0) stage(t('pagesAddresses.json.run.aliases'));
  let made = 0;
  for (const a of plan.aliases) {
    try { await calls.declareAlias(a.path, a.target, a.roleId); made += 1; } catch (e) { warnings.push(t('pagesAddresses.json.run.aliasFailed', { page: shown(a.path), why: why(e) })); }
  }
  if (plan.domains.length > 0) stage(t('pagesAddresses.json.run.domains'));
  const bound: PlannedDomain[] = [];
  for (const d of plan.domains) {
    try { await calls.bindDomain(d.path, d.host); bound.push(d); } catch (e) { warnings.push(t('pagesAddresses.json.run.domainFailed', { host: d.host ?? d.was ?? '', page: shown(d.path), why: why(e) })); }
  }
  if (made > 0) lines.push(t('pagesAddresses.json.run.made', { n: made }));
  const on = bound.filter((d) => d.host !== null).length;
  const off = bound.length - on;
  if (on > 0) lines.push(t('pagesAddresses.json.run.on', { n: on }));
  if (off > 0) lines.push(t('pagesAddresses.json.run.off', { n: off }));
  if (lines.length === 0) lines.push(t('pagesAddresses.json.run.nothing'));
  lines.push(...outsideLines(bound));
  return { lines, warnings };
}
