import { useEffect, useMemo, useState } from 'react';
import {
  applyArrangement,
  getArrangement,
  getShelves,
  type LibraryArrangement,
  type LibraryShelf
} from './libraryApi';
import type { LibraryCopyStrings } from './libraryCopy';
import { Badge, EmptyState, ErrorBanner, Loading, Section, Select } from './libraryComponents';

/**
 * The proposed shelf order. Nothing here is written until "apply" is pressed —
 * the service suggests, the reader decides.
 */
export function LibraryArrangementPage({ t }: { t: LibraryCopyStrings }) {
  const [shelfId, setShelfId] = useState('');
  const [shelves, setShelves] = useState<LibraryShelf[]>([]);
  const [proposal, setProposal] = useState<LibraryArrangement | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getShelves()
      .then((result) => {
        if (active) setShelves(result);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setApplied(false);
    getArrangement(shelfId ? Number(shelfId) : undefined)
      .then((result) => {
        if (active) setProposal(result);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shelfId, t.common.loadFailed]);

  // Grouped by shelf so the page reads the way the room looks.
  const byShelf = useMemo(() => {
    const groups = new Map<number, { name: string; placements: LibraryArrangement['placements'] }>();
    for (const placement of proposal?.placements ?? []) {
      const existing = groups.get(placement.shelfId);
      if (existing) existing.placements.push(placement);
      else groups.set(placement.shelfId, { name: placement.shelfName, placements: [placement] });
    }
    return [...groups.entries()];
  }, [proposal]);

  const movesNeeded = (proposal?.placements ?? []).filter((placement) => !placement.matchesCurrent).length;

  async function handleApply() {
    if (!proposal || !confirm(t.arrangement.applyConfirm)) return;
    setApplying(true);
    try {
      await applyArrangement(
        proposal.placements.map((placement) => ({
          itemId: placement.itemId,
          shelfId: placement.shelfId,
          position: placement.position
        }))
      );
      setApplied(true);
      const refreshed = await getArrangement(shelfId ? Number(shelfId) : undefined);
      setProposal(refreshed);
    } catch {
      setError(t.common.saveFailed);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="lib-arrangement">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.arrangement.title}</h1>
          <p className="lib-page-subtitle">{t.arrangement.subtitle}</p>
        </div>
        <div className="lib-head-actions">
          {applied ? <span className="lib-saved">{t.arrangement.applied}</span> : null}
          <Select
            value={shelfId}
            onChange={setShelfId}
            options={shelves.map((shelf) => ({ value: String(shelf.id), label: shelf.name }))}
            placeholder={t.arrangement.allShelves}
          />
          <button
            type="button"
            className="lib-btn"
            disabled={applying || !proposal || proposal.placements.length === 0 || movesNeeded === 0}
            onClick={handleApply}
          >
            {applying ? t.arrangement.proposing : `${t.arrangement.applyAll} (${movesNeeded})`}
          </button>
        </div>
      </header>

      {loading ? (
        <Loading text={t.arrangement.proposing} />
      ) : !proposal || proposal.placements.length === 0 ? (
        <EmptyState text={t.arrangement.empty} />
      ) : (
        <>
          {proposal.notes.length > 0 ? (
            <Section title={t.arrangement.notes}>
              <ul className="lib-note-list">
                {proposal.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          {byShelf.map(([id, group]) => (
            <Section key={id} title={group.name}>
              <ol className="lib-arrangement-list">
                {group.placements.map((placement) => (
                  <li
                    key={placement.itemId}
                    className={`lib-arrangement-row${placement.matchesCurrent ? ' is-settled' : ''}`}
                  >
                    <span className="lib-arrangement-pos">{placement.position + 1}</span>
                    {placement.imageUrl ? (
                      <img className="lib-arrangement-cover" src={placement.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="lib-arrangement-cover lib-arrangement-cover-blank" aria-hidden="true" />
                    )}
                    <span className="lib-arrangement-main">
                      <span className="lib-arrangement-title">{placement.title}</span>
                      {/* Neighbours are the point of the whole exercise: they are
                          how a book is actually found again on the shelf. */}
                      <span className="lib-arrangement-neighbours">
                        {placement.previousTitle ? `← ${placement.previousTitle}` : ''}
                        {placement.previousTitle && placement.nextTitle ? '   ·   ' : ''}
                        {placement.nextTitle ? `${placement.nextTitle} →` : ''}
                      </span>
                    </span>
                    <span className="lib-arrangement-side">
                      {placement.groupName ? <Badge tone="original">{placement.groupName}</Badge> : null}
                      <Badge tone={placement.matchesCurrent ? 'muted' : 'warn'}>
                        {placement.matchesCurrent ? t.arrangement.alreadyInPlace : t.arrangement.wouldMove}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          ))}

          {proposal.unplaced.length > 0 ? (
            <Section title={t.arrangement.unplaced} hint={t.arrangement.unplacedHint}>
              <ul className="lib-registry-list">
                {proposal.unplaced.map((entry) => (
                  <li key={entry.itemId} className="lib-registry-row is-overdue">
                    <div className="lib-registry-main">
                      <span className="lib-registry-name">{entry.title}</span>
                      <span className="lib-registry-meta">{entry.reason}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
