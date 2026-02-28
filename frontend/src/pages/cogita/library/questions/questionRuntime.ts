export type QuestionType = 'selection' | 'truefalse' | 'text' | 'number' | 'date' | 'ordering' | 'matching';

export type ParsedQuestionDefinition = {
  type: QuestionType;
  title?: string;
  question: string;
  options?: string[];
  answer?: number[] | string | number | boolean | { paths: number[][] };
  columns?: string[][];
};

export const normalizeQuestionType = (rawType: unknown): QuestionType | '' => {
  if (typeof rawType !== 'string') return '';
  const value = rawType.trim().toLowerCase();
  if (value === 'single_select' || value === 'multi_select') return 'selection';
  if (value === 'boolean' || value === 'true_false') return 'truefalse';
  if (value === 'order') return 'ordering';
  if (value === 'short' || value === 'open' || value === 'short_text') return 'text';
  if (value === 'selection' || value === 'truefalse' || value === 'text' || value === 'number' || value === 'date' || value === 'ordering' || value === 'matching') {
    return value;
  }
  return '';
};

export function parseQuestionDefinition(value: unknown): ParsedQuestionDefinition | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const root = (() => {
    if (data.definition && typeof data.definition === 'object') {
      return data.definition as Record<string, unknown>;
    }
    if (typeof data.definition === 'string') {
      try {
        const parsed = JSON.parse(data.definition);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // ignore malformed legacy definition strings
      }
    }
    return data;
  })();

  const type = normalizeQuestionType(root.type ?? root.kind ?? root.questionType);
  if (!type) return null;

  const title = typeof root.title === 'string' ? root.title : undefined;
  const question =
    typeof root.question === 'string'
      ? root.question
      : typeof root.prompt === 'string'
        ? root.prompt
        : '';

  const options = Array.isArray(root.options)
    ? root.options.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
    : undefined;

  const columns = Array.isArray(root.columns)
    ? root.columns
        .map((col) =>
          Array.isArray(col)
            ? col.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
            : []
        )
        .filter((col) => col.length > 0)
    : undefined;

  const answer = (() => {
    if (type === 'selection') {
      const source = Array.isArray(root.answer)
        ? root.answer
        : Array.isArray(root.correct)
          ? root.correct
          : [];
      return source
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x >= 0)
        .sort((a, b) => a - b);
    }

    if (type === 'truefalse') {
      if (typeof root.answer === 'boolean') return root.answer;
      if (typeof root.expected === 'boolean') return root.expected;
      return false;
    }

    if (type === 'matching') {
      const answerNode = root.answer && typeof root.answer === 'object'
        ? (root.answer as Record<string, unknown>)
        : null;
      const source = Array.isArray(answerNode?.paths)
        ? answerNode.paths
        : Array.isArray(root.correctPairs)
          ? root.correctPairs
          : [];
      const paths = source
        .map((row) =>
          Array.isArray(row)
            ? row
                .map((x) => Number(x))
                .filter((x) => Number.isInteger(x) && x >= 0)
            : []
        )
        .filter((row) => row.length > 0);
      return { paths };
    }

    if (typeof root.answer === 'string' || typeof root.answer === 'number') return root.answer;
    if (typeof root.expected === 'string' || typeof root.expected === 'number') return root.expected;
    return undefined;
  })();

  return {
    type,
    title,
    question,
    options,
    answer,
    columns
  };
}

function shuffleWithIndexMap<T>(items: T[]) {
  const indexed = items.map((value, oldIndex) => ({ value, oldIndex }));
  for (let i = indexed.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  const values = indexed.map((entry) => entry.value);
  const oldToNew = new Map<number, number>();
  indexed.forEach((entry, newIndex) => oldToNew.set(entry.oldIndex, newIndex));
  return { values, oldToNew };
}

export function shuffleQuestionDefinitionForRuntime(def: ParsedQuestionDefinition): ParsedQuestionDefinition {
  if (def.type === 'selection') {
    const options = def.options ?? [];
    const shuffled = shuffleWithIndexMap(options);
    const expected = Array.isArray(def.answer) ? def.answer : [];
    return {
      ...def,
      options: shuffled.values,
      answer: expected
        .map((index) => shuffled.oldToNew.get(index))
        .filter((index): index is number => Number.isInteger(index))
        .sort((a, b) => a - b)
    };
  }

  if (def.type === 'matching') {
    const columns = def.columns ?? [];
    const shuffledColumns = columns.map((column) => shuffleWithIndexMap(column));
    const paths =
      def.answer && typeof def.answer === 'object' && 'paths' in def.answer
        ? def.answer.paths
        : [];
    const remappedPaths = paths.map((path) =>
      path.map((oldIndex, columnIndex) => shuffledColumns[columnIndex]?.oldToNew.get(oldIndex) ?? oldIndex)
    );
    return {
      ...def,
      columns: shuffledColumns.map((entry) => entry.values),
      answer: { paths: remappedPaths }
    };
  }

  return def;
}
