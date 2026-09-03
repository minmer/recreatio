/**
 * Die öffentliche Pfarrseite — das, was jemand sieht, der `#/new/parish/…`
 * aufruft, ohne angemeldet zu sein.
 *
 * <b>Übernommen aus `pages/parish/ParishPage.tsx`</b>, und zwar der Aufbau, der
 * dort schon steht: klebende Kopfleiste mit Zeichen und Namen, zweistufiges
 * Menü mit Untermenüs, darunter der Inhalt der gewählten Seite. Die Farben und
 * Abstände kommen aus `styles/parish.css`.
 *
 * <b>Warum die Seite ohne Konto etwas zeigt.</b> Eine Pfarrseite, die nach dem
 * Passwort fragt, bevor sie den Messplan zeigt, ist keine Pfarrseite. Was
 * öffentlich ist, muss öffentlich sein — und was dahinter versiegelt liegt,
 * entscheidet das Modul, nicht diese Datei.
 *
 * <b>Die Daten sind Schaudaten</b> (`rcParishMock.ts`), und das steht auch auf
 * der Seite. Sie hier hereinzuholen ist keine Notlösung, sondern der einzige
 * Weg, an einer Seite ohne Inhalt zu erkennen, ob sie richtig ist.
 */

import { useState } from 'react';

import {
  RC_ANNOUNCEMENTS, RC_EVENTS, RC_EXCEPTIONS, RC_INTENTIONS, RC_MASSES,
  RC_MASS_TABS, RC_MASS_TAB_LABELS, RC_OFFICE_HOURS, RC_PARISH_MENU, RC_PRIESTS,
  RC_SACRAMENTS, type RcMassTab, type RcPageId
} from './rcParishMock';
import { rcPath } from '../lib/rcRoute';

