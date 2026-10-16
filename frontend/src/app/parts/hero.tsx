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
  label: 'Tytuł',
  use: 'Pierwszy ekran wydarzenia: hasło, termin, krótki opis i przyciski.',
  box: { colSpan: 6, rowSpan: 3 },
  ownHeading: true,

  blank: () => ({ badge: null, badgeLook: 'pill', size: 'display', headline: '', lede: null, paragraphs: [], actions: [], footnote: null }),
  example: () => ({
    badge: '28–29.08.2026 · Kraków → Częstochowa',
    badgeLook: 'pill',
    size: 'display',
    headline: 'Pielgrzymka rowerowa',
    lede: 'Dwa dni, 140 km, jedna wspólnota.',
    paragraphs: ['Jedziemy razem na Jasną Górę — w swoim tempie, z przerwami na modlitwę i odpoczynek.'],
    actions: [{ label: 'Zapisz się', href: '#zapisy', variant: 'cta' }, { label: 'Program', href: '#plan', variant: 'ghost' }],
    footnote: null
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    badge: 'Plakietka nad hasłem, np. termin i miejsce (albo null)',
    badgeLook: '"pill" — plakietka w obwódce (zwykłe), "kicker" — nadtytuł: wersaliki, rozstrzelone, w kolorze akcentu',
    size: '"display" — hasło bardzo duże (pierwszy ekran), "title" — mniejsze (kolejne slajdy pokazu, dłuższe hasła)',
    headline: 'Hasło — duży tytuł modułu',
    lede: 'Podtytuł przy haśle (albo null)',
    paragraphs: 'Akapity opisu — lista tekstów',
    actions: 'Przyciski — lista',
    'actions[].label': 'Napis na przycisku',
    'actions[].href': 'Dokąd prowadzi: "#nazwa-slajdu" (np. "#zapisy" — skok do modułu o tej nazwie w menu), adres strony albo pełny adres https://…',
    'actions[].variant': '"cta" — wyróżniony, "ghost" — zwykły',
    footnote: 'Dopisek drobnym drukiem (albo null)'
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

  shows: (_c, size) => size.height === 'strip' ? 'Hasło i przyciski.' : 'Plakietka, hasło z podtytułem, opis i przyciski.',

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

  Edit: ({ config, onChange }) => (
    <>
      <TextRow label="Plakietka" value={config.badge ?? ''} hint="Np. termin i miejsce." onChange={(badge) => onChange({ ...config, badge: badge || null })} />
      <SelectRow<TitleConfig['badgeLook']>
        label="Wygląd plakietki"
        value={config.badgeLook}
        options={[{ value: 'pill', label: 'W obwódce' }, { value: 'kicker', label: 'Nadtytuł — wersaliki w kolorze akcentu' }]}
        onChange={(badgeLook) => onChange({ ...config, badgeLook })}
      />
      <TextRow label="Hasło" value={config.headline} onChange={(headline) => onChange({ ...config, headline })} />
      <SelectRow<TitleConfig['size']>
        label="Wielkość hasła"
        value={config.size}
        options={[{ value: 'display', label: 'Bardzo duże — pierwszy ekran' }, { value: 'title', label: 'Mniejsze — kolejne slajdy, dłuższe hasła' }]}
        onChange={(size) => onChange({ ...config, size })}
      />
      <TextRow label="Podtytuł" value={config.lede ?? ''} onChange={(lede) => onChange({ ...config, lede: lede || null })} />
      <LinesRow label="Akapity" values={config.paragraphs} rows={4} hint="Jeden akapit w wierszu." onChange={(paragraphs) => onChange({ ...config, paragraphs })} />
      <ListEditor<Action>
        legend="Przyciski"
        items={config.actions}
        addLabel="Dodaj przycisk"
        blank={() => ({ label: 'Zapisz się', href: '#', variant: 'cta' })}
        titleOf={(item) => item.label || 'Przycisk'}
        onChange={(actions) => onChange({ ...config, actions })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Napis" value={item.label} onChange={(label) => update({ ...item, label })} />
            <TextRow label="Dokąd" value={item.href} hint="#nazwa-slajdu (np. #zapisy), adres strony albo pełny adres https://…" onChange={(href) => update({ ...item, href })} />
            <SelectRow<Action['variant']>
              label="Styl"
              value={item.variant}
              options={[{ value: 'cta', label: 'Wyróżniony' }, { value: 'ghost', label: 'Zwykły' }]}
              onChange={(variant) => update({ ...item, variant })}
            />
          </>
        )}
      />
      <AreaRow label="Dopisek" rows={2} value={config.footnote ?? ''} onChange={(footnote) => onChange({ ...config, footnote: footnote || null })} />
    </>
  )
});
