/**
 * 2026-11-05 — DAS HAUS IM KRAJOBRAZ: ein Klick auf das Feld in der Mitte öffnet daneben (am Telefon als Blatt) den eigenen
 * Stand — was erobert ist, was wartet, Punkte, Serie, Ziel des Tages, Abzeichen, die Zahlen von heute — mit „Powtórz (N)"
 * für das Fällige (im Stapel aus den Einstellungen: „Ile kart naraz"). Ein Doppelklick (oder „Wszystkie statystyki")
 * zeigt alles im ganzen Fenster: die volle Tafel der Nagrody, alle Diagramme, wo die Karten stehen, und die eigenen
 * Einstellungen der Wiederholung.
 *
 * Nichts Eigenes: dieselben Bausteine wie die Module „Punkty i seria" (`RewardBoard`) und „Statystyki na żywo" (`LiveStats`).
 */

import type { ReactNode } from 'react';

import type { Card } from './cardBasics';
import { baseLang, wordsT } from './lang';
import type { Learner } from './learn';
import { LiveStats } from './LiveStats';
import { RewardBoard } from './RewardViews';
import type { RewardRules } from './rewards';
import { SpacingChoice, StackChoice } from './SpacingSettings';
import { effectiveStackFor } from './spacing';
import type { CogitaLibrary } from './store';
import { Fullscreen } from '../ui/Modal';
import { MotionChoice } from '../ui/MotionChoice';
import { motionWords } from './motionWords';

export interface HomeNumbers {
  readonly land: number;
  readonly won: number;
  readonly regions: number;
  readonly ready: number;
  readonly due: number;
  readonly topics: number;
}

function homeWords(lib: CogitaLibrary) {
  const t = wordsT(baseLang(lib));
  return {
    title: t('cogitaLearn.home.title'),
    fullTitle: t('cogitaLearn.home.fullTitle'),
    numbers: (n: HomeNumbers) => t('cogitaLearn.home.numbers', { land: n.land, topics: n.topics, won: n.won, regions: n.regions, ready: n.ready, due: n.due }),
    review: (n: number) => t('cogitaLearn.home.review', { n }),
    stackLine: (n: number) => t('cogitaLearn.home.stackLine', { n }),
    all: t('cogitaLearn.home.all'),
    hint: t('cogitaLearn.home.hint'),
    close: t('cogitaLearn.home.close'),
    settings: t('cogitaLearn.home.settings'),
    noLearner: t('cogitaLearn.home.noLearner')
  };
}

/** Die Zeile oben und „Powtórz (N)" — im Blatt und im ganzen Fenster gleich. */
function HomeHead({ lib, learner, numbers, onReview, children }: { lib: CogitaLibrary; learner: Learner | null; numbers: HomeNumbers; onReview: (() => void) | null; children?: ReactNode }) {
  const H = homeWords(lib);
  const stack = effectiveStackFor(lib, learner).size;
  return (
    <>
      <p className="cg-ls-home-numbers" data-landscape-home-numbers="">{H.numbers(numbers)}</p>
      <div className="wk-actions">
        {onReview !== null && numbers.due > 0 && (
          <button type="button" className="wk-btn" onClick={onReview} data-landscape-home-review={numbers.due}>
            {H.review(numbers.due)} <span className="cg-muted">· {H.stackLine(Math.min(stack, numbers.due))}</span>
          </button>
        )}
        {children}
      </div>
    </>
  );
}

/** Das Blatt neben der Karte (am Telefon unten): der Stand in Kurzform. */
export function HomePanel({ lib, learner, rules, numbers, onReview, onAll, onClose }: {
  lib: CogitaLibrary;
  learner: Learner | null;
  rules: RewardRules;
  numbers: HomeNumbers;
  onReview: (() => void) | null;
  onAll: () => void;
  onClose: () => void;
}) {
  const H = homeWords(lib);
  return (
    <div className="cg-ls-q cg-ls-home" data-landscape-home="panel">
      <div className="cg-ls-qtop">
        <p className="cg-ls-qtitle"><strong>⌂ {H.title}</strong></p>
        <button type="button" className="cg-ls-qclose" aria-label={H.close} onClick={onClose} data-landscape-home-close="">×</button>
      </div>
      <div className="cg-ls-qbody">
        <HomeHead lib={lib} learner={learner} numbers={numbers} onReview={onReview}>
          <button type="button" className="wk-btn wk-btn-line" onClick={onAll} data-landscape-home-all="">{H.all}</button>
        </HomeHead>
        {learner === null ? <p className="cg-muted">{H.noLearner}</p> : (
          <>
            <RewardBoard learner={learner} rules={rules} shape="strip" />
            <LiveStats lib={lib} learner={learner} rules={rules} cards={null} shape="strip" />
          </>
        )}
        <p className="cg-muted">{H.hint}</p>
      </div>
    </div>
  );
}

/** Das ganze Fenster: alle Zahlen, alle Nagrody, wo die Karten stehen, und wie man lernt. */
export function HomeFull({ lib, learner, rules, cards, numbers, onReview, onClose }: {
  lib: CogitaLibrary;
  learner: Learner | null;
  rules: RewardRules;
  cards: readonly Card[];
  numbers: HomeNumbers;
  onReview: (() => void) | null;
  onClose: () => void;
}) {
  const H = homeWords(lib);
  return (
    <Fullscreen title={H.fullTitle} onClose={onClose}>
      <div className="cg cg-ls-home-full" data-landscape-home="full">
        <HomeHead lib={lib} learner={learner} numbers={numbers} onReview={onReview === null ? null : () => { onClose(); onReview(); }} />
        {learner === null ? <p className="cg-muted">{H.noLearner}</p> : (
          <>
            <RewardBoard learner={learner} rules={rules} shape="full" />
            <LiveStats lib={lib} learner={learner} rules={rules} cards={cards} shape="full" />
            <section className="cg-card" data-landscape-home-settings="">
              <h3>{H.settings}</h3>
              <SpacingChoice lib={lib} learner={learner} />
              <StackChoice lib={lib} learner={learner} />
              {/* 2026-11-05 (Prompt 17) — wie viel sich bewegt, auf diesem Gerät (gilt überall). */}
              <MotionChoice words={motionWords(baseLang(lib))} />
            </section>
          </>
        )}
      </div>
    </Fullscreen>
  );
}
