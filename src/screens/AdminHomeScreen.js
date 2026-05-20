import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Dimensions, RefreshControl, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { COLORS } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function AdminHomeScreen({ navigation }) {
  const [stats, setStats] = useState({
    totalApps: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    totalUsers: 0,
    totalCollected: 0,
  });
  const [recentApps, setRecentApps] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const parseAmt = s => { const n = parseFloat((s || '').replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; };

  const fetchAllData = () => {
    // 1. Fetch Stats from Applications
    const qApps = query(collection(db, 'applications'));
    const unsubApps = onSnapshot(qApps, (snap) => {
      const appsDocs = snap.docs.map(d => ({ id: d.id, ...d.data(), _dt: d.data().createdAt?.toDate?.() || new Date() }));

      const approvedApps = appsDocs.filter(a => a.status === 'approved');
      const totalCollected = approvedApps.reduce((s, a) => s + (parseAmt(a.collectedAmount) || 0), 0);

      // Calculate monthly donation amounts for bar chart (Real Data)
      const now = new Date();
      const currentM = now.getMonth();
      const currentY = now.getFullYear();

      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(currentY, currentM - (5 - i), 1);
        const monthlySum = appsDocs
          .filter(a => a._dt.getMonth() === d.getMonth() && a._dt.getFullYear() === d.getFullYear())
          .reduce((s, a) => s + (parseAmt(a.collectedAmount) || 0), 0);

        return { label: d.toLocaleString('ms-MY', { month: 'short' }), value: monthlySum };
      });

      setMonthlyData(last6Months);
      setStats(prev => ({
        ...prev,
        totalApps: appsDocs.length,
        approved: approvedApps.length,
        rejected: appsDocs.filter(a => a.status === 'rejected').length,
        pending: appsDocs.filter(a => a.status === 'pending').length,
        totalCollected: totalCollected,
      }));
    });

    // 2. Fetch Users
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsersList(users);
      setStats(prev => ({ ...prev, totalUsers: snap.size }));
    });

    // 3. Fetch Recent Applications
    const qRecent = query(collection(db, 'applications'), orderBy('createdAt', 'desc'), limit(5));
    const unsubRecent = onSnapshot(qRecent, (snap) => {
      const recent = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        date: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
      }));
      setRecentApps(recent);
      setLoading(false);
      setRefreshing(false);
    });

    return () => {
      unsubApps();
      unsubUsers();
      unsubRecent();
    };
  };

  useEffect(() => {
    return fetchAllData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const StatusBadge = ({ status }) => {
    const config = {
      pending: { label: 'MENUNGGU', color: '#f59e0b', bg: '#fef3c7' },
      approved: { label: 'LULUS', color: '#10b981', bg: '#d1fae5' },
      rejected: { label: 'DITOLAK', color: '#ef4444', bg: '#fee2e2' },
    };
    const s = config[status] || config.pending;
    return (
      <View style={[styles.badge, { backgroundColor: s.bg }]}>
        <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Panel Pentadbir</Text>
            <Text style={styles.headerTitle}>MyDana Dashboard</Text>
          </View>
          <TouchableOpacity 
            style={styles.logoutBtn} 
            onPress={() => auth.signOut()}
          >
            <Ionicons name="log-out-outline" size={24} color="#dc2626" />
            <Text style={styles.logoutText}>Log Keluar</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <LinearGradient colors={['#621e8aff', '#db96e8ff']} style={styles.mainStatCard}>
            <View>
              <Text style={styles.mainStatLabel}>Sumbangan Dana Terkumpul</Text>
              <Text style={styles.mainStatValue}>RM {stats.totalCollected.toLocaleString('ms-MY')}</Text>
            </View>
            <Ionicons name="cash-outline" size={40} color="rgba(255,255,255,0.2)" />
          </LinearGradient>

          <View style={styles.subStatsRow}>
            <View style={styles.subStatCard}>
              <Text style={[styles.subStatValue, { color: '#f59e0b' }]}>{stats.pending}</Text>
              <Text style={styles.subStatLabel}>Tertunda</Text>
            </View>
            <View style={styles.subStatCard}>
              <Text style={[styles.subStatValue, { color: '#10b981' }]}>{stats.approved}</Text>
              <Text style={styles.subStatLabel}>Lulus</Text>
            </View>
            <View style={styles.subStatCard}>
              <Text style={[styles.subStatValue, { color: '#dc2626' }]}>{stats.rejected}</Text>
              <Text style={styles.subStatLabel}>Ditolak</Text>
            </View>
            <View style={styles.subStatCard}>
              <Text style={[styles.subStatValue, { color: '#3b82f6' }]}>{stats.totalUsers}</Text>
              <Text style={styles.subStatLabel}>Pengguna</Text>
            </View>
          </View>
        </View>

        {/* Real Data Bar Graph */}
        <Text style={styles.sectionTitle}>Jumlah Sumbangan Bulanan (RM)</Text>
        <View style={styles.chartCard}>
          <View style={styles.barChartContainer}>
            {monthlyData.map((item, index) => {
              const maxVal = Math.max(...monthlyData.map(d => d.value), 100);
              const barHeight = (item.value / maxVal) * 150;
              return (
                <View key={index} style={styles.barWrapper}>
                  <View style={[styles.bar, { height: Math.max(barHeight, 5) }]} />
                  <Text style={styles.barLabel}>{item.label}</Text>
                  <Text style={{ fontSize: 8, color: '#1e3a8a', fontWeight: '800' }}>RM{item.value >= 1000 ? (item.value / 1000).toFixed(1) + 'k' : item.value}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Permohonan Terkini</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Senarai')}>
            <Text style={styles.seeAll}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityList}>
          {recentApps.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.activityItem}
              onPress={() => navigation.navigate('AdminDetail', { app: item })}
            >
              <View style={styles.activityIcon}>
                <Ionicons name="file-tray-full" size={20} color="#1e3a8a" />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.activityDate}>{item.date.toLocaleDateString('ms-MY')}</Text>
              </View>
              <StatusBadge status={item.status} />
            </TouchableOpacity>
          ))}
        </View>

        {stats.pending > 0 && (
          <View style={styles.urgentBox}>
            <View style={styles.urgentHeader}>
              <Ionicons name="alert-circle" size={20} color="#dc2626" />
              <Text style={styles.urgentTitle}>Perhatian Pentadbir</Text>
            </View>
            <Text style={styles.urgentText}>
              Terdapat {stats.pending} permohonan yang masih menunggu semakan. Sila buat pengesahan segera.
            </Text>
            <TouchableOpacity
              style={styles.urgentBtn}
              onPress={() => navigation.navigate('Senarai')}
            >
              <Text style={styles.urgentBtnText}>Semak Sekarang</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* User Account List (Participants List) */}
        <View style={styles.userListSection}>
          <Text style={styles.sectionTitle}>Senarai Akaun Pengguna</Text>
          <View style={styles.userTableCard}>
            <View style={styles.userSearchBox}>
              <Ionicons name="search" size={18} color="#94a3b8" />
              <TextInput 
                style={styles.userSearchInput}
                placeholder="SEARCH..."
                value={userSearch}
                onChangeText={setUserSearch}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHText, { width: 120 }]}>ID</Text>
                  <Text style={[styles.tableHText, { width: 200 }]}>EMAIL</Text>
                  <Text style={[styles.tableHText, { width: 150 }]}>NAMA</Text>
                </View>
                {usersList
                  .filter(u => 
                    (u.id || '').toLowerCase().includes(userSearch.toLowerCase()) || 
                    (u.emel || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                    (u.nama || '').toLowerCase().includes(userSearch.toLowerCase())
                  )
                  .map((u, idx) => (
                  <View key={u.id} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                    <Text style={[styles.tableCell, { width: 120 }]} numberOfLines={1}>{u.id}</Text>
                    <Text style={[styles.tableCell, { width: 200 }]} numberOfLines={1}>{u.emel}</Text>
                    <Text style={[styles.tableCell, { width: 150 }]}>{u.nama || 'N/A'}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, marginTop: 10
  },
  headerSubtitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  logoutText: { fontSize: 12, fontWeight: '800', color: '#dc2626' },
  avatar: { width: '100%', height: '100%', borderRadius: 24 },

  statsGrid: { marginBottom: 24 },
  mainStatCard: {
    borderRadius: 20, padding: 24, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
    elevation: 4, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8
  },
  mainStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
  mainStatValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 },

  subStatsRow: { flexDirection: 'row', gap: 10 },
  subStatCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0'
  },
  subStatValue: { fontSize: 18, fontWeight: '900' },
  subStatLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', marginTop: 4 },

  chartCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24, alignItems: 'center' },
  barChartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', height: 180, paddingHorizontal: 10 },
  barWrapper: { alignItems: 'center', gap: 6 },
  bar: { width: 28, backgroundColor: '#1e3a8a', borderRadius: 6 },
  barLabel: { fontSize: 10, fontWeight: '700', color: '#64748b' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 16 },
  seeAll: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },

  activityList: { backgroundColor: '#fff', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24 },
  activityItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  activityIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityInfo: { flex: 1 },
  activityName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  activityDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },

  urgentBox: { backgroundColor: '#fff1f2', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#fecaca' },
  urgentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  urgentTitle: { fontSize: 15, fontWeight: '800', color: '#991b1b' },
  urgentText: { fontSize: 13, color: '#b91c1c', lineHeight: 20, marginBottom: 16 },
  urgentBtn: { backgroundColor: '#dc2626', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  urgentBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  userListSection: { marginTop: 24, marginBottom: 20 },
  userTableCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  userSearchBox: { 
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', 
    borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' 
  },
  userSearchInput: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1e293b' },
  tableHeader: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableHText: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tableCell: { fontSize: 12, color: '#475569', fontWeight: '600' },
});
