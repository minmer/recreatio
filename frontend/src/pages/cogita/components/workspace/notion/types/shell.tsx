import type { Copy } from '../../../../../../content/types';
import type { CogitaInfoPayloadFieldSpec } from '../../../../../../lib/api';
import type { CogitaInfoOption } from '../../../types';
import type { CogitaInfoType } from '../../../types';
import { NotionComputedEditor, type NotionComputedEditorProps } from './notionComputed';
import {
  NotionPythonEditor,
  createDefaultPythonDefinition,
  parsePythonDefinitionFromPayload,
  serializePythonDefinition,
  type NotionPythonEditorProps
} from './notionPython';
import { NotionQuestionEditor, type NotionQuestionEditorProps } from './notionQuestion';

export type ReferenceSourceForm = {
  sourceKind: string;
  locatorValue: string;
  locatorAux: string;
  bibleBookDisplay: string;
  sourceUrl: string;
  sourceAccessedDate: string;
  churchDocument: CogitaInfoOption | null;
  bookMedia: CogitaInfoOption | null;
  work: CogitaInfoOption | null;
};

export const SOURCE_KIND_OPTIONS = [
  { value: 'string', label: 'string' },
  { value: 'book', label: 'book' },
  { value: 'website', label: 'website' },
  { value: 'bible', label: 'bible' },
  { value: 'number_document', label: 'number_document' },
  { value: 'work', label: 'work' },
  { value: 'other', label: 'other' }
] as const;

