import {
  applyRuntimeCheckcardInteraction,
  buildRuntimeCheckcardReveal,
  createRuntimeCheckcardInitialAnswer,
  ensureRuntimeCheckcardAnswer,
  evaluateRuntimeCheckcard,
  RuntimeCheckcard,
  type RuntimeCheckcardAnswerModel,
  type RuntimeCheckcardContext,
  type RuntimeCheckcardCorrectness,
  type RuntimeCheckcardCorrectnessState,
  type RuntimeCheckcardEvaluation,
  type RuntimeCheckcardExpectedModel,
  type RuntimeCheckcardInteractionAction,
  type RuntimeCheckcardInteractionEvent,
  type RuntimeCheckcardInteractionResult,
  type RuntimeCheckcardRevealState,
  type RuntimeCheckcardPromptKind,
  type RuntimeCheckcardPromptModel
} from '../runtime/revision/primitives/RevisionCheckcardShell';
export { RuntimeCheckcard };

export type CheckcardPromptKind = RuntimeCheckcardPromptKind;
export type CheckcardPromptModel = RuntimeCheckcardPromptModel;
export type CheckcardExpectedModel = RuntimeCheckcardExpectedModel;
export type CheckcardAnswerModel = RuntimeCheckcardAnswerModel;
export type CheckcardEvaluation = RuntimeCheckcardEvaluation;
export type CheckcardRevealState = RuntimeCheckcardRevealState;
export type CheckcardCorrectness = RuntimeCheckcardCorrectness;
export type CheckcardCorrectnessState = RuntimeCheckcardCorrectnessState;
export type CheckcardContext = RuntimeCheckcardContext;
export type CheckcardInteractionAction = RuntimeCheckcardInteractionAction;
export type CheckcardInteractionEvent = RuntimeCheckcardInteractionEvent;
export type CheckcardInteractionResult = RuntimeCheckcardInteractionResult;

export function evaluateCheckcardAnswer(payload: {
  prompt: CheckcardPromptModel;
  expected: CheckcardExpectedModel;
  answer: CheckcardAnswerModel;
  context?: CheckcardContext;
}): { correct: boolean; mask: Uint8Array | null } {
  const evaluation = evaluateRuntimeCheckcard(payload);
  return { correct: evaluation.isCorrect, mask: evaluation.mask };
}

export function evaluateCheckcardDetailed(payload: {
  prompt: CheckcardPromptModel;
  expected: CheckcardExpectedModel;
  answer: CheckcardAnswerModel;
  context?: CheckcardContext;
}): CheckcardEvaluation {
  return evaluateRuntimeCheckcard(payload);
}

export function buildCheckcardRevealState(payload: {
  prompt: CheckcardPromptModel;
  evaluation: CheckcardEvaluation;
}): CheckcardRevealState {
  return buildRuntimeCheckcardReveal(payload);
}

export function createCheckcardInitialAnswer(prompt: CheckcardPromptModel): CheckcardAnswerModel {
  return createRuntimeCheckcardInitialAnswer(prompt);
}

export function normalizeCheckcardAnswer(
  prompt: CheckcardPromptModel,
  answer: CheckcardAnswerModel
): CheckcardAnswerModel {
  return ensureRuntimeCheckcardAnswer(prompt, answer);
}

export function applyCheckcardInteraction(payload: {
  prompt: CheckcardPromptModel;
  expected: CheckcardExpectedModel;
  answer: CheckcardAnswerModel;
  action: CheckcardInteractionAction;
  context?: CheckcardContext;
}): CheckcardInteractionResult {
  return applyRuntimeCheckcardInteraction(payload);
}
