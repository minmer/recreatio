/**
 * 2026-11-22 (Homer) — DIE LEINWAND EINER EINHEIT („…/ekran", das Gerät des Lehrers am Beamer): nie ein Name. Gemeinsame Etapy
 * zeigt `LessonScreen` (Folie, Frage, Verteilung); dazu, solange abgestimmt wird, der QR zum Beitreten in der Ecke. Ein Etap allein:
 * sein Titel und „18 / 26 gotowe". Eine offene Frage: die Wand, die der Lehrer freigab; eine Umfrage: ihre Balken (vorher/nachher).
 */

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { useT } from '../../core/i18n';
import { TexText } from '../../ui/tex/Tex';
import { LessonScreen } from '../lesson/LessonHost';
import { linesHeat, LinesHeat } from '../reading/linesHeat';
import { useAsync, useCtx } from '../ui';
import type { SessionRow } from '../live';
import type { Opened } from '../sessionEvents';
import { PollBarsView } from './UnitHost';
import { GroupsScreen } from './UnitGroups';
import { finishedBy, itemKey, unitNow } from './unitModel';
import { hostEvents, itemNow, participantsOf, pollOf, progressOf, wallOf, type UnitConfig } from './unitSession';
import './unit.css';

export function UnitScreen({ session, config, opened, link, code }: { session: SessionRow; config: UnitConfig; opened: readonly Opened[]; link: string | null; code: string | null }) {
  const t = useT();
  const [, setTick] = useState(0);
  useEffect(() => { const tm = window.setInterval(() => setTick((n) => n + 1), 5000); return () => window.clearInterval(tm); }, []);
  const { lib } = useCtx();
  const cards = useAsync(() => lib.cards('flow').then((r) => r.cards), [lib, lib.revision]);
  const now = unitNow(config.unit, hostEvents(opened), session.state, t('cogitaUnit.recap'));
  const stage = now.stage;
  const item = itemNow(opened);
  const people = participantsOf(opened).size;
  const qr = (link !== null || code !== null) && (now.phase === 'lobby' || stage?.led === true) ? (
    <aside className="cg-unit-qr" data-unit-screen-qr="">
      {link !== null && <QRCodeSVG value={link} size={120} />}
      {code !== null && <span className="cg-live-code">{code}</span>}
    </aside>
  ) : null;

  let body: React.ReactNode;
  if (now.phase === 'between' || now.phase === 'closed') {
    body = <div className="cg-unit-screen-title"><h1>{config.title}</h1><p>{now.phase === 'closed' ? t('cogitaUnit.screen.closed') : t('cogitaUnit.screen.between', { n: now.lesson })}</p></div>;
  } else if (stage === null) {
    body = <div className="cg-unit-screen-title"><h1>{config.unit.lessons[now.lesson - 1]?.title || config.title}</h1><p>{t('cogitaUnit.screen.joined', { count: people })}</p></div>;
  } else {
    const at = stage.led && item !== null && item.stage === stage.id ? item.index : -1;
    const open = stage.items.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'prompt' || x.it.kind === 'poll');
    /* Was der Lehrer zuletzt freigab (Wand, Umfrage) — im gemeinsamen Etap nur am laufenden Item. */
    const shown = [...open].reverse().map(({ it, i }) => {
      const key = itemKey(stage.id, i);
      if (stage.led && i !== at) return null;
      if (it.kind === 'prompt') { const w = wallOf(opened, stage.id, key); return w === null ? null : { it, w, p: null }; }
      const p = pollOf(opened, stage.id, key);
      return p === null ? null : { it, w: null, p };
    }).find((x) => x !== null) ?? null;
    if (shown !== null && shown.it.kind === 'prompt' && shown.w !== null) {
      body = (
        <div className="cg-unit-wall" data-unit-wall={shown.w.texts.length}>
          <h2><TexText text={shown.it.prompt} /></h2>
          <ul>{shown.w.texts.map((text, i) => <li key={i}>{text}</li>)}</ul>
        </div>
      );
    } else if (shown !== null && shown.it.kind === 'poll' && shown.p !== null) {
      body = (
        <div className="cg-unit-screen-poll" data-unit-screen-poll="">
          <h2><TexText text={shown.it.poll} /></h2>
          <PollBarsView options={shown.it.options} counts={shown.p.counts} votes={shown.p.votes} before={shown.p.before ?? null} />
        </div>
      );
    } else if (stage.led && (stage.items[at]?.kind === 'flow' || stage.items[at]?.kind === 'questions')) {
      body = <LessonScreen opened={opened} title={stage.title} />;
    } else if (stage.led) {
      const it = stage.items[at];
      body = <div className="cg-unit-screen-title"><h2>{it === undefined ? stage.title : it.kind === 'prompt' ? it.prompt : it.kind === 'poll' ? it.poll : stage.title}</h2><p>{t('cogitaUnit.screen.answerOnPhone')}</p></div>;
    } else {
      const ready = finishedBy(stage, progressOf(opened)).size;
      /*
        2026-11-22 (Homer, R) — EINE LEKTÜRE-AUFGABE IM EIGENEN TEMPO: die Wärmekarte der zuletzt beantworteten Wers-Aufgabe dieses
        Etaps — je Schülerin, Schüler die letzte Antwort, gezählt je Zeile; nie Namen.
      */
      const withLines = progressOf(opened).filter((p) => p.stage === stage.id && p.card !== undefined && p.lines !== undefined && p.predict !== true);
      const lastCard = withLines.length === 0 ? undefined : withLines[withLines.length - 1]!.card;
      const card = lastCard === undefined ? undefined : cards?.find((c) => c.key === lastCard);
      const latest = new Map<string, readonly number[]>();
      for (const p of withLines) if (p.card === lastCard) latest.set(p.participant, p.lines!);
      const heat = card === undefined ? null : linesHeat(card, [...latest.values()]);
      body = (
        <div className="cg-unit-screen-title" data-unit-screen-stage={stage.id}>
          <h1>{stage.title}</h1>
          <p className="cg-unit-screen-count" data-unit-screen-ready={`${ready}/${people}`}>{t('cogitaUnit.host.ready', { done: ready, all: people })}</p>
          <p className="cg-muted">{t('cogitaUnit.screen.onPhones')}</p>
          {card !== undefined && heat !== null && heat.length > 0 && <div className="cg-unit-heat" data-unit-heat={latest.size}><LinesHeat card={card} counts={heat} /></div>}
          {/* 2026-11-24 — in Gruppen: nur Nummern und Stand, nie Namen. */}
          {stage.work === 'groups' && <GroupsScreen stage={stage} opened={opened} />}
        </div>
      );
    }
  }
  return <div className="cg-live-screen cg-unit-screen" data-unit-screen={now.phase}>{body}{qr}</div>;
}
