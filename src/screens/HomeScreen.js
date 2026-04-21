import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { COLORS, ADMIN_EMAIL } from '../constants';

export default function HomeScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setCurrentUser(u));
    return unsub;
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoDot} />
            <Text style={styles.logoText}>MyDana</Text>
          </View>
          {currentUser ? (
            <View style={styles.headerRight}>
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarText}>
                  {(currentUser.displayName || currentUser.email)?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                <Feather name="log-out" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.headerBtnText}>Log Masuk</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons name="people" size={12} color={COLORS.primary} />
            <Text style={styles.badgeText}>KOMUNITI PRIHATIN</Text>
          </View>

          <Text style={styles.heroTitle}>
            Sumbangan Anda,{'\n'}
            <Text style={styles.heroHighlight}>Harapan</Text> Mereka
          </Text>

          <Text style={styles.heroSubtitle}>
            Platform pendanaan individu-ke-individu yang telus dan mudah. Bantu mereka yang memerlukan dengan hanya beberapa klik.
          </Text>

          {/* Illustration */}
          <View style={styles.heroCircle}>
            <Ionicons name="heart" size={50} color={COLORS.primary} style={{ opacity: 0.7 }} />
            <Ionicons name="hand-left-outline" size={30} color={COLORS.secondary} style={{ opacity: 0.6, position: 'absolute', bottom: 18, right: 25 }} />
          </View>

          {/* CTA Buttons */}
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            <Text style={styles.btnPrimaryText}>Mohon Dana</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => navigation.navigate('MainPage')}
            activeOpacity={0.85}
          >
            <Ionicons name="gift-outline" size={20} color={COLORS.primary} />
            <Text style={styles.btnOutlineText}>Mula Menderma</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Links */}
        {currentUser && (
          <View style={styles.quickLinks}>
            <Text style={styles.quickTitle}>Menu Pantas</Text>
            <View style={styles.quickGrid}>
              {!isAdmin && (
                <>
                  <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('Chat')}>
                    <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.primary} />
                    <Text style={styles.quickLabel}>Permohonan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('Status')}>
                    <Ionicons name="time-outline" size={24} color={COLORS.secondary} />
                    <Text style={styles.quickLabel}>Status</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('MainPage')}>
                    <Ionicons name="grid-outline" size={24} color={COLORS.success} />
                    <Text style={styles.quickLabel}>Kempen</Text>
                  </TouchableOpacity>
                </>
              )}
              {isAdmin && (
                <TouchableOpacity style={[styles.quickCard, { flex: 1 }]} onPress={() => navigation.navigate('Admin')}>
                  <Ionicons name="shield-checkmark" size={24} color={COLORS.textSecondary} />
                  <Text style={styles.quickLabel}>Admin Panel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoDot: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primary },
  logoText: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarBadge: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutBtn: {
    padding: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.error,
  },
  headerBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.primary,
  },
  headerBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  hero: { paddingHorizontal: 24, paddingTop: 30, alignItems: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#e0e7ff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 1 },
  heroTitle: {
    fontSize: 30, fontWeight: '800', color: COLORS.text, textAlign: 'center',
    lineHeight: 40, marginBottom: 16,
  },
  heroHighlight: { color: COLORS.primary },
  heroSubtitle: {
    fontSize: 15, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 24, paddingHorizontal: 10, marginBottom: 30,
  },
  heroCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: '#e0e7ff',
    justifyContent: 'center', alignItems: 'center', marginBottom: 30,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14,
    width: '100%', marginBottom: 12,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  btnPrimaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.surface, paddingVertical: 16, borderRadius: 14,
    width: '100%', borderWidth: 1.5, borderColor: COLORS.primary,
  },
  btnOutlineText: { color: COLORS.primary, fontSize: 17, fontWeight: '700' },
  quickLinks: { paddingHorizontal: 24, marginTop: 36 },
  quickTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  quickGrid: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 18,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  quickLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
});
