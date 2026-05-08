import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, FileText, Plus } from 'lucide-react-native';
import { useTheme } from '../theme';
import {
  useInvoices,
  formatDueStatus,
  formatDateShort,
  isOverdue,
  isOutstanding,
  type Invoice,
} from '../data/invoices';
import { useT } from '../i18n';

type Filter = 'all' | 'pending' | 'overdue' | 'paid';

export default function InvoicesScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const invoices = useInvoices();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t('invoices.filter_all') },
    { key: 'pending', label: t('invoices.filter_pending') },
    { key: 'overdue', label: t('invoices.filter_overdue') },
    { key: 'paid', label: t('invoices.filter_paid') },
  ];

  const totalOutstanding = useMemo(
    () =>
      invoices
        .filter(isOutstanding)
        .reduce((s, i) => s + i.amount, 0),
    [invoices]
  );

  const filtered = useMemo(() => {
    const today = new Date();
    const q = query.trim().toLowerCase();
    return invoices
      .filter((inv) => {
        if (filter === 'pending') return inv.status !== 'paid' && !isOverdue(inv, today);
        if (filter === 'overdue') return isOverdue(inv, today);
        if (filter === 'paid') return inv.status === 'paid';
        return true;
      })
      .filter((inv) => {
        if (!q) return true;
        return (
          inv.clientName.toLowerCase().includes(q) ||
          inv.service.toLowerCase().includes(q) ||
          inv.number?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Overdue first (most overdue first), then outstanding (soonest due), then paid (most recent)
        const aOverdue = isOverdue(a, today);
        const bOverdue = isOverdue(b, today);
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

        const aPaid = a.status === 'paid';
        const bPaid = b.status === 'paid';
        if (aPaid !== bPaid) return aPaid ? 1 : -1;

        if (aPaid && bPaid) {
          return (b.paidDate ?? b.dueDate).localeCompare(a.paidDate ?? a.dueDate);
        }
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [invoices, filter, query]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 120,
          paddingHorizontal: 20,
        }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>{t('invoices.title')}</Text>
          <Text style={[styles.subtitle, { color: c.sub }]}>
            {totalOutstanding > 0
              ? t('invoices.subtitle_outstanding', {
                  total: invoices.length,
                  amount: `$${totalOutstanding.toLocaleString()}`,
                })
              : t('invoices.subtitle_none', { total: invoices.length })}
          </Text>
        </View>

        {/* Filter chips */}
        <View style={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                activeOpacity={0.8}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? c.accent : c.surface },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active ? '#fff' : c.text,
                      fontWeight: active ? '700' : '600',
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: c.surface }]}>
          <Search size={16} color={c.sub} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('invoices.search_placeholder')}
            placeholderTextColor={c.faint}
            style={[styles.searchInput, { color: c.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* New invoice button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => nav.navigate('NewInvoice')}
          style={{ marginBottom: 22 }}
        >
          <LinearGradient
            colors={[c.accent, '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.addBtn, { shadowColor: c.accent }]}
          >
            <Plus size={18} color="#fff" strokeWidth={2.4} />
            <Text style={styles.addBtnText}>{t('invoices.new')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* List */}
        {filtered.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: c.surface }]}>
            <FileText size={30} color={c.muted} strokeWidth={1.4} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              {query
                ? t('invoices.empty_no_matches_title')
                : filter === 'all'
                ? t('invoices.empty_none_title')
                : t('invoices.empty_filtered_title', {
                    filter: filter === 'pending' ? t('invoices.filter_pending').toLowerCase()
                      : filter === 'overdue' ? t('invoices.filter_overdue').toLowerCase()
                      : t('invoices.filter_paid').toLowerCase(),
                  })}
            </Text>
            <Text style={[styles.emptyBody, { color: c.sub }]}>
              {query
                ? t('invoices.empty_search_body')
                : filter === 'all'
                ? t('invoices.empty_none_body')
                : t('invoices.empty_filtered_body')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                onPress={() => nav.navigate('InvoiceDetail', { id: inv.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InvoiceRow({ invoice, onPress }: { invoice: Invoice; onPress: () => void }) {
  const { c } = useTheme();
  const t = useT();
  const today = new Date();
  const overdue = isOverdue(invoice, today);
  const paid = invoice.status === 'paid';

  const statusColor = paid ? c.green : overdue ? c.red : c.amber;
  const statusText = paid
    ? invoice.paidDate
      ? `${t('status.paid')} ${formatDateShort(invoice.paidDate)}`
      : t('status.paid')
    : formatDueStatus(invoice, today);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: c.surface, borderLeftColor: statusColor },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowClient, { color: c.text }]} numberOfLines={1}>
          {invoice.clientName}
        </Text>
        <Text style={[styles.rowService, { color: c.sub }]} numberOfLines={1}>
          {invoice.service || '—'}
        </Text>
        <View style={styles.rowMetaRow}>
          {invoice.number && (
            <Text style={[styles.rowNumber, { color: c.faint }]}>{invoice.number}</Text>
          )}
          <Text style={[styles.rowStatus, { color: statusColor }]}>· {statusText}</Text>
        </View>
      </View>
      <Text style={[styles.rowAmount, { color: c.text }]}>
        ${invoice.amount.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 13, marginTop: 6 },

  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  chipText: { fontSize: 13, letterSpacing: -0.2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },

  empty: { borderRadius: 18, padding: 36, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderLeftWidth: 3,
  },
  rowClient: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  rowService: { fontSize: 12, marginTop: 2 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  rowNumber: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  rowStatus: { fontSize: 11, fontWeight: '600' },
  rowAmount: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
});
