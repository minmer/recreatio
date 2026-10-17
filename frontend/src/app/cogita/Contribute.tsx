/**
 * COGITA — MITSCHREIBEN (COGITA.md §12, [K2, K3]).
 *
 * Wer im Bereich der Bibliothek schreibt, schreibt direkt in sie — das ist ihr
 * eigenes Vertrauen. Alle anderen schreiben Erklärungen, Erweiterungen und
 * Fragen in eine BIBLIOTHEK FÜR VORSCHLÄGE (in einem Bereich, in dem sie
 * schreiben dürfen); ein Autor nimmt sie an, dann gehen sie in den Kurs.
 */

import { useEffect, useMemo, useState } from 'react';

import { loadLibraries, openLibraries, type OpenLibrary } from '../library';
import { storeOf, useLibraryStore } from '../libraryStore';
import { entityOf } from './kinds';
import { EntityPicker, Markup, entityName, useBusy, useCtx } from './ui';
import { Loading } from '../ui/Loading';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function useContributionLibrary(): OpenLibrary | null | undefined {
  const { lib, me } = useCtx();
  const id = lib.settings().contributionLibraryId;
  const [found, setFound] = useState<OpenLibrary | null | undefined>(undefined);
  useEffect(() => {
    if (me === null || id === undefined) { setFound(null); return; }
    void loadLibraries().then((r) => openLibraries(me.ring, r.libraries)).then((all) => setFound(all.find((l) => l.libraryId === id) ?? null), () => setFound(null));
  }, [me, id]);
  return found;
}

/** Für Lesende: einen Vorschlag schreiben — zu einem Eintrag, als Wissen oder Frage. */
export function Propose({ about, onDone }: { about?: string; onDone?: () => void }) {
  const { lib, me } = useCtx();
  const target = useContributionLibrary();
  const [kind, setKind] = useState<'knowledge' | 'question'>('knowledge');
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [entity, setEntity] = useState<string | null>(about ?? null);
  const { busy, failed, run } = useBusy();
  const [said, setSaid] = useState<string | null>(null);
  if (target === undefined) return <Loading label="Wczytywanie…" />;
  if (target === null || me === null) return <p className="wk-hint">Autorzy tej bazy wiedzy nie przyjmują jeszcze propozycji.</p>;
  return (
    <form className="wk-form cg" onSubmit={(e) => { e.preventDefault(); void run(async () => {
      const store = storeOf(me.ring, target);
      await store.sync();
      await store.save({ kind: 'entity', data: {
        _kinds: [kind], ...(kind === 'knowledge' ? { text } : { prompt: text, answers: answer.split('\n').map((x) => x.trim()).filter(Boolean), form: 'text' }),
        ...(entity === null ? {} : { about: [entity] }), _for: lib.libraryId, _proposedAt: new Date().toISOString()
      } });
      setText(''); setAnswer(''); setSaid('Dziękujemy — autor zobaczy propozycję.'); onDone?.();
    }); }}>
      <div className="cg-row">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'knowledge' | 'question')}><option value="knowledge">wyjaśnienie (wiedza)</option><option value="question">pytanie</option></select>
        <EntityPicker lib={lib} value={entity} onPick={setEntity} placeholder="do którego wpisu?" />
      </div>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'knowledge' ? 'Co warto wiedzieć?' : 'Treść pytania'} required />
      {kind === 'question' && <textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Poprawne odpowiedzi, każda w wierszu" />}
      <button type="submit" className="wk-btn" disabled={busy || text.trim() === ''}>Zaproponuj</button>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {said !== null && <p className="wk-hint">{said}</p>}
    </form>
  );
}

/** Für Autoren: die Vorschläge — annehmen (in den Kurs) oder ablehnen. */
export function Contributions() {
  const { lib, me } = useCtx();
  const target = useContributionLibrary();
  const { store } = useLibraryStore(me?.ring ?? null, target ?? null);
  const { busy, failed, run } = useBusy();
  const proposals = useMemo(() => (store === null ? [] : store.all().filter((e) => e.kind === 'entity' && e.data._for === lib.libraryId && e.data._acceptedAt === undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, store?.revision, lib.libraryId]);
  if (target === undefined) return <Loading label="Wczytywanie…" />;
  if (target === null) return <p className="wk-hint">Wybierz w Ustawieniach bazę wiedzy na propozycje (w obszarze, w którym czytający mogą pisać).</p>;
  if (store === null) return null;
  return (
    <div className="cg">
      {proposals.length === 0 ? <p className="wk-empty">Nie ma nowych propozycji.</p> : proposals.map((p) => {
        const entity = entityOf(p);
        const about = Array.isArray(p.data.about) ? String(p.data.about[0] ?? '') : '';
        return (
          <div key={p.id} className="cg-card">
            <span className="cg-muted">{entity?.kinds.includes('question') ? 'Pytanie' : 'Wiedza'}{about !== '' ? ` · do „${entityName(lib, about)}"` : ''} · {typeof p.data._proposedAt === 'string' ? new Date(p.data._proposedAt).toLocaleDateString('pl-PL') : ''}</span>
            <Markup text={String(p.data.text ?? p.data.prompt ?? '')} />
            {Array.isArray(p.data.answers) && <span className="cg-muted">Odpowiedzi: {(p.data.answers as unknown[]).join(', ')}</span>}
            <div className="cg-row">
              <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => {
                const data: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(p.data)) if (!k.startsWith('_')) data[k] = v;
                await lib.saveEntity({ kinds: entity?.kinds ?? ['knowledge'], data });
                await store.save({ id: p.id, kind: p.kind, data: { ...p.data, _acceptedAt: new Date().toISOString() } });
              })}>Przyjmij do kursu</button>
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => store.remove(p.id))}>Odrzuć</button>
            </div>
          </div>
        );
      })}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {isObject(target) && <p className="wk-hint">Propozycje leżą w bazie wiedzy „{target.name}".</p>}
    </div>
  );
}
