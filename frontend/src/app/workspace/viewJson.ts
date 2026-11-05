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
import { t } from '../core/i18n';

export const VIEW_FORMAT = 'recreatio/workspace-view';
export const VIEW_VERSION = 1;

const KNOWN = new Set<string>(ALERT_KINDS.map((one) => one.kind));

/* -- Die Sätze ----------------------------------------------------------------------------------------- */

/** Sätze, die erst beim Lesen übersetzt werden (Sprache der Anwendung zu diesem Zeitpunkt). */
const lazy = (entries: Readonly<Record<string, () => string>>): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const [k, read] of Object.entries(entries)) Object.defineProperty(out, k, { get: read, enumerable: true });
  return out;
};

const TOP_KEYS: Readonly<Record<string, string>> = lazy({
  format: () => `"${VIEW_FORMAT}"`,
  version: () => t('workspace.viewJson.key.version', { version: VIEW_VERSION }),
  alerts: () => t('workspace.viewJson.key.alerts')
});

const ALERT_KEYS: Readonly<Record<string, string>> = lazy({
  kind: () => t('workspace.viewJson.key.kind'),
  on: () => t('workspace.viewJson.key.on'),
  label: () => t('workspace.viewJson.key.label')
});

/** Jeder Schlüssel als Pfad (`alerts[].kind`) mit seinem Satz — für die Prüfung. */
export const VIEW_KEYS: Readonly<Record<string, string>> = lazy({
  ...Object.fromEntries(Object.keys(TOP_KEYS).map((k) => [k, () => TOP_KEYS[k]])),
  ...Object.fromEntries(Object.keys(ALERT_KEYS).map((k) => [`alerts[].${k}`, () => ALERT_KEYS[k]]))
});

/** Ein Beispiel aus der Kanzlei: Zgłoszenia und Rezerwacje zuerst, Powtórki aus — die übrigen bleiben, wie sie sind. */
const sample = () => ({
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
});

/*
 * 2026-10-30 — WER DIE EINSTELLUNG LIEST: nur die Glocke (`NotifyBell.tsx`: Liste und Zahl, ohne „dziś") und
 * „Czeka na Ciebie" (`ViewParts.tsx` auf Teraz und im Überblick eines Bereichs, dort nur seine Bereiche);
 * die Zahlen aus einer Frage (`notify.ts`); was das Gerät meldet, stellt jedes Gerät selbst ein (`NotifySettings`).
 */
export const VIEW_USAGE_JSON: JsonNode = {
  key: 'workspace-view.usage',
  get title() { return t('workspace.viewJson.usageTitle'); },
  text: () => t('workspace.viewJson.usage')
};

export const VIEW_JSON: JsonNode = {
  key: 'workspace-view',
  get title() { return t('workspace.viewJson.title', { format: VIEW_FORMAT, version: VIEW_VERSION }); },
  get short() { return t('workspace.viewJson.short'); },
  text: () => t('workspace.viewJson.text', {
    top: keyLines(TOP_KEYS),
    alert: keyLines(ALERT_KEYS),
    kinds: keyLines(Object.fromEntries(ALERT_KINDS.map((one) => [one.kind, t(one.counts ? 'workspace.viewJson.kindCounts' : 'workspace.viewJson.kind', { label: one.label, says: one.says })]))),
    sample: pretty(sample())
  }),
  inside: () => [VIEW_USAGE_JSON],
  samples: () => [{ label: t('workspace.viewJson.sampleLabel'), doc: () => sample() }]
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
  if (!isObject(doc)) return { error: t('workspace.viewJson.plan.notDoc') };
  if (doc.format !== undefined && doc.format !== VIEW_FORMAT) return { error: t('workspace.viewJson.plan.otherFormat', { format: String(doc.format), expected: VIEW_FORMAT }) };
  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== VIEW_VERSION) warnings.push(t('workspace.viewJson.plan.version', { version: String(doc.version), known: VIEW_VERSION }));
  for (const key of Object.keys(doc)) if (!described(TOP_KEYS, key)) warnings.push(t(key === 'parts' || key === 'views' ? 'workspace.viewJson.plan.unknownKeyLayout' : 'workspace.viewJson.plan.unknownKey', { key }));
  if (doc.alerts === undefined) return { next: now, changed: false, lines: [t('workspace.viewJson.plan.noAlerts')], warnings };
  if (!Array.isArray(doc.alerts)) return { error: t('workspace.viewJson.plan.alertsList') };

  const named: AlertKind[] = [];
  const off = new Set(now.off);
  doc.alerts.forEach((raw, i) => {
    const n = i + 1;
    const item = typeof raw === 'string' ? { kind: raw } : raw;
    if (!isObject(item)) { warnings.push(t('workspace.viewJson.plan.notItem', { n })); return; }
    for (const key of Object.keys(item)) if (!described(ALERT_KEYS, key)) warnings.push(t('workspace.viewJson.plan.itemUnknownKey', { n, key }));
    if (typeof item.kind !== 'string' || !KNOWN.has(item.kind)) { warnings.push(t('workspace.viewJson.plan.unknownKind', { n, kind: String(item.kind) })); return; }
    const kind = item.kind as AlertKind;
    if (named.includes(kind)) { warnings.push(t('workspace.viewJson.plan.repeated', { n, label: alertLabel(kind) })); return; }
    named.push(kind);
    if (item.on === undefined || item.on === null) return;
    if (typeof item.on !== 'boolean') { warnings.push(t('workspace.viewJson.plan.badOn', { n })); return; }
    if (item.on) off.delete(kind); else off.add(kind);
  });

  const order = merged(named, now.order);
  const next: AlertSettings = { order, off: order.filter((kind) => off.has(kind)) };
  const turnedOn = now.off.filter((kind) => !off.has(kind));
  const turnedOff = order.filter((kind) => off.has(kind) && !now.off.includes(kind));
  const moved = order.some((kind, i) => now.order[i] !== kind);

  const lines: string[] = [];
  if (moved) lines.push(t('workspace.viewJson.plan.newOrder', { list: labels(order) }));
  if (turnedOn.length > 0) lines.push(t('workspace.viewJson.plan.turnOn', { list: labels(turnedOn) }));
  if (turnedOff.length > 0) lines.push(t('workspace.viewJson.plan.turnOff', { list: labels(turnedOff) }));
  const changed = moved || turnedOn.length > 0 || turnedOff.length > 0;
  if (!changed) lines.push(t('workspace.viewJson.plan.nothing'));
  const missing = now.order.filter((kind) => !named.includes(kind));
  if (changed && missing.length > 0) lines.push(t('workspace.viewJson.plan.missing', { list: labels(missing) }));
  return { next, changed, lines, warnings };
}
