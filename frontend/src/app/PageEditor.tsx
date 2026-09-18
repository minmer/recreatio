/**
 * Eine übernommene Adresse: was darauf steht, und wer daran darf.
 *
 * <b>Zwei verschiedene Dinge auf einer Karte, und der Unterschied wird
 * gesagt.</b> Titel und Text sind ÖFFENTLICH und liegen im Klartext — sie
 * werden ohne Konto ausgeliefert. Die Zugänge daneben sind unterschriebene
 * Zertifikate: der Dienst kann sie nicht herstellen, nur prüfen.
 *
 * <b>Zwei Stufen, und sie decken einander nicht</b> (Kernel 3.5):
 * `write` darf ändern, `certify` darf weitergeben und Unterseiten öffnen. Wer
 * beides soll, bekommt beides — das ist die Stelle, an der jemand einmal
 * hinsehen muss, und deshalb steht sie hier als zwei Einträge und nicht als
 * ein Schalter.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  CAPABILITY_NAME, grantAccess, loadAccess, openSubpage, revokeGrant,
  type AccessView, type Capability
} from './access';
import { loadPage, savePage, saveParts, toDraft, type DraftPart } from './page';
import { FormOffice } from './FormOffice';
import { MassOffice } from './MassOffice';
import { PageBuilder } from './PageBuilder';
import { pagePath } from './routes';
import { forgetKeys, keysFor, type Keys } from './ringOf';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';

const CAPABILITIES: readonly Capability[] = ['read', 'write', 'admin', 'certify'];

const short = (id: string): string => id.slice(0, 8);

export function PageEditor({ path, who }: { path: string; who: Who }) {
  const [title, setTitle] = useState('');
  const [lead, setLead] = useState('');
  const [parts, setParts] = useState<readonly DraftPart[]>([]);

  /* Die Anordnung geht als GANZES hinaus. Ein Knopf, der immer anklickbar ist,
     sagt nicht, ob noch etwas offen ist — deshalb merkt sich das der Editor. */
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<AccessView | null>(null);
  const [keys, setKeys] = useState<Keys | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const look = useCallback(async () => {
    setReady(false);
    setFailed(null);

    try {
      const page = await loadPage(path);
      setTitle(page.title ?? '');
      setLead(page.lead ?? '');
      setParts(page.parts.map(toDraft));
    } catch {
      // Eine Adresse ohne Seite ist der Normalfall beim ersten Mal.
      setTitle('');
      setLead('');
      setParts([]);
    }

    setDirty(false);

    try { setView(await loadAccess(path)); } catch { setView(null); }

    setKeys(await keysFor(who));
    setReady(true);
  }, [path, who]);

  useEffect(() => { void look(); }, [look]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);
    setSaved(false);

    try {
      await todo();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  if (!ready) return <p className="wk-hint">Wczytywanie strony…</p>;

  const ring = keys?.ring ?? null;
  const mayCertify = view?.mayCertify === true;

  /*
   * Mit WELCHER Rolle unterschrieben wird. Die führende, wenn sie mir gehört —
   * sonst die erste, deren Schlüssel ich halte. Ohne Schlüssel gar keine: eine
   * Unterschrift, die niemand leisten kann, ist kein Formular wert.
   */
  const issuer =
    view?.ownerRoleId != null && ring?.has(view.ownerRoleId) === true
      ? view.ownerRoleId
      : keys?.graph.roles.find((r) => ring?.has(r.id) === true)?.id ?? null;

  return (
    <div className="wk-page-edit">
      <h3 className="wk-h2">recreatio.pl/{path}</h3>

      <form
        className="wk-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy === null && title.trim() !== '') {
            void act('Zapisywanie…', () =>
              savePage(path, { title: title.trim(), lead: lead.trim() === '' ? null : lead.trim() })
            ).then(() => setSaved(true));
          }
        }}
      >
        <label className="wk-field">
          <span>Tytuł</span>
          <input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} />
        </label>

        <label className="wk-field">
          <span>Tekst</span>
          <textarea rows={5} value={lead} onChange={(e) => { setLead(e.target.value); setSaved(false); }} />
        </label>

        <p className="wk-hint">
          Ta strona jest publiczna — tytuł i tekst idą do usługi otwartym tekstem,
          bo czyta je każdy, kto wejdzie pod ten adres.
        </p>

        {failed !== null && <p className="wk-error">{failed}</p>}
        {saved && <p className="wk-done">Zapisane.</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy !== null || title.trim() === ''}>
            {busy ?? 'Zapisz'}
          </button>

          <a className="wk-link" href={pagePath(path)}>Zobacz stronę</a>
        </div>
      </form>

      <h3 className="wk-h2">Moduły</h3>

      <PageBuilder
        parts={parts}
        busy={busy !== null}
        onChange={(next) => { setParts(next); setDirty(true); }}
      />

      <div className="wk-actions">
        <button
          type="button"
          className="wk-btn"
          disabled={busy !== null || !dirty}
          onClick={() => void act('Zapisywanie modułów…', () => saveParts(path, parts))}
        >
          {busy ?? 'Zapisz moduły'}
        </button>

        {!dirty && busy === null && <span className="wk-blocker">Nic się nie zmieniło.</span>}
      </div>

      {/*
        Die Kanzlei erscheint erst, wenn die Seite einen Messplan ZEIGT.
        Der Baustein ist die Erklärung „hier gibt es Messen"; ohne ihn stünde
        auf jeder Seite ein Formular für etwas, das dort nicht vorkommt.

        Ein Henne-Ei-Fall ist das nicht: man legt den Baustein ab, speichert die
        Module, und die Kanzlei steht da — bevor die erste Messe existiert.
      */}
      {parts.some((part) => part.kind === 'masses') && <MassOffice />}

      {/*
        Je Formular EINER — anders als beim Messplan, der einen Kalender nennt.
        Die Fragen hängen an DIESEM Baustein, also gibt es sie auch je Baustein
        zu stellen; zwei Formulare auf einer Seite sind zwei Bögen und nicht
        zwei Ansichten desselben.
      */}
      {parts.filter((part) => part.kind === 'form').map((part) => (
        <FormOffice key={part.id} partId={part.id} config={part.config} who={who} />
      ))}

      {view !== null && (
        <>
          <h3 className="wk-h2">Kto ma dostęp</h3>

          <p className="wk-hint">
            Adres prowadzi rola <code>{short(view.ownerRoleId ?? '—')}</code>
            {view.ownerPath !== null && view.ownerPath !== path && (
              <> — z adresu <code>recreatio.pl/{view.ownerPath}</code></>
            )}.
          </p>

          {view.grants.length === 0 ? (
            <p className="wk-empty">Nikt poza prowadzącym.</p>
          ) : (
            <ul className="wk-list">
              {view.grants.map((grant) => (
                <li className="wk-row" key={grant.id}>
                  <span>
                    <code>{short(grant.subjectRoleId)}</code> — {CAPABILITY_NAME[grant.capability]}
                    {grant.inherited && <span className="wk-badge">z „{grant.path}"</span>}
                  </span>

                  {/* Geerbtes wird dort zurückgenommen, wo es ausgestellt wurde
                      — hier wäre der Knopf eine Lüge. */}
                  {!grant.inherited && mayCertify && (
                    <button
                      type="button" className="wk-link-btn" disabled={busy !== null}
                      onClick={() => void act('Odbieranie…', () => revokeGrant(grant.id))}
                    >
                      Odbierz
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {mayCertify && ring === null && (
            <Unlock
              who={who}
              why="Żeby dopuścić kogoś do tego adresu, trzeba podpisać zaświadczenie."
              onDone={() => void look()}
            />
          )}

          {mayCertify && ring !== null && issuer !== null && (
            <>
              <GrantForm
                busy={busy !== null}
                onGrant={(subjectRoleId, capability, days) =>
                  act('Wystawianie…', async () => {
                    await grantAccess(ring, { view, subjectRoleId, issuerRoleId: issuer, capability, days });
                  })
                }
              />

              <SubpageForm
                busy={busy !== null}
                base={path}
                roles={(keys?.graph.roles ?? []).filter((r) => ring.has(r.id)).map((r) => r.id)}
                onOpen={(full, roleId) =>
                  act('Otwieranie podstrony…', async () => {
                    await openSubpage(full, roleId);
                    forgetKeys();
                  })
                }
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* -- Zugang geben ----------------------------------------------------------- */

function GrantForm({ busy, onGrant }: {
  busy: boolean;
  onGrant: (subjectRoleId: string, capability: Capability, days: number) => Promise<void>;
}) {
  const [subject, setSubject] = useState('');
  const [capability, setCapability] = useState<Capability>('write');
  const [days, setDays] = useState(365);

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && subject.trim() !== '') void onGrant(subject.trim(), capability, days);
      }}
    >
      <h4 className="wk-h2">Dopuść rolę</h4>

      <label className="wk-field">
        <span>Rola (pełna kennung)</span>
        <input
          value={subject}
          placeholder="01a0…-…"
          autoComplete="off"
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>

      <label className="wk-field">
        <span>Co wolno</span>
        <select value={capability} onChange={(e) => setCapability(e.target.value as Capability)}>
          {CAPABILITIES.map((c) => (
            <option key={c} value={c}>{CAPABILITY_NAME[c]}</option>
          ))}
        </select>
      </label>

      <label className="wk-field">
        <span>Na ile dni</span>
        <input
          type="number" min={1} max={1825} value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </label>

      <p className="wk-hint">
        „Może zmieniać" sięga też podstron, ale nie pozwala ich otwierać ani
        przekazywać dalej — to osobne prawo. Zaświadczenie zawsze ma koniec.
      </p>

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || subject.trim() === ''}>Dopuść</button>
        {subject.trim() === '' && !busy && <span className="wk-blocker">Wklej kennung roli.</span>}
      </div>
    </form>
  );
}

/* -- Eine Unterseite öffnen ------------------------------------------------- */

function SubpageForm({ busy, base, roles, onOpen }: {
  busy: boolean;
  base: string;
  roles: readonly string[];
  onOpen: (full: string, roleId: string) => Promise<void>;
}) {
  const [suffix, setSuffix] = useState('');
  const [roleId, setRoleId] = useState(roles[0] ?? '');

  const clean = suffix.trim().toLowerCase().replace(/^\/+|\/+$/g, '');

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && clean !== '' && roleId !== '') void onOpen(`${base}/${clean}`, roleId);
      }}
    >
      <h4 className="wk-h2">Otwórz podstronę</h4>

      <label className="wk-field">
        <span>Adres</span>
        <input value={suffix} placeholder="aktualnosci" onChange={(e) => setSuffix(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>Kto ją poprowadzi</span>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          {roles.map((id) => <option key={id} value={id}>{short(id)}</option>)}
        </select>
      </label>

      <p className="wk-hint">
        Podstrona nie potrzebuje kodu: otwiera ją ten, kto prowadzi adres wyżej.
        Powstanie <code>recreatio.pl/{base}/{clean === '' ? '…' : clean}</code>.
      </p>

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || clean === '' || roleId === ''}>
          Otwórz
        </button>
      </div>
    </form>
  );
}

export default PageEditor;
