import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FilePlus2,
  Banknote,
  Smartphone,
  Repeat,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../theme';
import { updateProfile } from '../data/profile';

type Slide = {
  id: string;
  Icon: typeof FilePlus2;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    id: 'create',
    Icon: FilePlus2,
    title: 'Create invoices in seconds',
    body: 'Tap the + button, pick a client, add line items. PAWL generates a clean PDF you can email or share in one tap.',
  },
  {
    id: 'paid',
    Icon: Banknote,
    title: 'Get paid online',
    body: 'Connect Stripe once. Every invoice ships with a secure payment link — cards, Apple Pay, and bank transfers settle straight to your account.',
  },
  {
    id: 'tap',
    Icon: Smartphone,
    title: 'Tap to receive in person',
    body: 'Charge a card on the spot — Tap to Pay on iPhone or a paired Stripe Reader. No keypad fumbling, no manual reconciliation.',
  },
  {
    id: 'recurring',
    Icon: Repeat,
    title: 'Reminders that work',
    body: 'PAWL nudges clients on the days you choose. Overdue invoices stay visible on the dashboard until they\'re paid.',
  },
  {
    id: 'pro',
    Icon: Sparkles,
    title: 'Go Pro when you grow',
    body: 'Free for your first 10 clients and 5 invoices a month. Upgrade in-app for unlimited invoices, custom branding, and priority support.',
  },
];

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    scrollX.setValue(x);
    const next = Math.round(x / width);
    if (next !== index) setIndex(next);
  };

  const goNext = async () => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    } else {
      await finish();
    }
  };

  const skip = async () => {
    await finish();
  };

  const finish = async () => {
    try {
      await updateProfile({ onboardingDone: true });
    } catch {
      // Even if the write fails (offline), AppInner will keep the user on
      // the tabs by next snapshot — they can replay from Settings.
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={skip} hitSlop={8}>
          <Text style={[styles.skipText, { color: c.sub }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={[styles.slide, { width }]}>
            <LinearGradient
              colors={[c.accent, '#6d28d9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconWrap}
            >
              <slide.Icon size={48} color="#fff" strokeWidth={2.2} />
            </LinearGradient>
            <Text style={[styles.title, { color: c.text }]}>{slide.title}</Text>
            <Text style={[styles.body, { color: c.sub }]}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={s.id}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity,
                  backgroundColor: c.accent,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          onPress={goNext}
          activeOpacity={0.85}
          style={{ width: '100%' }}
        >
          <LinearGradient
            colors={[c.accent, '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cta, { shadowColor: c.accent }]}
          >
            <Text style={styles.ctaText}>
              {index < SLIDES.length - 1 ? 'Continue' : 'Get started'}
            </Text>
            <ChevronRight size={20} color="#fff" strokeWidth={2.3} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  skipText: { fontSize: 15, fontWeight: '500' },
  slide: {
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginVertical: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: { paddingHorizontal: 20 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
