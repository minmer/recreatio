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
    loginCta: 'Sign in via REcreatio',
    page: {
      nav: [
        { id: 'home', label: 'Home' },
        { id: 'library', label: 'Library' },
        { id: 'live', label: 'Live' },
        { id: 'participation', label: 'Participation' },
        { id: 'results', label: 'Results' },
        { id: 'security', label: 'Security' },
        { id: 'join', label: 'Join' }
      ],
      hero: {
        tag: 'Cogita',
        title: 'A live knowledge space for quizzes, dialogue, and shared memory.',
        subtitle:
          'Design quizzes, run live sessions, and give every participant a personal result view. Cogita keeps content open and access keys private.',
        primaryCta: 'Start with REcreatio',
        secondaryCta: 'Explore the subpages'
      },
      homeSlides: [
        {
          id: 'overview',
          title: 'Cogita. A live knowledge stage for learning and dialogue.',
          text:
            'A presentation space where quizzes, sessions, and resources stay open while access stays cryptographic.',
          ctaLabel: 'Begin the tour'
        },
        {
          id: 'library',
          title: 'Knowledge library with reusable quiz stacks.',
          text: 'Compose lessons, attach resources, and publish curated collections.',
          ctaLabel: 'Next: live sessions'
        },
        {
          id: 'live',
          title: 'Live sessions with controlled tempo.',
          text: 'Start a session, broadcast a code, and guide everyone through each round.',
          ctaLabel: 'Next: participation'
        },
        {
          id: 'results',
          title: 'Participation, results, and SharedViews.',
          text: 'Every participant gets a personal result view, even without an account.',
          ctaLabel: 'Next: security'
        },
        {
          id: 'security',
          title: 'Security baked into every step.',
          text: 'Role-based keys, audit trails, and optional separate domains such as cogita.pl.',
          ctaLabel: 'Next: login',
          variant: 'secondary'
        },
        {
          id: 'login',
          title: 'Ready to create in Cogita?',
          text: 'Sign in with REcreatio to build quizzes, host sessions, and manage your knowledge space.',
          ctaLabel: 'Sign in via REcreatio'
        }
      ],
      stats: [
        { value: '3 modes', label: 'Teacher, student, guest' },
        { value: '1 link', label: 'QR or session code' },
        { value: '0 trust', label: 'Keys enforce access' }
      ],
      highlights: [
        {
          title: 'Live session control',
          desc: 'Start, pause, and close sessions with a single command. Keep the tempo together.'
        },
        {
          title: 'Anonymous ready',
          desc: 'Participants can join without accounts, yet still keep a private result view.'
        },
        {
          title: 'Audit-first',
          desc: 'Every change is logged and scoped by roles, so your knowledge stays accountable.'
        }
      ],
      sections: [
        {
          id: 'library',
          tag: 'Knowledge Library',
          title: 'Compose lessons, reuse quiz stacks, keep context.',
          subtitle: 'Build quizzes and resources with templates, versioning, and co-authorship.',
          cards: [
            {
              title: 'Quiz builder',
              desc: 'Create question banks, templates, and randomized variants for assessments.',
              meta: 'Templates + generator'
            },
            {
              title: 'Knowledge boards',
              desc: 'Cluster topics, attach materials, and keep curriculum context visible.',
              meta: 'Collections + tags'
            },
            {
              title: 'Co-editing',
              desc: 'Invite collaborators with role-based access to draft, review, and publish.',
              meta: 'Role-scoped access'
            }
          ],
          bullets: [
            'Reusable question templates with random parameters.',
            'Attach readings, media, and links to each block.',
            'Publish public previews without exposing answer keys.'
          ]
        },
        {
          id: 'live',
          tag: 'Live Sessions',
          title: 'Orchestrate live participation without losing focus.',
          subtitle: 'Launch a session, broadcast a code, and guide the group in real time.',
          cards: [
            {
              title: 'Session desk',
              desc: 'Start sessions, lock questions, and keep a live timer for each round.',
              meta: 'Teacher control'
            },
            {
              title: 'Instant feedback',
              desc: 'Collect answers, show trends, and decide when to reveal results.',
              meta: 'Live dashboard'
            },
            {
              title: 'Group scope',
              desc: 'Limit sessions to a class or open them to guests with controlled access.',
              meta: 'Class-aware'
            }
          ],
          bullets: [
            'Run quizzes with immediate feedback and moderated reveals.',
            'Support both logged-in and anonymous participants.',
            'Deliver shared views for personal results via QR.'
          ]
        },
        {
          id: 'participation',
          tag: 'Participation',
          title: 'Meet participants where they are.',
          subtitle: 'Cogita supports three ways to join, each with a tailored data view.',
          cards: [
            {
              title: 'Logged-in learners',
              desc: 'Results follow the student account and can be revisited later.',
              meta: 'Account-linked'
            },
            {
              title: 'Anonymous guests',
              desc: 'Join instantly with a QR code and keep a private results link.',
              meta: 'No account needed'
            },
            {
              title: 'Claim later',
              desc: 'Guests can attach their results to an account after the session.',
              meta: 'SharedView join'
            }
          ],
          bullets: [
            'QR-based join flows with per-participant SharedViews.',
            'Personal results links stay private and revocable.',
            'Account upgrades keep the same history.'
          ]
        },
        {
          id: 'results',
          tag: 'Results',
          title: 'See learning signals, not just scores.',
          subtitle: 'Track time, correctness, and group dynamics without exposing raw data.',
          cards: [
            {
              title: 'Time vs accuracy',
              desc: 'Spot where learners hesitate and where they feel confident.',
              meta: 'Analytics'
            },
            {
              title: 'Session replay',
              desc: 'Revisit each question with aggregated insight and anonymised patterns.',
              meta: 'After-action'
            },
            {
              title: 'Export views',
              desc: 'Share summaries with stakeholders while keeping raw answers private.',
              meta: 'Controlled reports'
            }
          ],
          bullets: [
            'Aggregate insights without exposing individual answers.',
            'QR-based views let participants revisit their own results.',
            'Build trust with audit-ready summaries.'
          ]
        },
        {
          id: 'security',
          tag: 'Security',
          title: 'Access is enforced by keys, not just passwords.',
          subtitle: 'Cogita inherits REcreatio cryptography so content stays controlled end-to-end.',
          cards: [
            {
              title: 'Role-based keys',
              desc: 'Teachers, admins, and classes each control distinct data keys.',
              meta: 'Key ledger'
            },
            {
              title: 'SharedViews',
              desc: 'Anonymous results are scoped to a single participant by design.',
              meta: 'QR security'
            },
            {
              title: 'Audit trail',
              desc: 'Changes to quizzes and sessions are recorded with accountability.',
              meta: 'Auth ledger'
            }
          ],
          bullets: [
            'Encrypted quiz configuration and answer storage.',
            'No data access without the right role keys.',
            'Secure mode disables key caching entirely.'
          ]
        }
      ],
      join: {
        title: 'Step into Cogita',
        subtitle: 'Use REcreatio login for authoring, or explore public content right away.',
        cards: [
          {
            title: 'Sign in for authoring',
            desc: 'Create quizzes, manage sessions, and invite collaborators.',
            action: 'Sign in'
          },
          {
            title: 'Preview public spaces',
            desc: 'Browse open knowledge boards and demo sessions.',
            action: 'Explore'
          },
          {
            title: 'Talk to the team',
            desc: 'Plan a pilot with your school or community.',
            action: 'Contact'
          }
        ]
      }
    }
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
      roles: 'Role graph',
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
    roles: {
      lead: 'Visualize roles, data nodes, and key relations. Select nodes or edges for details.',
      searchPlaceholder: 'Search by nick or role ID',
      reachableToggle: 'Show only reachable from selected',
      fullscreenEnter: 'Fullscreen',
      fullscreenExit: 'Exit fullscreen',
      noFilters: 'No relation types yet.',
      loading: 'Loading graph…',
      noNodes: 'No roles to display.',
      panelTitle: 'Details',
      panelEmpty: 'Select a role or relation.',
      legendTitle: 'Legend',
      edgeTitle: 'Relation',
      edgeDeleteAction: 'Delete relation',
      edgeDeleteWorking: 'Removing relation…',
      edgeDeleteSuccess: 'Relation removed.',
      edgeDeleteError: 'Unable to remove relation.',
      linkDraftTitle: 'Latest link',
      linkDraftHint: 'Most recent relation created in the graph.',
      linkWorking: 'Linking roles…',
      linkSuccess: 'Relation saved.',
      linkError: 'Unable to link roles.',
      createOwnedRole: 'Create owned role',
      createOwnedRoleHint: 'Owner will be the selected role.',
      createRoleTitle: 'New role',
      createRoleNickLabel: 'Role nick',
      createRoleKindLabel: 'Role type',
      createRoleRelationLabel: 'Relation',
      createRoleAction: 'Create role',
      createRoleWorking: 'Creating role…',
      createRoleSuccess: 'Role created.',
      createRoleError: 'Role creation failed.',
      dataAddTitle: 'Add data field',
      dataFieldLabel: 'Field type',
      dataKindLabel: 'Data type',
      dataKindData: 'Data',
      dataKindKey: 'Key only',
      dataValueLabel: 'Value',
      dataAddAction: 'Add field',
      dataAddWorking: 'Saving data…',
      dataAddSuccess: 'Data saved.',
      dataAddError: 'Unable to add data.',
      dataEditTitle: 'Edit data',
      dataEditAction: 'Save data',
      dataEditWorking: 'Saving changes…',
      dataEditSuccess: 'Data updated.',
      dataEditError: 'Unable to update data.',
      dataDeleteAction: 'Delete field',
      dataDeleteWorking: 'Removing data…',
      dataDeleteSuccess: 'Data removed.',
      dataDeleteError: 'Unable to remove data.',
      dataOwnerLabel: 'Owner role',
      dataShareTitle: 'Share data',
      dataShareTargetLabel: 'Target role ID',
      dataSharePermissionLabel: 'Access type',
      dataShareAction: 'Share data',
      dataShareWorking: 'Sharing data…',
      dataShareSuccess: 'Data shared.',
      dataShareError: 'Unable to share data.',
      shareRoleTitle: 'Share role',
      shareRoleTargetLabel: 'Target role ID',
      shareRoleRelationLabel: 'Access type',
      shareRoleAction: 'Share role',
      shareRoleWorking: 'Sharing role…',
      shareRoleSuccess: 'Role shared.',
      shareRoleError: 'Role share failed.',
      shareRoleHint: 'Creates a pending invitation for the target role.',
      recoveryPrepareAction: 'Prepare recovery key',
      recoveryPrepareWorking: 'Preparing recovery key…',
      recoveryPrepareSuccess: 'Recovery key prepared.',
      recoveryPrepareError: 'Unable to prepare recovery key.',
      recoveryPlanTitle: 'Recovery key (draft)',
      recoveryPlanHint: 'Connect owner roles, then activate the recovery key.',
      recoveryPlanNeedsShares: 'Missing: add at least one owner connection.',
      recoveryPlanLabel: 'Recovery key',
      recoveryPlanError: 'Select the recovery draft to continue.',
      recoveryShareWorking: 'Adding recovery share…',
      recoveryShareSuccess: 'Recovery share added.',
      recoveryShareError: 'Unable to add recovery share.',
      recoveryActivateAction: 'Create recovery key',
      recoveryActivateWorking: 'Activating recovery key…',
      recoveryActivateSuccess: 'Recovery key activated.',
      recoveryActivateError: 'Unable to activate recovery key.',
      contextAddRoleTitle: 'Add role to graph',
      contextAddRolePlaceholder: 'Role ID',
      contextAddRoleAction: 'Focus role',
      contextAddRoleWorking: 'Loading role…',
      contextAddRoleSuccess: 'Role loaded.',
      contextAddRoleError: 'Role is not available in this graph.',
      linkPermissionNeeded: 'Permission required to create this connection.',
      contextAddData: 'Add data',
      contextPrepareRecovery: 'Prepare recovery key',
      contextClose: 'Close',
      pendingTitle: 'Pending invitations',
      pendingAction: 'Load invitations',
      pendingWorking: 'Loading invitations…',
      pendingError: 'Unable to load invitations.',
      pendingEmpty: 'No pending invitations.',
      pendingAccept: 'Accept',
      pendingDataTitle: 'Pending data shares',
      pendingDataAction: 'Load data shares',
      pendingDataWorking: 'Loading data shares…',
      pendingDataError: 'Unable to load data shares.',
      pendingDataEmpty: 'No data shares.',
      parentsTitle: 'Parent roles',
      parentsAction: 'Load parents',
      parentsWorking: 'Loading parents…',
      parentsError: 'Unable to load parents.',
      parentsRemoved: 'Parent relation removed.',
      parentsRemoveAction: 'Remove',
      verifyTitle: 'Ledger verification',
      verifyAction: 'Check signatures',
      verifyWorking: 'Verifying ledger…',
      verifyError: 'Verification failed.',
      verifyHashOk: 'Hash chain OK',
      verifyHashIssue: 'Hash mismatch',
      verifySigOk: 'Signatures OK',
      verifySigIssue: 'Signature issue',
      verifyRoleSigned: 'Signed by role: {count}',
      relationNotesTitle: 'Relationship meaning',
      relationOwner: 'Owner — full control, can create/remove relations.',
      relationWrite: 'Write — can edit data, no membership control.',
      relationRead: 'Read — view only.',
      viewGraph: 'Graph',
      viewDetails: 'Details',
      cancelAction: 'Cancel',
      incomingTitle: 'Incoming',
      outgoingTitle: 'Outgoing',
      none: 'None'
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
