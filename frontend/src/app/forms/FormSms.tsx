/**
 * „Napisz SMS" — eine Nachricht für die ganze Liste, mit Vorlagen.
 */

import { useState } from 'react';

import { rich, useT } from '../core/i18n';
import { WorkspaceError } from '../core/session';
import { askText } from '../ui/dialogs';
import { type OpenField, setPartConfig } from './form';
import { LINK, type SmsTemplate, VERIFY, templatesOf, usesHole } from './sms';

/**
 * „Napisz SMS" — die Nachricht für den ganzen Durchgang.
 *
 * <b>Nach dem Altbestand</b> (`RosterPart.SmsPanel`): oben die gespeicherten
 * Szablony, darunter der Text, darunter die Platzhalter zum Einsetzen, und
 * die Nachricht so, wie sie beim ersten Menschen der Liste ankommt.
 *
 * <b>Die Szablony gehören dem Formular</b>, der Text dem Durchgang: wer ihn
 * für heute umschreibt, ändert keinen Szablon, bis er ihn ausdrücklich
 * speichert.
 */
export function SmsPanel({
  partId, config, text, onText, onConfig, fields, hasPhones, preview, previewName,
  withoutSeat, willRenew, sentCount, onForget, onError
}: {
  partId: string;
  config: Record<string, string>;
  text: string;
  onText: (next: string) => void;
  onConfig: (next: Record<string, string>) => void;
  fields: readonly OpenField[];
  hasPhones: boolean;
  preview: string | null;
  previewName: string;

  /** Wie viele Menschen keinen Platz haben — bei ihnen bleibt `{link}` leer. */
  withoutSeat: number;

  /** Wie viele beim Verschicken einen NEUEN Link bekommen — ihr alter hört dann auf. */
  willRenew: number;

  sentCount: number;
  onForget: () => void;
  onError: (message: string | null) => void;
}) {
  const templates = templatesOf(config);
  const [naming, setNaming] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = useT();
  const code = { code: (s: string, k: number) => <code key={k}>{s}</code>, b: (s: string, k: number) => <strong key={k}>{s}</strong> };

  const saveList = async (list: readonly SmsTemplate[]) => {
    setSaving(true);
    onError(null);

    try {
      const done = await setPartConfig(partId, { smsTemplates: list.length === 0 ? '' : JSON.stringify(list) });
      onConfig(done.config);
      setNaming(null);
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : t('formsOffice.sms.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const saveAs = (label: string) => {
    const name = label.trim();
    if (name === '' || text.trim() === '') return;

    const at = templates.findIndex((one) => one.label === name);
    void saveList(at < 0
      ? [...templates, { label: name, text }]
      : templates.map((one, i) => (i === at ? { label: name, text } : one)));
  };

  const labels = fields.map((f) => f.label).filter((l): l is string => l !== null && l.trim() !== '');
  const holes = ['imie', 'osoba', LINK, ...(hasPhones ? [VERIFY] : []), ...labels];

  /*
   * WAS DER LINK FRAGT, GEHÖRT NICHT IN DIE NACHRICHT. Wer eine SMS
   * pomyłkowo dostaje, liest die Antwort sonst gleich mit — und die Frage beim
   * ersten Öffnen schützt nichts mehr.
   */
  const asked = fields.filter((f) => f.linkCheck);
  const nameAsked = asked.some((f) => f.identityRole === 'given_name' || f.identityRole === 'surname');
  const leaks = [
    ...asked.filter((f) => f.label !== null && usesHole(text, f.label)).map((f) => f.label!),
    ...(nameAsked && usesHole(text, 'osoba') ? ['osoba'] : []),
    ...(asked.some((f) => f.identityRole === 'given_name') && usesHole(text, 'imie') ? ['imie'] : [])
  ];

  return (
    <div className="wk-sms">
      {templates.length > 0 && (
        <ul className="wk-chips" aria-label={t('formsOffice.sms.templates')}>
          {templates.map((one, i) => (
            <li key={`${one.label}-${i}`} className={one.text === text ? 'wk-chip is-on' : 'wk-chip'}>
              <button type="button" className="wk-chip-pick" onClick={() => onText(one.text)}>{one.label}</button>
              <button
                type="button" className="wk-chip-x" disabled={saving}
                aria-label={t('formsOffice.sms.removeTemplate', { name: one.label })}
                onClick={async () => {
                  if (await askText(t('formsOffice.sms.removeAsk', { name: one.label }))) {
                    void saveList(templates.filter((_, j) => j !== i));
                  }
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        rows={3}
        value={text}
        aria-label={t('formsOffice.sms.text')}
        placeholder={t('formsOffice.sms.textPlaceholder')}
        onChange={(e) => onText(e.target.value)}
      />

      {/*
        Ein Klick setzt den Platzhalter ein — abgetippt wird er sonst falsch,
        und eine Frage heisst genau so, wie sie im Bogen steht.
      */}
      <div className="wk-chips">
        {holes.map((one) => (
          <button key={one} type="button" className="wk-chip wk-chip-add" onClick={() => onText(`${text}{${one}}`)}>
            + {`{${one}}`}
          </button>
        ))}
      </div>

      <p className="wk-hint">
        {rich(t(hasPhones ? 'formsOffice.sms.holesHintVerify' : 'formsOffice.sms.holesHint', { verify: `{${VERIFY}}` }), code)}
      </p>

      {preview !== null && (
        <p className="wk-sms-preview">
          <span className="wk-row-side">{t('formsOffice.sms.previewFor', { name: previewName })}</span>
          {preview}
        </p>
      )}

      {leaks.length > 0 && (
        <p className="wk-warn">
          {t('formsOffice.sms.leaks', { list: leaks.map((l) => `{${l}}`).join(', ') })}
        </p>
      )}

      {usesHole(text, LINK) && withoutSeat > 0 && (
        <p className="wk-hint">
          {rich(t('formsOffice.sms.withoutSeat', { count: withoutSeat }), code)}
        </p>
      )}

      {usesHole(text, LINK) && willRenew > 0 && (
        <p className="wk-hint">
          {rich(asked.length > 0
            ? t('formsOffice.sms.willRenewAsks', { count: willRenew, list: asked.map((f) => f.label ?? '—').join(', ') })
            : t('formsOffice.sms.willRenew', { count: willRenew }), code)}
        </p>
      )}

      <div className="wk-actions">
        {naming === null ? (
          <button
            type="button" className="wk-link-btn" disabled={saving || text.trim() === ''}
            onClick={() => setNaming(templates.find((one) => one.text === text)?.label ?? '')}
          >
            {t('formsOffice.sms.saveAs')}
          </button>
        ) : (
          <form className="wk-inline" onSubmit={(e) => { e.preventDefault(); saveAs(naming); }}>
            <input
              value={naming}
              placeholder={t('formsOffice.sms.namePlaceholder')}
              aria-label={t('formsOffice.sms.name')}
              disabled={saving}
              onChange={(e) => setNaming(e.target.value)}
            />
            <button type="submit" className="wk-btn" disabled={saving || naming.trim() === ''}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" className="wk-link-btn" disabled={saving} onClick={() => setNaming(null)}>
              {t('common.cancel')}
            </button>
          </form>
        )}

        {sentCount > 0 && (
          <span className="wk-hint">
            {t('formsOffice.sms.opened', { count: sentCount })} ·{' '}
            <button type="button" className="wk-link-btn" onClick={onForget}>{t('formsOffice.sms.clearMarks')}</button>
          </span>
        )}
      </div>
    </div>
  );
}
