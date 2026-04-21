import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { auth } from './src/firebase';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS, ADMIN_EMAIL } from './src/constants';

// Import Screens
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MainPageScreen from './src/screens/MainPageScreen'; // Ini adalah 'Kempen'
import ChatScreen from './src/screens/ChatScreen';         // Ini adalah 'Mohon Dana'
import StatusScreen from './src/screens/StatusScreen';     // Ini boleh jadi 'Inbox/Status'
import ProfileScreen from './src/screens/ProfileScreen';   // Halaman Profil
import AdminScreen from './src/screens/AdminScreen';       // Halaman Admin
import PaymentScreen from './src/screens/PaymentScreen';   // Halaman Bayar
import CreateFeedScreen from './src/screens/CreateFeedScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- KOMPONEN TAB NAVIGATOR (Konsep TikTok) ---
function MyTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: '#000', // Warna hitam seperti TikTok
          height: 60,
          paddingBottom: 8,
          borderTopWidth: 0
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Kempen') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Mohon') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
            size = 35; // Butang tengah lebih besar sedikit
          } else if (route.name === 'Inbox') {
            iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
          } else if (route.name === 'Profil') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Kempen" component={MainPageScreen} />
      <Tab.Screen name="Mohon" component={ChatScreen} />
      <Tab.Screen name="Inbox" component={StatusScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// --- MAIN APP ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);
  if (currentUser === undefined) return null; // Atau skrin loading

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {currentUser === null ? (
            // Jika Belum Login
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : currentUser?.email === ADMIN_EMAIL ? (
            // Jika Login Sebagai ADMIN
            <Stack.Screen name="Admin" component={AdminScreen} />
          ) : (
            // Jika Login Sebagai PENGGUNA BIASA
            <>
              <Stack.Screen name="MainTabs" component={MyTabs} />
              <Stack.Screen name="Payment" component={PaymentScreen} />
              <Stack.Screen name="CreateFeed" component={CreateFeedScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}