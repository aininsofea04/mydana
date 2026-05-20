import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Image, Alert, ActivityIndicator, Dimensions
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { auth, db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLORS } from '../constants';

const { width } = Dimensions.get('window');

export default function CreateProgressReportScreen({ navigation, route }) {
  const { appId } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [text, setText] = useState('');
  const [media, setMedia] = useState([]); // { type: 'image' | 'video', uri: string }
  const [appData, setAppData] = useState(null);

  useEffect(() => {
    if (!appId) {
      Alert.alert('Ralat', 'ID Permohonan tidak ditemui.');
      navigation.goBack();
      return;
    }
    const fetchApp = async () => {
      try {
        const snap = await getDoc(doc(db, 'applications', appId));
        if (snap.exists()) setAppData(snap.data());
      } catch (e) { console.error(e); }
    };
    fetchApp();
  }, [appId]);

  const pickMedia = async (type) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: type === 'image',
      quality: 0.7,
    });

    if (!result.canceled) {
      const newMedia = result.assets.map(asset => ({
        type: asset.type === 'video' ? 'video' : 'image',
        uri: asset.uri
      }));
      setMedia(prev => [...prev, ...newMedia]);
    }
  };

  const removeMedia = (index) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!text.trim()) {
      Alert.alert('Info Diperlukan', 'Sila tuliskan sedikit perkembangan kempen anda.');
      return;
    }

    setUploading(true);
    try {
      const uid = auth.currentUser.uid;
      const userName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
      const isAdmin = auth.currentUser.email === COLORS.ADMIN_EMAIL;

      // Helper to get Blob
      const getBlobFromUri = async (uri) => {
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = () => resolve(xhr.response);
          xhr.onerror = (e) => reject(new TypeError("Network request failed"));
          xhr.responseType = "blob";
          xhr.open("GET", uri, true);
          xhr.send(null);
        });
      };

      // Upload all media
      const uploadedMedia = await Promise.all(
        media.map(async (m) => {
          const blob = await getBlobFromUri(m.uri);
          const ext = m.type === 'video' ? 'mp4' : 'jpg';
          const sRef = ref(storage, `progress_reports/${appId}/${Date.now()}_${Math.random()}.${ext}`);
          await uploadBytes(sRef, blob);
          const url = await getDownloadURL(sRef);
          return { type: m.type, url };
        })
      );

      // Add to progress_reports sub-collection
      await addDoc(collection(db, 'applications', appId, 'progress_reports'), {
        text,
        media: uploadedMedia,
        userId: uid,
        userName,
        isAdminUpdate: isAdmin,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Berjaya!', 'Laporan perkembangan telah dimuat naik dan boleh dilihat oleh penderma.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Ralat', 'Gagal memuat naik laporan perkembangan.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lapor Perkembangan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Kongsikan perkembangan terbaru kempen anda. Anda boleh memuat naik gambar bukti, video ucapan, atau teks ringkas.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Berita Terkini</Text>
        <TextInput
          style={styles.input}
          placeholder="Apa perkembangan terbaru kempen anda? (Contoh: Barang bantuan telah dibeli, resit bayaran hospital, dsb.)"
          multiline
          value={text}
          onChangeText={setText}
        />

        <Text style={styles.sectionTitle}>Lampiran Media</Text>
        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickMedia('image')}>
            <Feather name="image" size={24} color={COLORS.primary} />
            <Text style={styles.uploadBtnText}>Tambah Gambar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickMedia('video')}>
            <Feather name="video" size={24} color={COLORS.secondary} />
            <Text style={styles.uploadBtnText}>Tambah Video</Text>
          </TouchableOpacity>
        </View>

        {media.length > 0 && (
          <View style={styles.mediaGrid}>
            {media.map((item, index) => (
              <View key={index} style={styles.mediaItem}>
                {item.type === 'video' ? (
                  <View style={styles.videoPreviewPlaceholder}>
                    <Ionicons name="videocam" size={30} color={COLORS.textMuted} />
                    <Text style={{fontSize: 10, color: COLORS.textMuted}}>Video</Text>
                  </View>
                ) : (
                  <Image source={{ uri: item.uri }} style={styles.mediaThumb} />
                )}
                <TouchableOpacity style={styles.removeMediaBtn} onPress={() => removeMedia(index)}>
                  <Ionicons name="close-circle" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />

        <TouchableOpacity 
          style={[styles.submitBtn, uploading && { opacity: 0.7 }]} 
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Hantar Kemaskini</Text>
              <Ionicons name="send" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
        
        <Text style={styles.noteText}>
          Nota: Laporan ini akan dipaparkan secara terbuka kepada semua penderma dan orang awam di halaman kempen anda.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scroll: { padding: 20 },
  infoBox: { 
    flexDirection: 'row', backgroundColor: '#eff6ff', padding: 14, 
    borderRadius: 12, gap: 10, marginBottom: 24, borderWidth: 1, borderColor: '#bfdbfe' 
  },
  infoText: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginTop: 10 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    fontSize: 15, color: COLORS.text, height: 150, textAlignVertical: 'top',
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 20,
  },
  uploadRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  uploadBtn: {
    flex: 1, height: 90, backgroundColor: COLORS.surface, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed',
    borderWidth: 1.5, borderColor: COLORS.border, gap: 8,
  },
  uploadBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaItem: { width: (width - 60) / 3, height: (width - 60) / 3, position: 'relative' },
  mediaThumb: { width: '100%', height: '100%', borderRadius: 10 },
  videoPreviewPlaceholder: { 
    width: '100%', height: '100%', borderRadius: 10, 
    backgroundColor: COLORS.borderLight, justifyContent: 'center', alignItems: 'center' 
  },
  removeMediaBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 10 },
  submitBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  noteText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});
