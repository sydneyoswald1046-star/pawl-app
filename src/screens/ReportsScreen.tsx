import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react-native';
import { useTheme } from '../theme';
import {
  useInvoices,
  monthlyRevenue,
  revenueInPeriod,
  topClientsByRevenue,
  statusBreakdown,
  periodLabel,
  type ReportPeriod,
  type MonthRevenue,
  type Invoice,
} from '../data/invoices';
import { useT } from '../i18n';

export default function ReportsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const invoices = useInvoices();
  const [period, setPeriod] = useState<ReportPeriod>('month');

  const PERIODS: { key: ReportPeriod; label: string }[] = [
    { key: 'month', label: t('reports.period_month') },
    { key: '3months', label: t('reports.period_3months') },
    { key: 'year', label: t('reports.period_year') },
    { key: 'all', label: t('reports.period_all') },
  ];

  const { current, previous, delta, months, top, status } = useMemo(() => {
    const today = new Date();
    const curr = revenueInPeriod(invoices, period, today);
    // previous period for delta — step back same duration
    let prev: { amount: number; count: number; invoices: Invoice[] } = {
      amount: 0,
      count: 0,
      invoices: [],
    };
    if (period === 'month') {
      const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      prev = revenueInPeriod(invoices, 'month', prevDate);
    } else if (period === '3months') {
      const prevDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      prev = revenueInPeriod(invoices, '3months', prevDate);
    }
    const pct = prev.amount > 0 ? ((curr.amount - prev.amount) / prev.amount) * 100 : null;

    return {
      current: curr,
      previous: prev,
      delta: pct,
      months: monthlyRevenue(invoices, 6, today),
      top: topClientsByRevenue(invoices, 5, true),
      status: statusBreakdown(invoices, today),
    };
  }, [invoices, period]);

  const avgInvoice = current.count > 0 ? current.amount / current.count : 0;
  const periodTitle = periodLabel(period);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>{t('reports.title')}</Text>
            <Text style={[styles.subtitle, { color: c.sub }]}>{t('reports.subtitle')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => nav.goBack()}
            style={[styles.closeBtn, { backgroundColor: c.elevated }]}
            hitSlop={10}
          >
            <X size={18} color={c.sub} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Period */}
        <View style={styles.chipRow}>
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                activeOpacity={0.8}
                onPress={() => setPeriod(p.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.accent : c.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#fff' : c.text, fontWeight: active ? '700' : '600' },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: c.surface }]}>
          <LinearGradient
            colors={[c.accent + '18', c.accent + '00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.heroLabel, { color: c.sub }]}>{t('reports.total_earned')}</Text>
          <Text style={[styles.heroAmount, { color: c.text }]}>
            ${current.amount.toLocaleString()}
          </Text>
          <View style={styles.heroMeta}>
            <Text style={[styles.heroMetaText, { color: c.sub }]}>
              {periodTitle} · {t(current.count === 1 ? 'plural.invoices_paid_one' : 'plural.invoices_paid_other', { count: current.count })}
            </Text>
            {delta !== null && <DeltaBadge pct={delta} />}
          </View>
        </View>

        {/* Revenue chart */}
        <SectionLabel>{t('reports.revenue_section')}</SectionLabel>
        <View style={[styles.chartCard, { backgroundColor: c.surface }]}>
          <RevenueChart data={months} invoices={invoices} />
        </View>

        {/* Status breakdown */}
        <SectionLabel>{t('reports.status_section')}</SectionLabel>
        <StatusBreakdown status={status} />

        {/* Top clients */}
        <SectionLabel>{top.length > 0 ? t('reports.top_clients_count', { count: top.length }) : t('reports.top_clients')}</SectionLabel>
        {top.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: c.surface }]}>
            <Trophy size={24} color={c.muted} strokeWidth={1.4} />
            <Text style={[styles.emptyText, { color: c.sub }]}>{t('reports.top_empty')}</Text>
          </View>
        ) : (
          <View style={[styles.topCard, { backgroundColor: c.surface }]}>
            {top.map((cl, i) => (
              <TopClientRow
                key={cl.name}
                rank={i + 1}
                name={cl.name}
                amount={cl.amount}
                count={cl.count}
                maxAmount={top[0].amount}
                divider={i < top.length - 1}
              />
            ))}
          </View>
        )}

        {/* Quick stats */}
        <SectionLabel>{t('reports.quick_stats', { period: periodTitle.toUpperCase() })}</SectionLabel>
        <View style={styles.statsRow}>
          <QuickStat label={t('reports.stat_invoices')} value={String(current.count)} color={c.text} />
          <QuickStat
            label={t('reports.stat_avg_invoice')}
            value={`$${Math.round(avgInvoice).toLocaleString()}`}
            color={c.text}
          />
          <QuickStat
            label={t('reports.stat_outstanding')}
            value={`$${(status.pending.amount + status.overdue.amount).toLocaleString()}`}
            color={
              status.overdue.amount > 0
                ? c.red
                : status.pending.amount > 0
                ? c.amber
                : c.text
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <Text style={[styles.sectionLabel, { color: c.sub }]}>{children}</Text>;
}

