import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, RefreshControl, TextInput, ImageBackground
} from 'react-native';
import Loading from './Loading';
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
  const [allApps, setAllApps] = useState([]);
  const [donationsList, setDonationsList] = useState([]);
  const [donationSearch, setDonationSearch] = useState('');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [applicantSearch, setApplicantSearch] = useState('');

  const parseAmt = s => {
    if (typeof s === 'number') return s;
    const n = parseFloat((s || '').toString().replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const fetchAllData = () => {
    // 1. Fetch Stats from Applications
    const qApps = query(collection(db, 'applications'));
    const unsubApps = onSnapshot(qApps, (snap) => {
      const appsDocs = snap.docs.map(d => ({ id: d.id, ...d.data(), _dt: d.data().createdAt?.toDate?.() || new Date() }));
      setAllApps(appsDocs);

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

    // 4. Fetch Donations
    const qDonations = query(collection(db, 'donations'), orderBy('createdAt', 'desc'));
    const unsubDonations = onSnapshot(qDonations, (snap) => {
      const donations = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        date: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
      }));
      setDonationsList(donations);
    });

    return () => {
      unsubApps();
      unsubUsers();
      unsubRecent();
      unsubDonations();
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

  const approvedApps = useMemo(() => allApps.filter(a => a.status === 'approved'), [allApps]);
  const totalTargetFunds = useMemo(() => approvedApps.reduce((s, a) => s + (parseAmt(a.summary?.dana) || 0), 0), [approvedApps]);
  const totalRemainingFunds = useMemo(() => Math.max(0, totalTargetFunds - stats.totalCollected), [totalTargetFunds, stats.totalCollected]);

  const enrichedUsers = useMemo(() => {
    return usersList.map(u => {
      const isApplicant = allApps.some(a => a.userId === u.id || a.uid === u.id || a.email === u.emel);
      const isDonor = donationsList.some(don => don.userId === u.id || don.userEmail === u.emel);
      return { ...u, isApplicant, isDonor };
    });
  }, [usersList, allApps, donationsList]);

  if (loading) {
    return <Loading text="Memuatkan papan pemuka pentadbir..." />;
  }

  return (
    <ImageBackground source={require('../../assets/bg_general.jpg')} style={styles.backgroundImage} resizeMode="cover">
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
              <Ionicons name="log-out-outline" size={15} color="#dc2626" />
              <Text style={styles.logoutText}>Keluar</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <LinearGradient colors={[COLORS.secondary, COLORS.primary]} style={styles.mainStatCard}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.mainStatLabel}>Sumbangan Dana Terkumpul</Text>
                    <Text style={styles.mainStatValue}>RM {stats.totalCollected.toLocaleString('ms-MY')}</Text>
                  </View>
                  <Ionicons name="cash-outline" size={40} color="rgba(255,255,255,0.2)" />
                </View>

                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 12 }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={[styles.mainStatLabel, { fontSize: 11 }]}>Sasaran Keseluruhan</Text>
                    <Text style={[styles.mainStatValue, { fontSize: 18, marginTop: 2 }]}>RM {totalTargetFunds.toLocaleString('ms-MY')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.mainStatLabel, { fontSize: 11 }]}>Baki Diperlukan</Text>
                    <Text style={[styles.mainStatValue, { fontSize: 18, marginTop: 2, color: '#fef08a' }]}>RM {totalRemainingFunds.toLocaleString('ms-MY')}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.subStatsRow}>
            <View style={styles.subStatCard}>
              <Text style={[styles.subStatValue, { color: '#f59e0b' }]}>{stats.pending}</Text>
              <Text style={styles.subStatLabel}>Tunggu kelulusan</Text>
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

          {/* Ringkasan Kempen & Dana Diperlukan */}
          <View style={styles.campaignListSection}>
            <Text style={styles.sectionTitle}>Ringkasan Kempen & Dana Diperlukan</Text>
            <View style={styles.userTableCard}>
              <View style={styles.userSearchBox}>
                <Ionicons name="search" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.userSearchInput}
                  placeholder="Cari kempen..."
                  value={campaignSearch}
                  onChangeText={setCampaignSearch}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHText, { width: 150 }]}>TAJUK KEMPEN</Text>
                    <Text style={[styles.tableHText, { width: 100 }]}>SASARAN</Text>
                    <Text style={[styles.tableHText, { width: 100 }]}>TERKUMPUL</Text>
                    <Text style={[styles.tableHText, { width: 100 }]}>BAKI</Text>
                    <Text style={[styles.tableHText, { width: 100 }]}>STATUS</Text>
                  </View>
                  {allApps
                    .filter(a =>
                      (a.summary?.tajuk || '').toLowerCase().includes(campaignSearch.toLowerCase()) ||
                      (a.name || '').toLowerCase().includes(campaignSearch.toLowerCase())
                    )
                    .map((a, idx) => {
                      const targetAmt = parseAmt(a.summary?.dana) || 0;
                      const collectedAmt = parseAmt(a.collectedAmount) || 0;
                      const remainingAmt = Math.max(0, targetAmt - collectedAmt);
                      return (
                        <TouchableOpacity
                          key={a.id}
                          style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: 'rgba(254, 249, 195, 0.3)' }]}
                          onPress={() => navigation.navigate('AdminDetail', { app: a })}
                        >
                          <Text style={[styles.tableCell, { width: 150 }]} numberOfLines={1}>{a.summary?.tajuk || 'N/A'}</Text>
                          <Text style={[styles.tableCell, { width: 100 }]}>RM {targetAmt.toLocaleString('ms-MY')}</Text>
                          <Text style={[styles.tableCell, { width: 100, color: COLORS.success }]}>RM {collectedAmt.toLocaleString('ms-MY')}</Text>
                          <Text style={[styles.tableCell, { width: 100, color: remainingAmt > 0 ? COLORS.error : COLORS.success }]}>RM {remainingAmt.toLocaleString('ms-MY')}</Text>
                          <View style={{ width: 100 }}>
                            <StatusBadge status={a.status} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Rekod Pemohon Sumbangan */}
          <View style={styles.applicantListSection}>
            <Text style={styles.sectionTitle}>Rekod Pemohon Sumbangan</Text>
            <View style={styles.userTableCard}>
              <View style={styles.userSearchBox}>
                <Ionicons name="search" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.userSearchInput}
                  placeholder="Cari pemohon..."
                  value={applicantSearch}
                  onChangeText={setApplicantSearch}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHText, { width: 120 }]}>PEMOHON</Text>
                    <Text style={[styles.tableHText, { width: 150 }]}>KEMPEN</Text>
                    <Text style={[styles.tableHText, { width: 100 }]}>DANA DIPOHON</Text>
                    <Text style={[styles.tableHText, { width: 180 }]}>SEBAB</Text>
                    <Text style={[styles.tableHText, { width: 120 }]}>BANK</Text>
                    <Text style={[styles.tableHText, { width: 100 }]}>STATUS</Text>
                  </View>
                  {allApps
                    .filter(a =>
                      (a.name || '').toLowerCase().includes(applicantSearch.toLowerCase()) ||
                      (a.summary?.tajuk || '').toLowerCase().includes(applicantSearch.toLowerCase()) ||
                      (a.summary?.sebab || '').toLowerCase().includes(applicantSearch.toLowerCase())
                    )
                    .map((a, idx) => (
                      <TouchableOpacity
                        key={a.id}
                        style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: 'rgba(254, 249, 195, 0.3)' }]}
                        onPress={() => navigation.navigate('AdminDetail', { app: a })}
                      >
                        <Text style={[styles.tableCell, { width: 120, fontWeight: '700', color: COLORS.text }]} numberOfLines={1}>{a.name || 'N/A'}</Text>
                        <Text style={[styles.tableCell, { width: 150 }]} numberOfLines={1}>{a.summary?.tajuk || 'N/A'}</Text>
                        <Text style={[styles.tableCell, { width: 100, color: COLORS.primary, fontWeight: '800' }]}>{a.summary?.dana || 'RM 0'}</Text>
                        <Text style={[styles.tableCell, { width: 180 }]} numberOfLines={2}>{a.summary?.sebab || 'N/A'}</Text>
                        <Text style={[styles.tableCell, { width: 120 }]} numberOfLines={1}>{a.summary?.bank || 'N/A'}</Text>
                        <View style={{ width: 100 }}>
                          <StatusBadge status={a.status} />
                        </View>
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Rekod Sumbangan Penyumbang */}
          <View style={styles.donationListSection}>
            <Text style={styles.sectionTitle}>Rekod Sumbangan Penyumbang</Text>
            <View style={styles.userTableCard}>
              <View style={styles.userSearchBox}>
                <Ionicons name="search" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.userSearchInput}
                  placeholder="Cari sumbangan..."
                  value={donationSearch}
                  onChangeText={setDonationSearch}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHText, { width: 150 }]}>PENYUMBANG</Text>
                    <Text style={[styles.tableHText, { width: 150 }]}>KEMPEN</Text>
                    <Text style={[styles.tableHText, { width: 80 }]}>JUMLAH</Text>
                    <Text style={[styles.tableHText, { width: 80 }]}>KAEDAH</Text>
                    <Text style={[styles.tableHText, { width: 100 }]}>TARIKH</Text>
                  </View>
                  {donationsList
                    .filter(d =>
                      (d.userName || '').toLowerCase().includes(donationSearch.toLowerCase()) ||
                      (d.userEmail || '').toLowerCase().includes(donationSearch.toLowerCase()) ||
                      (d.campaignName || '').toLowerCase().includes(donationSearch.toLowerCase())
                    )
                    .map((d, idx) => (
                      <View key={d.id} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: 'rgba(254, 249, 195, 0.3)' }]}>
                        <View style={{ width: 150 }}>
                          <Text style={[styles.tableCell, { fontWeight: '700', color: COLORS.text }]} numberOfLines={1}>{d.userName}</Text>
                          <Text style={[styles.tableCell, { fontSize: 10, color: COLORS.textSecondary }]} numberOfLines={1}>{d.userEmail}</Text>
                        </View>
                        <Text style={[styles.tableCell, { width: 150 }]} numberOfLines={1}>{d.campaignName || 'N/A'}</Text>
                        <Text style={[styles.tableCell, { width: 80, color: COLORS.success, fontWeight: '800' }]}>RM {d.amount?.toLocaleString('ms-MY')}</Text>
                        <Text style={[styles.tableCell, { width: 80, textTransform: 'uppercase' }]}>{d.paymentMethod}</Text>
                        <Text style={[styles.tableCell, { width: 100 }]}>{d.date.toLocaleDateString('ms-MY')}</Text>
                      </View>
                    ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* User Account List (Participants List) */}
          <View style={styles.userListSection}>
            <Text style={styles.sectionTitle}>Senarai Akaun Pengguna</Text>
            <View style={styles.userTableCard}>
              <View style={styles.userSearchBox}>
                <Ionicons name="search" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.userSearchInput}
                  placeholder="Cari akaun..."
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHText, { width: 100 }]}>ID</Text>
                    <Text style={[styles.tableHText, { width: 180 }]}>EMAIL</Text>
                    <Text style={[styles.tableHText, { width: 120 }]}>NAMA</Text>
                    <Text style={[styles.tableHText, { width: 150 }]}>PERANAN</Text>
                  </View>
                  {enrichedUsers
                    .filter(u =>
                      (u.id || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                      (u.emel || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                      (u.nama || '').toLowerCase().includes(userSearch.toLowerCase())
                    )
                    .map((u, idx) => {
                      let roleLabel = 'Pengguna';
                      let roleBg = '#e2e8f0';
                      let roleColor = '#64748b';

                      if (u.isApplicant && u.isDonor) {
                        roleLabel = 'Pemohon & Penyumbang';
                        roleBg = '#fef9c3'; // Light yellow
                        roleColor = '#d97706'; // Gold
                      } else if (u.isApplicant) {
                        roleLabel = 'Pemohon';
                        roleBg = '#fee2e2'; // Light pink
                        roleColor = '#be185d'; // Pink/Burgundy
                      } else if (u.isDonor) {
                        roleLabel = 'Penyumbang';
                        roleBg = '#ecfdf5'; // Light green
                        roleColor = '#10b981'; // Green
                      }

                      return (
                        <View key={u.id} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: 'rgba(254, 249, 195, 0.3)' }]}>
                          <Text style={[styles.tableCell, { width: 100 }]} numberOfLines={1}>{u.id}</Text>
                          <Text style={[styles.tableCell, { width: 180 }]} numberOfLines={1}>{u.emel}</Text>
                          <Text style={[styles.tableCell, { width: 120 }]}>{u.nama || 'N/A'}</Text>
                          <View style={{ width: 150 }}>
                            <View style={{ backgroundColor: roleBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: roleColor }}>{roleLabel}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                </View>
              </ScrollView>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, marginTop: 10
  },
  headerSubtitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  logoutText: { fontSize: 12, fontWeight: '800', color: '#dc2626' },

  statsGrid: { marginBottom: 24 },
  mainStatCard: {
    borderRadius: 20, padding: 24, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
    elevation: 4, shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8
  },
  mainStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
  mainStatValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 },

  subStatsRow: { flexDirection: 'row', gap: 10 },
  subStatCard: {
    flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.85)', borderRadius: 16, padding: 12,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.borderLight
  },
  subStatValue: { fontSize: 18, fontWeight: '900' },
  subStatLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginTop: 4 },

  chartCard: { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: COLORS.borderLight, marginBottom: 24, alignItems: 'center' },
  barChartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', height: 180, paddingHorizontal: 10 },
  barWrapper: { alignItems: 'center', gap: 6 },
  bar: { width: 28, backgroundColor: COLORS.primary, borderRadius: 6 },
  barLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  seeAll: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },

  activityList: { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderRadius: 20, padding: 8, borderWidth: 1.5, borderColor: COLORS.borderLight, marginBottom: 24 },
  activityItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  activityIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(254, 249, 195, 0.3)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityInfo: { flex: 1 },
  activityName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  activityDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },

  urgentBox: { backgroundColor: '#fff1f2', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: '#fecaca' },
  urgentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  urgentTitle: { fontSize: 15, fontWeight: '800', color: '#991b1b' },
  urgentText: { fontSize: 13, color: '#b91c1c', lineHeight: 20, marginBottom: 16 },
  urgentBtn: { backgroundColor: '#dc2626', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  urgentBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  userListSection: { marginTop: 24, marginBottom: 20 },
  userTableCard: { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: COLORS.borderLight },
  userSearchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surface,
    borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 16, borderWidth: 1.5, borderColor: COLORS.border
  },
  userSearchInput: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.text },
  tableHeader: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  tableHText: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, alignItems: 'center' },
  tableCell: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  campaignListSection: { marginTop: 24 },
  donationListSection: { marginTop: 24 },
  applicantListSection: { marginTop: 24 },
});
