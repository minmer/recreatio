/**
 * Die öffentliche Pfarrseite.
 *
 * <b>Alles, was hier steht, kommt aus der angelegten Pfarrei.</b> Vorher stand
 * hier ein erfundener Name und eine fest eingebaute Liste — die Seite sah
 * richtig aus und war es nicht. Name, Ort und die Gestaltung der Startseite
 * holt jetzt `/rc/public/parishes/{slug}`, ohne Konto, weil eine Pfarrseite
 * ohne Konto lesbar sein muss.
 *
 * <b>Der Aufbau stammt aus `pages/parish/ParishPage.tsx`</b>: klebende
 * Kopfleiste, zweistufiges Menü, darunter der Inhalt. Die Farben aus
 * `styles/parish.css`.
 *
 * <b>Wer verwalten darf, sieht den Bearbeitungsschalter.</b> Er wird nicht
 * geraten: die Seite fragt `/rc/permissions/check` nach `admin` auf dem Bereich
 * der Pfarrei. Ein Schalter, der erscheint und dann nichts tut, ist schlimmer
 * als keiner.
 *
 * <b>Was noch Schaudaten sind, steht auf der Seite.</b> Messplan, Intentionen
 * und Ankündigungen kommen noch aus `rcParishMock.ts` — die echten liegen
 * hinter Endpunkten, die je Pfarrei erst gefüllt werden müssen. Der Name tut
 * es nicht mehr, und das ist der Unterschied, auf den es ankam.
 */

import { useEffect, useState } from 'react';

import {
  RC_ANNOUNCEMENTS, RC_EVENTS, RC_EXCEPTIONS, RC_INTENTIONS, RC_MASSES,
  RC_MASS_TABS, RC_MASS_TAB_LABELS, RC_PARISH_MENU, RC_PRIESTS,
  type RcMassTab, type RcPageId
} from './rcParishMock';
import { rcPublicParish, type RcPublicParish } from './rcPublicParish';
import { rcMayAdminArea } from './rcParishRights';
import { rcPath } from '../lib/rcRoute';
import { RcParishBuilder } from './RcParishBuilder';
import { rcSaveParishSite } from '../lib/rcParish';
import { RcParishHome } from './RcParishHome';
import { RcApplyForm } from './RcApplyForm';
import { RcMyApplication, useMineHere } from './RcMyApplication';
import { RcPersonPicker, usePersons, useActivePerson } from '../RcPersonPicker';
import { rcMe } from '../lib/rcAuth';
import { rcMyPersonFields } from './rcPrefill';
import { RC_EMPTY_SITE, rcPage, rcReadSite, type RcSite } from './rcSite';

