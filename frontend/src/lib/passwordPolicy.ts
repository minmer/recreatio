const commonPasswords = new Set([
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'letmein',
  'admin',
  'welcome',
  'iloveyou',
  'password1',
  '123456789',
  '000000',
  '111111'
]);

export type PasswordCheck = {
  ok: boolean;
  message: string;
};

export type PasswordMessages = {
  tooShort: string;
  common: string;
  weak: string;
  strong: string;
};

export function checkPasswordStrength(password: string, messages: PasswordMessages): PasswordCheck {
  if (password.length < 8) {
    return { ok: false, message: messages.tooShort };
  }

  if (commonPasswords.has(password.toLowerCase())) {
    return { ok: false, message: messages.common };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\\d/.test(password);
  const hasSymbol = /[^A-Za-z\\d]/.test(password);

  const score = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
  if (score < 3) {
    return { ok: false, message: messages.weak };
  }

  return { ok: true, message: messages.strong };
}
