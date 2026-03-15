import type {
  RuntimeCheckcardAnswerModel,
  RuntimeCheckcardEvaluation,
  RuntimeCheckcardExpectedModel,
  RuntimeCheckcardPromptModel
} from '../RevisionCheckcardShell';
import { evaluateCheckcardQuestionText } from './checkcardQuestionText';

export function evaluateCheckcardCitationQuote(
  prompt: RuntimeCheckcardPromptModel,
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  const citationPrompt: RuntimeCheckcardPromptModel = {
    ...prompt,
    kind: 'citation-fragment',
    inputType: 'text'
  };
  return evaluateCheckcardQuestionText(citationPrompt, expected, answer);
}

export const evaluateCheckcardCitationQuoteFragment = evaluateCheckcardCitationQuote;
