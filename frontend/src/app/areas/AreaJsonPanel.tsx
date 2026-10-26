/**
 * 0133 — DAS GANZE OBSZAR ALS JSON („recreatio/area"): Export, Import mit Plan
 * und Schritt für Schritt, der Auftrag für die eigene KI.
 *
 * <b>Keine KI in der App</b> (die Besitzerin arbeitet in ihrer eigenen
 * Unterhaltung): „Skopiuj prompt dla AI" kopiert den Auftrag, die Beschreibung
 * des Formats und — als Vorlage — den Export des letzten Wydarzenie. Was die KI
 * zurückgibt, kommt unten in den Import: erst der Plan (mit allem, was fehlt
 * oder nicht geht), dann „Importuj krok po kroku".
 */

import { useEffect, useRef, useState } from 'react';

import { loadCalendars } from '../calendar/calendar';
import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import { WorkspaceError, type Who } from '../core/session';
import { ImageNeeds, type ImageChoice } from '../pages/ImageNeeds';
import { readImageNeeds, type NeedsPlan } from '../pages/pageImageNeeds';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import type { AreaRow } from './area';
import { exportArea } from './areaExport';
import { loadAreaState, loadPageState, runAreaImport, type StepState } from './areaImport';
import {
  normalisePath, pagePaths, pathProblem, planArea, planLines, previewIds, previewPage, readAreaDocument, suggestBase,
  type AreaDocument, type AreaImportOptions, type AreaPlan, type AreaState, type PageLoad, type PlannedPage, type PlanStep
} from './areaJson';
import { AREA_JSON, areaPrompt } from './areaJsonText';
import { publishChoices } from './profile';
import './areaJson.css';

type Flags = Pick<AreaImportOptions, 'replaceModules' | 'replaceQuestions' | 'adoptPages'>;

const STEP_ORDER: readonly PlanStep['key'][] = ['profile', 'roles', 'appointments', 'pages', 'subforms', 'chats', 'card', 'listings'];
const STEP_WORD: Record<PlanStep['key'], string> = {
  profile: 'Profil', roles: 'Role', appointments: 'Terminy', pages: 'Formularze i strony', subforms: 'Podformularze',
  chats: 'Rozmowy', card: 'Wizytówka i profil', listings: 'Listy'
};
const STATE_WORD: Record<StepState, string> = { running: 'w toku', done: 'gotowe', failed: 'przerwane' };

interface PageView {
  readonly planned: PlannedPage;
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
  readonly needs: NeedsPlan | undefined;
}

interface Analysis {
  readonly doc: AreaDocument;
  readonly plan: AreaPlan;
  readonly base: string;
  readonly views: readonly PageView[];
  readonly preview: JsonPreview;
}

/** Die Vorschaubilder vom Gerät freigeben: sie halten die Datei im Speicher. */
function dropPreviews(choices: readonly ImageChoice[]): void {
  for (const one of choices) if (one.from === 'device' && one.preview !== null) URL.revokeObjectURL(one.preview);
}

function needsLine(needs: NeedsPlan, chosen: Readonly<Record<string, ImageChoice>>): string {
  const have = needs.needs.filter((n) => chosen[n.key] !== undefined).length;
  const lacking = needs.needs.length - have;
  return `Pliki do dodania: ${needs.needs.length} — dodane ${have}${lacking > 0 ? `, brakuje ${lacking}` : ''} (niżej).`;
}

function needsWarnings(label: string, needs: NeedsPlan, chosen: Readonly<Record<string, ImageChoice>>): string[] {
  const lacking = needs.needs.filter((n) => chosen[n.key] === undefined);
  return [
    ...needs.warnings.map((w) => `${label}: ${w}`),
    ...(lacking.length === 0 ? [] : [`${label}: bez pliku zostaną puste miejsca — ${lacking.map((n) => `„${n.label}”`).join(', ')}; dodaj pliki niżej albo później w edytorze.`])
  ];
}

