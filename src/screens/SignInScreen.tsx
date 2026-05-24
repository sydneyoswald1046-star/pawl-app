import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { useAuth, mapAuthError } from '../lib/auth';
import {
  setPendingGatewayChoice,
  type PaymentGateway,
  type PaystackCountry,
} from '../data/profile';

type Mode = 'signIn' | 'signUp' | 'reset';

const PAYSTACK_COUNTRIES: Array<{ code: PaystackCountry; label: string; flag: string }> = [
  { code: 'ghana', label: 'Ghana', flag: '🇬🇭' },
  { code: 'nigeria', label: 'Nigeria', flag: '🇳🇬' },
  { code: 'south africa', label: 'South Africa', flag: '🇿🇦' },
  { code: 'kenya', label: 'Kenya', flag: '🇰🇪' },
];

export default function SignInScreen() {
  const { c } = useTheme();
  const t = useT();
  const auth = useAuth();
  const [mode, setModeRaw] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [gateway, setGateway] = useState<PaymentGateway>('stripe');
  const [country, setCountry] = useState<PaystackCountry>('ghana');
  // Two-step signup: 1 = pick payment region, 2 = credentials.
  // Sign-in and reset modes skip the picker entirely.
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  const setMode = (next: Mode) => {
    setModeRaw(next);
    if (next === 'signUp') setSignupStep(1);
  };

  // Push the gateway pick into profile.ts so the listener can stamp it on the
  // freshly-created user doc. Only meaningful for signups — sign-ins on an
  // existing account ignore the pending value.
  const recordGatewayChoice = () => {
    if (mode !== 'signUp') return;
    if (gateway === 'paystack') {
      setPendingGatewayChoice('paystack', country);
    } else {
      setPendingGatewayChoice('stripe');
    }
  };

  const handleSubmit = async () => {
    if (!email || (mode !== 'reset' && !password)) return;
    setLoading(true);
    try {
      if (mode === 'signIn') await auth.signInWithEmail(email, password);
      else if (mode === 'signUp') {
        recordGatewayChoice();
        await auth.signUpWithEmail(email, password);
      } else {
        await auth.resetPassword(email);
        Alert.alert(t('auth.resetEmailSent'));
        setMode('signIn');
      }
    } catch (err) {
      const key = mapAuthError(err);
      Alert.alert(t(key as any));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      recordGatewayChoice();
      await auth.signInWithGoogle();
    } catch (err) {
      Alert.alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setLoading(true);
    try {
      recordGatewayChoice();
      await auth.signInWithApple();
    } catch (err) {
      Alert.alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: c.text }]}>Payly</Text>
          <Text style={[styles.subtitle, { color: c.sub }]}>
            {mode === 'signIn' && t('auth.signIn')}
            {mode === 'signUp' && t('auth.signUp')}
            {mode === 'reset' && t('auth.resetPassword')}
          </Text>

          <View style={styles.tabs}>
            {(['signIn', 'signUp', 'reset'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.tab, mode === m && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}
              >
                <Text style={{ color: mode === m ? c.text : c.sub, fontWeight: '500' }}>
                  {t(`auth.${m === 'signIn' ? 'signIn' : m === 'signUp' ? 'signUp' : 'resetPassword'}` as any)}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'signUp' && signupStep === 1 ? (
            <>
              <View style={styles.gatewayBlock}>
                <Text style={[styles.gatewayLabel, { color: c.sub }]}>
                  Where will you collect payments?
                </Text>
                <View style={styles.gatewayRow}>
                  <Pressable
                    onPress={() => setGateway('stripe')}
                    style={[
                      styles.gatewayCard,
                      {
                        backgroundColor: c.surface,
                        borderColor: gateway === 'stripe' ? c.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.gatewayTitle, { color: c.text }]}>Worldwide</Text>
                    <Text style={[styles.gatewaySub, { color: c.sub }]}>
                      Stripe · cards, bank transfers
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setGateway('paystack')}
                    style={[
                      styles.gatewayCard,
                      {
                        backgroundColor: c.surface,
                        borderColor: gateway === 'paystack' ? c.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.gatewayTitle, { color: c.text }]}>Africa</Text>
                    <Text style={[styles.gatewaySub, { color: c.sub }]}>
                      Paystack · mobile money, cards
                    </Text>
                  </Pressable>
                </View>

                {gateway === 'paystack' && (
                  <View style={styles.countryRow}>
                    {PAYSTACK_COUNTRIES.map((co) => {
                      const selected = country === co.code;
                      return (
                        <Pressable
                          key={co.code}
                          onPress={() => setCountry(co.code)}
                          style={[
                            styles.countryChip,
                            { backgroundColor: selected ? c.accent : c.surface },
                          ]}
                        >
                          <Text style={styles.countryFlag}>{co.flag}</Text>
                          <Text
                            style={{
                              color: selected ? '#fff' : c.text,
                              fontWeight: '500',
                            }}
                          >
                            {co.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <Text style={[styles.gatewayHelp, { color: c.sub }]}>
                  You can finish connecting your bank from Settings after sign-up.
                </Text>
              </View>

              <Pressable
                onPress={() => setSignupStep(2)}
                style={[styles.primaryBtn, { backgroundColor: c.accent }]}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
            </>
          ) : (
            <>
              {mode === 'signUp' && (
                <Pressable
                  onPress={() => setSignupStep(1)}
                  style={styles.backRow}
                  hitSlop={8}
                >
                  <Text style={[styles.backText, { color: c.accent }]}>
                    ← {gateway === 'paystack'
                      ? `${PAYSTACK_COUNTRIES.find((co) => co.code === country)?.label} · Paystack`
                      : 'Worldwide · Stripe'}
                  </Text>
                </Pressable>
              )}

              <TextInput
                style={[styles.input, { color: c.text, borderColor: c.faint, backgroundColor: c.surface }]}
                placeholder={t('auth.email')}
                placeholderTextColor={c.sub}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              {mode !== 'reset' && (
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.faint, backgroundColor: c.surface }]}
                  placeholder={t('auth.password')}
                  placeholderTextColor={c.sub}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                />
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={[styles.primaryBtn, { backgroundColor: c.accent, opacity: loading ? 0.6 : 1 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {mode === 'signIn' && t('auth.signIn')}
                    {mode === 'signUp' && t('auth.signUp')}
                    {mode === 'reset' && t('auth.resetPassword')}
                  </Text>
                )}
              </Pressable>

              {mode !== 'reset' && (
                <>
                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, { backgroundColor: c.faint }]} />
                    <Text style={{ color: c.sub, marginHorizontal: 12 }}>or</Text>
                    <View style={[styles.dividerLine, { backgroundColor: c.faint }]} />
                  </View>

                  <Pressable
                    onPress={handleGoogle}
                    disabled={loading}
                    style={[styles.secondaryBtn, { borderColor: c.faint }]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: c.text }]}>
                      {t('auth.continueWithGoogle')}
                    </Text>
                  </Pressable>

                  {Platform.OS === 'ios' && (
                    <Pressable
                      onPress={handleApple}
                      disabled={loading}
                      style={[styles.secondaryBtn, { borderColor: c.faint }]}
                    >
                      <Text style={[styles.secondaryBtnText, { color: c.text }]}>
                        {t('auth.continueWithApple')}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingTop: 80 },
  title: { fontSize: 36, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  tab: { paddingVertical: 12, paddingHorizontal: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  primaryBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1 },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '500' },
  gatewayBlock: { marginTop: 4, marginBottom: 4 },
  gatewayLabel: { fontSize: 13, marginBottom: 8 },
  gatewayRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  gatewayCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  gatewayTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  gatewaySub: { fontSize: 12 },
  countryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  countryFlag: { fontSize: 16 },
  gatewayHelp: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  backRow: { paddingVertical: 8, marginBottom: 8 },
  backText: { fontSize: 14, fontWeight: '500' },
});
