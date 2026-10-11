/**
 * GRUPY FORMULARZY I ICH ZALEŻNOŚCI (0096) — rechnet nur; gezeichnet wird in
 * `Modules.tsx` (die Liste) und `FormMap.tsx` (die Karte, React Flow).
 *
 * <code>
 *   formSections        die Formulare in ihren Gruppen (Ordnern), Unterformulare unter ihrem Hauptformular
 *   logicDependencies   was die Karten der Seiten von Formularen brauchen: „pokaż X, gdy formularz Y wysłany"
 *   formMapModel        die Karte: Seiten mit Formularen → Hauptformular → Unterformulare;
 *                       wo der Link der Person entsteht und wohin er führt; welche Angaben dafür nötig sind
 * </code>
 */

import { IDENTITY_LABEL, type IdentityRole } from './form';
import type { FormGroup } from './module';
import type { PageLogic } from './pageLogic';

/** Was die Karte und die Liste von einem Formular brauchen (ein Ausschnitt von `ModuleRow`). */
export interface FormLike {
  readonly moduleId: string;
  readonly name: string;
  readonly kind: string;
  readonly extendsId: string | null;
  readonly audience: 'public' | 'person' | 'office';
  readonly repeat?: string;
  readonly groupId?: string | null;
  readonly groupPosition?: number | null;
  readonly pages: readonly string[];
  readonly config: string | null;
  readonly memberRoleId?: string | null;
  readonly entries: number;
  readonly closed: boolean;
}

export interface FormItem<F extends FormLike = FormLike> {
  readonly form: F;
  /** Seine Unterformulare, die nicht in einer anderen Gruppe stehen. */
  readonly subs: readonly F[];
}

export interface FormSection<F extends FormLike = FormLike> {
  /** `null`: die Formulare ohne Gruppe. */
  readonly group: FormGroup | null;
  readonly items: readonly FormItem<F>[];
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pl');
const byPlace = (a: FormLike, b: FormLike) =>
  (a.groupPosition ?? Number.MAX_SAFE_INTEGER) - (b.groupPosition ?? Number.MAX_SAFE_INTEGER) || byName(a, b);

/**
 * DIE FORMULARE IN IHREN GRUPPEN. Jede Gruppe (auch eine leere) mit ihren
 * Formularen in ihrer Folge; danach die ohne Gruppe. Ein Unterformular steht
 * unter seinem Hauptformular — es sei denn, es liegt selbst in einer anderen
 * Gruppe; dann dort, für sich. Eines, dessen Hauptformular ich nicht sehe,
 * steht für sich.
 */
export function formSections<F extends FormLike>(modules: readonly F[], groups: readonly FormGroup[]): FormSection<F>[] {
  const forms = modules.filter((one) => one.kind === 'form');
  const known = new Set(groups.map((g) => g.groupId));
  const groupOf = (one: F): string | null => (one.groupId != null && known.has(one.groupId) ? one.groupId : null);
  const visible = new Map(forms.map((one) => [one.moduleId, one]));

  /* Ein Unterformular hängt unter seinem Hauptformular, wenn es keine eigene Gruppe hat — oder dieselbe. */
  const underMain = (sub: F): boolean => {
    if (sub.extendsId === null) return false;
    const main = visible.get(sub.extendsId);
    if (main === undefined) return false;
    return groupOf(sub) === null || groupOf(sub) === groupOf(main);
  };
  const subsOf = (main: F) => forms.filter((one) => one.extendsId === main.moduleId && underMain(one)).sort(byPlace);
  const item = (form: F): FormItem<F> => ({ form, subs: subsOf(form) });

  const sections: FormSection<F>[] = [...groups].sort(byName).map((group) => ({
    group,
    items: forms.filter((one) => groupOf(one) === group.groupId && !underMain(one)).sort(byPlace).map(item)
  }));

  const loose = forms.filter((one) => groupOf(one) === null && !underMain(one)).sort(byName).map(item);
  if (loose.length > 0 || sections.length === 0) sections.push({ group: null, items: loose });
  return sections;
}

/** Die neue Folge einer Gruppe, wenn ein Formular um eine Stelle wandert (`by`: -1 hinauf, +1 hinab). */
export function moveInGroup(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const out = [...ids];
  const at = out.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= out.length) return out;
  [out[at], out[to]] = [out[to], out[at]];
  return out;
}

