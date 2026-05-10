import { httpsCallable } from 'firebase/functions';
import { Linking } from 'react-native';
import { functions } from './firebase';

type CreateLinkResult = { url: string; accountId: string };

const createLink = httpsCallable<unknown, CreateLinkResult>(functions, 'createConnectAccountLink');

export async function startStripeOnboarding(): Promise<void> {
  const { data } = await createLink({});
  if (!data?.url) throw new Error('No onboarding URL returned');
  await Linking.openURL(data.url);
}