export function RcParishSite({
  slug, page, sub, signedIn, access
}: {
  slug: string;
  /**
   * Welche Unterseite — aus der ADRESSE und nicht aus einem Zustand.
   *
   * <b>Warum das der Unterschied ist:</b> ein Zustand im Speicher hat keine
   * Adresse. Man kann ihn nicht mit der mittleren Maustaste in einem neuen
   * Reiter öffnen, nicht als Lesezeichen ablegen, nicht jemandem schicken und
   * nicht mit dem Zurück-Knopf verlassen. Vier gewohnte Handgriffe, die alle
   * ins Leere gehen, weil die Navigation aus Knöpfen bestand.
   */
  page: RcPageId;
  /** Das Segment danach — bei den Messen der Reiter. */
  sub: string | null;
  /** Ob überhaupt jemand angemeldet ist — sonst braucht es gar keine Rückfrage. */
  signedIn: boolean;

  /**
   * Der Zugang, fertig gebaut.
   *
   * Er kommt VON AUSSEN und wird hier nicht zusammengesetzt: er braucht den
   * Eintrittszustand und die Schublade, und beides gehoert der Anwendung. Eine
   * Pfarrseite, die sich das selbst beschafft, waere eine zweite Stelle, an der
   * Anmeldung stattfindet.
   */
  access: React.ReactNode;
}) {
  const [parish, setParish] = useState<RcPublicParish | null>(null);
  const [missing, setMissing] = useState(false);
  const [mayEdit, setMayEdit] = useState(false);
  const [editing, setEditing] = useState(false);

  /*
   * Das ganze Dokument: Aufbau, Menue und Inhalt. Es kommt als JSON-Text vom
   * Dienst und wird hier einmal geoeffnet — ein kaputter Text macht die Seite
   * nicht kaputt, er ergibt ein leeres Dokument.
   */
  const [site, setSite] = useState<RcSite>(RC_EMPTY_SITE);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  /*
   * Was von dem, der zusieht, schon bekannt ist.
   *
   * Nur wenn jemand angemeldet UND aufgeschlossen ist — die Angaben liegen
   * verschluesselt an seiner persoenlichen Rolle, und ohne Schluessel gibt es
   * sie nicht zu lesen.
   */
  const [prefill, setPrefill] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!signedIn) { setPrefill({}); return; }
    let alive = true;
    void (async () => {
      const found = await rcMyPersonFields();
      if (alive) setPrefill(found);
    })();
    return () => { alive = false; };
  }, [signedIn]);

  /*
   * Die eigene Anmeldung in DIESER Pfarrei — falls es eine gibt und das Konto
   * sie aufmachen kann.
   */
  /*
   * ALS WEN diese Seite offen ist.
   *
   * Auf der Firmungsseite hat das eine sichtbare Folge: wessen Anmeldung
   * dasteht und fuer wen eine neue gilt. Deshalb steht die Wahl auch HIER und
   * nicht nur in der Anmeldeschublade — eine Wahl, deren Wirkung man erst
   * zwei Klicks spaeter bemerkt, wird falsch getroffen.
   */
  const [accountId, setAccountId] = useState('');

  useEffect(() => {
    if (!signedIn) { setAccountId(''); return; }
    let alive = true;
    void (async () => {
      try {
        const who = await rcMe();
        if (alive) setAccountId(who.accountId ?? '');
      } catch { if (alive) setAccountId(''); }
    })();
    return () => { alive = false; };
  }, [signedIn]);

  const persons = usePersons(signedIn);
  const activePerson = useActivePerson(accountId, persons);

  const mine = useMineHere(slug, signedIn, activePerson);

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const found = await rcPublicParish(slug);
        if (!alive) return;
        setParish(found);
        setSite(rcReadSite(found.modules));
      } catch {
        if (alive) setMissing(true);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  /*
   * Darf der Angemeldete hier verwalten?
   *
   * Erst wenn beides feststeht — jemand ist angemeldet UND die Pfarrei ist
   * geladen —, denn die Frage braucht den Bereich. Wer nicht angemeldet ist,
   * wird gar nicht erst gefragt: die Antwort steht fest.
   */
  useEffect(() => {
    if (!signedIn || parish === null) { setMayEdit(false); return; }
    let alive = true;
    void (async () => {
      const may = await rcMayAdminArea(parish.areaId);
      if (alive) setMayEdit(may);
    })();
    return () => { alive = false; };
  }, [signedIn, parish]);

  const save = async () => {
    if (parish === null) return;
    setSaving('saving');
    try {
      await rcSaveParishSite(parish.parishId, parish.theme, site);
      setSaving('saved');
    } catch { setSaving('failed'); }
  };

  /*
   * Ein Menuepunkt nennt seine Seite als `pageId` — der eingebaute Rueckfall
   * aus dem Altbestand nennt sie `id`. Beide Formen laufen durch dieselbe
   * Leiste, also wird hier einmal uebersetzt statt an sechs Stellen geprueft.
   */
  const pageOf = (item: { id?: string; pageId?: string }): RcPageId | null =>
    (item.pageId ?? item.id ?? null) as RcPageId | null;

  /**
   * Die Adresse einer Unterseite.
   *
   * Die Startseite trägt KEIN Segment: `#/new/parish/grzegorzki` ist die
   * Pfarrseite, nicht `…/start`. Zwei Adressen für dieselbe Seite wären zwei
   * Seiten in jedem Verlauf und in jeder Statistik.
   */
  const at = (id: string): string =>
    id === 'start' ? rcPath('parish', slug) : rcPath('parish', slug, id);

  /** Nach einem Klick im Menü schliesst sich das Menü — die Adresse führt weiter. */
  const close = () => { setOpenGroup(null); setMenuOpen(false); };

  /*
   * Der Reiter des Messplans steht im ZWEITEN Segment
   * (`…/parish/grzegorzki/masses/confession`). Steht dort nichts oder etwas
   * Unbekanntes, gilt die Sonntagstafel — eine Adresse aus einer alten
   * Nachricht soll etwas zeigen und nicht eine Fehlermeldung.
   */
  const tab: RcMassTab =
    RC_MASS_TABS.find((t) => t.toLowerCase() === (sub ?? '').toLowerCase()) ?? 'Sunday';

  if (missing) {
    return (
      <div className="ps">
        <main className="ps-main">
          <h1 className="ps-title">Nie znaleziono parafii</h1>
          <article className="ps-card">
            <p>Pod adresem <code>{slug}</code> nie ma jeszcze strony parafii.</p>
            <a className="ps-more" href={rcPath('parish')}>Wróć do listy</a>
          </article>
        </main>
      </div>
    );
  }

  if (parish === null) {
    return <div className="ps"><main className="ps-main"><p className="ps-muted">Wczytywanie…</p></main></div>;
  }

  const name = parish.name;

  /*
   * Wen der Ausdruck beim Namen nennt.
   *
   * Steht einmal da und wird an zwei Stellen gebraucht — im Formular und in
   * der eigenen Anmeldung. Zweimal geschrieben liefen die beiden Blaetter
   * irgendwann auseinander, und niemand saehe, welches das richtige ist.
   */
  const forPrint = {
    name,
    address: site.content['contact.address'] ?? '',
    email: site.content['contact.email'] ?? '',
    leader: site.content['sacrament.confirmation.who'] ?? ''
  };

  return (
    <div className="ps" data-theme={parish.theme}>
      <header className="ps-head">
        <a className="ps-brand" href={at('start')} onClick={close}>
          <span className="ps-mark" aria-hidden="true">✝</span>
          <span className="ps-name">{name}</span>
        </a>

        {/*
          DAS MENUE KOMMT AUS DEM DOKUMENT.

          Solange niemand eines gebaut hat, steht das der alten Seite da — eine
          Pfarrseite ohne Menue waere unbenutzbar, und ein leeres Menue sieht
          aus wie ein Fehler. Sobald im Editor etwas gesetzt wird, gilt das.
        */}
        <nav className={`ps-menu${menuOpen ? ' is-open' : ''}`} aria-label="Menu parafialne">
          {(site.menu.length > 0 ? site.menu : RC_PARISH_MENU).map((item) => {
            if (!item.children) {
              const id = pageOf(item);
              return (
                <a
                  key={item.label}
                  className={`ps-link${page === id ? ' is-active' : ''}`}
                  href={id === null ? undefined : at(id)}
                  aria-current={page === id ? 'page' : undefined}
                  onClick={close}
                >
                  {item.label}
                </a>
              );
            }

            const active = item.children.some((c) => pageOf(c) === page);
            const open = openGroup === item.label;

            return (
              <div key={item.label} className={`ps-group${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="ps-link"
                  aria-expanded={open}
                  onClick={() => setOpenGroup((c) => (c === item.label ? null : item.label))}
                >
                  {item.label} <span aria-hidden="true">▾</span>
                </button>
                <div className="ps-sub">
                  {item.children.map((child) => (
                    <a
                      key={pageOf(child) ?? child.label}
                      className={`ps-sub-link${page === pageOf(child) ? ' is-active' : ''}`}
                      href={pageOf(child) === null ? undefined : at(pageOf(child) as string)}
                      aria-current={page === pageOf(child) ? 'page' : undefined}
                      onClick={close}
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/*
          DER ZUGANG STEHT OBEN RECHTS.

          Eine Pfarrseite wird von zwei Sorten Menschen benutzt: von denen, die
          den Messplan lesen, und von denen, die ihn pflegen. Die zweiten müssen
          hier hineinkommen, ohne die Seite zu verlassen — sonst gehen sie den
          Umweg über die Werkstatt und finden von dort nicht zurück.
        */}
        <div className="ps-access">
          {mayEdit && (
            <button
              type="button"
              className={`ps-edit${editing ? ' is-on' : ''}`}
              aria-pressed={editing}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Zakończ edycję' : 'Edytuj stronę'}
            </button>
          )}

          {access}
        </div>

        <button
          type="button"
          className="ps-burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>
      </header>

      {editing && (
        <div className="ps-editor">
          <div className="ps-editing" role="status">
            <span>Tryb edycji — układ strony głównej.</span>
            <button
              type="button"
              className="ps-save"
              disabled={saving === 'saving'}
              onClick={() => void save()}
            >
              {saving === 'saving' ? 'Zapisywanie…' : saving === 'saved' ? 'Zapisano' : 'Zapisz układ'}
            </button>
            {saving === 'failed' && <span className="ps-save-bad">Nie udało się zapisać.</span>}
          </div>

          <div className="ps-editor-body">
            <RcParishBuilder
              site={site}
              onChange={(next) => { setSite(next); setSaving('idle'); }}
              parishId={parish.parishId}
              slug={slug}
            />
          </div>
        </div>
      )}

      {/*
        Was noch Schaudaten sind, steht als Warnung da: eine Seite mit
        wymyślonymi godzinami mszy, die aussieht wie eine echte, schickt
        irgendwann jemanden um siebenter Stunde in die Kirche.
      */}
      <p className="ps-mock" role="status">
        Godziny mszy, intencje i ogłoszenia są przykładowe — te dane nie zostały
        jeszcze wprowadzone dla tej parafii.
      </p>

      <main className="ps-main">
        {page === 'start' && (
          <>
            <section className="ps-hero">
              <h1>{parish.name}</h1>
              {parish.location !== null && parish.location !== undefined && parish.location !== ''
                ? <p>{parish.location}</p>
                : null}
            </section>

            {/* Was der Editor gesetzt hat — und nichts sonst. */}
            <RcParishHome
              site={site}
              mayEdit={mayEdit}
              at={at}
            />
          </>
        )}
        {page === 'announcements' && <Announcements />}
        {page === 'intentions' && <Intentions />}
        {page === 'masses' && <Masses tab={tab} at={at} />}
        {page === 'calendar' && <Calendar />}
        {page === 'clergy' && <Clergy />}
        {page === 'office' && <Office site={site} mayEdit={mayEdit} />}
        {page === 'about' && <About parish={parish} site={site} mayEdit={mayEdit} />}
        {page === 'contact' && <Contact parish={parish} site={site} mayEdit={mayEdit} />}
        {page.startsWith('sacrament-') && <Sacrament id={page} site={site} mayEdit={mayEdit} />}

        {/* Die Anmeldung steht UNTER dem Text der Firmungsseite: erst was es
            ist, dann der Weg hinein. */}
        {page === 'sacrament-confirmation' && (
          <div className="ps-stack">
            {/*
              WER SCHON GEMELDET IST, SIEHT SEINE MELDUNG — NICHT EIN LEERES
              FORMULAR.

              Ein leeres Formular neben einer bestehenden Anmeldung ist eine
              Einladung, sich ein zweites Mal zu melden; die zweite muss die
              Pfarrei danach von Hand erkennen und wegraeumen. Und gesucht wird
              die eigene Anmeldung genau HIER — auf der Seite, auf der man sie
              abgegeben hat, nicht in der Uebersicht des Kontos.
            */}
            {/*
              Bei mehreren Personen steht die Wahl ueber der Anmeldung: sie
              entscheidet, wessen Zettel man sieht und fuer wen ein neuer gilt.
            */}
            <RcPersonPicker
              accountId={accountId}
              persons={persons}
              active={activePerson}
              className="ps-person-pick"
            />

            {mine.state === 'found' ? (
              <>
                <RcMyApplication candidate={mine.candidate} parish={forPrint} />
                {mine.others > 0 && (
                  <p className="ps-muted">
                    Na tym koncie jest tu jeszcze {mine.others === 1 ? 'jedno zgłoszenie' : `zgłoszeń: ${mine.others}`}.
                    Przełącz osobę powyżej, aby je zobaczyć.
                  </p>
                )}
              </>
            ) : (
              <>
                {/*
                  „Kann ich nicht nachsehen" ist nicht „hast du nicht". Bei
                  gesperrten Schluesseln steht der Hinweis ueber dem Formular,
                  statt stillschweigend zum zweiten Zettel zu raten.
                */}
                {/*
                  Die gewaehlte Person hat hier nichts — eine andere auf
                  demselben Konto schon. Das gehoert gesagt, bevor jemand zum
                  zweiten Mal denselben Zettel ausfuellt.
                */}
                {mine.state === 'none' && mine.others > 0 && (
                  <article className="ps-card ps-card-note">
                    <h2>Zgłoszenie na tym koncie</h2>
                    <p>
                      Wybrana osoba nie ma tu zgłoszenia, ale inna osoba z tego
                      konta ma. Przełącz osobę powyżej — albo wypełnij formularz,
                      jeśli zgłaszasz kogoś jeszcze.
                    </p>
                  </article>
                )}

                {mine.state === 'locked' && (
                  <article className="ps-card ps-card-note">
                    <h2>Masz już zgłoszenie?</h2>
                    <p>
                      Nie możemy tego teraz sprawdzić — odblokuj konto hasłem.
                      Jeśli zgłaszałeś się już w tej parafii, nie wysyłaj
                      formularza drugi raz.
                    </p>
                  </article>
                )}

                <RcApplyForm
                  slug={slug}
                  signedIn={signedIn}
                  prefill={prefill}
                  parish={forPrint}
                />
              </>
            )}
          </div>
        )}
      </main>

      <footer className="ps-foot">
        <span>{name}</span>
        <a href={rcPath('parish')}>Wszystkie parafie</a>
        <a href="https://recreatio.pl">recreatio.pl</a>
      </footer>
    </div>
  );
}

/* -- Start ----------------------------------------------------------------- */

/* -- Die einzelnen Seiten -------------------------------------------------- */

function Announcements() {
  return (
    <Page title="Ogłoszenia">
      <ul className="ps-news ps-news-full">
        {RC_ANNOUNCEMENTS.map((a) => (
          <li key={a.id}>
            <time>{a.date}</time>
            <h3>{a.title}</h3>
            <p>{a.content}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}

function Intentions() {
  return (
    <Page title="Intencje mszalne">
      {RC_INTENTIONS.map((day) => (
        <article className="ps-card" key={day.day}>
          <h2>{day.day}</h2>
          <ul className="ps-rows">
            {day.items.map((i) => (
              <li key={i.time}>
                <time>{i.time}</time>
                <span>{i.text}</span>
                <em>{i.priest}</em>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </Page>
  );
}

function Masses({ tab, at }: { tab: RcMassTab; at: (id: string) => string }) {
  return (
    <Page title="Msze i nabożeństwa">
      {/*
        Auch die Reiter sind Verweise. Ein Reiter ist eine Sicht auf dieselbe
        Seite und trotzdem etwas, das man weitergeben will: „schau dir die
        Beichtzeiten an" ist eine Adresse und kein Klickweg.
      */}
      <div className="ps-tabs">
        {RC_MASS_TABS.map((t) => (
          <a
            key={t}
            className={`ps-tab${tab === t ? ' is-active' : ''}`}
            href={`${at('masses')}/${t.toLowerCase()}`}
            aria-current={tab === t ? 'page' : undefined}
          >
            {RC_MASS_TAB_LABELS[t]}
          </a>
        ))}
      </div>

      <article className="ps-card">
        <ul className="ps-rows">
          {RC_MASSES[tab].map((m) => (
            <li key={m.time + m.place}>
              <time>{m.time}</time>
              <span>{m.place}</span>
              <em>{m.note}</em>
            </li>
          ))}
        </ul>
      </article>

      <article className="ps-card ps-card-note">
        <h2>Zmiany i wyjątki</h2>
        <ul className="ps-rows">
          {RC_EXCEPTIONS.map((e) => (
            <li key={e.date}>
              <span>{e.date}</span>
              <em>{e.detail}</em>
            </li>
          ))}
        </ul>
      </article>
    </Page>
  );
}

function Calendar() {
  return (
    <Page title="Kalendarz">
      <ul className="ps-news ps-news-full">
        {RC_EVENTS.map((e) => (
          <li key={e.id}>
            <time>{e.date} · {e.time}</time>
            <h3>{e.title}</h3>
            <p>{e.place} — {e.category}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}

function Clergy() {
  return (
    <Page title="Duszpasterze">
      <div className="ps-grid">
        {RC_PRIESTS.map((p) => (
          <article className="ps-card ps-w-third" key={p.id}>
            <h2>{p.name}</h2>
            <p className="ps-role">{p.role}</p>
            <p>{p.bio}</p>
            <p className="ps-muted">Dyżur: {p.hours}</p>
          </article>
        ))}
      </div>
    </Page>
  );
}

/**
 * Kancelaria — aus dem Eingetragenen.
 *
 * Die Zeilen kommen als freier Text, eine je Zeile, in der Form
 * „Poniedziałek — 9:00–11:00". Ein Formular mit sieben festen Feldern waere
 * genauer und truege die Annahme, dass jede Pfarrei die Woche gleich einteilt.
 */
function Office({ site, mayEdit }: { site: RcSite; mayEdit: boolean }) {
  const hours = lines(site, 'office.hours');
  const note = (site.content['office.note'] ?? '').trim();

  return (
    <Page title="Kancelaria">
      <article className="ps-card">
        {hours.length > 0
          ? <Lines rows={hours} />
          : (
            <p className="ps-muted">
              {mayEdit
                ? 'Godziny kancelarii nie zostały jeszcze wprowadzone — uzupełnij je w zakładce „Treść".'
                : 'Godziny kancelarii pojawią się wkrótce.'}
            </p>
          )}

        {note !== '' && <p className="ps-muted">{note}</p>}
      </article>
    </Page>
  );
}

/**
 * „O parafii" — aus dem, was in der Karte „Treść" eingetragen wurde.
 *
 * <b>Was leer ist, erscheint nicht.</b> Eine Überschrift „Historia" über einer
 * leeren Fläche sieht aus wie ein Fehler; ihr Fehlen sieht aus wie eine Seite,
 * die noch wächst. Nur wer bearbeiten darf, sieht den Hinweis, dass hier etwas
 * fehlt — der Besucher hat davon nichts.
 */
function About({
  parish, site, mayEdit
}: {
  parish: RcPublicParish;
  site: RcSite;
  mayEdit: boolean;
}) {
  const at = (key: string) => (site.content[key] ?? '').trim();

  const patron = at('about.patron');
  const history = at('about.history');
  const description = at('about.description');
  const empty = patron === '' && history === '' && description === '';

  return (
    <Page title="O parafii">
      <article className="ps-card">
        <h2>{parish.name}</h2>

        {parish.location !== null && parish.location !== undefined && parish.location !== '' && (
          <p className="ps-muted">{parish.location}</p>
        )}

        {patron !== '' && <p className="ps-lead">Patron: {patron}</p>}
        {description !== '' && <Paragraphs text={description} />}

        {history !== '' && (
          <>
            <h2>Historia</h2>
            <Paragraphs text={history} />
          </>
        )}

        {empty && (
          <p className="ps-muted">
            {mayEdit
              ? 'Opis nie został jeszcze wprowadzony — uzupełnij go w trybie edycji, w zakładce „Treść".'
              : 'Opis parafii pojawi się wkrótce.'}
          </p>
        )}
      </article>
    </Page>
  );
}

/**
 * Freier Text in Absätze.
 *
 * Leerzeilen trennen — so schreibt man in ein Textfeld, und so soll es auch
 * herauskommen. Ohne das stünde ein ganzer Lebenslauf einer Pfarrei als ein
 * einziger Block da, und niemand läse ihn.
 */
function Paragraphs({ text }: { text: string }) {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '');
  return <>{parts.map((p, i) => <p key={i}>{p}</p>)}</>;
}

/**
 * Kontakt.
 *
 * <b>Der Name kommt aus der Pfarrei, der Rest aus dem Eingetragenen.</b> Die
 * Adresse steht in beidem — beim Anlegen als Ort, hier als Postanschrift. Was
 * eingetragen wurde, gewinnt: es ist die genauere Angabe, und wer sie
 * eingetragen hat, wollte etwas anderes sagen als beim Anlegen.
 */
function Contact({
  parish, site, mayEdit
}: {
  parish: RcPublicParish;
  site: RcSite;
  mayEdit: boolean;
}) {
  const at = (key: string) => (site.content[key] ?? '').trim();

  const address = at('contact.address') !== ''
    ? at('contact.address')
    : (parish.location ?? '');

  const phone = at('contact.phone');
  const email = at('contact.email');

  return (
    <Page title="Kontakt">
      <article className="ps-card">
        <ul className="ps-rows">
          <li><span>Parafia</span><em>{parish.name}</em></li>
          {address !== '' && <li><span>Adres</span><em>{address}</em></li>}
          {phone !== '' && <li><span>Telefon</span><em>{phone}</em></li>}
          {email !== '' && <li><span>E-mail</span><em>{email}</em></li>}
        </ul>

        {phone === '' && email === '' && mayEdit && (
          <p className="ps-muted">
            Telefon i e-mail nie zostały jeszcze wprowadzone — uzupełnij je w
            zakładce „Treść".
          </p>
        )}
      </article>
    </Page>
  );
}

/**
 * Eine Sakramentenseite — aus dem Eingetragenen.
 *
 * <b>Die drei Fragen sind immer dieselben:</b> wann und wie, was mitzubringen
 * ist, an wen man sich wendet. Das ist keine Vereinfachung — es ist das, womit
 * jemand kommt, und drei Absätze Fliesstext beantworten es schlechter.
 *
 * <b>Der Titel steht im Katalog</b> und nicht im eingetragenen Text: eine
 * Unterseite, deren Überschrift sich mit dem Inhalt ändert, ist im Menü nicht
 * mehr wiederzufinden.
 */
function Sacrament({
  id, site, mayEdit
}: {
  id: string;
  site: RcSite;
  mayEdit: boolean;
}) {
  const page = rcPage(id);
  if (page === undefined) {
    return <Page title="Sakramenty"><article className="ps-card"><p>Strona w budowie.</p></article></Page>;
  }

  // Aus `sacrament-confirmation` wird `confirmation` — so heissen die Felder.
  const name = id.slice('sacrament-'.length);
  const at = (what: string) => (site.content[`sacrament.${name}.${what}`] ?? '').trim();

  const lead = at('lead');
  const bring = at('bring').split('\n').map((b) => b.trim()).filter((b) => b !== '');
  const who = at('who');
  const empty = lead === '' && bring.length === 0 && who === '';

  return (
    <Page title={page.label}>
      <article className="ps-card">
        {lead !== '' && <p className="ps-lead">{lead}</p>}

        {bring.length > 0 && (
          <>
            <h2>Co przygotować</h2>
            <ul className="ps-bullets">{bring.map((b) => <li key={b}>{b}</li>)}</ul>
          </>
        )}

        {who !== '' && <p className="ps-muted">Kontakt: {who}</p>}

        {empty && (
          <p className="ps-muted">
            {mayEdit
              ? 'Ta strona nie ma jeszcze treści — uzupełnij ją w trybie edycji, w zakładce „Treść".'
              : 'Szczegóły pojawią się wkrótce. W razie pytań prosimy o kontakt z kancelarią.'}
          </p>
        )}
      </article>
    </Page>
  );
}

/** Freier Text, eine Sache je Zeile — Leerzeilen fallen weg. */
function lines(site: RcSite, key: string): string[] {
  return (site.content[key] ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '');
}

/**
 * Zeilen der Form „Poniedziałek — 9:00–11:00".
 *
 * Der Gedankenstrich trennt die Sache von der Zeit. Fehlt er, steht die ganze
 * Zeile links — besser, als eine Zeile zu verschlucken, die jemand anders
 * gemeint hat.
 */
function Lines({ rows }: { rows: readonly string[] }) {
  return (
    <ul className="ps-rows">
      {rows.map((row, i) => {
        const cut = row.split(/s+[—–-]s+/);
        return (
          <li key={`${row}-${i}`}>
            <span>{cut[0]}</span>
            {cut.length > 1 && <em>{cut.slice(1).join(' — ')}</em>}
          </li>
        );
      })}
    </ul>
  );
}

/** Jede Unterseite trägt denselben Rahmen — Titel, dann Inhalt. */
function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="ps-title">{title}</h1>
      <div className="ps-stack">{children}</div>
    </>
  );
}

export default RcParishSite;
