import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Image, ImageBackground
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { COLORS } from '../constants';

const { height, width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setCurrentUser(u));
    return unsub;
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <ImageBackground source={require('../../assets/bg_home.jpg')} style={styles.backgroundImage} resizeMode="cover">
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Header - Kept at top for utility */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Image source={require('../../assets/logo.png')} style={styles.logoImg} />
              <Text style={styles.logoText}>MyDana</Text>
            </View>
            {currentUser && (
              <TouchableOpacity onPress={handleLogout} style={styles.logoutIcon}>
                <Feather name="log-out" size={18} color={COLORS.error} />
              </TouchableOpacity>
            )}
          </View>

          {/* Centered Content Wrapper */}
          <View style={styles.centerContainer}>

            {/* Hero Section */}
            <View style={styles.heroSection}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>KOMUNITI MALAYSIA</Text>
              </View>
              <Text style={styles.heroTitle}>Sumbangan Anda,</Text>
              <View style={styles.highlightBadge}>
                <Text style={styles.highlightBadgeText}>Harapan Mereka.</Text>
              </View>
              <Text style={styles.heroSubtitle}>
                Platform pendanaan telus yang menghubungkan kebaikan hati anda terus kepada mereka yang memerlukan.
              </Text>
            </View>

            {/* Featured Card */}
            <View style={styles.mainCard}>
              <Ionicons name="heart-circle" size={50} color={COLORS.primary} style={styles.cardIcon} />
              <Text style={styles.cardText}>
                "Memberi bukan sekadar menyumbang, tetapi membuat perubahan."
              </Text>

              {!currentUser && (
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.primaryActionText}>Mula Sekarang</Text>
                  <Feather name="arrow-right" size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>


          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}


const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  backgroundCircle: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  scrollContent: {
    flexGrow: 1, // Important for centering
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 32, height: 32, borderRadius: 16 },
  logoText: { fontSize: 18, fontWeight: '800', color: '#4c0519', letterSpacing: -0.5 },
  logoutIcon: { padding: 8 },

  centerContainer: {
    flex: 1,
    justifyContent: 'center', // Centers vertically
    alignItems: 'center',      // Centers horizontally
    paddingHorizontal: 24,
    minHeight: height * 0.75,  // Ensures it takes up most of the page
  },

  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  badge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: '#eab308',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#d97706', letterSpacing: 1 },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#4c0519',
    textAlign: 'center',
    lineHeight: 42
  },
  highlightBadge: {
    backgroundColor: '#eab308',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 10,
    alignSelf: 'center',
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  highlightBadgeText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#831843',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
    paddingHorizontal: 10
  },

  mainCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardIcon: { marginBottom: 20 },
  cardText: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 25
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 100,
    gap: 10,
  },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 16 },

});