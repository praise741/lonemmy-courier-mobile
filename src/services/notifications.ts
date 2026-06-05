import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';
import { COLORS } from '../constants/theme';

// Set up the default notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token: string | undefined;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: COLORS.primary,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo Push Token:', token);
    } catch (error) {
      console.error('Error fetching Expo push token:', error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export async function subscribeToNotifications(token: string): Promise<any> {
  try {
    const response = await api.post('/notifications/subscribe', { token });
    return response.data;
  } catch (error) {
    console.error('Failed to subscribe on backend:', error);
    throw error;
  }
}
