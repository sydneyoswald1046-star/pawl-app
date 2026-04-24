import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Sun, Moon, FileText, Users, RotateCcw, BarChart3, ChevronRight, ArrowUpRight, ArrowDownRight, Wifi } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { useTheme, getTierColors } from '../theme';
import LifeLine from '../components/LifeLine';
import PulseGlow from '../components/PulseGlow';
import {
  useInvoices,
  formatDateShort,
  summarizeOutstanding,
  summarizeOverdue,
} from '../data/invoices';
import { useT, tPlural } from '../i18n';

const currentEarnings = 12425;
const prevEarnings = 10520;

const heroSeries = [42, 58, 50, 74, 68, 60, 82, 76, 91, 84, 96, 88];
const outstandingSeries = [28, 36, 32, 44, 40, 52, 48, 58, 54];
const overdueSeries = [10, 14, 12, 22, 30, 28, 38, 44, 40];

export default function DashboardScreen() {
  const { c, dark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const t = useT();
  const tc = getTierColors(currentEarnings, prevEarnings, dark);

  const invoices = useInvoices();
  const recentInvoices = useMemo(() => invoices.slice(0, 4), [invoices]);
  const outstanding = useMemo(() => summarizeOutstanding(invoices), [invoices]);
  const overdue = useMemo(() => summarizeOverdue(invoices), [invoices]);

  const statusColor = {
    paid: c.green,
    pending: c.amber,
    overdue: c.red,
  };

  const statusLabel = {
    paid: t('status.paid'),
    pending: t('status.pending'),
    overdue: t('status.overdue'),
  };

  const tierLabel =
    tc.tier === 'gold' ? t('tier.up') : tc.tier === 'red' ? t('tier.critical') : t('tier.dip');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('greeting.morning');
    if (h < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  })();

  const pendingOnly = outstanding.count - overdue.count;

  const quickActions = [
    { Icon: FileText, label: t('dashboard.qa_invoice'), color: c.accent, onPress: () => navigation.navigate('Invoices') },
    { Icon: Users, label: t('dashboard.qa_clients'), color: c.green, onPress: () => navigation.navigate('Clients') },
    { Icon: RotateCcw, label: t('dashboard.qa_remind'), color: c.amber, onPress: () => navigation.navigate('Reminders') },
    { Icon: BarChart3, label: t('dashboard.qa_reports'), color: c.sub, onPress: () => navigation.navigate('Reports') },
  ];

  const openInvoice = (id: string) => navigation.navigate('InvoiceDetail', { id });

  const tapToReceive = () => navigation.navigate('TapToReceive');

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: c.text }]}>{greeting}</Text>
            <Text style={[styles.subGreeting, { color: c.sub }]}>
              {pendingOnly > 0 && overdue.count > 0 ? (
                <>
                  <Text style={{ color: c.amber, fontWeight: '600' }}>
                    {t('dashboard.subtitle_pending_only', { count: pendingOnly })}
                  </Text>
                  {' · '}
                  <Text style={{ color: c.red, fontWeight: '600' }}>
                    {t('dashboard.subtitle_overdue_only', { count: overdue.count })}
                  </Text>
                </>
              ) : pendingOnly > 0 ? (
                <Text style={{ color: c.amber, fontWeight: '600' }}>
                  {t('dashboard.subtitle_pending_only', { count: pendingOnly })}
                </Text>
              ) : overdue.count > 0 ? (
                <Text style={{ color: c.red, fontWeight: '600' }}>
                  {t('dashboard.subtitle_overdue_only', { count: overdue.count })}
                </Text>
              ) : (
                t('dashboard.subtitle_none')
              )}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={toggle}
              style={[styles.themeBtn, { backgroundColor: c.elevated }]}
            >
              {dark ? <Sun size={16} color={c.sub} strokeWidth={1.8} /> : <Moon size={16} color={c.sub} strokeWidth={1.8} />}
            </TouchableOpacity>
            <LinearGradient
              colors={[c.accent, '#6d28d9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>O</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.content}>

          {/* ── Total Earned ── */}
          <View style={styles.heroWrap}>
            <LinearGradient
              colors={[tc.gradStart, tc.gradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <PulseGlow color={tc.accent} borderRadius={24} />
              <View style={styles.heroContent}>
                <View style={styles.heroHeader}>
                  <Text style={[styles.heroLabel, { color: c.sub }]}>{t('dashboard.total_earned')}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: tc.accent + '22' }]}>
                    <Text style={[styles.tierText, { color: tc.accent }]}>{tierLabel.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={[styles.heroAmount, { color: c.text }]}>${currentEarnings.toLocaleString()}</Text>

                <View style={styles.trendRow}>
                  <View style={[styles.trendBadge, { backgroundColor: tc.accent + '1c' }]}>
                    {tc.diff > 0
                      ? <ArrowUpRight size={13} color={tc.accent} strokeWidth={2.5} />
                      : <ArrowDownRight size={13} color={tc.accent} strokeWidth={2.5} />
                    }
                    <Text style={[styles.trendText, { color: tc.accent }]}>
                      {tc.diff > 0 ? '+' : ''}{tc.diff.toFixed(1)}%
                    </Text>
                  </View>
                  <Text style={[styles.trendSub, { color: c.sub }]}>{t('dashboard.vs_last_month')}</Text>
                </View>

                <LifeLine
                  data={heroSeries}
                  color={tc.accent}
                  height={70}
                  strokeWidth={2.2}
                  gradientId="heroGrad"
                />
              </View>
            </LinearGradient>
          </View>

          {/* ── Outstanding & Overdue ── */}
          <View style={styles.statsRow}>
            <View style={styles.statWrap}>
              <LinearGradient
                colors={dark ? ['#081410', '#060d0a'] : ['#f0fdf4', '#e8faee']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCard}
              >
                <PulseGlow color={c.green} borderRadius={18} duration={2800} />
                <View style={styles.statContent}>
                  <Text style={[styles.statLabel, { color: c.green }]}>{t('dashboard.outstanding')}</Text>
                  <Text style={[styles.statAmount, { color: c.text }]}>${outstanding.amount.toLocaleString()}</Text>
                  <Text style={[styles.statSub, { color: c.sub }]}>
                    {outstanding.count} {outstanding.count === 1 ? t('plural.invoice_one') : t('plural.invoice_other')}
                  </Text>
                  <LifeLine
                    data={outstandingSeries}
                    color={c.green}
                    height={36}
                    strokeWidth={1.8}
                    gradientId="outstandingGrad"
                  />
                </View>
              </LinearGradient>
            </View>

            <View style={styles.statWrap}>
              <LinearGradient
                colors={dark ? ['#140808', '#0d0606'] : ['#fef2f2', '#fce8e8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCard}
              >
                <PulseGlow color={c.red} borderRadius={18} duration={2200} />
                <View style={styles.statContent}>
                  <Text style={[styles.statLabel, { color: c.red }]}>{t('dashboard.overdue')}</Text>
                  <Text style={[styles.statAmount, { color: c.text }]}>${overdue.amount.toLocaleString()}</Text>
                  <Text style={[styles.statSub, { color: c.sub }]}>
                    {overdue.maxDaysLate > 0
                      ? tPlural(t, 'plural.day_late', overdue.maxDaysLate)
                      : t('dashboard.on_track')}
                  </Text>
                  <LifeLine
                    data={overdueSeries}
                    color={c.red}
                    height={36}
                    strokeWidth={1.8}
                    gradientId="overdueGrad"
                  />
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* ── Tap to Receive ── */}
          <TouchableOpacity activeOpacity={0.85} onPress={tapToReceive}>
            <LinearGradient
              colors={[c.accent, '#6d28d9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tapBar}
            >
              <Wifi size={22} color="#fff" strokeWidth={2} style={{ transform: [{ rotate: '-45deg' }] }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tapTitle}>{t('dashboard.tap_title')}</Text>
                <Text style={styles.tapSub}>{t('dashboard.tap_sub')}</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Quick Actions ── */}
          <View style={styles.actionsRow}>
            {quickActions.map((a, i) => (
              <TouchableOpacity key={i} style={styles.actionItem} activeOpacity={0.75} onPress={a.onPress}>
                <View style={[styles.actionIcon, { backgroundColor: a.color + '22', borderColor: a.color + '33' }]}>
                  <a.Icon size={26} color={a.color} strokeWidth={2.4} />
                </View>
                <Text style={[styles.actionLabel, { color: c.text }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Recent ── */}
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, { color: c.accent }]}>{t('dashboard.recent')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Invoices')}>
              <Text style={[styles.viewAll, { color: c.sub }]}>{t('dashboard.view_all')}</Text>
            </TouchableOpacity>
          </View>

          {recentInvoices.map((inv) => (
            <TouchableOpacity
              key={inv.id}
              activeOpacity={0.7}
              onPress={() => openInvoice(inv.id)}
              style={[styles.invoiceRow, { backgroundColor: c.surface }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.invClient, { color: c.text }]}>{inv.client}</Text>
                <Text style={[styles.invService, { color: c.sub }]}>{inv.service} · {formatDateShort(inv.dueDate)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.invAmount, { color: c.text }]}>${inv.amount.toLocaleString()}</Text>
                <Text style={[styles.invStatus, { color: statusColor[inv.status] }]}>
                  {statusLabel[inv.status]}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  greeting: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subGreeting: { fontSize: 14, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  content: { paddingHorizontal: 16 },

  // Hero
  heroWrap: { marginBottom: 20 },
  heroCard: { borderRadius: 24, overflow: 'hidden' },
  heroContent: { padding: 24, paddingBottom: 12 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heroLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tierText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  heroAmount: { fontSize: 52, fontWeight: '800', letterSpacing: -1.5, marginBottom: 12 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  trendText: { fontSize: 13, fontWeight: '700' },
  trendSub: { fontSize: 12 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statWrap: { flex: 1 },
  statCard: { borderRadius: 18, overflow: 'hidden' },
  statContent: { padding: 18, paddingBottom: 10 },
  statLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  statAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 8, marginBottom: 4 },
  statSub: { fontSize: 12, marginBottom: 6 },

  // Tap to Receive
  tapBar: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 18, marginBottom: 26 },
  tapTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  tapSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  // Quick Actions
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, paddingHorizontal: 4 },
  actionItem: { alignItems: 'center', gap: 10 },
  actionIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },

  // Recent
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  recentTitle: { fontSize: 17, fontWeight: '600' },
  viewAll: { fontSize: 13, fontWeight: '500' },
  invoiceRow: { borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  invClient: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  invService: { fontSize: 12 },
  invAmount: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  invStatus: { fontSize: 11, fontWeight: '600' },
});
