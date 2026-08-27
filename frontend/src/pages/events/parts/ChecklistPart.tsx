import { useCallback, useEffect, useState } from 'react';
import { getEventProgress, type EventProgress, type EventProgressStep } from '../../../lib/api';
import { partAnchor } from '../shell/anchors';
import { asBool, asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, CheckRow, ListEditor, SelectRow, TextRow } from './editorKit';

/**
 * "Czy mam już wszystko?" — answered on one slide.
 *
 * A participant's obligations are spread across the event by its very structure:
 * the sign-up on the public page, the card with its consents behind their own
 * link, the money in a column only the organizer sees. Each slide knows about
 * itself alone, so the person is left to reconstruct their own state from three
 * places — and the organizer spends the week before the event answering the same
 * question by telephone.
 *
 * Three decisions shape this part:
 *
 *   1. **It builds itself.** Placing the slide is the whole configuration: every
 *      form and card the person's link can reach becomes a line, in the order
 *      they occur. An organizer who has to list their own forms by hand will
 *      forget the one they added last, and the list would then lie in the most
 *      damaging direction — saying "everything done" when it is not.
 *
 *   2. **Every line that is not done carries the way to do it.** A checklist
 *      that reports a missing form without opening it just moves the search
 *      somewhere else. The link is the point; the tick is only how it is
 *      labelled.
 *
 *   3. **It says nothing without a link.** Without a token there is no person to
 *      be finished or unfinished, so on the public page it says exactly that
 *      instead of showing an empty or, worse, a green list.
 */

type StepOverride = { partId: string; label: string; hidden: boolean };

/** A step read off one of the organizer's own roster columns. */
type MarkStep = { code: string; label: string; doneWhen: 'filled' | 'is'; value: string; note: string | null };

/** Something to remember that nothing can tick off — bring the card, be at the church at 7:40. */
type NoteStep = { label: string; detail: string | null };

type ChecklistConfig = {
  allDoneText: string | null;
  todoIntro: string | null;
  /** Renaming or hiding one of the automatic lines. */
  overrides: StepOverride[];
  marks: MarkStep[];
  notes: NoteStep[];
  /** Keep finished lines on screen. Off, the list shrinks as it is worked through. */
  showDone: boolean;
};

const DONE_WHEN: Array<{ value: MarkStep['doneWhen']; label: string }> = [
  { value: 'filled', label: 'cokolwiek wpisane' },
  { value: 'is', label: 'dokładnie ta wartość' }
];

/**
 * What a finished line says under its name.
 *
 * The moment it was sent, not merely a tick: "wysłane 26.08, 19:45" is what
 * somebody unsure whether their form went through is actually looking for, and
 * it is the difference between being told and being reassured.
 */
function doneDetail(step: EventProgressStep): string | null {
  const when =
    step.doneUtc === null
      ? null
      : new Date(step.doneUtc).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

  const sent = step.kind === 'card' ? 'Podpisane' : 'Wysłane';
  const moment = when === null ? sent.toLowerCase() : `${sent}: ${when}`;

  // A minor's card is only finished on paper, and that is worth repeating here
  // rather than only on the card itself.
  return step.kind === 'card' && step.isMinor
    ? `${moment}. Pamiętaj o wydrukowanej i podpisanej karcie — oddajesz ją organizatorowi.`
    : moment;
}

/** What a line is called, once the organizer has had their say. */
function labelFor(step: EventProgressStep, overrides: StepOverride[]): string {
  const override = overrides.find((entry) => entry.partId === step.partId);
  if (override && override.label.trim().length > 0) return override.label;
  return step.menuLabel;
}

export const checklistPart = definePart<ChecklistConfig>({
  kind: 'checklist',
  label: 'Do zrobienia',
  description: 'Co uczestnik ma jeszcze do zrobienia, z linkiem do każdej z tych rzeczy. Tylko za linkiem osobistym.',

  defaultConfig: () => ({
    allDoneText: null,
    todoIntro: null,
    overrides: [],
    marks: [],
    notes: [],
    showDone: true
  }),

  example: () => ({
    allDoneText: 'Masz wszystko — do zobaczenia na miejscu!',
    todoIntro: 'Zostało jeszcze to:',
    overrides: [{ partId: '00000000-0000-0000-0000-000000000000', label: 'Zapisy', hidden: false }],
    marks: [
      { code: 'wplata', label: 'Wpłata', doneWhen: 'filled', value: '', note: 'Numer konta jest w sekcji „Koszty”.' }
    ],
    notes: [{ label: 'Przywieź podpisaną kartę', detail: 'Oddajesz ją przy zbiórce.' }],
    showDone: true
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      allDoneText: asOptionalText(record.allDoneText),
      todoIntro: asOptionalText(record.todoIntro),
      overrides: mapEntries(record.overrides, (entry) => ({
        partId: asText(entry.partId).trim(),
        label: asText(entry.label).trim(),
        hidden: asBool(entry.hidden)
      })),
      marks: mapEntries(record.marks, (entry) => ({
        code: asText(entry.code).trim(),
        label: asText(entry.label).trim(),
        doneWhen: entry.doneWhen === 'is' ? 'is' : 'filled',
        value: asText(entry.value).trim(),
        note: asOptionalText(entry.note)
      })),
      notes: mapEntries(record.notes, (entry) => ({
        label: asText(entry.label).trim(),
        detail: asOptionalText(entry.detail)
      })),
      showDone: asBool(record.showDone, true)
    };
  },

  Renderer: ({ config, ctx }) => (
    <Checklist config={config} token={ctx.accessToken} pageSlug={ctx.pageSlug} partId={ctx.part.id} />
  ),

  Editor: ({ config, onChange }) => <ChecklistEditor config={config} onChange={onChange} />
});

