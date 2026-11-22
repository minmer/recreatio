/**
 * EIN KONTO ANLEGEN — mit dem ersten Menschen darunter (2026-11-22 aus `SignIn.tsx` herausgezogen: die Klasse legt auch
 * Konten an, `cogita/classes/ClassJoin.tsx`).
 *
 * Zwei Rollen entstehen, nur eine hat einen Namen: das Konto (Art `account`, der Schlüsselbund) und der erste MENSCH darunter,
 * der Bereiche, Adressen und Ämter übernimmt. Der Name wird hier versiegelt gesetzt; der Dienst hat dafür keinen Schlüssel.
 *
 * Ab `register` steht das Konto. Scheitert der Mensch danach, ist man trotzdem angemeldet — `personFailed` sagt warum.
 */

import { t } from '../core/i18n';
import { forgetKeys, keysFor } from '../core/ringOf';
import { createRole } from '../roles/roles';
import { register, WorkspaceError, type Who } from '../core/session';

export async function createAccount(loginId: string, password: string, name: string, stage: (what: 'account' | 'person') => void = () => undefined): Promise<{ readonly who: Who; readonly personFailed: string | null }> {
  stage('account');
  const who = await register(loginId.trim(), password);
  stage('person');
  try {
    await firstPerson(who, name.trim());
    return { who, personFailed: null };
  } catch (e) {
    return { who, personFailed: e instanceof WorkspaceError ? t('shell.signIn.personFailedWhy', { why: e.message }) : t('shell.signIn.personFailed') };
  }
}

/** Der erste Mensch, unter dem Konto. */
async function firstPerson(who: Who, wanted: string): Promise<void> {
  const { ring, graph } = await keysFor(who);
  if (ring === null) throw new WorkspaceError(t('shell.signIn.noKeys'));
  const root = graph.roles.find((r) => r.isPersonal);
  if (root === undefined) throw new WorkspaceError(t('shell.signIn.noRole'));
  await createRole(ring, root, { kind: 'person', name: wanted });
  // Der Bund kennt den Schlüssel der neuen Rolle sonst nicht.
  forgetKeys();
}
