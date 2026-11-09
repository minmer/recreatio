/**
 * 2026-11-05 — JĘZYK / SPRACHE / LANGUAGE (`#/workspace/account/jezyk`): die Sprache der Anwendung auf diesem
 * Gerät, und je Teil der Anwendung eine eigene. Seiten und ihre Bausteine wählen ihre Sprache im Editor der Seite.
 * documentation/LOCALIZATION.md.
 */

import { useState } from 'react';

import {
  initialLang, LANG_NAME, langChosen, SECTIONS, sectionLangs, setAppLang, setSectionLang, useT, type Lang
} from '../core/i18n';
import { useCrumbs } from '../shell/crumbTrail';
import { LangPick } from '../ui/LangPick';
import { PageHeader } from '../ui/PageHeader';

/** Die Adresse der Seite (Menü des Kontos, Suche). */
export const LANGUAGE = 'jezyk';

/** Was der Browser sagt, wenn man nichts gewählt hat. */
function browserLang(): Lang {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.slice(0, 2).toLowerCase();
    if (base === 'en' || base === 'de' || base === 'pl') return base;
  }
  return 'en';
}

export function LanguagePage() {
  const t = useT();
  useCrumbs([{ label: t('i18n.title'), href: null }]);
  const [own, setOwn] = useState(() => sectionLangs());
  const chosen = langChosen() ? initialLang() : null;

  return (
    <div className="wk-narrow ui-page">
      <PageHeader title={t('i18n.title')} />

      <section aria-labelledby="lang-app">
        <h2 className="wk-h2" id="lang-app">{t('i18n.appLang')}</h2>
        <label className="wk-field" title={t('i18n.appLangNote')}>
          <span>{t('i18n.appLang')}</span>
          <LangPick
            value={chosen}
            follow={t('i18n.followBrowser', { lang: LANG_NAME[browserLang()] })}
            onChange={(lang) => setAppLang(lang)}
          />
        </label>
      </section>

      <section aria-labelledby="lang-sections">
        <h2 className="wk-h2" id="lang-sections">{t('i18n.sections')}</h2>
        <div className="wk-box" title={t('i18n.sectionsNote')}>
          {SECTIONS.map((section, i) => (
            <label className={`wk-line${i === 0 ? ' wk-line-first' : ''}`} key={section}>
              <span className="wk-line-text"><span className="wk-line-title">{t(`i18n.section.${section}`)}</span></span>
              <LangPick
                value={own[section] ?? null}
                follow={t('i18n.followApp')}
                label={t(`i18n.section.${section}`)}
                onChange={(lang) => { setSectionLang(section, lang); setOwn(sectionLangs()); }}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
