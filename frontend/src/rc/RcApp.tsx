/**
 * Die neue Plattform unter /#/new.
 *
 * Sie läuft NEBEN dem Altbestand, unter eigenem Pfad und mit eigener Datenbank
 * (2.1). Kein gemeinsames Schema, keine geteilten Tabellen, keine
 * Zwischenschicht, die beide bedient. Der Drop des Altbestands folgt etwa einen
 * Monat später — bis dahin behält Hortus seinen Buchungsbetrieb und
 * Veranstaltungen laufen saisonal weiter.
 *
 * Was hier steht, ist der Stand der Phase 0. Die Selbstprüfung ist kein
 * Schaustück: sie belegt, dass dieser Browser bitgenau dasselbe rechnet wie
 * der Kernel auf dem Server. Läuft das auseinander, entstehen Daten, die
 * niemand mehr öffnet — und zwar lautlos.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rcCopy, rcDetectLang, rcFormat, rcPlural, rcStoreLang, type RcLang } from './i18n';
import { runRcSelfTest, type RcTestReport } from './lib/rcSelfTest';
import { RcChat, RcEventsSection, RcParishOutlet, RcGraphOutlet, RcCalendarOutlet, RcConfirmationOutlet } from './RcChat';
import { RcAccountOutlet } from './RcAccount';
import { RcSignInDrawer } from './RcSignInDrawer';
import { RcParishSite } from './parish/RcParishSite';
import './parish/parishSite.css';

import { RcPersonOutlet } from './RcPerson';
import { RcInviteBanner } from './RcInvite';
import { RcSignInPage } from './RcSignInPage';
import { rcEnter, rcEntryCheck, rcBrowserMemory, type RcEntry } from './lib/rcBoot';
import { rcHasUnlockPiece, rcLogout, rcMe, type RcMe } from './lib/rcAuth';
import { rcNeedsIdentity, rcParsePath, rcPath, type RcAddress, type RcPart } from './lib/rcRoute';
import { RcSignIn } from './RcSignIn';
import './styles/rc.css';

type BuildState = 'done' | 'building' | 'planned';

interface BuildRow {
  readonly state: BuildState;
  readonly what: string;
  readonly where: string;
}

/** Phase 0 nach Kapitel 17. Bewusst ehrlich geführt — eine Statusliste, die
 *  zu viel „fertig" behauptet, ist schlimmer als keine. */
const BUILD: readonly BuildRow[] = [
  { state: 'done', what: 'Kryptografische Konstruktion, Anhang C', where: 'Rc.Kernel/RcCrypto.cs' },
  { state: 'done', what: 'AAD-Konvention mit Pflichtparametern, 3.13', where: 'Rc.Kernel/RcAad.cs' },
  { state: 'done', what: 'Kanonische Serialisierung, Anhang D', where: 'Rc.Kernel/RcCanonical.cs' },
  { state: 'done', what: 'ID-Format UUIDv7, Anhang E', where: 'Rc.Kernel/RcId.cs' },
  { state: 'done', what: 'Ketteneintrag mit Signatur, 7.5', where: 'Rc.Kernel/RcLedgerEntry.cs' },
  { state: 'done', what: 'Prüfreihe Kernel, 81 Fälle', where: 'Rc.Kernel.Tests' },
  { state: 'done', what: 'Kernel- und Kettenschema, 31 Tabellen', where: 'Rc.Schema/Sql/rc_0001_kernel.sql' },
  { state: 'done', what: 'Chat-Schema mit Epochen', where: 'Rc.Schema/Sql/rc_0002_chat.sql' },
  { state: 'done', what: 'Migrationslauf, Wiedereintritt und Rollback geprüft', where: 'Rc.Schema/Program.cs' },
  { state: 'done', what: 'Prüfreihe Schema, 14 Bedingungen', where: 'Rc.Schema/Sql/rc_verify_constraints.sql' },
  { state: 'done', what: 'Dieselbe Kryptografie im Browser', where: 'rc/lib/rcCrypto.ts' },
  { state: 'done', what: 'Sprachschicht mit Pluralformen, 15.13', where: 'rc/i18n' },
  { state: 'done', what: 'Bereitschaftsprüfung beim Start, fünf Abhängigkeiten, 15.3', where: 'Rc.Api/RcReadiness.cs' },
  { state: 'done', what: 'Zentrale CSRF als Standardverhalten, 15.1', where: 'Rc.Api/RcCsrf.cs' },
  { state: 'done', what: 'Ein Token-Baustein, 10.3.1', where: 'Rc.Kernel/RcToken.cs' },
  { state: 'done', what: 'Geteilte Schlüsselhaltung, Sitzungswiderruf, 3.9', where: 'Rc.Kernel/RcKeyVault.cs' },
  { state: 'done', what: 'Argon2id, Anmeldenachweis, Passwortwechsel, 21.8', where: 'Rc.Kernel/RcPassword.cs' },
  { state: 'done', what: 'Anmelden, Entsperren, Sperren, Abmelden', where: 'Rc.Api/RcAuth.cs' },
  { state: 'done', what: 'Rollenschlüssel, Zuteilung statt Ableitung, 21.6', where: 'Rc.Kernel/RcRoleKeys.cs' },
  { state: 'done', what: 'Rollengraph, Zyklenprüfung, 3.14', where: 'Rc.Kernel/RcRoleGraph.cs' },
  { state: 'done', what: 'Berechtigungen in EINER Abfrage, 3.5 und 24.5', where: 'Rc.Api/RcPermissions.cs' },
  { state: 'done', what: 'Signierte Zertifikate und Kanten, 3.5', where: 'Rc.Kernel/RcSignedRecords.cs' },
  { state: 'done', what: 'Prüfreihe gegen den laufenden Dienst, 38 Fälle', where: 'Rc.Api.Tests' },
  { state: 'planned', what: 'Erzeugter API-Klient aus OpenAPI, 15.6', where: 'Build' },
  { state: 'planned', what: 'Bereiche, Nachrichten, Epochen, Kapitel 9', where: 'Rc.Api' }
];

