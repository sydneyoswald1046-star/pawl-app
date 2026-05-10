import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, Moon, Bell, Shield, CircleHelp, ChevronRight, LogOut, Globe, DollarSign, Briefcase, Banknote } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useI18n, SUPPORTED_LOCALES, LANGUAGE_NAMES, type Locale } from '../i18n';
import { useAuth } from '../lib/auth';
import { useProfile, updateProfile } from '../data/profile';
import { startStripeOnboarding } from '../lib/stripeConnect';
import { changePassword, deleteAccount } from '../lib/account';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'NGN', 'ZAR'];

export default function SettingsScreen() {
  const { c, dark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, locale, setLocale } = useI18n();
  const { user, signOut: authSignOut } = useAuth();
  const profile = useProfile();
  const nav = useNavigation<any>();

  const comingSoon = (label: string) =>
    Alert.alert(label, t('settings.coming_soon_body', { label }));

  const SUPPORT_EMAIL = 'payly-stripe@proton.me';

  const openNotifications = () => nav.navigate('Notifications');

  const openHelp = () => {
    Alert.alert(t('settings.help'), undefined, [
      {
        text: t('settings.help_contact'),
        onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Payly support')}`),
      },
      {
        text: t('settings.help_about'),
        onPress: () => Alert.alert(t('settings.about_title'), t('settings.about_body', { email: user?.email ?? '—' })),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const promptChangePassword = () => {
    Alert.prompt(
      t('settings.change_password'),
      t('settings.change_password_current'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          onPress: (current?: string) => {
            const cur = current ?? '';
            if (!cur) return;
            Alert.prompt(
              t('settings.change_password'),
              t('settings.change_password_new'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.save'),
                  onPress: async (next?: string) => {
                    const np = (next ?? '').trim();
                    if (np.length < 6) {
                      Alert.alert(t('common.error'), t('auth.error.weakPassword'));
                      return;
                    }
                    try {
                      await changePassword(cur, np);
                      Alert.alert(t('settings.change_password_success'));
                    } catch (err) {
                      Alert.alert(t('common.error'), (err as Error).message);
                    }
                  },
                },
              ],
              'secure-text',
            );
          },
        },
      ],
      'secure-text',
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      t('settings.delete_account_title'),
      t('settings.delete_account_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.delete_account_confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (err) {
              Alert.alert(t('common.error'), (err as Error).message);
            }
          },
        },
      ],
    );
  };

  const openPrivacy = () => {
    Alert.alert(t('settings.privacy'), undefined, [
      { text: t('settings.change_password'), onPress: promptChangePassword },
      { text: t('settings.delete_account'), style: 'destructive', onPress: confirmDeleteAccount },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const signOut = () =>
    Alert.alert(t('settings.sign_out_confirm_title'), t('settings.sign_out_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.sign_out'),
        style: 'destructive',
        onPress: async () => {
          try {
            await authSignOut();
          } catch (err) {
            Alert.alert(t('common.error'), (err as Error).message);
          }
        },
      },
    ]);

  const chooseLanguage = () => {
    const buttons = SUPPORTED_LOCALES.map((l) => ({
      text: `${LANGUAGE_NAMES[l]}${l === locale ? '  ✓' : ''}`,
      onPress: () => setLocale(l as Locale),
    }));
    Alert.alert(t('settings.language_choose_title'), t('settings.language_choose_body'), [
      ...buttons,
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const editCustomPaymentLink = () => {
    Alert.prompt(
      t('settings.custom_payment_link'),
      t('settings.custom_payment_link_prompt'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.save'),
          onPress: async (value?: string) => {
            const trimmed = (value ?? '').trim();
            try {
              await updateProfile({ customPaymentLink: trimmed || undefined });
            } catch (err) {
              Alert.alert(t('common.error'), (err as Error).message);
            }
          },
        },
      ],
      'plain-text',
      profile.customPaymentLink ?? '',
      'url',
    );
  };

  const editBusinessName = () => {
    Alert.prompt(
      t('settings.business_name'),
      t('settings.business_name_prompt'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.save'),
          onPress: async (value?: string) => {
            const trimmed = (value ?? '').trim();
            try {
              await updateProfile({ businessName: trimmed || undefined });
            } catch (err) {
              Alert.alert(t('common.error'), (err as Error).message);
            }
          },
        },
      ],
      'plain-text',
      profile.businessName ?? '',
    );
  };

  const chooseCurrency = () => {
    Alert.alert(
      t('settings.default_currency'),
      undefined,
      [
        ...CURRENCIES.map((cur) => ({
          text: `${cur}${cur === profile.defaultCurrency ? '  ✓' : ''}`,
          onPress: async () => {
            try {
              await updateProfile({ defaultCurrency: cur });
            } catch (err) {
              Alert.alert(t('common.error'), (err as Error).message);
            }
          },
        })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ],
    );
  };

  const [connecting, setConnecting] = useState(false);
  const connectStripe = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      await startStripeOnboarding();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const stripeStatus = profile.stripeAccountStatus;
  const stripeTrailing =
    stripeStatus === 'active'
      ? t('settings.stripe_connected')
      : stripeStatus === 'pending' || stripeStatus === 'incomplete'
        ? t('settings.stripe_pending')
        : t('settings.stripe_not_connected');

  const initial = (user?.email?.[0] ?? 'P').toUpperCase();
  const displayEmail = user?.email ?? '';

  const sections = [
    {
      title: t('settings.section_account'),
      items: [
        { icon: Briefcase, label: t('settings.business_name'), color: c.accent, trailing: profile.businessName || t('settings.business_name_unset'), onPress: editBusinessName },
        { icon: Banknote, label: t('settings.stripe_connect'), color: stripeStatus === 'active' ? c.green : c.amber, trailing: stripeTrailing, onPress: connectStripe },
        { icon: DollarSign, label: t('settings.custom_payment_link'), color: c.sub, trailing: profile.customPaymentLink ? t('settings.custom_payment_link_set') : t('settings.custom_payment_link_unset'), onPress: editCustomPaymentLink },
        { icon: Bell, label: t('settings.notifications'), color: c.amber, onPress: openNotifications },
      ],
    },
    {
      title: t('settings.section_preferences'),
      items: [
        { icon: Globe, label: t('settings.language'), color: c.accent, trailing: LANGUAGE_NAMES[locale], onPress: chooseLanguage },
        { icon: DollarSign, label: t('settings.default_currency'), color: c.green, trailing: profile.defaultCurrency, onPress: chooseCurrency },
        { icon: Shield, label: t('settings.privacy'), color: c.sub, onPress: openPrivacy },
        { icon: CircleHelp, label: t('settings.help'), color: c.sub, onPress: openHelp },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }}
      >
        <Text style={[styles.title, { color: c.text }]}>{t('settings.title')}</Text>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: c.surface }]}>
          <LinearGradient
            colors={[c.accent, '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileAvatar}
          >
            <Text style={styles.profileInitial}>{initial}</Text>
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.profileName, { color: c.text }]} numberOfLines={1}>
              {displayEmail || t('settings.profile')}
            </Text>
            {displayEmail && (
              <Text style={[styles.profileEmail, { color: c.sub }]} numberOfLines={1}>
                {t('settings.signed_in_as')}
              </Text>
            )}
          </View>
        </View>

        {/* Theme Toggle */}
        <TouchableOpacity
          onPress={toggle}
          style={[styles.themeRow, { backgroundColor: c.surface }]}
          activeOpacity={0.7}
        >
          <View style={[styles.themeIcon, { backgroundColor: dark ? '#1a1a2e' : '#fef9c3' }]}>
            {dark ? <Moon size={18} color={c.accent} strokeWidth={1.8} /> : <Sun size={18} color={c.amber} strokeWidth={1.8} />}
          </View>
          <Text style={[styles.themeLabel, { color: c.text }]}>
            {dark ? t('settings.dark_mode') : t('settings.light_mode')}
          </Text>
          <View style={[styles.toggle, { backgroundColor: dark ? c.accent : c.muted }]}>
            <View style={[styles.toggleDot, { left: dark ? 18 : 2 }]} />
          </View>
        </TouchableOpacity>

        {/* Sections */}
        {sections.map((section, si) => (
          <View key={si}>
            <Text style={[styles.sectionTitle, { color: c.sub }]}>{section.title}</Text>
            <View style={[styles.sectionCard, { backgroundColor: c.surface }]}>
              {section.items.map((item, ii) => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={ii}
                    onPress={item.onPress}
                    style={[styles.row, ii < section.items.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: c.muted + '30' }]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: item.color + '12' }]}>
                      <Icon size={16} color={item.color} strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.rowLabel, { color: c.text }]}>{item.label}</Text>
                    {item.trailing && (
                      <Text style={[styles.rowTrailing, { color: c.sub }]}>{item.trailing}</Text>
                    )}
                    <ChevronRight size={16} color={c.faint} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Sign Out */}
        <TouchableOpacity onPress={signOut} style={[styles.signOut, { backgroundColor: c.redSoft }]} activeOpacity={0.7}>
          <LogOut size={16} color={c.red} strokeWidth={1.8} />
          <Text style={[styles.signOutText, { color: c.red }]}>{t('settings.sign_out')}</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: c.muted }]}>{t('settings.version')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 20 },

  profileCard: { marginHorizontal: 16, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  profileAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  profileInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: 16, fontWeight: '600' },
  profileEmail: { fontSize: 12, marginTop: 2 },
  proBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  proText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  themeRow: { marginHorizontal: 16, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  themeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  themeLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  toggle: { width: 38, height: 22, borderRadius: 11, justifyContent: 'center' },
  toggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', position: 'absolute' },

  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginLeft: 20, marginBottom: 8, marginTop: 4 },
  sectionCard: { marginHorizontal: 16, borderRadius: 14, marginBottom: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  rowTrailing: { fontSize: 13, fontWeight: '500' },

  signOut: { marginHorizontal: 16, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  signOutText: { fontSize: 14, fontWeight: '600' },

  version: { textAlign: 'center', fontSize: 11, marginTop: 20 },
});
