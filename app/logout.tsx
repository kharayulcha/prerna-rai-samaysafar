import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

export default function LogoutScreen() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Clear all session data
        await AsyncStorage.multiRemove([
          'authToken',
          'userRole',
          'assignedRouteId',
          'assignedBusId',
          'userData'
        ]);

        // Redirect immediately to login
        router.replace('/login');
      } catch (error) {
        console.error('Logout error:', error);
        Alert.alert('Error', 'Failed to logout properly. Please try again.');
        router.back();
      }
    };

    performLogout();
  }, [router]);

  return null;
}
