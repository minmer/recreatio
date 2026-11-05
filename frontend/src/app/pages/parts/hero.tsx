/**
 * TYTUŁ — der erste Bildschirm eines Ereignisses (Altbestand: `TitlePart`).
 *
 * Plakietka, Hasło mit Untertitel, ein paar Absätze, Knöpfe. Ein Knopf mit
 * `#zapisy` springt zum Slajd (oder Baustein) dieses Namens; jede andere
 * Adresse öffnet sich wie ein Link.
 *
 * <b>Je Grösse:</b> im Streifen nur Hasło und Knöpfe — ein Streifen ist eine
 * Zeile; als Block und hoch alles. Ohne Karte darum (`app.css`): ein Titel
 * steht auf der Seite, nicht in einem Kasten.
 *
 * Die Art heisst `hero` und nicht `title`: `wk-card-title` ist schon die
 * Überschrift jeder Kachel.
 */

import { t, useT } from '../../core/i18n';
import { asOptionalText, asRecord, asStringList, asText, AreaRow, defineEventPart, LinesRow, ListEditor, mapEntries, SelectRow, TextRow } from '../event/kit';

type Action = { label: string; href: string; variant: 'cta' | 'ghost' };

type TitleConfig = {
  badge: string | null;
  /** 0107 — die Plakietka als Pille (Vorgabe) oder als Nadtytuł: Versalien, gesperrt, in der Farbe des Akzents (Cogita). */
  badgeLook: 'pill' | 'kicker';
  /** 0107 — das Hasło gross (der erste Bildschirm) oder kleiner (die folgenden Slajdy eines Pokaz). */
  size: 'display' | 'title';
  headline: string;
  lede: string | null;
  paragraphs: string[];
  actions: Action[];
  footnote: string | null;
};

