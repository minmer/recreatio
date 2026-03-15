import type {
  RuntimeCheckcardAnswerModel,
  RuntimeCheckcardEvaluation,
  RuntimeCheckcardExpectedModel,
  RuntimeCheckcardPromptModel
} from '../RevisionCheckcardShell';
import { evaluateCheckcardQuestionSelection } from './checkcardQuestionSelection';
import { evaluateCheckcardQuestionText } from './checkcardQuestionText';

export function evaluateCheckcardVocabTranslationMatch(
  prompt: RuntimeCheckcardPromptModel,
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  if (prompt.kind === 'selection') {
    return evaluateCheckcardQuestionSelection(expected, answer);
  }
  return evaluateCheckcardQuestionText(prompt, expected, answer);
}
