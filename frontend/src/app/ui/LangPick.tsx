/**
 * 2026-11-05 — EINE SPRACHE WÄHLEN: Englisch, Deutsch, Polnisch — und, wenn `follow` gesetzt ist, „keine eigene"
 * (`null`: folgt der Anwendung, der Seite, dem Besucher …). Jede Sprache steht in ihrem eigenen Namen.
 */

import { LANG_NAME, LANGS, isLang, useT, type Lang } from '../core/i18n';

export function LangPick({ value, onChange, follow, label, disabled = false, className = 'wk-input' }: {
  value: Lang | null;
  onChange: (lang: Lang | null) => void;
  /** Die Bezeichnung von „keine eigene Sprache"; ohne sie muss eine gewählt sein. */
  follow?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();
  return (
    <select
      className={className}
      aria-label={label ?? t('common.language')}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(isLang(e.target.value) ? e.target.value : null)}
    >
      {follow !== undefined && <option value="">{follow}</option>}
      {LANGS.map((one) => <option key={one} value={one} lang={one}>{LANG_NAME[one]}</option>)}
    </select>
  );
}

export default LangPick;
