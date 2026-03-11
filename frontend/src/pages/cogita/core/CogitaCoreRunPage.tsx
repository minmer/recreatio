import { useCallback, useEffect, useMemo, useState } from 'react';
import '../../../styles/cogita.css';
import {
  createCogitaCoreRun,
  getCogitaCoreNextCard,
  getCogitaCoreRunState,
  getCogitaCoreRunStatistics,
  issueCsrf,
  joinCogitaCoreRun,
  setCogitaCoreRunStatus,
  submitCogitaCoreRunAttempt,
  type CogitaCoreNextCard,
  type CogitaCoreReveal,
  type CogitaCoreRunParticipant,
  type CogitaCoreRunState,
  type CogitaCoreRunStatistics
} from '../../../lib/api';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';

const DISPLAY_NAME_STORAGE_KEY = 'cogita.revision.displayName';
const LEGACY_DISPLAY_NAME_STORAGE_KEY = 'cogita.core.displayName';
const RECENT_REVISIONS_STORAGE_KEY = 'cogita.revision.recent';

type CoreCharComparison = {
  comparedLength: number;
  mismatchCount: number;
  similarityPct: number;
  mismatchesPreview: Array<{
    index: number;
    expected?: string | null;
    actual?: string | null;
  }>;
};

type RecentRevisionEntry = {
  libraryId: string;
  runId: string;
  mode: 'solo' | 'shared' | 'group-async' | 'group-sync';
  title?: string | null;
  updatedUtc: string;
};

function normalizeRecentRevisionMode(scope: string | undefined): RecentRevisionEntry['mode'] | null {
  if (scope === 'group_async' || scope === 'group-async') return 'group-async';
  if (scope === 'group_sync' || scope === 'group-sync') return 'group-sync';
  if (scope === 'shared') return 'shared';
  if (scope === 'solo') return 'solo';
  return null;
}

function pushRecentRevision(entry: RecentRevisionEntry) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(RECENT_REVISIONS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentRevisionEntry[]) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    const next = [entry, ...list.filter((item) => !(item.libraryId === entry.libraryId && item.runId === entry.runId && item.mode === entry.mode))]
      .slice(0, 12);
    window.localStorage.setItem(RECENT_REVISIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore local storage parsing errors
  }
}

function participantStorageKey(libraryId: string, runId: string) {
  return `cogita.revision.participant.${libraryId}.${runId}`;
}

function sharedRecoveryStorageKey(libraryId: string, runId: string) {
  return `cogita.revision.shared.recovery.${libraryId}.${runId}`;
}

function groupParticipantsStorageKey(libraryId: string, runId: string) {
  return `cogita.revision.group.participants.${libraryId}.${runId}`;
}

function groupActiveParticipantStorageKey(libraryId: string, runId: string) {
  return `cogita.revision.group.active.${libraryId}.${runId}`;
}

function legacyParticipantStorageKey(libraryId: string, runId: string) {
  return `cogita.core.participant.${libraryId}.${runId}`;
}

function legacySharedRecoveryStorageKey(libraryId: string, runId: string) {
  return `cogita.core.shared.recovery.${libraryId}.${runId}`;
}

function legacyGroupParticipantsStorageKey(libraryId: string, runId: string) {
  return `cogita.core.group.participants.${libraryId}.${runId}`;
}

function legacyGroupActiveParticipantStorageKey(libraryId: string, runId: string) {
  return `cogita.core.group.active.${libraryId}.${runId}`;
}

function readStorage(primaryKey: string, legacyKey: string): string | null {
  const primary = localStorage.getItem(primaryKey);
  if (primary !== null) {
    return primary;
  }
  return localStorage.getItem(legacyKey);
}

function writeStorage(primaryKey: string, legacyKey: string, value: string) {
  localStorage.setItem(primaryKey, value);
  localStorage.removeItem(legacyKey);
}

