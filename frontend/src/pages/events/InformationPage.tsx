import { useMemo, useState } from 'react';
import '../../styles/information-page.css';

type NavItem = {
  id: 'information' | 'plan' | 'register' | 'faq' | 'history' | 'gallery' | 'contact';
  label: string;
  href: string;
};

type HeaderProps = {
  navItems: NavItem[];
  activeId: NavItem['id'];
  homeHref: string;
};

function Header({ navItems, activeId, homeHref }: HeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="info-page-header" aria-label="Górna nawigacja strony informacji">
      <div className="info-page-shell info-page-header-inner">
        <a className="info-page-logo" href={homeHref} aria-label="Przejdź do strony głównej pielgrzymki">
          Kalwaria Wielkanoc
        </a>

        <button
          type="button"
          className="info-page-menu-toggle"
          aria-label={open ? 'Zamknij menu nawigacji' : 'Otwórz menu nawigacji'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`info-page-nav ${open ? 'is-open' : ''}`} aria-label="Nawigacja sekcji pielgrzymki">
          {navItems.map((item) => (
            <a key={item.id} href={item.href} className={item.id === activeId ? 'is-active' : ''} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Breadcrumb() {
  return (
    <div className="info-page-breadcrumb-wrap" aria-label="Okruszki strony">
      <div className="info-page-shell">
        <p className="info-page-breadcrumb">
          <a href="/#/">Home</a>
          <span>/</span>
          <strong>Information</strong>
        </p>
      </div>
    </div>
  );
}

type HeroProps = {
  onRegisterHref: string;
  onPlanHref: string;
};

function Hero({ onRegisterHref, onPlanHref }: HeroProps) {
  return (
    <section className="info-page-hero">
      <div className="info-page-shell info-page-hero-grid">
        <div>
          <p className="info-page-kicker">Pilgrimage · Prayer · Tradition</p>
          <h1>Information</h1>
          <p className="info-page-subtitle">
            Najważniejsze informacje o pieszej pielgrzymce do Kalwarii Zebrzydowskiej. Strona zaprojektowana tak, aby
            szybko znaleźć terminy, zasady uczestnictwa i organizację drogi.
          </p>
          <div className="info-page-hero-cta">
            <a className="btn btn-primary" href={onRegisterHref}>Register now</a>
            <a className="btn btn-secondary" href={onPlanHref}>See the plan</a>
          </div>
        </div>
        <aside className="info-page-hero-photo" role="img" aria-label="Pielgrzymi w drodze i krajobraz sanktuarium" />
      </div>
    </section>
  );
}

type InfoCardProps = {
  label: string;
  value: string;
};

function InfoCard({ label, value }: InfoCardProps) {
  return (
    <article className="info-card">
      <h3>{label}</h3>
      <p>{value}</p>
    </article>
  );
}

type DetailBlockProps = {
  icon: string;
  title: string;
  text: string;
};

function DetailBlock({ icon, title, text }: DetailBlockProps) {
  return (
    <article className="detail-block">
      <span aria-hidden="true">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

type CTASectionProps = {
  title: string;
  text: string;
  ctaLabel: string;
  ctaHref: string;
};

function CTASection({ title, text, ctaLabel, ctaHref }: CTASectionProps) {
  return (
    <section className="info-page-highlight">
      <div className="info-page-shell info-page-highlight-inner">
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <a className="btn btn-primary" href={ctaHref}>{ctaLabel}</a>
      </div>
    </section>
  );
}

type ContactCardProps = {
  name: string;
  role: string;
  phone: string;
  email: string;
};

function ContactCard({ name, role, phone, email }: ContactCardProps) {
  return (
    <article className="contact-card">
      <h3>{name}</h3>
      <p className="contact-role">{role}</p>
      <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
      <a href={`mailto:${email}`}>{email}</a>
    </article>
  );
}

type FooterProps = {
  navItems: NavItem[];
};

function Footer({ navItems }: FooterProps) {
  return (
    <footer className="info-page-footer">
      <div className="info-page-shell">
        <nav className="info-page-footer-nav" aria-label="Nawigacja stopki">
          {navItems.map((item) => (
            <a key={item.id} href={item.href}>{item.label}</a>
          ))}
        </nav>
        <p className="info-page-footer-note">© 2026 Kalwaria Wielkanoc · Organizatorzy pielgrzymki</p>
        <p className="info-page-footer-links">
          <a href="/#/legal">Privacy policy</a>
          <a href="/#/legal">Cookies</a>
        </p>
      </div>
    </footer>
  );
}

export function InformationPage({ eventSlug }: { eventSlug: string }) {
  const navItems: NavItem[] = useMemo(
    () => [
      { id: 'information', label: 'Information', href: `/#/event/${eventSlug}/information` },
      { id: 'plan', label: 'Plan', href: `/#/event/${eventSlug}/plan` },
      { id: 'register', label: 'Register', href: `/#/event/${eventSlug}/register` },
      { id: 'faq', label: 'FAQ', href: `/#/event/${eventSlug}/faq` },
      { id: 'history', label: 'History', href: `/#/event/${eventSlug}/history` },
      { id: 'gallery', label: 'Gallery', href: `/#/event/${eventSlug}/gallery` },
      { id: 'contact', label: 'Contact', href: `/#/event/${eventSlug}/contact` }
    ],
    [eventSlug]
  );

  const keyFacts = [
    { label: 'Date', value: '17–18 April 2026' },
    { label: 'Start location', value: 'Kraków, św. Józef (Podgórze), Friday 15:30' },
    { label: 'Destination', value: 'Kalwaria Zebrzydowska' },
    { label: 'Overnight stay', value: 'Tyniec' },
    { label: 'Registration', value: 'Online form with participant zone access' },
    { label: 'Who it is for', value: 'People seeking prayer, silence, and tradition' },
    { label: 'Luggage support', value: 'Limited support depending on logistics' },
    { label: 'Contact/help', value: 'Organizers available via contact page and phone' }
  ];

  const details = [
    {
      icon: '📝',
      title: 'Registration',
      text: 'Każdy uczestnik zapisuje się przez formularz internetowy. Dane organizacyjne trafiają później do strefy uczestnika.'
    },
    {
      icon: '🛏️',
      title: 'Overnight stay',
      text: 'Nocleg odbywa się w Tyńcu. Szczegóły dotyczące wyposażenia i warunków przekazywane są po zapisie.'
    },
    {
      icon: '👨‍👩‍👧',
      title: 'Minors',
      text: 'Udział osób niepełnoletnich wymaga wcześniejszych ustaleń z organizatorami i spełnienia warunków edycji.'
    },
    {
      icon: '🥾',
      title: 'Route format',
      text: 'Pielgrzymka ma formę dwudniowej drogi: dzień 1 Kraków → Tyniec, dzień 2 Tyniec → Kalwaria Zebrzydowska.'
    },
    {
      icon: '🎒',
      title: 'What to bring',
      text: 'Wygodne buty, odzież na zmienną pogodę, rzeczy osobiste oraz wyposażenie noclegowe.'
    },
    {
      icon: '⛪',
      title: 'Spiritual character',
      text: 'Droga oparta jest na Tradycji, Ciszy i Liturgii. Obejmuje modlitwę wspólną, śpiew i czas na milczenie.'
    },
    {
      icon: '🚐',
      title: 'Transport/logistics',
      text: 'W miarę możliwości organizacyjnych planowany jest przewóz części bagażu. Zakres potwierdzany jest przed startem.'
    },
    {
      icon: '↩️',
      title: 'Return journey',
      text: 'Informacje o powrocie przekazywane są uczestnikom w aktualnej edycji i zależą od ustaleń organizacyjnych.'
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
    <div className="info-page-root">
      <Header navItems={navItems} activeId="information" homeHref={`/#/event/${eventSlug}/start`} />
      <Breadcrumb />
      <main>
        <Hero onRegisterHref={`/#/event/${eventSlug}/register`} onPlanHref={`/#/event/${eventSlug}/plan`} />

        <section className="info-page-section">
          <div className="info-page-shell">
            <h2>The most important information</h2>
            <div className="info-grid">
              {keyFacts.map((fact) => (
                <InfoCard key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </div>
          </div>
        </section>

        <section className="info-page-section info-page-section-alt">
          <div className="info-page-shell">
            <h2>Important details</h2>
            <div className="detail-stack">
              {details.map((item) => (
                <DetailBlock key={item.title} icon={item.icon} title={item.title} text={item.text} />
              ))}
            </div>
          </div>
        </section>

        <CTASection
          title="Every participant must register"
          text="Aby zachować bezpieczeństwo i sprawną organizację drogi, każdy uczestnik musi przejść rejestrację przed startem."
          ctaLabel="Go to registration"
          ctaHref={`/#/event/${eventSlug}/register`}
        />

        <section className="info-page-section">
          <div className="info-page-shell spiritual-block">
            <h2>Cannot join physically?</h2>
            <p>
              Możesz dołączyć duchowo: ofiarować modlitwę, uczestniczyć w intencjach pielgrzymki i towarzyszyć nam na
              odległość.
            </p>
            <a className="btn btn-secondary" href={`/#/event/${eventSlug}/contact`}>Spiritual pilgrim options</a>
          </div>
        </section>

        <section className="info-page-section info-page-section-alt">
          <div className="info-page-shell">
            <h2>Contact the organizers</h2>
            <div className="contact-grid">
              {contacts.map((person) => (
                <ContactCard key={person.email} {...person} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer navItems={navItems} />
    </div>
  );
}
