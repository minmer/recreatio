import type { CogitaComputedSample } from '../../../lib/api';
import type { ComputedGraphDefinition } from '../components/ComputedGraphEditor';

type ComputedSample = {
  prompt: string;
  answers: Record<string, string>;
  values: Record<string, number | string>;
  answerText?: string;
  outputVariables?: Record<string, string>;
  variableValues?: Record<string, string>;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildComputedSampleFromGraph(
  computedGraph: ComputedGraphDefinition | null,
  promptTemplate: string,
  answerTemplate?: string
): ComputedSample | null {
  if (!computedGraph) return null;
  const nodeMap = new Map(computedGraph.nodes.map((node) => [node.id, node]));
  const values = new Map<string, number | string>();
  const visiting = new Set<string>();

  const toNumber = (value: number | string | undefined): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const evaluateNode = (nodeId: string): number | string => {
    if (values.has(nodeId)) return values.get(nodeId)!;
    if (visiting.has(nodeId)) return 0;
    const node = nodeMap.get(nodeId);
    if (!node) return 0;
    visiting.add(nodeId);

    const resolveInputs = (handle?: string) => {
      const ids = handle
        ? node.inputsByHandle?.[handle] ?? []
        : node.inputs ?? node.inputsByHandle?.in ?? [];
      return ids.map((id) => evaluateNode(id));
    };

    let result: number | string = 0;
    switch (node.type) {
      case 'input.random': {
        const min = node.min ?? 0;
        const max = node.max ?? min + 10;
        const low = Math.min(min, max);
        const high = Math.max(min, max);
        result = Math.floor(Math.random() * (high - low + 1)) + low;
        break;
      }
      case 'input.const': {
        result = node.value ?? 0;
        break;
      }
      case 'input.list': {
        const list = (node.list ?? []).filter(Boolean);
        const index = Math.round(toNumber(resolveInputs('index')[0]));
        result = list.length ? list[Math.max(0, Math.min(list.length - 1, index))] : String(index);
        break;
      }
      case 'compute.add': {
        const list = resolveInputs('in').map((value) => toNumber(value));
        result = list.reduce((sum, value) => sum + value, 0);
        break;
      }
      case 'compute.sub': {
        const addValues = resolveInputs('add').map((value) => toNumber(value));
        const subValues = resolveInputs('sub').map((value) => toNumber(value));
        result = addValues.reduce((sum, value) => sum + value, 0) - subValues.reduce((sum, value) => sum + value, 0);
        break;
      }
      case 'compute.mul': {
        const list = resolveInputs('in').map((value) => toNumber(value));
        result = list.length ? list.reduce((prod, value) => prod * value, 1) : 0;
        break;
      }
      case 'compute.div': {
        const numerator = toNumber(resolveInputs('num')[0]);
        const denominator = resolveInputs('den')
          .map((value) => toNumber(value))
          .reduce((sum, value) => sum + value, 0);
        result = Math.abs(denominator) < Number.EPSILON ? 0 : numerator / denominator;
        break;
      }
      case 'compute.pow': {
        const base = toNumber(resolveInputs('base')[0]);
        const exp = toNumber(resolveInputs('exp')[0]);
        result = Math.pow(base, exp);
        break;
      }
      case 'compute.exp': {
        const base = toNumber(resolveInputs('base')[0]);
        const exp = toNumber(resolveInputs('exp')[0]);
        result = Math.pow(base, exp);
        break;
      }
      case 'compute.log': {
        const value = toNumber(resolveInputs('value')[0]);
        const base = toNumber(resolveInputs('base')[0]);
        const safeValue = Math.max(value, Number.EPSILON);
        result = Math.abs(base) < Number.EPSILON ? Math.log(safeValue) : Math.log(safeValue) / Math.log(base);
        break;
      }
      case 'compute.abs': {
        result = Math.abs(toNumber(resolveInputs('in')[0]));
        break;
      }
      case 'compute.min': {
        const list = resolveInputs('in').map((value) => toNumber(value));
        result = list.length ? Math.min(...list) : 0;
        break;
      }
      case 'compute.max': {
        const list = resolveInputs('in').map((value) => toNumber(value));
        result = list.length ? Math.max(...list) : 0;
        break;
      }
      case 'compute.floor': {
        result = Math.floor(toNumber(resolveInputs('in')[0]));
        break;
      }
      case 'compute.ceil': {
        result = Math.ceil(toNumber(resolveInputs('in')[0]));
        break;
      }
      case 'compute.round': {
        result = Math.round(toNumber(resolveInputs('in')[0]));
        break;
      }
      case 'compute.mod': {
        const a = toNumber(resolveInputs('a')[0]);
        const b = toNumber(resolveInputs('b')[0]);
        result = Math.abs(b) < Number.EPSILON ? 0 : a % b;
        break;
      }
      case 'compute.concat': {
        const orderedIds = ['in1', 'in2', 'in3', 'in4', 'in5', 'in6'];
        const orderedInputs = orderedIds.flatMap((handle) => resolveInputs(handle));
        const inputs = orderedInputs.length ? orderedInputs : resolveInputs('in');
        const list = inputs.length ? inputs : resolveInputs();
        const parts = list.map((value) => (value === undefined || value === null ? '' : String(value)));
        result = parts.join('');
        break;
      }
      case 'compute.trim': {
        const textValue = resolveInputs('text')[0] ?? resolveInputs('in')[0] ?? '';
        const rawText = textValue === undefined || textValue === null ? '' : String(textValue);
        const startTrim = Math.max(0, Math.round(toNumber(resolveInputs('start')[0])));
        const endTrim = Math.max(0, Math.round(toNumber(resolveInputs('end')[0])));
        if (startTrim + endTrim >= rawText.length) {
          result = '';
        } else {
          result = rawText.substring(startTrim, rawText.length - endTrim);
        }
        break;
      }
      case 'output': {
        result = resolveInputs('in')[0] ?? 0;
        break;
      }
      default:
        result = 0;
    }

    visiting.delete(nodeId);
    values.set(nodeId, result);
    return result;
  };

  const outputs = computedGraph.outputs && computedGraph.outputs.length > 0
    ? computedGraph.outputs
    : computedGraph.output
      ? [computedGraph.output]
      : computedGraph.nodes.filter((node) => node.type === 'output').map((node) => node.id);

  computedGraph.nodes.forEach((node) => evaluateNode(node.id));
  outputs.forEach((id) => evaluateNode(id));

  const formatNumber = (value: number) => {
    if (Math.abs(value % 1) < 0.00001) return String(Math.round(value));
    return value.toFixed(3).replace(/\.?0+$/, '');
  };
  const formatValue = (value: number | string | undefined) =>
    typeof value === 'number' ? formatNumber(value) : value ?? '';

  const outputLabels = new Map<string, string>();
  outputs.forEach((id) => {
    const node = nodeMap.get(id);
    if (!node) return;
    const nameInputId = node.inputsByHandle?.name?.[0];
    const nameValue = nameInputId ? formatValue(values.get(nameInputId)) : '';
    const displayName =
      nameValue?.toString().trim() ||
      node.outputLabel?.trim() ||
      node.name?.trim() ||
      id;
    outputLabels.set(id, displayName);
  });

  const answers: Record<string, string> = {};
  const outputVariables: Record<string, string> = {};
  const variableValues: Record<string, string> = {};
  outputs.forEach((id) => {
    const node = nodeMap.get(id);
    if (!node) return;
    const displayName = outputLabels.get(id) ?? (node.outputLabel?.trim() || node.name?.trim() || id);
    answers[displayName] = formatValue(values.get(id));
    if (node.name) {
      outputVariables[node.name.trim()] = displayName;
    }
    outputVariables[id] = displayName;
  });

  const applyReplacements = (template: string, useOutputLabel: boolean) => {
    let text = template;
    computedGraph.nodes.forEach((node) => {
      const value = formatValue(values.get(node.id));
      const isOutput = outputs.includes(node.id);
      const outputLabel = isOutput
        ? (outputLabels.get(node.id) ??
            node.outputLabel?.trim() ??
            node.name?.trim() ??
            node.id)
        : '';
      const replacement = isOutput ? (useOutputLabel ? outputLabel : value) : value;
      text = text.replace(new RegExp(`\\{\\s*${escapeRegExp(node.id)}\\s*\\}`, 'gi'), replacement);
      if (node.name) {
        text = text.replace(new RegExp(`\\{\\s*${escapeRegExp(node.name)}\\s*\\}`, 'gi'), replacement);
      }
      if (isOutput && node.outputLabel) {
        text = text.replace(new RegExp(`\\{\\s*${escapeRegExp(node.outputLabel)}\\s*\\}`, 'gi'), outputLabel);
      }
    });
    return text;
  };

  const rawPrompt = promptTemplate ?? '';
  let prompt = rawPrompt.trim().length > 0 ? rawPrompt : '';
  if (!prompt) {
    prompt = outputs.length ? `Compute ${outputs.join(', ')}` : 'Compute';
  }
  prompt = applyReplacements(prompt, true);

  const rawAnswer = answerTemplate?.trim() ?? '';
  const answerText = rawAnswer ? applyReplacements(rawAnswer, false) : '';

  const valuesRecord: Record<string, number | string> = {};
  values.forEach((val, key) => {
    valuesRecord[key] = val;
    variableValues[key] = formatValue(val);
    const node = nodeMap.get(key);
    if (node?.name) {
      variableValues[node.name.trim()] = formatValue(val);
    }
  });

  return { prompt, answers, values: valuesRecord, answerText, outputVariables, variableValues };
}

export function toComputedSample(sample: ComputedSample, count?: number): CogitaComputedSample {
  const entries = Object.entries(sample.answers);
  return {
    prompt: sample.prompt,
    expectedAnswer: sample.answerText ?? entries[0]?.[1] ?? '',
    expectedAnswers: sample.answers,
    values: sample.values,
    count,
    expectedAnswerIsSentence: !!(sample.answerText && sample.answerText.trim().length > 0),
    outputVariables: sample.outputVariables,
    variableValues: sample.variableValues
  };
}
