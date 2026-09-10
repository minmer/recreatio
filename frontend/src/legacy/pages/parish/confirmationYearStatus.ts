import type { ParishConfirmationCandidate, ParishConfirmationPortal } from '../../lib/api';

export type ConfirmationYearRequirementKey =
  | 'meeting-year1-start'
  | 'meeting-year1-end'
  | 'goal'
  | 'paper-consent'
  | 'quiz'
  | 'index-choice'
  | 'internet-index'
  | 'paper-index';

export type ConfirmationYearRequirement = {
  key: ConfirmationYearRequirementKey;
  label: string;
  fulfilled: boolean;
  applicable: boolean;
  detail?: string;
};

type ConfirmationYearFacts = {
  firstMeetingCompleted: boolean;
  secondMeetingCompleted: boolean;
  firstMeetingDetail?: string;
  secondMeetingDetail?: string;
  goalRecorded: boolean;
  paperConsentReceived: boolean;
  quizCompleted: boolean;
  usesInternetIndex: boolean;
  usesPaperIndex: boolean;
  internetIndexCelebrationTotal: number;
  internetIndexCelebrationFilled: number;
  paperIndexChecked: boolean;
};

export type ConfirmationYearStatus = {
  requirements: ConfirmationYearRequirement[];
  missingRequirements: ConfirmationYearRequirement[];
  isComplete: boolean;
};

const buildConfirmationYearStatus = (facts: ConfirmationYearFacts): ConfirmationYearStatus => {
  const internetTotal = Math.max(0, facts.internetIndexCelebrationTotal);
  const internetFilled = Math.min(Math.max(0, facts.internetIndexCelebrationFilled), internetTotal);
  const requirements: ConfirmationYearRequirement[] = [
    {
      key: 'meeting-year1-start',
      label: 'pierwsze spotkanie (początek 1. roku)',
      fulfilled: facts.firstMeetingCompleted,
      applicable: true,
      detail: facts.firstMeetingDetail
    },
    {
      key: 'meeting-year1-end',
      label: 'drugie spotkanie (zakończenie 1. roku)',
      fulfilled: facts.secondMeetingCompleted,
      applicable: true,
      detail: facts.secondMeetingDetail
    },
    {
      key: 'goal',
      label: 'wpisany cel bierzmowania',
      fulfilled: facts.goalRecorded,
      applicable: true
    },
    {
      key: 'paper-consent',
      label: 'papierowa zgoda rodzica',
      fulfilled: facts.paperConsentReceived,
      applicable: true
    },
    {
      key: 'quiz',
      label: 'quiz bierzmowania',
      fulfilled: facts.quizCompleted,
      applicable: true
    },
    {
      key: 'index-choice',
      label: 'wybór rodzaju indeksu',
      fulfilled: facts.usesInternetIndex || facts.usesPaperIndex,
      applicable: true
    },
    {
      key: 'internet-index',
      label: 'indeks internetowy',
      fulfilled: internetTotal > 0 && internetFilled >= internetTotal,
      applicable: facts.usesInternetIndex,
      detail: `${internetFilled} z ${internetTotal} wpisów`
    },
    {
      key: 'paper-index',
      label: 'sprawdzony indeks papierowy',
      fulfilled: facts.paperIndexChecked,
      applicable: facts.usesPaperIndex
    }
  ];
  const missingRequirements = requirements.filter((requirement) => requirement.applicable && !requirement.fulfilled);

  return {
    requirements,
    missingRequirements,
    isComplete: missingRequirements.length === 0
  };
};

const candidateMeeting = (candidate: ParishConfirmationCandidate, stage: 'year1-start' | 'year1-end') =>
  candidate.meetings?.find((meeting) => meeting.stage.trim().toLowerCase() === stage);

const meetingSlotId = (candidate: ParishConfirmationCandidate, stage: 'year1-start' | 'year1-end') =>
  candidateMeeting(candidate, stage)?.slotId ?? (stage === 'year1-start' ? candidate.meetingSlotId : null);

export type ConfirmationCandidateMeetingStatus = {
  slotId: string | null;
  completedManually: boolean;
  isCompleted: boolean;
};

export const getConfirmationCandidateMeetingStatus = (
  candidate: ParishConfirmationCandidate,
  stage: 'year1-start' | 'year1-end'
): ConfirmationCandidateMeetingStatus => {
  const slotId = meetingSlotId(candidate, stage) ?? null;
  const completedManually = candidateMeeting(candidate, stage)?.completedManually === true;
  return {
    slotId,
    completedManually,
    isCompleted: Boolean(slotId) || completedManually
  };
};

