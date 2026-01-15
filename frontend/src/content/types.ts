import type { RouteKey } from '../types/navigation';

export type Copy = {
  nav: {
    home: string;
    parish: string;
    cogita: string;
    faq: string;
    legal: string;
    login: string;
    account: string;
  };
  accountMenu: {
    profile: string;
    secureModeOn: string;
    secureModeOff: string;
    logout: string;
  };
  hero: {
    headline: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  modules: {
    title: string;
    items: Array<{
      title: string;
      desc: string;
      tag: string;
      route: RouteKey;
    }>;
  };
  access: {
    title: string;
    subtitle: string;
    login: string;
    register: string;
    loginId: string;
    password: string;
    confirm: string;
    displayName: string;
    secureMode: string;
    create: string;
    signIn: string;
    statusTitle: string;
    statusReady: string;
    loginRequired: string;
    loginError: string;
    registerError: string;
    loginTaken: string;
    passwordMismatch: string;
    passwordTooShort: string;
    passwordCommon: string;
    passwordWeak: string;
    passwordStrong: string;
    loadingLogin: string;
    loadingRegister: string;
    sessionLabel: string;
    checkSession: string;
    toggleMode: string;
    logout: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    cards: Array<{ title: string; desc: string; action: string; route?: RouteKey }>;
  };
  parish: {
    title: string;
    subtitle: string;
    items: string[];
    note: string;
    loginCta: string;
  };
  cogita: {
    title: string;
    subtitle: string;
    items: string[];
    note: string;
    loginCta: string;
  };
  faq: {
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  legal: {
    title: string;
    items: Array<{ title: string; desc: string }>;
  };
  account: {
    title: string;
    subtitle: string;
    overviewTitle: string;
    overviewLead: string;
    sections: {
      overview: string;
      profile: string;
      roles: string;
      security: string;
    };
    menuLabel: string;
    loginIdLabel: string;
    loginIdHint: string;
    nicknameLabel: string;
    nicknameHint: string;
    nicknamePlaceholder: string;
    nicknameToggle: string;
    nicknameAction: string;
    nicknameWorking: string;
    nicknameSuccess: string;
    nicknameError: string;
    passwordTitle: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordToggle: string;
    passwordAction: string;
    passwordWorking: string;
    passwordSuccess: string;
    passwordError: string;
    secureModeTitle: string;
    secureModeNote: string;
    secureModeEnable: string;
    secureModeDisable: string;
    logoutAction: string;
    roles: {
      lead: string;
      searchPlaceholder: string;
      reachableToggle: string;
      fullscreenEnter: string;
      fullscreenExit: string;
      noFilters: string;
      loading: string;
      noNodes: string;
      panelTitle: string;
      panelEmpty: string;
      edgeTitle: string;
      linkDraftTitle: string;
      linkDraftHint: string;
      linkWorking: string;
      linkSuccess: string;
      linkError: string;
      createOwnedRole: string;
      createOwnedRoleHint: string;
      createRoleTitle: string;
      createRoleNickLabel: string;
      createRoleKindLabel: string;
      createRoleRelationLabel: string;
      createRoleAction: string;
      createRoleWorking: string;
      createRoleSuccess: string;
      createRoleError: string;
      dataAddTitle: string;
      dataFieldLabel: string;
      dataValueLabel: string;
      dataAddAction: string;
      dataAddWorking: string;
      dataAddSuccess: string;
      dataAddError: string;
      dataEditTitle: string;
      dataEditAction: string;
      dataEditWorking: string;
      dataEditSuccess: string;
      dataEditError: string;
      shareRoleTitle: string;
      shareRoleTargetLabel: string;
      shareRoleRelationLabel: string;
      shareRoleAction: string;
      shareRoleWorking: string;
      shareRoleSuccess: string;
      shareRoleError: string;
      cancelAction: string;
      incomingTitle: string;
      outgoingTitle: string;
      none: string;
    };
  };
  footer: {
    headline: string;
    contact: string;
    imprint: string;
    security: string;
  };
  loginCard: {
    title: string;
    contextDefault: string;
  };
};
