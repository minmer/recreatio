/**
 * EIN TEXT MIT EIN WENIG GESTALT (0085) — für den Baustein „Tekst" und die
 * Texte einer Präsentation. So, wie man es ohnehin in ein Textfeld schreibt:
 *
 * <code>
 *   ## Zwischenüberschrift
 *   # Eine grosse Zeile (eine E-Mail, ein Satz, der zählt)
 *   > Eine kleine, leise Zeile (ein Hinweis darunter)
 *   [Napisz do nas](mailto:…) · [O nas](#/o-nas)     — eine Zeile nur aus Verweisen: eine Reihe
 *   Ein Absatz mit einem [Verweis](https://…) darin.
 * </code>
 *
 * <b>Ein Verweis darf nur dorthin, wohin ein Verweis darf</b> (`textLink`):
 * ins Netz, auf eine Seite hier, eine Szene, eine E-Mail, ein Telefon. Alles
 * andere bleibt, wie es geschrieben ist.
 */

import type { ReactNode } from 'react';

import { textLink } from './presentation';

const LINK = /\[([^\]\n]{1,200})\]\(([^)\s]{1,600})\)/g;
const ONLY_LINKS = /^(\s*\[[^\]\n]{1,200}\]\([^)\s]{1,600}\)\s*[·|,•]?\s*)+$/;

/** Ein Verweis: in diesem Fenster, wenn er hierher führt — sonst in einem neuen. */
function Link({ href, label }: { href: string; label: string }) {
  const outside = /^https?:/i.test(href);
  return (
    <a className="wk-link" href={href} {...(outside ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {label}
    </a>
  );
}

/** Ein Stück Text mit seinen Verweisen. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0;
    if (start > at) out.push(text.slice(at, start));
    const href = textLink(match[2]);
    out.push(href === null ? match[0] : <Link key={start} href={href} label={match[1]} />);
    at = start + match[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

export type LineKind = 'gap' | 'sub' | 'lead' | 'quiet' | 'links' | 'text';

/** Was eine Zeile ist — und ihr Text ohne das Zeichen davor. */
export function lineKind(line: string): { readonly kind: LineKind; readonly text: string } {
  const t = line.trim();
  if (t === '') return { kind: 'gap', text: '' };
  const sub = /^#{2,3}\s+(.*)$/.exec(t);
  if (sub !== null) return { kind: 'sub', text: sub[1] };
  const lead = /^#\s+(.*)$/.exec(t);
  if (lead !== null) return { kind: 'lead', text: lead[1] };
  const quiet = /^>\s?(.*)$/.exec(t);
  if (quiet !== null) return { kind: 'quiet', text: quiet[1] };
  if (ONLY_LINKS.test(t)) return { kind: 'links', text: t };
  return { kind: 'text', text: t };
}

/** Die Verweise einer Zeile, die nur aus Verweisen besteht — als Reihe. */
export function linkRow(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  for (const match of text.matchAll(LINK)) {
    const href = textLink(match[2]);
    out.push(href === null ? <span key={match.index}>{match[1]}</span> : <Link key={match.index} href={href} label={match[1]} />);
  }
  return out;
}

/**
 * Eine Zeile als Element — mit den Klassen der Karte (`wk-card-*`). Eine
 * leere Zeile zeigt nur, wer sie zeigen will (`gaps`): in einer Pointe trennt
 * sie zwei Gedankengruppen, in einem Fliesstext ist sie nichts.
 */
export function RichLine({ line, gaps = false }: { line: string; gaps?: boolean }) {
  const { kind, text } = lineKind(line);
  switch (kind) {
    case 'gap': return gaps ? <span className="wk-card-gap" aria-hidden="true" /> : null;
    case 'sub': return <h3 className="wk-card-sub">{inline(text)}</h3>;
    case 'lead': return <p className="wk-card-lead">{inline(text)}</p>;
    case 'quiet': return <p className="wk-card-quiet">{inline(text)}</p>;
    case 'links': return <p className="wk-card-links">{linkRow(text)}</p>;
    case 'text': return <p className="wk-card-text">{inline(text)}</p>;
  }
}
