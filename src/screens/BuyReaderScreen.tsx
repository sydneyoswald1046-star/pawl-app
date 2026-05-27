import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ExternalLink, Smartphone, Bluetooth, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '../theme';

type Reader = {
  id: string;
  name: string;
  price: string;
  description: string;
  fit: string;
  url: string;
  badge?: string;
};

// Pricing reflects Stripe's published US Hardware Shop. Subject to change —
// links go to stripe.com/terminal/hardware which is always current.
const READERS: Reader[] = [
  {
    id: 'm2',
    name: 'Stripe Reader M2',
    price: '$59',
    description: 'Pocket-sized, Bluetooth. Pair with any iPhone or Android phone.',
    fit: 'Best for going mobile — coffee shop pop-ups, deliveries, on-site service.',
    url: 'https://stripe.com/terminal/hardware',
    badge: 'Most popular',
  },
  {
    id: 'bbpos-chipper',
    name: 'BBPOS Chipper 2X BT',
    price: '$59',
    description: 'Compact Bluetooth reader. Same Stripe rails, slightly older form factor.',
    fit: 'Alternative to the M2 if it\'s out of stock.',
    url: 'https://stripe.com/terminal/hardware',
  },
  {
    id: 's700',
    name: 'Stripe Reader S700',
    price: '$199',
    description: 'Countertop reader with built-in screen, Wi-Fi, and printer expansion.',
    fit: 'Best for a fixed counter — salon, clinic, or studio front desk.',
    url: 'https://stripe.com/terminal/hardware',
  },
  {
    id: 'wisepos-e',
    name: 'BBPOS WisePOS E',
    price: '$249',
    description: 'Full POS terminal with Android base. Customer-facing display and PIN pad.',
    fit: 'Best for retail or higher-volume locations.',
    url: 'https://stripe.com/terminal/hardware',
  },
];

export default function BuyReaderScreen() {
  const { c } = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const openShop = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.iconBtn} hitSlop={10}>
          <ChevronLeft size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Buy a reader</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: c.elevated }]}>
          <View style={[styles.heroIcon, { backgroundColor: c.accent }]}>
            <Bluetooth size={28} color="#fff" strokeWidth={2.3} />
          </View>
          <Text style={[styles.heroTitle, { color: c.text }]}>
            Accept card payments in person
          </Text>
          <Text style={[styles.heroBody, { color: c.sub }]}>
            Pair a Stripe-compatible reader to your phone and charge cards, Apple Pay, and Google Pay anywhere. Same Stripe fees, no monthly minimum.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: c.text }]}>Compatible readers</Text>

        {READERS.map((r) => (
          <View key={r.id} style={[styles.readerCard, { backgroundColor: c.elevated }]}>
            <View style={styles.readerHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.readerTitleRow}>
                  <Text style={[styles.readerName, { color: c.text }]}>{r.name}</Text>
                  {r.badge && (
                    <View style={[styles.badge, { backgroundColor: c.accent }]}>
                      <Text style={styles.badgeText}>{r.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.readerPrice, { color: c.accent }]}>{r.price}</Text>
              </View>
            </View>
            <Text style={[styles.readerDescription, { color: c.text }]}>{r.description}</Text>
            <Text style={[styles.readerFit, { color: c.sub }]}>{r.fit}</Text>
            <TouchableOpacity
              style={[styles.buyBtn, { backgroundColor: c.accent }]}
              onPress={() => openShop(r.url)}
            >
              <ShoppingBag size={16} color="#fff" strokeWidth={2.3} />
              <Text style={styles.buyBtnText}>View on Stripe</Text>
              <ExternalLink size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        <View style={[styles.alreadyHaveCard, { backgroundColor: c.elevated }]}>
          <Smartphone size={20} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alreadyTitle, { color: c.text }]}>
              Already have a Stripe-compatible reader?
            </Text>
            <Text style={[styles.alreadyBody, { color: c.sub }]}>
              Charge the reader, turn on Bluetooth, then tap "Scan for readers" inside Tap to Receive.
            </Text>
          </View>
        </View>

        <Text style={[styles.footer, { color: c.sub }]}>
          Prices are USD as published by Stripe at the time of writing. Final pricing, shipping, and availability are shown on stripe.com.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  heroCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  heroBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  readerCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  readerHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  readerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  readerName: { fontSize: 17, fontWeight: '700' },
  readerPrice: { fontSize: 22, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  readerDescription: { fontSize: 15, lineHeight: 21, marginTop: 4 },
  readerFit: { fontSize: 13, lineHeight: 18, marginTop: 4, fontStyle: 'italic' },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  buyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  alreadyHaveCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  alreadyTitle: { fontSize: 14, fontWeight: '600' },
  alreadyBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});
