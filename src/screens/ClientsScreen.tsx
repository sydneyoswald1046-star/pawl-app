import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Plus, ChevronRight, Users as UsersIcon } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useClients, type ClientWithStats } from '../data/clients';
import { useT } from '../i18n';

export default function ClientsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const clients = useClients();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (cl) =>
        cl.name.toLowerCase().includes(q) ||
        cl.email?.toLowerCase().includes(q) ||
        cl.phone?.toLowerCase().includes(q)
    );
  }, [clients, query]);

  const totalOutstanding = clients.reduce((s, cl) => s + cl.outstandingAmount, 0);

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
          <Text style={[styles.title, { color: c.text }]}>{t('clients.title')}</Text>
          <Text style={[styles.subtitle, { color: c.sub }]}>
            {totalOutstanding > 0
              ? t('clients.subtitle_outstanding', {
                  total: clients.length,
                  amount: `$${totalOutstanding.toLocaleString()}`,
                })
              : t('clients.subtitle_none', { total: clients.length })}
          </Text>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: c.surface }]}>
          <Search size={16} color={c.sub} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('clients.search_placeholder')}
            placeholderTextColor={c.faint}
            style={[styles.searchInput, { color: c.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => nav.navigate('ClientForm', {})}
          style={{ marginBottom: 22 }}
        >
          <LinearGradient
            colors={[c.accent, '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.addBtn, { shadowColor: c.accent }]}
          >
            <Plus size={18} color="#fff" strokeWidth={2.4} />
            <Text style={styles.addBtnText}>{t('clients.add')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {filtered.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: c.surface }]}>
            <UsersIcon size={30} color={c.muted} strokeWidth={1.4} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              {query ? t('clients.empty_matches_title') : t('clients.empty_none_title')}
            </Text>
            <Text style={[styles.emptyBody, { color: c.sub }]}>
              {query ? t('clients.empty_matches_body') : t('clients.empty_none_body')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((cl) => (
              <ClientRow
                key={cl.id}
                client={cl}
                onPress={() => nav.navigate('ClientDetail', { id: cl.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ClientRow({ client, onPress }: { client: ClientWithStats; onPress: () => void }) {
  const { c } = useTheme();
  const t = useT();
  const hasOutstanding = client.outstandingAmount > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: c.surface,
          borderLeftColor: hasOutstanding ? c.red : 'transparent',
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
          {client.name}
        </Text>
        {client.email && (
          <Text style={[styles.email, { color: c.sub }]} numberOfLines={1}>
            {client.email}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: c.faint }]}>
            {t('clients.lifetime', { amount: client.totalBilled.toLocaleString() })}
          </Text>
          <Text style={[styles.metaDot, { color: c.muted }]}>·</Text>
          <Text style={[styles.meta, { color: c.faint }]}>
            {client.invoiceCount} {client.invoiceCount === 1 ? t('plural.invoice_one') : t('plural.invoice_other')}
          </Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        {hasOutstanding && (
          <View style={[styles.pill, { backgroundColor: c.red + '22' }]}>
            <Text style={[styles.pillText, { color: c.red }]}>
              ${client.outstandingAmount.toLocaleString()}
            </Text>
          </View>
        )}
        <ChevronRight size={16} color={c.faint} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 13, marginTop: 6 },

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
  name: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  email: { fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { fontSize: 11, fontWeight: '500' },
  metaDot: { fontSize: 11 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 11, fontWeight: '700' },
});
