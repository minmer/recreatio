/**
 * 2026-10-27 — DER EINSTIEG DER VORSCHAU (`preview.html`): ein Dokument der
 * Seite, gezeichnet von der echten Anwendung, so wie es nach dem Import
 * aussähe — für Assistenten über den MCP-Dienst `recreatio-preview`
 * (`frontend/mcp/`), für Menschen zum Einfügen. Nichts wird gespeichert.
 * documentation/PREVIEW-MCP.md.
 */

import './app/core/polyfills';
import { startPreview } from './app/preview/PreviewApp';

startPreview(document.getElementById('root')!);
