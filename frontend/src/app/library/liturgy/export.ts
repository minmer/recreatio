/** Offline artifacts contain resolved presentation copies; canonical storage stays normalized. */
import type { LitEntity, TextBlock } from './schema';
import { indexOf, resolveText } from './resources';
import type { Composition } from './compose';
import { exportEntities } from './persistence';
import { t } from '../../core/i18n';
const escape = (text: unknown): string => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const blockHtml = (blocks: readonly TextBlock[]) => blocks.map(b => `<p class="${b.type}${b.emphasis ? ` ${b.emphasis}` : ''}">${b.verse === undefined ? '' : `<sup>${b.verse}</sup> `}${b.speaker ? `<b>${escape(b.speaker)}</b> ` : ''}${escape(b.text).replace(/\n/g, '<br>')}</p>`).join('\n');
const page = (title: string, body: string, size: 'A4' | 'A5') => `<!doctype html><html lang="${escape(t('liturgy.htmlLang'))}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:"><title>${escape(title)}</title><style>@page{size:${size};margin:16mm}body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:18px/1.65 Georgia,serif;color:#222}h1,h2,h3{line-height:1.25;break-after:avoid}h1{font-size:1.8rem}h2{font-size:1.4rem}p{margin:.65em 0;white-space:normal}sup{font-size:.7em;color:#666}.rubric,.status{color:#97412e}.response,.bold{font-weight:bold}.italic{font-style:italic}.stanza,.verse{padding-left:1rem}.meta{font:13px/1.5 system-ui;overflow-wrap:anywhere;color:#555}pre{white-space:pre-wrap;font:12px/1.5 monospace;overflow-wrap:anywhere}article{margin:2rem 0}a{color:inherit}details{margin:1rem 0}@media print{.controls{display:none}article{break-before:page}article:first-of-type{break-before:auto}p{orphans:3;widows:3}}</style><body><div class="controls"><button onclick="window.print()">${escape(t('liturgy.printPdf'))}</button></div><h1>${escape(title)}</h1>${body}</body></html>`;
export function printDocument(compositions: readonly Composition[], size: 'A4' | 'A5'): string {
  return page(t('liturgy.name'), compositions.map(c => `<article><h2>${escape(c.requestedDate)} · ${escape(t(`liturgy.hours.${c.hour}`))}</h2><h3>${escape(c.day.selected.title)}</h3>${c.complete ? '' : `<p class="status">${escape(t('liturgy.incomplete'))}</p>`}${c.slots.map(s => s.status === 'omitted' || !s.required && s.status === 'missing' ? '' : `<section><h3>${escape(t(`liturgy.slots.${s.label}`) === `liturgy.slots.${s.label}` ? s.label : t(`liturgy.slots.${s.label}`))}</h3>${s.status === 'ready' ? '' : `<p class="status">${escape(t(`liturgy.status.${s.status}`))}</p>`}${s.antiphon ? blockHtml(s.antiphon.blocks) : ''}${blockHtml(s.blocks)}${s.antiphon ? blockHtml(s.antiphon.blocks) : ''}<p class="meta">${escape([s.resourceId, s.editionId, s.assignmentId, s.ruleId, s.authority].filter(Boolean).join(' · '))}</p></section>`).join('')}</article>`).join(''), size);
}
export function offlineDocument(title: string, entities: readonly LitEntity[]): string {
  const index = indexOf(entities);
  return page(title, `<p>${escape(t('liturgy.offlineHint'))}</p><nav><ul>${entities.map(e => `<li><a href="#${escape(e.id)}">${escape(e.title)}</a></li>`).join('')}</ul></nav>${entities.map(e => `<article id="${escape(e.id)}"><h2>${escape(e.title)}</h2><p class="meta">${escape(e.id)} · ${escape(t(`liturgy.types.${e.entity_type}`))} · ${escape(e.status)}</p>${blockHtml(resolveText(e.id, index)?.blocks ?? [])}<details><summary>${escape(t('liturgy.metadata'))}</summary><pre>${escape(JSON.stringify(e, null, 2))}</pre></details></article>`).join('')}<details><summary>JSON</summary><pre>${escape(JSON.stringify(exportEntities(entities), null, 2))}</pre></details>`, 'A4');
}
export function download(name: string, body: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([body], { type })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function openPrint(html: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })), link = document.createElement('a');
  link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
