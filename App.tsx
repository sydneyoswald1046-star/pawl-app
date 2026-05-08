import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Home, FileText, Users, Settings, Plus } from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ThemeProvider, useTheme } from './src/theme';
import { I18nProvider, useT } from './src/i18n';
import { AuthProvider, useAuth } from './src/lib/auth';
import { googleClientIds } from './src/lib/firebase';

GoogleSignin.configure({
  webClientId: googleClientIds.webClientId,
  iosClientId: googleClientIds.iosClientId,
  offlineAccess: false,
});
import DashboardScreen from './src/screens/DashboardScreen';
import InvoicesScreen from './src/screens/InvoicesScreen';
import ClientsScreen from './src/screens/ClientsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TapToReceiveScreen from './src/screens/TapToReceiveScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import NewInvoiceScreen from './src/screens/NewInvoiceScreen';
import ClientDetailScreen from './src/screens/ClientDetailScreen';
import ClientFormScreen from './src/screens/ClientFormScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import InvoiceDetailScreen from './src/screens/InvoiceDetailScreen';
import SignInScreen from './src/screens/SignInScreen';
import SplashScreen from './src/screens/SplashScreen';
import TabBarBackground, { TAB_BAR_HEIGHT } from './src/components/TabBarBackground';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function EmptyScreen() { return <View />; }

function TabNav() {
  const { c, dark } = useTheme();
  const stackNav = useNavigation<any>();
  const t = useT();

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarBackground: () => <TabBarBackground />,
          tabBarStyle: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            position: 'absolute',
            elevation: 0,
            height: TAB_BAR_HEIGHT,
            paddingBottom: 28,
            paddingTop: 8,
          },
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.faint,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        }}
      >
        <Tab.Screen
          name="Home"
          component={DashboardScreen}
          options={{
            tabBarLabel: t('nav.home'),
            tabBarIcon: ({ color, focused }) => <Home size={22} color={color} strokeWidth={focused ? 2.2 : 1.4} />,
          }}
        />
        <Tab.Screen
          name="Invoices"
          component={InvoicesScreen}
          options={{
            tabBarLabel: t('nav.invoices'),
            tabBarIcon: ({ color, focused }) => <FileText size={22} color={color} strokeWidth={focused ? 2.2 : 1.4} />,
          }}
        />
        <Tab.Screen
          name="Create"
          component={EmptyScreen}
          options={{
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <View style={[styles.plusBtn, { backgroundColor: c.accent, shadowColor: c.accent }]}>
                <Plus size={26} color="#fff" strokeWidth={2.5} />
              </View>
            ),
          }}
          listeners={() => ({
            tabPress: (e) => {
              e.preventDefault();
              stackNav.navigate('NewInvoice');
            },
          })}
        />
        <Tab.Screen
          name="Clients"
          component={ClientsScreen}
          options={{
            tabBarLabel: t('nav.clients'),
            tabBarIcon: ({ color, focused }) => <Users size={22} color={color} strokeWidth={focused ? 2.2 : 1.4} />,
          }}
        />
        <Tab.Screen
          name="More"
          component={SettingsScreen}
          options={{
            tabBarLabel: t('nav.more'),
            tabBarIcon: ({ color, focused }) => <Settings size={22} color={color} strokeWidth={focused ? 2.2 : 1.4} />,
          }}
        />
      </Tab.Navigator>
    </>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNav} />
      <Stack.Screen name="TapToReceive" component={TapToReceiveScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Reminders" component={RemindersScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="NewInvoice" component={NewInvoiceScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen name="ClientForm" component={ClientFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignIn" component={SignInScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function AppInner() {
  const { c, dark } = useTheme();
  const { user, initializing } = useAuth();
  const base = dark ? DarkTheme : DefaultTheme;
  const [splashDone, setSplashDone] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        theme={{
          ...base,
          dark,
          colors: {
            ...base.colors,
            primary: c.accent,
            background: c.bg,
            card: c.surface,
            text: c.text,
            border: 'transparent',
            notification: c.red,
          },
        }}
      >
        {initializing ? (
          <View style={[styles.center, { backgroundColor: c.bg }]}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : user ? (
          <AppStack />
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  plusBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -34,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
