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

export function checkPasswordStrength(password: string): PasswordCheck {
  if (password.length < 12) {
    return { ok: false, message: 'Use at least 12 characters.' };
  }

  if (commonPasswords.has(password.toLowerCase())) {
    return { ok: false, message: 'That password is too common.' };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\\d/.test(password);
  const hasSymbol = /[^A-Za-z\\d]/.test(password);

  const score = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
  if (score < 3) {
    return { ok: false, message: 'Use a mix of upper, lower, number, and symbol.' };
  }

  return { ok: true, message: 'Strong password.' };
}
