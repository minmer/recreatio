import '../../styles/information-page.css';

export function InformationPage({ eventSlug }: { eventSlug: string }) {
  const quickInfo = [
    'Termin: 17–18 kwietnia 2026',
    'Start: Kraków, św. Józef (Podgórze), 15:30',
    'Trasa: Kraków – Tyniec – Kalwaria Zebrzydowska',
    'Nocleg: Tyniec',
    'Zapisy: formularz internetowy',
    'Kontakt: organizatorzy przez stronę kontaktową'
  ];

  const detailBlocks = [
    {
      title: 'Rejestracja',
      text: 'Każdy uczestnik zapisuje się przez formularz internetowy. To podstawowy krok organizacyjny i bezpieczeństwa.'
    },
    {
      title: 'Nocleg',
      text: 'Nocleg przewidziany jest w Tyńcu. Szczegółowe informacje przekazywane są osobom zapisanym.'
    },
    {
      title: 'Osoby niepełnoletnie',
      text: 'Udział osób niepełnoletnich wymaga dodatkowych ustaleń i spełnienia warunków konkretnej edycji.'
    },
    {
      title: 'Format drogi',
      text: 'Droga ma charakter dwudniowy: dzień pierwszy Kraków → Tyniec, dzień drugi Tyniec → Kalwaria Zebrzydowska.'
    },
    {
      title: 'Co zabrać',
      text: 'Wygodne obuwie, odpowiednią odzież, rzeczy osobiste i wyposażenie potrzebne na nocleg.'
    },
    {
      title: 'Charakter duchowy',
      text: 'Pielgrzymka opiera się na Tradycji, Ciszy i Liturgii. Jest spokojna, uporządkowana i skupiona na modlitwie.'
    },
    {
      title: 'Logistyka i transport',
      text: 'Przy sprzyjających warunkach organizacyjnych możliwy jest przewóz części bagażu. Zakres podawany jest przed startem.'
    },
    {
      title: 'Powrót',
      text: 'Informacje o powrocie przekazywane są uczestnikom zgodnie z organizacją danej edycji.'
    }
  ];

  const contacts = [
    {
      name: 'Ks. Michał Mleczek',
      role: 'Koordynacja duchowa',
      phone: '+48 600 000 111',
      email: 'koordynacja@kalwaria-wielkanoc.pl'
    },
    {
      name: 'Anna Nowak',
      role: 'Organizacja i logistyka',
      phone: '+48 600 000 222',
      email: 'organizacja@kalwaria-wielkanoc.pl'
    }
  ];

  return (
    <div className="kal-text-layout">
      <aside className="kal-text-sidebar">
        <p className="kal-text-breadcrumb">
          <a href="/#/">Home</a>
          <span>/</span>
          <strong>Information</strong>
        </p>
        <h1>Information</h1>
        <p>
          Najważniejsze informacje o pielgrzymce w jednym miejscu. Układ strony prowadzi od podstawowych faktów do
          szczegółów organizacyjnych.
        </p>
        <ul>
          {quickInfo.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="kal-text-actions">
          <a className="cta" href={`/#/event/${eventSlug}/register`}>Register now</a>
          <a className="ghost" href={`/#/event/${eventSlug}/plan`}>See the plan</a>
        </div>
      </aside>

      <div className="kal-text-content">
        <section className="kal-text-section kal-text-hero-visual" aria-label="Baner pielgrzymkowy" />

        <section className="kal-text-section">
          <h2>The most important information</h2>
          <div className="kal-text-list">
            {quickInfo.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="kal-text-section">
          <h2>Important details</h2>
          {detailBlocks.map((block) => (
            <div key={block.title} className="kal-text-detail">
              <h3>{block.title}</h3>
              <p>{block.text}</p>
            </div>
          ))}
        </section>

        <section className="kal-text-section kal-text-highlight">
          <h2>Every participant must register</h2>
          <p>
            Rejestracja jest obowiązkowa. Umożliwia przygotowanie grupy, komunikacji i wsparcia organizacyjnego na całej
            trasie.
          </p>
          <a className="cta" href={`/#/event/${eventSlug}/register`}>Go to registration</a>
        </section>

        <section className="kal-text-section">
          <h2>Spiritual pilgrim</h2>
          <p>
            Nie możesz uczestniczyć fizycznie? Możesz towarzyszyć duchowo, włączając się w intencje i modlitwę
            pielgrzymki.
          </p>
          <a className="ghost" href={`/#/event/${eventSlug}/contact`}>Spiritual participation</a>
        </section>

        <section className="kal-text-section">
          <h2>Contact the organizers</h2>
          <div className="kal-text-contact-grid">
            {contacts.map((person) => (
              <div key={person.email} className="kal-text-contact">
                <h3>{person.name}</h3>
                <p>{person.role}</p>
                <a href={`tel:${person.phone.replace(/\s+/g, '')}`}>{person.phone}</a>
                <a href={`mailto:${person.email}`}>{person.email}</a>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