export function RcApp() {
  const [lang, setLang] = useState<RcLang>(rcDetectLang);
  const [report, setReport] = useState<RcTestReport | null>(null);
  const [running, setRunning] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  /*
   * Die Schublade steht neben der Seite und nicht an ihrer Stelle.
   *
   * Sie ist der Weg fuer jemanden, der schon irgendwo ist und ein Konto
   * braucht, um weiterzukommen. Wer gar keine Schluessel hat, sieht
   * ohnehin die ganze Seite (`RcSignInPage`) — dann ist die Anmeldung
   * nicht eine Sache neben anderen, sondern die einzige.
   */
  const [drawerOpen, setDrawerOpen] = useState(false);

  /**
   * Die Adresse. Aus ihr folgt beides: WAS gezeigt wird und OB beim Eintritt
   * gefragt werden muss, wer hier ist (`rcRoute.ts`, `rcBoot.ts`).
   */
  const [address, setAddress] = useState<RcAddress>(() => rcParsePath(window.location.hash));

  useEffect(() => {
    const onHash = () => setAddress(rcParsePath(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Wer über einen Einladungslink kommt, bringt das Geheimnis im Fragment
  // mit — hinter der Raute, wo der Browser es NICHT an den Server schickt.
  // Es aus der Adresse zu lesen ist deshalb der einzige Weg, es zu sehen.
  const inviteSecret = address.part === 'invite' ? address.slug : null;

  /**
   * Der Eintritt. Er läuft EINMAL beim Öffnen und stellt die Frage nur, wenn
   * ihre Antwort etwas ändern kann — sonst gar nicht, bis jemand das
   * Anmeldeformular anfasst. Die Begründung steht in `rcBoot.ts`.
   */
  const [entry, setEntry] = useState<RcEntry<RcMe>>({ kind: 'checking' });

  useEffect(() => {
    let alive = true;

    // Die Adresse wird hier BEIM ÖFFNEN gelesen, nicht die des Zustands: ein
    // späterer Sprung innerhalb der Plattform ist kein neuer Eintritt, und
    // die Frage ein zweites Mal zu stellen brächte nichts Neues.
    const hints = {
      needsIdentity: rcNeedsIdentity(rcParsePath(window.location.hash)),
      signedInBefore: rcBrowserMemory.signedInBefore(),
      hasUnlockPiece: rcHasUnlockPiece()
    };

    void rcEnter(hints, rcMe).then((result) => {
      if (alive) setEntry(result);
    });

    return () => { alive = false; };
  }, []);

  /**
   * Der zweite Rückfall: nicht der Anmeldeknopf, sondern der Schritt IN die
   * Werkstatt. Wer auf der öffentlichen Seite anfängt, wurde beim Eintritt
   * nicht gefragt — geht er von dort in einen Teil, der ohne Schlüssel leer
   * wäre, muss die Frage nachgeholt werden, bevor dieser Teil malt.
   */
  useEffect(() => {
    if (entry.kind !== 'unasked' || !rcNeedsIdentity(address)) return;

    let alive = true;
    setEntry({ kind: 'checking' });
    void rcEntryCheck(rcMe, rcBrowserMemory, rcHasUnlockPiece, rcLogout).then((result) => {
      if (alive) setEntry(result);
    });

    return () => { alive = false; };
  }, [address, entry.kind]);

  const t = rcCopy[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    rcStoreLang(lang);
  }, [lang]);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      setReport(await runRcSelfTest());
    } finally {
      setRunning(false);
    }
  }, []);

  /**
   * Die Selbstprüfung läuft von selbst — aber nicht für jeden.
   *
   * Sie enthält einen echten Argon2id-Lauf mit 64 MiB. Wer die Seite der
   * Stiftung liest, zahlt dafür eine Sekunde Rechenzeit und 64 MiB Speicher
   * seines Telefons, für eine Auskunft, die ihn nichts angeht: ob dieser
   * Browser bitgenau dasselbe rechnet wie der Kernel, entscheidet sich erst,
   * wenn wirklich etwas verschlüsselt wird.
   *
   * Genau derselbe Schnitt wie beim Eintritt, aus genau demselben Grund — und
   * deshalb an derselben Bedingung: sobald jemand bekannt ist oder in die
   * Werkstatt will, läuft sie ohne Zutun. Der Knopf bleibt für alle da.
   */
  useEffect(() => {
    if (report !== null || running) return;
    if (entry.kind === 'signed-in' || rcNeedsIdentity(address)) void run();
  }, [address, entry.kind, report, running, run]);

  const allGreen = report !== null && report.failed === 0;

  const summary = useMemo(() => {
    if (!report) return null;
    return {
      passed: rcPlural(lang, t.selfTest.passed, report.passed),
      failed: rcPlural(lang, t.selfTest.failed, report.failed),
      duration: rcFormat(t.selfTest.duration, { ms: Math.round(report.durationMs) })
    };
  }, [report, lang, t]);

  /**
   * Was die Adresse zeigt.
   *
   * Nennt sie keinen Teil, steht alles untereinander wie bisher — das ist die
   * Bauseite der Phase 0. Nennt sie einen, steht dieser Teil allein da. Die
   * ADRESSE entscheidet und nicht ein Zustand im Speicher: nur so überlebt
   * die Ansicht ein Neuladen und lässt sich weitergeben.
   */
  const shows = useCallback(
    (part: RcPart) => address.part === 'home' || address.part === part,
    [address.part]
  );

  /** Die Teile mit eigener Ansicht, in der Reihenfolge der Seite. */
  const parts = useMemo(
    () =>
      [
        ['account', t.account.heading],
        ['chat', t.chat.areas],
        ['event', t.events.heading],
        ['parish', t.parish.heading],
        ['cogita', t.graph.heading],
        ['calendar', t.cal.heading],
        ['confirmation', t.conf.heading]
      ] as const,
    [t]
  );

  /*
   * SOLANGE DIE SCHLÜSSEL FEHLEN, GIBT ES NUR EINE SEITE.
   *
   * Vorher stand das Formular als ein Abschnitt unter vielen, umgeben von
   * sechs Modulen, die alle „gesperrt" meldeten. Wer sich anmelden wollte,
   * musste zuerst an einer Baustandsliste und einer Teilenavigation vorbei.
   *
   * Der Einladungsbanner wandert MIT: wer über einen Link kommt, soll vorher
   * wissen, wohin er führt — das war schon immer so und bleibt es.
   */
  /*
   * DIE OEFFENTLICHE PFARRSEITE STEHT VOR ALLEM ANDEREN.
   *
   * Vor der Anmeldeseite, vor der Werkstatt, vor allem. Wer
   * `#/new/parish/grzegorzki` aufruft, will den Messplan sehen und nicht ein
   * Anmeldeformular — eine Pfarrseite, die nach dem Passwort fragt, bevor sie
   * die Gottesdienstzeiten zeigt, ist keine Pfarrseite.
   *
   * Ohne Namen in der Adresse (`#/new/parish`) bleibt es die Verwaltung, und
   * die braucht Schluessel wie alles andere in der Werkstatt.
   */
  if (address.part === 'parish' && address.slug !== null) {
    /*
     * Die Anmeldeschublade fährt AUF der Pfarrseite herein.
     *
     * Wer den Messplan pflegen will, soll sich anmelden können, ohne die Seite
     * zu verlassen — sonst geht er den Umweg über die Werkstatt und findet von
     * dort nicht zurück.
     */
    return (
      <>
        {/* Die Unterseite steht in der ADRESSE und nicht in einem Zustand:
            deshalb laesst sie sich weitergeben, mit der mittleren Maustaste in
            einem neuen Reiter oeffnen und mit dem Zurueck-Knopf verlassen. */}
        <RcParishSite
          slug={address.slug}
          page={(address.tail[0] ?? 'start') as never}
          sub={address.tail[1] ?? null}
          signedIn={entry.kind === 'signed-in'}
          onSignIn={() => setDrawerOpen(true)}
        />
        <RcSignInDrawer
          lang={lang}
          entry={entry}
          onEntry={setEntry}
          onReady={setUnlocked}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      </>
    );
  }

  if (!unlocked) {
    return (
      <div className="rc-root">
        <RcSignInPage
          lang={lang}
          onLang={setLang}
          banner={inviteSecret === null ? null : (
            <RcInviteBanner
              lang={lang}
              secret={inviteSecret}
              canRedeem={false}
              onDone={() => { window.location.hash = rcPath('home'); }}
            />
          )}
        >
          <RcSignIn lang={lang} entry={entry} onEntry={setEntry} onReady={setUnlocked} />
        </RcSignInPage>
      </div>
    );
  }

  return (
    <div className="rc-root">
      <div className="rc-shell">
        <header className="rc-top">
          <h1 className="rc-brand">
            <a href={rcPath('home')}>{t.shell.title}</a>
          </h1>
          <span className="rc-stage">{t.shell.stage}</span>
          <div className="rc-top-right">
            {/*
              WER ANGEMELDET IST, STEHT IN DER KOPFLEISTE.

              Vorher war das ein eigener Abschnitt mit eigener Ueberschrift,
              ganz oben in der Seite — vor allem, was jemand eigentlich sehen
              wollte. Wer angemeldet ist, braucht davon zwei Dinge: wer er ist
              und den Weg hinaus. Beides gehoert neben die Sprachwahl und nicht
              in den Inhalt.

              Das FORMULAR bleibt, wo es war: solange die Schluessel fehlen,
              zeigt `RcSignInPage` ohnehin nur dieses eine Bild.
            */}
            {entry.kind === 'signed-in'
              ? <RcSignIn lang={lang} entry={entry} onEntry={setEntry} onReady={setUnlocked} />
              : (
                <button
                  type="button"
                  className="rc-btn"
                  onClick={() => setDrawerOpen(true)}
                >
                  {t.auth.signIn}
                </button>
              )}

            {(['pl', 'de', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className="rc-btn rc-btn-quiet"
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
              >
                {t.lang[l]}
              </button>
            ))}
          </div>
        </header>

        <p className="rc-lead">{t.shell.subtitle}</p>

        {/* Die Teile als Adressen und nicht als Knöpfe: jeder hat einen Ort,
            der sich weitergeben lässt. */}
        <nav className="rc-parts">
          {address.part !== 'home' && <a href={rcPath('home')}>{t.route.backToStart}</a>}
          {parts.map(([part, label]) => (
            <a key={part} href={rcPath(part)} aria-current={address.part === part ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>

        {/* Einer Adresse fehlt der Teil vor dem Namen. Sie wird NICHT
            stillschweigend zur Startseite — wer so einen Link bekommen hat,
            soll erfahren, was ihm fehlt. */}
        {address.stray !== null && (
          <section className="rc-section rc-stray">
            <h2 className="rc-h2">{t.route.strayHeading}</h2>
            <p className="rc-note">
              {rcFormat(t.route.strayBody, {
                word: address.stray,
                example: rcPath('parish', address.stray)
              })}
            </p>
            <a className="rc-btn rc-btn-quiet" href={rcPath('home')}>{t.route.strayHome}</a>
          </section>
        )}

        {/* Selbstprüfung und Baustand gehören zur Bauseite und nicht in einen
            einzelnen Teil. Wer `#/new/parish` aufruft, will die Pfarrei sehen. */}
        {address.part === 'home' && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.selfTest.heading}</h2>
          <p className="rc-note">{t.selfTest.intro}</p>

          <button type="button" className="rc-btn" onClick={run} disabled={running}>
            {running ? t.selfTest.running : t.selfTest.run}
          </button>

          {report && summary && (
            <>
              <p className="rc-test-summary">
                <span className="rc-test-ok">{summary.passed}</span>
                {report.failed > 0 && <span className="rc-test-bad">{summary.failed}</span>}
                <span className="rc-test-time">{summary.duration}</span>
              </p>
              {allGreen && <p className="rc-note">{t.selfTest.allGreen}</p>}

              <ul className="rc-test-list">
                {report.results.map((r) => (
                  <li className="rc-test-item" key={r.name} data-passed={r.passed}>
                    <span className="rc-test-mark">{r.passed ? 'OK' : '!!'}</span>
                    <span className="rc-test-name">{r.name}</span>
                    {!r.passed && r.expected !== undefined && (
                      <span className="rc-test-detail">
                        {t.selfTest.expected}: {r.expected}
                        <br />
                        {t.selfTest.actual}: {r.actual}
                      </span>
                    )}
                    {!r.passed && r.expected === undefined && r.actual && (
                      <span className="rc-test-detail">{r.actual}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        )}

        {address.part === 'home' && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.status.heading}</h2>
          <ul className="rc-status">
            {BUILD.map((row) => (
              <li key={row.where + row.what}>
                <span className="rc-status-mark" data-state={row.state}>
                  {t.status[row.state]}
                </span>
                <span>
                  {row.what} — <code>{row.where}</code>
                </span>
              </li>
            ))}
          </ul>
        </section>
        )}

        {/* Ganz oben und vor allem anderen: wer über einen Link kommt, soll
            als Erstes erfahren, wohinein er führt — nicht nach dem Scrollen. */}
        {inviteSecret !== null && (
          <RcInviteBanner
            lang={lang}
            secret={inviteSecret}
            canRedeem={unlocked}
            // Nach dem Einlösen führt die Adresse woandershin. Das Geheimnis
            // bliebe sonst im Adressfeld und im Verlauf stehen — sichtbar für
            // den Nächsten am selben Rechner, obwohl es verbraucht ist.
            onDone={() => { window.location.hash = rcPath('home'); }}
          />
        )}


        {shows('account') && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.account.heading}</h2>
          <RcAccountOutlet lang={lang} unlocked={unlocked} />
        </section>
        )}

        {/*
          Die Person hat KEINEN Platz auf der Startseite.

          `shows` laesst jeden Teil auch bei `home` durch — das ist fuer die
          Werkzeuge richtig, die man nebeneinander sehen will. Ein Steckbrief
          ohne Rollenkennung waere dort aber nur eine Zeile „diese Adresse nennt
          keine Person". Deshalb hier die Adresse selbst und nicht `shows`.
        */}
        {address.part === 'person' && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.person.heading}</h2>
          <RcPersonOutlet lang={lang} roleId={address.slug} unlocked={unlocked} />
        </section>
        )}

        {shows('chat') && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.chat.areas}</h2>
          <RcChat lang={lang} unlocked={unlocked} />
        </section>
        )}

        {shows('event') && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.events.heading}</h2>
          <RcEventsSection lang={lang} unlocked={unlocked} />
        </section>
        )}

        {shows('parish') && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.parish.heading}</h2>
          <RcParishOutlet lang={lang} unlocked={unlocked} />
        </section>
        )}

        {shows('cogita') && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.graph.heading}</h2>
          <RcGraphOutlet lang={lang} unlocked={unlocked} />
        </section>
        )}

        {shows('calendar') && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.cal.heading}</h2>
          <RcCalendarOutlet lang={lang} unlocked={unlocked} />
        </section>
        )}

        {shows('confirmation') && (
        <section className="rc-section">
          <h2 className="rc-h2">{t.conf.heading}</h2>
          <RcConfirmationOutlet lang={lang} unlocked={unlocked} />
        </section>
        )}

        {/* Ausserhalb der Abschnitte: sie legt sich ueber die ganze Seite. */}
        <RcSignInDrawer
          lang={lang}
          entry={entry}
          onEntry={setEntry}
          onReady={setUnlocked}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />

        <footer className="rc-foot">
          <span>{t.shell.legacyHint}</span>
          <a href="#/section-1">{t.shell.openLegacy}</a>
        </footer>
      </div>
    </div>
  );
}

/**
 * 9.16 — Der Entsperr-Baustein. Überall dort, wo verschlüsselter Inhalt ohne
 * Schlüssel angefragt wird, erscheint DIESE Aufforderung: im Embed, nach dem
 * Abmelden, bei gesperrter Sitzung, nach Ablauf des serverseitigen
 * Schlüsselgedächtnisses und im sicheren Modus bei jeder Handlung.
 *
 * Er liegt bewusst im gemeinsamen Paket und nicht im Chat-Paket.
 */
export function RcUnlockPrompt({ lang, onUnlock }: { lang: RcLang; onUnlock: () => void }) {
  const t = rcCopy[lang];
  return (
    <div className="rc-unlock">
      <h3>{t.unlock.heading}</h3>
      <p>{t.unlock.body}</p>
      <button type="button" className="rc-btn" onClick={onUnlock}>
        {t.unlock.action}
      </button>
      <details>
        <summary>{t.unlock.whyHeading}</summary>
        <p>{t.unlock.why}</p>
      </details>
    </div>
  );
}

export default RcApp;
