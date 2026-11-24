/**
 * 2026-11-24 (Eigentümer: „alle Werkzeuge der Lehrerin gehören in die Welt — ich wähle auf der Karte, nicht in einer Liste mit
 * Häkchen") — „ŚWIAT KLASY" IST DIE KARTE SELBST. Der Reiter zeigt die Weltkarte der Baza und öffnet sie gleich im Wahl-Modus für
 * diese Klasse (`worldmap/ClassSelect.tsx`): Türme, Abschnitte, Gabelungen und Wegweiser an- und abwählen, Speichern, Abbrechen,
 * Zurück, Alles, Nichts — alles in der Leiste der Karte. Nach dem Speichern bleibt die Karte stehen; „Zmień wybór" öffnet die Wahl
 * neu. Wer die Baza nicht schreibt, sieht die Karte der Klasse, wie die Schüler sie sehen.
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import { Loading } from '../../ui/Loading';
import { useAsync, useCtx } from '../ui';
import { readView } from '../views';
import { WorldLandscape } from '../worldmap/WorldLandscape';
import type { ClassOf } from './classModel';
import { baseWorldViewOf, classOnly, classViewOf } from './subWorld';
import './classes.css';

export function SubWorldEditor({ klass }: { klass: ClassOf }) {
  const t = useT();
  const { lib, writes } = useCtx();
  const cards = useAsync(() => lib.cards().then((r) => r.cards), [lib, lib.revision]);
  /* Wer schreibt, wählt: die Karte öffnet sich im Wahl-Modus für diese Klasse; „Zmień wybór" baut sie neu auf (wieder im Wahl-Modus). */
  const [round, setRound] = useState(0);
  const again = () => setRound((n) => n + 1);
  const baseId = baseWorldViewOf(lib);
  const viewId = writes ? baseId : (classViewOf(lib, klass) ?? baseId);
  const doc = viewId === null ? undefined : lib.docs('view').find((d) => d.id === viewId);
  if (doc === undefined) return <p className="cg-muted" data-subworld="none">{t('cogitaSubWorld.noWorld')}</p>;
  if (cards === undefined) return <Loading label={t('cogitaSubWorld.loading')} />;
  const only = classOnly(lib, klass.areaId);
  return (
    <section className="cl-subworld" data-subworld={only === null ? 'whole' : 'part'} data-subworld-map="">
      <div className="cl-subworld-head">
        <p className="cg-muted">{writes ? t('cogitaClassMap.tabSays', { name: klass.name }) : t('cogitaClassMap.tabRead', { name: klass.name })}</p>
        {writes && <button type="button" className="wk-btn wk-btn-line" onClick={again} data-subworld-again="">{t('cogitaClassMap.again')}</button>}
      </div>
      <WorldLandscape key={round} view={readView(doc.data)} cards={cards ?? []} learner={null} viewKey={doc.id} selectFor={writes ? { areaId: klass.areaId, name: klass.name } : null} />
    </section>
  );
}
