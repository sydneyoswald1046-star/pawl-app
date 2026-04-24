import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  ChevronRight,
  Plus,
  Trash2,
  Search,
  UserPlus,
  Check,
  Send,
} from 'lucide-react-native';
import { useTheme } from '../theme';
import { addInvoice, nextInvoiceNumber } from '../data/invoices';
import { useClients, addClient } from '../data/clients';
import { useT } from '../i18n';

type LineItem = { id: string; description: string; amount: string };
type DueOption = 7 | 14 | 30;

export default function NewInvoiceScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const route = useRoute<RouteProp<{ params?: { clientName?: string } }, 'params'>>();
  const prefillClient = route.params?.clientName;

  const DUE_OPTIONS: { days: DueOption; label: string }[] = [
    { days: 7, label: t('new_invoice.net_7') },
    { days: 14, label: t('new_invoice.net_14') },
    { days: 30, label: t('new_invoice.net_30') },
  ];

  const [client, setClient] = useState<string | null>(prefillClient ?? null);

  useEffect(() => {
    if (prefillClient) setClient(prefillClient);
  }, [prefillClient]);
  const [items, setItems] = useState<LineItem[]>([
    { id: cryptoId(), description: '', amount: '' },
  ]);
  const [dueDays, setDueDays] = useState<DueOption>(14);
  const [notes, setNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const total = useMemo(
    () =>
      items.reduce((sum, i) => {
        const n = parseFloat(i.amount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [items]
  );

  const validItemCount = items.filter(
    (i) => i.description.trim() && parseFloat(i.amount) > 0
  ).length;
  const canSend = !!client && validItemCount > 0;

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, { id: cryptoId(), description: '', amount: '' }]);

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it.id !== id)));
  };

  const send = () => {
    if (!canSend) return;

    const todayDate = new Date();
    const issuedDate = todayDate.toISOString().split('T')[0];
    const dueDateObj = new Date(todayDate);
    dueDateObj.setDate(dueDateObj.getDate() + dueDays);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const validItems = items.filter(
      (i) => i.description.trim() && parseFloat(i.amount) > 0
    );
    const service = validItems.map((i) => i.description.trim()).join(', ');

    addInvoice({
      id: cryptoId(),
      number: nextInvoiceNumber(),
      client: client!,
      service,
      items: validItems.map((i) => ({
        id: i.id,
        description: i.description.trim(),
        amount: parseFloat(i.amount),
      })),
      notes: notes.trim() || undefined,
      amount: total,
      status: 'pending',
      issuedDate,
      dueDate,
    });

    Alert.alert(
      t('new_invoice.sent_title'),
      t('new_invoice.sent_body', {
        client: client!,
        amount: total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      }),
      [{ text: t('common.done'), onPress: () => nav.goBack() }]
    );
  };

  if (pickerOpen) {
    return (
      <ClientPicker
        currentClient={client}
        onPick={(name) => {
          setClient(name);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: c.bg }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>{t('new_invoice.title')}</Text>
            <Text style={[styles.subtitle, { color: c.sub }]}>{t('new_invoice.subtitle')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => nav.goBack()}
            style={[styles.closeBtn, { backgroundColor: c.elevated }]}
            hitSlop={10}
          >
            <X size={18} color={c.sub} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Client */}
        <SectionLabel color={c.sub}>{t('new_invoice.client')}</SectionLabel>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.75}
          style={[styles.field, { backgroundColor: c.surface }]}
        >
          <Text
            style={[
              styles.fieldText,
              { color: client ? c.text : c.sub, fontWeight: client ? '600' : '500' },
            ]}
          >
            {client ?? t('new_invoice.select_client')}
          </Text>
          <ChevronRight size={18} color={c.faint} />
        </TouchableOpacity>

        {/* Line items */}
        <SectionLabel color={c.sub}>{t('new_invoice.items')}</SectionLabel>
        <View style={[styles.itemsCard, { backgroundColor: c.surface }]}>
          {items.map((it, idx) => (
            <View
              key={it.id}
              style={[
                styles.itemRow,
                idx < items.length - 1 && {
                  borderBottomWidth: 0.5,
                  borderBottomColor: c.muted + '40',
                },
              ]}
            >
              <TextInput
                value={it.description}
                onChangeText={(txt) => updateItem(it.id, { description: txt })}
                placeholder={t('new_invoice.description')}
                placeholderTextColor={c.faint}
                style={[styles.descInput, { color: c.text }]}
              />
              <View style={styles.amountWrap}>
                <Text style={[styles.amountSign, { color: c.sub }]}>$</Text>
                <TextInput
                  value={it.amount}
                  onChangeText={(txt) => updateItem(it.id, { amount: txt.replace(/[^0-9.]/g, '') })}
                  placeholder="0"
                  placeholderTextColor={c.faint}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: c.text }]}
                />
              </View>
              {items.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeItem(it.id)}
                  hitSlop={8}
                  style={styles.removeBtn}
                >
                  <Trash2 size={15} color={c.faint} strokeWidth={1.8} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addItem} activeOpacity={0.7} style={styles.addItemBtn}>
            <Plus size={14} color={c.accent} strokeWidth={2.4} />
            <Text style={[styles.addItemText, { color: c.accent }]}>{t('new_invoice.add_item')}</Text>
          </TouchableOpacity>
        </View>

        {/* Due */}
        <SectionLabel color={c.sub}>{t('new_invoice.due')}</SectionLabel>
        <View style={styles.chipsRow}>
          {DUE_OPTIONS.map((opt) => {
            const active = dueDays === opt.days;
            return (
              <TouchableOpacity
                key={opt.days}
                onPress={() => setDueDays(opt.days)}
                activeOpacity={0.7}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.accent : c.surface,
                    borderColor: active ? c.accent : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#fff' : c.text },
                  ]}
                >
                  {opt.label}
                </Text>
                <Text
                  style={[
                    styles.chipSub,
                    { color: active ? 'rgba(255,255,255,0.7)' : c.sub },
                  ]}
                >
                  {t('new_invoice.n_days', { count: opt.days })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notes */}
        <SectionLabel color={c.sub}>{t('new_invoice.notes')}</SectionLabel>
        <View style={[styles.field, { backgroundColor: c.surface, alignItems: 'stretch', minHeight: 80 }]}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('new_invoice.notes_placeholder')}
            placeholderTextColor={c.faint}
            multiline
            style={[styles.notesInput, { color: c.text }]}
          />
        </View>

        {/* Total */}
        <View style={[styles.totalCard, { backgroundColor: c.elevated, borderColor: c.accent + '30' }]}>
          <View>
            <Text style={[styles.totalLabel, { color: c.sub }]}>{t('new_invoice.total')}</Text>
            <Text style={[styles.totalSub, { color: c.faint }]}>
              {t(validItemCount === 1 ? 'plural.item_one' : 'plural.item_other', { count: validItemCount })}
            </Text>
          </View>
          <Text style={[styles.totalAmount, { color: c.text }]}>
            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>

        {/* Send */}
        <TouchableOpacity
          onPress={send}
          disabled={!canSend}
          activeOpacity={0.85}
          style={{ marginTop: 16, opacity: canSend ? 1 : 0.4 }}
        >
          <LinearGradient
            colors={[c.accent, '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sendBtn, { shadowColor: c.accent }]}
          >
            <Send size={18} color="#fff" strokeWidth={2.3} />
            <Text style={styles.sendBtnText}>{t('new_invoice.send')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {!canSend && (
          <Text style={[styles.hint, { color: c.faint }]}>
            {!client ? t('new_invoice.need_client') : t('new_invoice.need_item')}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline client picker
// ─────────────────────────────────────────────────────────────
function ClientPicker({
  currentClient,
  onPick,
  onClose,
}: {
  currentClient: string | null;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const clients = useClients();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (cl) =>
        cl.name.toLowerCase().includes(q) ||
        cl.email?.toLowerCase().includes(q)
    );
  }, [clients, query]);

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    addClient({
      name,
      email: newEmail.trim() || undefined,
    });
    onPick(name);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>{t('picker.title')}</Text>
            <Text style={[styles.subtitle, { color: c.sub }]}>
              {t('picker.subtitle', { count: clients.length })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: c.elevated }]}
            hitSlop={10}
          >
            <X size={18} color={c.sub} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: c.surface }]}>
          <Search size={16} color={c.sub} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('picker.search')}
            placeholderTextColor={c.faint}
            style={[styles.searchInput, { color: c.text }]}
            autoCapitalize="words"
          />
        </View>

        {/* Add new */}
        {!adding ? (
          <TouchableOpacity
            onPress={() => setAdding(true)}
            activeOpacity={0.75}
            style={[styles.addClientBtn, { borderColor: c.accent + '40' }]}
          >
            <UserPlus size={16} color={c.accent} strokeWidth={2.2} />
            <Text style={[styles.addClientText, { color: c.accent }]}>{t('picker.add_new')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.addClientForm, { backgroundColor: c.surface }]}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={t('picker.name_placeholder')}
              placeholderTextColor={c.faint}
              autoCapitalize="words"
              autoFocus
              style={[styles.addClientInput, { color: c.text }]}
              returnKeyType="next"
            />
            <TextInput
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder={t('picker.email_placeholder')}
              placeholderTextColor={c.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.addClientInput, { color: c.text }]}
              onSubmitEditing={submitNew}
              returnKeyType="done"
            />
            <View style={styles.addClientRow}>
              <TouchableOpacity onPress={() => { setAdding(false); setNewName(''); setNewEmail(''); }} style={styles.addClientCancel}>
                <Text style={{ color: c.sub, fontWeight: '600' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitNew}
                disabled={!newName.trim()}
                style={[styles.addClientSave, { backgroundColor: c.accent, opacity: newName.trim() ? 1 : 0.4 }]}
              >
                <Text style={styles.addClientSaveText}>{t('picker.add_select')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* List */}
        {filtered.length > 0 ? (
          <View style={[styles.clientList, { backgroundColor: c.surface }]}>
            {filtered.map((cl, i) => {
              const active = currentClient === cl.name;
              return (
                <TouchableOpacity
                  key={cl.name}
                  onPress={() => onPick(cl.name)}
                  activeOpacity={0.7}
                  style={[
                    styles.clientRow,
                    i < filtered.length - 1 && {
                      borderBottomWidth: 0.5,
                      borderBottomColor: c.muted + '40',
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, { color: c.text }]}>{cl.name}</Text>
                    {cl.email ? (
                      <Text style={[styles.clientMeta, { color: c.sub }]} numberOfLines={1}>
                        {cl.email}
                      </Text>
                    ) : null}
                    <Text style={[styles.clientMeta, { color: c.faint, marginTop: 2 }]}>
                      {cl.invoiceCount} {cl.invoiceCount === 1 ? t('plural.invoice_one') : t('plural.invoice_other')} · ${cl.totalBilled.toLocaleString()}
                    </Text>
                  </View>
                  {active && <Check size={18} color={c.accent} strokeWidth={2.4} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          query.trim() && !adding ? (
            <Text style={[styles.emptyHint, { color: c.sub }]}>
              {t('picker.no_matches')}
            </Text>
          ) : null
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function SectionLabel({ children, color }: { children: string; color: string }) {
  return <Text style={[styles.sectionLabel, { color }]}>{children}</Text>;
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 8, paddingLeft: 4 },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  fieldText: { flex: 1, fontSize: 15 },

  itemsCard: { borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  descInput: { flex: 1, fontSize: 14, fontWeight: '500', padding: 0 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 80 },
  amountSign: { fontSize: 14, fontWeight: '600' },
  amountInput: { fontSize: 15, fontWeight: '700', minWidth: 60, textAlign: 'right', padding: 0 },
  removeBtn: { padding: 4 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 14, paddingTop: 4 },
  addItemText: { fontSize: 13, fontWeight: '700' },

  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '700' },
  chipSub: { fontSize: 11, marginTop: 2 },

  notesInput: { flex: 1, fontSize: 14, padding: 0, textAlignVertical: 'top' },

  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
    borderWidth: 1,
  },
  totalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  totalSub: { fontSize: 11, marginTop: 2 },
  totalAmount: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },

  sendBtn: {
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
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 10 },

  // Client picker
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  addClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addClientText: { fontSize: 14, fontWeight: '700' },

  addClientForm: { borderRadius: 14, padding: 14, marginBottom: 16, gap: 10 },
  addClientInput: { fontSize: 15, fontWeight: '500', padding: 0 },
  addClientRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  addClientCancel: { paddingHorizontal: 12, paddingVertical: 8 },
  addClientSave: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addClientSaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  clientList: { borderRadius: 14, overflow: 'hidden' },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  clientName: { fontSize: 15, fontWeight: '600' },
  clientMeta: { fontSize: 12, marginTop: 2 },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingVertical: 24 },
});
