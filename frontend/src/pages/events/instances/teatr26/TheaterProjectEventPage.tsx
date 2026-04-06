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
        kicker: 'Projekt 2026',
        title: 'Teatr Drogi 2026',
        description:
          'Roczny projekt teatralny dla młodzieży i młodych dorosłych: warsztat aktorski, muzyka, ruch sceniczny i finałowy spektakl plenerowy.',
        body: (
          <>
            <p>
              Budujemy zespół, który spotyka się regularnie, ćwiczy rzemiosło i tworzy autorski spektakl oparty o historię,
              wartości i pracę wspólnotową.
            </p>
            <p>
              To format dla osób, które chcą realnie wejść w proces twórczy, a nie tylko pojawić się na pojedynczym występie.
            </p>
          </>
        ),
        actions: [
          { label: 'Dołącz do projektu', href: '/#/event/teatr26/start' },
          { label: 'Zobacz harmonogram', targetSlideId: 'wizja', variant: 'ghost' }
        ],
        heightMode: 'screen',
        tone: 'tone-1'
      },
      {
        id: 'wizja',
        menuLabel: 'Wizja',
        kicker: 'Dlaczego Teatr Drogi?',
        title: 'Projekt, który łączy formację i scenę',
        description:
          'Ten slajd ma większą treść celowo: pokazuje zachowanie dłuższej sekcji, w której przewijasz zawartość w ramach jednego slajdu, zanim nastąpi snap do kolejnego.',
        body: (
          <>
            <p>
              Teatr Drogi powstał z potrzeby stworzenia miejsca, gdzie młodzi mogą jednocześnie rozwijać warsztat artystyczny
              i budować odpowiedzialność za wspólne dzieło. Nie interesuje nas szybki efekt bez procesu. Interesuje nas
              dojrzewanie przez pracę.
            </p>
            <p>
              Dlatego pracujemy etapami: od pracy z ciałem i głosem, przez improwizację, po budowanie scen i spójnej narracji.
              Każdy etap kończy się konkretną prezentacją roboczą dla zespołu i mentorów.
            </p>
            <p>
              W tym projekcie nie ma widzów wewnątrz zespołu. Każda osoba ma realne zadanie: aktorskie, muzyczne,
              techniczne, scenograficzne albo organizacyjne. Dzięki temu finalny spektakl jest wspólną odpowiedzialnością,
              a nie występem kilku osób.
            </p>
            <p>
              Pracujemy w rytmie tygodniowym, z dodatkowymi zjazdami intensywnymi przed premierą. Oczekujemy regularności,
              punktualności i gotowości do pracy domowej: krótkich ćwiczeń tekstowych, oddechowych i ruchowych.
            </p>
            <ul>
              <li>Próby tygodniowe: wtorki i czwartki, 19:00-21:15.</li>
              <li>Zjazdy intensywne: raz w miesiącu (sobota 10:00-17:00).</li>
              <li>Finał: spektakl plenerowy + dwa pokazy parafialne.</li>
              <li>Feedback po każdym etapie, z indywidualnymi wskazówkami.</li>
            </ul>
            <p>
              Nie wymagamy wcześniejszego doświadczenia scenicznego. Wymagamy gotowości do uczenia się, przyjmowania
              informacji zwrotnej i odpowiedzialności za grupę.
            </p>
          </>
        ),
        heightMode: 'content',
        tone: 'tone-2'
      },
      {
        id: 'proby',
        menuLabel: 'Próby',
        kicker: 'Rytm pracy',
        title: 'Jak wygląda tydzień pracy zespołu?',
        description:
          'Krótszy slajd: szybki przegląd najważniejszych punktów procesu prób i przygotowań.',
        body: (
          <ul>
            <li>Wtorek: rozgrzewka, emisja głosu, praca nad scenami dialogowymi.</li>
            <li>Czwartek: blok ruchowy, kompozycja scen zbiorowych, tempo i rytm spektaklu.</li>
            <li>Weekend: konsultacje techniczne (światło, dźwięk, scenografia) w małych zespołach.</li>
            <li>Co 4 tygodnie: pokaz roboczy i analiza nagrania.</li>
          </ul>
        ),
        actions: [{ label: 'Przejdź do zespołów', targetSlideId: 'zespoly' }],
        heightMode: 'screen',
        tone: 'tone-3'
      },
      {
        id: 'zespoly',
        menuLabel: 'Zespoły',
        kicker: 'Role i odpowiedzialność',
        title: 'Każdy ma rolę w produkcji',
        description:
          'Drugi wysoki slajd: pokaz pracy w warstwach i podzespołach, gotowy pod kolejne rozszerzenia.',
        body: (
          <>
            <p>
              W projekcie działamy jak realna mała produkcja teatralna. Część osób stoi na scenie, część odpowiada za
              warstwę techniczną i organizacyjną, ale wszyscy uczestniczą w rytmie prób i wspólnym planowaniu.
            </p>
            <h3>Zespół aktorski</h3>
            <ul>
              <li>Budowanie postaci, analiza scen, ćwiczenia relacji i partnerowania.</li>
              <li>Praca nad dykcją, nośnością głosu i obecnością sceniczną.</li>
              <li>Stała współpraca z zespołem muzycznym i ruchem.</li>
            </ul>
            <h3>Zespół muzyczny</h3>
            <ul>
              <li>Tworzenie motywów muzycznych i oprawy przejść między scenami.</li>
              <li>Synchronizacja z ruchem i tempem spektaklu.</li>
              <li>Próby sekcyjne + próby łączone z aktorami.</li>
            </ul>
            <h3>Zespół scenograficzno-techniczny</h3>
            <ul>
              <li>Projektowanie prostych, mobilnych elementów sceny.</li>
              <li>Ustawienia światła i dźwięku dla przestrzeni plenerowej.</li>
              <li>Plan montażu i demontażu, bezpieczeństwo i logistyka.</li>
            </ul>
            <h3>Zespół produkcji</h3>
            <ul>
              <li>Komunikacja z uczestnikami i opiekunami.</li>
              <li>Harmonogram, obecności, checklisty przed pokazami.</li>
              <li>Koordynacja promocji i dokumentacji projektu.</li>
            </ul>
          </>
        ),
        heightMode: 'content',
        tone: 'tone-4'
      },
      {
        id: 'dolacz',
        menuLabel: 'Dołącz',
        kicker: 'Rekrutacja 2026',
        title: 'Nabór otwarty do końca września',
        description:
          'Pierwszy etap to spotkanie organizacyjne i krótki warsztat wejściowy. Po nim przypisujemy role i ścieżki pracy.',
        body: (
          <>
            <p>
              Jeśli chcesz wejść w projekt od początku, zapisz się teraz. Potrzebujemy zarówno osób scenicznych,
              jak i techniczno-organizacyjnych.
            </p>
            <p>Start pracy zespołu: 10 października 2026.</p>
          </>
        ),
        actions: [
          { label: 'Formularz zgłoszeniowy', href: '/#/event/teatr26/start' },
          { label: 'Wróć do wydarzeń', href: '/#/event', variant: 'ghost' }
        ],
        heightMode: 'screen',
        tone: 'tone-5'
      }
    ],
    []
  );

  return <EventSinglePageTemplate {...props} event={props.event} slides={slides} />;
}
