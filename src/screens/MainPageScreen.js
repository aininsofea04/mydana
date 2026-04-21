import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { COLORS, ADMIN_EMAIL } from '../constants';

const CATEGORIES = [
  { name: 'Semua', icon: 'grid', color: COLORS.primary },
  { name: 'Perubatan', emoji: '🚑', color: '#ef4444' },
  { name: 'Haiwan', emoji: '🐾', color: '#f59e0b' },
  { name: 'Pendidikan', emoji: '🎓', color: '#8b5cf6' },
  { name: 'Bencana Alam', emoji: '🌊', color: '#0ea5e9' },
];

export default function MainPageScreen({ navigation }) {
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Header Baru: Logo & Profile/Logout */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoDot} />
            <Text style={styles.logoText}>MyDana</Text>
          </View>
          
          <View style={styles.headerRight}>
            {isAdmin && (
              <TouchableOpacity onPress={() => navigation.navigate('Admin')} style={{marginRight: 8}}>
                <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarText}>
                {currentUser?.email?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Feather name="log-out" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.name}
              style={[styles.chip, activeCategory === cat.name && styles.chipActive]}
              onPress={() => setActiveCategory(cat.name)}
              activeOpacity={0.8}
            >
              {cat.icon ? (
                <Ionicons name={cat.icon} size={14} color={activeCategory === cat.name ? '#fff' : cat.color} />
              ) : (
                <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
              )}
              <Text style={[styles.chipText, activeCategory === cat.name && styles.chipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quick Action: Mohon Dana */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <TouchableOpacity 
            style={styles.btnPrimaryAction} 
            onPress={() => navigation.navigate('Chat')}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            <Text style={styles.btnPrimaryActionText}>Mohon Dana Sekarang</Text>
          </TouchableOpacity>
        </View>

        {/* Empty State */}
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.border} />
          </View>
          <Text style={styles.emptyTitle}>Tiada Kempen Ditemui</Text>
          <Text style={styles.emptyText}>
            Belum ada kempen yang didaftarkan untuk kategori {activeCategory}. Mohon dana melalui AI Chatbot jika anda memerlukan!
          </Text>
        </View>

        <View style={styles.bottomCta}>
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Status')}>
            <Text style={styles.btnOutlineText}>Semak Status Permohonan Saya</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 15,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoDot: { width: 26, height: 26, borderRadius: 6, backgroundColor: COLORS.primary },
  logoText: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarBadge: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutBtn: { padding: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.error },
  chips: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#fff' },
  btnPrimaryAction: {
    flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 14, 
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryActionText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyState: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.borderLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  bottomCta: { paddingHorizontal: 24, paddingVertical: 30 },
  btnOutline: {
    backgroundColor: COLORS.surface, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary,
  },
  btnOutlineText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
});