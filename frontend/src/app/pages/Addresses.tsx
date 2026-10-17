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

import { bindDomain, declareAlias, takers, type Desk } from './desk';
import { roleLabel, useRoleNames } from './roleNames';
import { PATH_SHAPE, pagePath } from './routes';
import { WorkspaceError, type Who } from './session';

/**
 * Wohin eine eigene Domain zeigen muss.
 *
 * Abgelesen von recreatio.pl selbst, nicht aus dem Gedächtnis zitiert: es sind
 * die Adressen von GitHub Pages, und dort liegt diese Oberfläche. Ändert sich
 * das Hosting, ändern sich diese Zeilen — sie stehen deshalb an EINER Stelle.
 */
const PAGES_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
const PAGES_AAAA = ['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153'];
const PAGES_CNAME = 'minmer.github.io';

/** Klein, mit Punkt, ohne Schema und ohne Pfad — wie `Slug.IsHostName` im Dienst. */
const HOST_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

export function Addresses({ desk, who, onChanged }: { desk: Desk; who: Who; onChanged: () => void }) {
  const names = useRoleNames(who);
  /* Nur Adressen, auf denen Inhalt LIEGT, taugen als Ziel. Ein Alias auf einen
     Alias wäre eine Kette, und die liesse sich im Kreis legen. */
  const roots = desk.pages.filter((page) => page.aliasOf === null);
  const aliases = desk.pages.filter((page) => page.aliasOf !== null);
  const bound = desk.pages.filter((page) => page.host !== null);

  return (
    <>
      <p className="wk-lede">
        Ta sama strona może mieć więcej niż jedno wejście: krótszy adres wewnątrz
        recreatio.pl albo własną domenę. Treść zostaje tam, gdzie była — wejście
        tylko na nią wskazuje.
      </p>

      <HowItWorks />

      <h2 className="wk-h2">Aliasy</h2>

      {aliases.length === 0 ? (
        <p className="wk-empty">Nie masz jeszcze żadnego aliasu.</p>
      ) : (
        <ul className="wk-list">
          {aliases.map((page) => (
            <li className="wk-row" key={page.path}>
              <span><code>recreatio.pl/{page.path}</code></span>
              <span className="wk-row-side">
                prowadzi do{' '}
                <a className="wk-link" href={pagePath(page.aliasOf!)}>
                  <code>{page.aliasOf}</code>
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}

      <AliasForm desk={desk} names={names} roots={roots} onDone={onChanged} />

      <h2 className="wk-h2">Własne domeny</h2>

      {bound.length === 0 ? (
        <p className="wk-empty">Żadna domena nie jest podpięta.</p>
      ) : (
        <ul className="wk-list">
          {bound.map((page) => (
            <li className="wk-row" key={page.path}>
              <span><code>{page.host}</code></span>
              <span className="wk-row-side">
                pokazuje <code>recreatio.pl/{page.path}</code>
                {' · '}
                <Unbind path={page.path} onDone={onChanged} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <DomainForm roots={roots} onDone={onChanged} />

      <OutsideThePlatform />
    </>
  );
}

/* -- Was hier eigentlich passiert ------------------------------------------ */

function HowItWorks() {
  return (
    <>
      <h2 className="wk-h2">Jak to działa</h2>

      <p className="wk-note">
        <b>Adres przejęty kodem jest korzeniem.</b> <code>parish</code> bierze się
        raz, kodem od serwera. Wszystko, co leży pod nim —{' '}
        <code>parish/grzegorzki</code> — otwiera już sam prowadzący, w warsztacie
        i bez kodu. Takich tras nie da się przejąć osobno, i to celowo: inaczej
        jeden adres miałby dwóch odpowiedzialnych, a o tym, którą stronę widzi
        odwiedzający, decydowałaby kolejność wierszy w bazie.
      </p>

      <p className="wk-note">
        <b>Podtrasy są lokalne.</b> Jeśli <code>cogita.pl</code> pokazuje{' '}
        <code>recreatio.pl/cogita</code>, to strona <code>cogita/kursy</code> jest
        pod tą domeną dostępna jako <code>cogita.pl/#/kursy</code> — bez
        powtarzania nazwy korzenia. Dlatego odnośniki na stronie pisze się
        lokalnie: ten sam link działa i pod recreatio.pl, i pod własną domeną.
        Gdyby zawierał pełną ścieżkę, jedna z tych dwóch wersji zawsze byłaby
        zepsuta.
      </p>

      <p className="wk-note">
        <b>Alias to drugie wejście, nie druga strona.</b> Pod aliasem nic się nie
        zapisuje — tytuł, wstęp i moduły zmieniają się tam, gdzie leży treść.
        Usługa odmawia zapisu na alias niezależnie od tego, czy ktoś go przejął:
        dwie wersje tej samej rzeczy oznaczałyby, że jedna z nich jest
        nieaktualna.
      </p>
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
  const [target, setTarget] = useState('');
  const [wanted, setWanted] = useState('');
  const [roleId, setRoleId] = useState(takers(desk.roles)[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const path = wanted.trim().toLowerCase().replace(/^\/+|\/+$/g, '');

  const blocker =
    busy ? null
    : roots.length === 0 ? 'Najpierw przejmij jakiś adres.'
    : target === '' ? 'Wybierz stronę, do której alias ma prowadzić.'
    : path === '' ? 'Wpisz adres aliasu.'
    : !PATH_SHAPE.test(path) ? 'Adres: małe litery, cyfry i myślniki; części oddziel ukośnikiem.'
    /*
     * Ein Alias auf oberster Ebene wäre ein neues Wort im gemeinsamen
     * Namensraum — das vergibt der Server mit einem Code. Hier zu prüfen heisst,
     * es zu erklären, statt eine 403 aus dem Dienst zu zeigen.
     */
    : !path.includes('/') ? 'Alias zakłada się pod adresem, który już prowadzisz — np. parish/news.'
    : path === target ? 'Alias nie może wskazywać na siebie.'
    : roleId === '' ? 'Wybierz rolę.'
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć aliasu.');
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
        <span>Alias ma prowadzić do</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">— wybierz —</option>
          {roots.map((page) => (
            <option key={page.path} value={page.path}>recreatio.pl/{page.path}</option>
          ))}
        </select>
      </label>

      <label className="wk-field">
        <span>Nowy adres</span>
        <input value={wanted} onChange={(e) => setWanted(e.target.value)} placeholder="parish/news" />
      </label>

      <p className="wk-hint">
        Musi leżeć pod adresem, który prowadzisz. Nazwy najwyższego poziomu —{' '}
        <code>recreatio.pl/cogita</code> — wydaje serwer wraz z kodem, bo należą
        do wspólnej przestrzeni nazw.
      </p>

      <label className="wk-field">
        <span>Kto będzie odpowiadał</span>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          {takers(desk.roles).map((role) => (
            <option key={role.id} value={role.id}>{roleLabel(role, names)}</option>
          ))}
        </select>
      </label>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {done !== null && (
        <p className="wk-done">
          Alias <code>recreatio.pl/{done}</code> już działa.
        </p>
      )}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>
          {busy ? 'Zakładanie…' : 'Załóż alias'}
        </button>
        {blocker !== null && !busy && <span className="wk-blocker">{blocker}</span>}
      </div>
    </form>
  );
}

/* -- Eigene Domain --------------------------------------------------------- */

function DomainForm({ roots, onDone }: { roots: readonly { path: string }[]; onDone: () => void }) {
  const [path, setPath] = useState('');
  const [wanted, setWanted] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const host = wanted.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  const blocker =
    busy ? null
    : roots.length === 0 ? 'Najpierw przejmij jakiś adres.'
    : path === '' ? 'Wybierz stronę.'
    : host === '' ? 'Wpisz nazwę domeny.'
    : !HOST_SHAPE.test(host) ? 'Sama nazwa domeny: małe litery, z kropką, bez http:// i bez ścieżki.'
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się podpiąć domeny.');
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
        <span>Domena pokaże stronę</span>
        <select value={path} onChange={(e) => setPath(e.target.value)}>
          <option value="">— wybierz —</option>
          {roots.map((page) => (
            <option key={page.path} value={page.path}>recreatio.pl/{page.path}</option>
          ))}
        </select>
      </label>

      <label className="wk-field">
        <span>Domena</span>
        <input value={wanted} onChange={(e) => setWanted(e.target.value)} placeholder="cogita.pl" />
      </label>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {done !== null && (
        <p className="wk-done">
          <code>{done}</code> wskazuje już tę stronę. Zostały jeszcze trzy rzeczy
          poza platformą — niżej.
        </p>
      )}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>
          {busy ? 'Podpinanie…' : 'Podepnij domenę'}
        </button>
        {blocker !== null && !busy && <span className="wk-blocker">{blocker}</span>}
      </div>
    </form>
  );
}

function Unbind({ path, onDone }: { path: string; onDone: () => void }) {
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
      {busy ? 'odpinanie…' : 'odepnij'}
    </button>
  );
}

/* -- Was die Datenbank nicht kann ------------------------------------------ */

function OutsideThePlatform() {
  return (
    <>
      <h2 className="wk-h2">Co trzeba zrobić poza platformą</h2>

      <p className="wk-note">
        Podpięcie domeny tutaj zapisuje tylko jedno: że ta nazwa oznacza tę
        stronę. Żeby przeglądarka w ogóle tu trafiła, trzeba jeszcze trzech
        rzeczy, których nie ma w bazie.
      </p>

      <h3 className="wk-h3">1. DNS</h3>

      <ul className="wk-list">
        <li className="wk-row">
          <span><code>A</code> dla samej domeny</span>
          <span className="wk-row-side"><code>{PAGES_A.join(', ')}</code></span>
        </li>
        <li className="wk-row">
          <span><code>AAAA</code> dla samej domeny</span>
          <span className="wk-row-side"><code>{PAGES_AAAA.join(', ')}</code></span>
        </li>
        <li className="wk-row">
          <span><code>CNAME</code> dla <code>www</code></span>
          <span className="wk-row-side"><code>{PAGES_CNAME}</code></span>
        </li>
      </ul>

      <h3 className="wk-h3">2. Ta sama strona pod nową nazwą</h3>

      <p className="wk-note">
        GitHub Pages przyjmuje jedną własną domenę na repozytorium, a ta jedna to
        już <code>recreatio.pl</code>. Druga domena potrzebuje więc własnego
        miejsca: osobnego repozytorium z własnym plikiem <code>CNAME</code> albo
        dowolnego hostingu plików statycznych. Sam wpis w rejestrze tego nie
        załatwi.
      </p>

      <h3 className="wk-h3">3. Zgoda usługi na nową nazwę</h3>

      <p className="wk-note">
        Przeglądarka nie pozwoli stronie z <code>cogita.pl</code> czytać
        odpowiedzi z <code>api.recreatio.pl</code>, dopóki usługa tej nazwy nie
        wymieni (<code>Api:Origins</code>). Do tego potrzebny jest ktoś z dostępem
        do serwera — z warsztatu się tego nie ustawia, i tak ma być: lista
        dozwolonych nazw jest częścią zabezpieczeń, nie treści.
      </p>

      <h3 className="wk-h3">Logowanie pod własną domeną</h3>

      <p className="wk-note">
        <b>Strony publiczne działają bez logowania</b> — odwiedzający nic nie
        potrzebuje, wystarczy punkt 3. Ale <b>zalogować się pod własną domeną jest
        trudniej</b>: ciasteczko sesji wystawia <code>api.recreatio.pl</code>, więc
        na <code>cogita.pl</code> jest ciasteczkiem obcym, a Safari i Firefox takie
        blokują albo rozdzielają. Sesja po prostu nie wróci.
      </p>

      <p className="wk-note">
        Są dwie drogi. Prostsza: pod własną domeną tylko pokazywać stronę, a
        zarządzać nią na <code>recreatio.pl</code> — tam ciasteczko jest własne.
        Pełna: skierować <code>api.twoja-domena</code> (rekord{' '}
        <code>CNAME</code>) na tę samą usługę i zbudować tam oprogramowanie z{' '}
        <code>VITE_APP_API=https://api.twoja-domena</code>. Wtedy usługa i strona
        są pod jedną nazwą, ciasteczko jest własne i logowanie działa. Potrzebny
        jest do tego certyfikat na tę poddomenę — to również praca na serwerze.
      </p>
    </>
  );
}

export default Addresses;
