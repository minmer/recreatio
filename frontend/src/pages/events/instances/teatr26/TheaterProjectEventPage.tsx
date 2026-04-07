import { useMemo } from 'react';
import type { EventDefinition, EventInnerPage, SharedEventPageProps } from '../../eventTypes';
import { EventSinglePageTemplate, type EventTemplateSlide } from '../../templates/EventSinglePageTemplate';

export function TheaterProjectEventPage(
  props: SharedEventPageProps & { page: EventInnerPage; event: EventDefinition }
) {
  const slides = useMemo<EventTemplateSlide[]>(
    () => [
      {
        id: 'start',
        menuLabel: 'Start',
        title: 'Teatr Drogi 2026',
        heightMode: 'content',
        tone: 'tone-1',
        layers: [
          {
            id: 'bg',
            className: 'theater-layer theater-layer-bg theater-layer-bg-start',
            minHeightPx: 1380,
            content: (
              <div className="theater-parallax-grid">
                <span className="theater-pill">Scena</span>
                <span className="theater-pill">Ruch</span>
                <span className="theater-pill">Muzyka</span>
                <span className="theater-pill">Glos</span>
              </div>
            )
          },
          {
            id: 'type',
            className: 'theater-layer theater-layer-type',
            minHeightPx: 1520,
            content: (
              <div className="theater-type-banner" aria-hidden="true">
                <p className="theater-type-eyebrow">kolektyw sceniczny</p>
                <span className="theater-type-word">TEATR</span>
                <span className="theater-type-word theater-type-word-alt">DROGI</span>
              </div>
            )
          },
          {
            id: 'content',
            className: 'event-template-slide-content-layer theater-layer-content',
            interactive: true,
            minHeightPx: 1020,
            content: (
              <div className="event-template-slide-inner">
                <p className="event-template-kicker">Projekt 2026</p>
                <h1 className="event-template-title">Teatr Drogi 2026</h1>
                <p className="event-template-description">
                  Roczny projekt teatralny dla mlodziezy i mlodych doroslych: warsztat aktorski, muzyka, ruch
                  sceniczny i finalowy spektakl plenerowy.
                </p>
                <div className="event-template-body">
                  <p>
                    Budujemy zespol, ktory spotyka sie regularnie, cwiczy rzemioslo i tworzy autorski spektakl oparty
                    o historie, wartosci i prace wspolnotowa.
                  </p>
                  <p>
                    To format dla osob, ktore chca wejsc w proces tworczy i pracowac nad pelnym przedstawieniem od
                    pierwszej proby do premiery.
                  </p>
                </div>
                <div className="event-template-actions">
                  <a className="cta" href="/#/event/teatr26/start">Dolacz do projektu</a>
                  <a className="cta ghost" href="/#/event/teatr26/wizja">Zobacz harmonogram</a>
                </div>
              </div>
            )
          },
          {
            id: 'front',
            className: 'theater-layer theater-layer-foreground',
            minHeightPx: 1240,
            content: (
              <div className="theater-floating-note">
                <p>Premiera plenerowa: lato 2026</p>
              </div>
            )
          }
        ]
      },
      {
        id: 'wizja',
        menuLabel: 'Wizja',
        title: 'Projekt, ktory laczy formacje i scene',
        heightMode: 'content',
        tone: 'tone-2',
        layers: [
          {
            id: 'bg',
            className: 'theater-layer theater-layer-bg theater-layer-bg-wizja',
            minHeightPx: 2200,
            content: (
              <div className="theater-stripes">
                <span />
                <span />
                <span />
              </div>
            )
          },
          {
            id: 'content',
            className: 'event-template-slide-content-layer theater-layer-content',
            interactive: true,
            minHeightPx: 1880,
            content: (
              <div className="event-template-slide-inner">
                <p className="event-template-kicker">Dlaczego Teatr Drogi?</p>
                <h1 className="event-template-title">Projekt, ktory laczy formacje i scene</h1>
                <p className="event-template-description">
                  Wysoka warstwa tresci: najpierw przewijasz material wewnatrz slajdu, potem przechodzisz do
                  kolejnego.
                </p>
                <div className="event-template-body">
                  <p>
                    Teatr Drogi powstal z potrzeby stworzenia miejsca, gdzie mlodzi jednoczesnie rozwijaja warsztat
                    artystyczny i buduja odpowiedzialnosc za wspolne dzielo.
                  </p>
                  <p>
                    Pracujemy etapami: od pracy z cialem i glosem, przez improwizacje, po budowanie scen i spojnej
                    narracji. Kazdy etap konczy sie konkretna prezentacja robocza.
                  </p>
                  <p>
                    W tym projekcie kazda osoba ma realne zadanie: aktorskie, muzyczne, techniczne, scenograficzne
                    albo organizacyjne.
                  </p>
                  <p>
                    Pracujemy w rytmie tygodniowym, z dodatkowymi zjazdami intensywnymi przed premiera. Oczekujemy
                    regularnosci, punktualnosci i przygotowania.
                  </p>
                  <ul>
                    <li>Proby tygodniowe: wtorki i czwartki, 19:00-21:15.</li>
                    <li>Zjazdy intensywne: raz w miesiacu (sobota 10:00-17:00).</li>
                    <li>Final: spektakl plenerowy + dwa pokazy parafialne.</li>
                    <li>Feedback po kazdym etapie, z indywidualnymi wskazowkami.</li>
                  </ul>
                  <p>
                    Nie wymagamy wczesniejszego doswiadczenia scenicznego. Wymagamy gotowosci do uczenia sie i
                    odpowiedzialnosci za grupe.
                  </p>
                </div>
              </div>
            )
          },
          {
            id: 'front',
            className: 'theater-layer theater-layer-timeline',
            minHeightPx: 1720,
            content: (
              <div className="theater-timeline-track">
                <span>Etap 1</span>
                <span>Etap 2</span>
                <span>Etap 3</span>
                <span>Premiera</span>
              </div>
            )
          }
        ]
      },
      {
        id: 'proby',
        menuLabel: 'Proby',
        title: 'Jak wyglada tydzien pracy zespolu?',
        heightMode: 'content',
        tone: 'tone-3',
        layers: [
          {
            id: 'bg',
            className: 'theater-layer theater-layer-bg theater-layer-bg-proby',
            minHeightPx: 1260,
            content: <div className="theater-dots" />
          },
          {
            id: 'content',
            className: 'event-template-slide-content-layer theater-layer-content',
            interactive: true,
            minHeightPx: 960,
            content: (
              <div className="event-template-slide-inner">
                <p className="event-template-kicker">Rytm pracy</p>
                <h1 className="event-template-title">Jak wyglada tydzien pracy zespolu?</h1>
                <p className="event-template-description">
                  Krotszy slajd z mniejsza warstwa tresci, ale nadal z wieloma warstwami i roznymi wysokosciami.
                </p>
                <div className="event-template-body">
                  <ul>
                    <li>Wtorek: rozgrzewka, emisja glosu, praca nad scenami dialogowymi.</li>
                    <li>Czwartek: ruch sceniczny, kompozycja scen zbiorowych, rytm spektaklu.</li>
                    <li>Weekend: konsultacje techniczne w malych zespolach.</li>
                    <li>Co 4 tygodnie: pokaz roboczy i analiza nagrania.</li>
                  </ul>
                </div>
                <div className="event-template-actions">
                  <a className="cta" href="/#/event/teatr26/zespoly">Przejdz do zespolow</a>
                </div>
              </div>
            )
          },
          {
            id: 'front',
            className: 'theater-layer theater-layer-side-labels',
            minHeightPx: 1120,
            content: (
              <div className="theater-side-labels">
                <span>Wt</span>
                <span>Czw</span>
                <span>Sob</span>
              </div>
            )
          }
        ]
      },
      {
        id: 'zespoly',
        menuLabel: 'Zespoly',
        title: 'Kazdy ma role w produkcji',
        heightMode: 'content',
        tone: 'tone-4',
        layers: [
          {
            id: 'bg',
            className: 'theater-layer theater-layer-bg theater-layer-bg-zespoly',
            minHeightPx: 2080,
            content: <div className="theater-vertical-panels" />
          },
          {
            id: 'content',
            className: 'event-template-slide-content-layer theater-layer-content',
            interactive: true,
            minHeightPx: 1820,
            content: (
              <div className="event-template-slide-inner">
                <p className="event-template-kicker">Role i odpowiedzialnosc</p>
                <h1 className="event-template-title">Kazdy ma role w produkcji</h1>
                <p className="event-template-description">
                  Wysoki slajd pod dalsze rozszerzenia warstw, relacji miedzy zespolami i mapowania procesu.
                </p>
                <div className="event-template-body">
                  <p>
                    W projekcie dzialamy jak mala produkcja teatralna. Czesci zespolu sa na scenie, inne odpowiadaja za
                    warstwe techniczna i organizacyjna.
                  </p>
                  <h3>Zespol aktorski</h3>
                  <ul>
                    <li>Budowanie postaci, analiza scen, cwiczenia relacji i partnerowania.</li>
                    <li>Praca nad dykcja, nosnoscia glosu i obecnoscia sceniczna.</li>
                  </ul>
                  <h3>Zespol muzyczny</h3>
                  <ul>
                    <li>Tworzenie motywow muzycznych i oprawy przejsc miedzy scenami.</li>
                    <li>Synchronizacja z ruchem i tempem spektaklu.</li>
                  </ul>
                  <h3>Zespol scenograficzno-techniczny</h3>
                  <ul>
                    <li>Projektowanie mobilnych elementow sceny i przygotowanie przestrzeni.</li>
                    <li>Ustawienia swiatla i dzwieku oraz plan montazu i demontazu.</li>
                  </ul>
                  <h3>Zespol produkcji</h3>
                  <ul>
                    <li>Komunikacja z uczestnikami i opiekunami.</li>
                    <li>Harmonogram, obecnosci i checklisty przed pokazami.</li>
                  </ul>
                </div>
              </div>
            )
          },
          {
            id: 'front',
            className: 'theater-layer theater-layer-role-tags',
            minHeightPx: 1600,
            content: (
              <div className="theater-role-tags">
                <span>Aktorzy</span>
                <span>Muzyka</span>
                <span>Technika</span>
                <span>Produkcja</span>
              </div>
            )
          }
        ]
      },
      {
        id: 'dolacz',
        menuLabel: 'Dolacz',
        title: 'Nabor otwarty do konca wrzesnia',
        heightMode: 'content',
        tone: 'tone-5',
        layers: [
          {
            id: 'bg',
            className: 'theater-layer theater-layer-bg theater-layer-bg-dolacz',
            minHeightPx: 1320,
            content: <div className="theater-radial-burst" />
          },
          {
            id: 'content',
            className: 'event-template-slide-content-layer theater-layer-content',
            interactive: true,
            minHeightPx: 1020,
            content: (
              <div className="event-template-slide-inner">
                <p className="event-template-kicker">Rekrutacja 2026</p>
                <h1 className="event-template-title">Nabor otwarty do konca wrzesnia</h1>
                <p className="event-template-description">
                  Pierwszy etap to spotkanie organizacyjne i krotki warsztat wejsciowy. Potem przypisujemy role i
                  sciezki pracy.
                </p>
                <div className="event-template-body">
                  <p>
                    Jesli chcesz wejsc w projekt od poczatku, zapisz sie teraz. Potrzebujemy osob scenicznych oraz
                    techniczno-organizacyjnych.
                  </p>
                  <p>Start pracy zespolu: 10 pazdziernika 2026.</p>
                </div>
                <div className="event-template-actions">
                  <a className="cta" href="/#/event/teatr26/start">Formularz zgloszeniowy</a>
                  <a className="cta ghost" href="/#/event">Wroc do wydarzen</a>
                </div>
              </div>
            )
          },
          {
            id: 'front',
            className: 'theater-layer theater-layer-foreground theater-layer-foreground-cta',
            minHeightPx: 1180,
            content: (
              <div className="theater-floating-note theater-floating-note-cta">
                <p>Spotkanie startowe: 3 pazdziernika 2026</p>
              </div>
            )
          }
        ]
      }
    ],
    []
  );

  return <EventSinglePageTemplate {...props} event={props.event} slides={slides} />;
}
