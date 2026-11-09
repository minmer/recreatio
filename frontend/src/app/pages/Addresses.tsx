/**
 * Adresy i domeny — die zweiten Wege auf eine Seite.
 *
 * <b>Warum diese Ansicht erklärt und nicht bloss Felder zeigt.</b> Ein Alias
 * und eine eigene Domain sind die zwei Stellen, an denen die Plattform aus dem
 * Browser hinausreicht: ins Register, ins DNS, in die Herkunftsliste des
 * Dienstes. Wer hier ein Feld ausfüllt, ohne zu wissen, was danach noch fehlt,
 * bekommt eine Domain, die auf nichts zeigt — und sucht den Fehler dann in der
 * Plattform, in der er nicht liegt.
 *
 * <b>Die Regel, die alles zusammenhält:</b> eine übernommene Adresse ist eine
 * WURZEL. Was darunter liegt, ist ihre lokale Route — von oben geöffnet, nie
 * mit einem Code übernommen. Gäbe es beide Wege, hätte eine Adresszeile zwei
 * Verantwortliche, und welche Seite erscheint, entschiede die Reihenfolge der
 * Zeilen.
 */

import { useState } from 'react';

import { bindDomain, declareAlias, takers, type Desk } from '../workspace/desk';
import { roleLabel, useRoleNames } from '../roles/roleNames';
import { PATH_SHAPE, pagePath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { JsonPanel } from '../ui/JsonPanel';
import { rich, useT } from '../core/i18n';
/*
 * Wohin eine eigene Domain zeigen muss (die Adressen von GitHub Pages) und wie ein Name aussieht — seit
 * 2026-10-29 in `addressesJson.ts`, damit Ansicht, Plan des Imports und Beschreibung dieselben Zeilen sagen.
 */
import {
  ADDRESSES_JSON, applyAddresses, exportAddresses, HOST_SHAPE, PAGES_A, PAGES_AAAA, PAGES_CNAME, planAddresses, type AddressState
} from './addressesJson';

/** Die Auszeichnungen der erklärenden Sätze: fett und Code. */
const TAGS = {
  b: (s: string, k: number) => <b key={k}>{s}</b>,
  code: (s: string, k: number) => <code key={k}>{s}</code>
};

export function Addresses({ desk, who, onChanged }: { desk: Desk; who: Who; onChanged: () => void }) {
  const t = useT();
  const names = useRoleNames(who);
  /* Nur Adressen, auf denen Inhalt LIEGT, taugen als Ziel. Ein Alias auf einen
     Alias wäre eine Kette, und die liesse sich im Kreis legen. */
  const roots = desk.pages.filter((page) => page.aliasOf === null);
  const aliases = desk.pages.filter((page) => page.aliasOf !== null);
  const bound = desk.pages.filter((page) => page.host !== null);

  return (
    <>
      <p className="wk-lede">{t('pagesAddresses.lede')}</p>

      <HowItWorks />

      <h2 className="wk-h2">{t('pagesAddresses.aliases')}</h2>

      {aliases.length === 0 ? (
        <p className="wk-empty">{t('pagesAddresses.noAliases')}</p>
      ) : (
        <ul className="wk-list">
          {aliases.map((page) => (
            <li className="wk-row" key={page.path}>
              <span><code>{`recreatio.pl/${page.path}`}</code></span>
              <span className="wk-row-side">
                {rich(t('pagesAddresses.leadsTo', { path: page.aliasOf! }), {
                  link: (s, k) => <a key={k} className="wk-link" href={pagePath(page.aliasOf!)}><code>{s}</code></a>
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <AliasForm desk={desk} names={names} roots={roots} onDone={onChanged} />

      <h2 className="wk-h2">{t('pagesAddresses.domains')}</h2>

      {bound.length === 0 ? (
        <p className="wk-empty">{t('pagesAddresses.noDomains')}</p>
      ) : (
        <ul className="wk-list">
          {bound.map((page) => (
            <li className="wk-row" key={page.path}>
              <span><code>{page.host}</code></span>
              <span className="wk-row-side">
                {rich(t('pagesAddresses.shows', { path: page.path }), TAGS)}
                {' · '}
                <Unbind path={page.path} onDone={onChanged} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <DomainForm roots={roots} onDone={onChanged} />

      <OutsideThePlatform />

      <AddressesJson desk={desk} names={names} onDone={onChanged} />
    </>
  );
}

/* -- 2026-10-29: alles als JSON — zur Kopie und für einen Assistenten -------- */

/**
 * Dieselben zwei Handgriffe wie die Formulare oben (`declareAlias`,
 * `bindDomain`), nur viele auf einmal — mit dem Plan vor dem Knopf. Was
 * ausserhalb der Plattform bleibt, sagt der Plan je neuer Domain mit.
 */
function AddressesJson({ desk, names, onDone }: { desk: Desk; names: ReadonlyMap<string, string>; onDone: () => void }) {
  const t = useT();
  const state: AddressState = {
    pages: desk.pages,
    roles: takers(desk.roles).map((role) => ({ id: role.id, name: roleLabel(role, names) }))
  };

  return (
    <section aria-labelledby="addresses-json-h">
      <h2 className="wk-h2" id="addresses-json-h">{t('pagesAddresses.json.title')}</h2>
      <JsonPanel
        summary={t('pagesAddresses.json.summary')}
        lead={<>{rich(t('pagesAddresses.json.lead'), TAGS)}</>}
        fileName="adresy-i-domeny.json"
        exportDoc={() => exportAddresses(state)}
        format={ADDRESSES_JSON}
        preview={(doc) => {
          const plan = planAddresses(doc, state);
          return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
        }}
        importLabel={t('pagesAddresses.json.import')}
        onImport={async (doc, stage) => {
          const plan = planAddresses(doc, state);
          if ('error' in plan) throw new WorkspaceError(plan.error);
          const done = await applyAddresses(plan, { declareAlias, bindDomain }, stage);
          onDone();
          return { lines: done.lines, warnings: [...plan.warnings, ...done.warnings] };
        }}
      />
    </section>
  );
}

/* -- Was hier eigentlich passiert ------------------------------------------ */

function HowItWorks() {
  const t = useT();
  return (
    <>
      <h2 className="wk-h2">{t('pagesAddresses.how.title')}</h2>
      <p className="wk-note">{rich(t('pagesAddresses.how.root'), TAGS)}</p>
      <p className="wk-note">{rich(t('pagesAddresses.how.local'), TAGS)}</p>
      <p className="wk-note">{rich(t('pagesAddresses.how.alias'), TAGS)}</p>
    </>
  );
}

/* -- Alias ----------------------------------------------------------------- */

function AliasForm({ desk, names, roots, onDone }: {
  names: ReadonlyMap<string, string>;
  desk: Desk;
  roots: readonly { path: string }[];
  onDone: () => void;
}) {
  const t = useT();
  const [target, setTarget] = useState('');
  const [wanted, setWanted] = useState('');
  const [roleId, setRoleId] = useState(takers(desk.roles)[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const path = wanted.trim().toLowerCase().replace(/^\/+|\/+$/g, '');

  const blocker =
    busy ? null
    : roots.length === 0 ? t('pagesAddresses.alias.takeFirst')
    : target === '' ? t('pagesAddresses.alias.pickTarget')
    : path === '' ? t('pagesAddresses.alias.enterPath')
    : !PATH_SHAPE.test(path) ? t('pagesAddresses.alias.badPath')
    /*
     * Ein Alias auf oberster Ebene wäre ein neues Wort im gemeinsamen
     * Namensraum — das vergibt der Server mit einem Code. Hier zu prüfen heisst,
     * es zu erklären, statt eine 403 aus dem Dienst zu zeigen.
     */
    : !path.includes('/') ? t('pagesAddresses.alias.underOwn')
    : path === target ? t('pagesAddresses.alias.self')
    : roleId === '' ? t('pagesAddresses.alias.pickRole')
    : null;

  const go = async () => {
    setBusy(true);
    setFailed(null);
    setDone(null);

    try {
      const made = await declareAlias(path, target, roleId);
      setDone(made.path);
      setWanted('');
      onDone();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('pagesAddresses.alias.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="wk-form"
      onSubmit={(e) => { e.preventDefault(); if (blocker === null) void go(); }}
    >
      <label className="wk-field">
        <span>{t('pagesAddresses.alias.target')}</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{t('pages.logicEd.choose')}</option>
          {roots.map((page) => (
            <option key={page.path} value={page.path}>{`recreatio.pl/${page.path}`}</option>
          ))}
        </select>
      </label>

      <label className="wk-field">
        <span>{t('pagesAddresses.alias.new')}</span>
        <input value={wanted} onChange={(e) => setWanted(e.target.value)} placeholder={'parish/news'} />
      </label>

      <p className="wk-hint">{rich(t('pagesAddresses.alias.hint'), TAGS)}</p>

      <label className="wk-field">
        <span>{t('pagesAddresses.tree.who')}</span>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          {takers(desk.roles).map((role) => (
            <option key={role.id} value={role.id}>{roleLabel(role, names)}</option>
          ))}
        </select>
      </label>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {done !== null && (
        <p className="wk-done">{rich(t('pagesAddresses.alias.done', { path: done }), TAGS)}</p>
      )}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>
          {busy ? t('pagesAddresses.tree.creating') : t('pagesAddresses.alias.create')}
        </button>
        {blocker !== null && !busy && <span className="wk-blocker">{blocker}</span>}
      </div>
    </form>
  );
}

/* -- Eigene Domain --------------------------------------------------------- */

function DomainForm({ roots, onDone }: { roots: readonly { path: string }[]; onDone: () => void }) {
  const t = useT();
  const [path, setPath] = useState('');
  const [wanted, setWanted] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const host = wanted.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  const blocker =
    busy ? null
    : roots.length === 0 ? t('pagesAddresses.alias.takeFirst')
    : path === '' ? t('pagesAddresses.domain.pickPage')
    : host === '' ? t('pagesAddresses.domain.enter')
    : !HOST_SHAPE.test(host) ? t('pagesAddresses.domain.bad')
    : null;

  const go = async () => {
    setBusy(true);
    setFailed(null);
    setDone(null);

    try {
      await bindDomain(path, host);
      setDone(host);
      setWanted('');
      onDone();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('pagesAddresses.domain.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="wk-form"
      onSubmit={(e) => { e.preventDefault(); if (blocker === null) void go(); }}
    >
      <label className="wk-field">
        <span>{t('pagesAddresses.domain.target')}</span>
        <select value={path} onChange={(e) => setPath(e.target.value)}>
          <option value="">{t('pages.logicEd.choose')}</option>
          {roots.map((page) => (
            <option key={page.path} value={page.path}>{`recreatio.pl/${page.path}`}</option>
          ))}
        </select>
      </label>

      <label className="wk-field">
        <span>{t('pagesAddresses.domain.label')}</span>
        <input value={wanted} onChange={(e) => setWanted(e.target.value)} placeholder={'cogita.pl'} />
      </label>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {done !== null && (
        <p className="wk-done">{rich(t('pagesAddresses.domain.done', { host: done }), TAGS)}</p>
      )}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>
          {busy ? t('pagesAddresses.domain.binding') : t('pagesAddresses.domain.bind')}
        </button>
        {blocker !== null && !busy && <span className="wk-blocker">{blocker}</span>}
      </div>
    </form>
  );
}

function Unbind({ path, onDone }: { path: string; onDone: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="wk-link-btn"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        // Scheitert es, sagt es die Liste beim nächsten Laden: die Domain steht
        // dann noch da. Eine eigene Fehlerzeile pro Zeile wäre mehr Lärm als Hilfe.
        void bindDomain(path, null).then(onDone).finally(() => setBusy(false));
      }}
    >
      {busy ? t('pagesAddresses.domain.unbinding') : t('pagesAddresses.domain.unbind')}
    </button>
  );
}

/* -- Was die Datenbank nicht kann ------------------------------------------ */

function OutsideThePlatform() {
  const t = useT();
  return (
    <>
      <h2 className="wk-h2">{t('pagesAddresses.out.title')}</h2>

      <p className="wk-note">{t('pagesAddresses.out.lead')}</p>

      <h3 className="wk-h3">{t('pagesAddresses.out.dns')}</h3>

      <ul className="wk-list">
        <li className="wk-row">
          <span>{rich(t('pagesAddresses.out.a'), TAGS)}</span>
          <span className="wk-row-side"><code>{PAGES_A.join(', ')}</code></span>
        </li>
        <li className="wk-row">
          <span>{rich(t('pagesAddresses.out.aaaa'), TAGS)}</span>
          <span className="wk-row-side"><code>{PAGES_AAAA.join(', ')}</code></span>
        </li>
        <li className="wk-row">
          <span>{rich(t('pagesAddresses.out.cname'), TAGS)}</span>
          <span className="wk-row-side"><code>{PAGES_CNAME}</code></span>
        </li>
      </ul>

      <h3 className="wk-h3">{t('pagesAddresses.out.hostTitle')}</h3>
      <p className="wk-note">{rich(t('pagesAddresses.out.host'), TAGS)}</p>

      <h3 className="wk-h3">{t('pagesAddresses.out.originTitle')}</h3>
      <p className="wk-note">{rich(t('pagesAddresses.out.origin'), TAGS)}</p>

      <h3 className="wk-h3">{t('pagesAddresses.out.loginTitle')}</h3>
      <p className="wk-note">{rich(t('pagesAddresses.out.login'), TAGS)}</p>
      <p className="wk-note">{rich(t('pagesAddresses.out.ways'), TAGS)}</p>
    </>
  );
}

export default Addresses;
