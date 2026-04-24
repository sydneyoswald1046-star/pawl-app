import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft,
  Pencil,
  Mail,
  Phone,
  MapPin,
  Plus,
  FileText,
  Trash2,
  X,
  Camera,
  ImagePlus,
} from 'lucide-react-native';
import { useTheme } from '../theme';
import {
  useClient,
  deleteClient,
  addGalleryItem,
  removeGalleryItem,
  type GalleryItem,
} from '../data/clients';
import { useInvoices, formatDueStatus, formatDateShort } from '../data/invoices';
import { useT } from '../i18n';

export default function ClientDetailScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const route = useRoute<RouteProp<{ params: { id: string } }, 'params'>>();
  const client = useClient(route.params.id);
  const allInvoices = useInvoices();

  const clientInvoices = useMemo(() => {
    if (!client) return [];
    return allInvoices
      .filter((i) => i.client === client.name)
      .slice()
      .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1)); // newest first
  }, [allInvoices, client]);

  if (!client) {
    return (
      <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top + 24 }]}>
        <Text style={[styles.missing, { color: c.sub }]}>{t('client.not_found')}</Text>
      </View>
    );
  }

  const gallery = client.gallery ?? [];

  const statusColor = {
    paid: c.green,
    pending: c.amber,
    overdue: c.red,
  } as const;

  const confirmDelete = () => {
    Alert.alert(
      t('client.delete_confirm_title'),
      t('client.delete_confirm_body', { name: client.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteClient(client.id);
            nav.goBack();
          },
        },
      ]
    );
  };

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
          <TouchableOpacity
            onPress={() => nav.navigate('ClientForm', { id: client.id })}
            style={[styles.iconBtn, { backgroundColor: c.elevated }]}
            hitSlop={10}
          >
            <Pencil size={16} color={c.sub} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={[styles.heroLabel, { color: c.sub }]}>{t('client.label')}</Text>
          <Text style={[styles.heroName, { color: c.text }]}>{client.name}</Text>
          {client.email ? (
            <Text style={[styles.heroEmail, { color: c.sub }]}>{client.email}</Text>
          ) : (
            <Text style={[styles.heroEmail, { color: c.faint }]}>{t('client.no_email')}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: c.surface }]}>
          <Stat label={t('client.stat_lifetime')} value={`$${client.totalBilled.toLocaleString()}`} color={c.text} />
          <View style={[styles.divider, { backgroundColor: c.muted + '55' }]} />
          <Stat
            label={t('client.stat_outstanding')}
            value={`$${client.outstandingAmount.toLocaleString()}`}
            color={client.outstandingAmount > 0 ? c.red : c.text}
          />
          <View style={[styles.divider, { backgroundColor: c.muted + '55' }]} />
          <Stat label={t('client.stat_invoices')} value={String(client.invoiceCount)} color={c.text} />
        </View>

        {/* Contact */}
        {(client.email || client.phone || client.address) && (
          <>
            <SectionLabel color={c.sub}>{t('client.contact')}</SectionLabel>
            <View style={[styles.contactCard, { backgroundColor: c.surface }]}>
              {client.email && (
                <ContactRow
                  icon={<Mail size={16} color={c.accent} strokeWidth={2} />}
                  iconBg={c.accent + '1c'}
                  label={client.email}
                  onPress={() => Linking.openURL(`mailto:${client.email}`)}
                  divider={!!client.phone || !!client.address}
                />
              )}
              {client.phone && (
                <ContactRow
                  icon={<Phone size={16} color={c.green} strokeWidth={2} />}
                  iconBg={c.green + '1c'}
                  label={client.phone}
                  onPress={() =>
                    Linking.openURL(`tel:${client.phone?.replace(/[^\d+]/g, '')}`)
                  }
                  divider={!!client.address}
                />
              )}
              {client.address && (
                <ContactRow
                  icon={<MapPin size={16} color={c.amber} strokeWidth={2} />}
                  iconBg={c.amber + '1c'}
                  label={client.address}
                  onPress={() =>
                    Linking.openURL(
                      `http://maps.apple.com/?q=${encodeURIComponent(client.address!)}`
                    )
                  }
                />
              )}
            </View>
          </>
        )}

        {/* Notes */}
        {client.notes && (
          <>
            <SectionLabel color={c.sub}>{t('client.notes')}</SectionLabel>
            <View style={[styles.notesCard, { backgroundColor: c.surface }]}>
              <Text style={[styles.notesText, { color: c.text }]}>{client.notes}</Text>
            </View>
          </>
        )}

        {/* New invoice */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => nav.navigate('NewInvoice', { clientName: client.name })}
          style={{ marginTop: 8 }}
        >
          <LinearGradient
            colors={[c.accent, '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.primaryBtn, { shadowColor: c.accent }]}
          >
            <Plus size={18} color="#fff" strokeWidth={2.4} />
            <Text style={styles.primaryBtnText}>{t('client.new_invoice')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Work gallery */}
        <WorkGallery clientId={client.id} clientName={client.name} gallery={gallery} />

        {/* Invoice history */}
        <SectionLabel color={c.sub}>
          {clientInvoices.length > 0 ? t('client.invoices_title_count', { count: clientInvoices.length }) : t('client.invoices_title')}
        </SectionLabel>
        {clientInvoices.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: c.surface }]}>
            <FileText size={22} color={c.muted} strokeWidth={1.4} />
            <Text style={[styles.emptyText, { color: c.sub }]}>{t('client.no_invoices')}</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {clientInvoices.map((inv) => (
              <TouchableOpacity
                key={inv.id}
                activeOpacity={0.75}
                onPress={() => nav.navigate('InvoiceDetail', { id: inv.id })}
                style={[styles.invoiceRow, { backgroundColor: c.surface }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.invService, { color: c.text }]} numberOfLines={1}>
                    {inv.service || '—'}
                  </Text>
                  <Text style={[styles.invMeta, { color: c.sub }]}>
                    {inv.status === 'paid'
                      ? `${t('status.paid')} · ${formatDateShort(inv.dueDate)}`
                      : formatDueStatus(inv)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.invAmount, { color: c.text }]}>
                    ${inv.amount.toLocaleString()}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: statusColor[inv.status] + '1c' }]}>
                    <Text style={[styles.statusText, { color: statusColor[inv.status] }]}>
                      {inv.status === 'paid' ? t('status.paid_upper') : inv.status === 'pending' ? t('status.pending_upper') : t('status.overdue_upper')}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Delete */}
        <TouchableOpacity
          onPress={confirmDelete}
          activeOpacity={0.7}
          style={[styles.deleteBtn, { backgroundColor: c.redSoft }]}
        >
          <Trash2 size={16} color={c.red} strokeWidth={1.8} />
          <Text style={[styles.deleteBtnText, { color: c.red }]}>{t('client.delete')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Work gallery
// ─────────────────────────────────────────────────────────────
const GALLERY_COLS = 3;
const GALLERY_GAP = 8;
const GALLERY_HPAD = 40; // paddingHorizontal: 20 on each side

function WorkGallery({
  clientId,
  clientName,
  gallery,
}: {
  clientId: string;
  clientName: string;
  gallery: GalleryItem[];
}) {
  const { c } = useTheme();
  const t = useT();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const screenW = Dimensions.get('window').width;
  const itemSize = Math.floor(
    (screenW - GALLERY_HPAD - GALLERY_GAP * (GALLERY_COLS - 1)) / GALLERY_COLS
  );

  const pickFromSource = (source: 'camera' | 'library') => async () => {
    try {
      setUploading(true);
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          t('gallery.permission_title'),
          source === 'camera' ? t('gallery.permission_camera') : t('gallery.permission_library')
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              allowsMultipleSelection: false,
            });
      if (!result.canceled && result.assets?.[0]) {
        addGalleryItem(clientId, { uri: result.assets[0].uri });
      }
    } catch (err) {
      Alert.alert(t('gallery.upload_error_title'), t('gallery.upload_error_body'));
    } finally {
      setUploading(false);
    }
  };

  const onAddPress = () => {
    Alert.alert(t('gallery.add_sheet_title'), t('gallery.add_sheet_body'), [
      { text: t('gallery.take_photo'), onPress: pickFromSource('camera') },
      { text: t('gallery.choose_library'), onPress: pickFromSource('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const onDelete = (item: GalleryItem) => {
    Alert.alert(t('gallery.remove_confirm_title'), t('gallery.remove_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('gallery.remove'),
        style: 'destructive',
        onPress: () => {
          removeGalleryItem(clientId, item.id);
          setViewerIndex(null);
        },
      },
    ]);
  };

  return (
    <>
      <View style={galleryStyles.headerRow}>
        <Text style={[styles.sectionLabel, { color: c.sub, marginTop: 22 }]}>
          {gallery.length > 0 ? t('gallery.title_count', { count: gallery.length }) : t('gallery.title')}
        </Text>
        {gallery.length > 0 && (
          <TouchableOpacity onPress={onAddPress} hitSlop={10}>
            <Text style={[galleryStyles.headerAction, { color: c.accent }]}>{t('gallery.add')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {gallery.length === 0 ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onAddPress}
          disabled={uploading}
          style={[galleryStyles.emptyCard, { backgroundColor: c.surface, borderColor: c.accent + '40' }]}
        >
          <View style={[galleryStyles.emptyIcon, { backgroundColor: c.accent + '18' }]}>
            <ImagePlus size={22} color={c.accent} strokeWidth={2} />
          </View>
          <Text style={[galleryStyles.emptyTitle, { color: c.text }]}>{t('gallery.empty_title')}</Text>
          <Text style={[galleryStyles.emptyBody, { color: c.sub }]}>
            {t('gallery.empty_body', { name: clientName.split(' ')[0] })}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={[galleryStyles.grid, { gap: GALLERY_GAP }]}>
          {gallery.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.75}
              onPress={() => setViewerIndex(i)}
              style={{ width: itemSize, height: itemSize }}
            >
              <Image
                source={{ uri: item.uri }}
                style={[galleryStyles.thumb, { backgroundColor: c.elevated }]}
              />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onAddPress}
            disabled={uploading}
            style={[
              galleryStyles.addTile,
              {
                width: itemSize,
                height: itemSize,
                backgroundColor: c.surface,
                borderColor: c.accent + '55',
              },
            ]}
          >
            {uploading ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <>
                <ImagePlus size={20} color={c.accent} strokeWidth={2.2} />
                <Text style={[galleryStyles.addTileText, { color: c.accent }]}>{t('gallery.add')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <GalleryViewer
        items={gallery}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onDelete={onDelete}
      />
    </>
  );
}

function GalleryViewer({
  items,
  index,
  onClose,
  onDelete,
}: {
  items: GalleryItem[];
  index: number | null;
  onClose: () => void;
  onDelete: (item: GalleryItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const visible = index !== null && index >= 0 && index < items.length;
  const item = visible ? items[index!] : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={galleryStyles.viewerRoot}>
        <View style={[galleryStyles.viewerHeader, { paddingTop: insets.top + 8 }]}>
          {item?.caption ? (
            <Text style={galleryStyles.viewerCaption} numberOfLines={1}>
              {item.caption}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <TouchableOpacity onPress={onClose} style={galleryStyles.viewerCloseBtn} hitSlop={10}>
            <X size={20} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        {item && (
          <Image
            source={{ uri: item.uri }}
            style={galleryStyles.viewerImage}
            resizeMode="contain"
          />
        )}
        {item && (
          <View style={[galleryStyles.viewerFooter, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={galleryStyles.viewerDate}>{t('gallery.added', { date: formatGalleryDate(item.addedAt) })}</Text>
            <TouchableOpacity
              onPress={() => onDelete(item)}
              style={galleryStyles.viewerDeleteBtn}
              activeOpacity={0.8}
            >
              <Trash2 size={16} color="#fff" strokeWidth={2} />
              <Text style={galleryStyles.viewerDeleteText}>{t('gallery.remove')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

function formatGalleryDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const galleryStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerAction: { fontSize: 13, fontWeight: '700', marginBottom: 8 },

  emptyCard: {
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  thumb: { width: '100%', height: '100%', borderRadius: 14 },
  addTile: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addTileText: { fontSize: 12, fontWeight: '700' },

  viewerRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  viewerCaption: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  viewerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { flex: 1, width: '100%' },
  viewerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  viewerDate: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '500' },
  viewerDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewerDeleteText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: c.sub }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function SectionLabel({ color, children }: { color: string; children: string }) {
  return <Text style={[styles.sectionLabel, { color }]}>{children}</Text>;
}

function ContactRow({
  icon,
  iconBg,
  label,
  onPress,
  divider,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  onPress?: () => void;
  divider?: boolean;
}) {
  const { c } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.contactRow,
        divider && { borderBottomWidth: 0.5, borderBottomColor: c.muted + '40' },
      ]}
    >
      <View style={[styles.contactIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={[styles.contactLabel, { color: c.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', marginBottom: 26, paddingTop: 12 },
  heroLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 10 },
  heroName: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center' },
  heroEmail: { fontSize: 13, marginTop: 6 },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 18,
    marginBottom: 24,
  },
  stat: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  statValue: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  divider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 22,
    paddingLeft: 4,
  },

  contactCard: { borderRadius: 16, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  contactIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },

  notesCard: { borderRadius: 16, padding: 16 },
  notesText: { fontSize: 14, lineHeight: 20 },

  primaryBtn: {
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
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },

  emptyCard: { borderRadius: 16, padding: 28, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '500' },

  invoiceRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14 },
  invService: { fontSize: 14, fontWeight: '600' },
  invMeta: { fontSize: 12, marginTop: 2 },
  invAmount: { fontSize: 15, fontWeight: '700' },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 3 },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 32,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700' },

  missing: { textAlign: 'center', fontSize: 14 },
});
