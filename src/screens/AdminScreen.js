import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  FlatList, Alert, TextInput, Modal, ActivityIndicator, Linking,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { collection, getDocs, orderBy, query, updateDoc, doc } from 'firebase/firestore';
import { COLORS, ADMIN_EMAIL } from '../constants';

export default function AdminScreen({ navigation }) {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
   const [rejectId, setRejectId] = useState(null);
 
   const handleLogout = async () => {
     try {
       await auth.signOut();
     } catch (e) {
       Alert.alert('Ralat', 'Gagal log keluar.');
     }
   };

  // Auth guard
  const user = auth.currentUser;
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) return;
    const fetchApps = async () => {
      try {
        const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const apps = snap.docs.map((d) => {
          const data = d.data();
          const dt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          return {
            id: d.id, name: data.name || 'Pemohon', category: data.category || 'Umum',
            date: dt.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }),
            score: data.score || 0, scoreClass: data.scoreClass || 'low',
            summary: data.summary || {}, aiAnalysis: data.aiAnalysis || {},
            transcript: data.transcript || [], documents: data.documents || [],
            status: data.status || 'pending', reason: data.reason || '',
          };
        });
        setApplications(apps);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchApps();
  }, [isAdmin]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={32} color={COLORS.error} />
          <Text style={styles.accessTitle}>Log Masuk Diperlukan</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnPrimaryText}>Log Masuk</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="shield-outline" size={40} color={COLORS.error} />
          <Text style={styles.accessTitle}>Akses Ditolak</Text>
          <Text style={styles.accessText}>Hanya admin rasmi MyDana boleh mengakses panel ini.</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.btnPrimaryText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalApps = applications.length;
  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const avgScore = totalApps > 0 ? Math.round(applications.reduce((s, a) => s + a.score, 0) / totalApps) : 0;

  const handleApprove = (appId) => {
    Alert.alert('Sahkan', 'Luluskan permohonan ini?', [
      { text: 'Batal' },
      { text: 'Sahkan', onPress: async () => {
        try {
          await updateDoc(doc(db, 'applications', appId), { status: 'approved' });
          setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'approved' } : a));
          if (selectedApp?.id === appId) setSelectedApp(prev => ({ ...prev, status: 'approved' }));
          Alert.alert('Berjaya', 'Permohonan telah disahkan.');
        } catch (e) { Alert.alert('Ralat', 'Gagal mengesahkan.'); }
      }},
    ]);
  };

  const handleReject = (appId) => {
    setRejectId(appId);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectId) return;
    try {
      await updateDoc(doc(db, 'applications', rejectId), { status: 'rejected', reason: rejectReason });
      setApplications(prev => prev.map(a => a.id === rejectId ? { ...a, status: 'rejected', reason: rejectReason } : a));
      if (selectedApp?.id === rejectId) setSelectedApp(prev => ({ ...prev, status: 'rejected', reason: rejectReason }));
      Alert.alert('Selesai', 'Permohonan telah ditolak.');
    } catch (e) { Alert.alert('Ralat', 'Gagal menolak.'); }
    setRejectModalVisible(false);
  };

  const getScoreColor = (sc) => sc === 'high' ? COLORS.success : sc === 'medium' ? COLORS.warning : COLORS.error;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Detail View
  if (selectedApp) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => setSelectedApp(null)}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analisis AI</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Score */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selectedApp.name}</Text>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scoreNum, { color: getScoreColor(selectedApp.scoreClass) }]}>{selectedApp.score}%</Text>
              <Text style={styles.scoreLabel}>Skor Kesahihan</Text>
            </View>
            <Text style={[styles.scoreVerdict, { color: getScoreColor(selectedApp.scoreClass) }]}>
              {selectedApp.score >= 80 ? '✅ Sangat Tinggi' : selectedApp.score > 60 ? '⚠️ Sederhana' : '❌ Rendah'}
            </Text>
            {selectedApp.aiAnalysis?.sebab && (
              <View style={styles.aiReasonBox}>
                <Text style={styles.aiReasonTitle}>Sebab Skor (Analisis AI):</Text>
                <Text style={styles.aiReasonText}>{selectedApp.aiAnalysis.sebab}</Text>
              </View>
            )}
          </View>

          {/* Summary */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rumusan Permohonan</Text>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Tajuk</Text>
              <Text style={styles.summaryValue}>{selectedApp.summary?.tajuk || selectedApp.name}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Lokasi</Text>
              <Text style={styles.summaryValue}>{selectedApp.summary?.lokasi || 'N/A'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Sebab</Text>
              <Text style={styles.summaryValue}>{selectedApp.summary?.sebab || 'N/A'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Jumlah Dana</Text>
              <Text style={styles.summaryValue}>{selectedApp.summary?.dana || 'N/A'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Info Bank</Text>
              <Text style={styles.summaryValue}>{selectedApp.summary?.bank || 'N/A'}</Text>
            </View>
          </View>

          {/* Actions */}
          {selectedApp.status === 'pending' && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(selectedApp.id)}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Sahkan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(selectedApp.id)}>
                <Ionicons name="close" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Tolak</Text>
              </TouchableOpacity>
            </View>
          )}
          {selectedApp.status === 'approved' && (
            <View style={[styles.statusBanner, { backgroundColor: COLORS.successBg }]}>
              <Text style={{ color: COLORS.success, fontWeight: '700' }}>✅ DILULUSKAN</Text>
            </View>
          )}
          {selectedApp.status === 'rejected' && (
            <View style={[styles.statusBanner, { backgroundColor: COLORS.errorBg }]}>
              <Text style={{ color: COLORS.error, fontWeight: '700' }}>❌ DITOLAK: {selectedApp.reason}</Text>
            </View>
          )}

          {/* Documents */}
          {selectedApp.documents?.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dokumen Sokongan</Text>
              {selectedApp.documents.map((d, i) => (
                <TouchableOpacity key={i} style={styles.docItem} onPress={() => Linking.openURL(d.url)}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Feather name="file-text" size={16} color={COLORS.primary} />
                      <Text style={styles.docName}>{d.name}</Text>
                    </View>
                    {d.aiDescription && (
                      <Text style={styles.aiDocDesc}>🔍 AI: {d.aiDescription}</Text>
                    )}
                  </View>
                  <Ionicons name="external-link" size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Transcript */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Transkrip Chatbot</Text>
            {selectedApp.transcript?.map((msg, i) => (
              <View key={i} style={[styles.transcriptMsg, msg.role === 'user' && styles.transcriptUser]}>
                <Text style={styles.transcriptSender}>{msg.role === 'assistant' ? 'AI' : 'PEMOHON'}</Text>
                <Text style={styles.transcriptText}>{msg.text || msg.content}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <Modal visible={rejectModalVisible} transparent animationType="fade">
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Alasan Penolakan</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nyatakan alasan..."
                  placeholderTextColor={COLORS.textMuted}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                  autoFocus
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModalVisible(false)}>
                    <Text style={{ color: COLORS.textSecondary, fontWeight: '600' }}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={confirmReject}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Tolak</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    );
  }

  // List View
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={handleLogout}>
          <Feather name="log-out" size={20} color={COLORS.error} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panel Pentadbir</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Feather name="file-text" size={20} color={COLORS.primary} />
            <Text style={styles.statNum}>{totalApps}</Text>
            <Text style={styles.statLabel}>Jumlah</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="clock" size={20} color="#f59e0b" />
            <Text style={styles.statNum}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Menunggu</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="shield" size={20} color={COLORS.success} />
            <Text style={styles.statNum}>{avgScore}%</Text>
            <Text style={styles.statLabel}>Purata AI</Text>
          </View>
        </View>

        {/* Application List */}
        <Text style={styles.sectionTitle}>Senarai Permohonan</Text>
        {applications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Tiada permohonan baru.</Text>
          </View>
        ) : (
          applications.map((app) => (
            <TouchableOpacity
              key={app.id}
              style={styles.appCard}
              onPress={() => setSelectedApp(app)}
              activeOpacity={0.8}
            >
              <View style={styles.appCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>{app.name}</Text>
                  <Text style={styles.appMeta}>{app.category} • {app.date}</Text>
                </View>
                <View style={styles.scorePill}>
                  <View style={[styles.scoreDot, { backgroundColor: getScoreColor(app.scoreClass) }]} />
                  <Text style={[styles.scoreText, { color: getScoreColor(app.scoreClass) }]}>{app.score}%</Text>
                </View>
              </View>
              <View style={styles.appCardBottom}>
                {app.status === 'pending' && (
                  <View style={styles.appActions}>
                    <TouchableOpacity style={styles.approveSmall} onPress={() => handleApprove(app.id)}>
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Sahkan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectSmall} onPress={() => handleReject(app.id)}>
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Tolak</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {app.status === 'approved' && <Text style={{ color: COLORS.success, fontWeight: '700' }}>LULUS</Text>}
                {app.status === 'rejected' && <Text style={{ color: COLORS.error, fontWeight: '700' }}>DITOLAK</Text>}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Alasan Penolakan</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nyatakan alasan penolakan..."
              placeholderTextColor={COLORS.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModalVisible(false)}>
                <Text style={{ color: COLORS.textSecondary, fontWeight: '600' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmReject}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Tolak</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  accessTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  accessText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scroll: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 30, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
  appCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  appCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  appName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  appMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  scorePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.borderLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  scoreDot: { width: 8, height: 8, borderRadius: 4 },
  scoreText: { fontSize: 13, fontWeight: '700' },
  appCardBottom: { flexDirection: 'row', justifyContent: 'flex-end' },
  appActions: { flexDirection: 'row', gap: 8 },
  approveSmall: { backgroundColor: COLORS.success, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  rejectSmall: { backgroundColor: COLORS.error, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  scoreCircle: { alignItems: 'center', marginVertical: 16 },
  scoreNum: { fontSize: 48, fontWeight: '800' },
  scoreLabel: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  scoreVerdict: { textAlign: 'center', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.success, paddingVertical: 14, borderRadius: 12,
  },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.error, paddingVertical: 14, borderRadius: 12,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  statusBanner: { padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 14 },
  docItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 8, backgroundColor: COLORS.borderLight, marginBottom: 6,
  },
  docName: { flex: 1, fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  transcriptMsg: {
    padding: 10, borderRadius: 10, marginBottom: 8, backgroundColor: COLORS.borderLight,
  },
  transcriptUser: { backgroundColor: '#dbeafe' },
  transcriptSender: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  transcriptText: { fontSize: 13, color: COLORS.text, lineHeight: 19 },
  btnPrimary: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  modalInput: {
    backgroundColor: COLORS.borderLight, borderRadius: 12, padding: 14,
    fontSize: 14, color: COLORS.text, minHeight: 80, textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 20 },
  modalConfirm: {
    backgroundColor: COLORS.error, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10,
  },
  aiReasonBox: {
    backgroundColor: COLORS.borderLight, padding: 12, borderRadius: 10, marginTop: 16,
  },
  aiReasonTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  aiReasonText: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  summaryItem: { marginBottom: 12 },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 2 },
  summaryValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  aiDocDesc: { fontSize: 11, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 4, marginLeft: 24 },
});
