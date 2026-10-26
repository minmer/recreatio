/**
 * 2026-10-26 — DIE FARBEN DES KIRCHENJAHRES bearbeiten (Knoten „Okres
 * liturgiczny"): je Abschnitt eine Farbe, dazu die besonderen Tage (Gaudete,
 * Laetare, Palmsonntag, Karfreitag, Pfingsten). Rechnen kann die App, wann ein
 * Abschnitt ist; welche Farbe er hat, sagt der Nutzer (D6 B).
 *
 * `ColourInput` — ein Wort aus den liturgischen Farben oder ein eigenes, mit
 * seinem Plättchen — brauchen auch die Feste.
 */

import { useId } from 'react';

import { colourClass, LITURGICAL_COLOURS } from '../scheme';
import { SEASON_LABEL, SEASONS, type Season, type SeasonData } from './flowModel';
import { SPECIAL_LABEL } from './FlowNodes';

/** Ein Plättchen in der Farbe des Wortes — fremde Wörter ohne Farbe. */
export function ColourSwatch({ word }: { word: string }) {
  const known = colourClass(word);
  return <span className={`wk-lc${known === null ? ' is-unknown' : ` ${known}`}`} aria-hidden="true" />;
}

export function ColourInput({ value, onChange, disabled = false, label }: {
  value: string; onChange: (word: string) => void; disabled?: boolean; label: string;
}) {
  const list = useId();
  return (
    <span className="wk-flow-colour">
      <ColourSwatch word={value} />
      <input value={value} disabled={disabled} aria-label={label} list={list} placeholder="kolor"
        onChange={(e) => onChange(e.target.value)} />
      <datalist id={list}>{LITURGICAL_COLOURS.map((c) => <option key={c.value} value={c.value} />)}</datalist>
    </span>
  );
}

type Special = keyof NonNullable<SeasonData['special']>;
const SPECIALS: readonly Special[] = ['gaudete', 'laetare', 'palm', 'goodFriday', 'pentecost'];

export function EditSeason({ data, onChange, disabled = false }: {
  data: SeasonData; onChange: (data: SeasonData) => void; disabled?: boolean;
}) {
  const colours = data.colours ?? {};
  const special = data.special ?? {};
  const setColour = (season: Season, word: string) => onChange({ ...data, colours: { ...colours, [season]: word } });
  const setSpecial = (day: Special, word: string) => onChange({ ...data, special: { ...special, [day]: word } });

  return (
    <div className="wk-flow-stack">
      <p className="wk-flow-note">
        Węzeł liczy okres, tydzień i rangę dnia (np. niedziela Adwentu) — co roku od nowa, z datą Wielkanocy i Adwentu.
        Kolory wpisujesz Ty.
      </p>
      <table className="wk-flow-table">
        <thead><tr><th scope="col">Okres</th><th scope="col">Kolor</th></tr></thead>
        <tbody>
          {SEASONS.map((season) => (
            <tr key={season}>
              <th scope="row">{SEASON_LABEL[season]}</th>
              <td><ColourInput label={`Kolor: ${SEASON_LABEL[season]}`} value={colours[season] ?? ''} disabled={disabled}
                onChange={(word) => setColour(season, word)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="wk-flow-table">
        <thead><tr><th scope="col">Dzień szczególny</th><th scope="col">Kolor</th></tr></thead>
        <tbody>
          {SPECIALS.map((day) => (
            <tr key={day}>
              <th scope="row">{SPECIAL_LABEL[day]}</th>
              <td><ColourInput label={`Kolor: ${SPECIAL_LABEL[day]}`} value={special[day] ?? ''} disabled={disabled}
                onChange={(word) => setSpecial(day, word)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EditSeason;
