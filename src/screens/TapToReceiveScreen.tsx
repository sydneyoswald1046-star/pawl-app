import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Wifi, CheckCircle2, Bluetooth, Smartphone, ArrowRight, Link2 } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { detectNfcCapability, NfcCapability } from '../lib/nfcCapability';
import { useT } from '../i18n';

type Reader = { id: string; name: string; signal: number };

const MOCK_READERS: Reader[] = [
  { id: 'stripe-m2', name: 'Stripe Reader M2', signal: 0.85 },
  { id: 'bbpos-wp3', name: 'BBPOS WisePad 3', signal: 0.6 },
  { id: 'square', name: 'Square Reader', signal: 0.4 },
];

const MOCK_AMOUNT = 850;

export default function TapToReceiveScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const [capability, setCapability] = useState<NfcCapability>(() => detectNfcCapability());

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

      {capability === 'builtin' && <BuiltInFlow />}
      {capability === 'external' && <ExternalFlow />}
      {capability === 'unsupported' && (
        <UnsupportedView onUseExternal={() => setCapability('external')} />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Built-in Tap to Pay flow (iPhone XS+, iOS 16.4+)
// ─────────────────────────────────────────────────────────────
type BuiltInPhase = 'idle' | 'scanning' | 'success';

function BuiltInFlow() {
  const { c } = useTheme();
  const t = useT();
  const [phase, setPhase] = useState<BuiltInPhase>('idle');

  const start = () => {
    setPhase('scanning');
    // TODO: hand off to Stripe Terminal / payment SDK here
    setTimeout(() => setPhase('success'), 3000);
  };

  const reset = () => setPhase('idle');

  return (
    <View style={styles.flowContent}>
      <ScanVisual
        color={phase === 'success' ? c.green : c.accent}
        active={phase === 'scanning'}
        success={phase === 'success'}
      />

      <View style={styles.flowCopy}>
        {phase === 'idle' && (
          <>
            <Text style={[styles.flowTitle, { color: c.text }]}>{t('tap.ready_title')}</Text>
            <Text style={[styles.flowBody, { color: c.sub }]}>{t('tap.ready_body')}</Text>
          </>
        )}
        {phase === 'scanning' && (
          <>
            <Text style={[styles.flowTitle, { color: c.text }]}>{t('tap.scanning_title')}</Text>
            <Text style={[styles.flowBody, { color: c.sub }]}>{t('tap.scanning_body')}</Text>
          </>
        )}
        {phase === 'success' && (
          <>
            <Text style={[styles.flowTitle, { color: c.green }]}>
              {t('tap.success_title', { amount: `$${MOCK_AMOUNT.toLocaleString()}` })}
            </Text>
            <Text style={[styles.flowBody, { color: c.sub }]}>{t('tap.success_body')}</Text>
          </>
        )}
      </View>

      <View style={styles.actionRow}>
        {phase === 'idle' && (
          <PrimaryButton label={t('common.start')} onPress={start} color={c.accent} icon={<Wifi size={18} color="#fff" strokeWidth={2.3} style={{ transform: [{ rotate: '-45deg' }] }} />} />
        )}
        {phase === 'scanning' && (
          <SecondaryButton label={t('common.cancel')} onPress={reset} color={c.sub} />
        )}
        {phase === 'success' && (
          <PrimaryButton label={t('common.done')} onPress={reset} color={c.green} icon={<CheckCircle2 size={18} color="#fff" strokeWidth={2.3} />} />
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// External reader flow (older iPhones, Android, iPads)
// ─────────────────────────────────────────────────────────────
type ExternalPhase =
  | { kind: 'list' }
  | { kind: 'connecting'; reader: Reader }
  | { kind: 'ready'; reader: Reader }
  | { kind: 'scanning'; reader: Reader }
  | { kind: 'success'; reader: Reader };

function ExternalFlow() {
  const { c } = useTheme();
  const t = useT();
  const [phase, setPhase] = useState<ExternalPhase>({ kind: 'list' });

  const connect = (reader: Reader) => {
    setPhase({ kind: 'connecting', reader });
    // TODO: Stripe Terminal discoverReaders → connectReader
    setTimeout(() => setPhase({ kind: 'ready', reader }), 1800);
  };

  const startCharge = (reader: Reader) => {
    setPhase({ kind: 'scanning', reader });
    // TODO: Stripe Terminal collectPaymentMethod → processPayment
    setTimeout(() => setPhase({ kind: 'success', reader }), 2500);
  };

  if (phase.kind === 'list') {
    return (
      <View style={styles.flowContent}>
        <View style={styles.readerIconWrap}>
          <LinearGradient
            colors={[c.accent + '22', c.accent + '08']}
            style={styles.readerIconCircle}
          >
            <Bluetooth size={34} color={c.accent} strokeWidth={2} />
          </LinearGradient>
        </View>
        <View style={styles.flowCopy}>
          <Text style={[styles.flowTitle, { color: c.text }]}>{t('tap.nearby_title')}</Text>
          <Text style={[styles.flowBody, { color: c.sub }]}>{t('tap.nearby_body')}</Text>
        </View>
        <View style={[styles.readerList, { backgroundColor: c.surface }]}>
          {MOCK_READERS.map((r, i) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.readerRow, i < MOCK_READERS.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: c.muted + '40' }]}
              onPress={() => connect(r)}
              activeOpacity={0.7}
            >
              <View style={[styles.readerIconSmall, { backgroundColor: c.accent + '18' }]}>
                <Bluetooth size={16} color={c.accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.readerName, { color: c.text }]}>{r.name}</Text>
                <Text style={[styles.readerSignal, { color: c.sub }]}>
                  {t('tap.signal', { pct: Math.round(r.signal * 100) })}
                </Text>
              </View>
              <ArrowRight size={16} color={c.faint} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  if (phase.kind === 'connecting') {
    return (
      <View style={styles.flowContent}>
        <View style={styles.readerIconWrap}>
          <View style={[styles.readerIconCircle, { backgroundColor: c.elevated }]}>
            <ActivityIndicator size="large" color={c.accent} />
          </View>
        </View>
        <View style={styles.flowCopy}>
          <Text style={[styles.flowTitle, { color: c.text }]}>{t('tap.pairing_title')}</Text>
          <Text style={[styles.flowBody, { color: c.sub }]}>
            {t('tap.pairing_body', { name: phase.reader.name })}
          </Text>
        </View>
      </View>
    );
  }

  // ready / scanning / success share the ScanVisual
  return (
    <View style={styles.flowContent}>
      <ScanVisual
        color={phase.kind === 'success' ? c.green : c.accent}
        active={phase.kind === 'scanning'}
        success={phase.kind === 'success'}
      />
      <View style={styles.connectedPill}>
        <View style={[styles.dot, { backgroundColor: c.green }]} />
        <Text style={[styles.connectedText, { color: c.sub }]}>
          {t('tap.paired_pill', { name: phase.reader.name })}
        </Text>
      </View>
      <View style={styles.flowCopy}>
        {phase.kind === 'ready' && (
          <>
            <Text style={[styles.flowTitle, { color: c.text }]}>{t('tap.ext_ready_title')}</Text>
            <Text style={[styles.flowBody, { color: c.sub }]}>{t('tap.ext_ready_body')}</Text>
          </>
        )}
        {phase.kind === 'scanning' && (
          <>
            <Text style={[styles.flowTitle, { color: c.text }]}>{t('tap.ext_scanning_title')}</Text>
            <Text style={[styles.flowBody, { color: c.sub }]}>{t('tap.ext_scanning_body')}</Text>
          </>
        )}
        {phase.kind === 'success' && (
          <>
            <Text style={[styles.flowTitle, { color: c.green }]}>
              {t('tap.success_title', { amount: `$${MOCK_AMOUNT.toLocaleString()}` })}
            </Text>
            <Text style={[styles.flowBody, { color: c.sub }]}>{t('tap.success_body')}</Text>
          </>
        )}
      </View>
      <View style={styles.actionRow}>
        {phase.kind === 'ready' && (
          <PrimaryButton label={t('common.start')} color={c.accent} onPress={() => startCharge(phase.reader)} icon={<Wifi size={18} color="#fff" strokeWidth={2.3} style={{ transform: [{ rotate: '-45deg' }] }} />} />
        )}
        {phase.kind === 'scanning' && (
          <SecondaryButton label={t('common.cancel')} onPress={() => setPhase({ kind: 'ready', reader: phase.reader })} color={c.sub} />
        )}
        {phase.kind === 'success' && (
          <PrimaryButton label={t('common.done')} color={c.green} onPress={() => setPhase({ kind: 'ready', reader: phase.reader })} icon={<CheckCircle2 size={18} color="#fff" strokeWidth={2.3} />} />
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Unsupported device view
// ─────────────────────────────────────────────────────────────
function UnsupportedView({ onUseExternal }: { onUseExternal: () => void }) {
  const { c } = useTheme();
  const t = useT();
  return (
    <View style={styles.flowContent}>
      <View style={styles.readerIconWrap}>
        <View style={[styles.readerIconCircle, { backgroundColor: c.elevated }]}>
          <Smartphone size={34} color={c.sub} strokeWidth={1.8} />
        </View>
      </View>
      <View style={styles.flowCopy}>
        <Text style={[styles.flowTitle, { color: c.text }]}>{t('tap.unsupported_title')}</Text>
        <Text style={[styles.flowBody, { color: c.sub }]}>{t('tap.unsupported_body')}</Text>
      </View>
      <View style={styles.actionRow}>
        <PrimaryButton
          label={t('tap.pair_reader')}
          onPress={onUseExternal}
          color={c.accent}
          icon={<Link2 size={18} color="#fff" strokeWidth={2.3} />}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared visuals
// ─────────────────────────────────────────────────────────────
function ScanVisual({ color, active, success }: { color: string; active: boolean; success: boolean }) {
  const pulse = useSharedValue(0);
  const successScale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    } else {
      pulse.value = 0;
    }
  }, [active, pulse]);

  useEffect(() => {
    if (success) {
      successScale.value = withSequence(
        withTiming(1.15, { duration: 240, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 180 })
      );
    }
  }, [success, successScale]);

  const ring1 = useAnimatedStyle(() => ({
    opacity: active ? Math.max(0, 0.35 - pulse.value * 0.35) : 0,
    transform: [{ scale: active ? 1 + pulse.value * 0.9 : 1 }],
  }));
  const ring2 = useAnimatedStyle(() => {
    const p = (pulse.value + 0.33) % 1;
    return {
      opacity: active ? Math.max(0, 0.3 - p * 0.3) : 0,
      transform: [{ scale: active ? 1 + p * 0.9 : 1 }],
    };
  });
  const ring3 = useAnimatedStyle(() => {
    const p = (pulse.value + 0.66) % 1;
    return {
      opacity: active ? Math.max(0, 0.25 - p * 0.25) : 0,
      transform: [{ scale: active ? 1 + p * 0.9 : 1 }],
    };
  });
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

  return (
    <View style={styles.scanVisual}>
      <Animated.View style={[styles.ring, { borderColor: color }, ring1]} />
      <Animated.View style={[styles.ring, { borderColor: color }, ring2]} />
      <Animated.View style={[styles.ring, { borderColor: color }, ring3]} />
      <Animated.View style={[styles.coreCircle, { backgroundColor: color + '18', borderColor: color + '55' }, coreStyle]}>
        {success ? (
          <CheckCircle2 size={52} color={color} strokeWidth={2.2} />
        ) : (
          <Wifi size={52} color={color} strokeWidth={2} style={{ transform: [{ rotate: '-45deg' }] }} />
        )}
      </Animated.View>
    </View>
  );
}

function PrimaryButton({ label, onPress, color, icon }: { label: string; onPress: () => void; color: string; icon?: React.ReactNode }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.primaryBtnWrap}>
      <LinearGradient
        colors={[color, shade(color, -0.2)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.primaryBtn, { shadowColor: color }]}
      >
        {icon}
        <Text style={styles.primaryBtnText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.secondaryBtn]}>
      <Text style={[styles.secondaryBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function shade(hex: string, amount: number): string {
  // naive: if hex, darken/lighten by amount (-1..1)
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = clamp(Math.round(((num >> 16) & 0xff) * (1 + amount)));
  const g = clamp(Math.round(((num >> 8) & 0xff) * (1 + amount)));
  const b = clamp(Math.round((num & 0xff) * (1 + amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
function clamp(n: number) { return Math.max(0, Math.min(255, n)); }

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 28 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  flowContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  flowCopy: { alignItems: 'center', marginTop: 32, marginBottom: 28, paddingHorizontal: 20 },
  flowTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginBottom: 8, textAlign: 'center' },
  flowBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  actionRow: { width: '100%', alignItems: 'center' },

  scanVisual: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5 },
  coreCircle: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  primaryBtnWrap: { width: '100%' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  secondaryBtn: { paddingVertical: 14 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },

  readerIconWrap: { marginBottom: 8 },
  readerIconCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  readerList: { borderRadius: 16, width: '100%', overflow: 'hidden', marginTop: 4 },
  readerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  readerIconSmall: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  readerName: { fontSize: 15, fontWeight: '600' },
  readerSignal: { fontSize: 12, marginTop: 2 },

  connectedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  connectedText: { fontSize: 12, fontWeight: '500' },
});
