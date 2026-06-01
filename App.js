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
import MainPageScreen from './src/screens/MainPageScreen'; 
import ChatScreen from './src/screens/ChatScreen';         
import StatusScreen from './src/screens/StatusScreen';     
import ProfileScreen from './src/screens/ProfileScreen';   
import AdminHomeScreen from './src/screens/AdminHomeScreen'; 
import AdminListScreen from './src/screens/AdminListScreen';
import AdminAnalyticsScreen from './src/screens/AdminAnalyticsScreen'; 
import AdminDetailScreen from './src/screens/AdminScreen'; // Gunakan AdminScreen lama sebagai detail
import PaymentScreen from './src/screens/PaymentScreen';   
import CreateFeedScreen from './src/screens/CreateFeedScreen';
import ApplyHubScreen from './src/screens/ApplyHubScreen'; 
import InboxScreen from './src/screens/InboxScreen';       
import DirectMessageScreen from './src/screens/DirectMessageScreen';
import CreateProgressReportScreen from './src/screens/CreateProgressReportScreen';
import LiveStreamScreen from './src/screens/LiveStreamScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- USER TABS ---
function UserTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: '#000', 
          height: 60,
          paddingBottom: 8,
          borderTopWidth: 0
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Kempen') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Mohon') { iconName = focused ? 'add-circle' : 'add-circle-outline'; size = 35; }
          else if (route.name === 'Inbox') iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
          else if (route.name === 'Profil') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Kempen" component={MainPageScreen} />
      <Tab.Screen name="Mohon" component={ApplyHubScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// --- ADMIN TABS ---
function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: '#fff', 
          height: 65,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0'
        },
        tabBarActiveTintColor: '#004282',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Utama') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Senarai') iconName = focused ? 'list' : 'list-outline';
          else if (route.name === 'Analitik') iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Utama" component={AdminHomeScreen} />
      <Tab.Screen name="Senarai" component={AdminListScreen} />
      <Tab.Screen name="Analitik" component={AdminAnalyticsScreen} />
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
  if (currentUser === undefined) return null; 

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {currentUser === null ? (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : currentUser?.email === ADMIN_EMAIL ? (
            <>
              <Stack.Screen name="AdminTabs" component={AdminTabs} />
              <Stack.Screen name="AdminDetail" component={AdminDetailScreen} />
              <Stack.Screen name="CreateProgressReport" component={CreateProgressReportScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="MainTabs" component={UserTabs} />
              <Stack.Screen name="Payment" component={PaymentScreen} />
              <Stack.Screen name="CreateFeed" component={CreateFeedScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="Status" component={StatusScreen} />
              <Stack.Screen name="DirectMessage" component={DirectMessageScreen} />
              <Stack.Screen name="CreateProgressReport" component={CreateProgressReportScreen} />
              <Stack.Screen name="LiveStream" component={LiveStreamScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}