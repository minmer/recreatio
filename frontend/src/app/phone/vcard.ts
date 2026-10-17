/**
 * vCARD — das Format, in dem Kontakte zwischen Telefonen, Google und Outlook
 * wandern. Gelesen wird, was dort typischerweise steht (2.1 mit
 * QUOTED-PRINTABLE, 3.0, 4.0), geschrieben wird 3.0.
 *
 * Reine Zeichenarbeit — ohne Netz und ohne Schlüssel, damit es sich prüfen lässt.
 */

export interface CardData {
  readonly name: string;
  readonly given: string | null;
  readonly family: string | null;
  readonly org: string | null;
  readonly title: string | null;
  readonly phones: readonly { readonly number: string; readonly label: string | null }[];
  readonly emails: readonly { readonly address: string; readonly label: string | null }[];
  readonly note: string | null;
  readonly birthday: string | null;
  readonly groups: readonly string[];
}

/* -- Lesen ------------------------------------------------------------------------------------ */

/** Fortsetzungszeilen (Leerzeichen oder Tab am Anfang) an ihre Zeile; „=" am Ende bei QUOTED-PRINTABLE auch. */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    const last = out.length - 1;
    if ((line.startsWith(' ') || line.startsWith('\t')) && last >= 0) {
      out[last] += line.slice(1);
    } else if (last >= 0 && /ENCODING=QUOTED-PRINTABLE/i.test(out[last].split(':')[0]) && out[last].endsWith('=')) {
      out[last] = out[last].slice(0, -1) + line;
    } else {
      out.push(line);
    }
  }
  return out;
}

function quotedPrintable(value: string, charset: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(c.charCodeAt(0) & 0xff);
    }
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }
}

const unescape = (value: string): string =>
  value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

/** Ein Wert in seine Teile (an „;", nicht an „\;"). */
function parts(value: string): string[] {
  const out: string[] = [];
  let at = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) { at += value[i] + value[i + 1]; i++; continue; }
    if (value[i] === ';') { out.push(at); at = ''; continue; }
    at += value[i];
  }
  out.push(at);
  return out.map(unescape);
}

const LABELS: Record<string, string> = {
  cell: 'komórka', mobile: 'komórka', home: 'dom', work: 'praca', main: 'główny', pref: '', voice: '', other: '', internet: '', x400: ''
};

