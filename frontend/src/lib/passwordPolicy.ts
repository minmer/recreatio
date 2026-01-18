const commonPasswords = new Set([
'Aa123456',
'Pass@123',
'P@ssw0rd',
'Password1',
'Password123',
'Password',
'Passw0rd',
'N0=Acc3ss',
'Sojdlg123aljg',
'YAgjecc826',
'SZ9kQcCTwY',
'3rJs1la7qE',
'a838hfiD',
'iG4abOX4',
'W5tXn36alfW',
'N8ZGT5P0sHw=',
'Groupd2013',
'3Odi15ngxB',
'qti7Zxh18U',
'P@ssw0rd'
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
