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
  RC_MASS_TABS, RC_MASS_TAB_LABELS, RC_OFFICE_HOURS, RC_PARISH_MENU, RC_PRIESTS,
  RC_SACRAMENTS, type RcMassTab, type RcPageId
} from './rcParishMock';
import { rcPublicParish, type RcPublicParish } from './rcPublicParish';
import { rcMayAdminArea } from './rcParishRights';
import { rcPath } from '../lib/rcRoute';
import { RcParishBuilder } from './RcParishBuilder';
import { rcSaveParishSite } from '../lib/rcParish';
import { RcParishHome } from './RcParishHome';
import { RC_EMPTY_SITE, rcReadSite, type RcSite } from './rcSite';

export function RcParishSite({
  slug, page, sub, signedIn, onSignIn
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
  onSignIn: () => void;
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

          {!signedIn && (
            <button type="button" className="ps-signin" onClick={onSignIn}>
              Zaloguj się
            </button>
          )}
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
            <RcParishBuilder site={site} onChange={(next) => { setSite(next); setSaving('idle'); }} />
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
        {page === 'office' && <Office />}
        {page === 'about' && <About parish={parish} />}
        {page === 'contact' && <Contact parish={parish} />}
        {page.startsWith('sacrament-') && <Sacrament id={page} />}
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

function Office() {
  return (
    <Page title="Kancelaria">
      <article className="ps-card">
        <ul className="ps-rows">
          {RC_OFFICE_HOURS.map((o) => (
            <li key={o.day}>
              <span>{o.day}</span>
              <em>{o.hours}</em>
            </li>
          ))}
        </ul>
        <p className="ps-muted">W sprawach pogrzebu prosimy o kontakt o każdej porze.</p>
      </article>
    </Page>
  );
}

function About({ parish }: { parish: RcPublicParish }) {
  return (
    <Page title={`O parafii`}>
      <article className="ps-card">
        <h2>{parish.name}</h2>
        {parish.location !== null && parish.location !== undefined && parish.location !== '' && (
          <p className="ps-muted">{parish.location}</p>
        )}
        <p>
          Opis parafii nie został jeszcze wprowadzony. Można go dodać w trybie
          edycji.
        </p>
      </article>
    </Page>
  );
}

function Contact({ parish }: { parish: RcPublicParish }) {
  return (
    <Page title="Kontakt">
      <article className="ps-card">
        <ul className="ps-rows">
          <li><span>Parafia</span><em>{parish.name}</em></li>
          {parish.location !== null && parish.location !== undefined && parish.location !== '' && (
            <li><span>Adres</span><em>{parish.location}</em></li>
          )}
          <li><span>Kancelaria</span><em>zob. godziny dyżurów</em></li>
        </ul>
      </article>
    </Page>
  );
}

function Sacrament({ id }: { id: string }) {
  const s = RC_SACRAMENTS[id];
  if (!s) {
    return <Page title="Sakramenty"><article className="ps-card"><p>Strona w budowie.</p></article></Page>;
  }

  return (
    <Page title={s.title}>
      <article className="ps-card">
        <p className="ps-lead">{s.lead}</p>
        <h2>Co przygotować</h2>
        <ul className="ps-bullets">
          {s.bring.map((b) => <li key={b}>{b}</li>)}
        </ul>
        <p className="ps-muted">Kontakt: {s.who}</p>
      </article>
    </Page>
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
