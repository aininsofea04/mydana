import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { COLORS } from '../constants';

export default function StatusScreen({ navigation }) {
  const [appData, setAppData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubApp = null;
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) setUserData(userSnap.data());
        } catch (e) { console.error(e); }
        unsubApp = onSnapshot(doc(db, 'applications', user.uid), (docSnap) => {
          if (docSnap.exists()) setAppData({ id: docSnap.id, ...docSnap.data() });
          else setAppData(null);
          setLoading(false);
        });
      } else { setLoading(false); }
    });
    return () => { unsubAuth(); if (unsubApp) unsubApp(); };
  }, []);

  const user = auth.currentUser;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Memuatkan status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>🔒</Text>
          <Text style={styles.emptyTitle}>Log Masuk Diperlukan</Text>
          <Text style={styles.emptyText}>Sila log masuk untuk melihat status permohonan anda.</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnPrimaryText}>Log Masuk</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!appData) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Status Permohonan</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📋</Text>
          <Text style={styles.emptyTitle}>Tiada Permohonan</Text>
          <Text style={styles.emptyText}>Anda belum membuat sebarang permohonan.</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.btnPrimaryText}>Buat Permohonan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = userData?.nama || user?.displayName || user?.email?.split('@')[0] || 'Pemohon';
  const createdDate = appData.createdAt?.toDate ? appData.createdAt.toDate() : new Date();
  const dateStr = createdDate.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = createdDate.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
  const status = appData.status || 'pending';
  const score = appData.score || 0;
  const docs = appData.documents || [];

  const statusConfig = {
    approved: { label: 'Diluluskan', color: COLORS.success, bg: COLORS.successBg, icon: 'checkmark-circle' },
    rejected: { label: 'Ditolak', color: COLORS.error, bg: COLORS.errorBg, icon: 'close-circle' },
    pending: { label: 'Dalam Semakan', color: COLORS.secondary, bg: '#e0f2fe', icon: 'time' },
  };
  const sc = statusConfig[status] || statusConfig.pending;

  const timelineSteps = [
    { label: 'Permohonan Dihantar', desc: `${dateStr}, ${timeStr}` },
    { label: 'Semakan Dokumen', desc: 'Sedang dijalankan' },
    { label: 'Temu Bual (Jika Perlu)', desc: 'Menunggu keputusan' },
    { label: 'Keputusan Akhir', desc: status === 'approved' ? 'Diluluskan!' : status === 'rejected' ? `Ditolak: ${appData.reason || '-'}` : 'Menunggu' },
  ];
  const currentStep = status === 'approved' || status === 'rejected' ? 4 : 2;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Status Permohonan</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={24} color={COLORS.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileId}>ID: MYD-{user.uid.substring(0, 5).toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status Semasa</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Ionicons name={sc.icon} size={20} color={sc.color} />
            <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>SKOR AI</Text>
              <Text style={styles.detailValue}>{score}%</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>TARIKH</Text>
              <Text style={styles.detailValue}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Jejak Permohonan</Text>
          {timelineSteps.map((step, i) => {
            const completed = i < currentStep;
            const active = i === currentStep - 1;
            return (
              <View key={i} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, completed && styles.timelineDotDone, active && styles.timelineDotActive]}>
                    {completed ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <Text style={styles.timelineNum}>{i + 1}</Text>
                    )}
                  </View>
                  {i < timelineSteps.length - 1 && (
                    <View style={[styles.timelineLine, completed && styles.timelineLineDone]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, completed && { color: COLORS.text }]}>{step.label}</Text>
                  <Text style={styles.timelineDesc}>{step.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Documents */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dokumen Sokongan</Text>
          {docs.length > 0 ? docs.map((d, i) => (
            <TouchableOpacity key={i} style={styles.docItem} onPress={() => Linking.openURL(d.url)}>
              <Feather name="file-text" size={18} color={COLORS.primary} />
              <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
              <Feather name="external-link" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          )) : (
            <Text style={styles.emptyDocText}>Tiada dokumen dimuat naik.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { fontSize: 14, color: COLORS.textMuted, marginTop: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.borderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  profileName: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  profileId: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginBottom: 14, alignSelf: 'flex-start',
  },
  statusLabel: { fontSize: 15, fontWeight: '700' },
  detailRow: { flexDirection: 'row', gap: 20 },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginBottom: 4, letterSpacing: 0.5 },
  detailValue: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  timelineItem: { flexDirection: 'row', minHeight: 56 },
  timelineLeft: { alignItems: 'center', width: 30, marginRight: 12 },
  timelineDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  timelineDotDone: { backgroundColor: COLORS.success },
  timelineDotActive: { backgroundColor: COLORS.primary },
  timelineNum: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  timelineLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  timelineLineDone: { backgroundColor: COLORS.success },
  timelineContent: { flex: 1, paddingBottom: 14 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  timelineDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  docItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10, backgroundColor: COLORS.borderLight, marginBottom: 8,
  },
  docName: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.primary },
  emptyDocText: { fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic' },
  btnPrimary: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
