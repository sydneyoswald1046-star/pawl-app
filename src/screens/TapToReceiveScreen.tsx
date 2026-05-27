import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  X,
  Wifi,
  CheckCircle2,
  Bluetooth,
  Smartphone,
  ShoppingCart,
} from 'lucide-react-native';
import { useStripeTerminal, Reader } from '@stripe/stripe-terminal-react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { detectNfcCapability, NfcCapability } from '../lib/nfcCapability';
import { createTerminalPaymentIntent } from '../lib/terminal';

type RouteParams = {
  invoiceId?: string;
  amount?: number;
  currency?: string;
};

type Phase =
  | 'idle'
  | 'initializing'
  | 'discovering'
  | 'connecting'
  | 'ready'
  | 'creating-intent'
  | 'awaiting-tap'
  | 'confirming'
  | 'success'
  | 'error';

export default function TapToReceiveScreen() {
  const { c } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const params = (route.params ?? {}) as RouteParams;

  const initialCapability = useMemo(() => detectNfcCapability(), []);
  const [capability, setCapability] = useState<NfcCapability>(initialCapability);
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader.Type[]>([]);
  const [activeReader, setActiveReader] = useState<Reader.Type | null>(null);

  const {
    initialize,
    discoverReaders,
    cancelDiscovering,
    connectReader,
    disconnectReader,
    retrievePaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
    cancelCollectPaymentMethod,
    connectedReader,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: (readers) => {
      setDiscoveredReaders(readers);
    },
  });

  // Initialize the SDK once when the screen mounts. The SDK is idempotent —
  // re-initializing on a remount is safe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('initializing');
      try {
        const { error } = await initialize();
        if (cancelled) return;
        if (error) {
          setPhase('error');
          setErrorMsg(error.message);
          return;
        }
        setPhase('idle');
      } catch (e) {
        if (!cancelled) {
          setPhase('error');
          setErrorMsg((e as Error).message);
        }
      }
    })();
    return () => {
      cancelled = true;
      cancelDiscovering();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startBuiltInFlow = useCallback(async () => {
    if (!params.invoiceId || !params.amount) {
      Alert.alert('Tap to Pay', 'Open this from an invoice to charge.');
      return;
    }
    setPhase('discovering');
    setErrorMsg('');
    try {
      const { error } = await discoverReaders({
        discoveryMethod: 'tapToPay',
        simulated: __DEV__,
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      setPhase('error');
      setErrorMsg((e as Error).message);
    }
  }, [discoverReaders, params.amount, params.invoiceId]);

  const startExternalFlow = useCallback(async () => {
    if (!params.invoiceId || !params.amount) {
      Alert.alert('Tap to Pay', 'Open this from an invoice to charge.');
      return;
    }
    setPhase('discovering');
    setErrorMsg('');
    try {
      const { error } = await discoverReaders({
        discoveryMethod: 'bluetoothScan',
        simulated: __DEV__,
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      setPhase('error');
      setErrorMsg((e as Error).message);
    }
  }, [discoverReaders, params.amount, params.invoiceId]);

  const pickReader = useCallback(
    async (reader: Reader.Type) => {
      setPhase('connecting');
      setActiveReader(reader);
      try {
        const locationId = reader.locationId ?? '';
        const { error } = await connectReader(
          capability === 'builtin'
            ? { discoveryMethod: 'tapToPay', reader, locationId }
            : { discoveryMethod: 'bluetoothScan', reader, locationId },
        );
        if (error) throw new Error(error.message);
        setPhase('ready');
        // Auto-progress to payment intent creation.
        await charge();
      } catch (e) {
        setPhase('error');
        setErrorMsg((e as Error).message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capability, connectReader],
  );

  const charge = useCallback(async () => {
    if (!params.invoiceId || !params.amount) return;
    setPhase('creating-intent');
    try {
      const { clientSecret } = await createTerminalPaymentIntent({
        invoiceId: params.invoiceId,
        amount: params.amount,
        currency: params.currency,
      });
      const { paymentIntent: retrieved, error: retrieveErr } =
        await retrievePaymentIntent(clientSecret);
      if (retrieveErr || !retrieved) {
        throw new Error(retrieveErr?.message ?? 'Failed to retrieve intent');
      }
      setPhase('awaiting-tap');
      const { paymentIntent: collected, error: collectErr } =
        await collectPaymentMethod({ paymentIntent: retrieved });
      if (collectErr || !collected) {
        throw new Error(collectErr?.message ?? 'Failed to collect payment');
      }
      setPhase('confirming');
      const { error: confirmErr } = await confirmPaymentIntent({
        paymentIntent: collected,
      });
      if (confirmErr) throw new Error(confirmErr.message);
      setPhase('success');
    } catch (e) {
      setPhase('error');
      setErrorMsg((e as Error).message);
    }
  }, [
    params.amount,
    params.currency,
    params.invoiceId,
    retrievePaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
  ]);

  const reset = useCallback(async () => {
    await cancelCollectPaymentMethod();
    if (connectedReader) await disconnectReader();
    setActiveReader(null);
    setDiscoveredReaders([]);
    setErrorMsg('');
    setPhase('idle');
  }, [cancelCollectPaymentMethod, connectedReader, disconnectReader]);

  const amountLabel = formatAmount(params.amount, params.currency);

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.text }]}>{t('tap.title')}</Text>
          <Text style={[styles.subtitle, { color: c.sub }]}>
            {capability === 'builtin' && t('tap.sub_builtin')}
            {capability === 'external' && t('tap.sub_external')}
            {capability === 'unsupported' && t('tap.sub_unsupported')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={[styles.closeBtn, { backgroundColor: c.elevated }]}
          hitSlop={10}
        >
          <X size={18} color={c.sub} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {params.invoiceId && (
        <View style={[styles.amountBar, { backgroundColor: c.elevated }]}>
          <Text style={[styles.amountLabel, { color: c.sub }]}>Charging</Text>
          <Text style={[styles.amountValue, { color: c.text }]}>{amountLabel}</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {phase === 'error' && (
          <ErrorCard
            message={errorMsg}
            onRetry={capability === 'builtin' ? startBuiltInFlow : startExternalFlow}
            onReset={reset}
            c={c}
          />
        )}

        {phase !== 'error' && capability === 'builtin' && (
          <BuiltInFlow
            phase={phase}
            amountLabel={amountLabel}
            onStart={startBuiltInFlow}
            onReset={reset}
            discoveredReaders={discoveredReaders}
            onPickReader={pickReader}
            c={c}
          />
        )}

        {phase !== 'error' && capability === 'external' && (
          <ExternalFlow
            phase={phase}
            amountLabel={amountLabel}
            activeReader={activeReader}
            discoveredReaders={discoveredReaders}
            onStart={startExternalFlow}
            onPickReader={pickReader}
            onReset={reset}
            onBuyReader={() => nav.navigate('BuyReader')}
            c={c}
          />
        )}

        {phase !== 'error' && capability === 'unsupported' && (
          <UnsupportedCard
            onBuyReader={() => nav.navigate('BuyReader')}
            onUseExternal={() => setCapability('external')}
            c={c}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ─── Built-in flow ──────────────────────────────────────────────

function BuiltInFlow(props: {
  phase: Phase;
  amountLabel: string;
  onStart: () => void;
  onReset: () => void;
  discoveredReaders: Reader.Type[];
  onPickReader: (reader: Reader.Type) => void;
  c: any;
}) {
  const { phase, onStart, onReset, discoveredReaders, onPickReader, c } = props;

  // Built-in TTP usually surfaces one "Local Mobile" reader instantly. Pick
  // it automatically as soon as it appears so the user only sees one tap.
  useEffect(() => {
    if (phase === 'discovering' && discoveredReaders.length > 0) {
      onPickReader(discoveredReaders[0]);
    }
  }, [phase, discoveredReaders, onPickReader]);

  return (
    <View style={styles.flowContent}>
      <View style={[styles.iconBubble, { backgroundColor: phaseColor(phase, c) }]}>
        {phase === 'success' ? (
          <CheckCircle2 size={48} color="#fff" strokeWidth={2.3} />
        ) : (
          <Smartphone size={48} color="#fff" strokeWidth={2.3} />
        )}
      </View>

      <Text style={[styles.phaseTitle, { color: c.text }]}>{phaseTitle(phase)}</Text>
      <Text style={[styles.phaseBody, { color: c.sub }]}>{phaseBody(phase)}</Text>

      {phase === 'idle' && (
        <PrimaryBtn
          label="Start Tap to Pay"
          color={c.accent}
          onPress={onStart}
          icon={<Wifi size={18} color="#fff" strokeWidth={2.3} style={{ transform: [{ rotate: '-45deg' }] }} />}
        />
      )}
      {phase === 'awaiting-tap' && (
        <SecondaryBtn label="Cancel" color={c.sub} onPress={onReset} />
      )}
      {phase === 'success' && (
        <PrimaryBtn label="Done" color={c.green} onPress={onReset} icon={<CheckCircle2 size={18} color="#fff" />} />
      )}
      {(phase === 'discovering' ||
        phase === 'connecting' ||
        phase === 'creating-intent' ||
        phase === 'confirming') && (
        <ActivityIndicator color={c.accent} style={{ marginTop: 16 }} />
      )}
    </View>
  );
}

// ─── External reader flow ──────────────────────────────────────

function ExternalFlow(props: {
  phase: Phase;
  amountLabel: string;
  activeReader: Reader.Type | null;
  discoveredReaders: Reader.Type[];
  onStart: () => void;
  onPickReader: (reader: Reader.Type) => void;
  onReset: () => void;
  onBuyReader: () => void;
  c: any;
}) {
  const { phase, discoveredReaders, onStart, onPickReader, onReset, onBuyReader, c } =
    props;

  if (phase === 'idle') {
    return (
      <View style={styles.flowContent}>
        <View style={[styles.iconBubble, { backgroundColor: c.accent }]}>
          <Bluetooth size={48} color="#fff" strokeWidth={2.3} />
        </View>
        <Text style={[styles.phaseTitle, { color: c.text }]}>Pair a reader</Text>
        <Text style={[styles.phaseBody, { color: c.sub }]}>
          Power on your Stripe Reader (M2, S700, or BBPOS) and keep it within 3 feet.
        </Text>
        <PrimaryBtn label="Scan for readers" color={c.accent} onPress={onStart} icon={<Bluetooth size={18} color="#fff" />} />
        <TouchableOpacity onPress={onBuyReader} style={styles.linkBtn}>
          <ShoppingCart size={14} color={c.accent} />
          <Text style={[styles.linkText, { color: c.accent }]}>I don't have a reader yet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'discovering') {
    return (
      <View style={styles.flowContent}>
        <ActivityIndicator color={c.accent} size="large" />
        <Text style={[styles.phaseTitle, { color: c.text, marginTop: 16 }]}>Searching…</Text>
        <Text style={[styles.phaseBody, { color: c.sub }]}>
          Make sure your reader is powered on and not paired to another device.
        </Text>
        {discoveredReaders.length > 0 && (
          <View style={styles.readerList}>
            {discoveredReaders.map((r) => (
              <TouchableOpacity
                key={r.serialNumber ?? r.id}
                style={[styles.readerRow, { backgroundColor: c.elevated }]}
                onPress={() => onPickReader(r)}
              >
                <Bluetooth size={18} color={c.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.readerName, { color: c.text }]}>
                    {r.deviceType ?? 'Reader'}
                  </Text>
                  <Text style={[styles.readerSub, { color: c.sub }]}>
                    {r.serialNumber ?? r.id}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <SecondaryBtn label="Cancel" color={c.sub} onPress={onReset} />
      </View>
    );
  }

  return (
    <View style={styles.flowContent}>
      <View style={[styles.iconBubble, { backgroundColor: phaseColor(phase, c) }]}>
        {phase === 'success' ? (
          <CheckCircle2 size={48} color="#fff" strokeWidth={2.3} />
        ) : (
          <Bluetooth size={48} color="#fff" strokeWidth={2.3} />
        )}
      </View>
      <Text style={[styles.phaseTitle, { color: c.text }]}>{phaseTitle(phase)}</Text>
      <Text style={[styles.phaseBody, { color: c.sub }]}>{phaseBody(phase)}</Text>
      {phase === 'success' ? (
        <PrimaryBtn label="Done" color={c.green} onPress={onReset} icon={<CheckCircle2 size={18} color="#fff" />} />
      ) : (
        <ActivityIndicator color={c.accent} style={{ marginTop: 16 }} />
      )}
    </View>
  );
}

// ─── Unsupported device ────────────────────────────────────────

function UnsupportedCard(props: {
  onBuyReader: () => void;
  onUseExternal: () => void;
  c: any;
}) {
  return (
    <View style={styles.flowContent}>
      <View style={[styles.iconBubble, { backgroundColor: props.c.amber }]}>
        <Smartphone size={48} color="#fff" strokeWidth={2.3} />
      </View>
      <Text style={[styles.phaseTitle, { color: props.c.text }]}>
        Your phone can't tap-to-pay
      </Text>
      <Text style={[styles.phaseBody, { color: props.c.sub }]}>
        Tap to Pay on iPhone needs iPhone XS or newer on iOS 16.4+. Pair a Bluetooth reader instead — they start at $59.
      </Text>
      <PrimaryBtn
        label="Buy a reader"
        color={props.c.accent}
        onPress={props.onBuyReader}
        icon={<ShoppingCart size={18} color="#fff" />}
      />
      <SecondaryBtn
        label="I already have one"
        color={props.c.accent}
        onPress={props.onUseExternal}
      />
    </View>
  );
}

// ─── Error / common bits ───────────────────────────────────────

function ErrorCard(props: {
  message: string;
  onRetry: () => void;
  onReset: () => void;
  c: any;
}) {
  return (
    <View style={styles.flowContent}>
      <View style={[styles.iconBubble, { backgroundColor: props.c.red }]}>
        <X size={48} color="#fff" strokeWidth={2.3} />
      </View>
      <Text style={[styles.phaseTitle, { color: props.c.text }]}>Something went wrong</Text>
      <Text style={[styles.phaseBody, { color: props.c.sub }]}>{props.message || 'Try again.'}</Text>
      <PrimaryBtn label="Try again" color={props.c.accent} onPress={props.onRetry} />
      <SecondaryBtn label="Close" color={props.c.sub} onPress={props.onReset} />
    </View>
  );
}

function PrimaryBtn(props: {
  label: string;
  color: string;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, { backgroundColor: props.color }]}
      onPress={props.onPress}
    >
      {props.icon}
      <Text style={styles.primaryBtnText}>{props.label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryBtn(props: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={props.onPress}>
      <Text style={[styles.secondaryBtnText, { color: props.color }]}>{props.label}</Text>
    </TouchableOpacity>
  );
}

function phaseTitle(phase: Phase): string {
  switch (phase) {
    case 'idle': return 'Ready to tap';
    case 'initializing': return 'Initializing…';
    case 'discovering': return 'Searching…';
    case 'connecting': return 'Connecting…';
    case 'ready': return 'Reader connected';
    case 'creating-intent': return 'Preparing…';
    case 'awaiting-tap': return 'Hold card near phone';
    case 'confirming': return 'Confirming payment…';
    case 'success': return 'Paid';
    case 'error': return 'Something went wrong';
  }
}

function phaseBody(phase: Phase): string {
  switch (phase) {
    case 'idle': return 'Press the button below and present your customer\'s card.';
    case 'initializing': return 'Connecting to Stripe Terminal…';
    case 'discovering': return 'Looking for a reader.';
    case 'connecting': return 'Pairing with the reader.';
    case 'ready': return 'Reader is ready.';
    case 'creating-intent': return 'Preparing the charge.';
    case 'awaiting-tap': return 'Have the customer tap their card, phone, or watch.';
    case 'confirming': return 'Talking to the bank.';
    case 'success': return 'The invoice is marked paid.';
    case 'error': return '';
  }
}

function phaseColor(phase: Phase, c: any): string {
  if (phase === 'success') return c.green;
  if (phase === 'error') return c.red;
  return c.accent;
}

function formatAmount(amount?: number, currency?: string): string {
  if (!amount) return '—';
  const cur = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount);
  } catch {
    return `${cur} ${amount.toFixed(2)}`;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  amountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  amountLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountValue: { fontSize: 22, fontWeight: '700' },
  body: { paddingBottom: 40 },
  flowContent: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  iconBubble: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  phaseTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  phaseBody: { fontSize: 15, textAlign: 'center', lineHeight: 21, paddingHorizontal: 16 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    minWidth: 200,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { padding: 12 },
  secondaryBtnText: { fontSize: 15, fontWeight: '500' },
  linkBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 },
  linkText: { fontSize: 14, fontWeight: '500' },
  readerList: { width: '100%', gap: 8, marginVertical: 16 },
  readerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  readerName: { fontSize: 15, fontWeight: '600' },
  readerSub: { fontSize: 12, marginTop: 2 },
});
