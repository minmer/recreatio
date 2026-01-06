import { deriveH3, randomSalt } from './crypto';
import { checkAvailability, getSalt, login, register } from './api';

export async function registerWithPassword(options: {
  loginId: string;
  password: string;
  displayName?: string | null;
}) {
  const availability = await checkAvailability(options.loginId);
  if (!availability.isAvailable) {
    throw new Error('Login ID is already in use.');
  }

  const salt = randomSalt(32);
  const h3 = await deriveH3(options.password, salt);

  return register({
    loginId: options.loginId,
    userSaltBase64: salt,
    h3Base64: h3,
    displayName: options.displayName ?? null
  });
}

export async function loginWithPassword(options: {
  loginId: string;
  password: string;
  secureMode: boolean;
  deviceInfo?: string;
}) {
  const saltResponse = await getSalt(options.loginId);
  const h3 = await deriveH3(options.password, saltResponse.userSaltBase64);

  return login({
    loginId: options.loginId,
    h3Base64: h3,
    secureMode: options.secureMode,
    deviceInfo: options.deviceInfo ?? null
  });
}
