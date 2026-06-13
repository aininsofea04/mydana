import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  FlatList, Alert, TextInput, ActivityIndicator, Image, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { COLORS } from '../constants';

const { width } = Dimensions.get('window');

export default function AdminListScreen({ navigation }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Semua'); // Semua, Menunggu, Diluluskan

  useEffect(() => {
    const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const apps = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data };
      });
      setApplications(apps);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredApps = applications.filter(app => {
    const matchesSearch = (app.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (app.summary?.tajuk || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'Semua' ||
      (filter === 'Menunggu' && app.status === 'pending') ||
      (filter === 'Diluluskan' && app.status === 'approved');
    return matchesSearch && matchesFilter;
  });

  const getScoreColor = (score) => {
    if (score >= 80) return COLORS.success;
    if (score > 60) return '#f59e0b';
    return COLORS.error;
  };

  const renderAppItem = ({ item }) => (
    <View style={styles.appCard}>
      <Image
        source={{ uri: item.feed?.images?.[0] || 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80' }}
        style={styles.cardImage}
      />

      <View style={styles.cardBadges}>
        <View style={[styles.badge, { backgroundColor: item.status === 'pending' ? '#fef3c7' : '#f0fdf4' }]}>
          <Feather name="clock" size={12} color={item.status === 'pending' ? '#f59e0b' : '#16a34a'} />
          <Text style={[styles.badgeText, { color: item.status === 'pending' ? '#f59e0b' : '#16a34a' }]}>
            {item.status === 'pending' ? 'Menunggu Semakan' : 'Diluluskan'}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
          <Feather name="zap" size={12} color="#16a34a" />
          <Text style={[styles.badgeText, { color: '#16a34a' }]}>{item.score || 85}% Genuine</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.summary?.tajuk || 'Permohonan Dana'}</Text>
        <View style={styles.ownerRow}>
          <Feather name="user" size={14} color="#64748b" />
          <Text style={styles.ownerName}>Pemohon: {item.name}</Text>
        </View>

        <View style={styles.cardActions}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => navigation.navigate('AdminDetail', { app: item })}
          >
            <Text style={styles.detailBtnText}>Semak Dokumen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.id}
        renderItem={renderAppItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Senarai Permohonan{"\n"}Kempen</Text>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari permohonan..."
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <View style={styles.filterRow}>
              {['Semua', 'Menunggu', 'Diluluskan'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, filter === f && styles.filterChipActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.advancedFilter}>
              <Ionicons name="options-outline" size={18} color="#1e3a8a" />
              <Text style={styles.advancedFilterText}>Penapis Lanjut</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tiada permohonan ditemui.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 14, backgroundColor: COLORS.background
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  avatarContainer: { width: 40, height: 40, borderRadius: 20, elevation: 2 },
  avatar: { width: '100%', height: '100%', borderRadius: 20 },
  list: { padding: 24, paddingBottom: 100 },
  listHeader: { marginBottom: 20 },
  sectionTitle: { fontSize: 28, fontWeight: '900', color: COLORS.text, lineHeight: 34 },
  sectionSub: { fontSize: 13, color: '#64748b', marginTop: 10, lineHeight: 20, marginBottom: 20 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 16, height: 54, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#004282' },
  filterText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  filterTextActive: { color: '#fff' },
  advancedFilter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, paddingLeft: 4 },
  advancedFilterText: { fontSize: 13, fontWeight: '700', color: '#1e3a8a' },
  aiSummaryCard: {
    backgroundColor: '#004282', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 30,
    shadowColor: '#004282', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10
  },
  aiIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  aiSummaryTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  aiSummaryText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  aiProgressBg: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: 8 },
  aiProgressFill: { height: '100%', backgroundColor: '#4ade80', borderRadius: 3 },
  aiEfficiency: { color: '#fff', fontSize: 11, fontWeight: '700' },
  appCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  cardImage: { width: '100%', height: 180, borderRadius: 16, marginBottom: 16 },
  cardBadges: { flexDirection: 'row', gap: 8, position: 'absolute', top: 180, left: 24 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, elevation: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBody: { marginTop: 20 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  ownerName: { fontSize: 13, color: '#64748b' },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniAvatars: { flexDirection: 'row' },
  miniAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: -10 },
  miniAvatarText: { fontSize: 10, fontWeight: '800', color: '#1e3a8a' },
  detailBtn: { backgroundColor: '#004282', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  detailBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94a3b8', fontSize: 14 }
});
