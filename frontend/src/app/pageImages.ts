/**
 * BILDER EINER SEITE (0062) — hochladen, auflisten, wegnehmen.
 *
 * Öffentlich wie die Seite: ein Hintergrund wird jedem gezeigt, der sie öffnet
 * (`PageImage.cs`). In einer Schicht steht er als `page-image:<id>` — die
 * Adresse des Dienstes setzt erst die Anzeige davor (`slides.imageUrl`), damit
 * dieselbe Seite in der Entwicklung und im Betrieb auf ihren Dienst zeigt.
 */

import { API, call, WorkspaceError } from './session';

export interface PageImageRow {
  readonly id: string;
  readonly contentType: string;
  readonly size: number;
  readonly name: string | null;
  readonly createdAt: string;
}

const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const loadPageImages = (path: string): Promise<{ images: readonly PageImageRow[] }> =>
  call(`/workspace/page-images/${encodePath(path)}`);

export async function uploadPageImage(path: string, file: File): Promise<PageImageRow> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new WorkspaceError('Tylko obrazy: JPEG, PNG, WebP, GIF albo AVIF.');
  }
  if (file.size > MAX_IMAGE_BYTES) throw new WorkspaceError('Obraz może mieć najwyżej 8 MB.');

  let response: Response;
  try {
    response = await fetch(`${API}/workspace/page-image/${encodePath(path)}?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': file.type, Accept: 'application/json' },
      body: file
    });
  } catch {
    throw new WorkspaceError('Nie udało się połączyć z usługą.');
  }

  const said = await response.json().catch(() => null) as { id?: string; error?: string; contentType?: string; size?: number } | null;
  if (!response.ok || said?.id === undefined) {
    throw new WorkspaceError(said?.error ?? 'Nie udało się wgrać obrazu.');
  }
  return { id: said.id, contentType: said.contentType ?? file.type, size: said.size ?? file.size, name: file.name, createdAt: new Date().toISOString() };
}

export const deletePageImage = (id: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/page-image-file/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Wie die Schicht das Bild nennt. */
export const imageRef = (id: string): string => `page-image:${id}`;