/* -- Was die Karten der Seiten von Formularen brauchen ---------------------------------------- */

export interface LogicPage {
  readonly path: string;
  readonly parts: readonly { readonly id: string; readonly moduleId: string | null; readonly kind: string }[];
  readonly logic: PageLogic | null;
}

export interface LogicNeed {
  readonly page: string;
  /** Das Formular, dessen Zustand gefragt ist. */
  readonly from: string;
  /** Was davon: „wysłany", „potwierdzony", „odpowiedź", „znacznik" (mehrere mit „ i "). */
  readonly condition: string;
  /** Was davon abhängt: ein Baustein (über seine Stelle) — oder ein Schritt der Person. */
  readonly moduleId: string | null;
  readonly partKind: string | null;
  readonly step: string | null;
}

const NEED_WORD: Record<string, string> = { registered: 'wysłany', confirmed: 'potwierdzony', answer: 'odpowiedź', mark: 'znacznik' };

/**
 * WELCHE BAUSTEINE UND SCHRITTE EINER SEITE VON FORMULAREN ABHÄNGEN — aus der
 * Karte der Seite (0048): von jedem Baustein („pokaż, gdy") und jedem Schritt
 * („zrobione, gdy") rückwärts durch die Tore zu den Eingängen, die ein
 * Formular nennen.
 */
export function logicDependencies(pages: readonly LogicPage[]): LogicNeed[] {
  const out: LogicNeed[] = [];
  for (const page of pages) {
    const logic = page.logic;
    if (logic === null) continue;
    const nodes = new Map(logic.nodes.map((n) => [n.id, n]));
    const into = (id: string) => logic.edges.filter((e) => e.to === id).map((e) => e.from);

    for (const node of logic.nodes) {
      if (node.kind !== 'part' && node.kind !== 'step') continue;
      const seen = new Set<string>();
      const queue = into(node.id);
      const found = new Map<string, Set<string>>();
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const one = nodes.get(id);
        if (one === undefined) continue;
        if (one.formId !== undefined && NEED_WORD[one.kind] !== undefined) {
          const set = found.get(one.formId) ?? new Set<string>();
          set.add(NEED_WORD[one.kind]);
          found.set(one.formId, set);
        }
        queue.push(...into(id));
      }
      const part = node.kind === 'part' ? page.parts.find((p) => p.id === node.partId) : undefined;
      for (const [from, words] of found) {
        out.push({
          page: page.path, from, condition: [...words].join(' i '),
          moduleId: part?.moduleId ?? null, partKind: part?.kind ?? null,
          step: node.kind === 'step' ? (node.label ?? 'krok') : null
        });
      }
    }
  }
  return out;
}

/* -- Die Karte ------------------------------------------------------------------------------------- */

export type MapNodeKind = 'group' | 'main' | 'sub' | 'page' | 'role';

export interface MapNode {
  readonly id: string;
  readonly kind: MapNodeKind;
  readonly label: string;
  /** Was darunter steht — je Zeile ein Satz. */
  readonly lines: readonly string[];
  /** Was fehlt oder stört — rot. */
  readonly warnings: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  /** Der Kasten der Gruppe, in dem es steht (Lage relativ zu ihm). */
  readonly parent?: string;
  /** Wohin ein Klick führt (Teil des Arbeitsplatzes). */
  readonly open?: { readonly form?: string; readonly page?: string };
}

export type MapEdgeKind = 'stands' | 'extends' | 'link' | 'role' | 'logic' | 'filled';

export interface MapEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: MapEdgeKind;
  readonly label: string;
}

