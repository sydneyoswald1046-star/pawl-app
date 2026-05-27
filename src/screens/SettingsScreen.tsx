import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, Moon, Bell, Shield, CircleHelp, ChevronRight, LogOut, Globe, DollarSign, Briefcase, Banknote, User, Sparkles, Image as ImageIcon } from 'lucide-react-native';
import { useState, type ComponentType } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useI18n, SUPPORTED_LOCALES, LANGUAGE_NAMES, type Locale } from '../i18n';
import { useAuth } from '../lib/auth';
import { useProfile, updateProfile } from '../data/profile';
import { startStripeOnboarding } from '../lib/stripeConnect';
import { openBillingPortal } from '../lib/subscriptions';
import { getEntitlements } from '../lib/entitlements';
import { changePassword, deleteAccount } from '../lib/account';
import { pickAndUploadBusinessLogo, clearBusinessLogo } from '../lib/branding';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'NGN', 'ZAR'];

// iOS-style fixed icon background colors. Always pair with a white glyph.
const ICON = {
  gray: '#8E8E93',
  blue: '#0A84FF',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  indigo: '#5856D6',
  amber: '#FFCC00',
} as const;

type LucideIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type Row = {
  icon: LucideIcon;
  iconBg: string;
  label: string;
  trailing?: string;
  onPress: () => void;
};

