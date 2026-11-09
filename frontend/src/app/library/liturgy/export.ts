/** Offline artifacts contain resolved presentation copies; canonical storage stays normalized. */
import type { LitEntity } from './schema';
import { indexOf, resolveText } from './resources';
import { modeOf, resourceLines, unitLines, type Line } from './text';
import type { Composition } from './compose';
import { exportLiturgy } from './liturgyJson';
import { t } from '../../core/i18n';
const escape = (text: unknown): string => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** Die liturgische Ansicht als HTML: Zeilen mit * † /, Versnummern, K./W., Kreuz; Hinweise eigens. */
const segHtml = (s: Line['segs'][number]) => `${s.cross ? '✠ ' : ''}<span${s.style ? ` class="${s.style}"` : ''}>${escape(s.text)}</span>${s.mark ? ` <span class="mark">${escape(s.mark)}</span>` : ''}`;
const linesHtml = (lines: readonly Line[]) => lines.map(l => l.kind !== 'text'
  ? `<p class="${l.kind}">${escape(l.segs.map(s => s.text).join(' '))}</p>`
  : `<p class="line${l.gap === 'stanza' ? ' stanza' : l.gap === 'line' ? ' verse' : ''}">${l.role === undefined ? '' : `<b>${escape(t(`liturgy.roles.${l.role}`))}</b> `}${l.verse === undefined ? '' : `<sup>${escape(l.verse)}</sup> `}${l.segs.map(segHtml).join(' ')}</p>`).join('\n');
const page = (title: string, body: string, size: 'A4' | 'A5') => `<!doctype html><html lang="${escape(t('liturgy.htmlLang'))}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:"><title>${escape(title)}</title><style>@page{size:${size};margin:16mm}body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:18px/1.65 Georgia,serif;color:#222}h1,h2,h3{line-height:1.25;break-after:avoid}h1{font-size:1.8rem}h2{font-size:1.4rem}p{margin:.65em 0;white-space:normal}sup{font-size:.7em;color:#666}.rubric,.status{color:#97412e}.response,.bold{font-weight:bold}.italic{font-style:italic}.line{margin:.15em 0}.line.verse{margin-top:.8em}.line.stanza{margin-top:1.4em}.mark{color:#97412e}.heading,.subtitle,.part{font-weight:bold}.sentence{font-style:italic}.antiphon,.antiphon_repeat{margin:.8em 0}.meta{font:13px/1.5 system-ui;overflow-wrap:anywhere;color:#555}pre{white-space:pre-wrap;font:12px/1.5 monospace;overflow-wrap:anywhere}article{margin:2rem 0}a{color:inherit}details{margin:1rem 0}@media print{.controls{display:none}article{break-before:page}article:first-of-type{break-before:auto}p{orphans:3;widows:3}}</style><body><div class="controls"><button onclick="window.print()">${escape(t('liturgy.printPdf'))}</button></div><h1>${escape(title)}</h1>${body}</body></html>`;
export function printDocument(compositions: readonly Composition[], size: 'A4' | 'A5'): string {
  return page(t('liturgy.name'), compositions.map(c => `<article><h2>${escape(c.requestedDate)} · ${escape(t(`liturgy.hours.${c.hour}`))}</h2><h3>${escape(c.day.selected.title)}</h3>${c.complete ? '' : `<p class="status">${escape(t('liturgy.incomplete'))}</p>`}${c.slots.map(s => s.status === 'omitted' || !s.required && s.status === 'missing' ? '' : `<section><h3>${escape(t(`liturgy.slots.${s.label.replace(/\./g, '_')}`) === `liturgy.slots.${s.label.replace(/\./g, '_')}` ? s.label : t(`liturgy.slots.${s.label.replace(/\./g, '_')}`))}</h3>${s.status === 'ready' ? '' : `<p class="status">${escape(t(`liturgy.status.${s.status}`))}</p>`}${s.parts.map(p => `<div class="${p.kind}">${p.kind.startsWith('antiphon') ? `<b>${escape(t('liturgy.view.ant'))}</b> ` : ''}${linesHtml(p.lines)}</div>`).join('')}<p class="meta">${escape([s.resourceId, s.editionId, s.assignmentId, s.ruleId, s.authority].filter(Boolean).join(' · '))}</p></section>`).join('')}</article>`).join(''), size);
}
export function offlineDocument(title: string, entities: readonly LitEntity[]): string {
  const index = indexOf(entities);
  return page(title, `<p>${escape(t('liturgy.offlineHint'))}</p><nav><ul>${entities.map(e => `<li><a href="#${escape(e.id)}">${escape(e.title)}</a></li>`).join('')}</ul></nav>${entities.map(e => `<article id="${escape(e.id)}"><h2>${escape(e.title)}</h2><p class="meta">${escape(e.id)} · ${escape(t(`liturgy.types.${e.entity_type}`))} · ${escape(e.status)}</p>${(() => { const r = resolveText(e.id, index); return r === null ? '' : linesHtml(r.passage === undefined ? resourceLines(r.resource) : unitLines(r.resource.text, r.units, modeOf(r.resource.resource_type))); })()}<details><summary>${escape(t('liturgy.metadata'))}</summary><pre>${escape(JSON.stringify(e, null, 2))}</pre></details></article>`).join('')}<details><summary>JSON</summary><pre>${escape(JSON.stringify(exportLiturgy(title, entities), null, 2))}</pre></details>`, 'A4');
}
export function download(name: string, body: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([body], { type })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function openPrint(html: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })), link = document.createElement('a');
  link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
