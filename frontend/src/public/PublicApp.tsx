/**
 * Die öffentliche REcreatio-Seite.
 *
 * <b>Sie ersetzt den Foliensatz nicht — noch nicht.</b> Sie liegt unter
 * `PUBLIC_BASE` (`#/rc`) neben ihm, bis sie abgenommen ist; der Tausch ist eine
 * Zeile in `publicRoutes.ts` und eine in `main.tsx`.
 *
 * <b>Ein eigener Router wäre hier zu viel.</b> Zehn Seiten ohne Parameter,
 * ohne verschachtelte Ansichten und ohne Übergänge — dafür genügt die Adresse
 * und ein `hashchange`. `react-router` mitzuschleppen hiesse, dem öffentlichen
 * Teil eine Abhängigkeit aufzuladen, die er nicht braucht und die beim Wechsel
 * auf gewöhnliche Pfade sowieso neu bedacht werden müsste.
 *
 * <b>Der Bildlauf springt bei jedem Seitenwechsel nach oben.</b> Ohne das
 * landet man auf der neuen Seite in der Mitte — der Fehler, den fast jede
 * Einzelseiten-Anwendung einmal hatte.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  detectPublicLang, publicCopy, storePublicLang,
  type PublicCopy, type PublicLang
} from './content';
import { applyLocalText } from './content/localText';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { publicPageOf, type PublicPage } from './publicRoutes';
import { usePublicHead } from './usePublicHead';

import { ManifestPage } from './pages/ManifestPage';
import { AboutPage } from './pages/AboutPage';
import { TransparencyPage } from './pages/TransparencyPage';
import { ContactPage } from './pages/ContactPage';
import { OsrodekPage } from './pages/OsrodekPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { WesprzyjPage } from './pages/WesprzyjPage';
import { NotFoundPage } from './pages/NotFoundPage';

import './public.css';

export function PublicApp() {
  const [lang, setLang] = useState<PublicLang>(detectPublicLang);
  const [page, setPage] = useState<PublicPage | null>(() => publicPageOf(window.location.hash));

  useEffect(() => {
    const onHash = () => {
      setPage(publicPageOf(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { storePublicLang(lang); }, [lang]);

  // Der Quelltext aus `content/local/` tritt hier an die Stelle der Lücken.
  // Liegt er nicht da, bleiben die Lücken sichtbar — und die Seite baut.
  const copy = useMemo(() => applyLocalText(publicCopy[lang], lang), [lang]);

  const title = page === null ? copy.notFound.title : titleOf(page, copy);
  usePublicHead(page, title, copy, lang);

  return (
    <div className="pub-root">
      <PublicHeader copy={copy} lang={lang} onLang={setLang} active={page} />

      <main className="pub-main" id="pub-main">
        {page === 'manifest' && <ManifestPage copy={copy} />}
        {page === 'o-nas' && <AboutPage copy={copy} />}
        {page === 'przejrzystosc' && <TransparencyPage copy={copy} />}
        {page === 'kontakt' && <ContactPage copy={copy} />}
        {page === 'osrodek' && <OsrodekPage copy={copy} />}
        {page === 'wesprzyj' && <WesprzyjPage copy={copy} />}

        {page === 'wydarzenia' && (
          <PlaceholderPage copy={copy} page={copy.placeholders.wydarzenia} />
        )}
        {page === 'biblioteka' && (
          <PlaceholderPage copy={copy} page={copy.placeholders.biblioteka} />
        )}
        {page === 'cogita' && <PlaceholderPage copy={copy} page={copy.placeholders.cogita} />}
        {page === 'narzedzia' && (
          <PlaceholderPage copy={copy} page={copy.placeholders.narzedzia} />
        )}

        {page === null && <NotFoundPage copy={copy} />}
      </main>

      <PublicFooter copy={copy} />
    </div>
  );
}

/** Der Fenstertitel je Seite. Die Startseite trägt den Namen allein. */
function titleOf(page: PublicPage, copy: PublicCopy): string {
  if (page === 'manifest') return copy.meta.siteName;
  return copy.nav[page];
}

export default PublicApp;
