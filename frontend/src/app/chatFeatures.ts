import { aad, Field, fromBase64Url, open, seal, toBase64Url } from './crypto';
import { API, call, WorkspaceError } from './session';
import type { Attachment } from './chat';

export const chatEndpoint = (id: string, token?: string) => token
  ? `/seat/${encodeURIComponent(token)}/chat/${encodeURIComponent(id)}` : `/workspace/chat/${encodeURIComponent(id)}`;
export interface AvailabilityWindow { day: number; start: number; end: number }
export interface Preferences { timeZone: string; windows: AvailabilityWindow[] | null; useAvailability: boolean; muted: boolean; archived: boolean; readReceipts: boolean; shareAvailability?: boolean }
export interface Mark { messageId: string; mine: boolean; kind: string; value: string }
export interface Features { common: Preferences; settings: Preferences | null; effective: Preferences; canWrite: boolean; postingPolicy: string; marks: Mark[]; typing: number; lastMessageAt: string | null; receipts: { roleIds: string[]; seatId: string | null; readAt: string | null; available: boolean | null }[] }
export const defaultPreferences = (): Preferences => ({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, windows: [], useAvailability: false, muted: false, archived: false, readReceipts: false });
export function availableNow(p: Preferences, now = new Date()): boolean {
  if (!p.useAvailability) return true;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: p.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
  const minute = Number(part('hour')) * 60 + Number(part('minute'));
  return (p.windows ?? []).some(w => w.day === day && minute >= w.start && minute < w.end);
}
const attachmentAad = () => aad('chat', 'attachment', 'file', Field.ChatMessage, 1);

/**
 * Den versiegelten Anhang hinaus — mit XMLHttpRequest, weil nur er sagt, wie
 * weit das Hochladen ist. Auf dem Telefon dauern zehn Megabyte über Mobilfunk
 * eine Minute; ein Satz ohne Fortschritt sieht dann aus wie ein Hänger.
 */
function send(path: string, body: Blob, onProgress?: (part: number) => void): Promise<{ attachmentId: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total); };
    xhr.onerror = () => reject(new WorkspaceError('Nie udało się wysłać pliku — sprawdź połączenie i spróbuj jeszcze raz.'));
    xhr.ontimeout = xhr.onerror;
    xhr.onload = () => {
      let said: unknown = null;
      try { said = JSON.parse(xhr.responseText); } catch { said = null; }
      if (xhr.status >= 200 && xhr.status < 300 && said !== null && typeof said === 'object' && 'attachmentId' in said) {
        resolve(said as { attachmentId: string });
        return;
      }
      if (said !== null && typeof said === 'object' && 'error' in said) { reject(new WorkspaceError(String((said as { error: unknown }).error))); return; }
      reject(new WorkspaceError(xhr.status === 413 ? 'Plik jest za duży dla serwera.' : 'Nie udało się wysłać pliku.'));
    };
    xhr.send(body);
  });
}

export async function uploadAttachment(endpoint: string, file: File, onProgress?: (part: number) => void): Promise<Attachment> {
  if (file.size > 50 * 1024 * 1024 - 1024) throw new WorkspaceError('Plik jest większy niż 50 MB.');
  const key = crypto.getRandomValues(new Uint8Array(32));
  const encrypted = await seal(key, attachmentAad(), new Uint8Array(await file.arrayBuffer()));
  const { attachmentId } = await send(`${endpoint}/attachments`, new Blob([encrypted as BlobPart]), onProgress);
  return { id: attachmentId, name: file.name, type: file.type, size: file.size, key: toBase64Url(key) };
}

/** Ab dieser Grösse wird ein Foto vor dem Senden verkleinert; darunter bleibt es, wie es ist (etwa ein Bildschirmfoto mit Text). */
const SHRINK_FROM = 1.5 * 1024 * 1024;

/**
 * EIN FOTO, WIE ES IN EINE ROZMOWA GEHÖRT — wie bei jedem Messenger.
 *
 * Ein Telefon schreibt vier bis zwölf Megabyte je Aufnahme. So hochgeladen
 * dauert es über Mobilfunk eine Minute, und beim Empfänger erscheint statt
 * des Bildes „Zdjęcie · 9 MB" zum Antippen (`AUTO_BYTES`). Verkleinert auf
 * 2048 px an der langen Kante sind es ein paar hundert Kilobyte — und die
 * EXIF-Angaben, auch der Ort der Aufnahme, gehen dabei verloren.
 *
 * HEIC (iPhone, manche Android-Geräte) wird dort, wo der Browser es lesen
 * kann, ebenso zu einem Bild, das jeder sieht. Ein GIF bleibt (es bewegt sich),
 * und was sich nicht lesen lässt, geht unverändert hinaus. Wer das Original
 * will, schickt es über „Plik".
 */
export async function photoForChat(file: File): Promise<File> {
  const heic = /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (!(file.type.startsWith('image/') || heic) || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (file.size < SHRINK_FROM && !heic) return file;
  const { downscaleImage } = await import('./event/imageDownscale');
  const done = await downscaleImage(file);
  if (done.blob === file) return file;
  return new File([done.blob], done.fileName, { type: done.blob.type, lastModified: file.lastModified });
}
export async function downloadAttachment(endpoint: string, attachment: Attachment): Promise<Blob> {
  const response = await fetch(`${API}${endpoint}/attachments/${encodeURIComponent(attachment.id)}`, { credentials: 'include' });
  if (!response.ok) throw new WorkspaceError('Nie udało się pobrać pliku.');
  const plaintext = await open(fromBase64Url(attachment.key), attachmentAad(), new Uint8Array(await response.arrayBuffer()));
  return new Blob([plaintext as BlobPart], { type: attachment.type || 'application/octet-stream' });
}

export function reportChatSeen(endpoint: string, through: string | null): void {
  if (document.visibilityState !== 'visible' || through === null) return;
  void call(`${endpoint}/seen`, { method: 'POST', body: JSON.stringify({ through }) }).catch(() => undefined);
}
