import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { auth, db, storage } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLORS } from '../constants';

export default function CreateFeedScreen({ navigation }) {
  const [appData, setAppData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [description, setDescription] = useState('');
  const [videoUri, setVideoUri] = useState(null);
  const [images, setImages] = useState([]);

  useEffect(() => {
    const fetchApp = async () => {
      if (!auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'applications', auth.currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setAppData(data);
          if (data.feed) {
            setDescription(data.feed.description || '');
            setVideoUri(data.feed.video || null);
            setImages(data.feed.images || []);
          } else {
            setDescription(data.summary?.sebab || '');
          }
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchApp();
  }, []);

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setVideoUri(result.assets[0].uri);
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImages(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const handleUpload = async () => {
    if (!description.trim()) {
      Alert.alert('Info Diperlukan', 'Sila berikan sedikit penerangan untuk kempen anda.');
      return;
    }
    if (!videoUri && images.length === 0) {
      Alert.alert('Media Diperlukan', 'Sila muat naik sekurangnya satu video atau gambar.');
      return;
    }

    setUploading(true);
    try {
      const uid = auth.currentUser.uid;
      let finalVideoUrl = videoUri;
      let finalImages = [...images];

      // Upload Video if new
      if (videoUri && videoUri.startsWith('file://')) {
        const res = await fetch(videoUri);
        const blob = await res.blob();
        const sRef = ref(storage, `feeds/${uid}/video_${Date.now()}.mp4`);
        await uploadBytes(sRef, blob);
        finalVideoUrl = await getDownloadURL(sRef);
      }

      // Upload Images if new
      const uploadedImageUrls = await Promise.all(
        images.map(async (uri) => {
          if (uri.startsWith('http')) return uri;
          const res = await fetch(uri);
          const blob = await res.blob();
          const sRef = ref(storage, `feeds/${uid}/img_${Date.now()}_${Math.random()}.jpg`);
          await uploadBytes(sRef, blob);
          return await getDownloadURL(sRef);
        })
      );

      await updateDoc(doc(db, 'applications', uid), {
        feed: {
          description,
          video: finalVideoUrl,
          images: uploadedImageUrls,
          publishedAt: serverTimestamp(),
        },
        isPublished: true,
      });

      Alert.alert('Berjaya!', 'Kempen anda kini aktif di Halaman Utama.', [
        { text: 'OK', onPress: () => navigation.navigate('MainTabs', { screen: 'Kempen' }) }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Ralat', 'Gagal memuat naik kandungan kempen.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}><ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 50}}/></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kandungan Kempen</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Penerangan Kempen</Text>
        <TextInput
          style={styles.input}
          placeholder="Tuliskan sesuatu tentang kempen anda..."
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.sectionTitle}>Video & Gambar</Text>
        <Text style={styles.subtitle}>Muat naik video pendek atau gambar untuk menarik perhatian penderma.</Text>
        
        <View style={styles.mediaContainer}>
          {videoUri ? (
            <View style={styles.videoWrapper}>
              <Video
                source={{ uri: videoUri }}
                style={styles.videoPreview}
                resizeMode="cover"
                useNativeControls
                isLooping
              />
              <TouchableOpacity style={styles.removeBtn} onPress={() => setVideoUri(null)}>
                <Ionicons name="close-circle" size={24} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={pickVideo}>
              <Feather name="video" size={30} color={COLORS.primary} />
              <Text style={styles.uploadText}>Tambah Video</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.uploadBox} onPress={pickImages}>
            <Feather name="image" size={30} color={COLORS.secondary} />
            <Text style={styles.uploadText}>Tambah Gambar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgRow}>
          {images.map((uri, i) => (
            <View key={i} style={styles.imgItem}>
              <Image source={{ uri }} style={styles.thumb} />
              <TouchableOpacity style={styles.removeThumb} onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}>
                <Ionicons name="close-circle" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity 
          style={[styles.publishBtn, uploading && { opacity: 0.7 }]} 
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.publishBtnText}>Publish ke Halaman Utama</Text>
              <Ionicons name="rocket" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 10 },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 16,
    fontSize: 15, color: COLORS.text, height: 120, textAlignVertical: 'top',
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 20,
  },
  mediaContainer: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  uploadBox: {
    flex: 1, height: 100, backgroundColor: COLORS.surface, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed',
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  uploadText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 8 },
  videoWrapper: { flex: 1, height: 100, position: 'relative' },
  videoPreview: { width: '100%', height: '100%', borderRadius: 12 },
  removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 12 },
  imgRow: { marginBottom: 30 },
  imgItem: { marginRight: 10, position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 10 },
  removeThumb: { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 9 },
  publishBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  publishBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
