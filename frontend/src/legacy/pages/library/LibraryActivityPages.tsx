// Loans and the reading log: two chronological views over the copies, both
// read-mostly with light editing in place.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteLoan,
  deleteReading,
  getLoans,
  getReadings,
  updateLoan,
  updateReading,
  type LibraryLoanListItem,
  type LibraryReadingListItem
} from './libraryApi';
import type { LibraryCopyStrings } from './libraryCopy';
import {
  Badge,
  DateInput,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  NumberInput,
  Rating,
  TextArea,
  Toggle,
  formatDate,
  orNull,
  todayIso
} from './libraryComponents';

// ── Loans ────────────────────────────────────────────────────────────────────

export function LibraryLoansPage({ t }: { t: LibraryCopyStrings }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryLoanListItem[]>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async (nextOpenOnly: boolean) => setItems(await getLoans(nextOpenOnly || undefined));

  useEffect(() => {
    let active = true;
    setLoading(true);
    getLoans(openOnly || undefined)
      .then((result) => {
        if (active) setItems(result);
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
  }, [openOnly, t.common.loadFailed]);

  async function handleReturn(loan: LibraryLoanListItem) {
    try {
      await updateLoan(loan.id, {
        direction: loan.direction,
        counterpartName: loan.counterpartName,
        counterpartContact: loan.counterpartContact,
        lentOn: loan.lentOn,
        dueOn: loan.dueOn,
        returnedOn: todayIso(),
        notes: loan.notes
      });
      await reload(openOnly);
    } catch {
      setError(t.common.saveFailed);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t.loans.deleteConfirm)) return;
    try {
      await deleteLoan(id);
      await reload(openOnly);
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  if (loading) return <Loading text={t.common.loading} />;

  return (
    <div className="lib-registry">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.loans.title}</h1>
          <p className="lib-page-subtitle">{t.loans.subtitle}</p>
        </div>
        <Toggle checked={openOnly} onChange={setOpenOnly} label={t.loans.openOnly} />
      </header>

      {items.length === 0 ? (
        <EmptyState text={t.loans.empty} />
      ) : (
        <ul className="lib-registry-list">
          {items.map((loan) => (
            <li key={loan.id} className={`lib-registry-row${loan.isOverdue ? ' is-overdue' : ''}`}>
              <div className="lib-registry-main">
                <button
                  type="button"
                  className="lib-registry-name lib-link"
                  onClick={() => navigate(`/library/manifestations/${loan.manifestationId}`)}
                >
                  {loan.title || t.common.unknown}
                </button>
                <span className="lib-registry-meta">
                  {loan.authors.length > 0 ? `${loan.authors.join(', ')} · ` : ''}
                  {loan.direction === 'out' ? t.loans.counterpartOut : t.loans.counterpartIn}:{' '}
                  {loan.counterpartName}
                  {loan.counterpartContact ? ` (${loan.counterpartContact})` : ''}
                </span>
                <span className="lib-registry-meta">
                  {t.loans.lentOn}: {formatDate(loan.lentOn)}
                  {loan.dueOn ? ` · ${t.loans.dueOn}: ${formatDate(loan.dueOn)}` : ''}
                  {loan.returnedOn ? ` · ${t.loans.returnedOn}: ${formatDate(loan.returnedOn)}` : ''}
                </span>
              </div>
              <div className="lib-registry-side">
                {loan.returnedOn ? (
                  <Badge tone="muted">{t.loans.returned}</Badge>
                ) : loan.isOverdue ? (
                  <Badge tone="warn">{t.loans.overdue}</Badge>
                ) : (
                  <Badge>{t.loans.open}</Badge>
                )}
                {!loan.returnedOn ? (
                  <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => handleReturn(loan)}>
                    {t.loans.markReturned}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="lib-btn lib-btn-danger lib-btn-sm"
                  onClick={() => handleDelete(loan.id)}
                >
                  {t.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Reading log ──────────────────────────────────────────────────────────────

export function LibraryReadingPage({ t }: { t: LibraryCopyStrings }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryReadingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<LibraryReadingListItem | null>(null);

  useEffect(() => {
    let active = true;
    getReadings()
      .then((result) => {
        if (active) setItems(result);
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
  }, [t.common.loadFailed]);

  async function handleSave() {
    if (!draft) return;
    try {
      await updateReading(draft.id, {
        startedOn: draft.startedOn,
        finishedOn: draft.finishedOn,
        rating: draft.rating,
        notes: draft.notes
      });
      setDraft(null);
      setItems(await getReadings());
    } catch {
      setError(t.common.saveFailed);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t.reading.deleteConfirm)) return;
    try {
      await deleteReading(id);
      setItems(await getReadings());
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  if (loading) return <Loading text={t.common.loading} />;

  return (
    <div className="lib-registry">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.reading.title}</h1>
          <p className="lib-page-subtitle">{t.reading.subtitle}</p>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState text={t.reading.empty} />
      ) : (
        <ul className="lib-registry-list">
          {items.map((reading) => (
            <li key={reading.id} className="lib-registry-row">
              <div className="lib-registry-main">
                <button
                  type="button"
                  className="lib-registry-name lib-link"
                  onClick={() => navigate(`/library/manifestations/${reading.manifestationId}`)}
                >
                  {reading.title || t.common.unknown}
                </button>
                <span className="lib-registry-meta">
                  {reading.authors.length > 0 ? `${reading.authors.join(', ')} · ` : ''}
                  {t.reading.startedOn}: {formatDate(reading.startedOn)} · {t.reading.finishedOn}:{' '}
                  {formatDate(reading.finishedOn)}
                </span>
                {reading.notes ? <span className="lib-registry-notes">{reading.notes}</span> : null}
              </div>
              <div className="lib-registry-side">
                <Badge tone="muted">{reading.finishedOn ? t.reading.finished : t.reading.inProgress}</Badge>
                <Rating value={reading.rating} />
                <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => setDraft(reading)}>
                  {t.common.edit}
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-danger lib-btn-sm"
                  onClick={() => handleDelete(reading.id)}
                >
                  {t.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <Modal
          title={t.reading.title}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setDraft(null)}>
                {t.common.cancel}
              </button>
              <button type="button" className="lib-btn" onClick={handleSave}>
                {t.common.save}
              </button>
            </>
          }
        >
          <div className="lib-form-grid">
            <Field label={t.reading.startedOn}>
              <DateInput value={draft.startedOn} onChange={(value) => setDraft({ ...draft, startedOn: value })} />
            </Field>
            <Field label={t.reading.finishedOn}>
              <DateInput value={draft.finishedOn} onChange={(value) => setDraft({ ...draft, finishedOn: value })} />
            </Field>
            <Field label={t.reading.rating}>
              <NumberInput
                value={draft.rating}
                onChange={(value) => setDraft({ ...draft, rating: value })}
                min={1}
                max={10}
              />
            </Field>
            <div className="lib-form-wide">
              <Field label={t.reading.notes}>
                <TextArea
                  value={draft.notes ?? ''}
                  onChange={(value) => setDraft({ ...draft, notes: orNull(value) })}
                />
              </Field>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
