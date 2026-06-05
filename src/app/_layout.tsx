import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useState, useEffect } from 'react';
import { useFonts } from 'expo-font';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import Toast from '@/components/Toast';
import { COLORS } from '@/constants/theme';
import { registerForPushNotificationsAsync, subscribeToNotifications } from '@/services/notifications';
import * as Notifications from 'expo-notifications';

function NotificationHandler({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function setupNotifications() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token && isMounted) {
          await subscribeToNotifications(token);
        }
      } catch (error) {
        console.error('Error setting up push notifications:', error);
      }
    }

    setupNotifications();

    // Listen to incoming notification messages in the foreground
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Received notification in foreground:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Received notification response (user tapped):', response);
    });

    return () => {
      isMounted = false;
      notificationListener.remove();
      responseListener.remove();
    };
  }, [user]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  useEffect(() => {
    // Graceful initialization delay
    const timer = setTimeout(() => setIsLoaded(true), 600);
    return () => clearTimeout(timer);
  }, []);

  if (!isLoaded || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <QueryProvider>
      <AuthProvider>
        <NotificationHandler>
          <ToastProvider>
            <SafeAreaProvider>
              <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)/login" />
                <Stack.Screen name="portal" />
                <Stack.Screen name="(customer)/home" />
                <Stack.Screen name="(customer)/dashboard" />
                <Stack.Screen name="(customer)/notifications" />
                <Stack.Screen name="(customer)/vendor/[id]" />
                <Stack.Screen name="(customer)/cart" />
                <Stack.Screen name="(customer)/orders" />
                <Stack.Screen name="(customer)/order/[id]" />
                <Stack.Screen name="(customer)/errands/new" />
                <Stack.Screen name="(courier)/dashboard" />
                <Stack.Screen name="(courier)/task/[id]" />
                <Stack.Screen name="(courier)/active" />
                <Stack.Screen name="(courier)/earnings" />
                <Stack.Screen name="(courier)/profile" />
                <Stack.Screen name="(vendor)/dashboard" />
                <Stack.Screen name="(vendor)/products" />
                <Stack.Screen name="(vendor)/add-product" />
                <Stack.Screen name="(vendor)/setup" />
                <Stack.Screen name="(vendor)/profile" />
                <Stack.Screen name="(vendor)/order/[id]" />
                <Stack.Screen name="(admin)/dashboard" />
                <Stack.Screen name="(admin)/users" />
                <Stack.Screen name="(admin)/vendors" />
                <Stack.Screen name="(admin)/couriers" />
                <Stack.Screen name="(admin)/orders" />
                <Stack.Screen name="(admin)/payouts" />
                <Stack.Screen name="(admin)/locations" />
                <Stack.Screen name="(admin)/settings" />
                <Stack.Screen name="chat/conversations" />
                <Stack.Screen name="profile/edit" />
              </Stack>
              <StatusBar style="dark" />
              <Toast />
            </SafeAreaProvider>
          </ToastProvider>
        </NotificationHandler>
      </AuthProvider>
    </QueryProvider>
  );
}