// ── Renderer ─────────────────────────────────────────────────────────────────

type Line = {
  key: string;
  label: string;
  done: boolean;
  detail: string | null;
  /** Where to go to deal with it. Null for a line nothing can open. */
  href: string | null;
};

function Checklist({
  config,
  token,
  pageSlug,
  partId
}: {
  config: ChecklistConfig;
  token: string | null;
  /** The page the checklist itself sits on. */
  pageSlug: string;
  partId: string;
}) {
  const [progress, setProgress] = useState<EventProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (token === null) {
      setLoading(false);
      return;
    }
    try {
      setProgress(await getEventProgress(token));
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się sprawdzić, co zostało.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Without a token nobody is asking, so nothing is claimed. Saying "wszystko
  // gotowe" to a stranger on the public page would be the one wrong answer.
  if (token === null) {
    return (
      <p className="ev-note">
        Ta lista pokazuje, co masz jeszcze do zrobienia — otwórz ją ze swojego linku osobistego.
      </p>
    );
  }

  if (loading) return <p className="ev-note">Sprawdzam…</p>;
  if (error !== null) return <p className="ev-error">{error}</p>;
  if (progress === null) return null;

  const lines: Line[] = [];

  for (const step of progress.steps) {
    const override = config.overrides.find((entry) => entry.partId === step.partId);
    if (override?.hidden) continue;

    // On this page an anchor, which the shell turns into a scroll; on another
    // page the address that opens that page on that very slide. A deep link to
    // the page one is already reading would rewrite the address and move
    // nothing, which is the one thing a "go here" button must not do.
    const onThisPage = step.pageSlug === pageSlug;
    lines.push({
      key: step.partId,
      label: labelFor(step, config.overrides),
      done: step.done,
      detail: step.done ? doneDetail(step) : null,
      href:
        step.partId === partId
          ? null
          : onThisPage
            ? `#${partAnchor(step.menuLabel)}`
            : `/#/event/link/${token}/${step.pageSlug}/${step.partNumber}`
    });
  }

  for (const mark of config.marks) {
    const value = (progress.marks.find((entry) => entry.code === mark.code)?.value ?? '').trim();
    const done = mark.doneWhen === 'is' ? value.toLowerCase() === mark.value.toLowerCase() : value.length > 0;

    lines.push({
      key: `mark:${mark.code}`,
      label: mark.label.length > 0 ? mark.label : mark.code,
      done,
      // What the organizer wrote there is worth showing: "wpłata: 120 zł" says
      // more than a tick, and it is this person's own data.
      detail: done && value.length > 0 && mark.doneWhen === 'filled' ? value : mark.note,
      href: null
    });
  }

  for (const note of config.notes) {
    if (note.label.length === 0) continue;
    lines.push({ key: `note:${note.label}`, label: note.label, done: false, detail: note.detail, href: null });
  }

  // Notes are never "done", so they must not make the list look unfinished for
  // ever: only what can actually be ticked counts towards the verdict.
  const countable = lines.filter((line) => !line.key.startsWith('note:'));
  const left = countable.filter((line) => !line.done).length;
  const shown = config.showDone ? lines : lines.filter((line) => !line.done);

  return (
    <div className="ev-todo">
      <p className={`ev-todo-verdict ${left === 0 ? 'is-done' : ''}`}>
        {left === 0
          ? config.allDoneText ?? 'Masz wszystko. Nic więcej nie trzeba.'
          : config.todoIntro ?? `Zostało do zrobienia: ${left}`}
      </p>

      <ul className="ev-todo-list">
        {shown.map((line) => (
          <li key={line.key} data-done={line.done}>
            <span className="ev-todo-mark" aria-hidden="true">
              {line.done ? '✓' : '•'}
            </span>
            <span className="ev-todo-body">
              <strong>{line.label}</strong>
              {line.detail ? <em>{line.detail}</em> : null}
            </span>
            <span className="ev-todo-state">
              {line.href === null ? (
                <span className="ev-todo-word">{line.done ? 'zrobione' : 'do zrobienia'}</span>
              ) : (
                <a className={line.done ? 'ev-ghost' : 'ev-cta'} href={line.href}>
                  {line.done ? 'Sprawdź' : 'Otwórz'}
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>

      {progress.recipientName.length > 0 ? (
        <p className="ev-todo-foot">Lista dla: {progress.recipientName}</p>
      ) : null}
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

function ChecklistEditor({
  config,
  onChange
}: {
  config: ChecklistConfig;
  onChange: (next: ChecklistConfig) => void;
}) {
  return (
    <>
      <p className="eve-hint">
        Nic nie trzeba tu wypisywać: lista sama pokazuje każdy formularz i każdą kartę, którą otwiera link
        osobisty tej osoby, i przy każdej z nich daje odnośnik. Poniżej dokładasz tylko to, o czym aplikacja
        sama nie wie.
      </p>

      <TextRow
        label="Napis, gdy wszystko zrobione"
        value={config.allDoneText ?? ''}
        placeholder="Masz wszystko. Nic więcej nie trzeba."
        onChange={(allDoneText) => onChange({ ...config, allDoneText: allDoneText || null })}
      />
      <TextRow
        label="Napis, gdy coś zostało"
        value={config.todoIntro ?? ''}
        placeholder="Zostało do zrobienia: 2"
        onChange={(todoIntro) => onChange({ ...config, todoIntro: todoIntro || null })}
      />
      <CheckRow
        label="Pokazuj też rzeczy już zrobione"
        checked={config.showDone}
        onChange={(showDone) => onChange({ ...config, showDone })}
      />

      <ListEditor<MarkStep>
        legend="Z kolumn listy uczestników"
        items={config.marks}
        addLabel="Dodaj pozycję z listy"
        blank={() => ({ code: '', label: 'Wpłata', doneWhen: 'filled', value: '', note: null })}
        titleOf={(item) => item.label || item.code || 'Bez nazwy'}
        onChange={(marks) => onChange({ ...config, marks })}
        renderItem={(item, update) => (
          <>
            <TextRow
              label="Kod kolumny"
              value={item.code}
              hint="Ten sam kod, co w części „Lista uczestników” — np. pole-1."
              onChange={(code) => update({ ...item, code })}
            />
            <TextRow label="Nazwa" value={item.label} onChange={(label) => update({ ...item, label })} />
            <SelectRow<MarkStep['doneWhen']>
              label="Uznaj za zrobione, gdy"
              value={item.doneWhen}
              options={DONE_WHEN}
              onChange={(doneWhen) => update({ ...item, doneWhen })}
            />
            {item.doneWhen === 'is' ? (
              <TextRow label="Wartość" value={item.value} onChange={(value) => update({ ...item, value })} />
            ) : null}
            <TextRow
              label="Podpowiedź"
              value={item.note ?? ''}
              hint="Widoczna, dopóki pozycja nie jest zrobiona."
              onChange={(note) => update({ ...item, note: note || null })}
            />
          </>
        )}
      />

      <ListEditor<NoteStep>
        legend="Przypomnienia"
        items={config.notes}
        addLabel="Dodaj przypomnienie"
        blank={() => ({ label: 'Nowe przypomnienie', detail: null })}
        titleOf={(item) => item.label || 'Bez nazwy'}
        onChange={(notes) => onChange({ ...config, notes })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Treść" value={item.label} onChange={(label) => update({ ...item, label })} />
            <AreaRow
              label="Szczegóły"
              rows={2}
              value={item.detail ?? ''}
              onChange={(detail) => update({ ...item, detail: detail || null })}
            />
          </>
        )}
      />

      <ListEditor<StepOverride>
        legend="Zmiany w pozycjach automatycznych"
        items={config.overrides}
        addLabel="Dodaj zmianę"
        blank={() => ({ partId: '', label: '', hidden: false })}
        titleOf={(item, index) => item.label || `Zmiana ${index + 1}`}
        onChange={(overrides) => onChange({ ...config, overrides })}
        renderItem={(item, update) => (
          <>
            <TextRow
              label="Identyfikator części"
              value={item.partId}
              hint="Z adresu części w edytorze. Zwykle nie trzeba tego ruszać."
              onChange={(partId) => update({ ...item, partId })}
            />
            <TextRow
              label="Inna nazwa"
              value={item.label}
              onChange={(label) => update({ ...item, label })}
            />
            <CheckRow
              label="Nie pokazuj tej pozycji"
              checked={item.hidden}
              onChange={(hidden) => update({ ...item, hidden })}
            />
          </>
        )}
      />
    </>
  );
}
