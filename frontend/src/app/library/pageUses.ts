/**
 * 2026-10-22 — AUF WELCHEN SEITEN EIN EINTRAG STEHT (Schritt 4): nur auf den
 * Seiten, die dieses Konto führt (`loadDesk`, Adressen ohne `aliasOf`). Ihre
 * Bausteine werden geholt, wie der Editor sie holt — versiegelte mit dem
 * Schlüssel dieses Browsers —, und ihre Einstellungen nach Kennungen und
 * Verweisen durchsucht (`refsOf`). Andere Seiten werden nie gefragt: wer eine
 * Seite nicht führt, erfährt hier nichts über sie.
 */

import { loadPage } from '../pages/page';
import { loadDesk } from '../workspace/desk';
import { refsOf } from './refIndex';

export interface PageUse {
  readonly path: string;
  readonly title: string;
  /** Die Bausteine, die auf einen der Einträge zeigen — mit ihrer Art. */
  readonly parts: readonly { readonly id: string; readonly kind: string; readonly label: string }[];
}

function configOf(raw: string | null): Record<string, unknown> | null {
  if (raw === null || raw.trim() === '') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/**
 * Die geführten Seiten, deren Bausteine auf einen der Einträge zeigen.
 * `resolve`: ein Schlüssel im Text eines Bausteins („Tekst" mit `[@klucz]`).
 */
export async function pagesUsing(targets: ReadonlySet<string>, resolve: (token: string) => string | undefined): Promise<PageUse[]> {
  const desk = await loadDesk();
  /* Die Namen der Bausteine erst jetzt — das Verzeichnis aller Bausteine ist gross. */
  const { partOf } = await import('../pages/parts/registry');
  const paths = desk.pages.filter((one) => one.aliasOf === null).map((one) => one.path);
  const out: PageUse[] = [];
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const path = paths[next]!;
      next += 1;
      const page = await loadPage(path).catch(() => null);
      if (page === null) continue;
      const parts = page.parts.filter((part) => {
        const config = configOf(part.config);
        return config !== null && refsOf({ data: config }, resolve).some((ref) => targets.has(ref.target));
      });
      if (parts.length > 0) out.push({ path, title: page.title ?? path, parts: parts.map((part) => ({ id: part.id, kind: part.kind, label: partOf(part.kind)?.label ?? part.kind })) });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
