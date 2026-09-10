import type {
  RuntimeCheckcardAnswerModel,
  RuntimeCheckcardEvaluation,
  RuntimeCheckcardExpectedModel,
  RuntimeCheckcardPromptModel
} from '../RevisionCheckcardShell';
import { evaluateCheckcardQuestionBoolean } from './checkcardQuestionBoolean';
import { evaluateCheckcardQuestionMatching } from './checkcardQuestionMatching';
import { evaluateCheckcardQuestionOrdering } from './checkcardQuestionOrdering';
import { evaluateCheckcardQuestionSelection } from './checkcardQuestionSelection';
import { evaluateCheckcardQuestionText } from './checkcardQuestionText';

export function evaluateCheckcardQuestion(
  prompt: RuntimeCheckcardPromptModel,
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  if (prompt.kind === 'selection') {
    return evaluateCheckcardQuestionSelection(expected, answer);
  }
  if (prompt.kind === 'boolean') {
    return evaluateCheckcardQuestionBoolean(expected, answer);
  }
  if (prompt.kind === 'ordering') {
    return evaluateCheckcardQuestionOrdering(prompt, expected, answer);
  }
  if (prompt.kind === 'matching') {
    return evaluateCheckcardQuestionMatching(expected, answer);
  }
  return evaluateCheckcardQuestionText(prompt, expected, answer);
}
