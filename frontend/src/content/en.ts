import type { Copy } from './types';

export const en: Copy = {
  nav: {
    home: 'Home',
    parish: 'Parish',
    cogita: 'Cogita',
    faq: 'FAQ',
    legal: 'Privacy & Terms',
    login: 'Sign in',
    account: 'Profile'
  },
  accountMenu: {
    profile: 'User settings',
    secureModeOn: 'Enable secure mode',
    secureModeOff: 'Disable secure mode',
    logout: 'Sign out'
  },
  hero: {
    headline: 'REcreatio — trust and knowledge infrastructure for communities.',
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
    title: 'Access REcreatio',
    subtitle: 'Login unlocks management features. Public portals remain available without an account.',
    login: 'Sign in',
    register: 'Register',
    loginId: 'Login ID (username or email)',
    password: 'Password',
    confirm: 'Confirm password',
    displayName: 'Public nickname (optional)',
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
    passwordTooShort: 'Use at least 8 characters.',
    passwordCommon: 'That password is too common.',
    passwordWeak: 'Use a mix of upper, lower, number, and symbol.',
    passwordStrong: 'Strong password.',
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
    loginCta: 'Sign in via REcreatio'
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
    note: 'Cogita can also run under a separate domain, e.g. cogita.pl, while still using REcreatio backend.',
    loginCta: 'Sign in via REcreatio'
  },
  faq: {
    title: 'FAQ and security',
    items: [
      {
        q: 'Is my data encrypted?',
        a: 'Yes. Data is encrypted with keys derived from user roles.\nWithout keys, there is no access, even for administrators.'
      },
      {
        q: 'Does the server know my password?',
        a: 'No. The password is transformed locally and the server stores only a verifier.\nThe database never stores H1/H2/H3, only the H4 verifier.'
      },
      {
        q: 'Can I use it without an account?',
        a: 'Yes. Public portals (Parish and Cogita) provide open information without login.'
      },
      {
        q: 'What is secure mode?',
        a: 'Secure mode disables the session secret cache.\nKeys are reconstructed per request and discarded immediately.'
      },
      {
        q: 'Is there a classic password reset?',
        a: 'No. Account recovery requires a multi-party procedure and audit trail.\nThis prevents silent resets by third parties.'
      },
      {
        q: 'What are account states?',
        a: 'Accounts can be Pending, Active, Locked, Disabled, or Deleted.\nState transitions are recorded in the Auth Ledger.'
      },
      {
        q: 'What happens after login?',
        a: 'A SessionId and access token are issued.\nTokens never contain encryption keys or sensitive payloads.'
      },
      {
        q: 'Are changes audited?',
        a: 'Yes. Key events are recorded in the Auth Ledger.\nThis provides traceability and accountability.'
      }
    ]
  },
  legal: {
    title: 'Privacy, terms, and transparency',
    items: [
      {
        title: 'Privacy (GDPR)',
        desc:
          'Data controller: Parafia Rzymskokatolicka pw. św. Jana Chrzciciela w Krakowie.\nAddress: ul. Dobrego Pasterza 117, 31-416 Kraków, Poland.\nNIP 9451520798, REGON 040098025.\nContact: parafia@janchrzciciel.eu, phone +48 12 412 58 50.'
      },
      {
        title: 'Purposes and legal basis',
        desc:
          'Purposes: account management, public portals, communication, security, and audits.\nLegal basis: consent, service delivery, legitimate interests, and legal obligations.'
      },
      {
        title: 'Data categories',
        desc:
          'Identification: login, email, name (if provided).\nTechnical: session identifiers, device info, security logs.\nPortal content: data shared voluntarily by users.'
      },
      {
        title: 'Recipients and processors',
        desc:
          'Hosting and infrastructure: Webio (Hosting Webio).\nIT support only as necessary for service delivery.\nData is not sold.'
      },
      {
        title: 'Security measures',
        desc:
          'Encryption at rest, role-based access control, audit logs, and restricted admin access.\nContinuous monitoring and security event logging.'
      },
      {
        title: 'Terms of use',
        desc: 'Rules for using the platform, administrator roles, and user responsibilities.\nProhibition of abuse and unlawful activity.'
      },
      {
        title: 'Imprint',
        desc:
          'Technical contact: ks. Michael Mleczek, mleczek_pradnik@outlook.com.\nHosting: Webio (Hosting Webio), ul. Gwiaździsta 8/52, 66-400 Gorzów Wielkopolski, Poland.\nNIP 5992688099, REGON 080265578, email: sprzedaz@webio.pl.'
      },
      {
        title: 'Retention',
        desc:
          'Account data is stored for the lifetime of the account and as required by law.\nSecurity and audit logs may be retained longer for compliance and safety.'
      },
      {
        title: 'Data transfers',
        desc:
          'Data is not transferred outside the European Economic Area.\nNo automated decision-making or profiling is used.'
      },
      {
        title: 'Data Protection Officer',
        desc:
          'DPO: rodo@diecezja.krakow.pl, phone +48 12 628 81 00.\nAddress: ul. Franciszkańska 3, 31-004 Kraków, Poland.'
      },
      {
        title: 'Supervisory authority',
        desc:
          'Kościelny Inspektor Ochrony Danych (KIOD).\nAddress: Skwer kard. Stefana Wyszyńskiego 6, 01–015 Warszawa.\nEmail: kiod@episkopat.pl.'
      },
      {
        title: 'Your rights',
        desc:
          'Right of access, rectification, erasure, restriction, and data portability.\nRight to object and lodge a complaint with the supervisory authority.'
      }
    ]
  },
  account: {
    title: 'User settings',
    subtitle: 'Manage your public profile and security.',
    overviewTitle: 'Overview',
    overviewLead: 'Your login does not have to be an email. The nickname is public.',
    sections: {
      overview: 'Overview',
      profile: 'Public profile',
      persons: 'Persons',
      security: 'Security'
    },
    menuLabel: 'Sections',
    loginIdLabel: 'Login ID',
    loginIdHint: 'This identifier can be a username or email and cannot be changed.',
    nicknameLabel: 'Public nickname',
    nicknameHint: 'Visible to other users. Avoid private data.',
    nicknamePlaceholder: 'Choose a public nickname',
    nicknameToggle: 'Edit nickname',
    nicknameAction: 'Save nickname',
    nicknameWorking: 'Saving nickname…',
    nicknameSuccess: 'Nickname updated.',
    nicknameError: 'Nickname update failed.',
    passwordTitle: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    passwordToggle: 'Change password',
    passwordAction: 'Update password',
    passwordWorking: 'Updating password…',
    passwordSuccess: 'Password updated.',
    passwordError: 'Password update failed.',
    secureModeTitle: 'Secure mode',
    secureModeNote: 'Secure mode disables key cache on the server.',
    secureModeEnable: 'Enable secure mode',
    secureModeDisable: 'Disable secure mode',
    logoutAction: 'Sign out',
    persons: {
      lead: 'Create person roles for the people using this account. Each person has separate encrypted fields and an access list.',
      addToggle: 'Add person',
      nameLabel: 'Name',
      namePlaceholder: 'Name or label',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'Relationship or role note',
      createAction: 'Create person',
      createWorking: 'Creating person…',
      createSuccess: 'Person created.',
      createError: 'Person creation failed.',
      createMissing: 'Name and description are required.',
      loading: 'Loading persons…',
      empty: 'No persons yet.',
      missingField: 'Missing data',
      encryptedPlaceholder: 'Encrypted value',
      editToggle: 'Edit details',
      editAction: 'Save details',
      editCancel: 'Cancel',
      editWorking: 'Saving details…',
      editSuccess: 'Person updated.',
      editError: 'Person update failed.',
      accessToggle: 'Access',
      accessTitle: 'Access list',
      accessRefresh: 'Refresh',
      accessLoading: 'Loading access list…',
      accessError: 'Access list unavailable.',
      accessEmpty: 'No members yet.',
      memberTitle: 'Add member',
      memberLoginLabel: 'User login',
      memberLoginPlaceholder: 'Enter login ID',
      memberKeyLabel: 'Encrypted role key (Base64)',
      memberKeyPlaceholder: 'Paste encrypted role key copy',
      memberTypeLabel: 'Access role',
      memberAction: 'Add access',
      memberWorking: 'Adding member…',
      memberSuccess: 'Member added.',
      memberError: 'Member add failed.',
      memberMissing: 'Login ID and encrypted role key are required.',
      memberRolesLabel: 'Other roles',
      memberRolesEmpty: 'No roles',
      roleOwner: 'Owner',
      roleRead: 'Read',
      roleWrite: 'Write',
      roleRecovery: 'Recovery'
    }
  },
  footer: {
    headline: 'REcreatio — shared ecosystem of trust and knowledge',
    contact: 'Contact: kontakt@recreatio.pl',
    imprint: 'Imprint & privacy',
    security: 'Security documentation'
  },
  loginCard: {
    title: 'REcreatio',
    contextDefault: 'Access via REcreatio'
  }
};
