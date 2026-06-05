import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

export default function AdminTabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.secondary,
        tabBarStyle: {
          backgroundColor: COLORS.surfaceContainerLowest,
          borderTopColor: COLORS.divider,
          height: 65,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" $$$ />
          ),
        }}
      />
      <Tabs.Screen
        name="management"
        options={{
          title: 'Management',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" $$$ />
          ),
        }}
      />
    </Tabs>
  );
}
