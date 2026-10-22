/**
 * 0121 — EINE SEITE VERSIEGELN ODER WIEDER ÖFFNEN, als Ganzes.
 *
 * Der Browser holt die Seite (geöffnet, falls sie schon versiegelt ist) und ihr
 * eigenes Menü, macht einen NEUEN Schlüssel (Fassung + 1), verpackt ihn für die
 * Bereiche der Seite und die Rolle, die sie führt, versiegelt jedes Stück unter
 * ihm — und schickt alles in einem Zug (`PUT /workspace/page-seal/{path}`).
 * Wieder öffnen geht denselben Weg mit offenen Stücken.
 *
 * <b>Derselbe Zug erneuert den Schlüssel</b>, wenn sich die Bereiche der Seite
 * ändern: wer aus ihnen fällt, hatte den alten — der neue geht nur noch an die,
 * die bleiben und dazukommen.
 */

import { forgetLoadedPageKeys, loadPage, pageKeyOf, type PageContent } from './page';
import { loadMenu } from './menu';
import { newPageKey, openAreasAmong, sealAad, sealPiece, type PageKey, type SealWrap } from './pageSeal';
import type { Ring } from '../core/keys';
import { call, WorkspaceError } from '../core/session';

const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

export interface SealOutcome {
  /** Versiegelt (mit dieser Fassung) — oder wieder offen. */
  readonly sealed: boolean;
  readonly version: number | null;
  /** Bereiche der Seite, für die dieser Browser den Schlüssel nicht verpacken konnte. */
  readonly missing: readonly string[];
}

/** Die Seite, wie sie jetzt ist — offen. Ohne Schlüssel einer versiegelten Seite geht es nicht weiter. */
async function current(path: string): Promise<{ page: PageContent; menu: string | null }> {
  const page = await loadPage(path);
  if (page.locked === true) throw new WorkspaceError('Ta strona jest zaszyfrowana, a ta przeglądarka nie ma do niej klucza.');
  if (page.id === undefined) throw new WorkspaceError('Serwer jest starszy niż szyfrowanie stron — najpierw trzeba go zaktualizować.');

  const state = await loadMenu(path);
  return { page, menu: state.items === null ? null : JSON.stringify(state.items) };
}

/**
 * VERSIEGELN (auch: den Schlüssel erneuern). `areas` — die Bereiche der Seite,
 * `ownerRoleId` — die Rolle, die sie führt (bekommt den Schlüssel auch).
 */
export async function sealPage(path: string, areas: readonly string[], ownerRoleId: string | null, ring: Ring): Promise<SealOutcome> {
  if (areas.length === 0) throw new WorkspaceError('Zaszyfrować można tylko stronę z dostępem — najpierw wybierz obszary.');

  const { page, menu } = await current(path);
  const version = (page.seal?.v ?? 0) + 1;
  const made = await newPageKey(page.id!, version, areas, ownerRoleId, ring);
  if (made.wraps.length === 0) throw new WorkspaceError('Nie masz klucza żadnego z obszarów tej strony — nie da się jej zaszyfrować.');

  const key: PageKey = made.key;
  const piece = (label: ReturnType<typeof sealAad.title>, text: string | null | undefined) =>
    text == null ? Promise.resolve(null) : sealPiece(key, label, text);

  const body = {
    seal: { v: version, w: made.wraps as readonly SealWrap[] },
    title: await piece(sealAad.title(key.id, version), page.title),
    lead: await piece(sealAad.lead(key.id, version), page.lead),
    theme: await piece(sealAad.look(key.id, version), page.theme),
    logic: await piece(sealAad.logic(key.id, version), page.logic),
    subject: await piece(sealAad.subject(key.id, version), page.subject),
    parts: await Promise.all(page.parts.map(async (part) => ({
      id: part.id,
      layout: await sealPiece(key, sealAad.layout(part.id, version), part.layout),
      config: part.kind === 'form' ? null : await piece(sealAad.config(part, version), part.config)
    }))),
    menu: await piece(sealAad.menu(key.id, version), menu)
  };

  await call(`/workspace/page-seal/${encodePath(path)}`, { method: 'PUT', body: JSON.stringify(body) });
  forgetLoadedPageKeys();
  return { sealed: true, version, missing: made.missing };
}

/** WIEDER ÖFFNEN: alles offen zurück, der Schlüssel geht. */
export async function unsealPage(path: string): Promise<SealOutcome> {
  const { page, menu } = await current(path);
  if (pageKeyOf(path) === null && page.seal != null) throw new WorkspaceError('Ta strona jest zaszyfrowana, a ta przeglądarka nie ma do niej klucza.');

  const body = {
    seal: null,
    title: page.title,
    lead: page.lead,
    theme: page.theme ?? null,
    logic: page.logic ?? null,
    subject: page.subject ?? null,
    parts: page.parts.map((part) => ({ id: part.id, layout: part.layout, config: part.kind === 'form' ? null : part.config })),
    menu
  };

  await call(`/workspace/page-seal/${encodePath(path)}`, { method: 'PUT', body: JSON.stringify(body) });
  forgetLoadedPageKeys();
  return { sealed: false, version: null, missing: [] };
}

/**
 * WIE ES UM DIE SEITE STEHT — für die Einstellungen: versiegelt oder nicht,
 * welche ihrer Bereiche keinen Schlüssel haben (die Hülle fehlt, oder sie liegt
 * unter einer alten Epoche), und welche jawny sind (dort versiegelt es nichts).
 */
export async function sealState(page: { readonly seal?: { readonly v: number; readonly w: readonly SealWrap[] } | null; readonly accessAreaIds?: readonly string[] }): Promise<{
  readonly sealed: boolean;
  readonly unwrapped: readonly string[];
  readonly open: readonly string[];
}> {
  const areas = page.accessAreaIds ?? [];
  const wrapped = new Set((page.seal?.w ?? []).flatMap((one) => (one.a === undefined ? [] : [one.a])));
  return {
    sealed: page.seal != null,
    unwrapped: page.seal == null ? [] : areas.filter((id) => !wrapped.has(id)),
    open: await openAreasAmong(areas).catch(() => [])
  };
}