/** Die Art (TYPE=CELL,VOICE / TYPE=work / X-…) als Wort, oder `null`. */
function labelOf(params: readonly string[]): string | null {
  const types: string[] = [];
  for (const p of params) {
    const [key, value] = p.includes('=') ? [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)] : ['TYPE', p];
    if (key.toUpperCase() !== 'TYPE') continue;
    for (const t of value.replace(/"/g, '').split(',')) types.push(t.trim().toLowerCase());
  }
  for (const t of types) {
    const word = LABELS[t];
    if (word !== undefined && word !== '') return word;
  }
  const custom = types.find((t) => t.startsWith('x-'));
  return custom === undefined ? null : custom.slice(2);
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** Alle Kontakte einer vCard-Datei. */
export function parseVCards(text: string): CardData[] {
  const out: CardData[] = [];
  let card: {
    fn: string | null; given: string | null; family: string | null; org: string | null; title: string | null;
    phones: { number: string; label: string | null }[]; emails: { address: string; label: string | null }[];
    note: string | null; birthday: string | null; groups: string[];
  } | null = null;

  for (const line of unfold(text)) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    let value = line.slice(colon + 1);
    const [nameWithGroup, ...params] = head.split(';');
    const name = nameWithGroup.split('.').pop()!.toUpperCase();

    if (name === 'BEGIN' && value.trim().toUpperCase() === 'VCARD') {
      card = { fn: null, given: null, family: null, org: null, title: null, phones: [], emails: [], note: null, birthday: null, groups: [] };
      continue;
    }
    if (card === null) continue;
    if (name === 'END' && value.trim().toUpperCase() === 'VCARD') {
      const given = card.given;
      const family = card.family;
      const nameText = clean(card.fn) ?? clean([given, family].filter(Boolean).join(' '))
        ?? card.org ?? card.phones[0]?.number ?? card.emails[0]?.address ?? null;
      if (nameText !== null) {
        out.push({
          name: nameText, given, family, org: card.org, title: card.title,
          phones: card.phones, emails: card.emails, note: card.note, birthday: card.birthday, groups: card.groups
        });
      }
      card = null;
      continue;
    }

    const encoding = params.find((p) => /^ENCODING=/i.test(p))?.split('=')[1]?.toUpperCase() ?? (params.some((p) => p.toUpperCase() === 'QUOTED-PRINTABLE') ? 'QUOTED-PRINTABLE' : '');
    const charset = params.find((p) => /^CHARSET=/i.test(p))?.split('=')[1] ?? 'utf-8';
    if (encoding === 'QUOTED-PRINTABLE') value = quotedPrintable(value, charset);
    if (encoding === 'B' || encoding === 'BASE64') continue;

    switch (name) {
      case 'FN': card.fn = clean(unescape(value)); break;
      case 'N': {
        const [family, given, middle] = parts(value);
        card.family = clean(family);
        card.given = clean([given, middle].filter((x) => clean(x) !== null).join(' '));
        break;
      }
      case 'TEL': {
        const number = clean(unescape(value).replace(/^tel:/i, ''));
        if (number !== null && !card.phones.some((p) => p.number.replace(/\D/g, '') === number.replace(/\D/g, ''))) {
          card.phones.push({ number, label: labelOf(params) });
        }
        break;
      }
      case 'EMAIL': {
        const address = clean(unescape(value).replace(/^mailto:/i, ''));
        if (address !== null && !card.emails.some((e) => e.address.toLowerCase() === address.toLowerCase())) {
          card.emails.push({ address, label: labelOf(params) });
        }
        break;
      }
      case 'ORG': card.org = clean(parts(value).filter((x) => x.trim() !== '').join(', ')); break;
      case 'TITLE': card.title = clean(unescape(value)); break;
      case 'NOTE': card.note = clean(unescape(value)); break;
      case 'BDAY': card.birthday = birthdayOf(value); break;
      case 'CATEGORIES':
        for (const g of unescape(value).split(',')) {
          const t = g.trim();
          if (t !== '' && !card.groups.includes(t) && t.toLowerCase() !== 'mycontacts' && t !== 'My Contacts') card.groups.push(t);
        }
        break;
      default: break;
    }
  }
  return out;
}

/** „19900504", „1990-05-04", „--0504" → „1990-05-04" / „--05-04". */
function birthdayOf(value: string): string | null {
  const v = value.trim().split('T')[0];
  let m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(v);
  if (m !== null) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^--(\d{2})-?(\d{2})$/.exec(v);
  if (m !== null) return `--${m[1]}-${m[2]}`;
  return null;
}

/* -- Schreiben -------------------------------------------------------------------------------- */

const escape = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const TYPE_OF: Record<string, string> = { 'komórka': 'CELL', dom: 'HOME', praca: 'WORK', 'główny': 'MAIN' };

/** Lange Zeilen umbrechen (75 Bytes, wie es das Format will) — an Zeichengrenzen. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (size + bytes > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += bytes;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function formatVCards(cards: readonly CardData[]): string {
  const lines: string[] = [];
  for (const c of cards) {
    lines.push('BEGIN:VCARD', 'VERSION:3.0');
    lines.push(`FN:${escape(c.name)}`);
    lines.push(`N:${escape(c.family ?? '')};${escape(c.given ?? (c.family === null ? c.name : ''))};;;`);
    for (const p of c.phones) {
      const type = p.label === null ? 'CELL' : TYPE_OF[p.label] ?? `X-${p.label.replace(/[^\p{L}\p{N}-]/gu, '')}`;
      lines.push(`TEL;TYPE=${type}:${p.number}`);
    }
    for (const e of c.emails) {
      const type = e.label === null ? 'INTERNET' : TYPE_OF[e.label] ?? 'INTERNET';
      lines.push(`EMAIL;TYPE=${type}:${e.address}`);
    }
    if (c.org !== null) lines.push(`ORG:${escape(c.org)}`);
    if (c.title !== null) lines.push(`TITLE:${escape(c.title)}`);
    if (c.birthday !== null) lines.push(`BDAY:${c.birthday}`);
    if (c.groups.length > 0) lines.push(`CATEGORIES:${c.groups.map((g) => g.replace(/\\/g, '\\\\').replace(/,/g, '\\,')).join(',')}`);
    if (c.note !== null) lines.push(`NOTE:${escape(c.note)}`);
    lines.push('END:VCARD');
  }
  return lines.map(fold).join('\r\n') + '\r\n';
}
