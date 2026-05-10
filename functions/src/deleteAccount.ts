import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Recursively deletes a user's Firestore data (their profile doc and any
 * subcollections like invoices, clients) and then deletes the Firebase
 * Auth identity.
 *
 * The client should sign out immediately after calling this; subsequent
 * requests will fail because the auth user no longer exists.
 *
 * Stripe Connect accounts are NOT deleted automatically — the user (or
 * the platform) needs to handle that separately via Stripe Dashboard.
 */
export const deleteAccount = onCall(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');

    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);

    try {
      await db.recursiveDelete(userRef);
      logger.info('Deleted user Firestore data', { uid });
    } catch (err) {
      logger.error('Failed to delete user Firestore data', { uid, err });
      throw new HttpsError('internal', 'Could not delete account data');
    }

    try {
      await admin.auth().deleteUser(uid);
      logger.info('Deleted Firebase Auth user', { uid });
    } catch (err) {
      logger.error('Failed to delete auth user', { uid, err });
      throw new HttpsError('internal', 'Could not delete auth identity');
    }

    return { ok: true };
  },
);