export interface MapInput<F extends FormLike = FormLike> {
  readonly sections: readonly FormSection<F>[];
  /** Die Rollen der Fragen je Formular (Imię, Nazwisko, Telefon …) — ohne Inhalt, nur wozu sie dienen. */
  readonly identity: ReadonlyMap<string, readonly IdentityRole[]>;
  readonly needs: readonly LogicNeed[];
  /** Wie ein Baustein heisst (für „pokazuje …"). */
  readonly moduleName: (moduleId: string) => string | null;
  /** Wie eine Rolle heisst, wenn bekannt. */
  readonly roleName: (roleId: string) => string | null;
  /** Nur die Familie dieses Formulars (sein Hauptformular, dessen Unterformulare, seine Gruppe). */
  readonly focus?: string | null;
}

const REPEAT_WORD: Record<string, string> = { day: 'co dzień', week: 'co tydzień', month: 'co miesiąc', year: 'co rok' };

const COL_IN = 0;
const COL_FORMS = 280;
const COL_OUT = 1180;
const ROW = 118;
const SUB_X = 470;
const PAD = 16;
const HEAD = 34;

/** Was die Person liefert, wenn sie das Hauptformular einsendet — und was davon weiter gebraucht wird. */
function personLines(roles: readonly IdentityRole[]): { lines: string[]; warnings: string[] } {
  const has = (r: IdentityRole) => roles.includes(r);
  const lines: string[] = [];
  const warnings: string[] = [];
  const named = (has('given_name') && has('surname')) || has('name');
  const who = (['given_name', 'surname', 'name'] as const).filter(has).map((r) => (r === 'name' ? 'Nazwisko' : IDENTITY_LABEL[r]));
  if (named) lines.push(`osoba: ${who.join(', ')} — jej podpis w rozmowach i na listach`);
  else warnings.push('brak pól Imię i Nazwisko — osoba nie będzie miała nazwy (rozmowy, listy)');
  const reach = (['phone', 'email'] as const).filter(has).map((r) => IDENTITY_LABEL[r]);
  if (reach.length > 0) lines.push(`${reach.join(' / ')} — do wysłania linku`);
  return { lines, warnings };
}

/**
 * DIE KARTE DER FORMULARE. Links die Seiten, auf denen Hauptformulare stehen;
 * in der Mitte die Gruppen (Kästen) mit ihren Formularen — Unterformulare
 * rechts neben ihrem Hauptformular; rechts, wohin der Link der Person führt,
 * wo Unterformulare ausgefüllt werden, welche Rolle die Menschen bekommen und
 * welche Bausteine von einem Formular abhängen.
 */
