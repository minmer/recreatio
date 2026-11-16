/**
 * 2026-11-16 — EIN ZAUN IM ZAPIS: eine Grafik (`visual.ts`) wird gezeichnet, sobald sie gebraucht wird — ihr Bündel
 * (`visuals/Visuals.tsx`) lädt erst dann; bis dahin hält ein Platz die Höhe, damit der Text nicht springt. Ein anderer Zaun
 * (```python, ``` ) ist Code: wie er geschrieben ist.
 */

import { lazy, Suspense } from 'react';

import { visualKindOf } from './visual';
import type { LabelOf } from './visuals/Visuals';

const Visual = lazy(() => import('./visuals/Visuals'));

export function FenceBlock({ lang, info, body, label }: { lang: string; info: string; body: string; label: LabelOf }) {
  if (visualKindOf(lang) === null) return <pre className="lib-code" data-code-lang={lang || undefined}><code>{body}</code></pre>;
  return (
    <Suspense fallback={<div className="lib-visual-wait" aria-hidden />}>
      <Visual lang={lang} info={info} body={body} label={label} />
    </Suspense>
  );
}