export const getConfirmationCandidateYearStatus = (
  candidate: ParishConfirmationCandidate
): ConfirmationYearStatus => {
  const firstMeeting = getConfirmationCandidateMeetingStatus(candidate, 'year1-start');
  const secondMeeting = getConfirmationCandidateMeetingStatus(candidate, 'year1-end');
  return buildConfirmationYearStatus({
    firstMeetingCompleted: firstMeeting.isCompleted,
    secondMeetingCompleted: secondMeeting.isCompleted,
    firstMeetingDetail: firstMeeting.slotId
      ? 'zaliczone na podstawie rezerwacji'
      : firstMeeting.completedManually
      ? 'potwierdzone ręcznie przez parafię bez rezerwacji'
      : undefined,
    secondMeetingDetail: secondMeeting.slotId
      ? 'zaliczone na podstawie rezerwacji'
      : secondMeeting.completedManually
      ? 'potwierdzone ręcznie przez parafię bez rezerwacji'
      : undefined,
    goalRecorded: Boolean(candidate.goal?.trim()),
    paperConsentReceived: candidate.paperConsentReceived === true,
    quizCompleted: candidate.quizCompleted === true,
    usesInternetIndex: candidate.useInternetIndex === true,
    usesPaperIndex: candidate.usePaperIndex === true,
    internetIndexCelebrationTotal: candidate.internetIndexCelebrationTotal ?? 0,
    internetIndexCelebrationFilled: candidate.internetIndexCelebrationFilled ?? 0,
    paperIndexChecked: candidate.paperIndexChecked === true
  });
};

export const getConfirmationPortalMeetingStatus = (
  portal: ParishConfirmationPortal,
  stage: 'year1-start' | 'year1-end'
): ConfirmationCandidateMeetingStatus => {
  const slotId =
    (stage === 'year1-start'
      ? portal.candidate.selectedSlotId
      : portal.candidate.secondSelectedSlotId) ?? null;
  const completedManually =
    (stage === 'year1-start'
      ? portal.candidate.firstMeetingCompletedManually
      : portal.candidate.secondMeetingCompletedManually) === true;
  return {
    slotId,
    completedManually,
    isCompleted: Boolean(slotId) || completedManually
  };
};

export const getConfirmationPortalYearStatus = (portal: ParishConfirmationPortal): ConfirmationYearStatus => {
  const usesInternetIndex = portal.candidate.useInternetIndex === true;
  const internetCelebrations = usesInternetIndex ? portal.upcomingCelebrations : [];
  const firstMeeting = getConfirmationPortalMeetingStatus(portal, 'year1-start');
  const secondMeeting = getConfirmationPortalMeetingStatus(portal, 'year1-end');

  return buildConfirmationYearStatus({
    firstMeetingCompleted: firstMeeting.isCompleted,
    secondMeetingCompleted: secondMeeting.isCompleted,
    firstMeetingDetail: firstMeeting.slotId
      ? 'zaliczone na podstawie rezerwacji'
      : firstMeeting.completedManually
      ? 'potwierdzone ręcznie przez parafię bez rezerwacji'
      : undefined,
    secondMeetingDetail: secondMeeting.slotId
      ? 'zaliczone na podstawie rezerwacji'
      : secondMeeting.completedManually
      ? 'potwierdzone ręcznie przez parafię bez rezerwacji'
      : undefined,
    goalRecorded: Boolean(portal.candidate.goal?.trim()),
    paperConsentReceived: portal.candidate.paperConsentReceived === true,
    quizCompleted: portal.candidate.quizCompleted === true,
    usesInternetIndex,
    usesPaperIndex: portal.candidate.usePaperIndex === true,
    internetIndexCelebrationTotal: internetCelebrations.length,
    internetIndexCelebrationFilled: internetCelebrations.filter(
      (celebration) => Boolean(celebration.candidateComment?.trim())
    ).length,
    paperIndexChecked: portal.candidate.paperIndexChecked === true
  });
};

export const getConfirmationCandidateMeetingSlotId = (
  candidate: ParishConfirmationCandidate,
  stage: 'year1-start' | 'year1-end'
) => meetingSlotId(candidate, stage);
