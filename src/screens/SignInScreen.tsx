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

type Mode = 'signIn' | 'signUp' | 'reset';

export default function SignInScreen() {
  const { c } = useTheme();
  const t = useT();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || (mode !== 'reset' && !password)) return;
    setLoading(true);
    try {
      if (mode === 'signIn') await auth.signInWithEmail(email, password);
      else if (mode === 'signUp') await auth.signUpWithEmail(email, password);
      else {
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
      await auth.signInWithApple();
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') return;
      Alert.alert(t('common.error'), err?.message ?? String(err));
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
          <Text style={[styles.title, { color: c.text }]}>PAWL</Text>
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
});
