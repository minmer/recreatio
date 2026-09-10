/**
 * Die öffentliche REcreatio-Seite.
 *
 * Sie liegt unter `PUBLIC_BASE` (`#/rc`) neben dem alten Foliensatz, bis sie
 * abgenommen ist; der Tausch ist eine Zeile in `publicRoutes.ts` und eine in
 * `main.tsx`.
 *
 * <b>Ein eigener Router wäre hier zu viel.</b> Zwölf Seiten ohne Parameter,
 * ohne verschachtelte Ansichten — dafür genügen die Adresse und ein
 * `hashchange`. `react-router` mitzuschleppen hiesse, dem öffentlichen Teil
 * eine Abhängigkeit aufzuladen, die beim Wechsel auf gewöhnliche Pfade ohnehin
 * neu bedacht werden müsste.
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

import { FrontPage } from './pages/FrontPage';
import { ManifestPage } from './pages/ManifestPage';
import { AboutPage } from './pages/AboutPage';
import { SecurityPage } from './pages/SecurityPage';
import { TransparencyPage } from './pages/TransparencyPage';
import { ContactPage } from './pages/ContactPage';
import { OsrodekPage } from './pages/OsrodekPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { WesprzyjPage } from './pages/WesprzyjPage';
import { ToolsPage } from './pages/ToolsPage';
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

  const copy = useMemo(() => applyLocalText(publicCopy[lang], lang), [lang]);

  const title = page === null ? copy.notFound.title : titleOf(page, copy);
  usePublicHead(page, title, copy, lang);

  // Die Startseite endet mit dem dritten Bild. Keine Fusszeile darunter: eine
  // Fusszeile mit Verweisen waere ein viertes Bild, und drei sind drei.
  const isFront = page === 'front';

  return (
    <div className="pub-root">
      <PublicHeader copy={copy} lang={lang} onLang={setLang} active={page} />

      <main className="pub-main" id="pub-main">
        {page === 'front' && <FrontPage copy={copy} />}
        {page === 'recreatio' && <ManifestPage copy={copy} />}
        {page === 'o-nas' && <AboutPage copy={copy} />}
        {page === 'bezpieczenstwo' && <SecurityPage copy={copy} />}
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
        {page === 'narzedzia' && <ToolsPage copy={copy} />}

        {page === null && <NotFoundPage copy={copy} />}
      </main>

      {!isFront && <PublicFooter copy={copy} />}
    </div>
  );
}

/** Der Fenstertitel je Seite. Die Startseite trägt den Namen allein. */
function titleOf(page: PublicPage, copy: PublicCopy): string {
  if (page === 'front') return copy.meta.siteName;
  return copy.nav[page];
}

export default PublicApp;
