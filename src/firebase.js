import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCTaMEJkOmLwevPJDTn1DCTEEPceXyTCos',
  authDomain: 'mydana-a06be.firebaseapp.com',
  projectId: 'mydana-a06be',
  storageBucket: 'mydana-a06be.firebasestorage.app',
  messagingSenderId: '449619888673',
  appId: '1:449619888673:web:3d17322ab5b5b7b2d0f160',
  measurementId: 'G-K9YR4YHL84',
};

let app, auth, db, storage;

try {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

export { app, auth, db, storage };
