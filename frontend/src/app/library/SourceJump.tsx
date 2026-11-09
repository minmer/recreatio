/**
 * 2026-10-24 — VON DER STELLE ZUM TEXT. Unter einer Fussnote, einem Zitat, einem Feld mit
 * Stelle in Nauka: gibt es zum zitierten Werk einen Text, den dieser Leser lesen darf, und
 * steht die Stelle darin, dann „pokaż w tekście" (der Abschnitt klappt auf, hier, auch auf
 * einer Seite) und im Arbeitsbereich der Czytnik an genau dieser Stelle. Verknüpft wird beim
 * Lesen: wer den Text später einträgt, macht alle schon geschriebenen Stellen klickbar.
 * Trifft eine Stelle mehrere Teile und lässt sich nicht entscheiden, steht es dabei.
 */

import { useEffect, useMemo, useState } from 'react';

import type { TexMacros } from '../core/tex';
import { Loading } from '../ui/Loading';
import { useT } from '../core/i18n';
import { TexMacrosContext } from '../ui/tex/Tex';
import { viewPath } from '../routes';
import { workTitle, type Lookup } from './libraryKinds';
import { parsePlace } from './locations';
import { SourceFlow } from './SourceBlocks';
import { openPart, placeFor } from './sourceFind';
import { findBlocks, labelBlocks, placeOptions, readPart, type SourceBlock, type TextLink } from './sourceText';
import { looksLikeLabel } from './textLabels';

const NO_MACROS: TexMacros = {};

const SHOWN = 12;

const inWorkspace = (): boolean => typeof window !== 'undefined' && window.location.hash.startsWith('#/workspace');

/** Wo der Czytnik eine Stelle aufschlägt — in der Bibliothek des Textes. */
export function readerPath(link: TextLink): string | undefined {
  const libraryId = (link.text?.entry as { libraryId?: string } | undefined)?.libraryId;
  if (libraryId === undefined) return undefined;
  return viewPath('library', libraryId, link.workId, 'tekst', ...(link.locator === '' ? [] : [link.locator]));
}

export function TextJump({ look, workId, locator }: { look: Lookup | undefined; workId: string; locator: string }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const link = useMemo(() => placeFor(look, workId, locator), [look, look?.revision, workId, locator]);
  if (link === null || link.status === 'none') return null;
  if (link.status === 'ambiguous') return <span className="src-jump is-ambiguous" title={link.why}> {t('librarySource.jump.ambiguous')}</span>;
  const href = inWorkspace() ? readerPath(link) : undefined;
  const other = link.edition === undefined ? '' : ` (${workTitle(link.edition.data)})`;
  return (
    <>
      {' '}
      <button type="button" className="src-jump" aria-expanded={open} title={link.why || undefined} onClick={() => setOpen(!open)}>
        {open ? t('librarySource.jump.hide') : t('librarySource.jump.show', { other })}
      </button>
      {href !== undefined && <> <a className="src-jump" href={href}>{t('librarySource.jump.reader')}</a></>}
      {open && <Passage look={look} link={link} />}
    </>
  );
}

/** Der Abschnitt des Textes, den die Stelle meint — geholt, wenn er aufklappt. */
export function Passage({ look, link }: { look: Lookup | undefined; link: TextLink }) {
  const [blocks, setBlocks] = useState<readonly SourceBlock[] | null | undefined>(undefined);
  const partId = link.part?.id;
  const t = useT();
  useEffect(() => {
    let alive = true;
    if (partId === undefined) { setBlocks(null); return undefined; }
    setBlocks(undefined);
    void openPart(look, partId).then((entry) => { if (alive) setBlocks(entry === null ? null : readPart(entry.data).blocks); });
    return () => { alive = false; };
  }, [look, partId]);

  if (blocks === undefined) return <Loading lines={2} label={t('librarySource.reader.opening')} />;
  if (blocks === null) return <p className="wk-empty">{t('librarySource.jump.failed')}</p>;
  const manifest = link.text!.manifest;
  /* 2026-11-01 — auch ein Label („Twierdzenie 2.3", „(2.4)"): dann die ganze Aussage. */
  const byLabel = link.locator !== '' && looksLikeLabel(link.locator) ? labelBlocks(blocks, link.locator) : [];
  const byPlace = link.locator === '' || byLabel.length > 0 ? [] : findBlocks(blocks, parsePlace(link.locator, manifest.scheme, placeOptions(manifest.edition)), manifest.scheme, manifest.edition);
  const hit = link.locator === '' ? blocks.map((_, i) => i).slice(0, SHOWN)
    : byLabel.length > 0 ? byLabel : byPlace.length > 0 ? byPlace : labelBlocks(blocks, link.locator);
  if (hit.length === 0) return <p className="wk-empty">{t('librarySource.jump.notInPart')}</p>;
  const shown = hit.slice(0, SHOWN);
  const prefix = `jp-${partId}-`;
  return (
    <div className="src-passage">
      <TexMacrosContext.Provider value={manifest.edition.macros ?? NO_MACROS}>
        <SourceFlow blocks={blocks} shown={shown} prefix={prefix} />
      </TexMacrosContext.Provider>
      {hit.length > SHOWN && <p className="src-more">… i dalej ({hit.length - SHOWN} bloków) — w czytniku.</p>}
    </div>
  );
}
