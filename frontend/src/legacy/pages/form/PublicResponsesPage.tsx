import { useEffect, useState } from 'react';
import { ApiError, getPublicFormResponses, type FormResponsesData } from '../../lib/api';
import { FormResponsesViewer } from './FormResponsesViewer';
import '../../styles/formularze-event.css';

type Props = { token: string };

export function PublicResponsesPage({ token }: Props) {
  const [data, setData] = useState<FormResponsesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { void load(); }, [token]);

  async function load() {
    setLoading(true);
    setNotFound(false);
    try {
      setData(await getPublicFormResponses(token));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="frm-page">
        <div className="frm-main frm-loading">Ładowanie wyników…</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="frm-page">
        <div className="frm-main">
          <div className="frm-status error" style={{ maxWidth: 480, margin: '60px auto' }}>
            Nie znaleziono wyników lub link jest nieprawidłowy.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="frm-page">
      <header className="frm-header frm-no-print">
        <div className="frm-header-brand">
          <a href="/#/event">REcreatio</a>
          <span>/</span>
          <span>Wyniki ankiety</span>
        </div>
      </header>
      <main className="frm-main">
        <FormResponsesViewer data={data} />
      </main>
    </div>
  );
}