/** Die Schritte des Plans mit dem der Seiten an seiner Stelle. */
function withPages(steps: readonly PlanStep[], pageLines: readonly string[]): PlanStep[] {
  const all = pageLines.length === 0 ? [...steps] : [...steps, { key: 'pages' as const, title: STEP_WORD.pages, lines: pageLines }];
  return all.sort((a, b) => STEP_ORDER.indexOf(a.key) - STEP_ORDER.indexOf(b.key));
}

/** `onImported`: nach einem Import (auch einem abgebrochenen) — der Reiter der Art liest das Profil neu. */
export function AreaJsonPanel({ area, ring, who, onImported }: { area: AreaRow; ring: Ring | null; who: Who; onImported?: () => void }) {
  const areaId = area.areaId;
  const [state, setState] = useState<AreaState | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [pages, setPages] = useState<ReadonlyMap<string, PageLoad>>(new Map());
  const [baseInput, setBaseInput] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [publish, setPublish] = useState('');
  const [flags, setFlags] = useState<Flags>({ replaceModules: false, replaceQuestions: false, adoptPages: false });
  const [imageFor, setImageFor] = useState<Readonly<Record<string, Readonly<Record<string, ImageChoice>>>>>({});
  const [uploading, setUploading] = useState(false);
  const [steps, setSteps] = useState<Partial<Record<PlanStep['key'], StepState>>>({});
  const [links, setLinks] = useState<readonly { name: string; url: string }[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [exportWarnings, setExportWarnings] = useState<readonly string[]>([]);
  const [template, setTemplate] = useState('');
  /* Die ganze Beschreibung (mit Animation, Laboratorien, Prezentacja) — sonst kürzer. */
  const [fullPrompt, setFullPrompt] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptNote, setPromptNote] = useState<string | null>(null);
  const [promptText, setPromptText] = useState<string | null>(null);

  const latestImages = useRef(imageFor);
  latestImages.current = imageFor;
  useEffect(() => () => { for (const one of Object.values(latestImages.current)) dropPreviews(Object.values(one)); }, []);

  /* Was der Plan braucht — einmal beim Öffnen, wieder nach jedem Import. */
  const reload = async () => {
    try {
      setState(await loadAreaState({ areaId, areaName: area.name, ring, doc: null, base: '' }));
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się odczytać obszaru.');
    }
    const calendars = await loadCalendars().then((r) => r.calendars, () => []);
    setCalendarId(calendars.find((c) => c.areaId === areaId && c.isDefault !== false)?.calendarId ?? calendars.find((c) => c.areaId === areaId)?.calendarId ?? null);
  };
  useEffect(() => { void reload(); }, [areaId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Die Seiten, die ein Dokument nennt, werden gelesen, sobald es sie nennt. */
  const requested = useRef(new Set<string>());
  const want = (paths: readonly string[]) => {
    const fresh = paths.filter((p) => !pages.has(p) && !requested.current.has(p));
    if (fresh.length === 0) return;
    for (const p of fresh) requested.current.add(p);
    window.setTimeout(() => {
      void Promise.all(fresh.map(async (p) => [p, await loadPageState(p)] as const)).then((got) => {
        setPages((was) => {
          const next = new Map(was);
          for (const [p, one] of got) next.set(p, one);
          return next;
        });
      });
    }, 0);
  };

  const choose = (pageKey: string, key: string, choice: ImageChoice | null) => {
    const old = latestImages.current[pageKey]?.[key];
    if (old !== undefined && old !== choice) dropPreviews([old]);
    setImageFor((was) => {
      const { [key]: _gone, ...rest } = was[pageKey] ?? {};
      return { ...was, [pageKey]: choice === null ? rest : { ...rest, [key]: choice } };
    });
  };

  /* -- Der Plan zu einem Dokument (einmal je Zeichnen, für Vorschau und Einstellungen) ---- */
  const cache = useRef<{ value: unknown; deps: readonly unknown[]; result: Analysis | { error: string } } | null>(null);
  const deps: readonly unknown[] = [state, failed, pages, baseInput, publish, flags, imageFor, calendarId];
  const analyse = (value: unknown): Analysis | { error: string } => {
    const known = cache.current;
    if (known !== null && known.value === value && known.deps.every((d, i) => d === deps[i])) return known.result;
    const result = compute(value);
    cache.current = { value, deps, result };
    return result;
  };

  function compute(value: unknown): Analysis | { error: string } {
    const read = readAreaDocument(value);
    if ('error' in read) return read;
    if (state === null) return { error: failed ?? 'Sprawdzanie obszaru…' };
    /* Die vorgeschlagene Adresse: vielleicht die eben dafür geholte, noch leere Seite — erst gelesen, dann geplant. */
    const address = read.doc.address ?? '';
    if (address !== '' && pathProblem(address) === null) {
      want([address]);
      if (!pages.has(address)) return { error: 'Sprawdzanie adresu z dokumentu…' };
    }
    const suggested = suggestBase(read.doc, { ...state, pages });
    if (suggested !== suggestion) window.setTimeout(() => setSuggestion(suggested), 0);
    const base = normalisePath(baseInput) || suggested;
    const paths = pagePaths(read.doc, base);
    want(paths);
    if (paths.some((p) => !pages.has(p))) return { error: 'Sprawdzanie stron z dokumentu…' };

    const full: AreaState = { ...state, pages };
    const options: AreaImportOptions = { base, publishAreaId: publish === '' ? null : publish, ...flags };
    const plan = planArea(read.doc, full, options);
    if (plan.blocked !== null) return { error: plan.blocked };
    const { ids, formModules } = previewIds(plan, full, calendarId, newId);
    const views: PageView[] = plan.pages.filter((p) => p.problem === null).map((planned) => {
      const chosen = imageFor[planned.doc.key] ?? {};
      const view = previewPage({
        planned, state: full, ids, formModules, options,
        cardImage: planned.doc.main && typeof read.doc.card?.image === 'string' ? read.doc.card.image : null,
        fallbackTitle: planned.doc.main ? (read.doc.card?.title ?? area.name) : area.name,
        chosen: new Set(Object.keys(chosen)), newId, publishAreaId: plan.publishAreaId
      });
      const needs = view.doc === null ? undefined : readImageNeeds(view.doc);
      const label = `Strona „${planned.doc.key}”`;
      return {
        planned,
        lines: [...view.lines, ...(needs === undefined || needs.needs.length === 0 ? [] : [`   ${needsLine(needs, chosen)}`])],
        warnings: [...view.warnings, ...(needs === undefined ? [] : needsWarnings(label, needs, chosen))],
        needs
      };
    });
    return {
      doc: read.doc, plan, base, views,
      preview: {
        lines: planLines(withPages(plan.steps, views.flatMap((v) => v.lines))),
        warnings: [...read.warnings, ...plan.warnings, ...views.flatMap((v) => v.warnings)]
      }
    };
  }

  const preview = (value: unknown): JsonPreview | { error: string } => {
    const done = analyse(value);
    return 'error' in done ? done : done.preview;
  };

  const run = async (value: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    const read = readAreaDocument(value);
    if ('error' in read) throw new Error(read.error);
    /* Dieselbe Adresse wie im Plan (der Vorschlag im Zustand kann einen Augenblick hinterher sein). */
    const base = normalisePath(baseInput) || (state === null ? suggestion : suggestBase(read.doc, { ...state, pages }));
    setSteps({});
    setLinks([]);
    const result = await runAreaImport({
      who, areaId, areaName: area.name, doc: read.doc,
      options: { base, publishAreaId: publish === '' ? null : publish, ...flags },
      imageFor,
      hooks: {
        stage,
        step: (key, now) => setSteps((was) => ({ ...was, [key]: now })),
        uploading: setUploading,
        uploaded: (pageKey, key, choice) => choose(pageKey, key, choice)
      }
    }).finally(() => {
      requested.current.clear();
      setPages(new Map());
      void reload();
      onImported?.();
    });
    setLinks(result.links);
    for (const one of Object.values(latestImages.current)) dropPreviews(Object.values(one));
    setImageFor({});
    return {
      lines: [...result.lines, ...result.links.map((l) => `Link dla „${l.name}”: ${l.url}`)],
      warnings: result.warnings
    };
  };

  const exportDoc = async () => {
    const done = await exportArea({ who, areaId, areaName: area.name, register: state?.profile.admin === true });
    setExportWarnings(done.warnings);
    return done.doc;
  };

  /* -- Der Auftrag für die eigene KI ------------------------------------------------------ */
  const others = (state?.areas ?? [])
    .filter((a) => a.areaId !== areaId && a.myLevel === 'admin' && a.personal !== true && a.ownChat == null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  const copyPrompt = async () => {
    setPromptBusy(true);
    setPromptNote(null);
    setPromptText(null);
    try {
      let shown: { name: string; doc: unknown } | null = null;
      let current: unknown | null = null;
      if (template === 'self') {
        current = (await exportArea({ who, areaId, areaName: area.name, register: state?.profile.admin === true })).doc;
      } else if (template !== '') {
        const other = others.find((a) => a.areaId === template);
        if (other !== undefined) shown = { name: other.name, doc: (await exportArea({ who, areaId: other.areaId, areaName: other.name, register: false })).doc };
      }
      const text = areaPrompt({ areaName: area.name, kind: state?.profile.profile?.kind ?? null, template: shown, current, full: fullPrompt });
      try {
        await navigator.clipboard.writeText(text);
        setPromptNote('Skopiowano — wklej do swojej rozmowy z AI, dopisz swoje wskazówki, a odpowiedź wklej niżej w „Import”.');
      } catch {
        setPromptText(text);
        setPromptNote('Schowek nie przyjął tekstu — zaznacz go niżej i skopiuj.');
      }
    } catch (e) {
      setPromptNote(e instanceof WorkspaceError ? e.message : 'Nie udało się przygotować promptu.');
    } finally {
      setPromptBusy(false);
    }
  };

  const copyLink = (url: string) => {
    void navigator.clipboard.writeText(url).then(() => setCopied(url), () => setCopied(null));
  };

  const shownSteps = STEP_ORDER.filter((key) => steps[key] !== undefined);
  const baseProblem = baseInput.trim() === '' ? null : pathProblem(normalisePath(baseInput));
  const choices = state === null ? [] : publishChoices(state.areas, areaId);

  return (
    <div className="aj" data-area-json={areaId}>
      <section className="aj-sec" aria-label="Prompt dla AI">
        <h4 className="wk-json-h">Prompt dla AI</h4>
        <p className="wk-note">
          Skopiuj prompt do swojej rozmowy z AI: opis formatu i — jako wzór — eksport poprzedniego wydarzenia albo tego obszaru.
          Odpowiedź wklej niżej w „Import”: najpierw zobaczysz plan, potem import pójdzie krok po kroku.
        </p>
        <div className="aj-row">
          <label className="wk-field">
            <span>Wzór</span>
            <select value={template} disabled={promptBusy} onChange={(e) => setTemplate(e.target.value)}>
              <option value="">bez wzoru — tylko opis formatu</option>
              <option value="self">ten obszar, jaki jest teraz</option>
              {others.map((a) => <option key={a.areaId} value={a.areaId}>{a.name}</option>)}
            </select>
          </label>
          <button type="button" className="wk-btn wk-btn-line" disabled={promptBusy} data-area-prompt="" onClick={() => void copyPrompt()}>
            {promptBusy ? 'Przygotowywanie…' : 'Skopiuj prompt dla AI'}
          </button>
        </div>
        <label className="pe-check">
          <input type="checkbox" checked={fullPrompt} disabled={promptBusy} onChange={(e) => setFullPrompt(e.target.checked)} />
          <span>Pełny opis formatu — także animacje, laboratoria i prezentacje (kilka razy dłuższy)</span>
        </label>
        {promptNote !== null && <p className="wk-note" role="status">{promptNote}</p>}
        {promptText !== null && <textarea className="wk-json-text" readOnly rows={6} value={promptText} aria-label="Prompt dla AI" onFocus={(e) => e.currentTarget.select()} />}
      </section>

      <section className="aj-sec" aria-label="Ustawienia importu">
        <h4 className="wk-json-h">Ustawienia importu</h4>
        <div className="aj-row">
          <label className="wk-field">
            <span>Adres strony głównej</span>
            <input value={baseInput} placeholder={suggestion === '' ? 'np. parafia/rekolekcje-2026' : suggestion} spellCheck={false}
              onChange={(e) => setBaseInput(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>Gdzie publikować</span>
            <select value={publish} onChange={(e) => setPublish(e.target.value)}>
              <option value="">jak w dokumencie</option>
              {choices.map((a) => (
                <option key={a.areaId} value={a.areaId}>
                  {a.areaId === areaId ? `${a.name} — tylko jego osoby` : `${a.name}${a.publicLevel !== 'none' ? ' — jawny' : ''}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        {baseProblem !== null && <p className="wk-warn">Adres strony głównej: {baseProblem}.</p>}
        {suggestion !== '' && baseInput.trim() === '' && <p className="wk-note">Bez wpisu: {suggestion}.</p>}
      </section>

      {exportWarnings.length > 0 && (
        <ul className="wk-json-warn aj-sec">{exportWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}

      {links.length > 0 && (
        <section className="aj-sec aj-links" aria-label="Linki z importu">
          <h4 className="wk-json-h">Linki z importu — skopiuj je teraz</h4>
          <ul>
            {links.map((l) => (
              <li key={l.url}>
                <span>{l.name}</span>
                <code>{l.url}</code>
                <button type="button" className="wk-link-btn" onClick={() => copyLink(l.url)}>{copied === l.url ? 'Skopiowano' : 'Kopiuj'}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <JsonPanel
        summary="JSON obszaru — eksport i import"
        lead={<>Cały obszar — profil i wizytówka, role, terminy z programem, strony z formularzami, podformularze, rozmowy i listy — jako jeden dokument. Ten sam dokument zaimportowany jeszcze raz zmienia to samo, zamiast dublować.</>}
        fileName={`obszar-${area.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'obszar'}.json`}
        exportDoc={exportDoc}
        format={AREA_JSON}
        preview={preview}
        importLabel="Importuj krok po kroku"
        onImport={run}
        note={shownSteps.length === 0 ? null : (
          <ol className="aj-steps" aria-label="Kroki importu">
            {shownSteps.map((key) => (
              <li key={key} className={`is-${steps[key]}`}>{STEP_WORD[key]} — {STATE_WORD[steps[key]!]}</li>
            ))}
          </ol>
        )}
        options={(value) => {
          const done = analyse(value);
          if ('error' in done) return null;
          const foreign = done.plan.pages.some((p) => p.foreign);
          return (
            <div className="wk-json-options aj-options">
              {done.views.filter((v) => v.needs !== undefined && v.needs.needs.length > 0).map((v) => (
                <div key={v.planned.doc.key} className="aj-needs">
                  <p className="aj-needs-title">Pliki strony „{v.planned.doc.key}” ({v.planned.path})</p>
                  <ImageNeeds path={v.planned.path} needs={v.needs!.needs} chosen={imageFor[v.planned.doc.key] ?? {}} busy={uploading}
                    onChoose={(key, choice) => choose(v.planned.doc.key, key, choice)} />
                </div>
              ))}
              <label className="pe-check">
                <input type="checkbox" checked={flags.replaceModules} onChange={(e) => setFlags((was) => ({ ...was, replaceModules: e.target.checked }))} />
                <span>Zastąp moduły stron — których nie ma w dokumencie, znikną ze stron</span>
              </label>
              <label className="pe-check">
                <input type="checkbox" checked={flags.replaceQuestions} onChange={(e) => setFlags((was) => ({ ...was, replaceQuestions: e.target.checked }))} />
                <span>Usuń pytania i wymagania formularzy, których nie ma w dokumencie</span>
              </label>
              {(foreign || flags.adoptPages) && (
                <label className="pe-check">
                  <input type="checkbox" checked={flags.adoptPages} onChange={(e) => setFlags((was) => ({ ...was, adoptPages: e.target.checked }))} />
                  <span>Zmień też strony, które już istnieją, a nie są jeszcze stronami tego obszaru</span>
                </label>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
