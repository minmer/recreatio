/**
 * 2026-11-03 — PRÓBKI ZADAŃ Z GENERATORA (`generator.ts`): je zehn Fassungen eines Pytanie mit `params` oder eines
 * Szablon mit Generator — Frage, richtige Antwort, gezogene Werte — und wie oft neu gezogen werden musste. Was nicht
 * gelingt, steht mit dem Grund da: so eine Aufgabe käme nie als kaputte Karte zum Lernenden, sondern gar nicht.
 *
 * Für den Editor der Frage (`QuestionFields.tsx`) und des Szablon (`TemplateEditor.tsx`); nichts wird gespeichert.
 */

import { useMemo, useState } from 'react';

import './generator.css';
import { paramsText } from './AnswerLog';
import type { Card } from './cardBasics';
import { rngOf } from './cardBasics';
import { answerText } from './CardFace';
import { generatorProblem, questionCards } from './cards';
import { readParamsSpec, sampleInstances, type GenWorld } from './generator';
import type { CogitaLibrary } from './store';
import { TexText } from '../ui/tex/Tex';
import { useAsync } from './ui';

/** So viele Proben zeigt der Editor. */
export const SAMPLE_COUNT = 10;

export interface Sample {
  readonly seed: string;
  readonly card: Card | null;
  readonly problem: string | null;
}

const seedsOf = (round: number): string[] => Array.from({ length: SAMPLE_COUNT }, (_v, i) => `probka:${round}:${i + 1}`);

/** Die Proben eines Pytanie: je Same seine Karte (die ganze Frage), sonst der Grund. */
export function questionSamples(entity: { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }, seeds: readonly string[], world?: GenWorld): Sample[] {
  return seeds.map((seed) => {
    const card = questionCards(entity, seed, world)[0] ?? null;
    return { seed, card, problem: card === null ? generatorProblem(entity, seed, world) ?? 'Karta nie powstała — brakuje odpowiedzi albo możliwości.' : null };
  });
}

function SampleList({ samples, tries, lib }: { samples: readonly Sample[]; tries: number | null; lib: CogitaLibrary }) {
  const made = samples.filter((s) => s.card !== null).length;
  const failed = samples.filter((s) => s.card === null);
  const name = (id: string) => { const e = lib.entity(id); return e === undefined ? null : lib.label(e); };
  return (
    <>
      <p className="cg-muted" data-generator-rate={`${made}/${samples.length}`}>
        Udało się {made} z {samples.length}{tries === null ? '' : ` · średnio ${tries.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} losowań na zadanie${tries > 1.05 ? ` (odrzuconych ${Math.round((1 - 1 / tries) * 100)}%)` : ''}`}.
      </p>
      {failed.length > 0 && <p className="wk-warn" data-generator-problem="">{failed[0]!.problem}</p>}
      <ol className="cg-gen-samples" data-generator-samples={made}>
        {samples.filter((s) => s.card !== null).map((s) => (
          <li key={s.seed} data-generator-sample={s.seed}>
            <span className="cg-gen-q"><TexText text={s.card!.prompt.map((p) => p.text).join(' ') || (s.card!.answer.form === 'gap' ? s.card!.answer.shown : '—')} /></span>
            <span className="cg-gen-a">→ <TexText text={answerText(s.card!)} /></span>
            {s.card!.params !== undefined && <span className="cg-muted cg-gen-v">{paramsText(s.card!.params, name)}</span>}
          </li>
        ))}
      </ol>
    </>
  );
}

/** Pod pytaniem z parametrami: dziesięć przykładów, każdy z odpowiedzią i wylosowanymi wartościami. */
export function QuestionSamples({ id, data, lib }: { id: string; data: Readonly<Record<string, unknown>>; lib: CogitaLibrary }) {
  const [round, setRound] = useState(0);
  const text = JSON.stringify(data);
  const spec = useMemo(() => readParamsSpec(data), [text]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => {
    if (spec === null) return null;
    const world = lib.genWorld();
    const seeds = seedsOf(round);
    const samples = questionSamples({ id, kinds: ['question'], data: { ...data } }, seeds, world);
    const tries = sampleInstances(spec, seeds, (seed) => rngOf(`${seed}:${id}`), world).tries;
    return { samples, tries };
  }, [spec, round, id, lib, lib.revision]);
  if (result === null) return null;
  return (
    <section className="cg-card cg-gen" data-generator-for="question">
      <div className="cg-row-between">
        <strong>Przykłady zadań ({SAMPLE_COUNT})</strong>
        <button type="button" className="wk-link-btn" onClick={() => setRound((r) => r + 1)}>Inne przykłady</button>
      </div>
      <SampleList samples={result.samples} tries={result.tries} lib={lib} />
    </section>
  );
}

/** Pod szablonem z generatorem albo losową wartością: dziesięć kart dla wybranego wpisu. */
export function TemplateSamples({ make, lib, deps }: { make: (seed: string) => Promise<{ cards: readonly Card[]; problems: readonly string[] }>; lib: CogitaLibrary; deps: readonly unknown[] }) {
  const [round, setRound] = useState(0);
  const result = useAsync(async () => {
    const samples: Sample[] = [];
    for (const seed of seedsOf(round)) {
      const done = await make(seed);
      samples.push({ seed, card: done.cards[0] ?? null, problem: done.cards.length === 0 ? done.problems[0] ?? 'Karta nie powstała.' : null });
    }
    return samples;
  }, [round, ...deps]);
  return (
    <section className="cg-card cg-gen" data-generator-for="template">
      <div className="cg-row-between">
        <strong>Przykłady zadań ({SAMPLE_COUNT})</strong>
        <button type="button" className="wk-link-btn" onClick={() => setRound((r) => r + 1)}>Inne przykłady</button>
      </div>
      {result == null ? <p className="cg-muted">Losowanie…</p> : <SampleList samples={result} tries={null} lib={lib} />}
    </section>
  );
}
