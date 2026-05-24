import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, Building2, CreditCard } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useProfile, updateProfile, type PaystackCountry } from '../data/profile';
import {
  listPaystackBanks,
  resolvePaystackAccount,
  createPaystackSubaccount,
  type PaystackBank,
} from '../lib/paystackConnect';

type Step = 'country' | 'business' | 'bank' | 'verify' | 'done';

const COUNTRIES: Array<{ code: PaystackCountry; label: string; currency: string; flag: string }> = [
  { code: 'ghana', label: 'Ghana', currency: 'GHS', flag: '🇬🇭' },
  { code: 'nigeria', label: 'Nigeria', currency: 'NGN', flag: '🇳🇬' },
  { code: 'south africa', label: 'South Africa', currency: 'ZAR', flag: '🇿🇦' },
  { code: 'kenya', label: 'Kenya', currency: 'KES', flag: '🇰🇪' },
];

export default function PaystackConnectScreen() {
  const { c } = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const profile = useProfile();

  const [step, setStep] = useState<Step>(
    profile.paystackCountry ? 'business' : 'country',
  );
  const [country, setCountry] = useState<PaystackCountry>(
    profile.paystackCountry ?? 'ghana',
  );
  const [businessName, setBusinessName] = useState<string>(
    profile.paystackBusinessName ?? profile.businessName ?? '',
  );
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankCode, setBankCode] = useState<string>(profile.paystackBankCode ?? '');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [resolvedName, setResolvedName] = useState<string>('');
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (step !== 'bank') return;
    setBanksLoading(true);
    listPaystackBanks(country)
      .then(setBanks)
      .catch((err) => Alert.alert('Banks', (err as Error).message))
      .finally(() => setBanksLoading(false));
  }, [step, country]);

  const selectedBank = useMemo(
    () => banks.find((b) => b.code === bankCode),
    [banks, bankCode],
  );

  const goNext = () => {
    if (step === 'country') return setStep('business');
    if (step === 'business') {
      if (!businessName.trim()) {
        Alert.alert('Business', 'Enter your business name.');
        return;
      }
      return setStep('bank');
    }
    if (step === 'bank') {
      if (!bankCode) {
        Alert.alert('Bank', 'Select a bank.');
        return;
      }
      if (!/^\d{8,12}$/.test(accountNumber.trim())) {
        Alert.alert('Account', 'Enter a valid account number.');
        return;
      }
      verifyAndContinue();
      return;
    }
    if (step === 'verify') {
      submit();
    }
  };

  const goBack = () => {
    if (step === 'business') return setStep('country');
    if (step === 'bank') return setStep('business');
    if (step === 'verify') return setStep('bank');
    nav.goBack();
  };

  const verifyAndContinue = async () => {
    setResolving(true);
    try {
      const r = await resolvePaystackAccount(bankCode, accountNumber.trim());
      setResolvedName(r.accountName);
      setStep('verify');
    } catch (err) {
      Alert.alert('Verification', (err as Error).message);
    } finally {
      setResolving(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await createPaystackSubaccount({
        businessName: businessName.trim(),
        bankCode,
        accountNumber: accountNumber.trim(),
        country,
      });
      // Mark gateway choice in profile so the router uses Paystack going forward.
      await updateProfile({ paymentGateway: 'paystack' });
      setStep('done');
    } catch (err) {
      Alert.alert('Connect', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const title = {
    country: 'Where do you collect payments?',
    business: 'Business details',
    bank: 'Bank account',
    verify: 'Confirm details',
    done: 'Connected',
  }[step];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} style={styles.iconBtn} hitSlop={12}>
          <ChevronLeft size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Connect bank</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.h1, { color: c.text }]}>{title}</Text>

        {step === 'country' && (
          <View style={styles.list}>
            {COUNTRIES.map((co) => {
              const selected = country === co.code;
              return (
                <TouchableOpacity
                  key={co.code}
                  style={[
                    styles.optionRow,
                    { backgroundColor: c.surface, borderColor: selected ? '#3CB371' : 'transparent' },
                  ]}
                  onPress={() => setCountry(co.code)}
                >
                  <Text style={styles.flag}>{co.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: c.text }]}>{co.label}</Text>
                    <Text style={[styles.optionSub, { color: c.muted }]}>{co.currency}</Text>
                  </View>
                  {selected && <Check size={20} color="#3CB371" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {step === 'business' && (
          <View style={styles.list}>
            <Field
              icon={<Building2 size={18} color={c.muted} />}
              label="Business name"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your registered name or trading name"
              c={c}
              autoCapitalize="words"
            />
            <Text style={[styles.helper, { color: c.muted }]}>
              This is the name customers see on their receipts and the payment confirmation page.
            </Text>
          </View>
        )}

        {step === 'bank' && (
          <View style={styles.list}>
            {banksLoading ? (
              <ActivityIndicator color={c.text} style={{ marginTop: 24 }} />
            ) : (
              <>
                <Text style={[styles.subhead, { color: c.muted }]}>Bank</Text>
                <ScrollView
                  style={[styles.bankList, { backgroundColor: c.surface }]}
                  nestedScrollEnabled
                >
                  {banks.map((b) => {
                    const selected = b.code === bankCode;
                    return (
                      <TouchableOpacity
                        key={b.code}
                        style={[
                          styles.bankRow,
                          selected && { backgroundColor: c.bg },
                        ]}
                        onPress={() => setBankCode(b.code)}
                      >
                        <Text style={[styles.bankName, { color: c.text }]} numberOfLines={1}>
                          {b.name}
                        </Text>
                        {selected && <Check size={18} color="#3CB371" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.subhead, { color: c.muted, marginTop: 16 }]}>Account number</Text>
                <Field
                  icon={<CreditCard size={18} color={c.muted} />}
                  label=""
                  value={accountNumber}
                  onChangeText={(text) => setAccountNumber(text.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 0123456789"
                  keyboardType="number-pad"
                  c={c}
                />
              </>
            )}
          </View>
        )}

        {step === 'verify' && (
          <View style={styles.list}>
            <View style={[styles.summary, { backgroundColor: c.surface }]}>
              <Row label="Business" value={businessName} c={c} />
              <Row label="Country" value={COUNTRIES.find((co) => co.code === country)?.label ?? country} c={c} />
              <Row label="Bank" value={selectedBank?.name ?? bankCode} c={c} />
              <Row label="Account" value={accountNumber} c={c} />
              <Row label="Account name" value={resolvedName} c={c} highlight />
            </View>
            <Text style={[styles.helper, { color: c.muted }]}>
              Make sure the account name matches your business records. Paystack will deposit invoice payments to this account, minus the customer-paid transaction fee.
            </Text>
          </View>
        )}

        {step === 'done' && (
          <View style={styles.done}>
            <View style={styles.doneIconWrap}>
              <Check size={36} color="#fff" strokeWidth={3} />
            </View>
            <Text style={[styles.doneTitle, { color: c.text }]}>You're connected</Text>
            <Text style={[styles.doneBody, { color: c.muted }]}>
              New invoices will generate Paystack payment links. Customers can pay with mobile money, card, or bank transfer. Payouts settle to your account.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: c.bg }]}>
        {step === 'done' ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#3CB371' }]}
            onPress={() => nav.goBack()}
          >
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: '#3CB371', opacity: resolving || submitting ? 0.5 : 1 },
            ]}
            onPress={goNext}
            disabled={resolving || submitting}
          >
            {resolving || submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {step === 'bank' ? 'Verify account' : step === 'verify' ? 'Connect' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'words';
  c: { text: string; surface: string; muted: string };
}) {
  return (
    <View style={[styles.field, { backgroundColor: props.c.surface }]}>
      {props.icon}
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={props.c.muted}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        style={[styles.input, { color: props.c.text }]}
      />
    </View>
  );
}

function Row({
  label,
  value,
  c,
  highlight,
}: {
  label: string;
  value: string;
  c: { text: string; muted: string };
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: c.muted }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: c.text, fontWeight: highlight ? '700' : '500' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  h1: { fontSize: 26, fontWeight: '700', marginBottom: 20 },
  subhead: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  list: { gap: 10 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    gap: 14,
  },
  flag: { fontSize: 28 },
  optionTitle: { fontSize: 17, fontWeight: '600' },
  optionSub: { fontSize: 13, marginTop: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  input: { flex: 1, fontSize: 16, padding: 0 },
  helper: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  bankList: { maxHeight: 240, borderRadius: 12 },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  bankName: { flex: 1, fontSize: 15 },
  summary: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 15, maxWidth: '60%', textAlign: 'right' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  done: { alignItems: 'center', paddingTop: 32, gap: 12 },
  doneIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#3CB371',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  doneTitle: { fontSize: 22, fontWeight: '700' },
  doneBody: { fontSize: 15, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
});
