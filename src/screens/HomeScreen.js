import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions
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
    <SafeAreaView style={styles.safe}>
      {/* Background Accent */}
      <View style={styles.backgroundCircle} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header - Kept at top for utility */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Ionicons name="leaf" size={16} color="#fff" />
            </View>
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
              <Text style={styles.badgeText}>COMMUNITY FIRST</Text>
            </View>
            <Text style={styles.heroTitle}>
              Sumbangan Anda,{"\n"}
              <Text style={styles.heroHighlight}>Harapan Mereka.</Text>
            </Text>
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

          {/* Menu Grid - Centered Below */}
          {currentUser && (
            <View style={styles.menuWrapper}>
              <Text style={styles.menuTitle}>Akses Pantas</Text>
              <View style={styles.menuGrid}>
                <MenuCard
                  icon="chatbubbles-outline"
                  label="Mohon"
                  color="#6366f1"
                  onPress={() => navigation.navigate('Chat')}
                />
                <MenuCard
                  icon="analytics-outline"
                  label="Status"
                  color="#10b981"
                  onPress={() => navigation.navigate('Status')}
                />
                <MenuCard
                  icon="grid-outline"
                  label="Kempen"
                  color="#f59e0b"
                  onPress={() => navigation.navigate('MainPage')}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const MenuCard = ({ icon, label, onPress, color }) => (
  <TouchableOpacity style={styles.menuCard} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.menuIconBg, { backgroundColor: color + '10' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  backgroundCircle: {
    position: 'absolute',
    width: width * 2,
    height: width * 2,
    borderRadius: width,
    backgroundColor: '#F8FAFC',
    top: -width * 1.2,
    left: -width / 2,
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
  logoIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center'
  },
  logoText: { fontSize: 18, fontWeight: '800', color: '#1E293B', letterSpacing: -0.5 },
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
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 42
  },
  heroHighlight: { color: COLORS.primary },
  heroSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
    paddingHorizontal: 10
  },

  mainCard: {
    width: '100%',
    backgroundColor: '#fff',
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
    color: '#475569',
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

  menuWrapper: {
    width: '100%',
    marginTop: 50,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 20
  },
  menuGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15
  },
  menuCard: {
    width: (width - 48 - 40) / 3,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  menuIconBg: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  menuLabel: { fontSize: 12, fontWeight: '700', color: '#334155' }
});