export function formMapModel<F extends FormLike>(input: MapInput<F>): { nodes: MapNode[]; edges: MapEdge[] } {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const inPages = new Map<string, number>();
  const outPages = new Map<string, number>();
  const roles = new Map<string, number>();
  const formIds = new Set<string>();

  /*
   * NUR EINE FAMILIE (`focus`): das Hauptformular, seine Unterformulare — und
   * die ganze Gruppe, in der eines von ihnen steht.
   */
  const everything = input.sections.flatMap((s) => s.items.flatMap((i) => [i.form, ...i.subs]));
  const focused = everything.find((f) => f.moduleId === (input.focus ?? ''));
  const family = new Set<string>();
  if (focused !== undefined) {
    const mainId = focused.extendsId ?? focused.moduleId;
    for (const f of everything) if (f.moduleId === mainId || f.extendsId === mainId) family.add(f.moduleId);
  }
  const focusOf = (section: FormSection<F>): FormSection<F> | null => {
    if (input.focus == null || focused === undefined) return section;
    const touches = (i: FormItem<F>) => family.has(i.form.moduleId) || i.subs.some((s) => family.has(s.moduleId));
    if (section.group !== null && section.items.some(touches)) return section;
    const items = section.items.filter(touches);
    return items.length === 0 ? null : { ...section, items };
  };

  const edge = (from: string, to: string, kind: MapEdgeKind, label: string) => {
    const id = `${kind}:${from}>${to}:${label}`;
    if (!edges.some((e) => e.id === id)) edges.push({ id, from, to, kind, label });
  };
  const outPage = (path: string): string => {
    const id = `out:${path}`;
    if (!outPages.has(path)) outPages.set(path, outPages.size);
    return id;
  };

  let y = 0;
  for (const raw of input.sections) {
    const section = focusOf(raw);
    if (section === null || (section.items.length === 0 && (section.group === null || input.focus != null))) continue;
    const groupId = section.group === null ? null : `group:${section.group.groupId}`;
    /* Geht vom Hauptformular etwas nach rechts (Link, Rolle), stehen seine Unterformulare eine Zeile tiefer — sonst liefe die Linie quer über sie. */
    const lead = (i: FormItem<F>) => (i.subs.length > 0 && goesRight(i.form) ? 1 : 0);
    const rows = section.items.map((i) => Math.max(1, lead(i) + i.subs.length));
    const height = HEAD + rows.reduce((n, r) => n + r * ROW, 0) + PAD + (section.items.length === 0 ? ROW : 0);
    const top = y;

    if (groupId !== null) {
      nodes.push({
        id: groupId, kind: 'group', label: section.group!.name,
        lines: [`${section.items.reduce((n, i) => n + 1 + i.subs.length, 0)} formularzy`], warnings: [],
        x: COL_FORMS - PAD, y: top, width: SUB_X + 300 + PAD * 2, height
      });
    }

    let at = groupId === null ? top : HEAD;
    for (const [index, item] of section.items.entries()) {
      const main = item.form;
      const place = (x: number, yy: number) => (groupId === null ? { x: COL_FORMS + x, y: yy } : { x: PAD + x, y: yy });
      const mainNode = `form:${main.moduleId}`;
      formIds.add(main.moduleId);
      const person = main.extendsId === null && main.audience === 'public' ? personLines(input.identity.get(main.moduleId) ?? []) : { lines: [], warnings: [] };
      const config = readConfigText(main.config);
      const lines = main.extendsId === null
        ? [
          main.audience === 'public' ? 'po wysłaniu: link osoby' : '',
          ...person.lines,
          `${main.entries} ${main.entries === 1 ? 'zgłoszenie' : 'zgłoszeń'}${main.closed ? ' · zamknięty' : ''}`
        ].filter((x) => x !== '')
        : [audienceLine(main), `${main.entries} wpisów`];
      nodes.push({
        id: mainNode, kind: main.extendsId === null ? 'main' : 'sub', label: main.name, lines, warnings: person.warnings,
        ...place(0, at), parent: groupId ?? undefined, open: { form: main.moduleId }
      });

      /* Wo es steht — links, wenn es ein Hauptformular ist (dort entsteht der Link); sonst rechts. */
      for (const path of main.pages) {
        if (main.extendsId === null) {
          if (!inPages.has(path)) inPages.set(path, inPages.size);
          edge(`in:${path}`, mainNode, 'stands', 'zapisy');
        } else {
          edge(mainNode, outPage(path), 'filled', 'wypełniane na');
        }
      }

      /* Wohin der Link der Person führt. */
      if (main.extendsId === null && main.audience === 'public') {
        const portal = (config.portalUnder ?? '').trim();
        if (portal !== '') edge(mainNode, outPage(portal), 'link', 'link osoby otwiera');
      }

      /* Welche Rolle die Menschen bekommen (0091). */
      if (main.memberRoleId != null) {
        const roleNode = `role:${main.memberRoleId}`;
        if (!roles.has(main.memberRoleId)) roles.set(main.memberRoleId, roles.size);
        edge(mainNode, roleNode, 'role', 'osoby dostają rolę');
      }

      for (const [s, sub] of item.subs.entries()) {
        const subNode = `form:${sub.moduleId}`;
        formIds.add(sub.moduleId);
        nodes.push({
          id: subNode, kind: 'sub', label: sub.name, lines: [audienceLine(sub), `${sub.entries} wpisów`], warnings: [],
          ...place(SUB_X, at + (lead(item) + s) * ROW), parent: groupId ?? undefined, open: { form: sub.moduleId }
        });
        edge(mainNode, subNode, 'extends', sub.audience === 'office' ? 'notatki koordynatora' : 'uzupełnia przez swój link');
        for (const path of sub.pages) edge(subNode, outPage(path), 'filled', 'wypełniane na');
      }
      at += rows[index] * ROW;
    }
    y = (groupId === null ? at : top + height) + 40;
  }

  /* Ein Unterformular in einer ANDEREN Gruppe als sein Hauptformular: die Kante quer über die Kästen. */
  for (const node of nodes) {
    if (node.kind !== 'sub' || node.open?.form === undefined) continue;
    const sub = everything.find((f) => f.moduleId === node.open!.form);
    if (sub?.extendsId == null || !formIds.has(sub.extendsId)) continue;
    if (edges.some((e) => e.kind === 'extends' && e.to === node.id)) continue;
    edge(`form:${sub.extendsId}`, node.id, 'extends', sub.audience === 'office' ? 'notatki koordynatora' : 'uzupełnia przez swój link');
  }

  /* Was auf den Seiten von Formularen abhängt (Karten der Seiten). */
  for (const need of input.needs) {
    if (!formIds.has(need.from)) continue;
    const from = `form:${need.from}`;
    if (need.moduleId !== null && formIds.has(need.moduleId) && need.moduleId !== need.from) {
      edge(from, `form:${need.moduleId}`, 'logic', `pokazany, gdy ${need.condition}`);
    } else if (need.step !== null) {
      edge(from, outPage(need.page), 'logic', `krok „${need.step}", gdy ${need.condition}`);
    } else if (need.moduleId !== null) {
      edge(from, outPage(need.page), 'logic', `„${input.moduleName(need.moduleId) ?? 'moduł'}" widać, gdy ${need.condition}`);
    }
  }

  for (const [path, index] of inPages) {
    nodes.push({ id: `in:${path}`, kind: 'page', label: path, lines: ['formularz na stronie'], warnings: [], x: COL_IN, y: index * ROW, open: { page: path } });
  }
  for (const [path, index] of outPages) {
    nodes.push({ id: `out:${path}`, kind: 'page', label: path, lines: [], warnings: [], x: COL_OUT, y: index * ROW, open: { page: path } });
  }
  const below = outPages.size * ROW + 20;
  for (const [roleId, index] of roles) {
    nodes.push({ id: `role:${roleId}`, kind: 'role', label: input.roleName(roleId) ?? 'rola uczestników', lines: ['dostęp do jej obszarów'], warnings: [], x: COL_OUT, y: below + index * ROW });
  }

  /* Was eine Kante sagt, fehlt einem Knoten ohne Kanten nicht — aber was nirgends hängt, gehört nicht auf diese Karte. */
  const used = new Set(edges.flatMap((e) => [e.from, e.to]));
  return { nodes: nodes.filter((n) => n.kind === 'group' || n.kind === 'main' || n.kind === 'sub' || used.has(n.id)), edges };
}

const audienceLine = (form: FormLike): string =>
  `${form.audience === 'office' ? 'tylko koordynator' : 'wypełnia osoba — przez swój link'}${REPEAT_WORD[form.repeat ?? ''] === undefined ? '' : ` · ${REPEAT_WORD[form.repeat ?? '']}`}`;

function goesRight(form: FormLike): boolean {
  if (form.extendsId !== null) return false;
  return form.memberRoleId != null || (form.audience === 'public' && (readConfigText(form.config).portalUnder ?? '').trim() !== '');
}

function readConfigText(text: string | null): Record<string, string> {
  try {
    const parsed = JSON.parse(text ?? '{}') as unknown;
    return parsed !== null && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}