export function createEmptyReferenceSourceForm(): ReferenceSourceForm {
  return {
    sourceKind: 'string',
    locatorValue: '',
    locatorAux: '',
    bibleBookDisplay: '',
    sourceUrl: '',
    sourceAccessedDate: '',
    churchDocument: null,
    bookMedia: null,
    work: null
  };
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringValue(node: Record<string, unknown> | null, key: string): string {
  const value = node?.[key];
  return typeof value === 'string' ? value : '';
}

function resourceOptionForKind(sourceKind: string, resource: CogitaInfoOption | null): Partial<ReferenceSourceForm> {
  if (!resource) return {};
  if (sourceKind === 'book' && resource.infoType === 'media') return { bookMedia: resource };
  if (sourceKind === 'work' && resource.infoType === 'work') return { work: resource };
  if (sourceKind === 'number_document' && resource.infoType === 'work') return { churchDocument: resource };
  return {};
}

export function parseReferenceFormFromSourceValues(
  payloadValues: Record<string, string>,
  resource: CogitaInfoOption | null
): ReferenceSourceForm {
  const base = createEmptyReferenceSourceForm();
  const sourceKind = (payloadValues.sourceKind ?? '').trim() || base.sourceKind;
  const locatorRaw = payloadValues.locator ?? '';
  const locatorObject = tryParseJsonObject(locatorRaw);
  let locatorValue = '';
  let locatorAux = '';
  let bibleBookDisplay = '';
  let sourceUrl = '';
  let sourceAccessedDate = '';

  if (sourceKind === 'website') {
    sourceUrl = stringValue(locatorObject, 'url');
    sourceAccessedDate = stringValue(locatorObject, 'accessedDate');
    locatorValue = stringValue(locatorObject, 'value');
  } else if (sourceKind === 'bible') {
    locatorValue = stringValue(locatorObject, 'book') || locatorRaw.trim();
    locatorAux = stringValue(locatorObject, 'passage') || stringValue(locatorObject, 'rest');
    bibleBookDisplay = stringValue(locatorObject, 'bookDisplay');
  } else if (locatorObject) {
    locatorValue = stringValue(locatorObject, 'value') || stringValue(locatorObject, 'locator');
    locatorAux = stringValue(locatorObject, 'aux');
  } else {
    locatorValue = locatorRaw;
  }

  return {
    ...base,
    sourceKind,
    locatorValue,
    locatorAux,
    bibleBookDisplay,
    sourceUrl,
    sourceAccessedDate,
    ...resourceOptionForKind(sourceKind, resource)
  };
}

export function getReferenceResource(form: ReferenceSourceForm): CogitaInfoOption | null {
  if (form.sourceKind === 'book') return form.bookMedia;
  if (form.sourceKind === 'work') return form.work;
  if (form.sourceKind === 'number_document') return form.churchDocument;
  return null;
}

export function buildSourceLocatorPayload(form: ReferenceSourceForm): unknown {
  const locatorValue = form.locatorValue.trim();
  const locatorAux = form.locatorAux.trim();
  const sourceUrl = form.sourceUrl.trim();
  const sourceAccessedDate = form.sourceAccessedDate.trim();

  switch (form.sourceKind) {
    case 'website':
      return {
        url: sourceUrl,
        accessedDate: sourceAccessedDate
      };
    case 'bible':
      return {
        book: locatorValue,
        bookDisplay: form.bibleBookDisplay.trim(),
        passage: locatorAux
      };
    case 'book':
    case 'work':
    case 'number_document':
      return locatorAux ? { value: locatorValue, aux: locatorAux } : locatorValue;
    default:
      return locatorAux ? { value: locatorValue, aux: locatorAux } : locatorValue;
  }
}

export function buildReferenceSourceLabel(form: ReferenceSourceForm): string {
  const locatorValue = form.locatorValue.trim();
  const locatorAux = form.locatorAux.trim();
  const locatorTail = [locatorValue, locatorAux].filter(Boolean).join(' ');
  switch (form.sourceKind) {
    case 'website':
      return form.sourceUrl.trim() || 'website';
    case 'bible':
      return locatorTail || 'bible';
    case 'book':
      return [form.bookMedia?.label, locatorTail].filter(Boolean).join(' · ') || 'book';
    case 'work':
      return [form.work?.label, locatorTail].filter(Boolean).join(' · ') || 'work';
    case 'number_document':
      return [form.churchDocument?.label, locatorTail].filter(Boolean).join(' · ') || 'number_document';
    default:
      return locatorTail || form.sourceKind || 'source';
  }
}

export function validateReferenceSourceForm(form: ReferenceSourceForm): boolean {
  if (!form.sourceKind.trim()) return false;
  if (form.sourceKind === 'website') return Boolean(form.sourceUrl.trim());
  if (form.sourceKind === 'bible') return Boolean(form.locatorValue.trim() && form.locatorAux.trim());
  if (form.sourceKind === 'book') return Boolean(form.bookMedia);
  if (form.sourceKind === 'work') return Boolean(form.work);
  if (form.sourceKind === 'number_document') return Boolean(form.churchDocument && form.locatorValue.trim());
  return Boolean(form.locatorValue.trim());
}

export type NotionTypePayloadShellProps = {
  copy: Copy;
  infoType: CogitaInfoType;
  field: CogitaInfoPayloadFieldSpec;
  value: string;
  onValueChange: (value: string) => void;
  questionEditor?: Omit<NotionQuestionEditorProps, 'copy'>;
  computedEditor?: Omit<NotionComputedEditorProps, 'copy'>;
  pythonEditor?: Omit<NotionPythonEditorProps, 'copy'>;
};

export function NotionTypePayloadShell({
  copy,
  infoType,
  field,
  value,
  onValueChange,
  questionEditor,
  computedEditor,
  pythonEditor
}: NotionTypePayloadShellProps) {
  if (infoType === 'question' && field.key === 'definition' && field.inputType === 'json' && questionEditor) {
    return (
      <div className="cogita-field full">
        <span>{field.label}</span>
        <NotionQuestionEditor copy={copy} {...questionEditor} />
      </div>
    );
  }
  if (infoType === 'computed' && field.key === 'definition' && field.inputType === 'json' && computedEditor) {
    return (
      <div className="cogita-field full">
        <span>{field.label}</span>
        <NotionComputedEditor copy={copy} {...computedEditor} />
      </div>
    );
  }
  if (infoType === 'python' && field.key === 'definition' && field.inputType === 'json') {
    const definition =
      pythonEditor?.definition ??
      parsePythonDefinitionFromPayload(value) ??
      createDefaultPythonDefinition();
    const onDefinitionChange =
      pythonEditor?.onDefinitionChange ??
      ((next: typeof definition) => onValueChange(serializePythonDefinition(next)));
    return (
      <div className="cogita-field full">
        <span>{field.label}</span>
        <NotionPythonEditor
          copy={copy}
          definition={definition}
          onDefinitionChange={onDefinitionChange}
        />
      </div>
    );
  }

  const isLong = field.inputType === 'textarea' || field.inputType === 'json';
  return (
    <label className="cogita-field full">
      <span>{field.label}</span>
      {isLong ? (
        <textarea
          rows={field.inputType === 'json' ? 8 : 4}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={field.key}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={field.key}
        />
      )}
    </label>
  );
}
