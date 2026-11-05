/**
 * 2026-11-05 (Prompt 23, C3) — DIE FRAGEN EINES THEMAS im kurzen Panel des Krajobraz: die Kernfragen zuerst (mit „kluczowe“),
 * dann die übrigen; je Frage, ob sie sitzt (✓) oder noch nicht (○). Höchstens vier, dann „+N“.
 */

import type { Card } from './cardBasics';
import { cardKnowness, type Gauge } from './knowing';
import { KNOWN } from './knowness';
import { baseLang } from './lang';
import { selfCheckWords } from './selfCheckWords';
import type { CogitaLibrary } from './store';
import { entityNameTex } from './ui';
import { TexText } from '../ui/tex/Tex';
import './selfCheck.css';

/** Die Fragen über ein Thema (Pytania, die es in „O czym“ nennen), die Kernfragen zuerst, sonst in der Folge der Karten. */
export function topicQuestionCards(cards: readonly Card[], topic: string): Card[] {
  const seen = new Set<string>();
  const out = cards.filter((c) => (c.about ?? []).includes(topic) && !seen.has(c.question) && seen.add(c.question) !== undefined);
  return out.map((c, i) => ({ c, i })).sort((a, b) => Number(b.c.core === true) - Number(a.c.core === true) || a.i - b.i).map((x) => x.c);
}

export function TopicQuestions({ lib, cards, topic, gauge, max = 4 }: { lib: CogitaLibrary; cards: readonly Card[]; topic: string; gauge: Gauge; max?: number }) {
  const S = selfCheckWords(baseLang(lib));
  const list = topicQuestionCards(cards, topic);
  if (list.length === 0) return null;
  return (
    <div data-landscape-questions={list.length}>
      <ul className="cg-ls-core">
        {list.slice(0, max).map((c) => {
          const known = cardKnowness(gauge, c.key) >= KNOWN;
          return (
            <li key={c.key} data-landscape-question={c.question} data-landscape-question-core={c.core === true ? '1' : '0'}>
              <span aria-hidden>{known ? '✓' : '○'}</span>
              {c.core === true && <span className="cg-core-badge" title={S.coreHint}>{S.core}</span>}
              <span><TexText text={entityNameTex(lib, c.question)} /></span>
            </li>
          );
        })}
      </ul>
      {list.length > max && <p className="cg-muted">+{list.length - max}</p>}
    </div>
  );
}
