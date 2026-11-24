/**
 * 2026-11-24 (Eigentümer: „in Gruppen, jede und jeder auf dem eigenen Telefon") — GRUPPENARBEIT in einem Etap einer Einheit:
 *
 * <code>
 *   GroupsHost       (Konsole) bildet die Gruppen beim Öffnen des Etaps, setzt Nachzügler in die kleinste, „Wymieszaj ponownie",
 *                    ein Mitglied umsetzen, eine Frage einer Gruppe schliessen; je Gruppe der Stand jeder Frage, die Verteilung der
 *                    Antworten der Gruppen, richtig/falsch — und sie gibt jeder Gruppe zurück, was ihre Mitglieder geantwortet haben
 *                    (`unit-gstate`: Initialen und Antwort als Wort)
 *   GroupQuestions   (Telefon) die Fragen des Items: die eigene Antwort, die der anderen in der Gruppe, „uneinig — sprecht
 *                    miteinander", ändern; einig: das Ergebnis der Gruppe, dann weiter. Die eigene Antwort zählt im eigenen Fortschritt.
 *   GroupsScreen     (Leinwand) nur Gruppennummern und ihr Stand — nie Namen, nie Initialen
 * </code>
 *
 * Die Antworten der Mitglieder gehen versiegelt an die Przyjęcia (nur der Lehrer). Seine Konsole muss offen sein, damit die
 * Gruppen einander sehen (sie rechnet und gibt zurück) — ohne sie antwortet jede und jeder trotzdem und zählt.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '../../core/i18n';
import { TexText } from '../../ui/tex/Tex';
import { AnswerInput, givenText, Verdict } from '../CardFace';
import type { Card } from '../cardBasics';
import { checkCard } from '../cards';
import type { Learner } from '../learn';
import type { Send } from '../lesson/LessonHost';
import type { Opened } from '../sessionEvents';
import type { CogitaLibrary } from '../store';
import { useAsync, useBusy, useCtx } from '../ui';
import {
  formGroups, groupDistribution, groupOf, groupTally, groupViews, initialsOf, moveMember, viewsSignature, withLate,
  type GroupStatus, type GroupView
} from './groupsModel';
import { answerReport, type Report } from './UnitItems';
import { itemKey, type UnitStage } from './unitModel';
import { groupAnswersIn, groupClosesIn, groupsIn, groupStateIn, HOST_KINDS, participantsOf } from './unitSession';

const STATUS_GLYPH: Readonly<Record<GroupStatus | 'idle', string>> = { idle: '·', thinking: '…', disagree: '≠', agreed: '✓', closed: '■' };

const cardOf = (cards: readonly Card[], q: string): Card | undefined => cards.find((c) => c.key === q || c.question === q);

/** Die Fragen eines Items als Schlüssel der Karten (so stehen sie in den Antworten). */
const questionKeys = (cards: readonly Card[], questions: readonly string[]): string[] =>
  questions.map((q) => cardOf(cards, q)?.key).filter((k): k is string => k !== undefined);

/* -- Die Konsole -------------------------------------------------------------------------------------------------------- */

