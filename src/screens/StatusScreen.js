import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
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

        // Legacy fallback: check for doc with ID == user.uid
        const legacyRef = doc(db, 'applications', user.uid);
        const legacySnap = await getDoc(legacyRef);

        // Query all applications for this user (New system)
        const q = query(
          collection(db, 'applications'),
          where('userId', '==', user.uid)
        );

        unsubApp = onSnapshot(q, (snap) => {
          let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          // Add legacy if exists and not already in list
          if (legacySnap.exists()) {
            const legacyData = { id: legacySnap.id, ...legacySnap.data() };
            if (!list.find(a => a.id === legacyData.id)) {
              list.push(legacyData);
            }
          }

          // Local sort by createdAt desc
          list.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          });

          setAppData(list);
          setLoading(false);
        }, (err) => {
          console.error(err);
          setLoading(false);
        });
      } else { 
        setLoading(false); 
      }
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
          <TouchableOpacity style={styles.btnPrimary} onPress={() => auth.signOut()}>
            <Text style={styles.btnPrimaryText}>Log Keluar</Text>
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

  const renderStatusCard = (app) => {
    const createdDate = app.createdAt?.toDate ? app.createdAt.toDate() : new Date();
    const dateStr = createdDate.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
    
    let updatedDateStr = '';
    if (app.updatedAt && app.updatedAt.toDate) {
      updatedDateStr = app.updatedAt.toDate().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    const status = app.status || 'pending';
    
    const statusConfig = {
      approved: { label: 'Diluluskan', color: COLORS.success, bg: COLORS.successBg, icon: 'checkmark-circle' },
      rejected: { label: 'Ditolak', color: COLORS.error, bg: COLORS.errorBg, icon: 'close-circle' },
      pending: { label: 'Dalam Semakan', color: COLORS.secondary, bg: '#e0f2fe', icon: 'time' },
    };
    const sc = statusConfig[status] || statusConfig.pending;

    return (
      <View key={app.id} style={styles.card}>
        <View style={styles.appHeader}>
          <Text style={styles.appTitle}>{app.summary?.tajuk || 'Permohonan Dana'}</Text>
          <View style={[styles.statusBadgeSmall, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusLabelSmall, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>TARIKH: {dateStr}</Text>
        </View>

        {/* Timeline Sejarah Status */}
        <View style={{ marginTop: 16, marginBottom: 8 }}>
          {[
            { id: 1, label: 'Permohonan Dihantar', desc: `Dihantar pada: ${dateStr}` },
            { id: 2, label: 'Dalam Semakan', desc: 'Permohonan diteliti oleh pihak admin.' },
            { id: 3, label: status === 'rejected' ? 'Permohonan Ditolak' : 'Permohonan Diluluskan', desc: status === 'pending' ? 'Menunggu keputusan akhir.' : (status === 'rejected' ? `Ditolak${updatedDateStr ? ` pada: ${updatedDateStr}` : ''}` : `Diluluskan${updatedDateStr ? ` pada: ${updatedDateStr}` : ''}`) }
          ].map((step, index, arr) => {
            let currentStep = 1;
            if (status === 'pending') currentStep = 2;
            if (status === 'approved' || status === 'rejected') currentStep = 3;

            const isDone = step.id <= currentStep;
            const isActive = step.id === currentStep;
            const isLast = index === arr.length - 1;

            let dotStyle = styles.timelineDot;
            if (isDone) dotStyle = [styles.timelineDot, styles.timelineDotDone];
            if (isActive && status === 'pending') dotStyle = [styles.timelineDot, styles.timelineDotActive];
            if (isActive && status === 'rejected') dotStyle = [styles.timelineDot, { backgroundColor: COLORS.error }];

            return (
              <View key={step.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={dotStyle}>
                    {isDone ? (
                      <Ionicons name={step.id === 3 && status === 'rejected' ? "close" : "checkmark"} size={14} color="#fff" />
                    ) : (
                      <Text style={styles.timelineNum}>{step.id}</Text>
                    )}
                  </View>
                  {!isLast && <View style={[styles.timelineLine, isDone && step.id < currentStep && styles.timelineLineDone]} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, isDone && { color: COLORS.text, fontWeight: '700' }]}>{step.label}</Text>
                  <Text style={styles.timelineDesc}>{step.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {status === 'approved' && (
          <View style={{ gap: 10, marginTop: 16 }}>
            <TouchableOpacity 
              style={styles.createBtn} 
              onPress={() => navigation.navigate('CreateFeed', { appId: app.id })}
            >
              <Ionicons name="images-outline" size={18} color="#fff" />
              <Text style={styles.createBtnText}>
                {app.isPublished ? 'Kemaskini Kandungan' : 'Cipta Kandungan Kempen'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.createBtn, { backgroundColor: COLORS.primary }]} 
              onPress={() => navigation.navigate('CreateProgressReport', { appId: app.id })}
            >
              <Ionicons name="megaphone-outline" size={18} color="#fff" />
              <Text style={styles.createBtnText}>Lapor Perkembangan</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'rejected' && (
          <Text style={styles.rejectReason}>Alasan: {app.reason || 'Tiada alasan diberikan.'}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inbox Permohonan</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Hai, {displayName}</Text>
          <Text style={styles.welcomeSubtext}>Berikut adalah senarai permohonan anda.</Text>
        </View>

        {appData.length > 0 ? (
          appData.map(renderStatusCard)
        ) : (
          <View style={styles.emptyCenter}>
            <Ionicons name="document-text-outline" size={50} color={COLORS.border} />
            <Text style={styles.emptyText}>Tiada permohonan ditemui.</Text>
          </View>
        )}
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
  welcomeSection: { marginBottom: 20 },
  welcomeText: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  welcomeSubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  appTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  statusBadgeSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusLabelSmall: { fontSize: 11, fontWeight: '700' },
  rejectReason: { marginTop: 10, fontSize: 13, color: COLORS.error, fontStyle: 'italic' },
  emptyCenter: { alignItems: 'center', marginTop: 50 },
  btnPrimary: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  createBtn: {
    backgroundColor: COLORS.success, paddingVertical: 12, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16,
  },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
