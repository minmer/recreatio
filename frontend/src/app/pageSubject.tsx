/**
 * 0082 — WOVON EINE SEITE HANDELT („Wybór na stronie").
 *
 * <b>Eine Seite kann sagen: ich handle von EINEM.</b> Etwa von einem Menschen,
 * der das Formular „Zapisy" ausgefüllt hat. Dann steht oben auf der Seite die
 * Auswahl — keiner da: die Bausteine dazu schweigen; einer: er ist gewählt;
 * mehrere: eine Liste mit ◀ ▶ —, und jeder Baustein darunter nimmt dieselbe
 * Wahl, statt selbst zu fragen. Wie „Za kogo" (`pagePerson.tsx`) für die
 * Besucher, nur für die, die eine Liste von Menschen BETREUEN.
 *
 * <b>Gespeichert wird nur, WOVON die Seite handelt</b> (JSON an der Adresse,
 * wie Aussehen und Karte); WER gewählt ist, steht in der Adresse
 * (`?wpis=…`) — so lässt sich die Seite eines Menschen als Link weitergeben.
 *
 * <b>Eine Art je Datei, hier eingetragen</b> — wie die Bausteine
 * (`parts/registry.ts`). Heute eine: `entry`, ein Mensch aus einem Formular
 * (`entrySubject.tsx`). Eine weitere (ein Termin eines Kalenders, eine
 * Gruppe) bringt ihre Wahl, ihre Leiste oben und ihre Einstellungen mit; die
 * Seite und der Editor bleiben, wie sie sind.
 */

import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

import { entrySubjectKind } from './entrySubject';

/** Was gespeichert ist: `{"kind":"entry","form":"…"}` — die Art sagt, was die übrigen Schlüssel bedeuten. */
export type SubjectDecl = { readonly kind: string } & Readonly<Record<string, unknown>>;

export interface SubjectKind {
  readonly kind: string;
  readonly label: string;

  /** Wozu, in einem Satz — im Editor und in der Beschreibung des JSON. */
  readonly use: string;

  /** Die Schlüssel im JSON, je ein Satz, und ein Beispiel. */
  readonly keys: Readonly<Record<string, string>>;
  readonly example: SubjectDecl;

  /** Was noch fehlt, in Worten — oder `null`. */
  readonly missing: (decl: SubjectDecl) => string | null;

  /** Welche Bausteine (Module) die Wahl liest — für die Karte der Abhängigkeiten. */
  readonly uses: (decl: SubjectDecl) => readonly string[];

  /** Hält die Wahl für die ganze Seite. */
  readonly Provider: ComponentType<{ decl: SubjectDecl; path: string; children: ReactNode }>;

  /** Die Leiste oben auf der Seite. */
  readonly Bar: ComponentType;

  /** Die Einstellungen im Editor der Seite. */
  readonly Settings: ComponentType<{ decl: SubjectDecl; busy: boolean; onChange: (next: SubjectDecl) => void }>;
}

export const SUBJECT_KINDS: readonly SubjectKind[] = [entrySubjectKind];

export const subjectKindOf = (kind: string): SubjectKind | undefined => SUBJECT_KINDS.find((one) => one.kind === kind);

/** Gespeichert (Text) oder aus einem Dokument (Objekt) — duldsam: was nicht passt, ist keine Wahl. */
export function readSubject(value: unknown): SubjectDecl | null {
  let given = value;
  if (typeof given === 'string') {
    if (given.trim() === '') return null;
    try { given = JSON.parse(given) as unknown; } catch { return null; }
  }
  if (typeof given !== 'object' || given === null || Array.isArray(given)) return null;
  const kind = (given as Record<string, unknown>).kind;
  return typeof kind === 'string' && kind.trim() !== '' ? { ...(given as Record<string, unknown>), kind: kind.trim() } : null;
}

export const writeSubject = (decl: SubjectDecl | null): string | null => (decl === null ? null : JSON.stringify(decl));

const BarContext = createContext<ComponentType | null>(null);

/** Die Wahl für alles darunter — oder nichts, wo die Seite keine trifft (oder eine, die diese Fassung nicht kennt). */
export function PageSubjectProvider({ subject, path, children }: { subject: string | null | undefined; path: string; children: ReactNode }) {
  const decl = readSubject(subject);
  const kind = decl === null ? undefined : subjectKindOf(decl.kind);
  if (decl === null || kind === undefined) return <>{children}</>;

  return (
    <BarContext.Provider value={kind.Bar}>
      <kind.Provider decl={decl} path={path}>{children}</kind.Provider>
    </BarContext.Provider>
  );
}

/** Die Leiste oben — nur, wo die Seite eine Wahl trifft. */
export function SubjectBar() {
  const Bar = useContext(BarContext);
  return Bar === null ? null : <Bar />;
}

/** Im Editor der Seite: keine Wahl, oder eine Art mit ihren Einstellungen. */
export function SubjectSettings({ value, busy, onChange }: {
  value: SubjectDecl | null;
  busy: boolean;
  onChange: (next: SubjectDecl | null) => void;
}) {
  const kind = value === null ? undefined : subjectKindOf(value.kind);
  const missing = value === null || kind === undefined ? null : kind.missing(value);

  return (
    <div className="wk-subject-settings">
      <div className="wk-seg" role="group" aria-label="Wybór na stronie">
        <button type="button" aria-pressed={value === null} disabled={busy}
          className={value === null ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} onClick={() => onChange(null)}>
          Bez wyboru
        </button>
        {SUBJECT_KINDS.map((one) => (
          <button key={one.kind} type="button" aria-pressed={value?.kind === one.kind} disabled={busy}
            className={value?.kind === one.kind ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
            onClick={() => { if (value?.kind !== one.kind) onChange({ kind: one.kind }); }}>
            {one.label}
          </button>
        ))}
      </div>
      <p className="wk-hint">{kind === undefined ? (value === null
        ? 'Strona nie dotyczy nikogo konkretnego — moduły pokazują to, co zawsze.'
        : `Rodzaj „${value.kind}” nie jest znany tej wersji — zostaje nietknięty.`) : kind.use}</p>
      {value !== null && kind !== undefined && <kind.Settings decl={value} busy={busy} onChange={onChange} />}
      {missing !== null && <p className="wk-blocker">{missing}</p>}
    </div>
  );
}

/** Die Beschreibung im JSON der Seite — jede Art mit ihren Schlüsseln. */
export const subjectDescription = (): string =>
  `null (brak wyboru) albo obiekt; rodzaje: ${SUBJECT_KINDS.map((one) =>
    `{ ${Object.entries(one.keys).map(([key, says]) => `"${key}": ${says}`).join('; ')} } — ${one.label}: ${one.use}`).join(' · ')}`;
