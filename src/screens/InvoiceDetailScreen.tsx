import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Send,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react-native';
import { useTheme } from '../theme';
import {
  useInvoice,
  markInvoicePaid,
  markInvoiceUnpaid,
  deleteInvoice,
  formatDueStatus,
  formatDateLong,
  daysUntilDue,
  isOverdue,
} from '../data/invoices';
import { useClients } from '../data/clients';
import { useProfile } from '../data/profile';
import { useAuth } from '../lib/auth';
import { emailInvoice, shareInvoicePdf } from '../lib/invoiceEmail';
import { useT, tPlural } from '../i18n';

export default function InvoiceDetailScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const route = useRoute<RouteProp<{ params: { id: string } }, 'params'>>();
  const invoice = useInvoice(route.params.id);
  const clients = useClients();

  if (!invoice) {
    return (
      <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top + 24 }]}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => nav.goBack()}
            style={[styles.iconBtn, { backgroundColor: c.elevated }]}
            hitSlop={10}
          >
            <ChevronLeft size={20} color={c.sub} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.missing, { color: c.sub }]}>{t('invoice.not_found')}</Text>
      </View>
    );
  }

  const today = new Date();
  const paid = invoice.status === 'paid';
  const overdue = !paid && isOverdue(invoice, today);

  const statusColor = paid ? c.green : overdue ? c.red : c.amber;
  const statusLabel = paid ? t('status.paid_upper') : overdue ? t('status.overdue_upper') : t('status.pending_upper');
  const StatusIcon = paid ? CheckCircle2 : overdue ? AlertCircle : Clock;

  const statusDetail = paid
    ? invoice.paidDate
      ? t('invoice.paid_on_date', { date: formatDateLong(invoice.paidDate) })
      : t('status.paid')
    : formatDueStatus(invoice, today);

  const clientRecord = clients.find((cl) => cl.id === invoice.clientId);
  const lineItems =
    invoice.items && invoice.items.length > 0
      ? invoice.items
      : [{ id: 'single', description: invoice.service || '—', amount: invoice.amount }];

  const markPaid = async () => {
    try {
      await markInvoicePaid(invoice.id);
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const markUnpaid = () => {
    Alert.alert(t('invoice.mark_unpaid_confirm_title'), t('invoice.mark_unpaid_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('invoice.mark_unpaid'),
        style: 'destructive',
        onPress: async () => {
          try {
            await markInvoiceUnpaid(invoice.id);
          } catch (err) {
            Alert.alert(t('common.error'), (err as Error).message);
          }
        },
      },
    ]);
  };

  const { user } = useAuth();
  const profile = useProfile();

  const sendReminderViaMail = async () => {
    try {
      const result = await emailInvoice(invoice, fromName, 'reminder');
      if (!result.ok) {
        if (result.reason === 'no-recipient') {
          Alert.alert(t('common.error'), t('invoice.email_no_recipient'));
        } else {
          Alert.alert(t('common.error'), t('new_invoice.email_unavailable'));
        }
      }
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const shareReminderToOtherApp = async () => {
    try {
      const result = await shareInvoicePdf(invoice, fromName, 'reminder');
      if (!result.ok && result.reason === 'no-recipient') {
        Alert.alert(t('common.error'), t('invoice.email_no_recipient'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const sendReminder = () => {
    if (!invoice.clientEmail) {
      Alert.alert(t('common.error'), t('invoice.email_no_recipient'));
      return;
    }
    Alert.alert(t('invoice.reminder_choose_title'), t('invoice.reminder_choose_body'), [
      { text: t('invoice.email_choose_mail'), onPress: sendReminderViaMail },
      { text: t('invoice.email_choose_share'), onPress: shareReminderToOtherApp },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const fromName = profile.businessName || user?.displayName || user?.email || 'Payly';

  const sendViaMail = async () => {
    try {
      const result = await emailInvoice(invoice, fromName);
      if (!result.ok) {
        if (result.reason === 'no-recipient') {
          Alert.alert(t('common.error'), t('invoice.email_no_recipient'));
        } else {
          Alert.alert(t('common.error'), t('new_invoice.email_unavailable'));
        }
      }
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const shareToOtherApp = async () => {
    try {
      const result = await shareInvoicePdf(invoice, fromName);
      if (!result.ok && result.reason === 'no-recipient') {
        Alert.alert(t('common.error'), t('invoice.email_no_recipient'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const emailToClient = () => {
    Alert.alert(t('invoice.email_choose_title'), t('invoice.email_choose_body'), [
      { text: t('invoice.email_choose_mail'), onPress: sendViaMail },
      { text: t('invoice.email_choose_share'), onPress: shareToOtherApp },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      t('invoice.delete_confirm_title'),
      t('invoice.delete_confirm_body', {
        prefix: invoice.number ? `${invoice.number} · ` : '',
        amount: invoice.amount.toLocaleString(),
        client: invoice.clientName,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvoice(invoice.id);
              nav.goBack();
            } catch (err) {
              Alert.alert(t('common.error'), (err as Error).message);
            }
          },
        },
      ]
    );
  };

  const daysLate = overdue ? -daysUntilDue(invoice, today) : 0;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        {/* Nav */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => nav.goBack()}
            style={[styles.iconBtn, { backgroundColor: c.elevated }]}
            hitSlop={10}
          >
            <ChevronLeft size={20} color={c.sub} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={[styles.heroAmount, { color: c.text }]}>
            ${invoice.amount.toLocaleString()}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '1c' }]}>
            <StatusIcon size={13} color={statusColor} strokeWidth={2.4} />
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {statusLabel}
              <Text style={[styles.statusDetail, { color: statusColor + 'cc' }]}> · {statusDetail}</Text>
            </Text>
          </View>
          {invoice.number && (
            <Text style={[styles.heroNumber, { color: c.faint }]}>{invoice.number}</Text>
          )}
        </View>

        {/* Client card */}
        {clientRecord && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => nav.navigate('ClientDetail', { id: clientRecord.id })}
            style={[styles.clientCard, { backgroundColor: c.surface }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.clientLabel, { color: c.sub }]}>{t('invoice.billed_to')}</Text>
              <Text style={[styles.clientName, { color: c.text }]} numberOfLines={1}>
                {invoice.clientName}
              </Text>
              {clientRecord.email && (
                <Text style={[styles.clientEmail, { color: c.sub }]} numberOfLines={1}>
                  {clientRecord.email}
                </Text>
              )}
            </View>
            <ChevronRight size={18} color={c.faint} />
          </TouchableOpacity>
        )}
        {!clientRecord && (
          <View style={[styles.clientCard, { backgroundColor: c.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.clientLabel, { color: c.sub }]}>{t('invoice.billed_to')}</Text>
              <Text style={[styles.clientName, { color: c.text }]}>{invoice.clientName}</Text>
            </View>
          </View>
        )}

        {/* Payment link */}
        {!paid && invoice.paymentLinkUrl && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => Linking.openURL(invoice.paymentLinkUrl!)}
            style={[styles.payLinkCard, { backgroundColor: c.accent }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.payLinkTitle}>{t('invoice.pay_link_title')}</Text>
              <Text style={styles.payLinkSub} numberOfLines={1}>
                {invoice.paymentLinkUrl}
              </Text>
            </View>
            <ExternalLink size={18} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>
        )}
        {!paid && !invoice.paymentLinkUrl && !invoice.paymentLinkError && (
          <View style={[styles.payLinkCard, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.faint + '40', borderStyle: 'dashed' }]}>
            <Text style={[styles.payLinkSub, { color: c.sub }]}>
              {invoice.paymentLinkPending === 'connect_required'
                ? t('invoice.pay_link_connect_required')
                : invoice.paymentLinkPending === 'connect_pending'
                  ? t('invoice.pay_link_connect_pending')
                  : t('invoice.pay_link_pending')}
            </Text>
          </View>
        )}
        {!paid && invoice.paymentLinkError && (
          <View style={[styles.payLinkCard, { backgroundColor: c.redSoft }]}>
            <Text style={[styles.payLinkTitle, { color: c.red }]}>{t('invoice.pay_link_error')}</Text>
            <Text style={[styles.payLinkSub, { color: c.red }]} numberOfLines={2}>
              {invoice.paymentLinkError}
            </Text>
          </View>
        )}

        {/* Items */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>{t('invoice.items')}</Text>
        <View style={[styles.itemsCard, { backgroundColor: c.surface }]}>
          {lineItems.map((item, i) => (
            <View
              key={item.id}
              style={[
                styles.itemRow,
                i < lineItems.length - 1 && {
                  borderBottomWidth: 0.5,
                  borderBottomColor: c.muted + '40',
                },
              ]}
            >
              <Text style={[styles.itemDesc, { color: c.text }]}>{item.description}</Text>
              <Text style={[styles.itemAmount, { color: c.text }]}>
                ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: c.muted + '60' }]}>
            <Text style={[styles.totalLabel, { color: c.sub }]}>{t('invoice.total')}</Text>
            <Text style={[styles.totalAmount, { color: c.text }]}>
              ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Details */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>{t('invoice.details')}</Text>
        <View style={[styles.detailsCard, { backgroundColor: c.surface }]}>
          {invoice.issuedDate && (
            <DetailRow label={t('invoice.issued')} value={formatDateLong(invoice.issuedDate)} divider color={c.text} subColor={c.sub} muted={c.muted} />
          )}
          <DetailRow
            label={t('invoice.due')}
            value={formatDateLong(invoice.dueDate)}
            hint={overdue ? tPlural(t, 'plural.day_late', daysLate) : !paid ? formatDueStatus(invoice, today) : undefined}
            hintColor={overdue ? c.red : c.amber}
            divider={paid}
            color={c.text}
            subColor={c.sub}
            muted={c.muted}
          />
          {paid && invoice.paidDate && (
            <DetailRow label={t('invoice.paid_on')} value={formatDateLong(invoice.paidDate)} color={c.green} subColor={c.sub} muted={c.muted} />
          )}
        </View>

        {/* Notes */}
        {invoice.notes && (
          <>
            <Text style={[styles.sectionLabel, { color: c.sub }]}>{t('invoice.notes')}</Text>
            <View style={[styles.notesCard, { backgroundColor: c.surface }]}>
              <Text style={[styles.notesText, { color: c.text }]}>{invoice.notes}</Text>
            </View>
          </>
        )}

        {/* Actions */}
        {!paid && (
          <TouchableOpacity activeOpacity={0.85} onPress={markPaid} style={{ marginTop: 24 }}>
            <LinearGradient
              colors={[c.green, '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.primaryBtn, { shadowColor: c.green }]}
            >
              <Check size={18} color="#fff" strokeWidth={2.6} />
              <Text style={styles.primaryBtnText}>{t('invoice.mark_paid')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={emailToClient}
          style={[styles.secondaryBtn, { backgroundColor: c.surface, marginTop: paid ? 24 : 10 }]}
        >
          <Send size={16} color={c.accent} strokeWidth={2.2} />
          <Text style={[styles.secondaryBtnText, { color: c.accent }]}>{t('invoice.email_to_client')}</Text>
        </TouchableOpacity>

        {!paid && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={sendReminder}
            style={[styles.secondaryBtn, { backgroundColor: c.surface, marginTop: 10 }]}
          >
            <Send size={16} color={c.amber} strokeWidth={2.2} />
            <Text style={[styles.secondaryBtnText, { color: c.amber }]}>{t('invoice.send_reminder')}</Text>
          </TouchableOpacity>
        )}

        {paid && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={markUnpaid}
            style={[styles.secondaryBtn, { backgroundColor: c.surface, marginTop: 24 }]}
          >
            <RotateCcw size={16} color={c.sub} strokeWidth={2.2} />
            <Text style={[styles.secondaryBtnText, { color: c.sub }]}>{t('invoice.mark_unpaid')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={confirmDelete}
          style={[styles.deleteBtn, { backgroundColor: c.redSoft }]}
        >
          <Trash2 size={16} color={c.red} strokeWidth={1.8} />
          <Text style={[styles.deleteBtnText, { color: c.red }]}>{t('invoice.delete')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  hint,
  hintColor,
  divider,
  color,
  subColor,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  hintColor?: string;
  divider?: boolean;
  color: string;
  subColor: string;
  muted: string;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        divider && { borderBottomWidth: 0.5, borderBottomColor: muted + '40' },
      ]}
    >
      <Text style={[styles.detailLabel, { color: subColor }]}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.detailValue, { color }]}>{value}</Text>
        {hint && (
          <Text style={[styles.detailHint, { color: hintColor ?? subColor }]}>{hint}</Text>
        )}
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { flexDirection: 'row', marginBottom: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', marginBottom: 24, paddingTop: 4 },
  heroAmount: { fontSize: 56, fontWeight: '800', letterSpacing: -1.5 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  statusPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  statusDetail: { fontWeight: '600', letterSpacing: 0 },
  heroNumber: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginTop: 12 },

  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  clientLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  clientName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  clientEmail: { fontSize: 12, marginTop: 2 },

  payLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  payLinkTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  payLinkSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6,
    paddingLeft: 4,
  },

  itemsCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 22 },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'space-between' },
  itemDesc: { flex: 1, fontSize: 14, fontWeight: '500', marginRight: 12 },
  itemAmount: { fontSize: 14, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 0.5,
  },
  totalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  totalAmount: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },

  detailsCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 22 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
  },
  detailLabel: { fontSize: 13, fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '600' },
  detailHint: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  notesCard: { borderRadius: 16, padding: 16, marginBottom: 8 },
  notesText: { fontSize: 14, lineHeight: 20 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 28,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700' },

  missing: { textAlign: 'center', fontSize: 14 },
});
