/**
 * COGITA — SITZUNGEN (COGITA.md §10): anlegen, führen, mitmachen, an die Wand
 * werfen.
 *
 * <code>
 *   live     ein Gastgeber, Teilnehmer, eine Leinwand — Regeln, Punkte, Teams
 *   async    eine Aufgabe für die Gruppe: jeder wiederholt im eigenen Tempo bis zur Frist
 *   sync     mehrere Menschen an einem Gerät, sie wechseln sich ab
 *   story    eine Erzählung mit Code: Antworten und Versuche je Schritt, Ergebnisse für den Besitzer
 *   game     ein Spiel im Gelände
 * </code>
 *
 * Der Gastgeber zählt: er öffnet die Antworten (Annahme des Bereichs) und gibt
 * Punkte und Aufdeckungen versiegelt an alle. Fragen gehen OHNE Antworten
 * hinaus [L3]; die richtige Antwort erst mit dem Aufdecken.
 */

import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { saveEvent } from '../calendar/agenda';
import { loadAreas, myEpochKeys, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { loadIntake, openIntakeKey } from '../forms/intake';
import { newId } from '../core/ids';
import { AnswerInput, answerText, Verdict } from './CardFace';
import { checkCard } from './cards';
import { type Card } from './cardBasics';
import { contentOfBundle, FlowPlayer } from './FlowPlayer';
import { readFlow, resolveFlow } from './flow';
import { readGame } from './game';
import { GameHost, GamePlay } from './GamePanel';
import { intakeOf, type Learner } from './learn';
import {
  connect, createSession, deleteSession, deliverSessionKeys, joinLink, loadSessions, openEvent, openTitle, postEvents,
  sealForIntake, sealForSession, sessionKeyOf, SESSION_KIND_LABEL, setSessionState, stripCard,
  type Credentials, type SessionEvent, type SessionKind, type SessionRow
} from './live';
import { startGame } from './game';
import { describeRules, DEFAULT_RULES, onAllAnswered, onFirstAnswer, PRESETS, readRules, roundDeadline, scoreRound, type LiveRules, type Move, type Points } from './rules';
import { planFor } from './RevisionRun';
import { RevisionRun } from './RevisionRun';
import { PublicRevisionRun } from './PublicRun';
import { loadPublishedOne } from '../library/library';
import { publicFileUrl } from './files';
import type { PublicFlow } from './publish';
import { CogitaContext, useBusy, useCtx } from './ui';
import { askText } from '../ui/dialogs';
import { Loading } from '../ui/Loading';

/* -- Was in den Ereignissen steht ----------------------------------------------------------- */

interface Config { readonly title: string; readonly total: number; readonly rules: LiveRules; readonly revisionId?: string; readonly flowId?: string; readonly view?: string }
interface Question { readonly index: number; readonly total: number; readonly card: Card; readonly startedAt: number; readonly deadline: number | null }
interface Reveal { readonly index: number; readonly card: Card; readonly answered: number; readonly correct: number; readonly scores: readonly Score[]; readonly teams: readonly { team: string; total: number }[] }
interface Score { readonly participant: string; readonly name: string; readonly team: string | null; readonly total: number; readonly last: Points | null }
interface Join { readonly participant: string; readonly name: string; readonly team: string | null; readonly device: string }
interface Answer { readonly participant: string; readonly device: string; readonly index: number; readonly given: unknown; readonly at: number; readonly step?: string; readonly correctness?: number; readonly attempt?: number }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const last = <T,>(list: readonly T[]): T | undefined => list[list.length - 1];

const DEVICE = 'recreatio:cogita:device';
const deviceId = (): string => {
  try { let d = localStorage.getItem(DEVICE); if (d === null) { d = newId(); localStorage.setItem(DEVICE, d); } return d; } catch { return 'tab'; }
};

/* -- Die Liste ------------------------------------------------------------------------------- */

export function SessionsTab({ trail, go }: { trail: readonly string[]; go: (...tail: string[]) => void }) {
  const { lib, writes, me } = useCtx();
  const [rows, setRows] = useState<readonly SessionRow[] | null>(null);
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(new Map());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void loadSessions(undefined, lib.libraryId).then(async (r) => {
      if (!alive) return;
      setRows(r.sessions);
      if (me === null) return;
      const names = new Map<string, string>();
      for (const s of r.sessions) {
        try {
          const area = await myEpochKeys(me.ring, s.areaId);
          const key = area.get(s.epoch);
          if (key !== undefined) names.set(s.sessionId, (await openTitle(await sessionKeyOf(key, s.sessionId, s.epoch), s)) ?? 'Sesja');
        } catch { /* ohne Namen */ }
      }
      if (alive) setTitles(names);
    }, () => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [lib.libraryId, me, tick]);

  const open = trail[0];
  const chosen = rows?.find((r) => r.sessionId === open);
  if (open !== undefined && chosen !== undefined) {
    return chosen.host
      ? <SessionHost session={chosen} title={titles.get(chosen.sessionId) ?? 'Sesja'} screen={trail[1] === 'ekran'} onBack={() => { go(); setTick((n) => n + 1); }} />
      : <SessionJoinAsMember session={chosen} title={titles.get(chosen.sessionId) ?? 'Sesja'} onBack={() => go()} />;
  }

  return (
    <div className="cg">
      {writes && me !== null && <NewSession onMade={(id) => { setTick((n) => n + 1); go(id); }} />}
      {rows === null ? <Loading label="Wczytywanie sesji…" /> : rows.length === 0 ? <p className="wk-empty">Nie ma jeszcze sesji tej bazy wiedzy.</p> : (
        <ul className="lib-list">
          {rows.map((s) => (
            <li key={s.sessionId}>
              <button type="button" className="lib-row cg-card" onClick={() => go(s.sessionId)}>
                <span className="lib-row-title">{titles.get(s.sessionId) ?? 'Sesja'} <span className="cg-tag">{SESSION_KIND_LABEL[s.kind]}</span> <span className={`cg-tag${s.state === 'running' ? ' is-ok' : ''}`}>{{ lobby: 'czeka', running: 'trwa', paused: 'przerwa', finished: 'zakończona', closed: 'zamknięta' }[s.state]}</span></span>
                <span className="lib-row-meta">{new Date(s.createdAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}{s.joinCode !== null ? ` · kod ${s.joinCode}` : ''}{s.host ? ' · prowadzisz' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewSession({ onMade }: { onMade: (id: string) => void }) {
  const { lib, me } = useCtx();
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [kind, setKind] = useState<SessionKind>('live');
  const [title, setTitle] = useState('');
  const [areaId, setAreaId] = useState(lib.areaId);
  const [revision, setRevision] = useState(lib.docs('revision')[0]?.id ?? '');
  const [flow, setFlow] = useState(lib.docs('flow')[0]?.id ?? '');
  const [preset, setPreset] = useState('balanced_duel');
  const [link, setLink] = useState(true);
  const [code, setCode] = useState(true);
  const [ends, setEnds] = useState('');
  const { busy, failed, run } = useBusy();
  useEffect(() => { void loadAreas().then((r) => setAreas(r.areas)).catch(() => undefined); }, []);
  if (me === null) return null;
  const host = me.roles.find((r) => r.kind === 'person') ?? me.person;
  return (
    <details className="cg-card">
      <summary>+ Nowa sesja</summary>
      <div className="cg">
        <label className="wk-field"><span>Rodzaj</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as SessionKind)}>{(['live', 'async', 'sync', 'story', 'game'] as const).map((k) => <option key={k} value={k}>{SESSION_KIND_LABEL[k]}</option>)}</select>
        </label>
        <label className="wk-field"><span>Tytuł</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Quiz na festynie" /></label>
        <label className="wk-field"><span>W obszarze (klasa, grupa) — tam trafiają wyniki</span>
          <AreaPick label="W obszarze" areas={areas} value={areaId} onChange={setAreaId}
            only={areas.filter((a) => a.areaId !== lib.areaId && (a.myLevel === 'write' || a.myLevel === 'admin'))}
            extras={[{ value: lib.areaId, label: 'obszar bazy wiedzy' }]} />
        </label>
        {(kind === 'live' || kind === 'async' || kind === 'sync') && (
          <label className="wk-field"><span>Powtórka (pytania)</span>
            <select value={revision} onChange={(e) => setRevision(e.target.value)}>{lib.docs('revision').map((e) => <option key={e.id} value={e.id}>{String(e.data.name ?? 'Powtórka')}</option>)}</select>
          </label>
        )}
        {(kind === 'story' || kind === 'game') && (
          <label className="wk-field"><span>Przebieg</span>
            <select value={flow} onChange={(e) => setFlow(e.target.value)}>{lib.docs('flow').map((e) => <option key={e.id} value={e.id}>{String(e.data.name ?? 'Przebieg')}</option>)}</select>
          </label>
        )}
        {kind === 'live' && (
          <label className="wk-field"><span>Zasady</span>
            <select value={preset} onChange={(e) => setPreset(e.target.value)}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {lib.docs('rules').map((e) => <option key={e.id} value={`doc:${e.id}`}>{String(e.data.name ?? 'Własne zasady')}</option>)}
            </select>
          </label>
        )}
        {kind === 'live' && <p className="wk-hint">{(preset.startsWith('doc:') ? [] : PRESETS.find((p) => p.id === preset)?.says ?? '')}</p>}
        {kind === 'async' && <label className="wk-field"><span>Do kiedy</span><input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} /></label>}
        {(kind === 'live' || kind === 'story' || kind === 'game') && (
          <div className="cg-row">
            <label className="pe-check"><input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} /><span>link z kodem QR (każdy, kto go ma, dołącza i widzi pytania)</span></label>
            <label className="pe-check"><input type="checkbox" checked={code} onChange={(e) => setCode(e.target.checked)} /><span>kod do wpisania</span></label>
          </div>
        )}
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => {
          const keys = await myEpochKeys(me.ring, areaId);
          const epoch = Math.max(...keys.keys());
          const areaKey = keys.get(epoch);
          if (areaKey === undefined) throw new Error('Nie masz klucza tego obszaru.');
          const rules = preset.startsWith('doc:') ? readRules(lib.docs('rules').find((e) => `doc:${e.id}` === preset)?.data.rules) : PRESETS.find((p) => p.id === preset)?.rules ?? DEFAULT_RULES;
          const made = await createSession({
            areaId, libraryId: lib.libraryId, kind, epoch, title: title.trim() || SESSION_KIND_LABEL[kind], hostRoleId: host.id,
            joinLink: link && kind !== 'async' && kind !== 'sync', joinCode: code && kind !== 'async' && kind !== 'sync',
            endsAt: kind === 'async' && ends !== '' ? new Date(ends).toISOString() : null, pagePath: lib.settings().joinPage ?? null
          }, areaKey);
          if (made.secret !== null) rememberSecret(made.session.sessionId, made.secret);
          const config: Config = { title: title.trim() || SESSION_KIND_LABEL[kind], total: 0, rules, ...(revision !== '' && (kind === 'live' || kind === 'async' || kind === 'sync') ? { revisionId: revision } : {}), ...(flow !== '' && (kind === 'story' || kind === 'game') ? { flowId: flow } : {}) };
          const eventId = newId();
          await postEvents(made.session.sessionId, [
            { eventId, kind: 'config', epoch, sealed: await sealForSession(made.key, eventId, config) },
            { eventId: newId(), kind: 'meta', epoch, plain: JSON.stringify({ revision: config.revisionId ?? null, flow: config.flowId ?? null, library: lib.libraryId }) }
          ]);
          onMade(made.session.sessionId);
        })}>{busy ? 'Tworzenie…' : 'Utwórz sesję'}</button>
        {failed !== null && <p className="wk-error">{failed}</p>}
      </div>
    </details>
  );
}

const SECRETS = 'recreatio:cogita:secrets';
function rememberSecret(sessionId: string, secret: string) {
  try { const all = JSON.parse(localStorage.getItem(SECRETS) ?? '{}') as Record<string, string>; all[sessionId] = secret; localStorage.setItem(SECRETS, JSON.stringify(all)); } catch { /* nur jetzt */ }
}
function secretOf(sessionId: string): string | null {
  try { return (JSON.parse(localStorage.getItem(SECRETS) ?? '{}') as Record<string, string>)[sessionId] ?? null; } catch { return null; }
}

/* -- Ereignisse lesen ------------------------------------------------------------------------- */

interface Opened { readonly event: SessionEvent; readonly body: unknown }

/** Verbunden bleiben und jedes Ereignis öffnen, das dieser Browser öffnen kann. */
function useEvents(sessionId: string, cred: Credentials, keys: ReadonlyMap<number, Uint8Array>, intake: Uint8Array | null): { opened: readonly Opened[]; raw: readonly SessionEvent[]; poke: () => void; live: boolean; session: SessionRow | null } {
  const [opened, setOpened] = useState<readonly Opened[]>([]);
  const [raw, setRaw] = useState<readonly SessionEvent[]>([]);
  const [session, setSession] = useState<SessionRow | null>(null);
  const conn = useRef<{ poke: () => void; realtime: () => boolean } | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    setOpened([]);
    setRaw([]);
    const c = connect(sessionId, cred, {
      onEvents: (events) => {
        setRaw((was) => [...was, ...events]);
        void Promise.all(events.map(async (event) => ({ event, body: await openEvent(event, { session: (e) => keys.get(e), intake }) })))
          .then((done) => setOpened((was) => [...was, ...done].sort((a, b) => a.event.seq - b.event.seq)));
      },
      onState: setSession
    });
    conn.current = c;
    const t = window.setInterval(() => setLive(c.realtime()), 3000);
    return () => { c.close(); window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, cred.join, cred.seat, keys.size, intake === null]);
  return { opened, raw, poke: () => conn.current?.poke(), live, session };
}

function bodies<T>(opened: readonly Opened[], kind: string): { body: T; event: SessionEvent }[] {
  return opened.filter((o) => o.event.kind === kind && isObject(o.body)).map((o) => ({ body: o.body as T, event: o.event }));
}

/* -- Der Gastgeber ---------------------------------------------------------------------------- */

function SessionHost({ session, title, screen, onBack }: { session: SessionRow; title: string; screen: boolean; onBack: () => void }) {
  const { lib, me, href } = useCtx();
  const [keys, setKeys] = useState<ReadonlyMap<number, Uint8Array>>(new Map());
  const [intakeKey, setIntakeKey] = useState<Uint8Array | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, failed, run } = useBusy();
  const cred = useMemo<Credentials>(() => ({}), []);

  useEffect(() => {
    if (me === null) return;
    void (async () => {
      const area = await myEpochKeys(me.ring, session.areaId);
      const out = new Map<number, Uint8Array>();
      for (const [epoch, key] of area) out.set(epoch, await sessionKeyOf(key, session.sessionId, epoch));
      setKeys(out);
      void deliverSessionKeys(session.sessionId, out, session.hostRoleId).catch(() => undefined);
      try { setIntakeKey(await openIntakeKey(await loadIntake(session.areaId), me.ring)); }
      catch { setProblem('Nie masz klucza przyjęć tego obszaru — odpowiedzi uczestników z kodem nie da się otworzyć. Odpowiedzi w obszarze odczyta ten, kto prowadzi przyjęcia.'); }
    })();
  }, [me, session.areaId, session.sessionId, session.hostRoleId]);

  const { opened, raw, poke, live } = useEvents(session.sessionId, cred, keys, intakeKey);
  const config = last(bodies<Config>(opened, 'config'))?.body ?? null;
  const epoch = Math.max(0, ...keys.keys());
  const key = keys.get(epoch);

  const post = useCallback(async (kind: string, body: unknown, plain?: unknown) => {
    if (key === undefined) return;
    const eventId = newId();
    await postEvents(session.sessionId, [
      { eventId, kind, epoch, sealed: await sealForSession(key, eventId, body) },
      ...(plain === undefined ? [] : [{ eventId: newId(), kind: kind === 'question' ? 'slot' : `${kind}-p`, epoch, plain: JSON.stringify(plain) }])
    ]);
    poke();
  }, [key, epoch, session.sessionId, poke]);

  const secret = secretOf(session.sessionId);
  const page = session.pagePath ?? lib.settings().joinPage ?? null;
  const link = secret !== null && key !== undefined && page !== null ? joinLink(page, session.sessionId, secret, key, epoch) : null;

  const head = (
    <div className="cg-row-between">
      <span className="cg-row">
        <button type="button" className="wk-link-btn" onClick={onBack}>← sesje</button>
        <strong>{title}</strong>
        <span className="cg-tag">{SESSION_KIND_LABEL[session.kind]}</span>
        <span className={`cg-tag${live ? ' is-ok' : ''}`}>{live ? 'na żywo' : 'odświeżanie co 2 s'}</span>
      </span>
      <span className="cg-row">
        {session.kind === 'live' && <a className="wk-link-btn" href={href('sesje', session.sessionId, 'ekran')} target="_blank" rel="noreferrer">Ekran dla sali ↗</a>}
        {session.state !== 'closed' && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => setSessionState(session.sessionId, 'closed'))}>Zamknij sesję</button>}
        <button type="button" className="wk-link-btn" disabled={busy} onClick={async () => { if (await askText('Usunąć sesję z wynikami?')) void run(async () => { await deleteSession(session.sessionId); onBack(); }); }}>Usuń</button>
      </span>
    </div>
  );

  return (
    <div className="cg-live">
      {!screen && head}
      {!screen && (session.joinCode !== null || link !== null) && (
        <div className="cg-row">
          {session.joinCode !== null && <div className="cg-card"><span className="cg-muted">Kod</span><span className="cg-live-code">{session.joinCode}</span></div>}
          {link !== null && <div className="cg-card"><span className="cg-muted">Link z kluczem</span><div className="cg-qr"><QRCodeSVG value={link} size={150} /></div><button type="button" className="wk-link-btn" onClick={() => void navigator.clipboard?.writeText(link)}>Kopiuj link</button></div>}
          {link === null && secret !== null && <p className="wk-hint">Żeby dołączać linkiem, ustaw w Ustawieniach bazy wiedzy stronę dołączania (z modułem „Dołącz do sesji").</p>}
        </div>
      )}
      {!screen && session.state !== 'closed' && session.state !== 'finished' && <PlanInCalendar session={session} title={title} link={link} />}
      {problem !== null && !screen && <p className="wk-warn">{problem}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {config === null ? <Loading label="Wczytywanie sesji…" />
        : session.kind === 'live' ? <LiveHost session={session} config={config} opened={opened} post={post} screen={screen} />
        : session.kind === 'game' ? <GameHostPanel session={session} config={config} raw={raw} />
        : <ResultsTable session={session} opened={opened} config={config} />}
    </div>
  );
}

/**
 * DIE SITZUNG IM KALENDER [I11, P02]: ein Termin im Terminarz des Bereichs, mit
 * dem Link zum Dołączenie (er öffnet die Sitzung gleich) und dem Code. Sehen
 * kann ihn, wer den Bereich liest — dieselben, die mitmachen dürfen.
 */
function PlanInCalendar({ session, title, link }: { session: SessionRow; title: string; link: string | null }) {
  const { me } = useCtx();
  const { busy, failed, run } = useBusy();
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [time, setTime] = useState('18:00');
  const [minutes, setMinutes] = useState(45);
  const [said, setSaid] = useState<string | null>(null);
  if (me === null) return null;
  return (
    <details className="cg-card">
      <summary>Zaplanuj w kalendarzu</summary>
      <div className="cg-row">
        <input type="date" value={date} aria-label="Dzień" onChange={(e) => setDate(e.target.value)} />
        <input type="time" value={time} aria-label="Godzina" onChange={(e) => setTime(e.target.value)} />
        <label className="cg-row"><span className="cg-muted">minut</span>
          <input type="number" min={5} max={600} value={minutes} style={{ width: '5em' }} onChange={(e) => setMinutes(Math.max(5, Math.min(600, Number(e.target.value) || 45)))} /></label>
        <button type="button" className="wk-btn" disabled={busy || date === ''} onClick={() => void run(async () => {
          await saveEvent(me.ring, {
            title, location: '', notes: session.joinCode === null ? '' : `Kod sesji: ${session.joinCode}`,
            ...(link === null ? {} : { link, linkLabel: 'Dołącz do sesji' }),
            areaId: session.areaId, ownerRoleId: me.person.id,
            date, time, minutes, allDay: false, repeat: 'none', every: 1, weekdays: 0, until: null, count: null
          });
          setSaid(`Termin ${date} ${time} jest w kalendarzu obszaru${link === null ? '' : ' — z linkiem do dołączenia'}.`);
        })}>Dodaj termin</button>
      </div>
      <p className="wk-hint">Widzą go wszyscy, którzy czytają ten obszar{link === null ? (session.joinCode === null ? '.' : ' — z kodem sesji.') : '; link otwiera sesję od razu.'}</p>
      {said !== null && <p className="wk-done" role="status">{said}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </details>
  );
}

function GameHostPanel({ session, config, raw }: { session: SessionRow; config: Config; raw: readonly SessionEvent[] }) {
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  const entry = config.flowId === undefined ? undefined : lib.docs('flow').find((e) => e.id === config.flowId);
  const rules = readGame(entry?.data.game);
  return (
    <div className="cg">
      {session.state !== 'running' ? (
        <div className="cg-card">
          <p>Gra „{String(entry?.data.name ?? 'Przebieg')}": {rules.zones.length} stref, {rules.triggers.length} wyzwalaczy.</p>
          <p className="wk-hint">Start pokazuje usłudze strefy i wyzwalacze (bez tekstów). Położenia graczy widzisz tylko Ty; po końcu gry znikają.</p>
          <button type="button" className="wk-btn" disabled={busy || rules.zones.length === 0} onClick={() => void run(async () => { await startGame(session.sessionId, rules); await setSessionState(session.sessionId, 'running'); })}>Rozpocznij grę</button>
        </div>
      ) : (
        <>
          <GameHost sessionId={session.sessionId} cred={{}} events={raw} />
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(() => setSessionState(session.sessionId, 'finished'))}>Zakończ grę (położenia znikną)</button>
        </>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/** Wyniki sesji bez taktu (asynchroniczna, opowieść): odpowiedzi i próby uczestników. */
function ResultsTable({ session, opened, config }: { session: SessionRow; opened: readonly Opened[]; config: Config }) {
  const joins = new Map(bodies<Join>(opened, 'join').map((j) => [j.body.participant, j.body]));
  const answers = bodies<Answer>(opened, 'answer').map((a) => a.body);
  const by = new Map<string, Answer[]>();
  for (const a of answers) by.set(a.participant, [...(by.get(a.participant) ?? []), a]);
  return (
    <div className="cg">
      <p className="cg-muted">{session.kind === 'async' ? 'Każdy powtarza we własnym tempie; postępy członków grupy widać też w zakładce Postępy.' : `Opowieść: ${config.title}`}{session.endsAt !== null ? ` · do ${new Date(session.endsAt).toLocaleString('pl-PL')}` : ''}</p>
      {by.size === 0 ? <p className="wk-empty">Nikt jeszcze nie odpowiedział.</p> : (
        <table className="cg-table">
          <thead><tr><th>Uczestnik</th><th>Odpowiedzi</th><th>Dobrze</th><th>Ostatnio</th></tr></thead>
          <tbody>
            {[...by.entries()].map(([p, list]) => (
              <tr key={p}>
                <td>{joins.get(p)?.name ?? p.slice(-6)}{joins.get(p)?.team ? ` (${joins.get(p)?.team})` : ''}</td>
                <td>{list.length}</td>
                <td>{list.filter((a) => (a.correctness ?? 0) >= 0.999).length}</td>
                <td>{new Date(Math.max(...list.map((a) => a.at))).toLocaleTimeString('pl-PL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* -- Live: der Gastgeber zählt ------------------------------------------------------------------- */

function LiveHost({ session, config, opened, post, screen }: { session: SessionRow; config: Config; opened: readonly Opened[]; post: (kind: string, body: unknown, plain?: unknown) => Promise<void>; screen: boolean }) {
  const { lib } = useCtx();
  const [cards, setCards] = useState<readonly Card[] | null>(null);
  const [now, setNow] = useState(Date.now());
  const { busy, failed, run } = useBusy();
  const rules = config.rules;
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    if (config.revisionId === undefined) { setCards([]); return; }
    void planFor(lib, config.revisionId, null, `live:${session.sessionId}`).then((p) => {
      const list = p.plan === null ? [] : p.plan.mode === 'random' ? p.plan.cards.slice(0, p.plan.count) : p.plan.cards;
      setCards(list);
    });
  }, [lib, config.revisionId, session.sessionId]);

  const joins = new Map<string, Join>();
  const devices = new Map<string, Set<string>>();
  for (const j of bodies<Join>(opened, 'join')) {
    joins.set(j.body.participant, j.body);
    devices.set(j.body.participant, (devices.get(j.body.participant) ?? new Set()).add(j.body.device));
  }
  const approved = new Set(bodies<{ participant: string; device: string }>(opened, 'approve').map((a) => `${a.body.participant}:${a.body.device}`));
  const firstDevice = new Map<string, string>();
  for (const j of bodies<Join>(opened, 'join')) if (!firstDevice.has(j.body.participant)) firstDevice.set(j.body.participant, j.body.device);
  const allowed = (a: Answer) => firstDevice.get(a.participant) === a.device || approved.has(`${a.participant}:${a.device}`);
  const waiting = [...devices.entries()].flatMap(([p, set]) => [...set].filter((d) => d !== firstDevice.get(p) && !approved.has(`${p}:${d}`)).map((d) => ({ p, d })));

  const questions = bodies<Question>(opened, 'question').map((q) => q.body);
  const reveals = bodies<Reveal>(opened, 'reveal').map((r) => r.body);
  const current = last(questions) ?? null;
  const revealed = current !== null && reveals.some((r) => r.index === current.index);
  const answers = current === null ? [] : bodies<Answer>(opened, 'answer').map((a) => a.body).filter((a) => a.index === current.index && allowed(a));
  const firstPer = new Map<string, Answer>();
  for (const a of answers) if (!firstPer.has(a.participant)) firstPer.set(a.participant, a);
  const lastScores = last(reveals)?.scores ?? [];
  const finished = bodies<{ final: boolean }>(opened, 'scores').some((s) => s.body.final);

  /* Was die Regeln verlangen: nach der ersten Antwort, wenn alle geantwortet haben, wenn die Uhr abläuft. */
  const deadline = current === null || revealed ? null : roundDeadline(rules, current.startedAt, answers.length > 0 ? Math.min(...answers.map((a) => a.at)) : null);
  const acted = useRef(new Set<string>());
  const doMove = (move: Move, why: string) => {
    if (current === null || revealed || move === 'none' || move === 'start_timer') return;
    const slot = `${current.index}:${why}`;
    if (acted.current.has(slot)) return;
    acted.current.add(slot);
    void reveal(move === 'next');
  };
  useEffect(() => {
    if (current === null || revealed) return;
    if (firstPer.size === 1) doMove(onFirstAnswer(rules), 'first');
    if (joins.size > 0 && firstPer.size >= joins.size) doMove(onAllAnswered(rules), 'all');
    if (deadline !== null && now >= deadline.at) doMove(deadline.move, 'timer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPer.size, joins.size, now, revealed, current?.index]);

  /* Nach dem Aufdecken von selbst weiter, wenn die Regeln es sagen. */
  const lastReveal = last(reveals);
  useEffect(() => {
    if (!revealed || rules.nextQuestion.mode !== 'timer' || cards === null || current === null) return undefined;
    const t = window.setTimeout(() => { if (!acted.current.has(`next:${current.index}`)) { acted.current.add(`next:${current.index}`); void ask(current.index + 1); } }, rules.nextQuestion.seconds * 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, lastReveal?.index]);

  const ask = (index: number) => run(async () => {
    if (cards === null) return;
    if (index >= cards.length) {
      await post('scores', { final: true, scores: lastScores });
      await setSessionState(session.sessionId, 'finished');
      return;
    }
    if (session.state === 'lobby') await setSessionState(session.sessionId, 'running');
    const card = cards[index];
    await post('question', { index, total: cards.length, card: stripCard(card), startedAt: Date.now(), deadline: rules.roundTimer.enabled ? Date.now() + rules.roundTimer.seconds * 1000 : null } satisfies Question,
      { index, form: card.answer.form, count: card.answer.form === 'one' || card.answer.form === 'many' ? card.answer.options.length : card.answer.form === 'truefalse' ? 2 : 0 });
  });

  const reveal = (thenNext: boolean) => run(async () => {
    if (cards === null || current === null) return;
    const card = cards[current.index];
    const history = (p: string) => reveals.slice().reverse().map((r) => r.scores.find((s) => s.participant === p)?.last?.correct ?? false);
    const round = [...firstPer.values()].map((a) => ({ participant: a.participant, at: a.at, correctness: checkCard(card, a.given, undefined).correctness }));
    const points = scoreRound(rules, round, current.startedAt, history);
    const totals = new Map(lastScores.map((s) => [s.participant, s.total]));
    const scores: Score[] = [...joins.values()].map((j) => {
      const last = points.get(j.participant) ?? null;
      return { participant: j.participant, name: j.name, team: j.team, total: (totals.get(j.participant) ?? 0) + (last?.total ?? 0), last };
    }).sort((a, b) => b.total - a.total);
    const teams = new Map<string, number>();
    for (const s of scores) if (s.team !== null) teams.set(s.team, (teams.get(s.team) ?? 0) + s.total);
    await post('reveal', {
      index: current.index, card, answered: round.length, correct: round.filter((r) => r.correctness >= 0.999).length,
      scores, teams: [...teams.entries()].map(([team, total]) => ({ team, total })).sort((a, b) => b.total - a.total)
    } satisfies Reveal);
    if (thenNext) window.setTimeout(() => void ask(current.index + 1), 2500);
  });

  const left = deadline === null ? null : Math.max(0, Math.ceil((deadline.at - now) / 1000));
  if (cards === null) return <p className="wk-hint">Przygotowywanie pytań…</p>;

  if (screen) return <Screen config={config} current={current} reveal={revealed ? reveals.find((r) => r.index === current!.index) ?? null : null} answered={firstPer.size} joined={joins.size} left={left} finished={finished} scores={lastScores} />;

  return (
    <div className="cg-split">
      <div className="cg">
        {finished ? <p className="wk-lede">Sesja zakończona.</p>
          : current === null ? (
            <div className="cg-card">
              <strong>Czeka {joins.size} uczestników · {cards.length} pytań</strong>
              <ul className="cg-muted">{describeRules(rules).map((l, i) => <li key={i}>{l}</li>)}</ul>
              <button type="button" className="wk-btn" disabled={busy || cards.length === 0} onClick={() => void ask(0)}>Zaczynamy — pierwsze pytanie</button>
            </div>
          ) : (
            <div className="cg-card">
              <div className="cg-row-between"><strong>Pytanie {current.index + 1} z {current.total}</strong>{left !== null && <span className="cg-timer">{left}</span>}</div>
              <p className="cg-prompt">{cards[current.index]?.prompt.map((p) => p.text).join(' ')}</p>
              <p className="cg-muted">Odpowiedzi: {firstPer.size} z {joins.size}{revealed ? ` · poprawnie: ${answerText(cards[current.index])}` : ''}</p>
              <div className="cg-row">
                {!revealed && <button type="button" className="wk-btn" disabled={busy} onClick={() => void reveal(false)}>Pokaż wynik</button>}
                {revealed && <button type="button" className="wk-btn" disabled={busy} onClick={() => void ask(current.index + 1)}>{current.index + 1 >= cards.length ? 'Zakończ' : 'Następne pytanie'}</button>}
              </div>
            </div>
          )}
        {failed !== null && <p className="wk-error">{failed}</p>}
        {waiting.length > 0 && (
          <div className="cg-card">
            <strong>Nowe urządzenie u uczestnika — zatwierdzić?</strong>
            {waiting.map((w) => (
              <span key={`${w.p}:${w.d}`} className="cg-row">{joins.get(w.p)?.name ?? w.p.slice(-6)}
                <button type="button" className="wk-link-btn" onClick={() => void post('approve', { participant: w.p, device: w.d })}>zatwierdź</button>
              </span>
            ))}
          </div>
        )}
      </div>
      <aside className="cg">
        <h3>Wyniki</h3>
        <ol className="cg-scores">
          {(lastScores.length > 0 ? lastScores : [...joins.values()].map((j) => ({ participant: j.participant, name: j.name, team: j.team, total: 0, last: null }))).map((s) => (
            <li key={s.participant}><span>{s.name}{s.team ? <span className="cg-muted"> · {s.team}</span> : null}</span><strong>{s.total}</strong></li>
          ))}
        </ol>
        {(last(reveals)?.teams.length ?? 0) > 0 && (
          <>
            <h3>Drużyny</h3>
            <ol className="cg-scores">{last(reveals)!.teams.map((t: { team: string; total: number }) => <li key={t.team}><span>{t.team}</span><strong>{t.total}</strong></li>)}</ol>
          </>
        )}
      </aside>
    </div>
  );
}

/** Die Leinwand: Frage, Uhr, wie viele geantwortet haben, Aufdecken, Punkte. */
function Screen({ config, current, reveal, answered, joined, left, finished, scores }: {
  config: Config; current: Question | null; reveal: Reveal | null; answered: number; joined: number; left: number | null; finished: boolean; scores: readonly Score[];
}) {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    void (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => undefined);
    return () => { void lock?.release(); };
  }, []);
  if (finished || current === null) {
    return (
      <div className="cg-live-screen">
        <h1>{config.title}</h1>
        {finished ? <ol className="cg-scores">{scores.slice(0, 10).map((s) => <li key={s.participant}><span>{s.name}</span><strong>{s.total}</strong></li>)}</ol>
          : <p className="cg-muted">Dołączyło: {joined}</p>}
      </div>
    );
  }
  const a = current.card.answer;
  return (
    <div className="cg-live-screen">
      <span className="cg-muted">Pytanie {current.index + 1} z {current.total}</span>
      <div className="cg-prompt">{current.card.prompt.map((p) => p.text).join(' ')}</div>
      {(a.form === 'one' || a.form === 'many') && (
        <div className="cg-live-buttons">{a.options.map((o, i) => <button key={i} type="button" className={reveal !== null && reveal.card.answer.form === a.form && (reveal.card.answer.form === 'one' ? reveal.card.answer.correct === i : reveal.card.answer.form === 'many' && reveal.card.answer.correct.includes(i)) ? 'is-on' : ''}>{o}</button>)}</div>
      )}
      {reveal === null ? <span className="cg-timer">{left === null ? `${answered}/${joined}` : `${left} s · ${answered}/${joined}`}</span>
        : (
          <>
            <strong>Poprawnie: {answerText(reveal.card)} · dobrze {reveal.correct} z {reveal.answered}</strong>
            <ol className="cg-scores">{reveal.scores.slice(0, 8).map((s) => <li key={s.participant}><span>{s.name}</span><strong>{s.total}</strong></li>)}</ol>
          </>
        )}
    </div>
  );
}

/* -- Mitmachen ---------------------------------------------------------------------------------- */

/** Ein Mitglied des Bereichs öffnet eine Sitzung, die es nicht führt — mit seinem Konto. */
function SessionJoinAsMember({ session, title, onBack }: { session: SessionRow; title: string; onBack: () => void }) {
  const { me } = useCtx();
  const [keys, setKeys] = useState<ReadonlyMap<number, Uint8Array> | null>(null);
  useEffect(() => {
    if (me === null) return;
    void myEpochKeys(me.ring, session.areaId).then(async (area) => {
      const out = new Map<number, Uint8Array>();
      for (const [epoch, key] of area) out.set(epoch, await sessionKeyOf(key, session.sessionId, epoch));
      setKeys(out);
    }, () => setKeys(new Map()));
  }, [me, session.areaId, session.sessionId]);
  if (me === null || keys === null) return <p className="wk-hint">Otwieranie sesji…</p>;
  return (
    <div className="cg">
      <button type="button" className="wk-link-btn" onClick={onBack}>← sesje</button>
      <SessionPlay session={session} title={title} cred={{}} keys={keys} participant={me.person.id} name={me.names.get(me.person.id) ?? 'Uczestnik'} learnerRole={me.person.id} />
    </div>
  );
}

/**
 * ALS TEILNEHMER: anmelden (Name, Team), Fragen beantworten, das Aufdecken
 * sehen — und die eigenen Antworten auch in den eigenen Fortschritt.
 */
export function SessionPlay({ session, title, cred, keys, participant, name: given, learner, learnerRole }: {
  session: SessionRow;
  title: string;
  cred: Credentials;
  keys: ReadonlyMap<number, Uint8Array>;
  participant: string;
  name: string | null;
  learner?: Learner | null;
  learnerRole?: string;
}) {
  const [name, setName] = useState(given ?? '');
  const [team, setTeam] = useState('');
  const [joined, setJoined] = useState(false);
  const [intake, setIntake] = useState<Uint8Array | null>(null);
  const [sent, setSent] = useState<ReadonlyMap<number, unknown>>(new Map());
  const [jump, setJump] = useState<{ step: string; at: number } | null>(null);
  const { busy, failed, run } = useBusy();
  const device = useMemo(deviceId, []);
  const ctx = useContext(CogitaContext);
  useEffect(() => { void intakeOf(session.areaId).then(setIntake); }, [session.areaId]);
  const { opened, raw, poke } = useEvents(session.sessionId, cred, keys, null);
  const epoch = Math.max(0, ...keys.keys());
  const key = keys.get(epoch);
  void learnerRole;

  const seal = async (eventId: string, body: unknown): Promise<{ sealed: string; epoch: number }> => {
    if (intake !== null) return { sealed: await sealForIntake(intake, eventId, body), epoch: 0 };
    if (key !== undefined) return { sealed: await sealForSession(key, eventId, body), epoch };
    throw new Error('Tej sesji nie da się tu otworzyć.');
  };
  const send = (kind: 'join' | 'answer', body: unknown) => run(async () => {
    const eventId = newId();
    const s = await seal(eventId, body);
    await postEvents(session.sessionId, [{ eventId, kind, epoch: s.epoch, sealed: s.sealed }], cred);
    poke();
  });

  const config = last(bodies<Config>(opened, 'config'))?.body ?? null;
  const meta = last(raw.filter((e) => e.kind === 'meta' && e.plain !== null).map((e): { flow?: string | null; library?: string; revision?: string | null } => { try { return JSON.parse(e.plain!) as { flow?: string | null; library?: string; revision?: string | null }; } catch { return {}; } })) ?? null;
  const questions = bodies<Question>(opened, 'question').map((q) => q.body);
  const slots = raw.filter((e) => e.kind === 'slot' && e.plain !== null).map((e) => { try { return JSON.parse(e.plain!) as { index: number; form: string; count: number }; } catch { return null; } }).filter((s): s is { index: number; form: string; count: number } => s !== null);
  const reveals = bodies<Reveal>(opened, 'reveal').map((r) => r.body);
  const current = last(questions) ?? null;
  const slot = last(slots) ?? null;
  const index = current?.index ?? slot?.index ?? -1;
  const reveal = reveals.find((r) => r.index === index) ?? null;
  const mine = last(reveals)?.scores.find((s: Score) => s.participant === participant) ?? null;
  const finished = session.state === 'finished' || bodies<{ final: boolean }>(opened, 'scores').some((s) => s.body.final);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    void (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => undefined);
    return () => { void lock?.release(); };
  }, []);

  /* Das Aufgedeckte geht auch in den eigenen Fortschritt. */
  const recorded = useRef(new Set<number>());
  useEffect(() => {
    if (reveal === null || learner == null || recorded.current.has(reveal.index) || !sent.has(reveal.index)) return;
    recorded.current.add(reveal.index);
    learner.record(reveal.card, checkCard(reveal.card, sent.get(reveal.index)).correctness, { via: session.sessionId });
  }, [reveal, learner, sent, session.sessionId]);

  if (!joined) {
    return (
      <form className="wk-form cg" onSubmit={(e) => { e.preventDefault(); void send('join', { participant, name: name.trim() || 'Uczestnik', team: team.trim() || null, device } satisfies Join).then(() => setJoined(true)); }}>
        <h2 className="wk-h2">{title}</h2>
        <label className="wk-field"><span>Jak się przedstawisz</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} /></label>
        <label className="wk-field"><span>Drużyna (jeśli gracie w drużynach)</span><input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={40} /></label>
        <button type="submit" className="wk-btn" disabled={busy || name.trim() === ''}>Dołącz</button>
        {failed !== null && <p className="wk-error">{failed}</p>}
      </form>
    );
  }

  if (session.kind === 'story' || session.kind === 'game') {
    return <StoryPlay session={session} meta={meta} learner={learner ?? null} jump={jump} raw={raw}
      onAnswer={(step, correctness, given2) => void send('answer', { participant, device, index: -1, step, given: given2, correctness, at: Date.now() } satisfies Answer)}
      game={session.kind === 'game' ? { cred, player: participant, team: team.trim() || null, onOpen: (step) => setJump({ step, at: Date.now() }) } : null} />;
  }

  /*
   * IM EIGENEN TEMPO: aus der Bibliothek, wenn sie hier offen ist — sonst (ein
   * Code, ein Link ohne Konto) aus der veröffentlichten Powtórka, die die
   * Sitzung offen nennt (`meta`). Jede Antwort geht auch an den Gastgeber.
   */
  const asyncRevision = session.kind === 'async' ? (config?.revisionId ?? meta?.revision ?? null) : null;
  if (asyncRevision !== null) {
    const report = (card: Card, correctness: number, given2: unknown) =>
      void send('answer', { participant, device, index: -1, step: card.key, given: given2, correctness, at: Date.now() } satisfies Answer);
    if (ctx !== null && ctx.lib.entry(asyncRevision) !== undefined) {
      return <RevisionRun lib={ctx.lib} source={{ revisionId: asyncRevision, title }} learner={learner ?? null} via={session.sessionId} onAnswer={report} />;
    }
    const libraryId = meta?.library ?? session.libraryId;
    if (libraryId != null) return <PublicRevisionRun libraryId={libraryId} revisionId={asyncRevision} learner={learner ?? null} title={title} via={session.sessionId} onAnswer={report} />;
  }

  if (finished) return <div className="cg-live-screen"><h2>Koniec</h2>{mine !== null && <p className="cg-live-code">{mine.total}</p>}</div>;
  if (index < 0) return <div className="cg-live-screen"><h2>{title}</h2><p className="cg-muted">Za chwilę pierwsze pytanie…</p>{mine !== null && <p>Punkty: {mine.total}</p>}</div>;

  const answered = sent.has(index);
  return (
    <div className="cg-live-screen">
      <span className="cg-muted">Pytanie {index + 1}{current !== null ? ` z ${current.total}` : ''}{mine !== null ? ` · ${mine.total} pkt` : ''}</span>
      {current !== null && reveal === null && !answered && (
        <section className="cg-face">
          <div className="cg-prompt">{current.card.prompt.map((p) => p.text).join(' ')}</div>
          <AnswerInput card={current.card} onSubmit={(given2) => { setSent((m) => new Map(m).set(index, given2)); void send('answer', { participant, device, index, given: given2, at: Date.now() } satisfies Answer); }} />
        </section>
      )}
      {current === null && slot !== null && reveal === null && !answered && (
        <div className="cg-live-buttons">
          {Array.from({ length: slot.form === 'truefalse' ? 2 : Math.max(1, slot.count) }, (_, i) => (
            <button key={i} type="button" onClick={() => { const v = slot.form === 'truefalse' ? i === 0 : i; setSent((m) => new Map(m).set(index, v)); void send('answer', { participant, device, index, given: v, at: Date.now() } satisfies Answer); }}>
              {slot.form === 'truefalse' ? (i === 0 ? 'Prawda' : 'Fałsz') : String.fromCharCode(65 + i)}
            </button>
          ))}
        </div>
      )}
      {answered && reveal === null && <p className="cg-muted">Wysłano — czekamy na innych.</p>}
      {reveal !== null && (
        <Verdict card={reveal.card} outcome={checkCard(reveal.card, sent.get(index))} given={sent.get(index)} extra={mine?.last != null ? <span>+{mine.last.total} pkt</span> : null} />
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/** Eine Erzählung oder ein Spiel in einer Sitzung — aus dem veröffentlichten Ablauf (der Code bringt keinen Schlüssel). */
function StoryPlay({ session, meta, learner, jump, raw, onAnswer, game }: {
  session: SessionRow;
  meta: { flow?: string | null; library?: string } | null;
  learner: Learner | null;
  jump: { step: string; at: number } | null;
  raw: readonly SessionEvent[];
  onAnswer: (step: string, correctness: number, given: unknown) => void;
  game: { cred: Credentials; player: string; team: string | null; onOpen: (step: string) => void } | null;
}) {
  const [bundle, setBundle] = useState<PublicFlow | null | undefined>(undefined);
  const libraryId = meta?.library ?? session.libraryId ?? null;
  const flowId = meta?.flow ?? null;
  useEffect(() => {
    if (libraryId === null || flowId === null) { setBundle(null); return; }
    void loadPublishedOne(libraryId, flowId).then((r) => {
      try { setBundle((JSON.parse(r.entry.json) as { data: PublicFlow }).data); } catch { setBundle(null); }
    }, () => setBundle(null));
  }, [libraryId, flowId]);
  if (bundle === undefined) return <Loading label="Wczytywanie…" />;
  if (bundle === null || libraryId === null) return <p className="wk-error">Ten przebieg nie jest opublikowany — gospodarz musi go opublikować.</p>;
  const content = contentOfBundle(bundle, (fileId, from) => publicFileUrl(from ?? libraryId, fileId));
  const flow = resolveFlow(readFlow(String(bundle.flow.id ?? ''), bundle.flow), content.flow);
  return (
    <div className="cg">
      {game !== null && <GamePlay sessionId={session.sessionId} cred={game.cred} player={game.player} team={game.team} events={raw} onOpen={game.onOpen} />}
      <FlowPlayer flow={flow} content={content} learner={learner} jumpTo={jump} onAnswer={(step, _card, correctness, given) => onAnswer(step, correctness, given)} />
    </div>
  );
}