export const heroPart = defineEventPart<TitleConfig>({
  kind: 'hero',
  label: 'moduleContent.hero.label',
  use: 'moduleContent.hero.use',
  box: { colSpan: 6, rowSpan: 3 },
  ownHeading: true,

  blank: () => ({ badge: null, badgeLook: 'pill', size: 'display', headline: '', lede: null, paragraphs: [], actions: [], footnote: null }),
  example: () => ({
    badge: '28–29.08.2026 · Kraków → Częstochowa', // i18n-ignore
    badgeLook: 'pill',
    size: 'display',
    headline: 'Pielgrzymka rowerowa',
    lede: 'Dwa dni, 140 km, jedna wspólnota.', // i18n-ignore
    paragraphs: ['Jedziemy razem na Jasną Górę — w swoim tempie, z przerwami na modlitwę i odpoczynek.'], // i18n-ignore
    actions: [{ label: 'Zapisz się', href: '#zapisy', variant: 'cta' }, { label: 'Program', href: '#plan', variant: 'ghost' }], // i18n-ignore
    footnote: null
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    badge: 'moduleContent.hero.key.badge',
    badgeLook: 'moduleContent.hero.key.badgeLook',
    size: 'moduleContent.hero.key.size',
    headline: 'moduleContent.hero.key.headline',
    lede: 'moduleContent.hero.key.lede',
    paragraphs: 'moduleContent.hero.key.paragraphs',
    actions: 'moduleContent.hero.key.actions',
    'actions[].label': 'moduleContent.hero.key.actionLabel',
    'actions[].href': 'moduleContent.hero.key.actionHref',
    'actions[].variant': 'moduleContent.hero.key.actionVariant',
    footnote: 'moduleContent.hero.key.footnote'
  },

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      badge: asOptionalText(record.badge),
      badgeLook: asText(record.badgeLook) === 'kicker' ? 'kicker' : 'pill',
      size: asText(record.size) === 'title' ? 'title' : 'display',
      headline: asText(record.headline).trim(),
      lede: asOptionalText(record.lede),
      paragraphs: asStringList(record.paragraphs),
      actions: mapEntries<Action>(record.actions, (item) => {
        /* Nichts fällt beim Lesen weg: ein eben hinzugefügter Knopf ist noch leer. Die Ansicht lässt die leeren aus. */
        return { label: asText(item.label).trim(), href: asText(item.href).trim(), variant: asText(item.variant) === 'ghost' ? 'ghost' : 'cta' };
      }),
      footnote: asOptionalText(record.footnote)
    };
  },

  hasContent: (c) => c.headline !== '' || c.paragraphs.length > 0,

  shows: (_c, size) => size.height === 'strip' ? t('moduleContent.hero.showsStrip') : t('moduleContent.hero.showsAll'),

  Body: ({ config, ctx }) => {
    const actions = config.actions.filter((a) => a.label !== '' && a.href !== '');
    const strip = ctx.size.height === 'strip';
    /* 0107 — ein kleineres Hasło ist eine Überschrift unter dem ersten Bildschirm, kein zweites h1. */
    const Head = config.size === 'title' ? 'h2' : 'h1';
    return (
      <section className={`ev-title${strip ? ' is-strip' : ''}${config.size === 'title' ? ' is-title' : ''}`}>
        {!strip && config.badge !== null && <p className={config.badgeLook === 'kicker' ? 'ev-kicker' : 'ev-badge'}>{config.badge}</p>}
        {config.headline !== '' && (
          <Head>
            {config.headline}
            {!strip && config.lede !== null && <span>{config.lede}</span>}
          </Head>
        )}
        {!strip && config.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {actions.length > 0 && (
          <div className="ev-actions">
            {actions.map((action, index) => (
              <a key={index} className={action.variant === 'ghost' ? 'ev-ghost' : 'ev-cta'} href={action.href}
                {...(/^https?:/i.test(action.href) ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>
                {action.label}
              </a>
            ))}
          </div>
        )}
        {!strip && config.footnote !== null && <small>{config.footnote}</small>}
      </section>
    );
  },

  Edit: function HeroEdit({ config, onChange }) {
    const t = useT();
    return (
    <>
      <TextRow label={t('moduleContent.hero.badge')} value={config.badge ?? ''} hint={t('moduleContent.hero.badgeHint')} onChange={(badge) => onChange({ ...config, badge: badge || null })} />
      <SelectRow<TitleConfig['badgeLook']>
        label={t('moduleContent.hero.badgeLook')}
        value={config.badgeLook}
        options={[{ value: 'pill', label: t('moduleContent.hero.badgePill') }, { value: 'kicker', label: t('moduleContent.hero.badgeKicker') }]}
        onChange={(badgeLook) => onChange({ ...config, badgeLook })}
      />
      <TextRow label={t('moduleContent.hero.headline')} value={config.headline} onChange={(headline) => onChange({ ...config, headline })} />
      <SelectRow<TitleConfig['size']>
        label={t('moduleContent.hero.size')}
        value={config.size}
        options={[{ value: 'display', label: t('moduleContent.hero.sizeDisplay') }, { value: 'title', label: t('moduleContent.hero.sizeTitle') }]}
        onChange={(size) => onChange({ ...config, size })}
      />
      <TextRow label={t('moduleContent.hero.lede')} value={config.lede ?? ''} onChange={(lede) => onChange({ ...config, lede: lede || null })} />
      <LinesRow label={t('moduleContent.hero.paragraphs')} values={config.paragraphs} rows={4} hint={t('moduleContent.hero.paragraphsHint')} onChange={(paragraphs) => onChange({ ...config, paragraphs })} />
      <ListEditor<Action>
        legend={t('moduleContent.hero.actions')}
        items={config.actions}
        addLabel={t('moduleContent.hero.addAction')}
        blank={() => ({ label: t('moduleContent.hero.newAction'), href: '#', variant: 'cta' })}
        titleOf={(item) => item.label || t('moduleContent.hero.action')}
        onChange={(actions) => onChange({ ...config, actions })}
        renderItem={(item, update) => (
          <>
            <TextRow label={t('moduleContent.hero.actionLabel')} value={item.label} onChange={(label) => update({ ...item, label })} />
            <TextRow label={t('moduleContent.hero.actionHref')} value={item.href} hint={t('moduleContent.hero.actionHrefHint')} onChange={(href) => update({ ...item, href })} />
            <SelectRow<Action['variant']>
              label={t('moduleContent.hero.actionVariant')}
              value={item.variant}
              options={[{ value: 'cta', label: t('moduleContent.hero.variantCta') }, { value: 'ghost', label: t('moduleContent.hero.variantGhost') }]}
              onChange={(variant) => update({ ...item, variant })}
            />
          </>
        )}
      />
      <AreaRow label={t('moduleContent.hero.footnote')} rows={2} value={config.footnote ?? ''} onChange={(footnote) => onChange({ ...config, footnote: footnote || null })} />
    </>
    );
  }
});
