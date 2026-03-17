import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  attachCogitaLiveRevisionSession,
  removeCogitaLiveRevisionParticipant,
  createCogitaLiveRevisionSession,
  deleteCogitaLiveRevisionSession,
  getCogitaLiveRevisionSessionsByRevision,
  updateCogitaLiveRevisionSession,
  type CogitaLiveRevisionSession,
  type CogitaLiveRevisionSessionListItem
} from '../../../../../../lib/api';
import { CogitaShell } from '../../../../CogitaShell';
import type { Copy } from '../../../../../../content/types';
import type { RouteKey } from '../../../../../../types/navigation';
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
  type NextQuestionMode,
  type TimerExpireAction
} from '../../../../live/liveSessionRules';
import { buildLiveSessionSummaryLines } from '../../../../live/liveSessionDescription';
import {
  formatLiveParticipantGroupsText,
  parseLiveParticipantGroups,
  parseLiveParticipantGroupsText,
  withLiveParticipantGroups
} from '../../../../live/liveSessionGroups';

export type LiveSessionsMode = 'search' | 'create' | 'detail' | 'edit';

export type CogitaRevisionLiveSessionsProps = {
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
  mode?: LiveSessionsMode;
  sessionId?: string;
  onCreated?: (sessionId: string) => void;
  onOpenSession?: (sessionId: string) => void;
  onRequestEdit?: (sessionId: string) => void;
  onRequestOverview?: (sessionId: string) => void;
};

