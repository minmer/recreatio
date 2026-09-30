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
export async function uploadAttachment(endpoint: string, file: File): Promise<Attachment> {
  if (file.size > 50 * 1024 * 1024 - 1024) throw new WorkspaceError('Plik jest większy niż 50 MB.');
  const key = crypto.getRandomValues(new Uint8Array(32));
  const encrypted = await seal(key, attachmentAad(), new Uint8Array(await file.arrayBuffer()));
  const { attachmentId } = await call<{ attachmentId: string }>(`${endpoint}/attachments`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: new Blob([encrypted as BlobPart])
  });
  return { id: attachmentId, name: file.name, type: file.type, size: file.size, key: toBase64Url(key) };
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