function removeStorage(primaryKey: string, legacyKey: string) {
  localStorage.removeItem(primaryKey);
  localStorage.removeItem(legacyKey);
}

function parseStoredParticipantIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((value) => String(value ?? '').trim()).filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

export function CogitaCoreRunPage({
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
  runId,
  runScopeHint
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
  runId: string;
  runScopeHint?: 'solo' | 'shared' | 'group_async' | 'group_sync';
}) {
  const coreCopy = copy.cogita.core.run;
  const [runState, setRunState] = useState<CogitaCoreRunState | null>(null);
  const [participant, setParticipant] = useState<CogitaCoreRunParticipant | null>(null);
  const [groupParticipants, setGroupParticipants] = useState<CogitaCoreRunParticipant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [joiningParticipant, setJoiningParticipant] = useState(false);
  const [nextCard, setNextCard] = useState<CogitaCoreNextCard | null>(null);
  const [reveal, setReveal] = useState<CogitaCoreReveal | null>(null);
  const [charComparison, setCharComparison] = useState<CoreCharComparison | null>(null);
  const [statistics, setStatistics] = useState<CogitaCoreRunStatistics | null>(null);
  const [answer, setAnswer] = useState('');
  const [promptShownUtc, setPromptShownUtc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const participantKey = useMemo(() => participantStorageKey(libraryId, runId), [libraryId, runId]);
  const legacyParticipantKey = useMemo(() => legacyParticipantStorageKey(libraryId, runId), [libraryId, runId]);
  const sharedRecoveryKey = useMemo(() => sharedRecoveryStorageKey(libraryId, runId), [libraryId, runId]);
  const legacySharedRecoveryKey = useMemo(() => legacySharedRecoveryStorageKey(libraryId, runId), [libraryId, runId]);
  const groupParticipantsKey = useMemo(() => groupParticipantsStorageKey(libraryId, runId), [libraryId, runId]);
  const legacyGroupParticipantsKey = useMemo(() => legacyGroupParticipantsStorageKey(libraryId, runId), [libraryId, runId]);
  const groupActiveParticipantKey = useMemo(() => groupActiveParticipantStorageKey(libraryId, runId), [libraryId, runId]);
  const legacyGroupActiveParticipantKey = useMemo(
    () => legacyGroupActiveParticipantStorageKey(libraryId, runId),
    [libraryId, runId]
  );
  const isGroupScope = runState?.run.runScope === 'group_sync';
  const isGroupSyncScope = runState?.run.runScope === 'group_sync';
  const interactionLocked = working || joiningParticipant;
  const visibleGroupParticipants = useMemo(() => {
    if (!isGroupScope) return [];
    if (groupParticipants.length > 0) return groupParticipants;
    return runState?.participants ?? [];
  }, [groupParticipants, isGroupScope, runState]);

  const refreshRunState = useCallback(
    async (participantId?: string | null) => {
      const response = await getCogitaCoreRunState({ libraryId, runId, participantId: participantId ?? undefined });
      setRunState(response);
      return response;
    },
    [libraryId, runId]
  );

  const refreshStatistics = useCallback(async () => {
    const response = await getCogitaCoreRunStatistics({ libraryId, runId });
    setStatistics(response);
    return response;
  }, [libraryId, runId]);

  const initializeParticipant = useCallback(
    async (state: CogitaCoreRunState) => {
      const fallbackDisplayName =
        readStorage(DISPLAY_NAME_STORAGE_KEY, LEGACY_DISPLAY_NAME_STORAGE_KEY) ?? coreCopy.defaultParticipantName;
      const runScope = state.run.runScope;
      const sharedEphemeral = runScope === 'shared';
      const groupScoped = runScope === 'group_sync';

      if (sharedEphemeral) {
        removeStorage(participantKey, legacyParticipantKey);
        removeStorage(groupParticipantsKey, legacyGroupParticipantsKey);
        removeStorage(groupActiveParticipantKey, legacyGroupActiveParticipantKey);
        const existingRecoveryToken = readStorage(sharedRecoveryKey, legacySharedRecoveryKey);
        const joined = await joinCogitaCoreRun({
          libraryId,
          runId,
          displayName: fallbackDisplayName,
          isHost: false,
          recoveryToken: existingRecoveryToken
        });
        if (joined.recoveryToken) {
          writeStorage(sharedRecoveryKey, legacySharedRecoveryKey, joined.recoveryToken);
        } else {
          removeStorage(sharedRecoveryKey, legacySharedRecoveryKey);
        }
        writeStorage(DISPLAY_NAME_STORAGE_KEY, LEGACY_DISPLAY_NAME_STORAGE_KEY, joined.displayName || fallbackDisplayName);
        setGroupParticipants([]);
        setParticipant(joined);
        return joined;
      }

      removeStorage(sharedRecoveryKey, legacySharedRecoveryKey);

      if (groupScoped) {
        removeStorage(participantKey, legacyParticipantKey);
        const storedParticipantIds = parseStoredParticipantIds(readStorage(groupParticipantsKey, legacyGroupParticipantsKey));
        let roster = state.participants.filter((item) => storedParticipantIds.includes(item.participantId));
        if (roster.length === 0) {
          const joined = await joinCogitaCoreRun({
            libraryId,
            runId,
            displayName: fallbackDisplayName,
            isHost: false
          });
          roster = [joined];
        }

        const storedActiveId = readStorage(groupActiveParticipantKey, legacyGroupActiveParticipantKey);
        const activeParticipant = roster.find((item) => item.participantId === storedActiveId) ?? roster[0];
        writeStorage(groupParticipantsKey, legacyGroupParticipantsKey, JSON.stringify(roster.map((item) => item.participantId)));
        writeStorage(groupActiveParticipantKey, legacyGroupActiveParticipantKey, activeParticipant.participantId);
        writeStorage(DISPLAY_NAME_STORAGE_KEY, LEGACY_DISPLAY_NAME_STORAGE_KEY, activeParticipant.displayName || fallbackDisplayName);
        setGroupParticipants(roster);
        setParticipant(activeParticipant);
        return activeParticipant;
      }

      const existingParticipantId = readStorage(participantKey, legacyParticipantKey);
      if (existingParticipantId) {
        const cached = state.participants.find((item) => item.participantId === existingParticipantId);
        if (cached) {
          setGroupParticipants([]);
          setParticipant(cached);
          return cached;
        }
      }

      const joined = await joinCogitaCoreRun({
        libraryId,
        runId,
        displayName: fallbackDisplayName,
        isHost: false,
        recoveryToken: null
      });
      writeStorage(participantKey, legacyParticipantKey, joined.participantId);
      removeStorage(groupParticipantsKey, legacyGroupParticipantsKey);
      removeStorage(groupActiveParticipantKey, legacyGroupActiveParticipantKey);
      writeStorage(DISPLAY_NAME_STORAGE_KEY, LEGACY_DISPLAY_NAME_STORAGE_KEY, joined.displayName || fallbackDisplayName);
      setGroupParticipants([]);
      setParticipant(joined);
      return joined;
    },
    [
      coreCopy.defaultParticipantName,
      groupActiveParticipantKey,
      groupParticipantsKey,
      legacyGroupActiveParticipantKey,
      legacyGroupParticipantsKey,
      legacyParticipantKey,
      legacySharedRecoveryKey,
      libraryId,
      participantKey,
      runId,
      sharedRecoveryKey
    ]
  );

  const loadNextCard = useCallback(async (participantIdOverride?: string | null) => {
    const participantId = participantIdOverride ?? participant?.participantId ?? null;
    if (!participantId) {
      return;
    }
    const response = await getCogitaCoreNextCard({
      libraryId,
      runId,
      participantId,
      participantSeed: participantId
    });
    setNextCard(response);
    setReveal(null);
    setCharComparison(null);
    setAnswer('');
    setPromptShownUtc(new Date().toISOString());
  }, [libraryId, participant, runId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await issueCsrf();
        if (runId === 'new') {
          const runScope = runScopeHint ?? 'solo';
          const created = await createCogitaCoreRun({
            libraryId,
            runScope,
            title: coreCopy.generatedRunTitle,
            status: 'lobby'
          });
          if (typeof window !== 'undefined') {
            const routeMode = runScope === 'group_async'
              ? 'group-async'
              : runScope === 'group_sync'
                ? 'group-sync'
                : runScope === 'shared'
                  ? 'shared'
                  : 'solo';
            window.location.hash = `#/cogita/revision/${routeMode}/${encodeURIComponent(libraryId)}/${encodeURIComponent(created.runId)}`;
          }
          return;
        }

        const state = await refreshRunState();
        const joined = await initializeParticipant(state);
        if (cancelled) return;

        if (state.run.status === 'draft' || state.run.status === 'lobby') {
          await setCogitaCoreRunStatus({
            libraryId,
            runId,
            status: 'active',
            reason: 'participant-joined'
          });
        }

        const updatedState = await refreshRunState(joined.participantId);
        if (cancelled) return;
        await refreshStatistics();

        if (updatedState.run.status !== 'finished' && updatedState.run.status !== 'archived') {
          await loadNextCard(joined.participantId);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : coreCopy.initFailed;
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    coreCopy.generatedRunTitle,
    coreCopy.initFailed,
    initializeParticipant,
    libraryId,
    loadNextCard,
    runScopeHint,
    refreshRunState,
    refreshStatistics,
    runId
  ]);

  useEffect(() => {
    if (!runState) return;
    if (!isGroupScope) {
      setGroupParticipants([]);
      return;
    }
    const storedIds = parseStoredParticipantIds(readStorage(groupParticipantsKey, legacyGroupParticipantsKey));
    let roster = runState.participants.filter((item) => storedIds.includes(item.participantId));
    if (roster.length === 0 && storedIds.length === 0 && participant) {
      const current = runState.participants.find((item) => item.participantId === participant.participantId);
      if (current) {
        roster = [current];
      }
    }
    if (roster.length === 0) return;
    setGroupParticipants(roster);
    writeStorage(groupParticipantsKey, legacyGroupParticipantsKey, JSON.stringify(roster.map((item) => item.participantId)));
    const storedActiveId = readStorage(groupActiveParticipantKey, legacyGroupActiveParticipantKey);
    const nextActive = roster.find((item) => item.participantId === storedActiveId) ?? roster[0];
    writeStorage(groupActiveParticipantKey, legacyGroupActiveParticipantKey, nextActive.participantId);
    if (participant?.participantId !== nextActive.participantId) {
      setParticipant(nextActive);
    }
  }, [
    groupActiveParticipantKey,
    groupParticipantsKey,
    isGroupScope,
    legacyGroupActiveParticipantKey,
    legacyGroupParticipantsKey,
    participant?.participantId,
    runState
  ]);

  useEffect(() => {
    if (runId === 'new') return;
    const mode = normalizeRecentRevisionMode(runState?.run.runScope ?? runScopeHint);
    if (!mode) return;
    pushRecentRevision({
      libraryId,
      runId,
      mode,
      title: runState?.run.title ?? null,
      updatedUtc: new Date().toISOString()
    });
  }, [libraryId, runId, runScopeHint, runState?.run.runScope, runState?.run.title]);

  const submitOutcome = useCallback(
    async (outcomeClass: 'correct' | 'wrong' | 'blank_timeout') => {
      if (!participant || !nextCard?.cardKey || typeof nextCard.roundIndex !== 'number') {
        return;
      }

      setWorking(true);
      setError(null);
      try {
        const start = promptShownUtc ? Date.parse(promptShownUtc) : Date.now();
        const duration = Number.isFinite(start) ? Math.max(0, Date.now() - start) : null;
        const result = await submitCogitaCoreRunAttempt({
          libraryId,
          runId,
          participantId: participant.participantId,
          roundIndex: nextCard.roundIndex,
          cardKey: nextCard.cardKey,
          answer: answer.trim().length > 0 ? answer.trim() : null,
          outcomeClass,
          responseDurationMs: duration,
          promptShownUtc,
          revealedUtc: new Date().toISOString()
        });

        setReveal(result.reveal);
        setCharComparison(result.charComparison ?? null);
        await Promise.all([
          refreshRunState(participant.participantId),
          refreshStatistics()
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : coreCopy.submitFailed;
        setError(message);
      } finally {
        setWorking(false);
      }
    },
    [answer, coreCopy.submitFailed, libraryId, nextCard, participant, promptShownUtc, refreshRunState, refreshStatistics, runId]
  );

  const handleNext = useCallback(async () => {
    if (!participant) return;
    setWorking(true);
    setError(null);
    try {
      await loadNextCard(participant.participantId);
      await refreshRunState(participant.participantId);
    } catch (err) {
      const message = err instanceof Error ? err.message : coreCopy.nextFailed;
      setError(message);
    } finally {
      setWorking(false);
    }
  }, [coreCopy.nextFailed, loadNextCard, participant, refreshRunState]);

  const handleSelectGroupParticipant = useCallback(async (
    nextParticipant: CogitaCoreRunParticipant
  ) => {
    setParticipant(nextParticipant);
    writeStorage(groupActiveParticipantKey, legacyGroupActiveParticipantKey, nextParticipant.participantId);
    setReveal(null);
    setCharComparison(null);
    setNextCard(null);
    setAnswer('');
    setPromptShownUtc(null);
    if (!runState || runState.run.status === 'finished' || runState.run.status === 'archived') {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await loadNextCard(nextParticipant.participantId);
      await refreshRunState(nextParticipant.participantId);
    } catch (err) {
      const message = err instanceof Error ? err.message : coreCopy.nextFailed;
      setError(message);
    } finally {
      setWorking(false);
    }
  }, [
    coreCopy.nextFailed,
    groupActiveParticipantKey,
    legacyGroupActiveParticipantKey,
    loadNextCard,
    refreshRunState,
    runState
  ]);

  const handleAddGroupParticipant = useCallback(async () => {
    if (!runState || !isGroupScope || joiningParticipant) {
      return;
    }
    const fallbackName = `${coreCopy.defaultParticipantName} ${Math.max(2, visibleGroupParticipants.length + 1)}`;
    const displayName = newParticipantName.trim() || fallbackName;
    setJoiningParticipant(true);
    setError(null);
    try {
      const joined = await joinCogitaCoreRun({
        libraryId,
        runId,
        displayName,
        isHost: false
      });
      const nextIds = new Set(parseStoredParticipantIds(readStorage(groupParticipantsKey, legacyGroupParticipantsKey)));
      nextIds.add(joined.participantId);
      writeStorage(groupParticipantsKey, legacyGroupParticipantsKey, JSON.stringify(Array.from(nextIds)));
      writeStorage(groupActiveParticipantKey, legacyGroupActiveParticipantKey, joined.participantId);
      writeStorage(DISPLAY_NAME_STORAGE_KEY, LEGACY_DISPLAY_NAME_STORAGE_KEY, joined.displayName || displayName);
      setNewParticipantName('');
      setParticipant(joined);
      const updatedState = await refreshRunState(joined.participantId);
      const roster = updatedState.participants.filter((item) => nextIds.has(item.participantId));
      setGroupParticipants(roster.length > 0 ? roster : [joined]);
      await refreshStatistics();
      if (updatedState.run.status !== 'finished' && updatedState.run.status !== 'archived') {
        await loadNextCard(joined.participantId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : coreCopy.initFailed;
      setError(message);
    } finally {
      setJoiningParticipant(false);
    }
  }, [
    coreCopy.defaultParticipantName,
    coreCopy.initFailed,
    groupActiveParticipantKey,
    groupParticipantsKey,
    isGroupScope,
    joiningParticipant,
    legacyGroupActiveParticipantKey,
    legacyGroupParticipantsKey,
    libraryId,
    loadNextCard,
    newParticipantName,
    refreshRunState,
    refreshStatistics,
    runId,
    runState,
    visibleGroupParticipants.length
  ]);

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
      <section className="cogita-core-run">
        <header className="cogita-core-run-header">
          <div>
            <p className="cogita-core-run-kicker">{coreCopy.kicker}</p>
            <h1>{runState?.run.title ?? `${coreCopy.defaultRunTitle} ${runId}`}</h1>
            <p>
              {coreCopy.scopeLabel}: <strong>{runState?.run.runScope ?? '-'}</strong> · {coreCopy.statusLabel}: <strong>{runState?.run.status ?? '-'}</strong>
            </p>
            {participant ? <p>{coreCopy.participantLabel}: {participant.displayName}</p> : null}
          </div>
          <div className="cogita-core-run-actions">
            <a className="ghost" href="/#/">{coreCopy.returnToRecreatio}</a>
            <a className="ghost" href="/#/cogita/revision">{coreCopy.backToCogita}</a>
          </div>
        </header>

        {loading ? <p>{coreCopy.loading}</p> : null}
        {error ? <p className="cogita-core-run-error">{error}</p> : null}

        {!loading && isGroupSyncScope ? (
          <article className="cogita-core-run-card">
            <p className="cogita-core-run-kicker">Group sync participants</p>
            <p className="cogita-core-run-trace">Select the active participant before each question.</p>
            <div className="cogita-core-run-outcomes" style={{ flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {visibleGroupParticipants.map((item) => (
                <button
                  key={item.participantId}
                  type="button"
                  className="ghost"
                  onClick={() => void handleSelectGroupParticipant(item)}
                  disabled={interactionLocked || participant?.participantId === item.participantId}
                  style={participant?.participantId === item.participantId ? { borderColor: 'rgba(111, 214, 255, 0.8)' } : undefined}
                >
                  {item.displayName}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr auto' }}>
              <input
                type="text"
                value={newParticipantName}
                onChange={(event) => setNewParticipantName(event.target.value)}
                placeholder="New participant name"
                disabled={interactionLocked}
              />
              <button type="button" className="ghost" onClick={() => void handleAddGroupParticipant()} disabled={interactionLocked}>
                Add participant
              </button>
            </div>
          </article>
        ) : null}

        {!loading && nextCard?.cardKey ? (
          <article className="cogita-core-run-card">
            <p className="cogita-core-run-kicker">{coreCopy.currentPrompt}</p>
            <h2>{nextCard.cardKey}</h2>
            {nextCard.reasonTrace.length > 0 ? (
              <p className="cogita-core-run-trace">{nextCard.reasonTrace.join(' · ')}</p>
            ) : null}

            <label className="cogita-core-run-label" htmlFor="core-answer">
              {coreCopy.answerLabel}
            </label>
            <textarea
              id="core-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={interactionLocked}
              placeholder={coreCopy.answerPlaceholder}
              rows={4}
            />

            <div className="cogita-core-run-outcomes">
              <button type="button" className="ghost" disabled={interactionLocked} onClick={() => void submitOutcome('correct')}>
                {coreCopy.correctAction}
              </button>
              <button type="button" className="ghost" disabled={interactionLocked} onClick={() => void submitOutcome('wrong')}>
                {coreCopy.wrongAction}
              </button>
              <button type="button" className="ghost" disabled={interactionLocked} onClick={() => void submitOutcome('blank_timeout')}>
                {coreCopy.blankTimeoutAction}
              </button>
            </div>
          </article>
        ) : null}

        {!loading && !nextCard?.cardKey && !reveal ? (
          <article className="cogita-core-run-card">
            <p>{coreCopy.noCardSelected}</p>
            <button type="button" className="ghost" disabled={interactionLocked} onClick={() => void handleNext()}>
              {coreCopy.selectNextCardAction}
            </button>
          </article>
        ) : null}

        {reveal ? (
          <article className="cogita-core-run-reveal">
            <p className="cogita-core-run-kicker">{coreCopy.revealTitle}</p>
            <h2>{reveal.cardKey}</h2>
            <p>
              {coreCopy.correctAnswerLabel}: <strong>{reveal.correctAnswer ?? '-'}</strong>
            </p>
            <p>
              {coreCopy.participantAnswerLabel}: <strong>{reveal.participantAnswer ?? '-'}</strong>
            </p>
            {charComparison ? (
              <p>
                Character match: {charComparison.similarityPct.toFixed(2)}% ({charComparison.mismatchCount}/{charComparison.comparedLength} mismatches)
              </p>
            ) : null}
            {charComparison && charComparison.mismatchesPreview.length > 0 ? (
              <p className="cogita-core-run-trace">
                Mismatch preview:{' '}
                {charComparison.mismatchesPreview
                  .slice(0, 6)
                  .map((entry) => `#${entry.index} '${entry.expected ?? '∅'}'→'${entry.actual ?? '∅'}'`)
                  .join(' · ')}
              </p>
            ) : null}
            <p>
              {coreCopy.distributionLabel}: {reveal.outcomeDistribution.correctPct.toFixed(1)}% {coreCopy.correctLabel.toLowerCase()} · {reveal.outcomeDistribution.wrongPct.toFixed(1)}% {coreCopy.wrongLabel.toLowerCase()} ·{' '}
              {reveal.outcomeDistribution.blankTimeoutPct.toFixed(1)}% {coreCopy.blankLabel.toLowerCase()}
            </p>
            {reveal.scoreFactors.length > 0 ? (
              <p>
                {coreCopy.scoreFactorsLabel}:{' '}
                {reveal.scoreFactors
                  .map((factor) => `${factor.factor} ${factor.points >= 0 ? '+' : ''}${factor.points}`)
                  .join(' · ')}
              </p>
            ) : null}
            <p>{coreCopy.totalPointsLabel}: {reveal.totalPoints}</p>
            <button type="button" className="ghost" disabled={interactionLocked} onClick={() => void handleNext()}>
              {coreCopy.nextCardAction}
            </button>
          </article>
        ) : null}

        {statistics ? (
          <article className="cogita-core-run-stats">
            <p className="cogita-core-run-kicker">{coreCopy.statsTitle}</p>
            <p>
              {coreCopy.attemptsLabel}: {statistics.totalAttempts} · {coreCopy.correctLabel}: {statistics.totalCorrect} · {coreCopy.wrongLabel}: {statistics.totalWrong} · {coreCopy.blankLabel}: {statistics.totalBlankTimeout}
            </p>
            <p>
              {coreCopy.knownessLabel}: {statistics.knownessScore.toFixed(2)}% · {coreCopy.pointsLabel}: {statistics.totalPoints}
            </p>
            {statistics.participants.length > 0 ? (
              <div className="cogita-core-run-participants">
                {statistics.participants.map((item) => (
                  <div
                    key={item.participantId}
                    className="cogita-core-run-participant-row"
                    style={participant?.participantId === item.participantId ? { borderColor: 'rgba(111, 214, 255, 0.75)' } : undefined}
                  >
                    <strong>{item.displayName}</strong>
                    <span>
                      {item.correctCount}/{item.attemptCount} {coreCopy.correctLabel.toLowerCase()} · {coreCopy.knownessLabel.toLowerCase()} {item.knownessScore.toFixed(1)} · {coreCopy.pointsLabel.toLowerCase()} {item.totalPoints}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}
      </section>
    </CogitaShell>
  );
}
