import type { Copy } from './types';

export const en: Copy = {
  nav: {
    home: 'Home',
    parish: 'Parish',
    cogita: 'Cogita',
    faq: 'FAQ',
    legal: 'Legal',
    login: 'Sign in',
    account: 'Profile'
  },
  hero: {
    headline: 'ReCreatio — trust and knowledge infrastructure for communities.',
    subtitle:
      'We connect education, parishes, and communities in one ecosystem where access is enforced cryptographically, not just by passwords.',
    ctaPrimary: 'Access the system',
    ctaSecondary: 'Explore portals'
  },
  modules: {
    title: 'Public portals and upcoming modules',
    items: [
      {
        title: 'Parish',
        desc: 'Intentions, announcements, calendar, and offerings — public and secure.',
        tag: 'public',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Knowledge space for quizzes and co-created learning content.',
        tag: 'public',
        route: 'cogita'
      },
      {
        title: 'User area',
        desc: 'Profile settings, roles, access keys, and activity history.',
        tag: 'soon',
        route: 'account'
      }
    ]
  },
  access: {
    title: 'Access ReCreatio',
    subtitle: 'Login unlocks management features. Public portals remain available without an account.',
    login: 'Sign in',
    register: 'Register',
    loginId: 'Login ID (email or username)',
    password: 'Password',
    confirm: 'Confirm password',
    displayName: 'Full name (optional)',
    secureMode: 'Secure mode (no key cache)',
    create: 'Create account',
    signIn: 'Sign in',
    statusTitle: 'Status',
    statusReady: 'Ready.',
    loginRequired: 'Login ID and password are required.',
    loginError: 'Login failed.',
    registerError: 'Registration failed.',
    loginTaken: 'Login ID is already in use.',
    passwordMismatch: 'Passwords do not match.',
    loadingLogin: 'Signing in…',
    loadingRegister: 'Registering…',
    sessionLabel: 'Session',
    checkSession: 'Check session',
    toggleMode: 'Toggle mode',
    logout: 'Logout'
  },
  dashboard: {
    title: 'Post-login dashboard',
    subtitle: 'This will become the control center with shortcuts, guidance, and security info.',
    cards: [
      {
        title: 'Profile settings',
        desc: 'Coming soon: personal data, roles, and account security.',
        action: 'Open (soon)',
        route: 'account'
      },
      {
        title: 'Parish',
        desc: 'Enter intentions, announcements, and administration tools.',
        action: 'Open portal',
        route: 'parish'
      },
      {
        title: 'Cogita',
        desc: 'Go to knowledge, quizzes, and educational content.',
        action: 'Open portal',
        route: 'cogita'
      }
    ]
  },
  parish: {
    title: 'Parish portal',
    subtitle:
      'Public information is available without login. Accounts are required for editing, finance, and role management.',
    items: [
      'Intentions and offerings with audit trails.',
      'Announcements and parish calendar.',
      'Public summaries with private financial details protected.'
    ],
    note: 'You can browse public content now. Admin features appear after login.',
    loginCta: 'Sign in via ReCreatio'
  },
  cogita: {
    title: 'Cogita portal',
    subtitle:
      'Knowledge and collaboration space. Public access to resources; account required for creation and editing.',
    items: [
      'Live quizzes and interactive sessions.',
      'Knowledge library and teaching tools.',
      'Controlled sharing of resources.'
    ],
    note: 'Cogita can also run under a separate domain, e.g. cogita.pl, while still using ReCreatio backend.',
    loginCta: 'Sign in via ReCreatio'
  },
  faq: {
    title: 'FAQ and security',
    items: [
      {
        q: 'Is my data encrypted?',
        a: 'Yes. Data is encrypted with keys derived from user roles. Without keys, there is no access.'
      },
      {
        q: 'Does the server know my password?',
        a: 'No. The password is transformed locally and the server stores only a verifier.'
      },
      {
        q: 'Can I use it without an account?',
        a: 'Yes. Public portals (Parish and Cogita) provide open information without login.'
      }
    ]
  },
  legal: {
    title: 'Privacy, terms, and transparency',
    items: [
      {
        title: 'Privacy (GDPR)',
        desc:
          'Data controller: Parafia Rzymskokatolicka pw. św. Jana Chrzciciela w Krakowie, ul. Dobrego Pasterza 117, 31-416 Kraków, Poland, NIP 9451520798, REGON 040098025, email: parafia@janchrzciciel.eu, phone +48 12 412 58 50.'
      },
      {
        title: 'Terms of use',
        desc: 'Rules for using the platform, administrator roles, and responsibilities.'
      },
      {
        title: 'Imprint',
        desc:
          'Technical contact: ks. Michael Mleczek, mleczek_pradnik@outlook.com. Hosting: Webio (Hosting Webio), ul. Gwiaździsta 8/52, 66-400 Gorzów Wielkopolski, Poland, NIP 5992688099, REGON 080265578, email: sprzedaz@webio.pl.'
      },
      {
        title: 'Data Protection Officer',
        desc:
          'DPO: rodo@diecezja.krakow.pl, phone +48 12 628 81 00, ul. Franciszkańska 3, 31-004 Kraków, Poland.'
      },
      {
        title: 'Supervisory authority',
        desc:
          'Kościelny Inspektor Ochrony Danych (KIOD), Skwer kard. Stefana Wyszyńskiego 6, 01–015 Warszawa, email: kiod@episkopat.pl.'
      }
    ]
  },
  account: {
    title: 'Profile settings',
    subtitle: 'Available after login.',
    placeholder: 'Coming soon: personal data, roles, keys, and activity history.'
  },
  footer: {
    headline: 'ReCreatio — shared ecosystem of trust and knowledge',
    contact: 'Contact: kontakt@recreatio.pl',
    imprint: 'Imprint & privacy',
    security: 'Security documentation'
  },
  loginCard: {
    title: 'ReCreatio',
    contextDefault: 'Access via ReCreatio'
  }
};
