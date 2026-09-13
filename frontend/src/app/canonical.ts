/**
 * Anhang D — Kanonische Form, Browserseite.
 *
 * Sie MUSS Zeichen für Zeichen dasselbe liefern wie `Kernel/Canonical.cs`.
 * Über genau diesen Bytes wird unterschrieben: weicht eine Klammer, eine
 * Reihenfolge oder eine Maskierung ab, ist die Unterschrift ungültig — und der
 * Fehler zeigt sich nicht hier, sondern als „Unterschrift passt nicht" an einer
 * Stelle, die nichts dafür kann.
 *
 * <b>Die härteste Einbahntür.</b> Sobald die erste Kante unterschrieben ist,
 * macht jede Änderung an dieser Datei ALLE bestehenden Unterschriften ungültig.
 * Eine Änderung hier ist nie eine Verbesserung, sondern immer eine neue Kette.
 *
 * Keine Gleitkommazahlen: 22.3 verbietet sie, und ein Typ, der sie gar nicht
 * erst aufnimmt, ist die verlässlichere Durchsetzung als eine Prüfung beim
 * Schreiben.
 */

export type Canon =
  | { readonly k: 'str'; readonly v: string }
  | { readonly k: 'int'; readonly v: number }
  | { readonly k: 'bool'; readonly v: boolean }
  | { readonly k: 'null' }
  | { readonly k: 'arr'; readonly v: readonly Canon[] }
  | { readonly k: 'obj'; readonly v: Readonly<Record<string, Canon>> };

export const S = (v: string): Canon => ({ k: 'str', v });
export const B = (v: boolean): Canon => ({ k: 'bool', v });
export const NIL: Canon = { k: 'null' };
export const A = (...items: readonly Canon[]): Canon => ({ k: 'arr', v: items });
export const O = (fields: Readonly<Record<string, Canon>>): Canon => ({ k: 'obj', v: fields });

/** 2^53-1 — darüber führt 22.3 Zahlen als Zeichenketten. */
export const MAX_SAFE_INTEGER = 9007199254740991;

export function I(v: number): Canon {
  if (!Number.isInteger(v)) throw new Error(`Nur Ganzzahlen: ${v} ist keine.`);
  if (v > MAX_SAFE_INTEGER || v < -MAX_SAFE_INTEGER) {
    throw new Error(`Ganzzahl ${v} liegt ausserhalb des sicheren Bereichs (22.3).`);
  }
  return { k: 'int', v };
}

/**
 * 22.2 — Minimale Maskierung: nur `"`, `\` und Steuerzeichen. Nicht-ASCII
 * bleibt unmaskiert und steht als UTF-8. Das ist der häufigste
 * Umsetzungsfehler, und er fällt erst bei einem Namen mit Umlaut auf.
 */
function writeString(out: string[], s: string): void {
  out.push('"');
  for (const c of s) {
    switch (c) {
      case '"': out.push('\\"'); break;
      case '\\': out.push('\\\\'); break;
      case '\b': out.push('\\b'); break;
      case '\f': out.push('\\f'); break;
      case '\n': out.push('\\n'); break;
      case '\r': out.push('\\r'); break;
      case '\t': out.push('\\t'); break;
      default: {
        const code = c.codePointAt(0) ?? 0;
        out.push(code < 0x20 ? `\\u${code.toString(16).padStart(4, '0')}` : c);
      }
    }
  }
  out.push('"');
}

function write(out: string[], v: Canon): void {
  switch (v.k) {
    case 'null': out.push('null'); break;
    case 'bool': out.push(v.v ? 'true' : 'false'); break;
    case 'int': out.push(String(v.v)); break;
    case 'str': writeString(out, v.v); break;

    case 'arr':
      out.push('[');
      v.v.forEach((item, i) => { if (i > 0) out.push(','); write(out, item); });
      out.push(']');
      break;

    case 'obj': {
      out.push('{');

      /*
       * 22.2: aufsteigend nach UTF-16-Codeeinheiten. Genau das tut der
       * Standardvergleich von `sort` — und genau das tut `string.CompareOrdinal`
       * auf der anderen Seite. Ein `localeCompare` wäre hier der Fehler, den man
       * erst bei einem Feldnamen mit Umlaut bemerkt.
       */
      const keys = Object.keys(v.v).sort();
      keys.forEach((key, i) => {
        if (i > 0) out.push(',');
        writeString(out, key);
        out.push(':');
        write(out, v.v[key]);
      });

      out.push('}');
      break;
    }
  }
}

export function serialize(value: Canon): string {
  const out: string[] = [];
  write(out, value);
  return out.join('');
}

/** UTF-8, ohne Byte Order Mark (22.2). */
export const toUtf8 = (value: Canon): Uint8Array => new TextEncoder().encode(serialize(value));
