import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/services/api';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export type Role = 'CUSTOMER' | 'VENDOR' | 'COURIER' | 'ADMIN';
export type VendorType = 'FOOD' | 'SHOP';

export interface VendorProfile {
  id: string;
  businessName: string;
  address: string;
  description?: string | null;
  image?: string | null;
  types: VendorType[];
  isOpen: boolean;
  isDrinkPartner?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;
  isOnline: boolean;
  vendorProfile?: VendorProfile | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, phone: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const routeUser = (role: Role) => {
  switch (role) {
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
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async (authToken: string): Promise<User | null> => {
    try {
      const response = await api.get('/auth/me');
      const payload = response.data;
      const fetchedUser = payload?.data ?? payload ?? null;
      return fetchedUser;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('lonemmy_token');
        if (storedToken) {
          setToken(storedToken);
          const fetchedUser = await fetchUser(storedToken);
          if (fetchedUser) {
            setUser(fetchedUser);
          } else {
            // Hydration failed, clear invalid session
            await SecureStore.deleteItemAsync('lonemmy_token');
            setToken(null);
            setUser(null);
            router.replace('/(auth)/login');
          }
        } else {
          // No token stored, let them browse the guest portal.
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const payload = response.data;
      const responseToken = payload?.token;
      
      if (!responseToken) {
        throw new Error('Authentication response did not contain a token.');
      }

      await SecureStore.setItemAsync('lonemmy_token', responseToken);
      setToken(responseToken);

      const fetchedUser = await fetchUser(responseToken);
      if (!fetchedUser) {
        throw new Error('Could not retrieve user profile.');
      }

      setUser(fetchedUser);
      routeUser(fetchedUser.role);
    } catch (error) {
      console.error('Login error in AuthContext:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, name: string, password: string, phone: string, role: Role) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/register', { email, name, password, phone, role });
      const payload = response.data;
      const responseToken = payload?.token;

      if (responseToken) {
        await SecureStore.setItemAsync('lonemmy_token', responseToken);
        setToken(responseToken);
        
        const fetchedUser = await fetchUser(responseToken);
        if (fetchedUser) {
          setUser(fetchedUser);
          routeUser(fetchedUser.role);
        } else {
          router.replace('/(auth)/login');
        }
      } else {
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Registration error in AuthContext:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      await SecureStore.deleteItemAsync('lonemmy_token');
      setToken(null);
      setUser(null);
      setIsLoading(false);
      router.replace('/(auth)/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
