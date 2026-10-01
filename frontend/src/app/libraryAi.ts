/**
 * ZITATE VON DEN FOTOS LESEN — mit Claude, direkt aus dem Browser.
 *
 * <b>Der Dienst ist nicht dabei.</b> Die Fotos gehen von hier zu Anthropic,
 * mit dem eigenen Schlüssel dessen, der liest; recreatio sieht weder Fotos
 * noch Zitate (die kommen versiegelt in die Bibliothek wie alles andere). Der
 * Schlüssel liegt im gemerkten Stand (`prefs.ts`) — versiegelt unter dem
 * Schlüssel des Kontos, auf jedem Gerät derselbe.
 *
 * Wer keinen Schlüssel hat, nimmt das Polecenie (`quotesPrompt`) in einen
 * beliebigen Chat mit und bringt das JSON zurück — dasselbe Ergebnis.
 *
 * <b>Sicher JSON:</b> die Antwort kommt als Aufruf eines Werkzeugs mit Schema
 * (`QUOTES_TOOL`), nicht als Text, den man erst aus Erklärungen schälen müsste.
 */

import { QUOTES_FORMAT, QUOTES_TOOL } from './libraryQuotes';
import { WorkspaceError } from './session';

export const AI_MODELS = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 — najdokładniej' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — taniej i szybciej' }
] as const;

export const DEFAULT_MODEL = AI_MODELS[0].value;

/** So viele Fotos je Anfrage — mehr macht die Antwort lang und den Fehler teuer. */
const PER_CALL = 6;

/** Die lange Kante, ab der Anthropic selbst verkleinern würde — Text ist bei dieser Grösse noch gut lesbar. */
const LONG_EDGE = 1568;

export interface PhotoPart {
  readonly base64: string;
  readonly mediaType: 'image/jpeg';
}

/** Ein Foto als JPEG, höchstens 1568 px an der langen Kante, aufrecht (EXIF), ohne EXIF. */
export async function photoPart(file: Blob): Promise<PhotoPart> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new WorkspaceError('Tego zdjęcia nie da się odczytać w przeglądarce (np. HEIC) — zrób je jako JPG.');
  }
  try {
    const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (blob === null) throw new WorkspaceError('Nie udało się przygotować zdjęcia.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(binary), mediaType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}

interface ToolUse { type: 'tool_use'; name: string; input: { quotes?: unknown[] } }

/** Was Anthropic sagt, wenn es nicht geht — auf Polnisch und mit dem, was zu tun ist. */
function refusal(status: number, said: unknown): WorkspaceError {
  const message = typeof said === 'object' && said !== null ? String((said as { error?: { message?: unknown } }).error?.message ?? '') : '';
  if (status === 401) return new WorkspaceError('Klucz API nie działa — sprawdź go w ustawieniach (Anthropic Console → API Keys).');
  if (status === 403) return new WorkspaceError('Ten klucz API nie ma dostępu do wybranego modelu.');
  if (status === 404) return new WorkspaceError('Nie ma takiego modelu — wybierz inny w ustawieniach.');
  if (status === 413) return new WorkspaceError('Za duże zdjęcia naraz — wybierz mniej zdjęć.');
  if (status === 429) return new WorkspaceError('Za dużo zapytań albo wyczerpany limit konta — spróbuj za chwilę.');
  if (status === 529 || status >= 500) return new WorkspaceError('Usługa AI jest teraz przeciążona — spróbuj za chwilę.');
  return new WorkspaceError(message === '' ? `Usługa AI odmówiła (${status}).` : `Usługa AI: ${message}`);
}

/**
 * Die Fotos lesen lassen — in Gruppen zu sechs, die Nummern der Fotos über
 * alle Gruppen fortlaufend. Zurück kommt ein Dokument im Format
 * `recreatio/quotes`, wie es auch ein fremder Chat schreiben würde.
 */
export async function readQuotesFromPhotos(
  photos: readonly Blob[],
  prompt: string,
  settings: { key: string; model: string },
  stage: (what: string) => void
): Promise<{ format: string; version: number; quotes: unknown[] }> {
  if (settings.key.trim() === '') throw new WorkspaceError('Brak klucza API — wpisz go w ustawieniach poniżej.');
  const quotes: unknown[] = [];
  const groups = Math.ceil(photos.length / PER_CALL);

  for (let g = 0; g < groups; g += 1) {
    const from = g * PER_CALL;
    const slice = photos.slice(from, from + PER_CALL);
    stage(groups === 1 ? 'Przygotowanie zdjęć…' : `Przygotowanie zdjęć ${from + 1}–${from + slice.length} z ${photos.length}…`);
    const parts = await Promise.all(slice.map(photoPart));
    const content: unknown[] = [];
    parts.forEach((part, i) => {
      content.push({ type: 'text', text: `Zdjęcie ${from + i + 1}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.base64 } });
    });
    content.push({ type: 'text', text: prompt });

    stage(groups === 1 ? 'AI czyta zdjęcia…' : `AI czyta zdjęcia ${from + 1}–${from + slice.length} z ${photos.length}…`);
    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.key.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: settings.model || DEFAULT_MODEL,
          max_tokens: 16000,
          tools: [QUOTES_TOOL],
          tool_choice: { type: 'tool', name: QUOTES_TOOL.name },
          messages: [{ role: 'user', content }]
        })
      });
    } catch {
      throw new WorkspaceError('Nie udało się połączyć z usługą AI — sprawdź internet.');
    }
    const said = await response.json().catch(() => null) as { content?: unknown[]; stop_reason?: string } | null;
    if (!response.ok) throw refusal(response.status, said);
    if (said?.stop_reason === 'max_tokens') throw new WorkspaceError('Odpowiedź była za długa — wybierz mniej zdjęć naraz.');
    const call = (said?.content ?? []).find((c): c is ToolUse => typeof c === 'object' && c !== null && (c as ToolUse).type === 'tool_use');
    if (call === undefined || !Array.isArray(call.input.quotes)) throw new WorkspaceError('AI nie zwróciła cytatów — spróbuj jeszcze raz.');
    quotes.push(...call.input.quotes);
  }
  return { format: QUOTES_FORMAT, version: 1, quotes };
}
