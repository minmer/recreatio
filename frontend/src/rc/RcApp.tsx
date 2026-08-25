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
import { RcChat } from './RcChat';
import { RcInviteBanner } from './RcInvite';
import { rcSecretFromHash } from './lib/rcInvite';
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

  // Wer über einen Einladungslink kommt, bringt das Geheimnis im Fragment
  // mit — hinter der Raute, wo der Browser es NICHT an den Server schickt.
  // Es aus der Adresse zu lesen ist deshalb der einzige Weg, es zu sehen.
  const [inviteSecret, setInviteSecret] = useState<string | null>(() =>
    rcSecretFromHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setInviteSecret(rcSecretFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
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

  // Beim ersten Aufruf sofort prüfen. Wer die Seite öffnet, soll nicht erst
  // einen Knopf suchen müssen, um zu erfahren, ob seine Fassung stimmt.
  useEffect(() => {
    void run();
  }, [run]);

  const allGreen = report !== null && report.failed === 0;

  const summary = useMemo(() => {
    if (!report) return null;
    return {
      passed: rcPlural(lang, t.selfTest.passed, report.passed),
      failed: rcPlural(lang, t.selfTest.failed, report.failed),
      duration: rcFormat(t.selfTest.duration, { ms: Math.round(report.durationMs) })
    };
  }, [report, lang, t]);

  return (
    <div className="rc-root">
      <div className="rc-shell">
        <header className="rc-top">
          <h1 className="rc-brand">{t.shell.title}</h1>
          <span className="rc-stage">{t.shell.stage}</span>
          <div className="rc-top-right">
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

        {/* Ganz oben und vor allem anderen: wer über einen Link kommt, soll
            als Erstes erfahren, wohinein er führt — nicht nach dem Scrollen. */}
        {inviteSecret !== null && (
          <RcInviteBanner
            lang={lang}
            secret={inviteSecret}
            canRedeem={unlocked}
            onDone={() => setInviteSecret(null)}
          />
        )}

        <section className="rc-section">
          <h2 className="rc-h2">{t.auth.heading}</h2>
          {/* Kein Schaustück mehr: dieses Formular spricht mit /rc/auth und
              führt einen echten Argon2id-Lauf aus. Das Passwort verlässt das
              Gerät nicht — nur der daraus abgeleitete Schlüssel. */}
          <RcSignIn lang={lang} onReady={setUnlocked} />
        </section>

        <section className="rc-section">
          <h2 className="rc-h2">{t.chat.areas}</h2>
          <RcChat lang={lang} unlocked={unlocked} />
        </section>

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