export function GroupsHost({ stage, opened, ids, nameOf, send, sessionId }: {
  stage: UnitStage; opened: readonly Opened[]; ids: readonly string[]; nameOf: (p: string) => string; send: Send; sessionId: string;
}) {
  const t = useT();
  const { lib } = useCtx();
  const { busy, run } = useBusy();
  const cards = useAsync(() => lib.cards('flow').then((r) => r.cards), [lib, lib.revision]);
  const current = groupsIn(opened, stage.id);
  const groups = current?.groups ?? [];
  const answers = groupAnswersIn(opened).filter((a) => a.stage === stage.id);
  const closes = groupClosesIn(opened, stage.id);
  const people = participantsOf(opened);
  const items = stage.items.map((it, i) => ({ it, i, key: itemKey(stage.id, i) })).filter((x) => x.it.kind === 'questions');
  const correctOf = (q: string, given: unknown): boolean | undefined => { const c = cards == null ? undefined : cardOf(cards, q); if (c === undefined) return undefined; try { return checkCard(c, given).correct; } catch { return undefined; } };
  const initials = (p: string) => initialsOf(people.get(p) ?? '');

  /* Die Gruppen bilden, sobald jemand da ist; Nachzügler in die kleinste. Ein Ereignis auf einmal (kein Kreis). */
  const pending = useRef(false);
  const placedSig = groups.flat().sort().join('|');
  useEffect(() => {
    if (pending.current || ids.length === 0) return;
    const next = current === null ? formGroups(ids, stage.groupSize, `${sessionId}:${stage.id}`) : withLate(groups, ids, stage.groupSize);
    if (current !== null && next.flat().length === groups.flat().length) return;
    pending.current = true;
    void send(HOST_KINDS.groups, { stage: stage.id, groups: next, seed: current?.seed ?? `${sessionId}:${stage.id}`, at: Date.now() }).finally(() => { pending.current = false; });
  }, [ids.join('|'), placedSig, stage.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Was jede Gruppe sieht — nur bei einer Änderung neu, höchstens alle 0,5 s. */
  const views = useMemo(() => (cards == null ? null : items.map((x) => ({
    key: x.key, qs: questionKeys(cards, x.it.kind === 'questions' ? x.it.questions : []),
    views: groupViews(groups, questionKeys(cards, x.it.kind === 'questions' ? x.it.questions : []), answers, closes, x.key, initials, correctOf)
  }))), [cards, groups, answers.length, closes.length, people.size, stage.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const sent = useRef(new Map<string, string>());
  useEffect(() => {
    if (views === null) return undefined;
    for (const v of views) { const had = groupStateIn(opened, stage.id, v.key); if (had !== null && !sent.current.has(v.key)) sent.current.set(v.key, viewsSignature(had.groups)); }
    const tm = window.setTimeout(() => {
      for (const v of views) {
        const sig = viewsSignature(v.views);
        if (sent.current.get(v.key) === sig) continue;
        sent.current.set(v.key, sig);
        void send(HOST_KINDS.gstate, { stage: stage.id, item: v.key, at: Date.now(), groups: v.views });
      }
    }, 500);
    return () => window.clearTimeout(tm);
  }, [views]); // eslint-disable-line react-hooks/exhaustive-deps

  const reshuffle = () => run(() => send(HOST_KINDS.groups, { stage: stage.id, groups: formGroups(ids, stage.groupSize, `${sessionId}:${stage.id}:${Date.now()}`), seed: `${sessionId}:${stage.id}:${Date.now()}`, at: Date.now() }));
  const move = (p: string, to: number) => run(() => send(HOST_KINDS.groups, { stage: stage.id, groups: moveMember(groups, p, to), seed: current?.seed ?? '', at: Date.now() }));
  const close = (item: string, q: string, group: number) => run(() => send(HOST_KINDS.gclose, { stage: stage.id, item, q, group, at: Date.now() }));

  if (cards === undefined) return null;
  return (
    <section className="cg-unit-groups" data-unit-groups={groups.length}>
      <div className="cg-row-between">
        <h3 className="wk-h3">{t('cogitaGroups.host.title', { count: groups.length, size: stage.groupSize })}</h3>
        <button type="button" className="wk-btn wk-btn-line" disabled={busy || ids.length === 0} onClick={() => void reshuffle()} data-unit-groups-shuffle="">{t('cogitaGroups.host.shuffle')}</button>
      </div>
      {groups.length === 0 && <p className="cg-muted">{t('cogitaGroups.host.none')}</p>}
      <ol className="cg-unit-grouplist">
        {groups.map((members, gi) => {
          const all = views?.flatMap((v) => v.views[gi] === undefined ? [] : [{ v: v.views[gi]!, qs: v.qs, key: v.key }]) ?? [];
          const tally = all.reduce((acc, x) => { const y = groupTally(x.v, x.qs); return { answered: acc.answered + y.answered, agreed: acc.agreed + y.agreed, correct: acc.correct + y.correct, status: y.status !== 'idle' ? y.status : acc.status }; }, { answered: 0, agreed: 0, correct: 0, status: 'idle' as GroupStatus | 'idle' });
          return (
            <li key={gi} className={`cg-unit-group is-${tally.status}`} data-unit-group={gi + 1} data-unit-group-status={tally.status} data-unit-group-agreed={tally.agreed} data-unit-group-correct={tally.correct}>
              <p className="cg-unit-group-head"><strong>{t('cogitaGroups.name', { n: gi + 1 })}</strong>
                <span className="cg-tag">{STATUS_GLYPH[tally.status]} {t(`cogitaGroups.status.${tally.status}`)}</span>
                <span className="cg-muted">{t('cogitaGroups.host.tally', { agreed: tally.agreed, correct: tally.correct })}</span></p>
              <ul className="cg-unit-group-members">
                {members.map((p) => (
                  <li key={p}>
                    <span>{nameOf(p)}</span>
                    <select aria-label={t('cogitaGroups.host.moveTo', { name: nameOf(p) })} value={gi} disabled={busy} onChange={(e) => void move(p, Number(e.target.value))} data-unit-group-move={p}>
                      {groups.map((_, j) => <option key={j} value={j}>{t('cogitaGroups.name', { n: j + 1 })}</option>)}
                      <option value={groups.length}>{t('cogitaGroups.host.newGroup')}</option>
                    </select>
                  </li>
                ))}
              </ul>
              {all.map((x) => x.qs.map((q, qi) => {
                const s = x.v.qs[q];
                if (s === undefined) return null;
                return (
                  <p key={`${x.key}|${q}`} className={`cg-unit-group-q is-${s.status}`} data-unit-group-q={`${gi + 1}|${q}`} data-unit-group-q-status={s.status}>
                    <span>{t('cogitaGroups.host.question', { n: qi + 1 })}</span>
                    <span>{STATUS_GLYPH[s.status]} {t(`cogitaGroups.status.${s.status}`)}{s.label !== undefined ? ` — ${s.label}` : ''}{s.correct === true ? ' ✓' : s.correct === false ? ' ✗' : ''}</span>
                    <span className="cg-muted">{Object.entries(s.answers).map(([p, l]) => `${nameOf(p)}: ${l}`).join(' · ')}</span>
                    {(s.status === 'disagree' || s.status === 'thinking') && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void close(x.key, q, gi + 1)} data-unit-group-close={`${gi + 1}|${q}`}>{t('cogitaGroups.host.close')}</button>}
                  </p>
                );
              }))}
            </li>
          );
        })}
      </ol>
      {views !== null && views.map((v) => v.qs.map((q, qi) => {
        const dist = groupDistribution(v.views, q);
        if (dist.length === 0) return null;
        const card = cardOf(cards ?? [], q);
        return (
          <div key={`${v.key}|${q}`} className="cg-unit-group-dist" data-unit-group-dist={q}>
            <p><strong>{t('cogitaGroups.host.question', { n: qi + 1 })}</strong>{card !== undefined && <> — <TexText text={card.prompt.map((p) => p.text).join(' ')} /></>}</p>
            <ul>{dist.map((d) => <li key={d.label} className={d.correct === true ? 'is-right' : d.correct === false ? 'is-wrong' : ''}>{d.label} — {t('cogitaGroups.host.groupsN', { count: d.count })}{d.correct === true ? ' ✓' : d.correct === false ? ' ✗' : ''}</li>)}</ul>
          </div>
        );
      }))}
      <p className="cg-muted">{t('cogitaGroups.host.says')}</p>
    </section>
  );
}

/* -- Das Telefon -------------------------------------------------------------------------------------------------------- */

export interface GroupRun {
  readonly participant: string;
  readonly stage: string;
  readonly opened: readonly Opened[];
  /** Die eigene Antwort an den Lehrer (versiegelt für die Przyjęcia). */
  readonly send: (item: string, q: string, given: unknown, label: string) => void;
}

export function GroupQuestions({ itemKeyOf, questions, lib, cards, learner, via, report, onDone, group }: {
  itemKeyOf: string; questions: readonly string[]; lib: CogitaLibrary; cards: readonly Card[]; learner: Learner | null; via: string;
  report: Report; onDone: () => void; group: GroupRun;
}) {
  const t = useT();
  const list = useMemo(() => questions.map((q) => cardOf(cards, q)).filter((c): c is Card => c !== undefined), [questions, cards]);
  const [at, setAt] = useState(0);
  const [mine, setMine] = useState<ReadonlyMap<string, unknown>>(new Map());
  const [changing, setChanging] = useState(false);
  const recorded = useRef(new Set<string>());
  const groups = groupsIn(group.opened, group.stage)?.groups ?? [];
  const gi = groupOf(groups, group.participant);
  const state = groupStateIn(group.opened, group.stage, itemKeyOf);
  const view: GroupView | undefined = gi < 0 ? undefined : state?.groups.find((g) => g.n === gi + 1);
  const card = list[at];
  useEffect(() => { setChanging(false); }, [at]);

  if (list.length === 0) return <p className="cg-muted">{t('cogitaUnit.play.missing')}</p>;
  if (gi < 0) return <p className="wk-lede cg-unit-group-wait" data-unit-group-wait="">{t('cogitaGroups.play.waitGroups')}</p>;
  if (card === undefined) return null;

  const s = view?.qs[card.key];
  const myGiven = mine.get(card.key);
  const sentLabel = s?.answers[group.participant];
  const answered = myGiven !== undefined || sentLabel !== undefined;
  const settled = s !== undefined && (s.status === 'agreed' || s.status === 'closed');
  const submit = (given: unknown) => {
    setMine((m) => new Map(m).set(card.key, given));
    setChanging(false);
    group.send(itemKeyOf, card.key, given, givenText(card, given).slice(0, 120));
    /* Die EIGENE Antwort zählt im eigenen Fortschritt — einmal je Frage, die erste. */
    if (!recorded.current.has(card.key)) {
      recorded.current.add(card.key);
      const outcome = checkCard(card, given);
      const data = lib.entity(card.question)?.data ?? null;
      const r = answerReport(card, data, given, outcome.correctness, card.key);
      learner?.record(card, outcome.correctness, { via, ...(r.tag === undefined ? {} : { tags: [r.tag] }) });
      report(r);
    }
  };
  const members = view?.members ?? groups[gi]!.map((p) => ({ p, ini: '?' }));
  return (
    <div className="cg-unit-groupq" data-unit-groupq={`${gi + 1}|${at}`} data-unit-group-state={s?.status ?? 'none'}>
      <p className="cg-muted">{t('cogitaGroups.play.inGroup', { n: gi + 1 })} · {t('cogitaUnit.play.questionOf', { n: at + 1, all: list.length })}</p>
      <div className="cg-prompt"><TexText text={card.prompt.map((p) => p.text).join(' ')} /></div>
      {(!answered || changing) && !settled && <AnswerInput key={`${card.key}:${changing ? 'c' : 'a'}`} card={card} onSubmit={submit} />}
      {answered && !changing && (
        <section className="cg-unit-groupboard" aria-live="polite">
          <h3 className="wk-h3">{t('cogitaGroups.play.board')}</h3>
          <ul>
            {members.map((m) => {
              const l = s?.answers[m.p];
              return <li key={m.p} className={m.p === group.participant ? 'is-me' : ''} data-unit-group-member={m.p === group.participant ? 'me' : 'other'}>
                <span className="cg-unit-ini" aria-hidden="true">{m.ini}</span>
                <span>{m.p === group.participant ? t('cogitaGroups.play.me') : m.ini}</span>
                <strong>{l ?? (m.p === group.participant && myGiven !== undefined ? givenText(card, myGiven) : '…')}</strong>
              </li>;
            })}
          </ul>
          {s === undefined && <p className="cg-muted">{t('cogitaGroups.play.relay')}</p>}
          {s?.status === 'thinking' && <p className="cg-muted" data-unit-group-says="thinking">{t('cogitaGroups.play.thinking')}</p>}
          {s?.status === 'disagree' && <p className="wk-note" data-unit-group-says="disagree">{t('cogitaGroups.play.disagree')}</p>}
          {!settled && <button type="button" className="wk-btn wk-btn-line" onClick={() => setChanging(true)} data-unit-group-change="">{t('cogitaGroups.play.change')}</button>}
          {settled && s?.label !== undefined && (
            <div className="cg-unit-group-result" data-unit-group-result={s.correct === true ? 'right' : s.correct === false ? 'wrong' : 'unknown'}>
              <p><strong>{s.status === 'closed' ? t('cogitaGroups.play.closed') : t('cogitaGroups.play.agreed')}</strong> {s.label}</p>
              {(() => {
                const given = myGiven ?? undefined;
                if (given === undefined) return <p>{s.correct === true ? t('cogitaGroups.play.right') : s.correct === false ? t('cogitaGroups.play.wrong') : ''}</p>;
                return <Verdict card={card} outcome={checkCard(card, given)} given={given} lib={lib} />;
              })()}
              <button type="button" className="wk-btn" onClick={() => { if (at + 1 >= list.length) onDone(); else setAt(at + 1); }} data-unit-group-next="">{at + 1 >= list.length ? t('cogitaGroups.play.finish') : t('common.next')}</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* -- Die Leinwand ------------------------------------------------------------------------------------------------------- */

export function GroupsScreen({ stage, opened }: { stage: UnitStage; opened: readonly Opened[] }) {
  const t = useT();
  const groups = groupsIn(opened, stage.id)?.groups ?? [];
  const items = stage.items.map((it, i) => ({ it, key: itemKey(stage.id, i) })).filter((x) => x.it.kind === 'questions');
  if (groups.length === 0) return null;
  return (
    <ol className="cg-unit-screen-groups" data-unit-screen-groups={groups.length}>
      {groups.map((_, gi) => {
        const per = items.map((x) => { const v = groupStateIn(opened, stage.id, x.key)?.groups.find((g) => g.n === gi + 1); return v === undefined ? null : groupTally(v, Object.keys(v.qs)); }).filter((x) => x !== null);
        const agreed = per.reduce((n, x) => n + x!.agreed, 0);
        const status = per.map((x) => x!.status).filter((s) => s !== 'idle').pop() ?? 'idle';
        return (
          <li key={gi} className={`is-${status}`} data-unit-screen-group={gi + 1} data-unit-screen-group-status={status}>
            <strong>{t('cogitaGroups.name', { n: gi + 1 })}</strong>
            <span>{STATUS_GLYPH[status]} {t(`cogitaGroups.status.${status}`)}</span>
            <span className="cg-muted">{t('cogitaGroups.screen.agreed', { count: agreed })}</span>
          </li>
        );
      })}
    </ol>
  );
}
