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
    placeholder: string;
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
