import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, Image, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { COLORS } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-av';

const { width, height } = Dimensions.get('window');

// Placeholder images for categories
const CATEGORY_IMAGES = {
  'Perubatan': 'https://images.unsplash.com/photo-1576091160550-217359991f1c?w=800&q=80',
  'Haiwan': 'https://images.unsplash.com/photo-1548191265-cc70d3d45ba1?w=800&q=80',
  'Pendidikan': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80',
  'Bencana Alam': 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&q=80',
  'Umum': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80',
  'Permohonan Bantuan': 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80',
};

const CampaignItem = ({ item, navigation }) => {
  const feed = item.feed || {};
  const [isMuted, setIsMuted] = useState(false);

  // GABUNGKAN SEMUA MEDIA (Video + Gambar)
  const allMedia = [];
  if (feed.video) allMedia.push({ type: 'video', uri: feed.video });
  if (feed.images) {
    feed.images.forEach(uri => allMedia.push({ type: 'image', uri }));
  }
  // Jika tiada media langsung, guna placeholder
  if (allMedia.length === 0) {
    allMedia.push({ type: 'image', uri: CATEGORY_IMAGES[item.summary?.kategori] || CATEGORY_IMAGES['Umum'] });
  }

  const renderMediaItem = ({ item: media }) => (
    <View style={styles.mediaSlide}>
      {media.type === 'video' ? (
        <Video
          source={{ uri: media.uri }}
          style={styles.mediaContent}
          resizeMode="cover"
          shouldPlay
          isLooping
          isMuted={isMuted}
        />
      ) : (
        <Image source={{ uri: media.uri }} style={styles.mediaContent} />
      )}
    </View>
  );

  return (
    <View style={styles.campaignContainer}>
      <View style={styles.cardContainer}>
        <FlatList
          data={allMedia}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={renderMediaItem}
          keyExtractor={(m, i) => i.toString()}
          style={styles.mediaList}
        />

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.gradientOverlay}
        />

        {/* Side Actions */}
        <View style={styles.sideActions}>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="heart" size={32} color="#fff" />
            <Text style={styles.actionText}>Sukar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
            <Text style={styles.actionText}>Komen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="share-social" size={28} color="#fff" />
            <Text style={styles.actionText}>Kongsi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setIsMuted(!isMuted)}>
            <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom Content */}
        <View style={styles.bottomContent}>
          <View style={styles.applicantRow}>
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>{item.name?.[0]}</Text>
            </View>
            <Text style={styles.applicantName}>@{item.name?.toLowerCase().replace(/\s/g, '')}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />
            </View>
          </View>

          <Text style={styles.campaignTitle}>{item.summary?.tajuk || 'Kempen MyDana'}</Text>
          <Text style={styles.campaignDesc} numberOfLines={3}>
            {feed.description || item.summary?.sebab || 'Bantu saya mencukupi dana untuk keperluan mendesak ini.'}
          </Text>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '45%' }]} />
          </View>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressText}>{item.summary?.dana || 'RM 0'} sasaran</Text>
            <View style={styles.statusIndicator}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Aktif</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.donateBtn}
            onPress={() => navigation.navigate('Payment', { campaign: item })}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.donateGradient}
            >
              <Text style={styles.donateBtnText}>SUMBANG SEKARANG</Text>
              <Ionicons name="heart" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default function MainPageScreen({ navigation }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        console.log("Fetching campaigns...");
        const q = query(
          collection(db, 'applications'),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(app => app.status === 'approved' && app.isPublished);

        console.log("Found published campaigns:", data.length);
        setCampaigns(data);
      } catch (e) {
        console.error("Error fetching campaigns:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  if (loading) {
    return (
      <View style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Absolute Header Overlay */}
      <View style={styles.headerOverlay}>
        <Text style={styles.headerTitle}>MyDana Feed</Text>
      </View>

      {campaigns.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={60} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Tiada Kempen Aktif</Text>
          <Text style={styles.emptyText}>Belum ada kempen yang diluluskan buat masa ini.</Text>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          renderItem={({ item }) => <CampaignItem item={item} navigation={navigation} />}
          keyExtractor={item => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height - 110}
          snapToAlignment="start"
          decelerationRate="fast"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center' },
  headerOverlay: {
    position: 'absolute', top: 40, width: '100%', zIndex: 10,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  adminIcon: { position: 'absolute', right: 20 },
  campaignContainer: {
    width: width,
    height: height - 110,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  cardContainer: {
    width: width * 0.95,
    height: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  mediaList: { flex: 1 },
  mediaSlide: { width: width * 0.95, height: '100%' },
  mediaContent: { width: '100%', height: '100%', resizeMode: 'cover' },
  gradientOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.45,
  },
  sideActions: {
    position: 'absolute', right: 12, bottom: 150, gap: 20, alignItems: 'center',
  },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bottomContent: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    paddingHorizontal: 16,
  },
  applicantRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  avatarMini: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff',
  },
  avatarMiniText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  applicantName: { color: '#fff', fontWeight: '800', fontSize: 15 },
  verifiedBadge: { marginTop: 2 },
  campaignTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  campaignDesc: { color: '#e2e8f0', fontSize: 14, lineHeight: 20, marginBottom: 16, opacity: 0.9 },
  progressBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 6 },
  progressBarFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 2 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  activeText: { color: COLORS.success, fontSize: 12, fontWeight: '700' },
  donateBtn: { width: '100%', height: 54, borderRadius: 16, overflow: 'hidden' },
  donateGradient: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  donateBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 20 },
  emptyText: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 10, lineHeight: 22 },
});