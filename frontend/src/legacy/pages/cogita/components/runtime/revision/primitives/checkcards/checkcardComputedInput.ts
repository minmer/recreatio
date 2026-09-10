import type {
  RuntimeCheckcardAnswerModel,
  RuntimeCheckcardEvaluation,
  RuntimeCheckcardExpectedModel,
  RuntimeCheckcardPromptModel
} from '../RevisionCheckcardShell';
import { evaluateCheckcardQuestionText } from './checkcardQuestionText';

export function evaluateCheckcardComputedInput(
  prompt: RuntimeCheckcardPromptModel,
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  return evaluateCheckcardQuestionText(prompt, expected, answer);
}