export function RcParishSite({ name }: { name: string }) {
  const [page, setPage] = useState<RcPageId>('start');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (id: RcPageId) => {
    setPage(id);
    setOpenGroup(null);
    setMenuOpen(false);
  };

  return (
    <div className="ps">
      <header className="ps-head">
        <button type="button" className="ps-brand" onClick={() => go('start')}>
          <span className="ps-mark" aria-hidden="true">✝</span>
          <span className="ps-name">{name}</span>
        </button>

        <nav className={`ps-menu${menuOpen ? ' is-open' : ''}`} aria-label="Menu parafialne">
          {RC_PARISH_MENU.map((item) => {
            if (!item.children) {
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`ps-link${page === item.id ? ' is-active' : ''}`}
                  onClick={() => item.id && go(item.id)}
                >
                  {item.label}
                </button>
              );
            }

            const active = item.children.some((c) => c.id === page);
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
                    <button
                      key={child.id}
                      type="button"
                      className={`ps-sub-link${page === child.id ? ' is-active' : ''}`}
                      onClick={() => go(child.id)}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

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

      {/*
        DASS ES SCHAUDATEN SIND, STEHT AUF DER SEITE.

        Eine Seite mit erfundenen Messzeiten, die aussieht wie eine echte, ist
        eine Falle: irgendwann kommt jemand um sieben zur Kirche. Der Hinweis
        steht deshalb oben und nicht im Fuss.
      */}
      <p className="ps-mock" role="status">
        Dane pokazowe — strona w budowie. Godziny i intencje są przykładowe.
      </p>

      <main className="ps-main">
        {page === 'start' && <Start onGo={go} />}
        {page === 'announcements' && <Announcements />}
        {page === 'intentions' && <Intentions />}
        {page === 'masses' && <Masses />}
        {page === 'calendar' && <Calendar />}
        {page === 'clergy' && <Clergy />}
        {page === 'office' && <Office />}
        {page === 'about' && <About name={name} />}
        {page === 'contact' && <Contact />}
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

/*
 * Die Startseite ist die einzige, die ein RASTER hat: die anderen tragen eine
 * Sache und brauchen keins. Genau dieses Raster wird später der Modulbereich —
 * die Kacheln hier stehen an denselben Plätzen wie die Bausteine der alten
 * Seite (`one-half`, `one-third`, `two-thirds`).
 */
function Start({ onGo }: { onGo: (id: RcPageId) => void }) {
  const next = RC_INTENTIONS[0];

  return (
    <>
      <section className="ps-hero">
        <h1>Witamy w parafii</h1>
        <p>
          Msze, intencje i ogłoszenia w jednym miejscu. Kancelaria czynna od poniedziałku
          do piątku.
        </p>
      </section>

      <div className="ps-grid">
        <article className="ps-card ps-w-half">
          <h2>Najbliższe intencje</h2>
          <p className="ps-day">{next.day}</p>
          <ul className="ps-rows">
            {next.items.map((i) => (
              <li key={i.time}>
                <time>{i.time}</time>
                <span>{i.text}</span>
                <em>{i.priest}</em>
              </li>
            ))}
          </ul>
          <button type="button" className="ps-more" onClick={() => onGo('intentions')}>
            Cały tydzień
          </button>
        </article>

        <article className="ps-card ps-w-third">
          <h2>Msze w niedzielę</h2>
          <ul className="ps-rows">
            {RC_MASSES.Sunday.map((m) => (
              <li key={m.time}>
                <time>{m.time}</time>
                <span>{m.note}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="ps-more" onClick={() => onGo('masses')}>
            Pełny plan
          </button>
        </article>

        <article className="ps-card ps-w-third">
          <h2>Kancelaria</h2>
          <ul className="ps-rows">
            {RC_OFFICE_HOURS.map((o) => (
              <li key={o.day}>
                <span>{o.day}</span>
                <em>{o.hours}</em>
              </li>
            ))}
          </ul>
        </article>

        <article className="ps-card ps-w-two-thirds">
          <h2>Ogłoszenia</h2>
          <ul className="ps-news">
            {RC_ANNOUNCEMENTS.map((a) => (
              <li key={a.id}>
                <time>{a.date}</time>
                <h3>{a.title}</h3>
                <p>{a.excerpt}</p>
              </li>
            ))}
          </ul>
          <button type="button" className="ps-more" onClick={() => onGo('announcements')}>
            Wszystkie ogłoszenia
          </button>
        </article>
      </div>
    </>
  );
}

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

function Masses() {
  const [tab, setTab] = useState<RcMassTab>('Sunday');

  return (
    <Page title="Msze i nabożeństwa">
      <div className="ps-tabs" role="tablist">
        {RC_MASS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`ps-tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {RC_MASS_TAB_LABELS[t]}
          </button>
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

      {/* Die Ausnahmen sind der Grund, warum jemand den Plan überhaupt liest. */}
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
        <p className="ps-muted">
          W sprawach pogrzebu prosimy o kontakt o każdej porze.
        </p>
      </article>
    </Page>
  );
}

function About({ name }: { name: string }) {
  return (
    <Page title={`O parafii ${name}`}>
      <article className="ps-card">
        <p>
          Parafia obejmuje swoim zasięgiem część miasta i kilka okolicznych ulic.
          Kościół parafialny jest otwarty codziennie od 6:30 do wieczornej Mszy.
        </p>
        <p className="ps-muted">Ten opis jest przykładowy.</p>
      </article>
    </Page>
  );
}

function Contact() {
  return (
    <Page title="Kontakt">
      <article className="ps-card">
        <ul className="ps-rows">
          <li><span>Adres</span><em>ul. Żuławskiego 3E, 34-600 Limanowa</em></li>
          <li><span>Kancelaria</span><em>zob. godziny dyżurów</em></li>
        </ul>
      </article>
    </Page>
  );
}

function Sacrament({ id }: { id: string }) {
  const s = RC_SACRAMENTS[id];
  if (!s) return <Page title="Sakramenty"><article className="ps-card"><p>Strona w budowie.</p></article></Page>;

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