export function CogitaRevisionLiveSessions({
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
}: CogitaRevisionLiveSessionsProps) {
  const navigate = useNavigate();
  const FIXED_HOST_VIEW_MODE = 'panel' as const;
  const FIXED_PARTICIPANT_VIEW_MODE = 'question' as const;
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [items, setItems] = useState<CogitaLiveRevisionSessionListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [formTitle, setFormTitle] = useState('');
  const [formSessionMode, setFormSessionMode] = useState<'simultaneous' | 'asynchronous'>('simultaneous');
  const [formLiveRules, setFormLiveRules] = useState<LiveRules>(DEFAULT_LIVE_RULES);
  const [formParticipantGroupsText, setFormParticipantGroupsText] = useState('');
  const [formPresetId, setFormPresetId] = useState<LivePresetId>('balanced_duel');
  const [showSpecialSettings, setShowSpecialSettings] = useState(false);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attachedSession, setAttachedSession] = useState<CogitaLiveRevisionSession | null>(null);
  const [reloginParticipantId, setReloginParticipantId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'none' | 'create' | 'save' | 'duplicate' | 'delete' | 'remove'>('none');
  const [message, setMessage] = useState<string | null>(null);

  const baseHref = `/#/cogita/workspace/libraries/${libraryId}`;
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

  const presetOptions = useMemo(() => {
    const byMode = presetDefinitions
      .filter((preset) => preset.sessionMode === formSessionMode)
      .map((preset) => ({ value: preset.id, label: presetLabelById(preset.id) }));
    return [...byMode, { value: 'custom' as const, label: presetLabelById('custom') }];
  }, [formSessionMode, presetDefinitions, liveCopy]);
  const isAsyncSession = formSessionMode === 'asynchronous';
  const buildFallbackDuplicateName = () => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return `${liveCopy.groupNameLabel} ${date} ${time}`;
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
        const parsedRules = parseLiveRules(session.sessionSettings);
        const parsedMode = (session.sessionMode === 'asynchronous' ? 'asynchronous' : 'simultaneous') as
          | 'simultaneous'
          | 'asynchronous';
        setAttachedSession(session);
        setReloginParticipantId(null);
        setFormTitle(selectedItem?.title ?? '');
        setFormSessionMode(parsedMode);
        setFormLiveRules(parsedRules);
        setFormParticipantGroupsText(formatLiveParticipantGroupsText(parseLiveParticipantGroups(session.sessionSettings)));
        setFormPresetId(detectLivePreset(parsedMode, FIXED_HOST_VIEW_MODE, FIXED_PARTICIPANT_VIEW_MODE, parsedRules));
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
  }, [libraryId, mode, selectedItem?.title, sessionId]);

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
    setFormTitle('');
    setFormParticipantGroupsText('');
  }, [mode]);

  const applyPreset = (presetId: LivePresetId) => {
    setFormPresetId(presetId);
    if (presetId === 'custom') return;
    const preset = getLivePresetById(presetId);
    if (!preset) return;
    setFormSessionMode(preset.sessionMode);
    setFormLiveRules(preset.rules);
  };

  const settingsImpactLines = useMemo(
    () =>
      buildLiveSessionSummaryLines({
        liveCopy,
        rules: formLiveRules,
        sessionMode: formSessionMode
      }),
    [formLiveRules, formSessionMode, liveCopy]
  );

  const normalizedRulesForSave = useMemo<LiveRules>(() => {
    if (formSessionMode !== 'asynchronous') {
      return formLiveRules;
    }
    return {
      ...formLiveRules,
      firstAnswerAction: 'none',
      allAnsweredAction: 'none',
      roundTimer: { ...formLiveRules.roundTimer, onExpire: 'reveal' },
      actionTimer: { ...formLiveRules.actionTimer, enabled: false, onExpire: 'reveal' },
      bonusTimer: { ...formLiveRules.bonusTimer, startMode: 'round_start' }
    };
  }, [formLiveRules, formSessionMode]);
  const normalizedParticipantGroupsForSave = useMemo(
    () => parseLiveParticipantGroupsText(formParticipantGroupsText),
    [formParticipantGroupsText]
  );
  const normalizedSessionSettingsForSave = useMemo(
    () => withLiveParticipantGroups(withLiveRulesSettings(normalizedRulesForSave), normalizedParticipantGroupsForSave),
    [normalizedParticipantGroupsForSave, normalizedRulesForSave]
  );

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item) => values.add(item.status));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items]);

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
        sessionSettings: normalizedSessionSettingsForSave
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
        sessionSettings: normalizedSessionSettingsForSave
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

  const duplicateSession = async () => {
    if (!attachedSession?.sessionId) return;
    setBusyAction('duplicate');
    setMessage(null);
    try {
      const duplicateName =
        formTitle.trim() ||
        selectedItem?.title?.trim() ||
        buildFallbackDuplicateName();

      const created = await createCogitaLiveRevisionSession({
        libraryId,
        revisionId,
        collectionId: attachedSession?.collectionId ?? null,
        title: duplicateName,
        sessionMode: formSessionMode,
        hostViewMode: FIXED_HOST_VIEW_MODE,
        participantViewMode: FIXED_PARTICIPANT_VIEW_MODE,
        sessionSettings: normalizedSessionSettingsForSave
      });
      setFormTitle(duplicateName);
      await loadSessions();
      onOpenSession?.(created.sessionId);
    } catch {
      setMessage(liveCopy.startNextGroupError);
    } finally {
      setBusyAction('none');
    }
  };

  const deleteSession = async () => {
    if (!attachedSession?.sessionId) return;
    if (!window.confirm('Delete this live session? This cannot be undone.')) return;
    setBusyAction('delete');
    setMessage(null);
    try {
      await deleteCogitaLiveRevisionSession({
        libraryId,
        sessionId: attachedSession.sessionId
      });
      await loadSessions();
      navigate(`/cogita/workspace/libraries/${libraryId}/revisions/${encodeURIComponent(revisionId)}/live-sessions`, { replace: true });
    } catch {
      setMessage('Failed to delete live session.');
    } finally {
      setBusyAction('none');
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!attachedSession?.sessionId) return;
    const participant = attachedSession.participants.find((item) => item.participantId === participantId);
    if (!participant) return;
    const confirmMessage =
      language === 'pl'
        ? `Usunąć uczestnika „${participant.displayName}” z tej sesji?`
        : language === 'de'
          ? `Teilnehmende Person „${participant.displayName}“ aus dieser Sitzung entfernen?`
          : `Remove participant "${participant.displayName}" from this session?`;
    if (!window.confirm(confirmMessage)) return;

    setBusyAction('remove');
    setMessage(null);
    try {
      const runRemove = async (secret: string) =>
        removeCogitaLiveRevisionParticipant({
          libraryId,
          sessionId: attachedSession.sessionId,
          hostSecret: secret,
          participantId
        });

      let secret = attachedSession.hostSecret;
      if (!secret) {
        const refreshed = await attachCogitaLiveRevisionSession({ libraryId, sessionId: attachedSession.sessionId });
        secret = refreshed.hostSecret;
      }

      if (!secret) {
        throw new Error('missing-host-secret');
      }

      let nextSession: CogitaLiveRevisionSession;
      try {
        nextSession = await runRemove(secret);
      } catch (error) {
        const staleSecret = error instanceof ApiError && error.status === 403;
        if (!staleSecret) throw error;
        const refreshed = await attachCogitaLiveRevisionSession({ libraryId, sessionId: attachedSession.sessionId });
        if (!refreshed.hostSecret) throw error;
        nextSession = await runRemove(refreshed.hostSecret);
      }

      await loadSessions();
      setAttachedSession(nextSession);
      setReloginParticipantId((previous) => (previous === participantId ? null : previous));
    } catch {
      setMessage(copy.cogita.library.revision.shareError);
    } finally {
      setBusyAction('none');
    }
  };

  const joinWallUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/live/wall/login/${encodeURIComponent(attachedSession.code)}`
      : '';
  const publicJoinUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/live/join/${encodeURIComponent(attachedSession.code)}`
      : '';
  const presenterUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/live/wall/output/${encodeURIComponent(attachedSession.code)}`
      : '';
  const hostUrl =
    attachedSession?.sessionId && attachedSession?.hostSecret && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/live/wall/host/${encodeURIComponent(libraryId)}/${encodeURIComponent(revisionId)}?sessionId=${encodeURIComponent(attachedSession.sessionId)}&hostSecret=${encodeURIComponent(attachedSession.hostSecret)}&code=${encodeURIComponent(attachedSession.code)}`
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
      ? `${publicJoinUrl}?name=${encodeURIComponent(reloginParticipant.displayName)}${reloginParticipant.groupName ? `&group=${encodeURIComponent(reloginParticipant.groupName)}` : ''}`
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
                      </div>
                    </div>

                    <CogitaLiveSessionSearch
                      items={items}
                      query={query}
                      onQueryChange={setQuery}
                      statusFilter={statusFilter}
                      onStatusFilterChange={setStatusFilter}
                      searchLabel={copy.cogita.workspace.infoMode.search}
                      searchPlaceholder={copy.cogita.workspace.revisionForm.namePlaceholder}
                      statusLabel={copy.cogita.library.revision.live.statusLabel}
                      anyStatusLabel={copy.cogita.library.infoTypes.any}
                      searchingLabel={copy.cogita.library.collections.loading}
                      readyLabel={copy.cogita.library.collections.ready}
                      errorLabel={copy.cogita.library.revision.shareError}
                      loadState={status}
                      emptyLabel={copy.cogita.library.revision.shareListEmpty}
                      statusOptions={statusOptions}
                      participantsLabel={copy.cogita.library.revision.live.participantsTitle}
                      openActionLabel={copy.cogita.workspace.infoActions.overview}
                      inputAriaLabel={copy.cogita.workspace.revisionForm.namePlaceholder}
                      buildSessionHref={(item) =>
                        `${baseHref}/revisions/${encodeURIComponent(revisionId)}/live-sessions/${encodeURIComponent(item.sessionId)}`
                      }
                      onSessionSelect={(item) => onOpenSession?.(item.sessionId)}
                    />
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
                          <span>{liveCopy.classGroupsLabel}</span>
                          <textarea
                            rows={4}
                            value={formParticipantGroupsText}
                            onChange={(event) => setFormParticipantGroupsText(event.target.value)}
                            placeholder={liveCopy.classGroupsPlaceholder}
                          />
                        </label>
                        <p className="cogita-help">{liveCopy.classGroupsHelp}</p>
                        <label className="cogita-field">
                          <span>{liveCopy.sessionModeLabel}</span>
                          <select
                            value={formSessionMode}
                            onChange={(event) => {
                              const nextMode = (event.target.value === 'asynchronous' ? 'asynchronous' : 'simultaneous') as
                                | 'simultaneous'
                                | 'asynchronous';
                              setFormSessionMode(nextMode);
                              const fallbackPreset = presetDefinitions.find((preset) => preset.sessionMode === nextMode) ?? null;
                              if (fallbackPreset) {
                                setFormPresetId(fallbackPreset.id);
                                setFormLiveRules(fallbackPreset.rules);
                                return;
                              }
                              setFormPresetId('custom');
                            }}
                          >
                            <option value="simultaneous">{liveCopy.modeSimultaneous}</option>
                            <option value="asynchronous">{liveCopy.modeAsynchronous}</option>
                          </select>
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
                                  <span>{liveCopy.firstBonusModeLabel ?? 'First answer bonus mode'}</span>
                                  <select
                                    value={formLiveRules.scoring.firstBonusMode}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        scoring: {
                                          ...previous.scoring,
                                          firstBonusMode: event.target.value === 'first_correct' ? 'first_correct' : 'first_answer'
                                        }
                                      }))
                                    }
                                  >
                                    <option value="first_answer">{liveCopy.firstBonusModeFirstAnswer ?? 'First answer (even if wrong)'}</option>
                                    <option value="first_correct">{liveCopy.firstBonusModeFirstCorrect ?? 'First correct answer'}</option>
                                  </select>
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
                                <label className="cogita-field">
                                  <span>{liveCopy.firstWrongPenaltyModeLabel ?? 'First wrong penalty mode'}</span>
                                  <select
                                    value={formLiveRules.scoring.firstWrongPenaltyMode}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        scoring: {
                                          ...previous.scoring,
                                          firstWrongPenaltyMode:
                                            event.target.value === 'first_wrong' ? 'first_wrong' : 'first_overall_answer'
                                        }
                                      }))
                                    }
                                  >
                                    <option value="first_overall_answer">{liveCopy.firstWrongPenaltyModeOverallFirst ?? 'Only if wrong answer was the first overall answer'}</option>
                                    <option value="first_wrong">{liveCopy.firstWrongPenaltyModeFirstWrong ?? 'First wrong answer in the round'}</option>
                                  </select>
                                </label>
                              </div>
                            </div>

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
                                        value={isAsyncSession ? 'reveal' : formLiveRules.roundTimer.onExpire}
                                        onChange={(event) =>
                                          setFormLiveRules((previous) => ({
                                            ...previous,
                                            roundTimer: { ...previous.roundTimer, onExpire: event.target.value as TimerExpireAction }
                                          }))
                                        }
                                        disabled={isAsyncSession}
                                      >
                                        <option value="reveal">{liveCopy.optionRevealScore}</option>
                                        {!isAsyncSession ? <option value="next">{liveCopy.optionRevealNext}</option> : null}
                                      </select>
                                    </label>
                                  </>
                                ) : null}
                              </div>
                            </div>

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

                            <div className="cogita-library-panel" style={{ margin: 0 }}>
                              <p className="cogita-user-kicker">{liveCopy.nextQuestionBehaviorLabel}</p>
                              <div className="cogita-live-rules-grid">
                                <label className="cogita-field">
                                  <span>{liveCopy.nextQuestionModeLabel}</span>
                                  <select
                                    value={formLiveRules.nextQuestion.mode}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        nextQuestion: {
                                          ...previous.nextQuestion,
                                          mode: event.target.value as NextQuestionMode
                                        }
                                      }))
                                    }
                                  >
                                    <option value="manual">{liveCopy.nextQuestionModeManual}</option>
                                    <option value="timer">{liveCopy.nextQuestionModeTimer}</option>
                                  </select>
                                </label>
                                {formLiveRules.nextQuestion.mode === 'timer' ? (
                                  <label className="cogita-field">
                                    <span>{liveCopy.nextQuestionTimerSecondsLabel}</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={120}
                                      value={formLiveRules.nextQuestion.seconds}
                                      onChange={(event) =>
                                        setFormLiveRules((previous) => ({
                                          ...previous,
                                          nextQuestion: {
                                            ...previous.nextQuestion,
                                            seconds: clampInt(Number(event.target.value), 1, 120)
                                          }
                                        }))
                                      }
                                    />
                                  </label>
                                ) : null}
                              </div>
                            </div>

                            <div className="cogita-library-panel" style={{ margin: 0 }}>
                              <p className="cogita-user-kicker">{`${liveCopy.roundsLabel} · ${liveCopy.timerLabel}`}</p>
                              <div className="cogita-live-rules-grid">
                                <label className="cogita-field">
                                  <span>{liveCopy.timerEnabledLabel}</span>
                                  <select
                                    value={formLiveRules.sessionTimer.enabled ? 'yes' : 'no'}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        sessionTimer: { ...previous.sessionTimer, enabled: event.target.value === 'yes' }
                                      }))
                                    }
                                  >
                                    <option value="yes">{liveCopy.optionYes}</option>
                                    <option value="no">{liveCopy.optionNo}</option>
                                  </select>
                                </label>
                                {formLiveRules.sessionTimer.enabled ? (
                                  <label className="cogita-field">
                                    <span>{liveCopy.roundTimerSecondsLabel}</span>
                                    <input
                                      type="number"
                                      min={10}
                                      max={86400}
                                      value={formLiveRules.sessionTimer.seconds}
                                      onChange={(event) =>
                                        setFormLiveRules((previous) => ({
                                          ...previous,
                                          sessionTimer: { ...previous.sessionTimer, seconds: clampInt(Number(event.target.value), 10, 86400) }
                                        }))
                                      }
                                    />
                                  </label>
                                ) : null}
                              </div>
                            </div>

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
                                        bonusTimer: {
                                          ...previous.bonusTimer,
                                          enabled: event.target.value === 'yes',
                                          startMode: isAsyncSession ? 'round_start' : previous.bonusTimer.startMode
                                        }
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
                                        value={isAsyncSession ? 'round_start' : formLiveRules.bonusTimer.startMode}
                                        onChange={(event) =>
                                          setFormLiveRules((previous) => ({
                                            ...previous,
                                            bonusTimer: {
                                              ...previous.bonusTimer,
                                              enabled: true,
                                              startMode: event.target.value === 'round_start' ? 'round_start' : 'first_answer'
                                            }
                                          }))
                                        }
                                        disabled={isAsyncSession}
                                      >
                                        {!isAsyncSession ? (
                                          <option value="first_answer">{liveCopy.bonusTimerStartAfterFirst}</option>
                                        ) : null}
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
                                <label className="cogita-field">
                                  <span>{liveCopy.wrongStreakPenaltyEnabledLabel ?? 'Wrong streak penalty enabled'}</span>
                                  <select
                                    value={formLiveRules.scoring.wrongStreakBasePenalty > 0 ? 'yes' : 'no'}
                                    onChange={(event) =>
                                      setFormLiveRules((previous) => ({
                                        ...previous,
                                        scoring: {
                                          ...previous.scoring,
                                          wrongStreakBasePenalty:
                                            event.target.value === 'yes'
                                              ? (previous.scoring.wrongStreakBasePenalty > 0 ? previous.scoring.wrongStreakBasePenalty : 100)
                                              : 0
                                        }
                                      }))
                                    }
                                  >
                                    <option value="yes">{liveCopy.optionYes}</option>
                                    <option value="no">{liveCopy.optionNo}</option>
                                  </select>
                                </label>
                                {formLiveRules.scoring.wrongStreakBasePenalty > 0 ? (
                                  <>
                                    <label className="cogita-field">
                                      <span>{liveCopy.wrongStreakBasePenaltyLabel ?? 'Wrong streak base penalty'}</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={500000}
                                        value={formLiveRules.scoring.wrongStreakBasePenalty}
                                        onChange={(event) =>
                                          setFormLiveRules((previous) => ({
                                            ...previous,
                                            scoring: { ...previous.scoring, wrongStreakBasePenalty: clampInt(Number(event.target.value), 0, 500000) }
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="cogita-field">
                                      <span>{liveCopy.wrongStreakGrowthLabel ?? 'Wrong streak growth'}</span>
                                      <select
                                        value={formLiveRules.scoring.wrongStreakGrowth}
                                        onChange={(event) =>
                                          setFormLiveRules((previous) => ({
                                            ...previous,
                                            scoring: { ...previous.scoring, wrongStreakGrowth: event.target.value as BonusGrowthMode }
                                          }))
                                        }
                                      >
                                        <option value="linear">{liveCopy.optionLinear}</option>
                                        <option value="exponential">{liveCopy.optionExponential}</option>
                                        <option value="limited">{liveCopy.optionLimited}</option>
                                      </select>
                                    </label>
                                    <label className="cogita-field">
                                      <span>{liveCopy.wrongStreakLimitLabel ?? 'Wrong streak limit'}</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={200}
                                        value={formLiveRules.scoring.wrongStreakLimit}
                                        onChange={(event) =>
                                          setFormLiveRules((previous) => ({
                                            ...previous,
                                            scoring: { ...previous.scoring, wrongStreakLimit: clampInt(Number(event.target.value), 1, 200) }
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
                                    {participant.groupName ? (
                                      <div className="cogita-share-meta">
                                        {copy.cogita.library.revision.live.classNameLabel}: {participant.groupName}
                                      </div>
                                    ) : null}
                                    <div className="cogita-share-meta">
                                      {participant.isConnected
                                        ? copy.cogita.library.revision.live.connectedLabel
                                        : copy.cogita.library.revision.live.disconnectedLabel}
                                    </div>
                                  </div>
                                  <div className="cogita-share-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                                    <button
                                      type="button"
                                      className="ghost"
                                      onClick={() => void removeParticipant(participant.participantId)}
                                      disabled={busyAction !== 'none'}
                                    >
                                      {copy.cogita.library.revision.live.removeParticipantAction}
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
                          <label className="cogita-field">
                            <span>{liveCopy.groupNameLabel}</span>
                            <input
                              value={formTitle}
                              onChange={(event) => setFormTitle(event.target.value)}
                              placeholder={liveCopy.groupNamePlaceholder}
                            />
                          </label>
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
                            <button
                              type="button"
                              className="cta"
                              onClick={() => void duplicateSession()}
                              disabled={busyAction !== 'none'}
                            >
                              {liveCopy.newSessionAction}
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => void deleteSession()}
                              disabled={busyAction === 'delete'}
                            >
                              Delete
                            </button>
                          </div>
                          <p className="cogita-help">{liveCopy.resumeSessionHint}</p>
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

function CogitaLiveSessionSearch({
  items,
  query,
  onQueryChange,
  defaultQuery = '',
  statusFilter,
  onStatusFilterChange,
  defaultStatusFilter = 'all',
  searchLabel,
  searchPlaceholder,
  statusLabel,
  anyStatusLabel,
  searchingLabel,
  readyLabel,
  errorLabel,
  loadState,
  emptyLabel,
  countLabelTemplate = '{shown} / {total}',
  showInput = true,
  showStatusFilter = true,
  showCount = true,
  hideResultsList = false,
  inputAriaLabel,
  inputClassName,
  statusOptions,
  buildSessionHref,
  openActionLabel = 'Open',
  showOpenAction = false,
  participantsLabel = 'Participants',
  onSessionSelect,
  onSessionOpen,
  onResultsChange
}: {
  items: CogitaLiveRevisionSessionListItem[];
  query?: string;
  onQueryChange?: (query: string) => void;
  defaultQuery?: string;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  defaultStatusFilter?: string;
  searchLabel: string;
  searchPlaceholder: string;
  statusLabel: string;
  anyStatusLabel: string;
  searchingLabel: string;
  readyLabel: string;
  errorLabel: string;
  loadState: 'loading' | 'ready' | 'error';
  emptyLabel: string;
  countLabelTemplate?: string;
  showInput?: boolean;
  showStatusFilter?: boolean;
  showCount?: boolean;
  hideResultsList?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  statusOptions?: string[];
  buildSessionHref?: (item: CogitaLiveRevisionSessionListItem) => string;
  openActionLabel?: string;
  showOpenAction?: boolean;
  participantsLabel?: string;
  onSessionSelect?: (item: CogitaLiveRevisionSessionListItem) => void;
  onSessionOpen?: (item: CogitaLiveRevisionSessionListItem) => void;
  onResultsChange?: (items: CogitaLiveRevisionSessionListItem[]) => void;
}) {
  const [localQuery, setLocalQuery] = useState(defaultQuery);
  const [localStatusFilter, setLocalStatusFilter] = useState(defaultStatusFilter);
  const onResultsChangeRef = useRef(onResultsChange);
  const effectiveQuery = query ?? localQuery;
  const effectiveStatusFilter = statusFilter ?? localStatusFilter;

  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  }, [onResultsChange]);

  const availableStatusOptions = useMemo(() => {
    if (statusOptions && statusOptions.length > 0) return statusOptions;
    const values = new Set<string>();
    items.forEach((item) => values.add(item.status));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items, statusOptions]);

  const filtered = useMemo(() => {
    const needle = effectiveQuery.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (effectiveStatusFilter !== 'all' && item.status !== effectiveStatusFilter) return false;
      if (!needle) return true;
      const haystack = `${item.title ?? ''} ${item.sessionId} ${item.status}`.toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [effectiveQuery, effectiveStatusFilter, items]);

  useEffect(() => {
    onResultsChangeRef.current?.(filtered);
  }, [filtered]);

  const countLabel = useMemo(
    () => countLabelTemplate.replace('{shown}', String(filtered.length)).replace('{total}', String(items.length)),
    [countLabelTemplate, filtered.length, items.length]
  );
  const statusText = loadState === 'loading' ? searchingLabel : loadState === 'error' ? errorLabel : readyLabel;

  const handleQueryInputChange = (next: string) => {
    if (onQueryChange) {
      onQueryChange(next);
      return;
    }
    setLocalQuery(next);
  };

  const handleStatusInputChange = (next: string) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(next);
      return;
    }
    setLocalStatusFilter(next);
  };

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {showInput ? (
        <div className="cogita-search-field">
          <input
            aria-label={inputAriaLabel ?? searchLabel}
            className={inputClassName}
            value={effectiveQuery}
            onChange={(event) => handleQueryInputChange(event.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
          />
        </div>
      ) : null}

      {showStatusFilter ? (
        <label className="cogita-field">
          <span>{statusLabel}</span>
          <select value={effectiveStatusFilter} onChange={(event) => handleStatusInputChange(event.target.value)}>
            <option value="all">{anyStatusLabel}</option>
            {availableStatusOptions.map((value) => (
              <option key={`status:${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showCount ? (
        <div className="cogita-card-count">
          <span>{countLabel}</span>
          <span>{statusText}</span>
        </div>
      ) : null}

      {!hideResultsList ? (
        <div className="cogita-card-list" data-view="list">
          {filtered.length ? (
            filtered.map((item) => {
              const href = buildSessionHref ? buildSessionHref(item) : null;
              const title = item.title || item.sessionId;
              return (
                <div key={item.sessionId} className="cogita-card-item">
                  <div className="cogita-info-result-row">
                    {href && !onSessionSelect ? (
                      <a className="cogita-info-result-main" href={href}>
                        <div className="cogita-card-type">{item.status}</div>
                        <h3 className="cogita-card-title">{title}</h3>
                        <p className="cogita-card-subtitle">{participantsLabel}: {item.participantCount}</p>
                      </a>
                    ) : (
                      <button type="button" className="cogita-info-result-main" onClick={() => onSessionSelect?.(item)}>
                        <div className="cogita-card-type">{item.status}</div>
                        <h3 className="cogita-card-title">{title}</h3>
                        <p className="cogita-card-subtitle">{participantsLabel}: {item.participantCount}</p>
                      </button>
                    )}
                    {showOpenAction && href ? (
                      <a className="ghost" href={href}>
                        {openActionLabel}
                      </a>
                    ) : showOpenAction && onSessionOpen ? (
                      <button type="button" className="ghost" onClick={() => onSessionOpen(item)}>
                        {openActionLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="cogita-card-empty">
              <p>{emptyLabel}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
