/**
 * 2026-10-27 — DER EINSTIEG DER VORSCHAU (`preview.html`): ein Dokument der
 * Seite, gezeichnet von der echten Anwendung, so wie es nach dem Import
 * aussähe — für Assistenten über den MCP-Dienst `recreatio-preview`
 * (`frontend/mcp/`), für Menschen zum Einfügen. Nichts wird gespeichert.
 * documentation/PREVIEW-MCP.md.
 */

import './app/core/polyfills';
import './locales';
import { startI18n } from './app/core/i18n';
import { startPreview } from './app/preview/PreviewApp';

/* 2026-11-05 — die Sprache vor dem ersten Bild; `?lang=` wählt sie für die Vorschau. */
const asked = new URLSearchParams(window.location.search).get('lang');
void startI18n(asked === 'en' || asked === 'de' || asked === 'pl' ? asked : undefined).then(() => startPreview(document.getElementById('root')!));
