import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth, Role } from '@/context/AuthContext';

export function useRoleGuard(allowedRoles?: Role[]) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Unauthorized role access: redirect back to their proper screen
      switch (user.role) {
        case 'CUSTOMER':
          router.replace('/(customer)/home');
          break;
        case 'COURIER':
          router.replace('/(courier)/dashboard');
          break;
        case 'VENDOR':
          router.replace('/(vendor)/dashboard');
          break;
        case 'ADMIN':
          router.replace('/(admin)/dashboard');
          break;
        default:
          router.replace('/(auth)/login');
      }
    }
  }, [user, isLoading, allowedRoles]);

  return { user, isLoading };
}
