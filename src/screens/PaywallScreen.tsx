import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check, Sparkles, Infinity as InfinityIcon, Banknote, FileText, BellRing, Briefcase } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { useProfile } from '../data/profile';
import { startSubscriptionCheckout } from '../lib/subscriptions';
import { getEntitlements } from '../lib/entitlements';

type Plan = 'monthly' | 'yearly';

export default function PaywallScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const profile = useProfile();
  const ent = getEntitlements(profile);

  const [plan, setPlan] = useState<Plan>('yearly');
  const [busy, setBusy] = useState(false);

  const onSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await startSubscriptionCheckout(plan);
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const features: Array<{ Icon: typeof Check; label: string }> = [
    { Icon: InfinityIcon, label: t('paywall.feature_unlimited') },
    { Icon: Banknote, label: t('paywall.feature_stripe') },
    { Icon: FileText, label: t('paywall.feature_pdf') },
    { Icon: BellRing, label: t('paywall.feature_reminders') },
    { Icon: Briefcase, label: t('paywall.feature_branding') },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.closeRow}>
          <TouchableOpacity onPress={() => nav.goBack()} style={[styles.closeBtn, { backgroundColor: c.elevated }]} hitSlop={10}>
            <X size={18} color={c.sub} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={[c.accent, '#6d28d9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Sparkles size={32} color="#fff" strokeWidth={2.2} />
          <Text style={styles.heroTitle}>{t('paywall.title')}</Text>
          <Text style={styles.heroSub}>{t('paywall.subtitle')}</Text>
        </LinearGradient>

        {ent.isPro && (
          <View style={[styles.activeBadge, { backgroundColor: c.green + '22', borderColor: c.green + '55' }]}>
            <Text style={[styles.activeBadgeText, { color: c.green }]}>{t('paywall.already_pro')}</Text>
          </View>
        )}

        <View style={styles.features}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: c.accent + '22' }]}>
                <f.Icon size={16} color={c.accent} strokeWidth={2.2} />
              </View>
              <Text style={[styles.featureText, { color: c.text }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.planRow}>
          <PlanCard
            active={plan === 'yearly'}
            onPress={() => setPlan('yearly')}
            priceLabel="$79"
            periodLabel={t('paywall.per_year')}
            ribbon={t('paywall.best_value')}
            sub={t('paywall.save_27')}
            c={c}
          />
          <PlanCard
            active={plan === 'monthly'}
            onPress={() => setPlan('monthly')}
            priceLabel="$9"
            periodLabel={t('paywall.per_month')}
            sub={t('paywall.flex_cancel')}
            c={c}
          />
        </View>

        <TouchableOpacity
          onPress={onSubscribe}
          disabled={busy || ent.isPro}
          activeOpacity={0.85}
          style={{ marginTop: 8, opacity: busy || ent.isPro ? 0.5 : 1 }}
        >
          <LinearGradient
            colors={[c.accent, '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cta, { shadowColor: c.accent }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>{t('paywall.cta_start_trial')}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.fine, { color: c.faint }]}>{t('paywall.trial_disclaimer')}</Text>

        <TouchableOpacity onPress={() => nav.goBack()} style={{ marginTop: 18 }}>
          <Text style={[styles.continueFree, { color: c.sub }]}>{t('paywall.continue_free')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function PlanCard({
  active,
  onPress,
  priceLabel,
  periodLabel,
  ribbon,
  sub,
  c,
}: {
  active: boolean;
  onPress: () => void;
  priceLabel: string;
  periodLabel: string;
  ribbon?: string;
  sub: string;
  c: any;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={[
          styles.planCard,
          {
            backgroundColor: c.surface,
            borderColor: active ? c.accent : c.faint + '33',
            borderWidth: active ? 2 : 1,
          },
        ]}
      >
        {ribbon && (
          <View style={[styles.ribbon, { backgroundColor: c.accent }]}>
            <Text style={styles.ribbonText}>{ribbon}</Text>
          </View>
        )}
        <Text style={[styles.planPrice, { color: c.text }]}>{priceLabel}</Text>
        <Text style={[styles.planPeriod, { color: c.sub }]}>{periodLabel}</Text>
        <Text style={[styles.planSub, { color: c.faint }]}>{sub}</Text>
        {active && (
          <View style={[styles.tickWrap, { backgroundColor: c.accent }]}>
            <Check size={12} color="#fff" strokeWidth={3} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  hero: { borderRadius: 24, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 10, marginBottom: 24 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.4, textAlign: 'center' },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20 },

  activeBadge: { paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginBottom: 16, borderWidth: 1 },
  activeBadgeText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },

  features: { gap: 12, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, fontWeight: '500', flex: 1, lineHeight: 19 },

  planRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  planCard: {
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  planPrice: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginBottom: 2 },
  planPeriod: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  planSub: { fontSize: 11, marginTop: 8, textAlign: 'center' },
  ribbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  ribbonText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.6 },
  tickWrap: { position: 'absolute', top: 8, left: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  cta: {
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  fine: { fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16 },
  continueFree: { fontSize: 14, textAlign: 'center', fontWeight: '600' },
});
