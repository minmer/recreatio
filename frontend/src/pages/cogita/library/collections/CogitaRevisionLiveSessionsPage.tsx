import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  attachCogitaLiveRevisionSession,
  createCogitaLiveRevisionSession,
  getCogitaLiveRevisionSessionsByRevision,
  getCogitaRevision,
  updateCogitaLiveRevisionSession,
  type CogitaLiveRevisionSession,
  type CogitaLiveRevisionSessionListItem
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import {
  DEFAULT_LIVE_RULES,
  clampInt,
  getLivePresetById,
  getLivePresets,
  parseLiveRules,
  withLiveRulesSettings,
  type AllAnsweredAction,
  type BonusGrowthMode,
  type FirstAnswerAction,
  type LiveRules,
  type LivePresetId,
  type TimerExpireAction
} from '../../live/liveSessionRules';

export type LiveSessionsPageMode = 'search' | 'create' | 'detail' | 'edit';

export function CogitaRevisionLiveSessionsPage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  libraryId,
  revisionId,
  mode = 'search',
  sessionId,
  onCreated,
  onOpenSession,
  onRequestEdit,
  onRequestOverview
}: {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  libraryId: string;
  revisionId: string;
  mode?: LiveSessionsPageMode;
  sessionId?: string;
  onCreated?: (sessionId: string) => void;
  onOpenSession?: (sessionId: string) => void;
  onRequestEdit?: (sessionId: string) => void;
  onRequestOverview?: (sessionId: string) => void;
}) {
  const FIXED_HOST_VIEW_MODE = 'panel' as const;
  const FIXED_PARTICIPANT_VIEW_MODE = 'question' as const;
  const [revisionName, setRevisionName] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [items, setItems] = useState<CogitaLiveRevisionSessionListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [formTitle, setFormTitle] = useState('');
  const [formSessionMode, setFormSessionMode] = useState<'simultaneous' | 'asynchronous'>('simultaneous');
  const [formLiveRules, setFormLiveRules] = useState<LiveRules>(DEFAULT_LIVE_RULES);
  const [formPresetId, setFormPresetId] = useState<LivePresetId>('balanced_duel');
  const [showSpecialSettings, setShowSpecialSettings] = useState(false);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attachedSession, setAttachedSession] = useState<CogitaLiveRevisionSession | null>(null);
  const [reloginParticipantId, setReloginParticipantId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'none' | 'create' | 'save'>('none');
  const [message, setMessage] = useState<string | null>(null);

  const baseHref = `/#/cogita/library/${libraryId}`;
  const liveCopy = copy.cogita.library.revision.live;
  const presetDefinitions = useMemo(() => getLivePresets(), []);
  const presetLabelById = (presetId: LivePresetId) => {
    if (presetId === 'balanced_duel') return liveCopy.presetBalancedDuel;
    if (presetId === 'first_strike') return liveCopy.presetFirstStrike;
    if (presetId === 'sprint_race') return liveCopy.presetSprintRace;
    if (presetId === 'accuracy_focus') return liveCopy.presetAccuracyFocus;
    if (presetId === 'streak_master') return liveCopy.presetStreakMaster;
    if (presetId === 'marathon_classic') return liveCopy.presetMarathonClassic;
    if (presetId === 'async_challenge') return liveCopy.presetAsyncChallenge;
    return liveCopy.presetCustom;
  };

  const presetOptions = useMemo(
    () => [...presetDefinitions.map((preset) => ({ value: preset.id, label: presetLabelById(preset.id) })), { value: 'custom' as const, label: presetLabelById('custom') }],
    [presetDefinitions, liveCopy]
  );
  const isAsyncSession = formSessionMode === 'asynchronous';
  const growthRatio = (mode: BonusGrowthMode, ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (mode === 'exponential') return clamped * clamped;
    if (mode === 'limited') return Math.min(1, clamped * 1.6);
    return clamped;
  };

  const loadSessions = async () => {
    setStatus('loading');
    try {
      const sessions = await getCogitaLiveRevisionSessionsByRevision({ libraryId, revisionId });
      setItems(sessions);
      setStatus('ready');
    } catch {
      setItems([]);
      setStatus('error');
    }
  };

  useEffect(() => {
    getCogitaRevision({ libraryId, revisionId })
      .then((revision) => {
        setRevisionName(revision.name);
        if (!formTitle.trim()) {
          setFormTitle(revision.name);
        }
      })
      .catch(() => setRevisionName(revisionId));
  }, [formTitle, libraryId, revisionId]);

  useEffect(() => {
    void loadSessions();
  }, [libraryId, revisionId]);

  const selectedItem = useMemo(
    () => (sessionId ? items.find((item) => item.sessionId === sessionId) ?? null : null),
    [items, sessionId]
  );

  useEffect(() => {
    if (!sessionId || (mode !== 'detail' && mode !== 'edit')) {
      setAttachedSession(null);
      setDetailStatus('idle');
      return;
    }

    let canceled = false;
    setDetailStatus('loading');
    attachCogitaLiveRevisionSession({ libraryId, sessionId })
      .then((session) => {
        if (canceled) return;
        setAttachedSession(session);
        setReloginParticipantId(null);
        setFormTitle(selectedItem?.title ?? revisionName);
        setFormSessionMode((session.sessionMode === 'asynchronous' ? 'asynchronous' : 'simultaneous') as 'simultaneous' | 'asynchronous');
        setFormLiveRules(parseLiveRules(session.sessionSettings));
        setShowSpecialSettings(false);
        setDetailStatus('ready');
      })
      .catch(() => {
        if (canceled) return;
        setAttachedSession(null);
        setReloginParticipantId(null);
        setDetailStatus('error');
      });

    return () => {
      canceled = true;
    };
  }, [libraryId, mode, revisionName, selectedItem?.title, sessionId]);

  useEffect(() => {
    if (mode !== 'create') return;
    setMessage(null);
    const defaultPreset = getLivePresetById('balanced_duel');
    if (defaultPreset) {
      setFormPresetId(defaultPreset.id);
      setFormSessionMode(defaultPreset.sessionMode);
      setFormLiveRules(defaultPreset.rules);
    } else {
      setFormSessionMode('simultaneous');
      setFormLiveRules(DEFAULT_LIVE_RULES);
      setFormPresetId('custom');
    }
    setShowSpecialSettings(false);
    setFormTitle((previous) => (previous.trim() ? previous : revisionName || copy.cogita.library.revision.live.hostKicker));
  }, [copy.cogita.library.revision.live.hostKicker, mode, revisionName]);

  const applyPreset = (presetId: LivePresetId) => {
    setFormPresetId(presetId);
    if (presetId === 'custom') return;
    const preset = getLivePresetById(presetId);
    if (!preset) return;
    setFormSessionMode(preset.sessionMode);
    setFormLiveRules(preset.rules);
  };

  const settingsImpactLines = useMemo(() => {
    const growthLabel = (mode: BonusGrowthMode) =>
      mode === 'exponential' ? liveCopy.optionExponential : mode === 'limited' ? liveCopy.optionLimited : liveCopy.optionLinear;
    const firstActionLabel =
      formLiveRules.firstAnswerAction === 'start_timer'
        ? liveCopy.optionStartTimer
        : formLiveRules.firstAnswerAction === 'next'
          ? liveCopy.optionRevealNext
        : formLiveRules.firstAnswerAction === 'reveal'
          ? liveCopy.optionRevealScore
          : liveCopy.optionDoNothing;
    const allAnsweredLabel =
      formLiveRules.allAnsweredAction === 'next'
        ? liveCopy.optionRevealNext
        : formLiveRules.allAnsweredAction === 'reveal'
          ? liveCopy.optionRevealScore
          : liveCopy.optionDoNothing;
    const expireLabel =
      formLiveRules.actionTimer.onExpire === 'next'
        ? liveCopy.optionRevealNext
        : formLiveRules.actionTimer.onExpire === 'reveal'
          ? liveCopy.optionRevealScore
          : liveCopy.optionDoNothing;
    const roundExpireLabel =
      formLiveRules.roundTimer.onExpire === 'next'
        ? liveCopy.optionRevealNext
        : formLiveRules.roundTimer.onExpire === 'reveal'
          ? liveCopy.optionRevealScore
          : liveCopy.optionDoNothing;

    const elapsedOne = Math.max(1, Math.round(formLiveRules.bonusTimer.seconds / 3));
    const elapsedTwo = Math.max(elapsedOne + 1, Math.round((2 * formLiveRules.bonusTimer.seconds) / 3));
    const ratioOne = Math.max(0, 1 - elapsedOne / Math.max(1, formLiveRules.bonusTimer.seconds));
    const ratioTwo = Math.max(0, 1 - elapsedTwo / Math.max(1, formLiveRules.bonusTimer.seconds));
    const bonusOne = clampInt(growthRatio(formLiveRules.speedBonus.growth, ratioOne) * formLiveRules.speedBonus.maxPoints, 0, 500000);
    const bonusTwo = clampInt(growthRatio(formLiveRules.speedBonus.growth, ratioTwo) * formLiveRules.speedBonus.maxPoints, 0, 500000);
    const hasFirstBonus = formLiveRules.scoring.firstCorrectBonus > 0;
    const hasSpeedBonus = formLiveRules.speedBonus.enabled && formLiveRules.speedBonus.maxPoints > 0;
    const hasStreakBonus = formLiveRules.scoring.streakBaseBonus > 0;
    const minPoints = formLiveRules.scoring.baseCorrect;
    const maxPoints =
      formLiveRules.scoring.baseCorrect +
      (hasFirstBonus ? formLiveRules.scoring.firstCorrectBonus : 0) +
      (hasSpeedBonus ? formLiveRules.speedBonus.maxPoints : 0) +
      (hasStreakBonus ? formLiveRules.scoring.streakBaseBonus : 0);

    const streakProgressBonus = (streakCount: number) => {
      const maxBonus = Math.max(0, formLiveRules.scoring.streakBaseBonus);
      const extraCount = Math.max(0, streakCount - 1);
      if (maxBonus === 0 || extraCount === 0) return 0;
      const fullAfter = Math.max(1, formLiveRules.scoring.streakLimit);
      const progress = Math.max(0, Math.min(1, extraCount / fullAfter));
      return clampInt(growthRatio(formLiveRules.scoring.streakGrowth, progress) * maxBonus, 0, 500000);
    };
    const streakOne = 2;
    const streakTwo = Math.max(3, Math.round((formLiveRules.scoring.streakLimit + 2) / 2));
    const streakThree = Math.max(streakTwo + 1, formLiveRules.scoring.streakLimit + 1);
    const streakBonusOne = streakProgressBonus(streakOne);
    const streakBonusTwo = streakProgressBonus(streakTwo);
    const streakBonusThree = streakProgressBonus(streakThree);

    const lines: string[] = [];
    const paragraphOneParts: string[] = [];
    paragraphOneParts.push(isAsyncSession ? liveCopy.summaryTypeLineAsync : liveCopy.summaryTypeLineSync);
    paragraphOneParts.push(
      liveCopy.summaryBasePointsDetailed
        .replace('{base}', String(formLiveRules.scoring.baseCorrect))
        .replace('{unit}', liveCopy.scoreUnit)
    );
    if (hasFirstBonus || hasSpeedBonus || hasStreakBonus) {
      const activeBonusSentences: string[] = [];
      if (hasFirstBonus) {
        activeBonusSentences.push(
          liveCopy.summaryBonusFirst.replace('{first}', String(formLiveRules.scoring.firstCorrectBonus))
        );
      }
      if (hasSpeedBonus) {
        activeBonusSentences.push(
          liveCopy.summaryBonusSpeed.replace('{max}', String(formLiveRules.speedBonus.maxPoints))
        );
      }
      if (hasStreakBonus) {
        activeBonusSentences.push(
          liveCopy.summaryStreak
            .replace('{growth}', growthLabel(formLiveRules.scoring.streakGrowth))
            .replace('{max}', String(formLiveRules.scoring.streakBaseBonus))
            .replace('{limit}', String(formLiveRules.scoring.streakLimit))
        );
      }
      paragraphOneParts.push(activeBonusSentences.join(' '));
    } else {
      paragraphOneParts.push(liveCopy.summaryBonusesNone);
    }
    if (formLiveRules.scoring.wrongAnswerPenalty > 0) {
      paragraphOneParts.push(
        liveCopy.summaryWrongPenalty
          .replace('{penalty}', String(formLiveRules.scoring.wrongAnswerPenalty))
          .replace('{unit}', liveCopy.scoreUnit)
      );
    } else {
      paragraphOneParts.push(liveCopy.summaryNoWrongPenalty);
    }
    if (formLiveRules.scoring.firstWrongPenalty > 0) {
      paragraphOneParts.push(
        liveCopy.summaryFirstWrongPenalty
          .replace('{penalty}', String(formLiveRules.scoring.firstWrongPenalty))
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
      hasSpeedBonus && formLiveRules.bonusTimer.enabled
        ? liveCopy.summaryBonusTimerDetail
            .replace('{start}', formLiveRules.bonusTimer.startMode === 'round_start' ? liveCopy.bonusTimerStartRound : liveCopy.bonusTimerStartAfterFirst)
            .replace('{startBonus}', String(formLiveRules.speedBonus.maxPoints))
            .replace('{midOneSeconds}', String(elapsedOne))
            .replace('{midOneBonus}', String(bonusOne))
            .replace('{midTwoSeconds}', String(elapsedTwo))
            .replace('{midTwoBonus}', String(bonusTwo))
            .replace('{endSeconds}', String(formLiveRules.bonusTimer.seconds))
        : liveCopy.summaryBonusTimerDisabled
    );
    paragraphTwoParts.push(
      hasStreakBonus
        ? liveCopy.summaryStreakDetail
            .replace('{growth}', growthLabel(formLiveRules.scoring.streakGrowth))
            .replace('{max}', String(formLiveRules.scoring.streakBaseBonus))
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

    const paragraphThreeParts: string[] = [];
    paragraphThreeParts.push(
      formLiveRules.roundTimer.enabled
        ? liveCopy.summaryRoundTimerDetail
            .replace('{seconds}', String(formLiveRules.roundTimer.seconds))
            .replace('{expireAction}', roundExpireLabel)
        : liveCopy.summaryRoundTimerDisabled
    );
    paragraphThreeParts.push(
      liveCopy.summaryAllAnsweredDetail.replace('{allAction}', allAnsweredLabel)
    );
    if (formLiveRules.firstAnswerAction === 'start_timer' && formLiveRules.actionTimer.enabled) {
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

    return lines.filter((line) => line.trim().length > 0);
  }, [formLiveRules, isAsyncSession, liveCopy]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item) => values.add(item.status));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = `${item.title ?? ''} ${item.sessionId} ${item.status}`.toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, statusFilter]);

  const createSession = async () => {
    setBusyAction('create');
    setMessage(null);
    try {
      const created = await createCogitaLiveRevisionSession({
        libraryId,
        revisionId,
        title: formTitle.trim() || null,
        sessionMode: formSessionMode,
        hostViewMode: FIXED_HOST_VIEW_MODE,
        participantViewMode: FIXED_PARTICIPANT_VIEW_MODE,
        sessionSettings: withLiveRulesSettings(formLiveRules)
      });
      await loadSessions();
      onCreated?.(created.sessionId);
    } catch {
      setMessage(copy.cogita.library.revision.live.createSessionError);
    } finally {
      setBusyAction('none');
    }
  };

  const saveSession = async () => {
    if (!sessionId) return;
    setBusyAction('save');
    setMessage(null);
    try {
      await updateCogitaLiveRevisionSession({
        libraryId,
        revisionId,
        sessionId,
        title: formTitle.trim() || null,
        sessionMode: formSessionMode,
        hostViewMode: FIXED_HOST_VIEW_MODE,
        participantViewMode: FIXED_PARTICIPANT_VIEW_MODE,
        sessionSettings: withLiveRulesSettings(formLiveRules)
      });
      await loadSessions();
      if (mode === 'edit') {
        onRequestOverview?.(sessionId);
      }
    } catch {
      setMessage(copy.cogita.library.revision.shareError);
    } finally {
      setBusyAction('none');
    }
  };

  const joinWallUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/live-wall/login/${encodeURIComponent(attachedSession.code)}`
      : '';
  const publicJoinUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/public/live-revision/${encodeURIComponent(attachedSession.code)}`
      : '';
  const presenterUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/live-wall/public/${encodeURIComponent(attachedSession.code)}`
      : '';
  const hostUrl =
    attachedSession?.sessionId && attachedSession?.hostSecret && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/live-wall/host/${encodeURIComponent(libraryId)}/${encodeURIComponent(revisionId)}?sessionId=${encodeURIComponent(attachedSession.sessionId)}&hostSecret=${encodeURIComponent(attachedSession.hostSecret)}&code=${encodeURIComponent(attachedSession.code)}`
      : '';
  const participantScoreById = useMemo(() => {
    const map = new Map<string, number>();
    (attachedSession?.scoreboard ?? []).forEach((row) => map.set(row.participantId, row.score));
    return map;
  }, [attachedSession?.scoreboard]);
  const detailParticipants = useMemo(
    () =>
      (attachedSession?.participants ?? [])
        .map((participant) => ({
          ...participant,
          score: participantScoreById.get(participant.participantId) ?? participant.score ?? 0
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.displayName.localeCompare(b.displayName);
        }),
    [attachedSession?.participants, participantScoreById]
  );
  const reloginParticipant = useMemo(
    () => detailParticipants.find((participant) => participant.participantId === reloginParticipantId) ?? null,
    [detailParticipants, reloginParticipantId]
  );
  const reloginUrl =
    reloginParticipant && publicJoinUrl
      ? `${publicJoinUrl}?name=${encodeURIComponent(reloginParticipant.displayName)}`
      : '';

  return (
    <CogitaShell
      copy={copy}
      authLabel={authLabel}
      showProfileMenu={showProfileMenu}
      onProfileNavigate={onProfileNavigate}
      onToggleSecureMode={onToggleSecureMode}
      onLogout={onLogout}
      secureMode={secureMode}
      onNavigate={onNavigate}
      language={language}
      onLanguageChange={onLanguageChange}
    >
      <section className="cogita-library-dashboard" data-mode="list">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                {mode === 'search' ? (
                  <>
                    <div className="cogita-library-controls">
                      <div className="cogita-library-search">
                        <p className="cogita-user-kicker">{copy.cogita.workspace.infoMode.search}</p>
                        <div className="cogita-search-field">
                          <input
                            type="text"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={copy.cogita.workspace.revisionForm.namePlaceholder}
                          />
                        </div>
                        <label className="cogita-field">
                          <span>{copy.cogita.library.revision.live.statusLabel}</span>
                          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="all">{copy.cogita.library.infoTypes.any}</option>
                            {statusOptions.map((value) => (
                              <option key={`status:${value}`} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="cogita-card-count">
                      <span>{`${filtered.length} / ${items.length}`}</span>
                      <span>
                        {status === 'loading'
                          ? copy.cogita.library.collections.loading
                          : status === 'error'
                            ? copy.cogita.library.revision.shareError
                            : copy.cogita.library.collections.ready}
                      </span>
                    </div>

                    <div className="cogita-card-list" data-view="list">
                      {filtered.length ? (
                        filtered.map((item) => (
                          <div key={item.sessionId} className="cogita-card-item">
                            <a
                              className="cogita-card-select"
                              href={`${baseHref}/revisions/${encodeURIComponent(revisionId)}/live-sessions/${encodeURIComponent(item.sessionId)}`}
                              onClick={(event) => {
                                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                                  return;
                                }
                                event.preventDefault();
                                onOpenSession?.(item.sessionId);
                              }}
                            >
                              <div className="cogita-card-type">{item.status}</div>
                              <h3 className="cogita-card-title">{item.title || item.sessionId}</h3>
                              <p className="cogita-card-subtitle">
                                {copy.cogita.library.revision.live.participantsTitle}: {item.participantCount}
                              </p>
                            </a>
                          </div>
                        ))
                      ) : (
                        <div className="cogita-card-empty">
                          <p>{copy.cogita.library.revision.shareListEmpty}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}

                {(mode === 'create' || mode === 'edit') ? (
                  <section className="cogita-library-detail">
                    <div className="cogita-detail-header">
                      <div>
                        <p className="cogita-user-kicker">{copy.cogita.workspace.revisions.live}</p>
                        <h3 className="cogita-detail-title">
                          {mode === 'create' ? copy.cogita.workspace.infoMode.create : copy.cogita.workspace.infoActions.edit}
                        </h3>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)', gap: '1rem', alignItems: 'start' }}>
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        <label className="cogita-field">
                          <span>{copy.cogita.library.revision.nameLabel}</span>
                          <input value={formTitle} onChange={(event) => setFormTitle(event.target.value)} />
                        </label>
                        <label className="cogita-field">
                          <span>{liveCopy.presetLabel}</span>
                          <select value={formPresetId} onChange={(event) => applyPreset(event.target.value as LivePresetId)}>
                            {presetOptions.map((option) => (
                              <option key={`live-preset:${option.value}`} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="cogita-form-actions" style={{ justifyContent: 'flex-start' }}>
                          <button type="button" className="ghost" onClick={() => setShowSpecialSettings((previous) => !previous)}>
                            {(showSpecialSettings ? copy.cogita.library.revision.hideSectionAction : copy.cogita.library.revision.showSectionAction)} {copy.cogita.library.revision.specificSettingsTitle}
                          </button>
                        </div>
                        {showSpecialSettings ? (
                          <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div className="cogita-library-panel" style={{ margin: 0 }}>
                              <p className="cogita-user-kicker">{copy.cogita.library.revision.commonSettingsTitle}</p>
                              <div className="cogita-live-rules-grid">
                                <label className="cogita-field">
                                  <span>{liveCopy.basePointsLabel}</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={500000}
                                    value={formLiveRules.scoring.baseCorrect}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        scoring: { ...previous.scoring, baseCorrect: clampInt(Number(event.target.value), 0, 500000) }
                                      }))
                                    }
                                  />
                                </label>
                                <label className="cogita-field">
                                  <span>{liveCopy.firstCorrectBonusLabel}</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={500000}
                                    value={formLiveRules.scoring.firstCorrectBonus}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        scoring: { ...previous.scoring, firstCorrectBonus: clampInt(Number(event.target.value), 0, 500000) }
                                      }))
                                    }
                                  />
                                </label>
                                <label className="cogita-field">
                                  <span>{liveCopy.wrongAnswerPenaltyLabel}</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={500000}
                                    value={formLiveRules.scoring.wrongAnswerPenalty}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        scoring: { ...previous.scoring, wrongAnswerPenalty: clampInt(Number(event.target.value), 0, 500000) }
                                      }))
                                    }
                                  />
                                </label>
                                <label className="cogita-field">
                                  <span>{liveCopy.firstWrongPenaltyLabel}</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={500000}
                                    value={formLiveRules.scoring.firstWrongPenalty}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        scoring: { ...previous.scoring, firstWrongPenalty: clampInt(Number(event.target.value), 0, 500000) }
                                      }))
                                    }
                                  />
                                </label>
                              </div>
                            </div>

                            {!isAsyncSession ? (
                              <div className="cogita-library-panel" style={{ margin: 0 }}>
                                <p className="cogita-user-kicker">{liveCopy.roundTimerLabel}</p>
                                <div className="cogita-live-rules-grid">
                                  <label className="cogita-field">
                                    <span>{liveCopy.roundTimerEnabledLabel}</span>
                                    <select
                                      value={formLiveRules.roundTimer.enabled ? 'yes' : 'no'}
                                      onChange={(event) =>
                                        setFormLiveRules((previous) => ({
                                          ...previous,
                                          roundTimer: { ...previous.roundTimer, enabled: event.target.value === 'yes' }
                                        }))
                                      }
                                    >
                                      <option value="yes">{liveCopy.optionYes}</option>
                                      <option value="no">{liveCopy.optionNo}</option>
                                    </select>
                                  </label>
                                  {formLiveRules.roundTimer.enabled ? (
                                    <>
                                      <label className="cogita-field">
                                        <span>{liveCopy.roundTimerSecondsLabel}</span>
                                        <input
                                          type="number"
                                          min={3}
                                          max={600}
                                          value={formLiveRules.roundTimer.seconds}
                                          onChange={(event) =>
                                            setFormLiveRules((previous) => ({
                                              ...previous,
                                              roundTimer: { ...previous.roundTimer, seconds: clampInt(Number(event.target.value), 3, 600) }
                                            }))
                                          }
                                        />
                                      </label>
                                      <label className="cogita-field">
                                        <span>{liveCopy.roundTimerExpireLabel}</span>
                                        <select
                                          value={formLiveRules.roundTimer.onExpire}
                                          onChange={(event) =>
                                            setFormLiveRules((previous) => ({
                                              ...previous,
                                              roundTimer: { ...previous.roundTimer, onExpire: event.target.value as TimerExpireAction }
                                            }))
                                          }
                                        >
                                          <option value="reveal">{liveCopy.optionRevealScore}</option>
                                          <option value="next">{liveCopy.optionRevealNext}</option>
                                        </select>
                                      </label>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {!isAsyncSession ? (
                              <div className="cogita-library-panel" style={{ margin: 0 }}>
                                <p className="cogita-user-kicker">{liveCopy.actionTimerLabel}</p>
                                <div className="cogita-live-rules-grid">
                                  <label className="cogita-field">
                                    <span>{liveCopy.onFirstAnswerLabel}</span>
                                    <select
                                      value={formLiveRules.firstAnswerAction}
                                      onChange={(event) =>
                                        setFormLiveRules((previous) => {
                                          const nextFirstAction = event.target.value as FirstAnswerAction;
                                          return {
                                            ...previous,
                                            firstAnswerAction: nextFirstAction,
                                            actionTimer: {
                                              ...previous.actionTimer,
                                              enabled: nextFirstAction === 'start_timer'
                                            }
                                          };
                                        })
                                      }
                                    >
                                      <option value="none">{liveCopy.optionDoNothing}</option>
                                      <option value="start_timer">{liveCopy.optionStartTimer}</option>
                                      <option value="reveal">{liveCopy.optionRevealScore}</option>
                                      <option value="next">{liveCopy.optionRevealNext}</option>
                                    </select>
                                  </label>
                                  <label className="cogita-field">
                                    <span>{liveCopy.onAllAnsweredLabel}</span>
                                    <select
                                      value={formLiveRules.allAnsweredAction}
                                      onChange={(event) =>
                                        setFormLiveRules((previous) => ({
                                          ...previous,
                                          allAnsweredAction: event.target.value as AllAnsweredAction
                                        }))
                                      }
                                    >
                                      <option value="none">{liveCopy.optionDoNothing}</option>
                                      <option value="reveal">{liveCopy.optionRevealScore}</option>
                                      <option value="next">{liveCopy.optionRevealNext}</option>
                                    </select>
                                  </label>
                                  {formLiveRules.firstAnswerAction === 'start_timer' ? (
                                    <>
                                      <label className="cogita-field">
                                        <span>{liveCopy.timerSecondsLabel}</span>
                                        <input
                                          type="number"
                                          min={3}
                                          max={600}
                                          value={formLiveRules.actionTimer.seconds}
                                          onChange={(event) =>
                                            setFormLiveRules((previous) => ({
                                              ...previous,
                                              actionTimer: { ...previous.actionTimer, seconds: clampInt(Number(event.target.value), 3, 600) }
                                            }))
                                          }
                                        />
                                      </label>
                                      <label className="cogita-field">
                                        <span>{liveCopy.onTimerExpiredLabel}</span>
                                        <select
                                          value={formLiveRules.actionTimer.onExpire}
                                          onChange={(event) =>
                                            setFormLiveRules((previous) => ({
                                              ...previous,
                                              actionTimer: { ...previous.actionTimer, onExpire: event.target.value as TimerExpireAction }
                                            }))
                                          }
                                        >
                                          <option value="reveal">{liveCopy.optionRevealScore}</option>
                                          <option value="next">{liveCopy.optionRevealNext}</option>
                                        </select>
                                      </label>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {!isAsyncSession ? (
                              <div className="cogita-library-panel" style={{ margin: 0 }}>
                                <p className="cogita-user-kicker">{liveCopy.bonusTimerLabel}</p>
                                <div className="cogita-live-rules-grid">
                                  <label className="cogita-field">
                                    <span>{liveCopy.speedBonusEnabledLabel}</span>
                                    <select
                                      value={formLiveRules.speedBonus.enabled ? 'yes' : 'no'}
                                      onChange={(event) =>
                                        setFormLiveRules((previous) => ({
                                          ...previous,
                                          speedBonus: { ...previous.speedBonus, enabled: event.target.value === 'yes' },
                                          bonusTimer: { ...previous.bonusTimer, enabled: event.target.value === 'yes' }
                                        }))
                                      }
                                    >
                                      <option value="yes">{liveCopy.optionYes}</option>
                                      <option value="no">{liveCopy.optionNo}</option>
                                    </select>
                                  </label>
                                  {formLiveRules.speedBonus.enabled ? (
                                    <>
                                      <label className="cogita-field">
                                        <span>{liveCopy.bonusTimerStartLabel}</span>
                                        <select
                                          value={formLiveRules.bonusTimer.startMode}
                                          onChange={(event) =>
                                            setFormLiveRules((previous) => ({
                                              ...previous,
                                              bonusTimer: { ...previous.bonusTimer, enabled: true, startMode: event.target.value === 'round_start' ? 'round_start' : 'first_answer' }
                                            }))
                                          }
                                        >
                                          <option value="first_answer">{liveCopy.bonusTimerStartAfterFirst}</option>
                                          <option value="round_start">{liveCopy.bonusTimerStartRound}</option>
                                        </select>
                                      </label>
                                      <label className="cogita-field">
                                        <span>{liveCopy.bonusTimerSecondsLabel}</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={600}
                                          value={formLiveRules.bonusTimer.seconds}
                                          onChange={(event) =>
                                            setFormLiveRules((previous) => ({
                                              ...previous,
                                              bonusTimer: { ...previous.bonusTimer, enabled: true, seconds: clampInt(Number(event.target.value), 1, 600) }
                                            }))
                                          }
                                        />
                                      </label>
                                      <label className="cogita-field">
                                        <span>{liveCopy.speedBonusMaxLabel}</span>
                                        <input
                                          type="number"
                                          min={0}
                                          max={500000}
                                          value={formLiveRules.speedBonus.maxPoints}
                                          onChange={(event) =>
                                            setFormLiveRules((previous) => ({
                                              ...previous,
                                              speedBonus: { ...previous.speedBonus, enabled: true, maxPoints: clampInt(Number(event.target.value), 0, 500000) },
                                              bonusTimer: { ...previous.bonusTimer, enabled: true }
                                            }))
                                          }
                                        />
                                      </label>
                                      <label className="cogita-field">
                                        <span>{liveCopy.speedGrowthLabel}</span>
                                        <select
                                          value={formLiveRules.speedBonus.growth}
                                          onChange={(event) =>
                                            setFormLiveRules((previous) => ({
                                              ...previous,
                                              speedBonus: { ...previous.speedBonus, growth: event.target.value as BonusGrowthMode },
                                              bonusTimer: { ...previous.bonusTimer, enabled: true }
                                            }))
                                          }
                                        >
                                          <option value="linear">{liveCopy.optionLinear}</option>
                                          <option value="exponential">{liveCopy.optionExponential}</option>
                                          <option value="limited">{liveCopy.optionLimited}</option>
                                        </select>
                                      </label>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            <div className="cogita-library-panel" style={{ margin: 0 }}>
                              <p className="cogita-user-kicker">{liveCopy.streakLabel}</p>
                              <div className="cogita-live-rules-grid">
                                <label className="cogita-field">
                                  <span>{liveCopy.streakBonusEnabledLabel}</span>
                                  <select
                                    value={formLiveRules.scoring.streakBaseBonus > 0 ? 'yes' : 'no'}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        scoring: {
                                          ...previous.scoring,
                                          streakBaseBonus: event.target.value === 'yes' ? (previous.scoring.streakBaseBonus > 0 ? previous.scoring.streakBaseBonus : 1000) : 0
                                        }
                                      }))
                                    }
                                  >
                                    <option value="yes">{liveCopy.optionYes}</option>
                                    <option value="no">{liveCopy.optionNo}</option>
                                  </select>
                                </label>
                                {formLiveRules.scoring.streakBaseBonus > 0 ? (
                                  <>
                                    <label className="cogita-field">
                                      <span>{liveCopy.streakBaseBonusLabel}</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={500000}
                                        value={formLiveRules.scoring.streakBaseBonus}
                                        onChange={(event) =>
                                          setFormLiveRules((previous) => ({
                                            ...previous,
                                            scoring: { ...previous.scoring, streakBaseBonus: clampInt(Number(event.target.value), 0, 500000) }
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="cogita-field">
                                      <span>{liveCopy.streakGrowthLabel}</span>
                                      <select
                                        value={formLiveRules.scoring.streakGrowth}
                                        onChange={(event) =>
                                          setFormLiveRules((previous) => ({
                                            ...previous,
                                            scoring: { ...previous.scoring, streakGrowth: event.target.value as BonusGrowthMode }
                                          }))
                                        }
                                      >
                                        <option value="linear">{liveCopy.optionLinear}</option>
                                        <option value="exponential">{liveCopy.optionExponential}</option>
                                        <option value="limited">{liveCopy.optionLimited}</option>
                                      </select>
                                    </label>
                                    <label className="cogita-field">
                                      <span>{liveCopy.streakLimitLabel}</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={200}
                                        value={formLiveRules.scoring.streakLimit}
                                        onChange={(event) =>
                                          setFormLiveRules((previous) => ({
                                            ...previous,
                                            scoring: { ...previous.scoring, streakLimit: clampInt(Number(event.target.value), 1, 200) }
                                          }))
                                        }
                                      />
                                    </label>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="cogita-library-panel" style={{ margin: 0 }}>
                        <section className="cogita-library-detail">
                          <div className="cogita-detail-header">
                            <div>
                              <p className="cogita-user-kicker">{copy.cogita.workspace.revisions.live}</p>
                              <h3 className="cogita-detail-title">{liveCopy.summaryTitle}</h3>
                            </div>
                          </div>
                          <div className="cogita-detail-body">
                            {settingsImpactLines.map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                          </div>
                        </section>
                      </div>
                    </div>
                    {message ? <p className="cogita-form-error">{message}</p> : null}
                    <div className="cogita-form-actions">
                      {mode === 'create' ? (
                        <button type="button" className="cta" onClick={() => void createSession()} disabled={busyAction !== 'none'}>
                          {copy.cogita.workspace.infoMode.create}
                        </button>
                      ) : (
                        <button type="button" className="cta" onClick={() => void saveSession()} disabled={busyAction !== 'none' || !sessionId}>
                          {copy.cogita.workspace.infoActions.edit}
                        </button>
                      )}
                    </div>
                  </section>
                ) : null}

                {mode === 'detail' ? (
                  <section className="cogita-library-detail">
                    <div className="cogita-detail-header">
                      <div>
                        <p className="cogita-user-kicker">{copy.cogita.workspace.infoActions.overview}</p>
                        <h3 className="cogita-detail-title">{selectedItem?.title || sessionId || ''}</h3>
                      </div>
                    </div>
                    {detailStatus === 'loading' ? <p>{copy.cogita.library.collections.loading}</p> : null}
                    {detailStatus === 'error' ? <p className="cogita-form-error">{copy.cogita.library.revision.shareError}</p> : null}
                    {detailStatus === 'ready' && attachedSession ? (
                      <>
                        <div className="cogita-library-panel cogita-live-session-overview-panel">
                          <div className="cogita-info-tree">
                            <div className="cogita-info-tree-row">
                              <div className="cogita-info-tree-key">{copy.cogita.library.revision.live.sessionModeLabel}</div>
                              <div className="cogita-info-tree-value">
                                {attachedSession.sessionMode === 'asynchronous'
                                  ? copy.cogita.library.revision.live.modeAsynchronous
                                  : copy.cogita.library.revision.live.modeSimultaneous}
                              </div>
                            </div>
                            <div className="cogita-info-tree-row">
                              <div className="cogita-info-tree-key">{copy.cogita.library.revision.live.statusLabel}</div>
                              <div className="cogita-info-tree-value">{selectedItem?.status ?? attachedSession.status}</div>
                            </div>
                            <div className="cogita-info-tree-row">
                              <div className="cogita-info-tree-key">{copy.cogita.library.revision.live.participantsTitle}</div>
                              <div className="cogita-info-tree-value">{attachedSession.participants.length}</div>
                            </div>
                            <div className="cogita-info-tree-row">
                              <div className="cogita-info-tree-key">{copy.cogita.library.revision.live.joinCodeLabel}</div>
                              <div className="cogita-info-tree-value">{attachedSession.code}</div>
                            </div>
                          </div>
                        </div>

                        <div className="cogita-library-panel cogita-live-session-overview-panel">
                          <div className="cogita-detail-header">
                            <div>
                              <p className="cogita-user-kicker">{copy.cogita.library.revision.live.participantsTitle}</p>
                            </div>
                          </div>
                          <div className="cogita-share-list">
                            {detailParticipants.length ? (
                              detailParticipants.map((participant) => (
                                <div key={participant.participantId} className="cogita-share-row">
                                  <div>
                                    <strong>{participant.displayName}</strong>
                                    <div className="cogita-share-meta">
                                      {copy.cogita.library.revision.live.participantPointsLabel}: {participant.score} {copy.cogita.library.revision.live.scoreUnit}
                                    </div>
                                    <div className="cogita-share-meta">
                                      {participant.isConnected
                                        ? copy.cogita.library.revision.live.connectedLabel
                                        : copy.cogita.library.revision.live.disconnectedLabel}
                                    </div>
                                  </div>
                                  <div className="cogita-share-actions">
                                    <button
                                      type="button"
                                      className="ghost"
                                      onClick={() =>
                                        setReloginParticipantId((previous) =>
                                          previous === participant.participantId ? null : participant.participantId
                                        )
                                      }
                                    >
                                      {copy.cogita.library.revision.live.reloginQrAction}
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p>{copy.cogita.library.revision.live.noParticipants}</p>
                            )}
                          </div>
                        </div>

                        {reloginParticipant && reloginUrl ? (
                          <div className="cogita-library-panel cogita-live-session-overview-panel">
                            <div className="cogita-detail-header">
                              <div>
                                <p className="cogita-user-kicker">{copy.cogita.library.revision.live.reloginQrAction}</p>
                                <h3 className="cogita-detail-title">{reloginParticipant.displayName}</h3>
                              </div>
                            </div>
                            <div className="cogita-live-relogin-qr">
                              <div className="cogita-live-relogin-qr-code">
                                <QRCodeSVG value={reloginUrl} size={180} marginSize={2} />
                              </div>
                              <div className="cogita-field">
                                <span>{copy.cogita.library.revision.live.joinUrlLabel}</span>
                                <input readOnly value={reloginUrl} />
                              </div>
                              <p className="cogita-help">{copy.cogita.library.revision.live.reloginQrHelp}</p>
                            </div>
                          </div>
                        ) : null}

                        <div className="cogita-library-panel cogita-live-session-overview-panel">
                          <div className="cogita-detail-header">
                            <div>
                              <p className="cogita-user-kicker">{copy.cogita.library.revision.live.detailLaunchTitle}</p>
                            </div>
                          </div>
                          <div className="cogita-form-actions">
                            {joinWallUrl ? (
                              <a className="ghost" href={`${joinWallUrl}?layout=fullscreen`} target="_blank" rel="noreferrer">
                                {copy.cogita.library.revision.live.openLoginWallAction}
                              </a>
                            ) : null}
                            {hostUrl ? (
                              <a className="ghost" href={`${hostUrl}&layout=fullscreen`} target="_blank" rel="noreferrer">
                                {copy.cogita.library.revision.live.openHostWallAction}
                              </a>
                            ) : null}
                            {presenterUrl ? (
                              <a className="ghost" href={`${presenterUrl}?layout=fullscreen`} target="_blank" rel="noreferrer">
                                {copy.cogita.library.revision.live.openScreenWallAction}
                              </a>
                            ) : null}
                          </div>
                        </div>

                      </>
                    ) : null}
                  </section>
                ) : null}
              </div>

              {mode === 'search' ? (
                <div className="cogita-library-panel">
                  <section className="cogita-library-detail">
                    <div className="cogita-detail-header">
                      <div>
                        <p className="cogita-user-kicker">{copy.cogita.workspace.revisions.live}</p>
                        <h3 className="cogita-detail-title">
                          {mode === 'search' ? copy.cogita.workspace.infoMode.search : copy.cogita.workspace.infoActions.overview}
                        </h3>
                      </div>
                    </div>
                    <div className="cogita-detail-body">
                      <p>{liveCopy.hostTitle}</p>
                      <p>{liveCopy.participantsTitle}</p>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
