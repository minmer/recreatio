/**
 * 0137 — DIE GEFÜHRTE EINRICHTUNG: fünf Schritte, erst grob. Schritt 1 schlägt die Schritte 2–5 vor
 * (`suggestFrom`); wer nichts ändert, bekommt eine brauchbare Gruppe. Es gibt keine festen Typen —
 * statt dessen „Zacznij od przykładu": dieselben Beispiel-Einstellungen wie im JSON, als Startpunkt.
 */

import { useState } from 'react';

import { useT, type T } from '../core/i18n';
import type { Who } from '../core/session';
import { viewPath } from '../routes';
import { PageHeader } from '../ui/PageHeader';
import { STEP_TITLES, suggestFrom, withSuggestions, type CommunityDoc, type Step } from './community';
import { planLines } from './communityCompile';
import { updateUnit } from './communityEdit';
import { readCommunity } from './communityJson';
import { EXAMPLES } from './communityExamples';
import { RunDialog } from './CommunityRun';
import { UnitSettings } from './UnitSettings';

const blank = (name: string, t: T): CommunityDoc => ({
  name,
  positions: [
    { key: 'prowadzacy', name: t('communities.wizard.leader'), rights: 'lead' },
    { key: 'czlonek', name: t('communities.wizard.member'), rights: 'member' }
  ],
  fields: [], blueprints: [],
  unit: { key: 'wspolnota', name, kind: 'group', positions: ['prowadzacy', 'czlonek'] },
  persons: []
});

export function Wizard({ who }: { who: Who }) {
  const t = useT();
  const [name, setName] = useState('');
  const [doc, setDoc] = useState<CommunityDoc | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [run, setRun] = useState(false);
  const [made, setMade] = useState<string | null>(null);

  if (doc === null) {
    return (
      <div className="wk-narrow ui-page" data-cm-wizard="start">
        <PageHeader title={t('communities.list.new')} meta={t('communities.wizard.meta')} />
        <label className="wk-field"><span>{t('communities.wizard.nameLabel')}</span><input value={name} autoFocus placeholder={t('communities.wizard.namePlaceholder')} onChange={(e) => setName(e.target.value)} data-cm-name="" /></label>
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={name.trim() === ''} onClick={() => setDoc(blank(name.trim(), t))} data-cm-begin="">{t('communities.wizard.begin')}</button>
        </div>
        <h2 className="wk-h3">{t('communities.wizard.fromExample')}</h2>
        <p className="wk-note">{t('communities.wizard.notTypes')}</p>
        <ul className="wk-cm-children">
          {EXAMPLES.map((e) => (
            <li key={e.key}>
              <button type="button" className="wk-link-btn" onClick={() => {
                const read = readCommunity(e.doc());
                if (!('error' in read)) { setDoc(read.doc); setName(read.doc.name); }
              }}>{e.label}</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const next = () => {
    if (step === 1) {
      /* Krok 1 podpowiada resztę — tylko tam, gdzie nic jeszcze nie ustawiono. */
      const life = (doc.unit.settings?.life ?? {}) as Record<string, unknown>;
      setDoc(updateUnit(doc, doc.unit.key, (u) => ({ ...u, settings: withSuggestions(u.settings, suggestFrom(life)) })));
    }
    setStep((s) => Math.min(5, s + 1) as Step);
  };
  return (
    <div className="wk-narrow ui-page" data-cm-wizard={step}>
      <PageHeader title={doc.name} meta={t('communities.wizard.stepMeta', { step, title: STEP_TITLES[step] })} />
      <ol className="wk-cm-steps" aria-label={t('communities.wizard.steps')}>
        {([1, 2, 3, 4, 5] as const).map((s) => (
          <li key={s} className={s === step ? 'is-on' : s < step ? 'is-done' : undefined}>
            <button type="button" className="wk-link-btn" onClick={() => setStep(s)}>{s}. {STEP_TITLES[s]}</button>
          </li>
        ))}
      </ol>
      <UnitSettings doc={doc} unitKey={doc.unit.key} onChange={setDoc} only={step} />
      <div className="wk-actions">
        {step > 1 && <button type="button" className="wk-btn wk-btn-line" onClick={() => setStep((s) => (s - 1) as Step)}>{t('common.back')}</button>}
        {step < 5 ? <button type="button" className="wk-btn" onClick={next} data-cm-next="">{t('common.next')}</button>
          : <button type="button" className="wk-btn" onClick={() => setRun(true)} data-cm-create="">{t('communities.wizard.planAndCreate')}</button>}
      </div>
      {run && (
        <RunDialog who={who} rootAreaId={null} doc={doc} lines={planLines(doc, null, new Map())} title={t('communities.wizard.planTitle')}
          onClose={() => { setRun(false); if (made !== null) window.location.hash = viewPath('wspolnoty', made); }} onDone={(r) => setMade(r.rootAreaId)} />
      )}
    </div>
  );
}
