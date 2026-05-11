import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, storage } from './firebase';
import { updateProfile } from '../data/profile';

/**
 * Lets the user pick a business logo from their photo library, uploads it to
 * Firebase Storage at users/{uid}/branding/logo.png, and stores the download
 * URL on their profile.
 *
 * Returns true if a new logo was set, false if the user cancelled.
 */
export async function pickAndUploadBusinessLogo(): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('Photo library permission denied');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return false;

  const asset = result.assets[0];
  const path = `users/${uid}/branding/logo.png`;
  const storageRef = ref(storage, path);

  // Fetch the picked file as a Blob so the Web SDK can upload it on RN.
  const response = await fetch(asset.uri);
  const blob = await response.blob();

  await uploadBytes(storageRef, blob, { contentType: 'image/png' });
  const downloadUrl = await getDownloadURL(storageRef);

  await updateProfile({
    businessLogoUrl: downloadUrl,
    businessLogoPath: path,
  });

  return true;
}

export async function clearBusinessLogo(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  // Try delete from storage. Ignore "not found" — main goal is clearing the
  // profile field so the PDF stops referencing it.
  try {
    await deleteObject(ref(storage, `users/${uid}/branding/logo.png`));
  } catch {
    // ignore
  }
  await updateProfile({
    businessLogoUrl: undefined,
    businessLogoPath: undefined,
  });
}