export default function SettingsScreen() {
  const { c, dark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, locale, setLocale } = useI18n();
  const { user, signOut: authSignOut } = useAuth();
  const profile = useProfile();
  const nav = useNavigation<any>();

  const SUPPORT_EMAIL = 'pawl-stripe@proton.me';

  const openNotifications = () => nav.navigate('Notifications');

  const openHelp = () => {
    Alert.alert(t('settings.help'), undefined, [
      {
        text: t('settings.help_contact'),
        onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('PAWL support')}`),
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
    Alert.alert(t('settings.delete_account_title'), t('settings.delete_account_body'), [
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
    ]);
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
    if (!entitlements.customPaymentLink) {
      nav.navigate('Paywall');
      return;
    }
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

  const editBusinessLogo = () => {
    if (!entitlements.businessLogoOnPdf) {
      nav.navigate('Paywall');
      return;
    }
    const opts: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void | Promise<void> }> = [
      {
        text: profile.businessLogoUrl ? t('settings.business_logo_replace') : t('settings.business_logo_upload'),
        onPress: async () => {
          try {
            await pickAndUploadBusinessLogo();
          } catch (err) {
            Alert.alert(t('common.error'), (err as Error).message);
          }
        },
      },
    ];
    if (profile.businessLogoUrl) {
      opts.push({
        text: t('settings.business_logo_remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await clearBusinessLogo();
          } catch (err) {
            Alert.alert(t('common.error'), (err as Error).message);
          }
        },
      });
    }
    opts.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('settings.business_logo'), undefined, opts);
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
    Alert.alert(t('settings.default_currency'), undefined, [
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
    ]);
  };

  const [connecting, setConnecting] = useState(false);
  const connectStripe = async () => {
    if (!entitlements.stripeConnect && !profile.stripeAccountId) {
      nav.navigate('Paywall');
      return;
    }
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

  const entitlements = getEntitlements(profile);
  const subRowTrailing = entitlements.isPro
    ? (entitlements.status === 'trialing' ? t('settings.sub_trialing') : t('settings.sub_active'))
    : t('settings.sub_upgrade');

  const onSubscriptionRow = async () => {
    if (entitlements.isPro && profile.stripeCustomerId) {
      try {
        await openBillingPortal();
      } catch (err) {
        Alert.alert(t('common.error'), (err as Error).message);
      }
    } else {
      nav.navigate('Paywall');
    }
  };

  const stripeStatus = profile.stripeAccountStatus;
  const stripeTrailing =
    stripeStatus === 'active'
      ? t('settings.stripe_connected')
      : stripeStatus === 'pending' || stripeStatus === 'incomplete'
        ? t('settings.stripe_pending')
        : t('settings.stripe_not_connected');

  const themeIcon: LucideIcon = dark ? Moon : Sun;

  const sections: Array<{ title: string; rows: Row[] }> = [
    {
      title: t('settings.section_account'),
      rows: [
        { icon: User, iconBg: ICON.blue, label: t('settings.profile'), trailing: user?.email ?? '—', onPress: () => {} },
        { icon: Sparkles, iconBg: entitlements.isPro ? ICON.indigo : ICON.orange, label: t('settings.subscription'), trailing: subRowTrailing, onPress: onSubscriptionRow },
        { icon: Briefcase, iconBg: ICON.gray, label: t('settings.business_name'), trailing: profile.businessName || t('settings.business_name_unset'), onPress: editBusinessName },
        { icon: ImageIcon, iconBg: ICON.indigo, label: t('settings.business_logo'), trailing: profile.businessLogoUrl ? t('settings.business_logo_set') : t('settings.business_logo_unset'), onPress: editBusinessLogo },
        { icon: Banknote, iconBg: stripeStatus === 'active' ? ICON.green : ICON.orange, label: t('settings.stripe_connect'), trailing: stripeTrailing, onPress: connectStripe },
        { icon: DollarSign, iconBg: ICON.orange, label: t('settings.custom_payment_link'), trailing: profile.customPaymentLink ? t('settings.custom_payment_link_set') : t('settings.custom_payment_link_unset'), onPress: editCustomPaymentLink },
        { icon: Bell, iconBg: ICON.red, label: t('settings.notifications'), onPress: openNotifications },
      ],
    },
    {
      title: t('settings.section_preferences'),
      rows: [
        { icon: themeIcon, iconBg: ICON.indigo, label: dark ? t('settings.dark_mode') : t('settings.light_mode'), onPress: toggle },
        { icon: Globe, iconBg: ICON.blue, label: t('settings.language'), trailing: LANGUAGE_NAMES[locale], onPress: chooseLanguage },
        { icon: DollarSign, iconBg: ICON.green, label: t('settings.default_currency'), trailing: profile.defaultCurrency, onPress: chooseCurrency },
        { icon: Shield, iconBg: ICON.blue, label: t('settings.privacy'), onPress: openPrivacy },
        { icon: CircleHelp, iconBg: ICON.gray, label: t('settings.help'), onPress: openHelp },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }}
      >
        {/* Hero — iOS-style app card */}
        <View style={[styles.hero, { backgroundColor: c.surface }]}>
          <View style={styles.heroIconWrap}>
            <Image source={require('../../assets/icon.png')} style={styles.heroIcon} />
          </View>
          <Text style={[styles.heroTitle, { color: c.text }]}>{t('settings.title')}</Text>
          <Text style={[styles.heroSub, { color: c.sub }]}>{t('settings.hero_sub')}</Text>
        </View>

        {sections.map((section, si) => (
          <View key={si}>
            <Text style={[styles.sectionTitle, { color: c.sub }]}>{section.title}</Text>
            <View style={[styles.sectionCard, { backgroundColor: c.surface }]}>
              {section.rows.map((row, ri) => {
                const Icon = row.icon;
                const isLast = ri === section.rows.length - 1;
                return (
                  <TouchableOpacity
                    key={ri}
                    onPress={row.onPress}
                    activeOpacity={0.7}
                    style={[
                      styles.row,
                      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.muted + '40' },
                    ]}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: row.iconBg }]}>
                      <Icon size={17} color="#fff" strokeWidth={2.4} />
                    </View>
                    <Text style={[styles.rowLabel, { color: c.text }]} numberOfLines={1}>
                      {row.label}
                    </Text>
                    {row.trailing ? (
                      <Text style={[styles.rowTrailing, { color: c.sub }]} numberOfLines={1}>
                        {row.trailing}
                      </Text>
                    ) : null}
                    <ChevronRight size={18} color={c.faint} strokeWidth={2.2} />
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

  // Hero
  hero: {
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
    marginBottom: 28,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroIcon: { width: '100%', height: '100%' },
  heroTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 8 },
  heroSub: { fontSize: 15, lineHeight: 21 },

  // Sections
  sectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginLeft: 32,
    marginBottom: 6,
  },
  sectionCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 28,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
    minHeight: 44,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '400' },
  rowTrailing: { fontSize: 15, marginRight: 4, maxWidth: 140 },

  // Sign out / footer
  signOut: {
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  signOutText: { fontSize: 15, fontWeight: '600' },

  version: { textAlign: 'center', fontSize: 11, marginTop: 18 },
});