function DeltaBadge({ pct }: { pct: number }) {
  const { c } = useTheme();
  const isUp = pct > 0.5;
  const isDown = pct < -0.5;
  const color = isUp ? c.green : isDown ? c.red : c.sub;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  return (
    <View style={[styles.deltaBadge, { backgroundColor: color + '1c' }]}>
      <Icon size={11} color={color} strokeWidth={2.4} />
      <Text style={[styles.deltaText, { color }]}>
        {pct > 0 ? '+' : ''}
        {pct.toFixed(1)}%
      </Text>
    </View>
  );
}

function RevenueChart({ data, invoices }: { data: MonthRevenue[]; invoices: Invoice[] }) {
  const { c } = useTheme();
  const t = useT();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const currentKey = data[data.length - 1]?.key;
  const activeKey = selectedKey ?? currentKey;
  const activeMonth = data.find((d) => d.key === activeKey) ?? data[data.length - 1];

  const activeInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.status === 'paid' && i.paidDate?.startsWith(activeKey))
        .sort((a, b) => b.amount - a.amount),
    [invoices, activeKey]
  );

  const max = Math.max(...data.map((d) => d.amount), 1);

  const fullLabel = (() => {
    const [y, m] = activeMonth.key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <View>
      <View style={styles.bars}>
        {data.map((d) => {
          const isActive = d.key === activeKey;
          const isCurrent = d.key === currentKey;
          const h = d.amount === 0 ? 3 : Math.max(4, (d.amount / max) * 140);
          return (
            <TouchableOpacity
              key={d.key}
              activeOpacity={0.7}
              onPress={() => setSelectedKey(d.key === selectedKey ? null : d.key)}
              style={styles.barCol}
            >
              <View style={{ width: '100%', height: 140, justifyContent: 'flex-end' }}>
                <LinearGradient
                  colors={
                    isActive
                      ? [c.accent, '#6d28d9']
                      : [c.accent + '55', c.accent + '22']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.bar, { height: h }]}
                />
              </View>
              <Text
                style={[
                  styles.barValue,
                  {
                    color: isActive ? c.accent : c.faint,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {d.amount > 0 ? `$${Math.round(d.amount / 100) / 10}k` : '—'}
              </Text>
              <Text
                style={[
                  styles.barLabel,
                  {
                    color: isActive ? c.text : c.sub,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {d.label}
                {!isActive && isCurrent ? ' •' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Detail footer */}
      <View
        style={[
          styles.detailBlock,
          { borderTopColor: c.muted + '40' },
        ]}
      >
        <View style={styles.detailHead}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailMonth, { color: c.text }]}>{fullLabel}</Text>
            <Text style={[styles.detailCount, { color: c.sub }]}>
              {t(activeInvoices.length === 1 ? 'plural.invoices_paid_one' : 'plural.invoices_paid_other', { count: activeInvoices.length })}
              {selectedKey === null ? ` · ${t('common.current')}` : ''}
            </Text>
          </View>
          <Text style={[styles.detailAmount, { color: c.text }]}>
            ${activeMonth.amount.toLocaleString()}
          </Text>
        </View>

        {activeInvoices.length > 0 ? (
          <View style={{ gap: 8, marginTop: 12 }}>
            {activeInvoices.map((inv) => (
              <View key={inv.id} style={styles.detailRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.detailClient, { color: c.text }]} numberOfLines={1}>
                    {inv.clientName}
                  </Text>
                  <Text style={[styles.detailService, { color: c.sub }]} numberOfLines={1}>
                    {inv.service || '—'}
                  </Text>
                </View>
                <Text style={[styles.detailAmt, { color: c.text }]}>
                  ${inv.amount.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.detailEmpty, { color: c.faint }]}>
            {t('reports.no_paid_month')}
          </Text>
        )}
      </View>
    </View>
  );
}

function StatusBreakdown({
  status,
}: {
  status: ReturnType<typeof statusBreakdown>;
}) {
  const { c } = useTheme();
  const total = status.paid.amount + status.pending.amount + status.overdue.amount;
  const safe = total || 1;
  const segments = [
    { key: 'paid', label: 'Paid', color: c.green, ...status.paid },
    { key: 'pending', label: 'Pending', color: c.amber, ...status.pending },
    { key: 'overdue', label: 'Overdue', color: c.red, ...status.overdue },
  ];

  return (
    <View style={[styles.statusCard, { backgroundColor: c.surface }]}>
      <View style={styles.segBar}>
        {segments.map((s, i) => {
          const pct = s.amount / safe;
          if (pct === 0) return null;
          return (
            <View
              key={s.key}
              style={{
                flex: pct,
                backgroundColor: s.color,
                marginRight: i < segments.length - 1 ? 2 : 0,
              }}
            />
          );
        })}
      </View>
      <View style={{ gap: 10, marginTop: 14 }}>
        {segments.map((s) => (
          <View key={s.key} style={styles.segRow}>
            <View style={styles.segRowLeft}>
              <View style={[styles.segDot, { backgroundColor: s.color }]} />
              <Text style={[styles.segLabel, { color: c.text }]}>{s.label}</Text>
              <Text style={[styles.segCount, { color: c.sub }]}>
                {s.count} invoice{s.count === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={[styles.segAmount, { color: c.text }]}>
              ${s.amount.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TopClientRow({
  rank,
  name,
  amount,
  count,
  maxAmount,
  divider,
}: {
  rank: number;
  name: string;
  amount: number;
  count: number;
  maxAmount: number;
  divider: boolean;
}) {
  const { c } = useTheme();
  const barWidth = Math.max(0.08, amount / maxAmount);

  return (
    <View
      style={[
        styles.topRow,
        divider && { borderBottomWidth: 0.5, borderBottomColor: c.muted + '40' },
      ]}
    >
      <Text style={[styles.topRank, { color: c.faint }]}>{rank}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.topName, { color: c.text }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={[styles.topTrack, { backgroundColor: c.muted + '30' }]}>
          <View
            style={[
              styles.topFill,
              { width: `${barWidth * 100}%`, backgroundColor: c.accent },
            ]}
          />
        </View>
      </View>
      <View style={styles.topRight}>
        <Text style={[styles.topAmount, { color: c.text }]}>
          ${amount.toLocaleString()}
        </Text>
        <Text style={[styles.topMeta, { color: c.sub }]}>
          {count} invoice{count === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );
}

function QuickStat({ label, value, color }: { label: string; value: string; color: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.quickStat, { backgroundColor: c.surface }]}>
      <Text style={[styles.quickStatLabel, { color: c.sub }]}>{label}</Text>
      <Text style={[styles.quickStatValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 13, marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  chip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipText: { fontSize: 13, letterSpacing: -0.2 },

  heroCard: {
    borderRadius: 20,
    padding: 22,
    overflow: 'hidden',
    marginBottom: 6,
  },
  heroLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  heroAmount: { fontSize: 44, fontWeight: '800', letterSpacing: -1.2, marginTop: 6 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  heroMetaText: { fontSize: 12, fontWeight: '500' },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deltaText: { fontSize: 11, fontWeight: '700' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 24,
    paddingLeft: 4,
  },

  chartCard: { borderRadius: 18, padding: 18 },
  bars: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { width: '100%', borderRadius: 6 },
  barValue: { fontSize: 11, marginTop: 8 },
  barLabel: { fontSize: 11, marginTop: 2 },

  detailBlock: { marginTop: 18, paddingTop: 14, borderTopWidth: 0.5 },
  detailHead: { flexDirection: 'row', alignItems: 'flex-start' },
  detailMonth: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  detailCount: { fontSize: 12, marginTop: 2 },
  detailAmount: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailClient: { fontSize: 13, fontWeight: '600' },
  detailService: { fontSize: 11, marginTop: 1 },
  detailAmt: { fontSize: 14, fontWeight: '700' },
  detailEmpty: { fontSize: 12, marginTop: 12, fontStyle: 'italic' },

  statusCard: { borderRadius: 18, padding: 18 },
  segBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  segRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  segDot: { width: 8, height: 8, borderRadius: 4 },
  segLabel: { fontSize: 13, fontWeight: '600' },
  segCount: { fontSize: 11, marginLeft: 4 },
  segAmount: { fontSize: 14, fontWeight: '700' },

  topCard: { borderRadius: 18, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  topRank: { fontSize: 13, fontWeight: '700', width: 16, textAlign: 'center' },
  topName: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  topTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  topFill: { height: '100%', borderRadius: 2 },
  topRight: { alignItems: 'flex-end', marginLeft: 8 },
  topAmount: { fontSize: 14, fontWeight: '700' },
  topMeta: { fontSize: 11, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10 },
  quickStat: { flex: 1, borderRadius: 16, padding: 14, gap: 6, minHeight: 72 },
  quickStatLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  quickStatValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },

  empty: { borderRadius: 18, padding: 28, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, textAlign: 'center' },
});
