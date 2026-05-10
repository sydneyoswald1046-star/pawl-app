import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { useProfile, updateProfile } from '../data/profile';

export default function NotificationsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const profile = useProfile();

  const setKey = async (key: 'notifyOnPaid' | 'notifyOnUpcoming' | 'notifyOnOverdue', value: boolean) => {
    try {
      await updateProfile({ [key]: value });
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const rows: Array<{ key: 'notifyOnPaid' | 'notifyOnUpcoming' | 'notifyOnOverdue'; label: string; sub: string; defaultOn: boolean }> = [
    { key: 'notifyOnPaid', label: t('notif.paid_label'), sub: t('notif.paid_sub'), defaultOn: true },
    { key: 'notifyOnUpcoming', label: t('notif.upcoming_label'), sub: t('notif.upcoming_sub'), defaultOn: false },
    { key: 'notifyOnOverdue', label: t('notif.overdue_label'), sub: t('notif.overdue_sub'), defaultOn: false },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => nav.goBack()} style={[styles.iconBtn, { backgroundColor: c.elevated }]} hitSlop={10}>
            <ChevronLeft size={20} color={c.sub} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: c.text }]}>{t('settings.notifications')}</Text>
        <Text style={[styles.subtitle, { color: c.sub }]}>{t('notif.subtitle')}</Text>

        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {rows.map((row, i) => {
            const value = profile[row.key] ?? row.defaultOn;
            return (
              <View
                key={row.key}
                style={[styles.row, i < rows.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: c.muted + '40' }]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.rowLabel, { color: c.text }]}>{row.label}</Text>
                  <Text style={[styles.rowSub, { color: c.sub }]}>{row.sub}</Text>
                </View>
                <Switch
                  value={value}
                  onValueChange={(v) => setKey(row.key, v)}
                  trackColor={{ false: c.muted, true: c.accent }}
                />
              </View>
            );
          })}
        </View>

        <Text style={[styles.note, { color: c.faint }]}>{t('notif.note')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: { flexDirection: 'row', marginBottom: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 24, lineHeight: 18 },
  card: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  note: { fontSize: 11, marginTop: 16, paddingHorizontal: 4, lineHeight: 16 },
});
