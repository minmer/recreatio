import { deriveH3, randomSalt } from './crypto';
import { ApiError, changePassword, checkAvailability, getSalt, login, register } from './api';

const primaryIterations = Number.parseInt(import.meta.env.VITE_H3_ITERATIONS ?? '', 10) || 150000;
const legacyIterations = (import.meta.env.VITE_H3_LEGACY_ITERATIONS ?? '')
  .split(',')
  .map((value: string) => Number.parseInt(value.trim(), 10))
  .filter((value: number) => Number.isFinite(value) && value > 0);

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
  const h3 = await deriveH3(options.password, salt, primaryIterations);

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
  const iterationsToTry = [primaryIterations, ...legacyIterations];

  for (let index = 0; index < iterationsToTry.length; index += 1) {
    const saltResponse = await getSalt(options.loginId);
    const h3 = await deriveH3(options.password, saltResponse.userSaltBase64, iterationsToTry[index]);

    try {
      return await login({
        loginId: options.loginId,
        h3Base64: h3,
        secureMode: options.secureMode,
        deviceInfo: options.deviceInfo ?? null
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && index < iterationsToTry.length - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Login failed.');
}

export async function changePasswordWithPassword(options: {
  loginId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const saltResponse = await getSalt(options.loginId);
  const h3Old = await deriveH3(options.currentPassword, saltResponse.userSaltBase64, primaryIterations);
  const h3New = await deriveH3(options.newPassword, saltResponse.userSaltBase64, primaryIterations);
  return changePassword({
    h3OldBase64: h3Old,
    h3NewBase64: h3New
  });
}
