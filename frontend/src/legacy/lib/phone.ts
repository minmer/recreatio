export const POLISH_PHONE_REGEX = /^\+48\d{9}$/;

export function normalizePolishPhone(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, '');
  let national: string | null = null;

  if (digits.length === 9) {
    national = digits;
  } else if (digits.length === 11 && digits.startsWith('48')) {
    national = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith('0048')) {
    national = digits.slice(4);
  }

  if (!national || national.length !== 9) {
    return null;
  }

  return `+48${national}`;
}

export function isNormalizedPolishPhone(input: string | null | undefined): boolean {
  return POLISH_PHONE_REGEX.test((input ?? '').trim());
}
