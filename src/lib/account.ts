import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as fbUpdatePassword,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  if (!user.email) throw new Error('Password change requires an email account');
  // Reauthenticate first so Firebase doesn't reject with requires-recent-login.
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await fbUpdatePassword(user, newPassword);
}

const deleteAccountCallable = httpsCallable<unknown, { ok: boolean }>(functions, 'deleteAccount');

export async function deleteAccount(): Promise<void> {
  await deleteAccountCallable({});
  // The auth user is gone; sign out locally so the app routes back to SignInScreen.
  try {
    await auth.signOut();
  } catch {
    // Ignore — auth is already invalid.
  }
}
