import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, Modal, ActivityIndicator, Linking,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { COLORS, ADMIN_EMAIL } from '../constants';

export default function AdminDetailScreen({ navigation, route }) {
  const { app } = route.params;
  const insets = useSafeAreaInsets();
  const [selectedApp, setSelectedApp] = useState(app);
  const [loading, setLoading] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  const user = auth.currentUser;
  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleApprove = (appId) => {
    Alert.alert('Sahkan', 'Luluskan permohonan ini?', [
      { text: 'Batal' },
      {
        text: 'Sahkan', onPress: async () => {
          try {
            setLoading(true);
            await updateDoc(doc(db, 'applications', appId), { status: 'approved', updatedAt: serverTimestamp() });
            setSelectedApp(prev => ({ ...prev, status: 'approved' }));
            Alert.alert('Berjaya', 'Permohonan telah disahkan.');
          } catch (e) { Alert.alert('Ralat', 'Gagal mengesahkan.'); }
          setLoading(false);
        }
      },
    ]);
  };

  const confirmReject = async () => {
    try {
      setLoading(true);
      await updateDoc(doc(db, 'applications', selectedApp.id), { status: 'rejected', reason: rejectReason, updatedAt: serverTimestamp() });
      setSelectedApp(prev => ({ ...prev, status: 'rejected', reason: rejectReason }));
      Alert.alert('Selesai', 'Permohonan telah ditolak.');
    } catch (e) { Alert.alert('Ralat', 'Gagal menolak.'); }
    setLoading(false);
    setRejectModalVisible(false);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return COLORS.success;
    if (score > 60) return '#f59e0b';
    return COLORS.error;
  };

  if (!isAdmin) {
    return <View style={styles.center}><Text>Akses Ditolak</Text></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Butiran Permohonan</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Score Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{selectedApp.name}</Text>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreNum, { color: getScoreColor(selectedApp.score || 0) }]}>{selectedApp.score || 0}%</Text>
            <Text style={styles.scoreLabel}>Skor Kesahihan AI</Text>
          </View>
          
          <View style={styles.aiReasonBox}>
            <Text style={styles.aiReasonTitle}>📝 Rumusan AI:</Text>
            <Text style={styles.aiReasonText}>
              {selectedApp.aiAnalysis?.crossChecking || selectedApp.aiAnalysis?.sebab || 'Tiada analisis teks.'}
            </Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informasi Kempen</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Tajuk</Text>
            <Text style={styles.summaryValue}>{selectedApp.summary?.tajuk || 'N/A'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Sasaran Dana</Text>
            <Text style={styles.summaryValue}>{selectedApp.summary?.dana || 'RM 0'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Sebab</Text>
            <Text style={styles.summaryValue}>{selectedApp.summary?.sebab || 'N/A'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Bank</Text>
            <Text style={styles.summaryValue}>{selectedApp.summary?.bank || 'N/A'}</Text>
          </View>
        </View>

        {/* Actions */}
        {selectedApp.status === 'pending' ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(selectedApp.id)}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Sahkan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => setRejectModalVisible(true)}>
              <Ionicons name="close" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Tolak</Text>
            </TouchableOpacity>
          </View>
        ) : selectedApp.status === 'approved' ? (
          <View style={{ gap: 10, marginBottom: 14 }}>
            <View style={[styles.statusBanner, { backgroundColor: '#f0fdf4' }]}>
              <Text style={{ color: '#16a34a', fontWeight: '800' }}>✅ DILULUSKAN</Text>
            </View>
            <TouchableOpacity 
              style={[styles.approveBtn, { backgroundColor: COLORS.primary }]} 
              onPress={() => navigation.navigate('CreateProgressReport', { appId: selectedApp.id })}
            >
              <Ionicons name="megaphone-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Update Perkembangan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.statusBanner, { backgroundColor: '#fef2f2' }]}>
            <Text style={{ color: '#dc2626', fontWeight: '800' }}>❌ DITOLAK: {selectedApp.reason}</Text>
          </View>
        )}

        {/* Chatbot Transcript Button */}
        <TouchableOpacity 
          style={styles.transcriptBtn}
          onPress={() => setShowTranscript(true)}
        >
          <Ionicons name="chatbubbles-outline" size={20} color={COLORS.primary} />
          <Text style={styles.transcriptBtnText}>Lihat Transkrip Chatbot</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </TouchableOpacity>

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
                  {d.aiDescription && <Text style={styles.aiDocDesc}>🔍 AI: {d.aiDescription}</Text>}
                </View>
                <Ionicons name="external-link" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Transcript Modal */}
      <Modal visible={showTranscript} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: insets.top }}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setShowTranscript(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Sejarah Chatbot AI</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {selectedApp.transcript && selectedApp.transcript.length > 0 ? (
              selectedApp.transcript.map((msg, i) => (
                <View key={i} style={[styles.msgBox, msg.role === 'user' ? styles.userMsg : styles.aiMsg]}>
                  <Text style={styles.msgRole}>{msg.role === 'user' ? 'PEMOHON' : 'AI MYDANA'}</Text>
                  <Text style={styles.msgText}>{msg.text || msg.content}</Text>
                </View>
              ))
            ) : (
              <Text style={{ textAlign: 'center', marginTop: 40, color: '#64748b' }}>Tiada rekod perbualan ditemui.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Alasan Penolakan</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Sila nyatakan alasan..."
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)} style={styles.modalCancel}>
                <Text style={{ color: '#64748b', fontWeight: '700' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmReject} style={styles.modalConfirm}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Sahkan Tolak</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.overlayLoading}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerBar: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 16, paddingVertical: 12, 
    backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' 
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  scoreCircle: { alignItems: 'center', marginVertical: 10 },
  scoreNum: { fontSize: 48, fontWeight: '900' },
  scoreLabel: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '600' },
  aiReasonBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  aiReasonTitle: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  aiReasonText: { fontSize: 13, color: '#475569', lineHeight: 20 },
  summaryItem: { marginBottom: 12 },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  approveBtn: { flex: 1, backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  rejectBtn: { flex: 1, backgroundColor: '#dc2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  statusBanner: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#f8fafc', marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  docName: { flex: 1, fontSize: 13, color: '#004282', fontWeight: '700' },
  aiDocDesc: { fontSize: 11, color: '#64748b', marginTop: 4, marginLeft: 24, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 16 },
  modalInput: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 16, minHeight: 100, textAlignVertical: 'top', fontSize: 14, color: '#1e293b', marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  modalCancel: { padding: 12 },
  modalConfirm: { backgroundColor: '#dc2626', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  overlayLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  transcriptBtn: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', 
    padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 
  },
  transcriptBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.primary },
  modalHeaderBar: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 16, paddingVertical: 12, 
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' 
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  closeBtn: { padding: 4 },
  msgBox: { padding: 12, borderRadius: 14, marginBottom: 10, maxWidth: '90%' },
  aiMsg: { backgroundColor: '#fff', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e2e8f0' },
  userMsg: { backgroundColor: '#dbeafe', alignSelf: 'flex-end' },
  msgRole: { fontSize: 9, fontWeight: '800', color: '#64748b', marginBottom: 2 },
  msgText: { fontSize: 13, color: '#1e293b', lineHeight: 18 },
});
