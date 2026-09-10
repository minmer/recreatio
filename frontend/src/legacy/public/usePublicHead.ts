/**
 * Titel, Beschreibung und kanonische Adresse je Seite.
 *
 * <b>Was das leistet und was nicht.</b> Für einen Menschen stimmt damit alles:
 * der Fenstertitel, der Name des Lesezeichens, die Vorlesereihenfolge. Für
 * eine Suchmaschine stimmt es NICHT — solange die Adressen eine Raute tragen,
 * sieht ein Sammler, der kein JavaScript ausführt, für jede Seite dieselbe
 * Datei mit demselben Titel. Was hinter der Raute steht, erreicht den Server
 * nie.
 *
 * Das ist kein Fehler in diesem Modul, sondern die Folge der Rautenadressen,
 * und es steht hier, damit es später niemand für einen Fehler hält. An dem Tag,
 * an dem `PUBLIC_BASE` leer wird und der Router auf gewöhnliche Pfade wechselt,
 * wird derselbe Code richtig — ohne Änderung.
 */

import { useEffect } from 'react';
import type { PublicCopy } from './content';
import { publicHref, type PublicPage } from './publicRoutes';

function setMeta(name: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (tag === null) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.append(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (link === null) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.append(link);
  }
  link.setAttribute('href', href);
}

export function usePublicHead(
  page: PublicPage | null,
  title: string,
  copy: PublicCopy,
  lang: string
): void {
  useEffect(() => {
    // Die Startseite trägt den Namen allein. „REcreatio — REcreatio" wäre der
    // Titel, den ein Zusammenbau ohne Nachdenken erzeugt.
    document.title =
      title === copy.meta.titleSuffix ? title : `${title} — ${copy.meta.titleSuffix}`;

    setMeta('description', copy.meta.description);

    document.documentElement.lang = lang;
    const langMeta = document.getElementById('app-content-language');
    if (langMeta !== null) langMeta.setAttribute('content', lang);

    if (page !== null) {
      const { origin, pathname } = window.location;
      setCanonical(`${origin}${pathname}${publicHref(page)}`);
    }
  }, [page, title, copy, lang]);
}
