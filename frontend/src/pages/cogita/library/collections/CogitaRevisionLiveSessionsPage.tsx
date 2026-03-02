import { useEffect, useMemo, useState } from 'react';
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
  detectLivePreset,
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
  const [revisionName, setRevisionName] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [items, setItems] = useState<CogitaLiveRevisionSessionListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [formTitle, setFormTitle] = useState('');
  const [formSessionMode, setFormSessionMode] = useState<'simultaneous' | 'asynchronous'>('simultaneous');
  const [formHostViewMode, setFormHostViewMode] = useState<'panel' | 'question' | 'score'>('panel');
  const [formParticipantViewMode, setFormParticipantViewMode] = useState<'question' | 'score' | 'fullscreen'>('question');
  const [formLiveRules, setFormLiveRules] = useState<LiveRules>(DEFAULT_LIVE_RULES);
  const [formPresetId, setFormPresetId] = useState<LivePresetId>('balanced_duel');
  const [showSpecialSettings, setShowSpecialSettings] = useState(false);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attachedSession, setAttachedSession] = useState<CogitaLiveRevisionSession | null>(null);
  const [busyAction, setBusyAction] = useState<'none' | 'create' | 'save'>('none');
  const [message, setMessage] = useState<string | null>(null);

  const baseHref = `/#/cogita/library/${libraryId}`;
  const liveCopy = copy.cogita.library.revision.live;
  const presetDefinitions = useMemo(() => getLivePresets(), []);
  const presetLabelById = (presetId: LivePresetId) => {
    if (presetId === 'balanced_duel') return liveCopy.presetBalancedDuel;
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
  const bonusUsage = useMemo<'all' | 'none' | 'first' | 'speed' | 'streak'>(() => {
    const hasFirst = formLiveRules.scoring.firstCorrectBonus > 0;
    const hasSpeed = formLiveRules.speedBonus.enabled && formLiveRules.speedBonus.maxPoints > 0;
    const hasStreak = formLiveRules.scoring.streakBaseBonus > 0;
    if (!hasFirst && !hasSpeed && !hasStreak) return 'none';
    if (hasFirst && !hasSpeed && !hasStreak) return 'first';
    if (!hasFirst && hasSpeed && !hasStreak) return 'speed';
    if (!hasFirst && !hasSpeed && hasStreak) return 'streak';
    return 'all';
  }, [formLiveRules.scoring.firstCorrectBonus, formLiveRules.scoring.streakBaseBonus, formLiveRules.speedBonus.enabled, formLiveRules.speedBonus.maxPoints]);

  const applyBonusUsage = (value: 'all' | 'none' | 'first' | 'speed' | 'streak') => {
    setFormLiveRules((previous) => {
      if (value === 'none') {
        return {
          ...previous,
          scoring: { ...previous.scoring, firstCorrectBonus: 0, streakBaseBonus: 0 },
          speedBonus: { ...previous.speedBonus, enabled: false, maxPoints: 0 }
        };
      }
      if (value === 'first') {
        return {
          ...previous,
          scoring: { ...previous.scoring, firstCorrectBonus: previous.scoring.firstCorrectBonus > 0 ? previous.scoring.firstCorrectBonus : 500, streakBaseBonus: 0 },
          speedBonus: { ...previous.speedBonus, enabled: false, maxPoints: 0 }
        };
      }
      if (value === 'speed') {
        return {
          ...previous,
          scoring: { ...previous.scoring, firstCorrectBonus: 0, streakBaseBonus: 0 },
          bonusTimer: { ...previous.bonusTimer, enabled: true },
          speedBonus: {
            ...previous.speedBonus,
            enabled: true,
            maxPoints: previous.speedBonus.maxPoints > 0 ? previous.speedBonus.maxPoints : 500
          }
        };
      }
      if (value === 'streak') {
        return {
          ...previous,
          scoring: { ...previous.scoring, firstCorrectBonus: 0, streakBaseBonus: previous.scoring.streakBaseBonus > 0 ? previous.scoring.streakBaseBonus : 1000 },
          speedBonus: { ...previous.speedBonus, enabled: false, maxPoints: 0 }
        };
      }
      return {
        ...previous,
        scoring: {
          ...previous.scoring,
          firstCorrectBonus: previous.scoring.firstCorrectBonus > 0 ? previous.scoring.firstCorrectBonus : 500,
          streakBaseBonus: previous.scoring.streakBaseBonus > 0 ? previous.scoring.streakBaseBonus : 1000
        },
        bonusTimer: {
          ...previous.bonusTimer,
          enabled: true
        },
        speedBonus: {
          ...previous.speedBonus,
          enabled: true,
          maxPoints: previous.speedBonus.maxPoints > 0 ? previous.speedBonus.maxPoints : 500
        }
      };
    });
  };

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
        setFormTitle(selectedItem?.title ?? revisionName);
        setFormSessionMode((session.sessionMode === 'asynchronous' ? 'asynchronous' : 'simultaneous') as 'simultaneous' | 'asynchronous');
        setFormHostViewMode(
          (session.hostViewMode === 'question' || session.hostViewMode === 'score' ? session.hostViewMode : 'panel') as
            | 'panel'
            | 'question'
            | 'score'
        );
        setFormParticipantViewMode(
          (session.participantViewMode === 'score' || session.participantViewMode === 'fullscreen' ? session.participantViewMode : 'question') as
            | 'question'
            | 'score'
            | 'fullscreen'
        );
        setFormLiveRules(parseLiveRules(session.sessionSettings));
        setShowSpecialSettings(false);
        setDetailStatus('ready');
      })
      .catch(() => {
        if (canceled) return;
        setAttachedSession(null);
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
      setFormHostViewMode(defaultPreset.hostViewMode);
      setFormParticipantViewMode(defaultPreset.participantViewMode);
      setFormLiveRules(defaultPreset.rules);
    } else {
      setFormSessionMode('simultaneous');
      setFormHostViewMode('panel');
      setFormParticipantViewMode('question');
      setFormLiveRules(DEFAULT_LIVE_RULES);
      setFormPresetId('custom');
    }
    setShowSpecialSettings(false);
    setFormTitle((previous) => (previous.trim() ? previous : revisionName || copy.cogita.library.revision.live.hostKicker));
  }, [copy.cogita.library.revision.live.hostKicker, mode, revisionName]);

  useEffect(() => {
    const detected = detectLivePreset(formSessionMode, formHostViewMode, formParticipantViewMode, formLiveRules);
    setFormPresetId((previous) => (previous === detected ? previous : detected));
  }, [formHostViewMode, formLiveRules, formParticipantViewMode, formSessionMode]);

  const applyPreset = (presetId: LivePresetId) => {
    setFormPresetId(presetId);
    if (presetId === 'custom') return;
    const preset = getLivePresetById(presetId);
    if (!preset) return;
    setFormSessionMode(preset.sessionMode);
    setFormHostViewMode(preset.hostViewMode);
    setFormParticipantViewMode(preset.participantViewMode);
    setFormLiveRules(preset.rules);
  };

  const settingsImpactLines = useMemo(() => {
    const firstActionLabel =
      formLiveRules.firstAnswerAction === 'start_timer'
        ? liveCopy.optionStartTimer
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

    const actionTimerInfo = formLiveRules.actionTimer.enabled
      ? `${liveCopy.actionTimerLabel}: ${liveCopy.summaryTimerEnabled.replace('{seconds}', String(formLiveRules.actionTimer.seconds))}`
      : `${liveCopy.actionTimerLabel}: ${liveCopy.summaryTimerDisabled}`;
    const bonusTimerInfo = formLiveRules.bonusTimer.enabled
      ? `${liveCopy.bonusTimerLabel}: ${liveCopy.summaryTimerEnabled.replace('{seconds}', String(formLiveRules.bonusTimer.seconds))} ${liveCopy.bonusTimerStartLabel}: ${formLiveRules.bonusTimer.startMode === 'round_start' ? liveCopy.bonusTimerStartRound : liveCopy.bonusTimerStartAfterFirst}.`
      : `${liveCopy.bonusTimerLabel}: ${liveCopy.summaryTimerDisabled}`;
    const halfSeconds = Math.max(1, Math.round(formLiveRules.bonusTimer.seconds / 2));
    const halfRatio = Math.max(0, 1 - halfSeconds / Math.max(1, formLiveRules.bonusTimer.seconds));
    const halfBonus = clampInt(growthRatio(formLiveRules.speedBonus.growth, halfRatio) * formLiveRules.speedBonus.maxPoints, 0, 500000);
    const hasFirstBonus = formLiveRules.scoring.firstCorrectBonus > 0;
    const hasSpeedBonus = formLiveRules.speedBonus.enabled && formLiveRules.speedBonus.maxPoints > 0;
    const hasStreakBonus = formLiveRules.scoring.streakBaseBonus > 0;
    const minPoints = formLiveRules.scoring.baseCorrect;
    const maxPoints =
      formLiveRules.scoring.baseCorrect +
      (hasFirstBonus ? formLiveRules.scoring.firstCorrectBonus : 0) +
      (hasSpeedBonus ? formLiveRules.speedBonus.maxPoints : 0) +
      (hasStreakBonus ? formLiveRules.scoring.streakBaseBonus : 0);

    const sentences: string[] = [];
    sentences.push(liveCopy.summaryPreset.replace('{preset}', presetLabelById(formPresetId)));
    sentences.push(isAsyncSession ? liveCopy.summaryAsyncPreset : liveCopy.summarySyncPreset);
    sentences.push(liveCopy.summaryBasePoints.replace('{base}', String(formLiveRules.scoring.baseCorrect)));
    if (hasFirstBonus) {
      sentences.push(liveCopy.summaryBonusFirst.replace('{first}', String(formLiveRules.scoring.firstCorrectBonus)));
    }
    if (hasSpeedBonus) {
      sentences.push(liveCopy.summaryBonusSpeed.replace('{max}', String(formLiveRules.speedBonus.maxPoints)));
      sentences.push(bonusTimerInfo);
      sentences.push(
        liveCopy.summarySpeedCurve
          .replace('{halfSeconds}', String(halfSeconds))
          .replace('{halfBonus}', String(halfBonus))
          .replace('{endSeconds}', String(formLiveRules.bonusTimer.seconds))
          .replace('{endBonus}', '0')
      );
    } else {
      sentences.push(bonusTimerInfo);
      sentences.push(liveCopy.summaryBonusSpeedDisabled);
    }
    if (hasStreakBonus) {
      sentences.push(
        liveCopy.summaryStreak
          .replace('{growth}', formLiveRules.scoring.streakGrowth)
          .replace('{max}', String(formLiveRules.scoring.streakBaseBonus))
          .replace('{limit}', String(formLiveRules.scoring.streakLimit))
      );
    } else {
      sentences.push(liveCopy.summaryBonusStreakDisabled);
    }
    if (!hasFirstBonus && !hasSpeedBonus && !hasStreakBonus) {
      sentences.push(liveCopy.summaryBonusNone.replace('{base}', String(formLiveRules.scoring.baseCorrect)));
    }
    sentences.push(
      liveCopy.summaryPointsTotalHint
        .replace('{min}', String(minPoints))
        .replace('{max}', String(maxPoints))
    );
    sentences.push(liveCopy.summaryEvaluationFlow);
    sentences.push(actionTimerInfo);
    sentences.push(
      liveCopy.summaryActions
        .replace('{firstAction}', firstActionLabel)
        .replace('{allAction}', allAnsweredLabel)
        .replace('{expireAction}', expireLabel)
    );
    return [sentences.join(' ')];
  }, [formLiveRules, formPresetId, isAsyncSession, liveCopy]);

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
        hostViewMode: formHostViewMode,
        participantViewMode: formParticipantViewMode,
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
        hostViewMode: formHostViewMode,
        participantViewMode: formParticipantViewMode,
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

  const joinUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/public/live-revision/${encodeURIComponent(attachedSession.code)}`
      : '';
  const presenterUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/public/live-revision-screen/${encodeURIComponent(attachedSession.code)}`
      : '';
  const hostUrl =
    attachedSession?.sessionId && attachedSession?.hostSecret && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/live-revision-host/${encodeURIComponent(libraryId)}/${encodeURIComponent(revisionId)}?sessionId=${encodeURIComponent(attachedSession.sessionId)}&hostSecret=${encodeURIComponent(attachedSession.hostSecret)}&code=${encodeURIComponent(attachedSession.code)}`
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
                        <label className="cogita-field">
                          <span>{copy.cogita.library.revision.live.hostViewModeLabel}</span>
                          <select value={formHostViewMode} onChange={(event) => setFormHostViewMode(event.target.value as 'panel' | 'question' | 'score')}>
                            <option value="panel">{copy.cogita.library.revision.live.hostViewPanel}</option>
                            <option value="question">{copy.cogita.library.revision.live.hostViewQuestion}</option>
                            <option value="score">{copy.cogita.library.revision.live.hostViewScore}</option>
                          </select>
                        </label>
                        <label className="cogita-field">
                          <span>{copy.cogita.library.revision.live.participantViewModeLabel}</span>
                          <select
                            value={formParticipantViewMode}
                            onChange={(event) => setFormParticipantViewMode(event.target.value as 'question' | 'score' | 'fullscreen')}
                          >
                            <option value="question">{copy.cogita.library.revision.live.participantViewQuestion}</option>
                            <option value="score">{copy.cogita.library.revision.live.participantViewScore}</option>
                            <option value="fullscreen">{copy.cogita.library.revision.live.participantViewFullscreen}</option>
                          </select>
                        </label>
                        <label className="cogita-field">
                          <span>{liveCopy.bonusUsageLabel}</span>
                          <select value={bonusUsage} onChange={(event) => applyBonusUsage(event.target.value as 'all' | 'none' | 'first' | 'speed' | 'streak')}>
                            <option value="all">{liveCopy.bonusUsageAll}</option>
                            <option value="none">{liveCopy.bonusUsageNone}</option>
                            <option value="first">{liveCopy.bonusUsageFirst}</option>
                            <option value="speed">{liveCopy.bonusUsageSpeed}</option>
                            <option value="streak">{liveCopy.bonusUsageStreak}</option>
                          </select>
                        </label>
                        <div className="cogita-form-actions" style={{ justifyContent: 'flex-start' }}>
                          <button type="button" className="ghost" onClick={() => setShowSpecialSettings((previous) => !previous)}>
                            {(showSpecialSettings ? copy.cogita.library.revision.hideSectionAction : copy.cogita.library.revision.showSectionAction)} {copy.cogita.library.revision.specificSettingsTitle}
                          </button>
                        </div>
                        {showSpecialSettings ? (
                    <div className="cogita-live-rules-grid">
                      {!isAsyncSession ? (
                      <>
                      <label className="cogita-field">
                        <span>{liveCopy.onFirstAnswerLabel}</span>
                        <select
                          value={formLiveRules.firstAnswerAction}
                          onChange={(event) =>
                            setFormLiveRules((previous) => ({
                              ...previous,
                              firstAnswerAction: event.target.value as FirstAnswerAction
                            }))
                          }
                        >
                          <option value="none">{liveCopy.optionDoNothing}</option>
                          <option value="start_timer">{liveCopy.optionStartTimer}</option>
                          <option value="reveal">{liveCopy.optionRevealScore}</option>
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
                      <label className="cogita-field">
                        <span>{`${liveCopy.actionTimerLabel} · ${liveCopy.timerEnabledLabel}`}</span>
                        <select
                          value={formLiveRules.actionTimer.enabled ? 'yes' : 'no'}
                          onChange={(event) =>
                            setFormLiveRules((previous) => ({
                              ...previous,
                              actionTimer: { ...previous.actionTimer, enabled: event.target.value === 'yes' }
                            }))
                          }
                        >
                          <option value="yes">{liveCopy.optionYes}</option>
                          <option value="no">{liveCopy.optionNo}</option>
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{`${liveCopy.actionTimerLabel} · ${liveCopy.timerSecondsLabel}`}</span>
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
                        <span>{`${liveCopy.actionTimerLabel} · ${liveCopy.onTimerExpiredLabel}`}</span>
                        <select
                          value={formLiveRules.actionTimer.onExpire}
                          onChange={(event) =>
                            setFormLiveRules((previous) => ({
                              ...previous,
                              actionTimer: { ...previous.actionTimer, onExpire: event.target.value as TimerExpireAction }
                            }))
                          }
                        >
                          <option value="none">{liveCopy.optionDoNothing}</option>
                          <option value="reveal">{liveCopy.optionRevealScore}</option>
                          <option value="next">{liveCopy.optionRevealNext}</option>
                        </select>
                      </label>
                      </>
                      ) : null}
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
                      {!isAsyncSession ? (
                      <>
                      <label className="cogita-field">
                        <span>{liveCopy.bonusTimerEnabledLabel}</span>
                        <select
                          value={formLiveRules.bonusTimer.enabled ? 'yes' : 'no'}
                          onChange={(event) =>
                            setFormLiveRules((previous) => ({
                              ...previous,
                              bonusTimer: { ...previous.bonusTimer, enabled: event.target.value === 'yes' }
                            }))
                          }
                        >
                          <option value="yes">{liveCopy.optionYes}</option>
                          <option value="no">{liveCopy.optionNo}</option>
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
                              bonusTimer: { ...previous.bonusTimer, seconds: clampInt(Number(event.target.value), 1, 600) }
                            }))
                          }
                        />
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.bonusTimerStartLabel}</span>
                        <select
                          value={formLiveRules.bonusTimer.startMode}
                          onChange={(event) =>
                            setFormLiveRules((previous) => ({
                              ...previous,
                              bonusTimer: { ...previous.bonusTimer, startMode: event.target.value === 'round_start' ? 'round_start' : 'first_answer' }
                            }))
                          }
                        >
                          <option value="first_answer">{liveCopy.bonusTimerStartAfterFirst}</option>
                          <option value="round_start">{liveCopy.bonusTimerStartRound}</option>
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.speedBonusEnabledLabel}</span>
                        <select
                          value={formLiveRules.speedBonus.enabled ? 'yes' : 'no'}
                          onChange={(event) =>
                            setFormLiveRules((previous) => ({
                              ...previous,
                              speedBonus: { ...previous.speedBonus, enabled: event.target.value === 'yes' }
                            }))
                          }
                        >
                          <option value="yes">{liveCopy.optionYes}</option>
                          <option value="no">{liveCopy.optionNo}</option>
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.speedBonusMaxLabel}</span>
                        <input
                          type="number"
                          min={0}
                          max={500000}
                          value={formLiveRules.speedBonus.maxPoints}
                          disabled={!formLiveRules.speedBonus.enabled}
                          onChange={(event) =>
                            setFormLiveRules((previous) => ({
                              ...previous,
                              speedBonus: { ...previous.speedBonus, enabled: true, maxPoints: clampInt(Number(event.target.value), 0, 500000) }
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
                              speedBonus: { ...previous.speedBonus, growth: event.target.value as BonusGrowthMode }
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
                        <div className="cogita-info-tree">
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
                        <div className="cogita-form-actions">
                          <button type="button" className="ghost" onClick={() => onRequestEdit?.(attachedSession.sessionId)}>
                            {copy.cogita.workspace.infoActions.edit}
                          </button>
                          {hostUrl ? (
                            <a className="ghost" href={hostUrl}>
                              Host
                            </a>
                          ) : null}
                          {presenterUrl ? (
                            <a className="ghost" href={presenterUrl} target="_blank" rel="noreferrer">
                              Screen
                            </a>
                          ) : null}
                          {joinUrl ? (
                            <a className="ghost" href={joinUrl} target="_blank" rel="noreferrer">
                              Login
                            </a>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </section>
                ) : null}
              </div>

              {mode === 'search' || mode === 'detail' ? (
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
