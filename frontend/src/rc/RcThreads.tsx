/**
 * Themen, Fragen, Anhänge, Stellungnahmen.
 *
 * Der Chat ist der Strom; das hier ist die Ordnung, die nachträglich
 * hineingelegt wird. Drei Entscheidungen tragen das:
 *
 *   1. **Ein Thema entsteht aus markierten Beiträgen**, nicht aus einem leeren
 *      Ordner. Wer zuerst den Ordner anlegt, benennt eine Vermutung; wer zuerst
 *      markiert, benennt, was tatsächlich zusammengehört.
 *
 *   2. **Eine zurückgehaltene Auszählung ist eine Zusage, keine Lücke** (9.5).
 *      „Noch keine Stimmen" wäre gelogen — es sind welche da, sie werden nur
 *      niemandem gezeigt. Also steht der Grund da, nicht eine Null.
 *
 *   3. **Die drei Stellungnahmen stehen ausgeschrieben** (9.8). Ein Häkchen
 *      kann „gelesen" oder „einverstanden" heissen, und in einer Sitzung ist
 *      genau dieser Unterschied der ganze Punkt.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rcCopy, rcFormat, rcPlural, type RcLang } from './i18n';
import { RcRequestError } from './lib/rcApi';
import type { RcRole } from './lib/rcChat';
import {
  RC_POLL_MODES, RC_POLL_REVEALS, RC_REACTION_AGREE, RC_REACTION_NOTED, RC_REACTION_OBJECT,
  rcAttachmentUrl, rcAttachments, rcCloseTopic, rcClosePoll, rcCreatePoll, rcCreateTopic,
  rcDeleteAttachment, rcPolls, rcReact, rcTallyHidden, rcTallyRows, rcTopics, rcUpload, rcVote,
  type RcAttachment, type RcPoll, type RcPollMode, type RcPollReveal, type RcReaction, type RcTopic
} from './lib/rcThreads';

export function useRcError(lang: RcLang) {
  return useCallback((e: unknown): string => {
    const auth = rcCopy[lang].auth;
    return e instanceof RcRequestError ? auth.errors[e.code] ?? auth.unknownError : auth.unknownError;
  }, [lang]);
}

// -- Themen -------------------------------------------------------------------

export function RcTopics({
  lang, areaId, selection, onClearSelection, onError
}: {
  lang: RcLang;
  areaId: string;
  /** Was im Gespräch gerade markiert ist — daraus entsteht ein Thema. */
  selection: readonly string[];
  onClearSelection: () => void;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].threads;
  const describe = useRcError(lang);

  const [topics, setTopics] = useState<readonly RcTopic[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setTopics((await rcTopics(areaId)).topics ?? []); }
    catch (e) { onError(describe(e)); }
  }, [areaId, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = async () => {
    if (title.trim().length === 0 || busy) return;
    setBusy(true);
    try {
      await rcCreateTopic(areaId, title, selection.length > 0 ? selection : undefined);
      setTitle('');
      onClearSelection();
      await refresh();
    } catch (e) {
      onError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rc-panel">
      {topics.length === 0 && <p className="rc-note">{t.noTopics}</p>}

      <ul className="rc-topic-list">
        {topics.map((topic) => (
          <li key={topic.topicId} className="rc-topic" data-closed={topic.closed}>
            <div className="rc-topic-main">
              <span className="rc-topic-title">{topic.title ?? topic.topicId.slice(0, 8)}</span>
              <span className="rc-topic-meta">
                {rcPlural(lang, t.inTopic, topic.messageCount)}
                {topic.closed && <> · {t.closed}</>}
              </span>
            </div>
            <button
              type="button"
              className="rc-btn rc-btn-quiet"
              onClick={async () => {
                try { await rcCloseTopic(topic.topicId, topic.closed); await refresh(); }
                catch (e) { onError(describe(e)); }
              }}
            >
              {topic.closed ? t.reopen : t.close}
            </button>
          </li>
        ))}
      </ul>

      <form className="rc-new-topic" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <label className="rc-field">
          <span>{t.newTopic}</span>
          <input
            type="text"
            value={title}
            placeholder={t.topicTitle}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        {/* Was aus der Markierung wird, steht vorher da. „Thema anlegen" ohne
            zu sagen, was hineinwandert, ist eine Überraschung, keine Handlung. */}
        <p className="rc-note rc-topic-from">
          {selection.length > 0
            ? rcPlural(lang, t.topicFrom, selection.length)
            : t.pickFirst}
        </p>

        <button type="submit" className="rc-btn" disabled={busy || title.trim().length === 0}>
          {t.newTopic}
        </button>
      </form>
    </div>
  );
}

// -- Fragen -------------------------------------------------------------------

export function RcPolls({
  lang, areaId, role, onError
}: {
  lang: RcLang;
  areaId: string;
  role: RcRole | undefined;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].threads;
  const describe = useRcError(lang);

  const [polls, setPolls] = useState<readonly RcPoll[]>([]);
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<RcPollMode>('single');
  const [reveal, setReveal] = useState<RcPollReveal>('immediate');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setPolls((await rcPolls(areaId)).polls ?? []); }
    catch (e) { onError(describe(e)); }
  }, [areaId, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  const modeLabel: Record<RcPollMode, string> = {
    single: t.modeSingle, multi: t.modeMulti, quiz: t.modeQuiz
  };
  const revealLabel: Record<RcPollReveal, string> = {
    immediate: t.revealImmediate, on_close: t.revealOnClose
  };

  return (
    <div className="rc-panel">
      {polls.length === 0 && <p className="rc-note">{t.noPolls}</p>}

      {polls.map((poll) => (
        <RcPollCard
          key={poll.pollId}
          lang={lang}
          poll={poll}
          role={role}
          onChanged={refresh}
          onError={onError}
        />
      ))}

      <form
        className="rc-new-poll"
        onSubmit={async (e) => {
          e.preventDefault();
          if (question.trim().length === 0 || busy) return;
          setBusy(true);
          try {
            await rcCreatePoll(areaId, question, mode, reveal);
            setQuestion('');
            await refresh();
          } catch (err) {
            onError(describe(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="rc-field">
          <span>{t.newPoll}</span>
          <input
            type="text"
            value={question}
            placeholder={t.question}
            disabled={busy}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>

        <div className="rc-poll-opts">
          <label className="rc-inline-field">
            <span>{t.mode}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as RcPollMode)}>
              {RC_POLL_MODES.map((m) => <option key={m} value={m}>{modeLabel[m]}</option>)}
            </select>
          </label>

          <label className="rc-inline-field">
            <span>{t.reveal}</span>
            <select value={reveal} onChange={(e) => setReveal(e.target.value as RcPollReveal)}>
              {RC_POLL_REVEALS.map((r) => <option key={r} value={r}>{revealLabel[r]}</option>)}
            </select>
          </label>
        </div>

        {/* Der Grund steht nur da, wenn er gerade greift. Eine Erklärung, die
            immer sichtbar ist, liest nach dem zweiten Mal niemand mehr. */}
        {reveal === 'on_close' && <p className="rc-note rc-poll-why">{t.revealWhy}</p>}

        <button type="submit" className="rc-btn" disabled={busy || question.trim().length === 0}>
          {t.ask}
        </button>
      </form>
    </div>
  );
}

function RcPollCard({
  lang, poll, role, onChanged, onError
}: {
  lang: RcLang;
  poll: RcPoll;
  role: RcRole | undefined;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].threads;
  const describe = useRcError(lang);

  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = rcTallyRows(poll);
  const hidden = rcTallyHidden(poll);
  const most = rows.length > 0 ? rows[0][1] : 0;

  return (
    <article className="rc-poll" data-closed={poll.closed}>
      <header className="rc-poll-head">
        <h4>{poll.question ?? poll.pollId.slice(0, 8)}</h4>
        <span className="rc-poll-meta">
          {rcPlural(lang, t.votes, poll.voteCount)}
          {poll.closed && <> · {t.pollClosed}</>}
        </span>
      </header>

      {/* Zurückgehalten ist NICHT dasselbe wie leer. Eine Null hier wäre eine
          Falschaussage über etwas, das es sehr wohl gibt. */}
      {hidden ? (
        <p className="rc-note rc-poll-sealed">{t.tallySealed}</p>
      ) : (
        <ul className="rc-tally">
          {rows.map(([answer, count]) => (
            <li key={answer}>
              <span className="rc-tally-a">{answer}</span>
              <span className="rc-tally-bar" style={{ '--rc-share': most > 0 ? count / most : 0 } as React.CSSProperties} />
              <span className="rc-tally-n">{count}</span>
            </li>
          ))}
        </ul>
      )}

      {poll.yourChoice !== null && poll.yourChoice !== undefined && (
        <p className="rc-poll-yours">
          {rcFormat('{label}: {answer}', { label: t.voted, answer: poll.yourChoice })}
        </p>
      )}

      {!poll.closed && role && (
        <form
          className="rc-poll-vote"
          onSubmit={async (e) => {
            e.preventDefault();
            if (choice.trim().length === 0 || busy) return;
            setBusy(true);
            try { await rcVote(poll.pollId, role.roleId, choice); setChoice(''); await onChanged(); }
            catch (err) { onError(describe(err)); }
            finally { setBusy(false); }
          }}
        >
          <input
            type="text"
            value={choice}
            placeholder={t.yourAnswer}
            maxLength={200}
            disabled={busy}
            onChange={(e) => setChoice(e.target.value)}
            /* Was schon geantwortet wurde, als Vorschlag: sonst landen „ja" und
               „Ja" in zwei Töpfen und die Auszählung zerfasert. */
            list={rows.length > 0 ? `rc-answers-${poll.pollId}` : undefined}
          />
          {rows.length > 0 && (
            <datalist id={`rc-answers-${poll.pollId}`}>
              {rows.map(([answer]) => <option key={answer} value={answer} />)}
            </datalist>
          )}
          <button type="submit" className="rc-btn" disabled={busy || choice.trim().length === 0}>
            {poll.yourChoice ? t.changeVote : t.vote}
          </button>
        </form>
      )}

      {!poll.closed && (
        <button
          type="button"
          className="rc-btn rc-btn-quiet"
          onClick={async () => {
            try { await rcClosePoll(poll.pollId); await onChanged(); }
            catch (e) { onError(describe(e)); }
          }}
        >
          {t.closePoll}
        </button>
      )}
    </article>
  );
}

// -- Anhänge ------------------------------------------------------------------

export function RcAttachments({
  lang, messageId, count, mine, onError
}: {
  lang: RcLang;
  messageId: string;
  /** Was der Verlauf schon weiss. Bei null wird gar nicht erst gefragt. */
  count: number;
  /** Anhängen darf nur, wem der Beitrag gehört (9.10). */
  mine: boolean;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].threads;
  const describe = useRcError(lang);

  const [files, setFiles] = useState<readonly RcAttachment[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setFiles((await rcAttachments(messageId)).attachments ?? []); }
    catch (e) { onError(describe(e)); }
  }, [messageId, describe, onError]);

  // Der Verlauf hat die Zahl schon mitgebracht. Steht sie auf null, gibt es
  // nichts zu holen — und eine Anfrage, die verlässlich eine leere Liste
  // zurückbringt, ist reine Last.
  useEffect(() => { if (count > 0) void refresh(); }, [count, refresh]);

  /**
   * Die Blob-Adresse wird sofort nach dem Öffnen wieder eingezogen. Sie hält
   * den ENTSCHLÜSSELTEN Inhalt im Speicher des Tabs; sie liegen zu lassen
   * hiesse, den Klartext dort zu sammeln, wo er gerade nicht hingehört.
   */
  const open = async (id: string) => {
    try {
      const url = await rcAttachmentUrl(id);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      onError(describe(e));
    }
  };

  return (
    <div className="rc-files">
      {files.length > 0 && (
        <ul className="rc-file-list">
          {files.map((file) => (
            <li key={file.attachmentId}>
              <button type="button" className="rc-link" onClick={() => void open(file.attachmentId)}>
                {file.fileName ?? file.attachmentId.slice(0, 8)}
              </button>
              <span className="rc-file-size">{rcBytes(file.sizeBytes)}</span>

              {/* Entfernen darf der Eigentümer — und die Leitung des Bereichs,
                  die das hier nicht sieht. Einen Knopf zu zeigen, der für die
                  meisten Leser zuverlässig mit einer Absage endet, ist
                  schlechter als keiner: er sieht aus wie eine Befugnis. */}
              {mine && (
                <button
                  type="button"
                  className="rc-msg-action"
                  onClick={async () => {
                    try { await rcDeleteAttachment(file.attachmentId); await refresh(); }
                    catch (e) { onError(describe(e)); }
                  }}
                >
                  {t.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {mine && (
        <label className="rc-attach">
          <input
            type="file"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file === undefined) return;
              setBusy(true);
              try { await rcUpload(messageId, file); await refresh(); }
              catch (err) { onError(describe(err)); }
              finally { setBusy(false); e.target.value = ''; }
            }}
          />
          <span>{busy ? t.uploading : t.attach}</span>
        </label>
      )}
    </div>
  );
}

/** Byte-Zahlen für Menschen. Keine Zusammensetzung aus Satzteilen — nur Zahl und Einheit. */
function rcBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// -- Stellungnahme ------------------------------------------------------------

export function RcReactions({
  lang, messageId, role, mine, tally, onError
}: {
  lang: RcLang;
  messageId: string;
  role: RcRole | undefined;
  mine: RcReaction | null;
  /** Art -> Anzahl. Was nicht vorkommt, steht nicht drin (siehe unten). */
  tally: Readonly<Record<string, number>>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].threads;
  const describe = useRcError(lang);
  const [chosen, setChosen] = useState<RcReaction | null>(mine);

  // Nach einem Neuladen gilt, was der Server sagt — nicht, was ein früherer
  // Klick im Speicher hinterlassen hat.
  useEffect(() => { setChosen(mine); }, [mine]);

  const labels = useMemo(() => ({
    [RC_REACTION_AGREE]: t.agree,
    [RC_REACTION_NOTED]: t.noted,
    [RC_REACTION_OBJECT]: t.object
  }), [t]);

  if (role === undefined) return null;

  const pick = async (kind: RcReaction) => {
    // Dieselbe noch einmal heisst: zurücknehmen. Sonst gäbe es keinen Weg
    // zurück ausser einer zweiten, falschen Haltung.
    const next = chosen === kind ? null : kind;
    setChosen(next);
    try { await rcReact(messageId, role.roleId, next); }
    catch (e) { setChosen(chosen); onError(describe(e)); }
  };

  return (
    <div className="rc-react" title={t.reactWhy}>
      {([RC_REACTION_AGREE, RC_REACTION_NOTED, RC_REACTION_OBJECT] as RcReaction[]).map((kind) => {
        const n = tally[String(kind)] ?? 0;
        return (
          <button
            key={kind}
            type="button"
            className="rc-react-btn"
            aria-pressed={chosen === kind}
            onClick={() => void pick(kind)}
          >
            {labels[kind]}
            {/* Eine Null neben „ich widerspreche" liest sich wie eine Aussage
                über die Sitzung, die niemand getroffen hat. Also nichts. */}
            {n > 0 && <span className="rc-react-n">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
