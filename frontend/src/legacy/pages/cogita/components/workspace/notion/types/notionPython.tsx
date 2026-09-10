import type { Copy } from '../../../../../../content/types';

export type PythonDefinition = {
  type: 'python_transform_v1';
  createInputSource: string;
  referenceSource: string;
  starterSource: string;
  taskText: string;
  caseCount: number;
};

const DEFAULT_CREATE_INPUT_SOURCE = `def create_input(seed):
    return seed`;

const DEFAULT_REFERENCE_SOURCE = `def reference(x):
    return x`;

const DEFAULT_STARTER_SOURCE = `def transform(x):
    return x`;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSource(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeCaseCount(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(200, Math.round(parsed)));
}

function normalizeTaskText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim();
}

export function createDefaultPythonDefinition(): PythonDefinition {
  return {
    type: 'python_transform_v1',
    createInputSource: DEFAULT_CREATE_INPUT_SOURCE,
    referenceSource: DEFAULT_REFERENCE_SOURCE,
    starterSource: DEFAULT_STARTER_SOURCE,
    taskText: '',
    caseCount: 5
  };
}

export function normalizePythonDefinition(value: unknown): PythonDefinition | null {
  if (!isObject(value)) return null;
  const node = isObject(value.definition) ? value.definition : value;

  return {
    type: 'python_transform_v1',
    createInputSource: normalizeSource(node.createInputSource, DEFAULT_CREATE_INPUT_SOURCE),
    referenceSource: normalizeSource(node.referenceSource, DEFAULT_REFERENCE_SOURCE),
    starterSource: normalizeSource(node.starterSource, DEFAULT_STARTER_SOURCE),
    taskText: normalizeTaskText(node.taskText),
    caseCount: normalizeCaseCount(node.caseCount)
  };
}

export function parsePythonDefinitionFromPayload(rawValue: unknown): PythonDefinition | null {
  if (isObject(rawValue)) {
    return normalizePythonDefinition(rawValue);
  }
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const normalized = normalizePythonDefinition(parsed);
    if (normalized) return normalized;
    if (typeof parsed === 'string') {
      const nested = JSON.parse(parsed) as unknown;
      return normalizePythonDefinition(nested);
    }
  } catch {
    return null;
  }

  return null;
}

export function serializePythonDefinition(definition: PythonDefinition) {
  return JSON.stringify(
    {
      type: 'python_transform_v1',
      createInputSource: definition.createInputSource,
      referenceSource: definition.referenceSource,
      starterSource: definition.starterSource,
      taskText: normalizeTaskText(definition.taskText),
      caseCount: normalizeCaseCount(definition.caseCount)
    },
    null,
    2
  );
}

export type NotionPythonEditorProps = {
  copy: Copy;
  definition: PythonDefinition;
  onDefinitionChange: (definition: PythonDefinition) => void;
};

export function NotionPythonEditor({ copy: _copy, definition, onDefinitionChange }: NotionPythonEditorProps) {
  const setCaseCount = (value: unknown) => {
    onDefinitionChange({
      ...definition,
      caseCount: normalizeCaseCount(value)
    });
  };
  const setCreateInputSource = (value: string) => {
    onDefinitionChange({
      ...definition,
      createInputSource: value
    });
  };
  const setReferenceSource = (value: string) => {
    onDefinitionChange({
      ...definition,
      referenceSource: value
    });
  };
  const setStarterSource = (value: string) => {
    onDefinitionChange({
      ...definition,
      starterSource: value
    });
  };
  const setTaskText = (value: string) => {
    onDefinitionChange({
      ...definition,
      taskText: value
    });
  };

  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <label className="cogita-field full">
        <span>Cases</span>
        <input
          type="number"
          min={1}
          max={200}
          value={definition.caseCount}
          onChange={(event) => setCaseCount(event.target.value)}
        />
      </label>

      <label className="cogita-field full">
        <span>`create_input(seed)` source</span>
        <textarea
          rows={8}
          value={definition.createInputSource}
          onChange={(event) => setCreateInputSource(event.target.value)}
          spellCheck={false}
        />
      </label>

      <label className="cogita-field full">
        <span>`reference(x)` source (hidden from learner)</span>
        <textarea
          rows={8}
          value={definition.referenceSource}
          onChange={(event) => setReferenceSource(event.target.value)}
          spellCheck={false}
        />
      </label>

      <label className="cogita-field full">
        <span>`transform(x)` starter source</span>
        <textarea
          rows={8}
          value={definition.starterSource}
          onChange={(event) => setStarterSource(event.target.value)}
          spellCheck={false}
        />
      </label>

      <label className="cogita-field full">
        <span>Task text (shown to learner)</span>
        <textarea
          rows={5}
          value={definition.taskText}
          onChange={(event) => setTaskText(event.target.value)}
          spellCheck={false}
        />
      </label>
    </div>
  );
}
