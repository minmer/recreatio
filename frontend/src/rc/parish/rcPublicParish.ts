/**
 * Die öffentlichen Angaben einer Pfarrei — vom Dienst, nicht aus einer Liste.
 *
 * <b>Hier stand eine erfundene Liste.</b> Sie trug einen ausgedachten Namen
 * („Parafia św. Grzegorza Wielkiego"), und der stimmte nicht: die Pfarrei
 * heisst, wie sie beim Anlegen genannt wurde. Ein Verzeichnis, das etwas
 * anderes behauptet als die Datenbank, ist schlimmer als keines — es sieht
 * richtig aus.
 *
 * Der Name, der Ort und die Gestaltung der Startseite kommen jetzt von
 * `/rc/public/parishes`. Ohne Konto, weil eine Pfarrseite ohne Konto lesbar
 * sein muss.
 */

import { rcFetch } from '../lib/rcApi';
import type { RcApi } from '../lib/rcApi';

export type RcPublicParishes = RcApi<'RcPublicParishesResponse'>;
export type RcPublicParish = RcApi<'RcPublicParishResponse'>;
export type RcPublicParishView = RcApi<'PublicParishPublicParishView'>;

/** Alle Pfarrseiten, die es gibt. Für das Werkzeugverzeichnis. */
export const rcPublicParishes = () =>
  rcFetch<RcPublicParishes>('/public/parishes');

/** Eine Pfarrei samt der Gestaltung ihrer Startseite. */
export const rcPublicParish = (slug: string) =>
  rcFetch<RcPublicParish>(`/public/parishes/${encodeURIComponent(slug)}`);
