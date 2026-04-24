import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useClient, addClient, updateClient } from '../data/clients';
import { useT } from '../i18n';

type Params = { id?: string };

export default function ClientFormScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const route = useRoute<RouteProp<{ params: Params }, 'params'>>();
  const id = route.params?.id;
  const editing = Boolean(id);
  const existing = useClient(id ?? '');

  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (editing && existing) {
      updateClient(existing.id, payload);
    } else {
      addClient(payload);
    }
    nav.goBack();
  };

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
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 20,
        }}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>
              {editing ? t('client_form.edit_title') : t('client_form.add_title')}
            </Text>
            <Text style={[styles.subtitle, { color: c.sub }]}>
              {editing ? t('client_form.edit_subtitle') : t('client_form.add_subtitle')}
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

        <Field label={t('client_form.name')} required>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('client_form.name_placeholder')}
            placeholderTextColor={c.faint}
            autoCapitalize="words"
            style={[styles.input, { color: c.text }]}
          />
        </Field>

        <Field label={t('client_form.email')}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('client_form.email_placeholder')}
            placeholderTextColor={c.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: c.text }]}
          />
        </Field>

        <Field label={t('client_form.phone')}>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t('client_form.phone_placeholder')}
            placeholderTextColor={c.faint}
            keyboardType="phone-pad"
            style={[styles.input, { color: c.text }]}
          />
        </Field>

        <Field label={t('client_form.address')} multiline>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={t('client_form.address_placeholder')}
            placeholderTextColor={c.faint}
            multiline
            style={[styles.input, styles.multiline, { color: c.text }]}
          />
        </Field>

        <Field label={t('client_form.notes')} multiline optional>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('client_form.notes_placeholder')}
            placeholderTextColor={c.faint}
            multiline
            style={[styles.input, styles.multiline, { color: c.text }]}
          />
        </Field>

        <TouchableOpacity
          onPress={save}
          disabled={!canSave}
          activeOpacity={0.85}
          style={{ marginTop: 12, opacity: canSave ? 1 : 0.4 }}
        >
          <LinearGradient
            colors={[c.accent, '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.saveBtn, { shadowColor: c.accent }]}
          >
            <Check size={18} color="#fff" strokeWidth={2.4} />
            <Text style={styles.saveBtnText}>
              {editing ? t('client_form.save_changes') : t('client_form.save')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {!canSave && (
          <Text style={[styles.hint, { color: c.faint }]}>{t('client_form.name_required')}</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  children,
  required,
  multiline,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  multiline?: boolean;
  optional?: boolean;
}) {
  const { c } = useTheme();
  const t = useT();
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, { color: c.sub }]}>{label}</Text>
        {required && <Text style={[styles.fieldLabelBadge, { color: c.red }]}>{t('client_form.required')}</Text>}
        {optional && <Text style={[styles.fieldLabelBadge, { color: c.faint }]}>{t('client_form.optional')}</Text>}
      </View>
      <View
        style={[
          styles.fieldWrap,
          { backgroundColor: c.surface, minHeight: multiline ? 88 : undefined },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  fieldLabelBadge: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },

  fieldWrap: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  input: { fontSize: 15, padding: 0, fontWeight: '500' },
  multiline: { minHeight: 60, textAlignVertical: 'top' },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 10 },
});
