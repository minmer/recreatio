import type { Copy } from '../../../content/types';
import { clampInt, type BonusGrowthMode, type LiveRules } from './liveSessionRules';

type LiveCopy = Copy['cogita']['library']['revision']['live'];

function growthRatio(mode: BonusGrowthMode, ratio: number) {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (mode === 'exponential') return clamped * clamped;
  if (mode === 'limited') return Math.min(1, clamped * 1.6);
  return clamped;
}

export function buildLiveSessionSummaryLines(options: {
  liveCopy: LiveCopy;
  rules: LiveRules;
  sessionMode: 'simultaneous' | 'asynchronous';
}) {
  const { liveCopy, rules, sessionMode } = options;
  const isAsyncSession = sessionMode === 'asynchronous';
  const growthLabel = (mode: BonusGrowthMode) =>
    mode === 'exponential' ? liveCopy.optionExponential : mode === 'limited' ? liveCopy.optionLimited : liveCopy.optionLinear;
  const firstActionLabel =
    rules.firstAnswerAction === 'start_timer'
      ? liveCopy.optionStartTimer
      : rules.firstAnswerAction === 'next'
        ? liveCopy.optionRevealNext
        : rules.firstAnswerAction === 'reveal'
          ? liveCopy.optionRevealScore
          : liveCopy.optionDoNothing;
  const allAnsweredLabel =
    rules.allAnsweredAction === 'next'
      ? liveCopy.optionRevealNext
      : rules.allAnsweredAction === 'reveal'
        ? liveCopy.optionRevealScore
        : liveCopy.optionDoNothing;
  const expireLabel =
    rules.actionTimer.onExpire === 'next'
      ? liveCopy.optionRevealNext
      : rules.actionTimer.onExpire === 'reveal'
        ? liveCopy.optionRevealScore
        : liveCopy.optionDoNothing;
  const roundExpireLabel =
    rules.roundTimer.onExpire === 'next'
      ? liveCopy.optionRevealNext
      : rules.roundTimer.onExpire === 'reveal'
        ? liveCopy.optionRevealScore
        : liveCopy.optionDoNothing;

  const elapsedOne = Math.max(1, Math.round(rules.bonusTimer.seconds / 3));
  const elapsedTwo = Math.max(elapsedOne + 1, Math.round((2 * rules.bonusTimer.seconds) / 3));
  const ratioOne = Math.max(0, 1 - elapsedOne / Math.max(1, rules.bonusTimer.seconds));
  const ratioTwo = Math.max(0, 1 - elapsedTwo / Math.max(1, rules.bonusTimer.seconds));
  const bonusOne = clampInt(growthRatio(rules.speedBonus.growth, ratioOne) * rules.speedBonus.maxPoints, 0, 500000);
  const bonusTwo = clampInt(growthRatio(rules.speedBonus.growth, ratioTwo) * rules.speedBonus.maxPoints, 0, 500000);
  const hasFirstBonus = rules.scoring.firstCorrectBonus > 0;
  const hasSpeedBonus = rules.speedBonus.enabled && rules.speedBonus.maxPoints > 0;
  const hasStreakBonus = rules.scoring.streakBaseBonus > 0;
  const minPoints = rules.scoring.baseCorrect;
  const maxPoints =
    rules.scoring.baseCorrect +
    (hasFirstBonus ? rules.scoring.firstCorrectBonus : 0) +
    (hasSpeedBonus ? rules.speedBonus.maxPoints : 0) +
    (hasStreakBonus ? rules.scoring.streakBaseBonus : 0);

  const streakProgressBonus = (streakCount: number) => {
    const maxBonus = Math.max(0, rules.scoring.streakBaseBonus);
    const extraCount = Math.max(0, streakCount - 1);
    if (maxBonus === 0 || extraCount === 0) return 0;
    const fullAfter = Math.max(1, rules.scoring.streakLimit);
    const progress = Math.max(0, Math.min(1, extraCount / fullAfter));
    return clampInt(growthRatio(rules.scoring.streakGrowth, progress) * maxBonus, 0, 500000);
  };
  const streakOne = 2;
  const streakTwo = Math.max(3, Math.round((rules.scoring.streakLimit + 2) / 2));
  const streakThree = Math.max(streakTwo + 1, rules.scoring.streakLimit + 1);
  const streakBonusOne = streakProgressBonus(streakOne);
  const streakBonusTwo = streakProgressBonus(streakTwo);
  const streakBonusThree = streakProgressBonus(streakThree);

  const lines: string[] = [];
  const paragraphOneParts: string[] = [];
  paragraphOneParts.push(isAsyncSession ? liveCopy.summaryTypeLineAsync : liveCopy.summaryTypeLineSync);
  paragraphOneParts.push(
    liveCopy.summaryBasePointsDetailed
      .replace('{base}', String(rules.scoring.baseCorrect))
      .replace('{unit}', liveCopy.scoreUnit)
  );
  if (hasFirstBonus || hasSpeedBonus || hasStreakBonus) {
    const activeBonusSentences: string[] = [];
    if (hasFirstBonus) {
      activeBonusSentences.push(
        liveCopy.summaryBonusFirst.replace('{first}', String(rules.scoring.firstCorrectBonus))
      );
    }
    if (hasSpeedBonus) {
      activeBonusSentences.push(
        liveCopy.summaryBonusSpeed.replace('{max}', String(rules.speedBonus.maxPoints))
      );
    }
    if (hasStreakBonus) {
      activeBonusSentences.push(
        liveCopy.summaryStreak
          .replace('{growth}', growthLabel(rules.scoring.streakGrowth))
          .replace('{max}', String(rules.scoring.streakBaseBonus))
          .replace('{limit}', String(rules.scoring.streakLimit))
      );
    }
    paragraphOneParts.push(activeBonusSentences.join(' '));
  } else {
    paragraphOneParts.push(liveCopy.summaryBonusesNone);
  }
  if (rules.scoring.wrongAnswerPenalty > 0) {
    paragraphOneParts.push(
      liveCopy.summaryWrongPenalty
        .replace('{penalty}', String(rules.scoring.wrongAnswerPenalty))
        .replace('{unit}', liveCopy.scoreUnit)
    );
  } else {
    paragraphOneParts.push(liveCopy.summaryNoWrongPenalty);
  }
  if (rules.scoring.firstWrongPenalty > 0) {
    paragraphOneParts.push(
      liveCopy.summaryFirstWrongPenalty
        .replace('{penalty}', String(rules.scoring.firstWrongPenalty))
        .replace('{unit}', liveCopy.scoreUnit)
    );
  }
  paragraphOneParts.push(
    liveCopy.summaryRangeLine
      .replace('{min}', String(minPoints))
      .replace('{max}', String(maxPoints))
      .replace('{unit}', liveCopy.scoreUnit)
  );
  lines.push(paragraphOneParts.join(' '));

  const paragraphTwoParts: string[] = [];
  paragraphTwoParts.push(
    hasSpeedBonus && rules.bonusTimer.enabled
      ? liveCopy.summaryBonusTimerDetail
          .replace('{start}', rules.bonusTimer.startMode === 'round_start' ? liveCopy.bonusTimerStartRound : liveCopy.bonusTimerStartAfterFirst)
          .replace('{startBonus}', String(rules.speedBonus.maxPoints))
          .replace('{midOneSeconds}', String(elapsedOne))
          .replace('{midOneBonus}', String(bonusOne))
          .replace('{midTwoSeconds}', String(elapsedTwo))
          .replace('{midTwoBonus}', String(bonusTwo))
          .replace('{endSeconds}', String(rules.bonusTimer.seconds))
      : liveCopy.summaryBonusTimerDisabled
  );
  paragraphTwoParts.push(
    hasStreakBonus
      ? liveCopy.summaryStreakDetail
          .replace('{growth}', growthLabel(rules.scoring.streakGrowth))
          .replace('{max}', String(rules.scoring.streakBaseBonus))
          .replaceAll('{unit}', liveCopy.scoreUnit)
          .replace('{streakOne}', String(streakOne))
          .replace('{bonusOne}', String(streakBonusOne))
          .replace('{streakTwo}', String(streakTwo))
          .replace('{bonusTwo}', String(streakBonusTwo))
          .replace('{streakThree}', String(streakThree))
          .replace('{bonusThree}', String(streakBonusThree))
      : liveCopy.summaryStreakDisabled
  );
  lines.push(paragraphTwoParts.join(' '));

  if (!isAsyncSession) {
    const paragraphThreeParts: string[] = [];
    paragraphThreeParts.push(
      rules.roundTimer.enabled
        ? liveCopy.summaryRoundTimerDetail
            .replace('{seconds}', String(rules.roundTimer.seconds))
            .replace('{expireAction}', roundExpireLabel)
        : liveCopy.summaryRoundTimerDisabled
    );
    paragraphThreeParts.push(
      rules.nextQuestion.mode === 'timer'
        ? liveCopy.summaryNextQuestionTimer.replace('{seconds}', String(rules.nextQuestion.seconds))
        : liveCopy.summaryNextQuestionManual
    );
    paragraphThreeParts.push(
      liveCopy.summaryAllAnsweredDetail.replace('{allAction}', allAnsweredLabel)
    );
    if (rules.firstAnswerAction === 'start_timer' && rules.actionTimer.enabled) {
      paragraphThreeParts.push(
        liveCopy.summaryActionTimerOnlyDetail
          .replace('{firstAction}', firstActionLabel)
          .replace('{expireAction}', expireLabel)
      );
    } else {
      paragraphThreeParts.push(liveCopy.summaryActionTimerDisabledDetail);
    }
    paragraphThreeParts.push(liveCopy.summaryEvaluationFlow);
    lines.push(paragraphThreeParts.join(' '));
  }

  return lines.filter((line) => line.trim().length > 0);
}
