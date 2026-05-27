import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Send, Check, BellRing } from 'lucide-react-native';
import { useTheme } from '../theme';
import {
  useInvoices,
  isOutstanding,
  isOverdue,
  daysUntilDue,
  formatDueStatus,
  type Invoice,
} from '../data/invoices';
import { useProfile } from '../data/profile';
import { useAuth } from '../lib/auth';
import { emailInvoice, shareInvoicePdf } from '../lib/invoiceEmail';
import { getEntitlements } from '../lib/entitlements';
import { useT } from '../i18n';

export default function RemindersScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const [reminded, setReminded] = useState<Set<string>>(new Set());
  const invoices = useInvoices();
  const profile = useProfile();
  const { user } = useAuth();
  const ent = getEntitlements(profile);
  const fromName = (ent.businessNameOnPdf && profile.businessName) || user?.displayName || user?.email || 'PAWL';
  const pdfOpts = {
    showPoweredBy: ent.poweredByFooter,
    logoUrl: ent.businessLogoOnPdf ? profile.businessLogoUrl : undefined,
  };

  const { overdue, upcoming, totalCount, totalAmount } = useMemo(() => {
    const today = new Date();
    const open = invoices.filter(isOutstanding);
    const overdueList = open
      .filter((i) => isOverdue(i, today))
      .sort((a, b) => daysUntilDue(a, today) - daysUntilDue(b, today)); // most overdue first
    const upcomingList = open
      .filter((i) => !isOverdue(i, today))
      .sort((a, b) => daysUntilDue(a, today) - daysUntilDue(b, today)); // soonest first
    return {
      overdue: overdueList,
      upcoming: upcomingList,
      totalCount: open.length,
      totalAmount: open.reduce((s, i) => s + i.amount, 0),
    };
  }, [invoices]);

  const markReminded = (id: string) => {
    setReminded((prev) => new Set(prev).add(id));
  };

  const sendReminderViaMail = async (inv: Invoice) => {
    try {
      const result = await emailInvoice(inv, fromName, 'reminder', pdfOpts);
      if (!result.ok) {
        if (result.reason === 'no-recipient') {
          Alert.alert(t('common.error'), t('invoice.email_no_recipient'));
        } else {
          Alert.alert(t('common.error'), t('new_invoice.email_unavailable'));
        }
        return;
      }
      if (result.status === 'sent') markReminded(inv.id);
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const shareReminder = async (inv: Invoice) => {
    try {
      const result = await shareInvoicePdf(inv, fromName, 'reminder', pdfOpts);
      if (!result.ok && result.reason === 'no-recipient') {
        Alert.alert(t('common.error'), t('invoice.email_no_recipient'));
        return;
      }
      if (result.ok) markReminded(inv.id);
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const sendOne = (inv: Invoice) => {
    if (!inv.clientEmail) {
      Alert.alert(t('common.error'), t('invoice.email_no_recipient'));
      return;
    }
    Alert.alert(t('invoice.reminder_choose_title'), t('invoice.reminder_choose_body'), [
      { text: t('invoice.email_choose_mail'), onPress: () => sendReminderViaMail(inv) },
      { text: t('invoice.email_choose_share'), onPress: () => shareReminder(inv) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const sendAll = () => {
    const toRemind = [...overdue, ...upcoming].filter((i) => !reminded.has(i.id) && i.clientEmail);
    const skippedNoEmail = [...overdue, ...upcoming].filter((i) => !reminded.has(i.id) && !i.clientEmail).length;
    if (toRemind.length === 0) {
      Alert.alert(t('reminders.all_caught_title'), t('reminders.all_caught_body'));
      return;
    }
    Alert.alert(
      t('reminders.send_confirm_title'),
      toRemind.length === 1
        ? t('reminders.send_confirm_body_one')
        : t('reminders.send_confirm_body_other', { count: toRemind.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.send'),
          onPress: async () => {
            for (const inv of toRemind) {
              const result = await emailInvoice(inv, fromName, 'reminder', pdfOpts);
              if (result.ok && result.status === 'sent') markReminded(inv.id);
              if (!result.ok && result.reason === 'unavailable') {
                Alert.alert(t('common.error'), t('new_invoice.email_unavailable'));
                return;
              }
            }
            if (skippedNoEmail > 0) {
              Alert.alert(
                t('reminders.skipped_no_email_title'),
                t('reminders.skipped_no_email_body', { count: skippedNoEmail }),
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 20 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>{t('reminders.title')}</Text>
            <Text style={[styles.subtitle, { color: c.sub }]}>
              <Text style={{ color: c.red, fontWeight: '700' }}>
                {t('dashboard.subtitle_overdue_only', { count: overdue.length })}
              </Text>
              {' · '}
              <Text style={{ color: c.amber, fontWeight: '700' }}>
                {t('dashboard.subtitle_pending_only', { count: upcoming.length })}
              </Text>
              {' · '}
              <Text style={{ color: c.text, fontWeight: '700' }}>
                ${totalAmount.toLocaleString()}
              </Text>
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

        {/* Send all */}
        {totalCount > 0 && (
          <TouchableOpacity activeOpacity={0.85} onPress={sendAll} style={styles.sendAllWrap}>
            <LinearGradient
              colors={[c.accent, '#6d28d9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.sendAllBtn, { shadowColor: c.accent }]}
            >
              <BellRing size={18} color="#fff" strokeWidth={2.2} />
              <Text style={styles.sendAllText}>
                {t('reminders.remind_everyone', { count: totalCount })}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {totalCount === 0 && (
          <View style={[styles.empty, { backgroundColor: c.surface }]}>
            <Check size={28} color={c.green} strokeWidth={2} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>{t('reminders.all_paid_title')}</Text>
            <Text style={[styles.emptyBody, { color: c.sub }]}>
              {t('reminders.all_paid_body')}
            </Text>
          </View>
        )}

        {/* Overdue */}
        {overdue.length > 0 && (
          <Section title={t('reminders.section_overdue')} color={c.red}>
            {overdue.map((inv) => (
              <ReminderRow
                key={inv.id}
                invoice={inv}
                statusColor={c.red}
                reminded={reminded.has(inv.id)}
                onSend={() => sendOne(inv)}
              />
            ))}
          </Section>
        )}

        {/* Upcoming / Outstanding */}
        {upcoming.length > 0 && (
          <Section title={t('reminders.section_outstanding')} color={c.amber}>
            {upcoming.map((inv) => (
              <ReminderRow
                key={inv.id}
                invoice={inv}
                statusColor={c.amber}
                reminded={reminded.has(inv.id)}
                onSend={() => sendOne(inv)}
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function ReminderRow({
  invoice,
  statusColor,
  reminded,
  onSend,
}: {
  invoice: Invoice;
  statusColor: string;
  reminded: boolean;
  onSend: () => void;
}) {
  const { c } = useTheme();
  const t = useT();
  const status = formatDueStatus(invoice);

  return (
    <TouchableOpacity
      activeOpacity={reminded ? 1 : 0.75}
      onPress={reminded ? undefined : onSend}
      style={[styles.row, { backgroundColor: c.surface, opacity: reminded ? 0.55 : 1 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.client, { color: c.text }]}>{invoice.clientName}</Text>
        <Text style={[styles.service, { color: c.sub }]}>
          {invoice.service}
          {' · '}
          <Text style={{ color: statusColor, fontWeight: '600' }}>{status}</Text>
        </Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={[styles.amount, { color: c.text }]}>${invoice.amount.toLocaleString()}</Text>
        {reminded ? (
          <View style={[styles.remindedPill, { backgroundColor: c.green + '22' }]}>
            <Check size={11} color={c.green} strokeWidth={2.5} />
            <Text style={[styles.remindedText, { color: c.green }]}>{t('reminders.reminded')}</Text>
          </View>
        ) : (
          <View style={[styles.sendPill, { backgroundColor: statusColor + '1c' }]}>
            <Send size={11} color={statusColor} strokeWidth={2.3} />
            <Text style={[styles.sendText, { color: statusColor }]}>{t('reminders.remind')}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 6 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  sendAllWrap: { marginBottom: 4 },
  sendAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  sendAllText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },

  empty: { borderRadius: 16, padding: 28, alignItems: 'center', gap: 8, marginTop: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 13, textAlign: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingLeft: 4 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  row: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' },
  client: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  service: { fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 16, fontWeight: '700' },
  sendPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sendText: { fontSize: 11, fontWeight: '700' },
  remindedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  remindedText: { fontSize: 11, fontWeight: '700' },
});
